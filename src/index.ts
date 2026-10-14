import { OAuthProvider, AuthorizationError, CimdFetchError } from "@cloudflare/workers-oauth-provider";
import { WorkerEntrypoint } from "cloudflare:workers";
import { createMcpHandler } from "agents/mcp/server";
import type { Env, BankSession } from "./types";
import { createBankingMcpServer } from "./mcp/server";
import {
  EnableBankingClient,
  getStoredSession,
  storeSession,
  deleteStoredSession,
  storePendingAuth,
  getPendingAuth,
  deletePendingAuth,
  getConnectionIndex,
  addConnectionToIndex,
  removeConnectionFromIndex,
  getAllSessions,
  generateConnectionId,
  storeBaseUrl,
  ensureBaseUrl,
  getConnectRequest,
  deleteConnectRequest,
  storeConnectRequest,
  type ConnectRequest,
  getConnectionId,
  getConnectionLabel,
  renameConnection,
} from "./enable-banking/client";
import type { ConnectionInfo } from "./types";
import { buildScopeProps, addToScope, type TokenProps } from "./scope";
import {
  magicLinkEnabled,
  sendMagicLink,
  consumeMagicLink,
  peekMagicLink,
  safeReturnPath,
} from "./auth/magic-link";
import {
  storeCredentials,
  getEffectiveCredentials,
  hasStoredCredentials,
  getStoredCredentialsMetadata,
  deleteStoredCredentials,
  hasEnvCredentials,
  validatePEM,
  normalizePEM,
} from "./enable-banking/credentials";
import { signJWT, createJWTPayload } from "./enable-banking/jwt";
import {
  renderSetupPage,
  renderConnectedPage,
  renderCallbackSuccessPage,
  renderCallbackErrorPage,
  renderLoginPage,
  renderDisconnectedPage,
  renderConsentPage,
  renderWizardPage,
  renderPrivacyPage,
  renderTermsPage,
  renderErrorPage,
  renderConnectPage,
  renderMagicLinkPage,
  type WizardState,
} from "./ui/pages";

const COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IS", "IE", "IT", "LV", "LI", "LT", "LU",
  "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "GB", "CH",
];

async function buildWizardState(env: Env): Promise<WizardState> {
  const credentialsFromEnv = hasEnvCredentials(env);
  const storedCredentialsMeta = await getStoredCredentialsMetadata(env.BANKING_KV);
  const hasCredentials = credentialsFromEnv || storedCredentialsMeta !== null;
  
  const allSessions = await getAllSessions(env.BANKING_KV);
  const connectionIndex = await getConnectionIndex(env.BANKING_KV);
  
  const connections: WizardState["connections"] = allSessions.map(session => {
    const connInfo = connectionIndex?.connections.find(c => c.id === session.connectionId);
    return {
      id: session.connectionId,
      label: connInfo?.label || session.label || (session.connectionId === "default" ? "Default" : session.aspspName),
      psuType: connInfo?.psuType || session.psuType || "personal",
      aspspName: session.aspspName,
      aspspCountry: session.aspspCountry,
      validUntil: session.consentValidUntil,
      accountCount: session.accounts.length,
    };
  });
  
  const defaultSession = allSessions.find(s => s.connectionId === "default");
  
  return {
    hasCredentials,
    credentialsFromEnv,
    appId: credentialsFromEnv ? env.ENABLE_BANKING_APP_ID : storedCredentialsMeta?.appId,
    hasBankSession: allSessions.length > 0,
    bankName: defaultSession?.aspspName,
    accountCount: defaultSession?.accounts.length,
    consentExpiry: defaultSession?.consentValidUntil,
    connections,
  };
}

