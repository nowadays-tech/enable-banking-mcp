import { backfillSessionHistory, deleteHistoryCache } from "./enable-banking/history";
import { refreshSessionAccounts, refreshNotice } from "./enable-banking/refresh";
import { listMcpClients, OWNER_USER_ID } from "./mcp-clients";
import { OAuthProvider, AuthorizationError, CimdFetchError } from "@cloudflare/workers-oauth-provider";
import { WorkerEntrypoint } from "cloudflare:workers";
import { createMcpHandler } from "agents/mcp/server";
import type { Env, BankSession, ConnectedSession, ConnectionInfo } from "./types";
import { createBankingMcpServer } from "./mcp/server";
import {
  EnableBankingClient,
  getStoredSession,
  storeSession,
  deleteStoredSession,
  storePendingAuth,
  getPendingAuth,
  deletePendingAuth,
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
  type PendingAuthData,
  renameConnection,
} from "./enable-banking/client";
import { buildScopeProps, addToScope, grantIdFromAuthHeader, setClientScopeOverride, deleteClientScopeOverride, parseScopeForm, type TokenProps } from "./scope";
import { checkPassword, passwordError } from "./auth/password";
import {
  magicLinkEnabled,
  sendMagicLink,
  consumeMagicLink,
  peekMagicLink,
  safeReturnPath,
} from "./auth/magic-link";
import {
  storeCredentials,
  getStoredCredentialsMetadata,
  deleteStoredCredentials,
  hasEnvCredentials,
  validatePEM,
  normalizePEM,
} from "./enable-banking/credentials";
import { signJWT, createJWTPayload } from "./enable-banking/jwt";
import {
  renderCallbackSuccessPage,
  renderCallbackErrorPage,
  renderLoginPage,
  renderConsentPage,
  renderWizardPage,
  renderPrivacyPage,
  renderTermsPage,
  renderErrorPage,
  renderConnectPage,
  renderMagicLinkPage,
  type WizardConnection,
  type WizardState,
} from "./ui/pages";

const COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IS", "IE", "IT", "LV", "LI", "LT", "LU",
  "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "GB", "CH",
];

/** Paths anyone may open. Every other DefaultHandler path needs a logged-in session. */
const PUBLIC_PATHS = ["/privacy", "/terms", "/login", "/auth/magic", "/callback"];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.includes(path) || path.startsWith("/.well-known/");
}

function connectionView(session: ConnectedSession): WizardConnection {
  return {
    id: session.connectionId,
    label: session.label,
    psuType: session.psuType,
    aspspName: session.aspspName,
    aspspCountry: session.aspspCountry,
    validUntil: session.consentValidUntil,
    accountCount: session.accounts.length,
    accounts: session.accounts.map((a) => ({ accountId: a.accountId, name: a.name, iban: a.iban, currency: a.currency })),
  };
}

async function buildWizardState(env: Env): Promise<WizardState> {
  const credentialsFromEnv = hasEnvCredentials(env);
  const storedCredentialsMeta = await getStoredCredentialsMetadata(env.BANKING_KV);
  const sessions = await getAllSessions(env.BANKING_KV);
  const state: WizardState = {
    hasCredentials: credentialsFromEnv || storedCredentialsMeta !== null,
    credentialsFromEnv,
    appId: credentialsFromEnv ? env.ENABLE_BANKING_APP_ID : storedCredentialsMeta?.appId,
    hasBankSession: sessions.length > 0,
    connections: sessions.map(connectionView),
  };
  if (!state.hasCredentials || !state.hasBankSession) return state;
  try {
    state.clients = await listMcpClients(env.OAUTH_PROVIDER, OWNER_USER_ID, env.BANKING_KV);
  } catch (error) {
    console.error("Failed to list MCP clients:", error);
    state.clientsUnavailable = true;
  }
  return state;
}

function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function htmlResponse(html: string, status = 200, headers?: HeadersInit): Response {
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

function getCookie(request: Request, name: string): string | undefined {
  const match = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1];
}