function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function htmlResponse(html: string, status = 200, headers?: Headers): Response {
  const h = new Headers(headers);
  h.set("Content-Type", "text/html; charset=utf-8");
  return new Response(html, { status, headers: h });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseApiError(error: unknown): { message: string; details?: string } {
  if (!(error instanceof Error)) {
    return { message: "An unknown error occurred" };
  }
  
  const errorText = error.message;
  
  const apiErrorMatch = errorText.match(/Enable Banking API error: (\d+) ([^-]+) - (.*)/s);
  if (apiErrorMatch) {
    const [, statusCode, statusText, responseBody] = apiErrorMatch;
    
    try {
      const parsed = JSON.parse(responseBody);
      
      if (parsed.error) {
        let friendlyMessage = "Failed to connect to your bank";
        
        if (parsed.error === "WRONG_REQUEST_PARAMETERS") {
          friendlyMessage = "Invalid request parameters";
        } else if (parsed.error === "UNAUTHORIZED") {
          friendlyMessage = "Authorization failed";
        } else if (parsed.error === "ASPSP_ERROR") {
          friendlyMessage = "Your bank returned an error";
        }
        
        const details = `Error: ${parsed.error}${parsed.message ? `\nMessage: ${parsed.message}` : ""}${parsed.detail ? `\nDetails: ${JSON.stringify(parsed.detail, null, 2)}` : ""}`;
        
        return { message: friendlyMessage, details };
      }
      
      return { 
        message: `Bank connection failed (${statusCode})`, 
        details: JSON.stringify(parsed, null, 2) 
      };
    } catch {
      return { 
        message: `Bank connection failed (${statusCode} ${statusText})`, 
        details: responseBody 
      };
    }
  }
  
  return { message: errorText };
}

const encoder = new TextEncoder();

async function constantTimeCompare(a: string, b: string): Promise<boolean> {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    const dummy = encoder.encode("x".repeat(Math.max(aBytes.length, bBytes.length)));
    await crypto.subtle.timingSafeEqual(dummy, dummy);
    return false;
  }

  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

async function validateBearerToken(request: Request, env: Env): Promise<boolean> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(" ");
  if (scheme.toLowerCase() !== "bearer" || !token) return false;

  return await constantTimeCompare(token, env.AUTH_SECRET);
}

async function validateSessionAuth(request: Request, env: Env): Promise<boolean> {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return false;

  const sessionToken = match[1];
  const data = await env.BANKING_KV.get(`web_session:${sessionToken}`, "json");
  return data !== null;
}

async function createSessionCookie(env: Env): Promise<string> {
  const sessionToken = crypto.randomUUID();
  await env.BANKING_KV.put(
    `web_session:${sessionToken}`,
    JSON.stringify({ createdAt: Date.now() }),
    { expirationTtl: 86400 * 7 }
  );
  return `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${86400 * 7}`;
}

// Note: allowedHostnames is an exact-match allowlist ("*" is NOT a wildcard and
// rejects every request with 403 "Invalid Host"). Leaving it unset uses the
// request's own hostname on *.workers.dev. Origin checks are disabled because
// /mcp is protected by bearer tokens, and non-browser MCP clients may send
// arbitrary Origin headers.
export const MCP_HANDLER_OPTIONS = {
  allowedOriginHostnames: "*" as const,
  corsOptions: {
    origin: "*",
  },
};

export const createMcpHandlerForEnv = (env: Env, props?: TokenProps | null) =>
  createMcpHandler(() => createBankingMcpServer(env, props), MCP_HANDLER_OPTIONS);

export class McpApiHandler extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    // OAuth token props (userId, scopeGroups, scopeKey) set by the OAuth provider.
    const props = (this.ctx as unknown as { props?: TokenProps }).props;
    return createMcpHandlerForEnv(this.env, props)(request, this.env, this.ctx);
  }
}

export class DefaultHandler extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/authorize") {
      return this.handleAuthorize(request);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    return this.handleSetupRoutes(request);
  }

  private async consentConnections() {
    const state = await buildWizardState(this.env);
    return state.connections || [];
  }

  private async renderConsent(
    request: Request,
    loggedIn: boolean,
    opts: { error?: string; notice?: string; status?: number; selected?: string[] } = {}
  ): Promise<Response> {
    const oauthHelpers = this.env.OAUTH_PROVIDER;
    const authRequest = await oauthHelpers.parseAuthRequest(request);
    const consentDesc = await oauthHelpers.describeConsent(authRequest);
    const { handle, headers } = await oauthHelpers.beginConsent(authRequest);
    return htmlResponse(
      renderConsentPage(
        consentDesc.clientName || "MCP Client",
        consentDesc.scope || ["banking:read"],
        handle,
        !loggedIn,
        opts.error,
        {
          connections: loggedIn ? await this.consentConnections() : undefined,
          selected: opts.selected,
          magicLinkEnabled: magicLinkEnabled(this.env),
          notice: opts.notice,
        }
      ),
      opts.status || 200,
      headers
    );
  }

  private async handleAuthorize(request: Request): Promise<Response> {
    const oauthHelpers = this.env.OAUTH_PROVIDER;
    const url = new URL(request.url);
    const authorizeUrl = `/authorize${url.search}`;

    try {
      if (request.method === "GET") {
        // Validate the OAuth request up front (throws AuthorizationError if invalid).
        await oauthHelpers.parseAuthRequest(request);
        const isAuthenticated = await validateSessionAuth(request, this.env);
        return await this.renderConsent(request, isAuthenticated);
      }

      if (request.method === "POST") {
        const formData = await request.formData();
        const handle = formData.get("handle")?.toString() || "";
        const password = formData.get("password")?.toString() || "";
        const action = formData.get("action")?.toString();

        if (action === "deny") {
          const { redirectTo, headers } = await oauthHelpers.denyConsent(request, handle);
          const responseHeaders = new Headers(headers);
          responseHeaders.set("Location", redirectTo);
          return new Response(null, { status: 302, headers: responseHeaders });
        }

        if (action === "magic") {
          try {
            const result = await sendMagicLink(this.env, getBaseUrl(request), authorizeUrl);
            const notice =
              result === "disabled"
                ? undefined
                : result === "rate_limited"
                  ? "A login link was sent less than a minute ago. Check your email."
                  : "Check your email for a login link. Open it in this browser to continue.";
            return await this.renderConsent(request, false, {
              notice,
              error: result === "disabled" ? "Email login is not configured." : undefined,
            });
          } catch (error) {
            console.error("Magic link error:", error);
            return await this.renderConsent(request, false, {
              error: "Could not send the login email. Use your password instead.",
              status: 500,
            });
          }
        }

        let isAuthorized = await validateSessionAuth(request, this.env);
        let newCookie: string | null = null;
        if (!isAuthorized && password) {
          isAuthorized = await constantTimeCompare(password, this.env.AUTH_SECRET);
          if (isAuthorized) newCookie = await createSessionCookie(this.env);
        }

        if (!isAuthorized) {
          return await this.renderConsent(request, false, {
            error: "Invalid password. Please try again.",
            status: 401,
          });
        }

        if (action === "login") {
          // Logged in: show the connection picker on a fresh consent page.
          const headers = new Headers({ Location: authorizeUrl });
          if (newCookie) headers.append("Set-Cookie", newCookie);
          return new Response(null, { status: 303, headers });
        }

        if (action === "add_bank") {
          const token = crypto.randomUUID();
          await storeConnectRequest(this.env.BANKING_KV, token, {
            label: "",
            psuType: "personal",
            country: "DK",
            createdAt: Date.now(),
            editable: true,
            returnTo: authorizeUrl,
          });
          const headers = new Headers({ Location: `/connect?token=${encodeURIComponent(token)}` });
          if (newCookie) headers.append("Set-Cookie", newCookie);
          return new Response(null, { status: 303, headers });
        }

        // approve
        const connections = await this.consentConnections();
        const allIds = connections.map((c) => c.id);
        // A password-only approval (old single-step form) never saw the picker: grant all.
        const sawPicker = formData.get("picker") === "1";
        const selected = sawPicker ? formData.getAll("connection").map(String) : allIds;
        if (sawPicker && allIds.length > 0 && selected.length === 0) {
          return await this.renderConsent(request, true, {
            error: "Select at least one bank connection.",
            status: 400,
            selected,
          });
        }
        const props = buildScopeProps("owner", selected, allIds);

        const { request: approvedRequest, headers } = await oauthHelpers.approveConsent(
          request,
          handle,
          { scope: ["banking:read"] }
        );

        const { redirectTo } = await oauthHelpers.completeAuthorization({
          request: approvedRequest,
          userId: props.userId || "owner",
          metadata: { role: "owner", scopeGroups: props.scopeGroups || "all" },
          scope: approvedRequest.scope,
          props,
        });

        const responseHeaders = new Headers(headers);
        responseHeaders.set("Location", redirectTo);
        if (newCookie) responseHeaders.append("Set-Cookie", newCookie);
        return new Response(null, { status: 302, headers: responseHeaders });
      }
    } catch (error) {
      if (error instanceof AuthorizationError) {
        if (error.redirectTo) {
          return Response.redirect(error.redirectTo, 302);
        }
        return htmlResponse(
          renderCallbackErrorPage(`Authorization error: ${error.description}`),
          400
        );
      }
      if (error instanceof CimdFetchError) {
        console.error("Client metadata fetch error:", error);
        return htmlResponse(
          renderCallbackErrorPage(`Failed to fetch client metadata: ${error.detail}`),
          400
        );
      }
      console.error("Authorization error:", error);
      return htmlResponse(
        renderCallbackErrorPage(`Authorization failed: ${error instanceof Error ? error.message : "Unknown error"}`),
        500
      );
    }

    return new Response("Method not allowed", { status: 405 });
  }

  private async handleConnectFlow(
    connectRequest: ConnectRequest,
    token: string,
    baseUrl: string,
    countryOverride?: string | null
  ): Promise<Response> {
    const { label, psuType, bankName } = connectRequest;
    const country =
      connectRequest.editable && countryOverride && /^[A-Z]{2}$/.test(countryOverride.toUpperCase())
        ? countryOverride.toUpperCase()
        : connectRequest.country;

    try {
      const client = await EnableBankingClient.create(this.env);
      const banks = await client.getASPSPs(country);

      let matchedBank: { name: string; aspsp_id?: string } | undefined;
      if (bankName) {
        const exactMatches = banks.filter(
          (b) => b.name.toLowerCase() === bankName.toLowerCase()
        );
        if (exactMatches.length === 1) {
          matchedBank = exactMatches[0];
        }
      }

      if (matchedBank && !connectRequest.editable) {
        return await this.startConnectAuthorization(
          token,
          connectRequest,
          matchedBank.aspsp_id || matchedBank.name,
          matchedBank.name,
          country,
          psuType,
          label,
          baseUrl
        );
      }

      return htmlResponse(
        renderConnectPage(baseUrl, label, psuType, country, banks, token, bankName, {
          editable: connectRequest.editable,
          countries: COUNTRIES,
          returnTo: connectRequest.returnTo,
        })
      );
    } catch (error) {
      console.error("Failed to handle connect flow:", error);
      const { message, details } = parseApiError(error);
      return htmlResponse(renderCallbackErrorPage(message, details), 500);
    }
  }

  private async startConnectAuthorization(
    token: string,
    connectRequest: ConnectRequest,
    aspspId: string,
    aspspName: string,
    country: string,
    psuType: "personal" | "business",
    label: string,
    baseUrl: string
  ): Promise<Response> {
    const state = crypto.randomUUID();
    const client = await EnableBankingClient.create(this.env);
    const auth = await client.startAuthorization(
      aspspName,
      country,
      `${baseUrl}/callback`,
      psuType,
      state
    );
    await storePendingAuth(this.env.BANKING_KV, state, {
      aspspId,
      aspspName,
      aspspCountry: country,
      connectionId: generateConnectionId(),
      psuType,
      label: label || aspspName,
      ...(connectRequest.scopeKey ? { scopeKey: connectRequest.scopeKey } : {}),
      ...(connectRequest.returnTo ? { returnTo: safeReturnPath(connectRequest.returnTo) } : {}),
    });
    await deleteConnectRequest(this.env.BANKING_KV, token);
    return Response.redirect(auth.url, 302);
  }

  private async handleSetupRoutes(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const baseUrl = getBaseUrl(request);

    if (path === "/privacy") {
      return htmlResponse(renderPrivacyPage(url.host));
    }

    if (path === "/terms") {
      return htmlResponse(renderTermsPage(url.host));
    }

    if (path === "/login") {
      const returnUrl = url.searchParams.get("return");
      
      if (request.method === "GET") {
        return htmlResponse(
          renderLoginPage(undefined, returnUrl || undefined, { magicLinkEnabled: magicLinkEnabled(this.env) })
        );
      }

      if (request.method === "POST") {
        const formData = await request.formData();
        const password = formData.get("password")?.toString() || "";
        const formReturnUrl = formData.get("return")?.toString();

        const isValid = await constantTimeCompare(password, this.env.AUTH_SECRET);
        if (formData.get("action")?.toString() === "magic") {
          let notice: string | undefined;
          let error: string | undefined;
          try {
            const result = await sendMagicLink(this.env, baseUrl, safeReturnPath(formReturnUrl));
            if (result === "sent") notice = "Check your email for a login link.";
            else if (result === "rate_limited") notice = "A login link was sent less than a minute ago. Check your email.";
            else error = "Email login is not configured.";
          } catch (e) {
            console.error("Magic link error:", e);
            error = "Could not send the login email. Use your password instead.";
          }
          return htmlResponse(
            renderLoginPage(error, formReturnUrl || undefined, { magicLinkEnabled: magicLinkEnabled(this.env), notice })
          );
        }

        if (!isValid) {
          return htmlResponse(
            renderLoginPage("Invalid password. Please try again.", formReturnUrl || undefined, {
              magicLinkEnabled: magicLinkEnabled(this.env),
            }),
            401
          );
        }

        const sessionCookie = await createSessionCookie(this.env);
        const redirectTo = formReturnUrl && formReturnUrl.startsWith("/") ? formReturnUrl : "/setup";
        return new Response(null, {
          status: 302,
          headers: {
            Location: redirectTo,
            "Set-Cookie": sessionCookie,
          },
        });
      }
    }

    if (path === "/auth/magic") {
      // GET shows a confirm button so link scanners/prefetchers can't use up the one-time token.
      if (request.method === "GET") {
        const token = url.searchParams.get("token") || "";
        const valid = await peekMagicLink(this.env.BANKING_KV, token);
        return htmlResponse(renderMagicLinkPage(token, valid), valid ? 200 : 400);
      }
      if (request.method === "POST") {
        const formData = await request.formData();
        const data = await consumeMagicLink(this.env.BANKING_KV, formData.get("token")?.toString() || "");
        if (!data || data.email !== this.env.OWNER_EMAIL) {
          return htmlResponse(renderMagicLinkPage("", false), 400);
        }
        const sessionCookie = await createSessionCookie(this.env);
        return new Response(null, {
          status: 303,
          headers: { Location: safeReturnPath(data.returnTo), "Set-Cookie": sessionCookie },
        });
      }
      return new Response("Method not allowed", { status: 405 });
    }

    const isAuthenticated = await validateSessionAuth(request, this.env);

    if (path === "/connections/rename" && request.method === "POST") {
      if (!isAuthenticated) {
        return Response.redirect(`${baseUrl}/login`, 302);
      }
      const formData = await request.formData();
      const connectionId = formData.get("connection_id")?.toString() || "";
      const label = (formData.get("label")?.toString() || "").trim().slice(0, 80);
      const ok = label ? await renameConnection(this.env.BANKING_KV, connectionId, label) : false;
      const wizardState = await buildWizardState(this.env);
      return htmlResponse(
        renderWizardPage(
          baseUrl,
          wizardState,
          COUNTRIES,
          ok ? undefined : "Could not rename: connection not found or empty name",
          ok ? `Renamed to "${label}"` : undefined
        ),
        ok ? 200 : 400
      );
    }

    if (path === "/connect") {
      const token = url.searchParams.get("token");
      if (!token) {
        return htmlResponse(
          renderCallbackErrorPage("Missing token", "No connect token was provided."),
          400
        );
      }
      const connectRequest = await getConnectRequest(this.env.BANKING_KV, token);
      if (!connectRequest) {
        return htmlResponse(
          renderCallbackErrorPage("Invalid or expired token", "The connect link has expired or is invalid. Please request a new one."),
          400
        );
      }
      if (!isAuthenticated) {
        const returnUrl = encodeURIComponent(`/connect?token=${encodeURIComponent(token)}`);
        return Response.redirect(`${baseUrl}/login?return=${returnUrl}`, 302);
      }
      return this.handleConnectFlow(connectRequest, token, baseUrl, url.searchParams.get("country"));
    }

    if (path === "/auth/connect") {
      if (!isAuthenticated) {
        return Response.redirect(`${baseUrl}/login`, 302);
      }
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      const formData = await request.formData();
      const token = formData.get("token")?.toString();
      const aspspId = formData.get("aspsp_id")?.toString();
      const aspspName = formData.get("aspsp_name")?.toString() || aspspId || "";
      if (!token) {
        return htmlResponse(
          renderCallbackErrorPage("Missing token", "No connect token was provided."),
          400
        );
      }
      const connectRequest = await getConnectRequest(this.env.BANKING_KV, token);
      if (!connectRequest) {
        return htmlResponse(
          renderCallbackErrorPage("Invalid or expired token", "The connect link has expired. Please request a new one."),
          400
        );
      }
      if (!aspspId) {
        return htmlResponse(
          renderCallbackErrorPage("Please select a bank", "No bank was selected from the list."),
          400
        );
      }
      const country = formData.get("country")?.toString() || connectRequest.country;
      const psuType = (formData.get("psu_type")?.toString() || connectRequest.psuType || "personal") as "personal" | "business";
      const formLabel = connectRequest.editable ? formData.get("label")?.toString().trim() : "";
      try {
        return await this.startConnectAuthorization(
          token,
          connectRequest,
          aspspId,
          aspspName,
          country,
          psuType,
          formLabel || connectRequest.label,
          baseUrl
        );
      } catch (error) {
        console.error("Failed to start authorization:", error);
        const { message, details } = parseApiError(error);
        return htmlResponse(renderCallbackErrorPage(message, details), 500);
      }
    }

    if (path === "/" || path === "/setup") {
      if (!isAuthenticated) {
        return Response.redirect(`${baseUrl}/login`, 302);
      }

      await storeBaseUrl(this.env.BANKING_KV, baseUrl);
      const wizardState = await buildWizardState(this.env);
      return htmlResponse(renderWizardPage(baseUrl, wizardState, COUNTRIES));
    }

    if (path.startsWith("/renew/")) {
      const connectionId = decodeURIComponent(path.replace("/renew/", ""));
      
      if (!isAuthenticated) {
        const returnUrl = encodeURIComponent(`/renew/${encodeURIComponent(connectionId)}`);
        return Response.redirect(`${baseUrl}/login?return=${returnUrl}`, 302);
      }

      const sessions = await getAllSessions(this.env.BANKING_KV);
      const session = sessions.find((s) => getConnectionId(s) === connectionId);
      
      if (!session) {
        return htmlResponse(
          renderCallbackErrorPage(
            `Connection '${connectionId}' not found`,
            "This connection may have been removed or does not exist."
          ),
          404
        );
      }

      const state = crypto.randomUUID();
      const redirectUrl = `${baseUrl}/callback`;
      const connIndex = await getConnectionIndex(this.env.BANKING_KV);
      const connMeta = connIndex?.connections.find((c) => c.id === connectionId);
      const psuType = connMeta?.psuType || session.psuType || "personal";
      const label = connMeta?.label || getConnectionLabel(session);

      try {
        const client = await EnableBankingClient.create(this.env);
        const auth = await client.startAuthorization(
          session.aspspName,
          session.aspspCountry,
          redirectUrl,
          psuType,
          state
        );

        await storePendingAuth(this.env.BANKING_KV, state, {
          aspspId: session.aspspId,
          aspspName: session.aspspName,
          aspspCountry: session.aspspCountry,
          connectionId,
          psuType,
          label,
          isRenewal: true,
        });

        return Response.redirect(auth.url, 302);
      } catch (error) {
        console.error("Failed to start renewal authorization:", error);
        const { message, details } = parseApiError(error);
        return htmlResponse(
          renderCallbackErrorPage(message, details),
          500
        );
      }
    }

    if (path === "/bank/connect") {
      if (!isAuthenticated) {
        return Response.redirect(`${baseUrl}/login`, 302);
      }
      return htmlResponse(renderSetupPage(COUNTRIES));
    }

    if (path === "/api/credentials/validate") {
      if (!isAuthenticated) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      try {
        const body = await request.json() as { privateKey?: string; appId?: string };
        const { privateKey, appId } = body;

        if (!privateKey) {
          return jsonResponse({ valid: false, error: "Private key is required" });
        }

        const pemValidation = await validatePEM(privateKey);
        if (!pemValidation.valid) {
          return jsonResponse({ valid: false, error: pemValidation.error });
        }

        if (appId) {
          try {
            const normalizedPem = await normalizePEM(privateKey);
            const payload = createJWTPayload(appId);
            const token = await signJWT(payload, normalizedPem, appId);
            
            const apiBase = this.env.ENABLE_BANKING_API_BASE || "https://api.enablebanking.com";
            const response = await fetch(`${apiBase}/application`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
              return jsonResponse({ valid: true, apiTest: true });
            } else {
              const errorText = await response.text();
              return jsonResponse({ 
                valid: true, 
                apiTest: false, 
                apiError: `API returned ${response.status}: ${errorText}` 
              });
            }
          } catch (apiError) {
            return jsonResponse({ 
              valid: true, 
              apiTest: false, 
              apiError: apiError instanceof Error ? apiError.message : "API test failed" 
            });
          }
        }

        return jsonResponse({ valid: true });
      } catch (error) {
        return jsonResponse({ 
          valid: false, 
          error: error instanceof Error ? error.message : "Validation failed" 
        });
      }
    }

    if (path === "/api/credentials") {
      if (!isAuthenticated) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const contentType = request.headers.get("Content-Type") || "";
      let action: string | undefined;
      let appId: string | undefined;
      let privateKey: string | undefined;

      if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await request.formData();
        action = formData.get("action")?.toString();
        appId = formData.get("appId")?.toString();
        privateKey = formData.get("privateKey")?.toString();
      } else {
        const body = await request.json() as { action?: string; appId?: string; privateKey?: string };
        action = body.action;
        appId = body.appId;
        privateKey = body.privateKey;
      }

      if (action === "delete") {
        if (hasEnvCredentials(this.env)) {
          const wizardState = await buildWizardState(this.env);
          return htmlResponse(
            renderWizardPage(baseUrl, wizardState, COUNTRIES, "Cannot delete credentials set via environment variables")
          );
        }
        await deleteStoredCredentials(this.env.BANKING_KV);
        const wizardState = await buildWizardState(this.env);
        return htmlResponse(
          renderWizardPage(baseUrl, wizardState, COUNTRIES, undefined, "Credentials removed successfully")
        );
      }

      if (action === "save") {
        if (!appId || !privateKey) {
          const wizardState = await buildWizardState(this.env);
          return htmlResponse(
            renderWizardPage(baseUrl, wizardState, COUNTRIES, "App ID and private key are required")
          );
        }

        const pemValidation = await validatePEM(privateKey);
        if (!pemValidation.valid) {
          const wizardState = await buildWizardState(this.env);
          return htmlResponse(
            renderWizardPage(baseUrl, wizardState, COUNTRIES, `Invalid private key: ${pemValidation.error}`)
          );
        }

        try {
          await storeCredentials(this.env.BANKING_KV, appId, privateKey, this.env.AUTH_SECRET);
          const wizardState = await buildWizardState(this.env);
          return htmlResponse(
            renderWizardPage(baseUrl, wizardState, COUNTRIES, undefined, "Credentials saved successfully!")
          );
        } catch (error) {
          const wizardState = await buildWizardState(this.env);
          return htmlResponse(
            renderWizardPage(baseUrl, wizardState, COUNTRIES, `Failed to save credentials: ${error instanceof Error ? error.message : "Unknown error"}`)
          );
        }
      }

      return jsonResponse({ error: "Invalid action" }, 400);
    }

    if (path === "/api/banks") {
      if (!isAuthenticated) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const country = url.searchParams.get("country");
      if (!country) {
        return jsonResponse({ error: "country parameter required" }, 400);
      }

      try {
        const client = await EnableBankingClient.create(this.env);
        const banks = await client.getASPSPs(country);
        return jsonResponse(banks);
      } catch (error) {
        console.error("Failed to fetch banks:", error);
        return jsonResponse({ error: error instanceof Error ? error.message : "Failed to fetch banks" }, 500);
      }
    }

    if (path === "/auth/start") {
      if (!isAuthenticated) {
        return Response.redirect(`${baseUrl}/login`, 302);
      }

      if (request.method === "GET") {
        return htmlResponse(renderSetupPage(COUNTRIES));
      }

      if (request.method === "POST") {
        const formData = await request.formData();
        const aspspId = formData.get("aspsp_id")?.toString();
        const aspspName = formData.get("aspsp_name")?.toString() || aspspId || "";
        const country = formData.get("country")?.toString();
        const psuType = (formData.get("psu_type")?.toString() || "personal") as "personal" | "business";
        const label = formData.get("label")?.toString() || "";
        const connectionId = formData.get("connection_id")?.toString() || generateConnectionId();

        if (!aspspId) {
          return htmlResponse(
            renderCallbackErrorPage("Please select a bank", "No bank was selected from the list."),
            400
          );
        }

        if (!country) {
          return htmlResponse(
            renderCallbackErrorPage("Please select a country", "No country was selected."),
            400
          );
        }

        const state = crypto.randomUUID();
        const redirectUrl = `${baseUrl}/callback`;

        try {
          const client = await EnableBankingClient.create(this.env);
          const auth = await client.startAuthorization(
            aspspName,
            country,
            redirectUrl,
            psuType,
            state
          );

          await storePendingAuth(this.env.BANKING_KV, state, {
            aspspId,
            aspspName,
            aspspCountry: country,
            connectionId,
            psuType,
            label: label || aspspName,
          });

          return Response.redirect(auth.url, 302);
        } catch (error) {
          console.error("Failed to start authorization:", error);
          const { message, details } = parseApiError(error);
          return htmlResponse(
            renderCallbackErrorPage(message, details),
            500
          );
        }
      }
    }

    if (path === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        return htmlResponse(
          renderCallbackErrorPage(`Bank returned error: ${error}`),
          400
        );
      }

      if (!code || !state) {
        return htmlResponse(
          renderCallbackErrorPage("Missing authorization code or state"),
          400
        );
      }

      const pendingAuth = await getPendingAuth(this.env.BANKING_KV, state);
      if (!pendingAuth) {
        return htmlResponse(
          renderCallbackErrorPage("Invalid or expired state. Please try again."),
          400
        );
      }

      try {
        const client = await EnableBankingClient.create(this.env);
        const sessionResponse = await client.createSession(code);

        const session: BankSession = {
          sessionId: sessionResponse.session_id,
          aspspId: pendingAuth.aspspId,
          aspspName: sessionResponse.aspsp?.name || pendingAuth.aspspName,
          aspspCountry: sessionResponse.aspsp?.country || pendingAuth.aspspCountry,
          consentValidUntil: sessionResponse.access.valid_until,
          accounts: sessionResponse.accounts.map((acc) => ({
            accountId: acc.uid,
            iban: acc.account_id?.iban,
            name: acc.name,
            currency: acc.currency,
            accountType: acc.account_type,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          psuType: pendingAuth.psuType,
          label: pendingAuth.label,
          connectionId: pendingAuth.connectionId,
        };

        await storeSession(this.env.BANKING_KV, session, pendingAuth.connectionId);
        
        const connectionInfo: ConnectionInfo = {
          id: pendingAuth.connectionId,
          label: pendingAuth.label,
          psuType: pendingAuth.psuType,
          aspspName: session.aspspName,
          aspspCountry: session.aspspCountry,
          validUntil: session.consentValidUntil,
          createdAt: session.createdAt,
        };
        await addConnectionToIndex(this.env.BANKING_KV, connectionInfo);
        if (pendingAuth.scopeKey) {
          await addToScope(this.env.BANKING_KV, pendingAuth.scopeKey, pendingAuth.connectionId);
        }
        
        await deletePendingAuth(this.env.BANKING_KV, state);

        const isRenewal = pendingAuth.isRenewal;
        return htmlResponse(
          renderCallbackSuccessPage(
            session,
            isRenewal,
            pendingAuth.returnTo ? safeReturnPath(pendingAuth.returnTo) : undefined
          )
        );
      } catch (error) {
        console.error("Failed to create session:", error);
        return htmlResponse(
          renderCallbackErrorPage(
            `Failed to create session: ${error instanceof Error ? error.message : "Unknown error"}`
          ),
          500
        );
      }
    }

    if (path === "/disconnect" && request.method === "POST") {
      if (!isAuthenticated) {
        return Response.redirect(`${baseUrl}/login`, 302);
      }

      const formData = await request.formData();
      const connectionId = formData.get("connection_id")?.toString() || "default";
      
      const session = await getStoredSession(this.env.BANKING_KV, connectionId);
      if (session) {
        try {
          const client = await EnableBankingClient.create(this.env);
          await client.deleteSession(session.sessionId);
        } catch (error) {
          console.error("Failed to delete session at Enable Banking:", error);
        }
        await deleteStoredSession(this.env.BANKING_KV, connectionId);
        if (connectionId !== "default") {
          await removeConnectionFromIndex(this.env.BANKING_KV, connectionId);
        }
      }
      
      const wizardState = await buildWizardState(this.env);
      return htmlResponse(
        renderWizardPage(baseUrl, wizardState, COUNTRIES, undefined, "Bank disconnected successfully")
      );
    }

    if (path === "/.well-known/mcp") {
      return jsonResponse({
        name: "enable-banking-mcp",
        version: "1.0.0",
        description: "Personal MCP server for bank data via Enable Banking PSD2 AIS API",
        url: `${baseUrl}/mcp`,
        authentication: {
          type: "oauth",
          authorization_url: `${baseUrl}/authorize`,
          token_url: `${baseUrl}/token`,
          registration_url: `${baseUrl}/register`,
          scopes: ["banking:read"],
        },
      });
    }

    if (path === "/.well-known/oauth-protected-resource") {
      return jsonResponse({
        resource: `${baseUrl}/mcp`,
        authorization_servers: [baseUrl],
        scopes_supported: ["banking:read"],
        bearer_methods_supported: ["header"],
      });
    }

    return new Response("Not Found", { status: 404 });
  }
}