async function validateSessionAuth(request: Request, env: Env): Promise<boolean> {
  const sessionToken = getCookie(request, "session");
  if (!sessionToken) return false;
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

interface Flash {
  error?: string;
  notice?: string;
}

/** POST-redirect-GET for setup actions: the message rides along in a short-lived cookie. */
function redirectToSetup(baseUrl: string, flash: Flash): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${baseUrl}/setup`,
      "Set-Cookie": `flash=${encodeURIComponent(JSON.stringify(flash))}; Path=/; Max-Age=60; HttpOnly; SameSite=Lax`,
    },
  });
}

function readFlash(request: Request): Flash | null {
  const raw = getCookie(request, "flash");
  if (!raw) return null;
  try {
    const { error, notice } = JSON.parse(decodeURIComponent(raw));
    return {
      error: typeof error === "string" ? error : undefined,
      notice: typeof notice === "string" ? notice : undefined,
    };
  } catch {
    return {};
  }
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

export const createMcpHandlerForEnv = (env: Env, props?: TokenProps | null, grantId?: string) =>
  createMcpHandler(() => createBankingMcpServer(env, props, grantId), MCP_HANDLER_OPTIONS);

export class McpApiHandler extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    // OAuth token props (userId, scopeGroups, scopeKey) set by the OAuth provider.
    const props = (this.ctx as unknown as { props?: TokenProps }).props;
    // OAuth access tokens are `userId:grantId:secret`; the grant id keys owner-set scope overrides.
    const grantId = props ? grantIdFromAuthHeader(request.headers.get("Authorization")) : undefined;
    return createMcpHandlerForEnv(this.env, props, grantId)(request, this.env, this.ctx);
  }
}

export class DefaultHandler extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const baseUrl = getBaseUrl(request);
    const route = `${request.method} ${path}`;

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

    // The OAuth consent page logs the owner in itself.
    if (path === "/authorize") return this.handleAuthorize(request);

    if (isPublicPath(path)) {
      switch (route) {
        case "GET /privacy": return htmlResponse(renderPrivacyPage(url.host));
        case "GET /terms": return htmlResponse(renderTermsPage(url.host));
        case "GET /login":
          return htmlResponse(renderLoginPage(undefined, url.searchParams.get("return") || undefined, { magicLinkEnabled: magicLinkEnabled(this.env) }));
        case "POST /login": return this.login(request, baseUrl);
        case "GET /auth/magic": return this.showMagicLink(url);
        case "POST /auth/magic": return this.consumeMagicLink(request);
        case "GET /callback": return this.bankCallback(url);
        case "GET /.well-known/mcp": return jsonResponse(mcpDiscovery(baseUrl));
        case "GET /.well-known/oauth-protected-resource":
          return jsonResponse({
            resource: `${baseUrl}/mcp`,
            authorization_servers: [baseUrl],
            scopes_supported: ["banking:read"],
            bearer_methods_supported: ["header"],
          });
      }
      return new Response("Not Found", { status: 404 });
    }

    if (!(await validateSessionAuth(request, this.env))) {
      if (path.startsWith("/api/")) return jsonResponse({ error: "Unauthorized" }, 401);
      const returnTo = request.method === "GET" ? `?return=${encodeURIComponent(path + url.search)}` : "";
      return Response.redirect(`${baseUrl}/login${returnTo}`, 302);
    }

    switch (route) {
      case "GET /":
      case "GET /setup": return this.setupPage(request, baseUrl);
      case "POST /connections/new": return this.newConnectRequest();
      case "POST /connections/rename": return this.renameConnection(request, baseUrl);
      case "POST /connections/refresh": return this.refreshConnection(request, baseUrl);
      case "POST /disconnect": return this.disconnect(request, baseUrl);
      case "POST /clients/scope": return this.updateClientScope(request, baseUrl);
      case "POST /clients/revoke": return this.revokeClient(request, baseUrl);
      case "GET /connect": return this.connectPage(url, baseUrl);
      case "POST /auth/connect": return this.connectBank(request, baseUrl);
      case "POST /api/credentials": return this.saveCredentials(request, baseUrl);
      case "POST /api/credentials/validate": return this.validateCredentials(request);
    }
    if (request.method === "GET" && path.startsWith("/renew/")) {
      return this.renewConnection(decodeURIComponent(path.slice("/renew/".length)), baseUrl);
    }
    return new Response("Not Found", { status: 404 });
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
          connections: loggedIn ? (await getAllSessions(this.env.BANKING_KV)).map(connectionView) : undefined,
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

        let newCookie: string | null = null;
        if (!(await validateSessionAuth(request, this.env))) {
          const result = password ? await checkPassword(this.env, request, password) : "wrong";
          if (result !== "ok") {
            const { message, status } = passwordError(result);
            return await this.renderConsent(request, false, { error: message, status });
          }
          newCookie = await createSessionCookie(this.env);
        }

        if (action === "login") {
          // Logged in: show the connection picker on a fresh consent page.
          const headers = new Headers({ Location: authorizeUrl });
          if (newCookie) headers.append("Set-Cookie", newCookie);
          return new Response(null, { status: 303, headers });
        }

        if (action === "add_bank") {
          const headers = new Headers({ Location: await this.storeEditableConnectRequest(authorizeUrl) });
          if (newCookie) headers.append("Set-Cookie", newCookie);
          return new Response(null, { status: 303, headers });
        }

        // approve
        const allIds = (await getAllSessions(this.env.BANKING_KV)).map((s) => s.connectionId);
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
        const props = buildScopeProps(OWNER_USER_ID, selected, allIds);

        const { request: approvedRequest, headers } = await oauthHelpers.approveConsent(
          request,
          handle,
          { scope: ["banking:read"] }
        );

        const { redirectTo } = await oauthHelpers.completeAuthorization({
          request: approvedRequest,
          userId: props.userId || OWNER_USER_ID,
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

  private async login(request: Request, baseUrl: string): Promise<Response> {
    const formData = await request.formData();
    const formReturnUrl = formData.get("return")?.toString();
    const magicLinkOn = magicLinkEnabled(this.env);

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
      return htmlResponse(renderLoginPage(error, formReturnUrl || undefined, { magicLinkEnabled: magicLinkOn, notice }));
    }

    const result = await checkPassword(this.env, request, formData.get("password")?.toString() || "");
    if (result !== "ok") {
      const { message, status } = passwordError(result);
      return htmlResponse(renderLoginPage(message, formReturnUrl || undefined, { magicLinkEnabled: magicLinkOn }), status);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: safeReturnPath(formReturnUrl),
        "Set-Cookie": await createSessionCookie(this.env),
      },
    });
  }

  // GET shows a confirm button so link scanners/prefetchers can't use up the one-time token.
  private async showMagicLink(url: URL): Promise<Response> {
    const token = url.searchParams.get("token") || "";
    const valid = await peekMagicLink(this.env.BANKING_KV, token);
    return htmlResponse(renderMagicLinkPage(token, valid), valid ? 200 : 400);
  }

  private async consumeMagicLink(request: Request): Promise<Response> {
    const formData = await request.formData();
    const data = await consumeMagicLink(this.env.BANKING_KV, formData.get("token")?.toString() || "");
    if (!data || data.email !== this.env.OWNER_EMAIL) {
      return htmlResponse(renderMagicLinkPage("", false), 400);
    }
    return new Response(null, {
      status: 303,
      headers: { Location: safeReturnPath(data.returnTo), "Set-Cookie": await createSessionCookie(this.env) },
    });
  }

  private async setupPage(request: Request, baseUrl: string): Promise<Response> {
    await storeBaseUrl(this.env.BANKING_KV, baseUrl);
    const flash = readFlash(request);
    return htmlResponse(
      renderWizardPage(baseUrl, await buildWizardState(this.env), flash?.error, flash?.notice),
      200,
      flash ? { "Set-Cookie": "flash=; Path=/; Max-Age=0" } : undefined
    );
  }

  /** A connect request where the owner picks label, account type, country and bank; returns the /connect URL. */
  private async storeEditableConnectRequest(returnTo: string): Promise<string> {
    const token = crypto.randomUUID();
    await storeConnectRequest(this.env.BANKING_KV, token, {
      label: "",
      psuType: "personal",
      country: "DK",
      createdAt: Date.now(),
      editable: true,
      returnTo,
    });
    return `/connect?token=${encodeURIComponent(token)}`;
  }

  private async newConnectRequest(): Promise<Response> {
    return new Response(null, { status: 303, headers: { Location: await this.storeEditableConnectRequest("/setup") } });
  }

  private async renameConnection(request: Request, baseUrl: string): Promise<Response> {
    const formData = await request.formData();
    const connectionId = formData.get("connection_id")?.toString() || "";
    const label = (formData.get("label")?.toString() || "").trim().slice(0, 80);
    const ok = label ? await renameConnection(this.env.BANKING_KV, connectionId, label) : false;
    return redirectToSetup(
      baseUrl,
      ok ? { notice: `Renamed to "${label}"` } : { error: "Could not rename: connection not found or empty name" }
    );
  }

  private async refreshConnection(request: Request, baseUrl: string): Promise<Response> {
    const formData = await request.formData();
    const connectionId = formData.get("connection_id")?.toString() || "";
    const session = (await getAllSessions(this.env.BANKING_KV)).find((s) => s.connectionId === connectionId);
    if (!session) return redirectToSetup(baseUrl, { error: "Bank connection not found" });
    try {
      const client = await EnableBankingClient.create(this.env);
      const result = await refreshSessionAccounts(client, session);
      if (!result.authorized) {
        return redirectToSetup(baseUrl, {
          error: `${session.label}: the bank consent is no longer active. Use Renew to approve again with MitID.`,
        });
      }
      await storeSession(this.env.BANKING_KV, result.session, connectionId);
      return redirectToSetup(baseUrl, {
        notice: refreshNotice(session.label, result.added.length, result.removed.length, result.session.accounts.length),
      });
    } catch (e) {
      console.error("Failed to refresh accounts:", e);
      const { message } = parseApiError(e);
      return redirectToSetup(baseUrl, {
        error: `${session.label}: couldn't refresh accounts (${message}). If the consent has expired, use Renew.`,
      });
    }
  }

  private async disconnect(request: Request, baseUrl: string): Promise<Response> {
    const formData = await request.formData();
    const connectionId = formData.get("connection_id")?.toString() || "";
    const session = connectionId ? await getStoredSession(this.env.BANKING_KV, connectionId) : null;
    if (!session) return redirectToSetup(baseUrl, { error: "Bank connection not found" });
    try {
      const client = await EnableBankingClient.create(this.env);
      await client.deleteSession(session.sessionId);
    } catch (error) {
      console.error("Failed to delete session at Enable Banking:", error);
    }
    for (const account of session.accounts) {
      await deleteHistoryCache(this.env.BANKING_KV, account.accountId);
    }
    await deleteStoredSession(this.env.BANKING_KV, connectionId);
    await removeConnectionFromIndex(this.env.BANKING_KV, connectionId);
    return redirectToSetup(baseUrl, { notice: "Bank disconnected successfully" });
  }

  private async updateClientScope(request: Request, baseUrl: string): Promise<Response> {
    const formData = await request.formData();
    const grantId = formData.get("grant_id")?.toString() || "";
    const override = parseScopeForm(
      {
        allBanks: formData.get("all_banks") === "1",
        connections: formData.getAll("connection").map(String),
        accounts: formData.getAll("account").map(String),
      },
      await getAllSessions(this.env.BANKING_KV)
    );
    const grants = await listMcpClients(this.env.OAUTH_PROVIDER).catch(() => []);
    const grant = grants.find((g) => g.grantId === grantId);
    if (!grant) return redirectToSetup(baseUrl, { error: "That app is no longer connected" });
    if (!override) return redirectToSetup(baseUrl, { error: "Select at least one bank or account, or revoke the app instead" });
    await setClientScopeOverride(this.env.BANKING_KV, grantId, override);
    return redirectToSetup(baseUrl, { notice: `Updated access for ${grant.clientName}` });
  }

  private async revokeClient(request: Request, baseUrl: string): Promise<Response> {
    const formData = await request.formData();
    const grantId = formData.get("grant_id")?.toString() || "";
    try {
      if (!grantId) throw new Error("Missing grant_id");
      await this.env.OAUTH_PROVIDER.revokeGrant(grantId, OWNER_USER_ID);
      await deleteClientScopeOverride(this.env.BANKING_KV, grantId);
      return redirectToSetup(baseUrl, { notice: "Client access revoked" });
    } catch (error) {
      console.error("Failed to revoke grant:", error);
      return redirectToSetup(baseUrl, { error: "Could not revoke that client" });
    }
  }

  private async connectPage(url: URL, baseUrl: string): Promise<Response> {
    const token = url.searchParams.get("token");
    const connectRequest = token ? await getConnectRequest(this.env.BANKING_KV, token) : null;
    if (!token || !connectRequest) {
      return htmlResponse(
        renderCallbackErrorPage("Invalid or expired token", "The connect link has expired or is invalid. Please request a new one."),
        400
      );
    }

    const { label, psuType, bankName } = connectRequest;
    const countryOverride = url.searchParams.get("country")?.toUpperCase();
    const country =
      connectRequest.editable && countryOverride && /^[A-Z]{2}$/.test(countryOverride)
        ? countryOverride
        : connectRequest.country;

    try {
      const client = await EnableBankingClient.create(this.env);
      const banks = await client.getASPSPs(country);

      const exactMatches = bankName ? banks.filter((b) => b.name.toLowerCase() === bankName.toLowerCase()) : [];
      if (exactMatches.length === 1 && !connectRequest.editable) {
        const bank = exactMatches[0];
        return await this.startNewConnection(baseUrl, token, connectRequest, {
          aspspId: bank.aspsp_id || bank.name,
          aspspName: bank.name,
          aspspCountry: country,
          psuType,
          label,
        });
      }

      return htmlResponse(
        renderConnectPage(label, psuType, country, banks, token, bankName, {
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

  private async connectBank(request: Request, baseUrl: string): Promise<Response> {
    const formData = await request.formData();
    const token = formData.get("token")?.toString() || "";
    const aspspId = formData.get("aspsp_id")?.toString();
    const connectRequest = token ? await getConnectRequest(this.env.BANKING_KV, token) : null;
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
    const formLabel = connectRequest.editable ? formData.get("label")?.toString().trim() : "";
    const psuType = formData.get("psu_type")?.toString() || connectRequest.psuType;
    return this.startNewConnection(baseUrl, token, connectRequest, {
      aspspId,
      aspspName: formData.get("aspsp_name")?.toString() || aspspId,
      aspspCountry: formData.get("country")?.toString() || connectRequest.country,
      psuType: psuType === "business" ? "business" : "personal",
      label: formLabel || connectRequest.label,
    });
  }

  /** Start the bank approval for a new connection and use up its connect token. */
  private async startNewConnection(
    baseUrl: string,
    token: string,
    connectRequest: ConnectRequest,
    bank: Pick<PendingAuthData, "aspspId" | "aspspName" | "aspspCountry" | "psuType" | "label">
  ): Promise<Response> {
    const response = await this.startBankAuthorization(baseUrl, {
      ...bank,
      label: bank.label || bank.aspspName,
      connectionId: generateConnectionId(),
      ...(connectRequest.scopeKey ? { scopeKey: connectRequest.scopeKey } : {}),
      ...(connectRequest.returnTo ? { returnTo: safeReturnPath(connectRequest.returnTo) } : {}),
    });
    if (response.status === 302) await deleteConnectRequest(this.env.BANKING_KV, token);
    return response;
  }

  private async renewConnection(connectionId: string, baseUrl: string): Promise<Response> {
    const session = (await getAllSessions(this.env.BANKING_KV)).find((s) => s.connectionId === connectionId);
    if (!session) {
      return htmlResponse(
        renderCallbackErrorPage(
          `Connection '${connectionId}' not found`,
          "This connection may have been removed or does not exist."
        ),
        404
      );
    }
    return this.startBankAuthorization(baseUrl, {
      aspspId: session.aspspId,
      aspspName: session.aspspName,
      aspspCountry: session.aspspCountry,
      connectionId,
      psuType: session.psuType,
      label: session.label,
      isRenewal: true,
    });
  }

  /** Send the browser to the bank's approval (e.g. MitID); /callback stores the result. */
  private async startBankAuthorization(baseUrl: string, pending: PendingAuthData): Promise<Response> {
    const state = crypto.randomUUID();
    try {
      const client = await EnableBankingClient.create(this.env);
      const auth = await client.startAuthorization(
        pending.aspspName,
        pending.aspspCountry,
        `${baseUrl}/callback`,
        pending.psuType,
        state
      );
      await storePendingAuth(this.env.BANKING_KV, state, pending);
      return Response.redirect(auth.url, 302);
    } catch (error) {
      console.error("Failed to start bank authorization:", error);
      const { message, details } = parseApiError(error);
      return htmlResponse(renderCallbackErrorPage(message, details), 500);
    }
  }

  private scheduleHistoryBackfill(accountIds: string[]): void {
    if (accountIds.length === 0) return;
    const run = async () => {
      const client = await EnableBankingClient.create(this.env);
      await backfillSessionHistory(this.env.BANKING_KV, client, accountIds);
    };
    const task = run().catch((error) => console.error("History backfill failed:", error));
    try {
      this.ctx.waitUntil(task);
    } catch {
      // No execution context (tests); the promise still runs.
    }
  }

  private async bankCallback(url: URL): Promise<Response> {
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
      };

      await storeSession(this.env.BANKING_KV, session, pendingAuth.connectionId);
      // Many banks only serve >90 days of history shortly after the MitID approval:
      // capture full history now, in the background, and serve older dates from KV.
      this.scheduleHistoryBackfill(session.accounts.map((a) => a.accountId));

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

      return htmlResponse(
        renderCallbackSuccessPage(
          { ...session, connectionId: pendingAuth.connectionId, label: pendingAuth.label, psuType: pendingAuth.psuType },
          pendingAuth.isRenewal,
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

  private async saveCredentials(request: Request, baseUrl: string): Promise<Response> {
    const formData = await request.formData();
    const action = formData.get("action")?.toString();
    const appId = formData.get("appId")?.toString();
    const privateKey = formData.get("privateKey")?.toString();

    if (action === "delete") {
      if (hasEnvCredentials(this.env)) {
        return redirectToSetup(baseUrl, { error: "Cannot delete credentials set via environment variables" });
      }
      await deleteStoredCredentials(this.env.BANKING_KV);
      return redirectToSetup(baseUrl, { notice: "Credentials removed successfully" });
    }

    if (action === "save") {
      if (!appId || !privateKey) {
        return redirectToSetup(baseUrl, { error: "App ID and private key are required" });
      }
      const pemValidation = await validatePEM(privateKey);
      if (!pemValidation.valid) {
        return redirectToSetup(baseUrl, { error: `Invalid private key: ${pemValidation.error}` });
      }
      try {
        await storeCredentials(this.env, appId, privateKey);
        return redirectToSetup(baseUrl, { notice: "Credentials saved successfully!" });
      } catch (error) {
        return redirectToSetup(baseUrl, {
          error: `Failed to save credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  }

  private async validateCredentials(request: Request): Promise<Response> {
    try {
      const { privateKey, appId } = (await request.json()) as { privateKey?: string; appId?: string };

      if (!privateKey) {
        return jsonResponse({ valid: false, error: "Private key is required" });
      }

      const pemValidation = await validatePEM(privateKey);
      if (!pemValidation.valid) {
        return jsonResponse({ valid: false, error: pemValidation.error });
      }

      if (!appId) return jsonResponse({ valid: true });

      try {
        const normalizedPem = await normalizePEM(privateKey);
        const token = await signJWT(createJWTPayload(), normalizedPem, appId);
        const apiBase = this.env.ENABLE_BANKING_API_BASE || "https://api.enablebanking.com";
        const response = await fetch(`${apiBase}/application`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) return jsonResponse({ valid: true, apiTest: true });
        return jsonResponse({
          valid: true,
          apiTest: false,
          apiError: `API returned ${response.status}: ${await response.text()}`,
        });
      } catch (apiError) {
        return jsonResponse({
          valid: true,
          apiTest: false,
          apiError: apiError instanceof Error ? apiError.message : "API test failed",
        });
      }
    } catch (error) {
      return jsonResponse({
        valid: false,
        error: error instanceof Error ? error.message : "Validation failed",
      });
    }
  }
}

function mcpDiscovery(baseUrl: string) {
  return {
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
  };
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