function createOAuthProvider(baseUrl: string) {
  return new OAuthProvider<Env>({
    apiRoute: "/mcp",
    apiHandler: McpApiHandler,
    defaultHandler: DefaultHandler,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
    scopesSupported: ["banking:read"],
    accessTokenTTL: 3600 * 24,
    refreshTokenTTL: 3600 * 24 * 30,
    resourceMetadata: {
      resource: `${baseUrl}/mcp`,
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const baseUrl = getBaseUrl(request);

    try {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Max-Age": "86400",
          },
        });
      }

      if (path === "/mcp" || path.startsWith("/mcp/")) {
        // Remember the public base URL so renew links work without visiting /setup first.
        try {
          await ensureBaseUrl(env.BANKING_KV, baseUrl);
        } catch (error) {
          console.error("Failed to store base URL:", error);
        }
        const isBearerAuth = await validateBearerToken(request, env);
        if (isBearerAuth) {
          return createMcpHandlerForEnv(env)(request, env, ctx);
        }
      }

      const provider = createOAuthProvider(baseUrl);
      return provider.fetch(request, env, ctx);
    } catch (error) {
      console.error("Unhandled error in fetch handler:", error);
      
      const isJsonRequest = request.headers.get("Accept")?.includes("application/json") ||
        request.headers.get("Content-Type")?.includes("application/json");
      
      if (isJsonRequest) {
        return new Response(
          JSON.stringify({
            error: "server_error",
            error_description: error instanceof Error ? error.message : "An unexpected error occurred",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        renderErrorPage(
          "Server Error",
          error instanceof Error ? error.message : "An unexpected error occurred"
        ),
        {
          status: 500,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }
  },
};
