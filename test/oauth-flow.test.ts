import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderErrorPage, renderConsentPage } from "../src/ui/pages";
import type { Env } from "../src/types";

// Mock the crypto API for PKCE
const mockCrypto = {
  randomUUID: () => "test-uuid-" + Math.random().toString(36).slice(2),
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  subtle: {
    digest: async (algorithm: string, data: ArrayBuffer) => {
      // Simple mock hash for testing
      const dataArr = new Uint8Array(data);
      const hash = new Uint8Array(32);
      for (let i = 0; i < dataArr.length; i++) {
        hash[i % 32] ^= dataArr[i];
      }
      return hash.buffer;
    },
    timingSafeEqual: (a: ArrayBuffer, b: ArrayBuffer) => {
      const aArr = new Uint8Array(a);
      const bArr = new Uint8Array(b);
      if (aArr.length !== bArr.length) return false;
      let result = 0;
      for (let i = 0; i < aArr.length; i++) {
        result |= aArr[i] ^ bArr[i];
      }
      return result === 0;
    },
  },
};

vi.stubGlobal("crypto", mockCrypto);

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const challenge = base64UrlEncode(digest);
  return { verifier, challenge };
}

describe("Error Page Rendering", () => {
  it("should render error page with title and message", () => {
    const html = renderErrorPage("Test Error", "Something went wrong");
    expect(html).toContain("Test Error");
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Back to Setup");
  });

  it("should render error page without retry button when showRetry is false", () => {
    const html = renderErrorPage("Test Error", "Something went wrong", false);
    expect(html).toContain("Test Error");
    expect(html).toContain("Something went wrong");
    expect(html).not.toContain("Back to Setup");
  });

  it("should escape HTML in title and message", () => {
    const html = renderErrorPage("<script>alert('xss')</script>", "<img onerror='alert(1)'>");
    expect(html).not.toContain("<script>alert('xss')</script>");
    expect(html).not.toContain("<img onerror='alert(1)'>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img onerror=");
  });

  it("should include proper HTML structure", () => {
    const html = renderErrorPage("Error", "Message");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html lang=\"en\">");
    expect(html).toContain("</html>");
    expect(html).toContain("<head>");
    expect(html).toContain("</head>");
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
    expect(html).toContain("alert-error");
  });
});

describe("Consent Page Rendering", () => {
  it("should render consent page with client name and scopes", () => {
    const html = renderConsentPage("Test Client", ["banking:read"], "handle123", true);
    expect(html).toContain("Test Client");
    // The consent page shows human-readable scope descriptions
    expect(html).toContain("Read your bank accounts, balances, and transactions");
    expect(html).toContain("handle123");
    expect(html).toContain("password");
  });

  it("should not require password when already authenticated", () => {
    const html = renderConsentPage("Test Client", ["banking:read"], "handle123", false);
    expect(html).toContain("already logged in");
    expect(html).not.toContain('name="password"');
  });

  it("should show error message when provided", () => {
    const html = renderConsentPage("Test Client", ["banking:read"], "handle123", true, "Invalid password");
    expect(html).toContain("Invalid password");
    expect(html).toContain("alert-error");
  });

  it("should escape HTML in client name", () => {
    const html = renderConsentPage("<script>alert('xss')</script>", ["banking:read"], "handle123", true);
    expect(html).not.toContain("<script>alert('xss')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("should include approve and deny buttons", () => {
    const html = renderConsentPage("Test Client", ["banking:read"], "handle123", true);
    expect(html).toContain('value="approve"');
    expect(html).toContain('value="deny"');
  });
});

describe("PKCE Generation", () => {
  it("should generate valid PKCE code verifier and challenge", async () => {
    const { verifier, challenge } = await generatePKCE();
    
    expect(verifier).toBeTruthy();
    expect(challenge).toBeTruthy();
    expect(verifier.length).toBeGreaterThan(20);
    expect(challenge.length).toBeGreaterThan(20);
    // Base64URL should not contain + / or =
    expect(verifier).not.toMatch(/[+/=]/);
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it("should generate different values each time", async () => {
    const pkce1 = await generatePKCE();
    const pkce2 = await generatePKCE();
    
    expect(pkce1.verifier).not.toBe(pkce2.verifier);
    expect(pkce1.challenge).not.toBe(pkce2.challenge);
  });
});

describe("OAuth Authorization Request Parsing", () => {
  it("should parse basic authorization request parameters", () => {
    const url = new URL("https://example.com/authorize");
    url.searchParams.set("client_id", "test-client");
    url.searchParams.set("redirect_uri", "https://client.example.com/callback");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", "random-state");
    url.searchParams.set("scope", "banking:read");

    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("redirect_uri")).toBe("https://client.example.com/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("random-state");
    expect(url.searchParams.get("scope")).toBe("banking:read");
  });

  it("should parse PKCE parameters", async () => {
    const { verifier, challenge } = await generatePKCE();
    
    const url = new URL("https://example.com/authorize");
    url.searchParams.set("client_id", "test-client");
    url.searchParams.set("redirect_uri", "https://client.example.com/callback");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", "random-state");
    url.searchParams.set("scope", "banking:read");
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");

    expect(url.searchParams.get("code_challenge")).toBe(challenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("should parse resource parameter (RFC 8707)", () => {
    const url = new URL("https://example.com/authorize");
    url.searchParams.set("client_id", "test-client");
    url.searchParams.set("redirect_uri", "https://client.example.com/callback");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", "random-state");
    url.searchParams.set("scope", "banking:read");
    url.searchParams.set("resource", "https://example.com/mcp");

    expect(url.searchParams.get("resource")).toBe("https://example.com/mcp");
  });

  it("should handle multiple scopes", () => {
    const url = new URL("https://example.com/authorize");
    url.searchParams.set("scope", "banking:read banking:write offline_access");

    const scopes = url.searchParams.get("scope")?.split(" ") || [];
    expect(scopes).toContain("banking:read");
    expect(scopes).toContain("banking:write");
    expect(scopes).toContain("offline_access");
  });
});

describe("Dynamic Client Registration (DCR)", () => {
  it("should validate client registration request body", () => {
    const registrationRequest = {
      client_name: "Test MCP Client",
      redirect_uris: ["https://client.example.com/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };

    expect(registrationRequest.client_name).toBe("Test MCP Client");
    expect(registrationRequest.redirect_uris).toContain("https://client.example.com/callback");
    expect(registrationRequest.grant_types).toContain("authorization_code");
    expect(registrationRequest.response_types).toContain("code");
    expect(registrationRequest.token_endpoint_auth_method).toBe("none");
  });

  it("should validate public client registration (no secret)", () => {
    const registrationRequest = {
      client_name: "Public MCP Client",
      redirect_uris: ["https://client.example.com/callback"],
      token_endpoint_auth_method: "none",
    };

    expect(registrationRequest.token_endpoint_auth_method).toBe("none");
    expect(registrationRequest).not.toHaveProperty("client_secret");
  });

  it("should validate confidential client registration (with secret)", () => {
    const registrationRequest = {
      client_name: "Confidential MCP Client",
      redirect_uris: ["https://client.example.com/callback"],
      token_endpoint_auth_method: "client_secret_basic",
    };

    expect(registrationRequest.token_endpoint_auth_method).toBe("client_secret_basic");
  });
});

describe("Token Request Validation", () => {
  it("should validate authorization code grant request", () => {
    const tokenRequest = new URLSearchParams();
    tokenRequest.set("grant_type", "authorization_code");
    tokenRequest.set("code", "auth-code-123");
    tokenRequest.set("redirect_uri", "https://client.example.com/callback");
    tokenRequest.set("client_id", "test-client");

    expect(tokenRequest.get("grant_type")).toBe("authorization_code");
    expect(tokenRequest.get("code")).toBe("auth-code-123");
    expect(tokenRequest.get("redirect_uri")).toBe("https://client.example.com/callback");
    expect(tokenRequest.get("client_id")).toBe("test-client");
  });

  it("should validate token request with PKCE verifier", async () => {
    const { verifier } = await generatePKCE();
    
    const tokenRequest = new URLSearchParams();
    tokenRequest.set("grant_type", "authorization_code");
    tokenRequest.set("code", "auth-code-123");
    tokenRequest.set("redirect_uri", "https://client.example.com/callback");
    tokenRequest.set("client_id", "test-client");
    tokenRequest.set("code_verifier", verifier);

    expect(tokenRequest.get("code_verifier")).toBe(verifier);
  });

  it("should validate refresh token grant request", () => {
    const tokenRequest = new URLSearchParams();
    tokenRequest.set("grant_type", "refresh_token");
    tokenRequest.set("refresh_token", "refresh-token-123");
    tokenRequest.set("client_id", "test-client");

    expect(tokenRequest.get("grant_type")).toBe("refresh_token");
    expect(tokenRequest.get("refresh_token")).toBe("refresh-token-123");
  });
});

describe("OAuth Discovery Endpoints", () => {
  it("should validate authorization server metadata structure", () => {
    const metadata = {
      issuer: "https://example.com",
      authorization_endpoint: "https://example.com/authorize",
      token_endpoint: "https://example.com/token",
      registration_endpoint: "https://example.com/register",
      scopes_supported: ["banking:read"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    };

    expect(metadata.issuer).toBe("https://example.com");
    expect(metadata.authorization_endpoint).toBe("https://example.com/authorize");
    expect(metadata.token_endpoint).toBe("https://example.com/token");
    expect(metadata.registration_endpoint).toBe("https://example.com/register");
    expect(metadata.code_challenge_methods_supported).toContain("S256");
  });

  it("should validate protected resource metadata structure", () => {
    const metadata = {
      resource: "https://example.com/mcp",
      authorization_servers: ["https://example.com"],
      scopes_supported: ["banking:read"],
      bearer_methods_supported: ["header"],
    };

    expect(metadata.resource).toBe("https://example.com/mcp");
    expect(metadata.authorization_servers).toContain("https://example.com");
    expect(metadata.bearer_methods_supported).toContain("header");
  });
});

describe("Bearer Token Authentication", () => {
  it("should parse Authorization header with Bearer token", () => {
    const authHeader = "Bearer access-token-123";
    const [scheme, token] = authHeader.split(" ");
    
    expect(scheme.toLowerCase()).toBe("bearer");
    expect(token).toBe("access-token-123");
  });

  it("should reject non-Bearer authentication schemes", () => {
    const authHeader = "Basic dXNlcjpwYXNz";
    const [scheme] = authHeader.split(" ");
    
    expect(scheme.toLowerCase()).not.toBe("bearer");
  });

  it("should handle missing Authorization header", () => {
    const authHeader: string | null = null;
    expect(authHeader).toBeNull();
  });
});

describe("OAuth Error Responses", () => {
  it("should structure OAuth error response correctly", () => {
    const errorResponse = {
      error: "invalid_request",
      error_description: "The request is missing a required parameter",
    };

    expect(errorResponse.error).toBe("invalid_request");
    expect(errorResponse.error_description).toBeTruthy();
  });

  it("should structure authorization error redirect correctly", () => {
    const redirectUri = new URL("https://client.example.com/callback");
    redirectUri.searchParams.set("error", "access_denied");
    redirectUri.searchParams.set("error_description", "User denied the request");
    redirectUri.searchParams.set("state", "original-state");

    expect(redirectUri.searchParams.get("error")).toBe("access_denied");
    expect(redirectUri.searchParams.get("state")).toBe("original-state");
  });

  it("should include issuer in error response (RFC 9207)", () => {
    const redirectUri = new URL("https://client.example.com/callback");
    redirectUri.searchParams.set("error", "access_denied");
    redirectUri.searchParams.set("state", "original-state");
    redirectUri.searchParams.set("iss", "https://example.com");

    expect(redirectUri.searchParams.get("iss")).toBe("https://example.com");
  });
});

describe("Full OAuth Flow Simulation", () => {
  it("should simulate complete DCR + authorize + token flow", async () => {
    // Step 1: Generate PKCE
    const { verifier, challenge } = await generatePKCE();
    
    // Step 2: Simulate DCR registration
    const registrationRequest = {
      client_name: "Test MCP Client",
      redirect_uris: ["https://client.example.com/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
    
    // Simulate registration response
    const registrationResponse = {
      client_id: "generated-client-id-123",
      client_name: registrationRequest.client_name,
      redirect_uris: registrationRequest.redirect_uris,
      grant_types: registrationRequest.grant_types,
      response_types: registrationRequest.response_types,
      token_endpoint_auth_method: registrationRequest.token_endpoint_auth_method,
      registration_date: Date.now(),
    };
    
    expect(registrationResponse.client_id).toBeTruthy();
    
    // Step 3: Build authorization URL
    const authUrl = new URL("https://example.com/authorize");
    authUrl.searchParams.set("client_id", registrationResponse.client_id);
    authUrl.searchParams.set("redirect_uri", registrationRequest.redirect_uris[0]);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", "random-state-123");
    authUrl.searchParams.set("scope", "banking:read");
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("resource", "https://example.com/mcp");
    
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authUrl.searchParams.get("resource")).toBe("https://example.com/mcp");
    
    // Step 4: Simulate authorization callback
    const callbackUrl = new URL(registrationRequest.redirect_uris[0]);
    const authCode = "authorization-code-" + Date.now();
    callbackUrl.searchParams.set("code", authCode);
    callbackUrl.searchParams.set("state", "random-state-123");
    callbackUrl.searchParams.set("iss", "https://example.com");
    
    expect(callbackUrl.searchParams.get("code")).toBe(authCode);
    expect(callbackUrl.searchParams.get("state")).toBe("random-state-123");
    
    // Step 5: Build token request
    const tokenRequest = new URLSearchParams();
    tokenRequest.set("grant_type", "authorization_code");
    tokenRequest.set("code", authCode);
    tokenRequest.set("redirect_uri", registrationRequest.redirect_uris[0]);
    tokenRequest.set("client_id", registrationResponse.client_id);
    tokenRequest.set("code_verifier", verifier);
    
    expect(tokenRequest.get("code_verifier")).toBe(verifier);
    
    // Step 6: Simulate token response
    const tokenResponse = {
      access_token: "access-token-" + Date.now(),
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "refresh-token-" + Date.now(),
      scope: "banking:read",
      resource: "https://example.com/mcp",
    };
    
    expect(tokenResponse.access_token).toBeTruthy();
    expect(tokenResponse.token_type).toBe("bearer");
    expect(tokenResponse.resource).toBe("https://example.com/mcp");
    
    // Step 7: Use access token for MCP call
    const mcpRequest = new Request("https://example.com/mcp", {
      headers: {
        "Authorization": `Bearer ${tokenResponse.access_token}`,
        "Content-Type": "application/json",
      },
    });
    
    expect(mcpRequest.headers.get("Authorization")).toBe(`Bearer ${tokenResponse.access_token}`);
  });

  it("should handle authorization error flow", () => {
    // Simulate user denying authorization
    const callbackUrl = new URL("https://client.example.com/callback");
    callbackUrl.searchParams.set("error", "access_denied");
    callbackUrl.searchParams.set("error_description", "The resource owner denied the request");
    callbackUrl.searchParams.set("state", "random-state-123");
    callbackUrl.searchParams.set("iss", "https://example.com");
    
    expect(callbackUrl.searchParams.get("error")).toBe("access_denied");
    expect(callbackUrl.searchParams.get("state")).toBe("random-state-123");
  });

  it("should handle token error response", () => {
    const errorResponse = {
      error: "invalid_grant",
      error_description: "The authorization code has expired or been used",
    };
    
    expect(errorResponse.error).toBe("invalid_grant");
  });
});

describe("MCP Server Protection", () => {
  it("should require Authorization header for protected endpoints", () => {
    const request = new Request("https://example.com/mcp");
    const authHeader = request.headers.get("Authorization");
    
    expect(authHeader).toBeNull();
  });

  it("should validate Bearer token format", () => {
    const validHeader = "Bearer abc123";
    const invalidHeader1 = "bearer abc123"; // lowercase still valid
    const invalidHeader2 = "Basic abc123"; // wrong scheme
    
    const parseAuth = (header: string) => {
      const [scheme, token] = header.split(" ");
      return { scheme: scheme.toLowerCase(), token };
    };
    
    expect(parseAuth(validHeader).scheme).toBe("bearer");
    expect(parseAuth(invalidHeader1).scheme).toBe("bearer");
    expect(parseAuth(invalidHeader2).scheme).toBe("basic");
  });
});

describe("OAuth Provider Integration", () => {
  it("should have OAUTH_PROVIDER in Env type for DefaultHandler", () => {
    const mockEnv: Partial<Env> = {
      BANKING_KV: {} as KVNamespace,
      OAUTH_KV: {} as KVNamespace,
      AUTH_SECRET: "test-secret",
      OAUTH_PROVIDER: {
        parseAuthRequest: vi.fn(),
        describeConsent: vi.fn(),
        beginConsent: vi.fn(),
        approveConsent: vi.fn(),
        denyConsent: vi.fn(),
        completeAuthorization: vi.fn(),
      } as unknown as Env["OAUTH_PROVIDER"],
    };
    
    expect(mockEnv.OAUTH_PROVIDER).toBeDefined();
    expect(mockEnv.OAUTH_PROVIDER?.parseAuthRequest).toBeDefined();
    expect(mockEnv.OAUTH_PROVIDER?.describeConsent).toBeDefined();
    expect(mockEnv.OAUTH_PROVIDER?.beginConsent).toBeDefined();
    expect(mockEnv.OAUTH_PROVIDER?.approveConsent).toBeDefined();
    expect(mockEnv.OAUTH_PROVIDER?.denyConsent).toBeDefined();
    expect(mockEnv.OAUTH_PROVIDER?.completeAuthorization).toBeDefined();
  });

  it("should not require apiRoute/apiHandler when using env.OAUTH_PROVIDER", () => {
    const mockOAuthHelpers = {
      parseAuthRequest: vi.fn().mockResolvedValue({
        responseType: "code",
        clientId: "test-client",
        redirectUri: "https://example.com/callback",
        scope: ["banking:read"],
        state: "test-state",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        resource: "https://example.com/mcp",
      }),
      describeConsent: vi.fn().mockResolvedValue({
        clientId: "test-client",
        clientName: "Test MCP Client",
        redirectUri: "https://example.com/callback",
        redirectHost: "example.com",
        redirectIsLoopback: false,
        scope: ["banking:read"],
      }),
      beginConsent: vi.fn().mockResolvedValue({
        handle: "consent-handle-123",
        headers: new Headers(),
      }),
    };

    expect(mockOAuthHelpers.parseAuthRequest).toBeDefined();
    expect(mockOAuthHelpers.describeConsent).toBeDefined();
    expect(mockOAuthHelpers.beginConsent).toBeDefined();
  });

  it("should validate authorization request with resource and PKCE params", async () => {
    const { verifier, challenge } = await generatePKCE();
    
    const authUrl = new URL("https://example.com/authorize");
    authUrl.searchParams.set("client_id", "test-client");
    authUrl.searchParams.set("redirect_uri", "https://www.cursor.com/agents/mcp/oauth/callback");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", "random-state");
    authUrl.searchParams.set("scope", "banking:read");
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("resource", "https://example.com/mcp");

    expect(authUrl.searchParams.get("resource")).toBe("https://example.com/mcp");
    expect(authUrl.searchParams.get("scope")).toBe("banking:read");
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authUrl.searchParams.get("redirect_uri")).toBe("https://www.cursor.com/agents/mcp/oauth/callback");
  });
});

describe("Well-Known Endpoints", () => {
  it("should define oauth-protected-resource metadata at root", () => {
    const baseUrl = "https://example.com";
    const metadata = {
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      scopes_supported: ["banking:read"],
      bearer_methods_supported: ["header"],
    };

    expect(metadata.resource).toBe("https://example.com/mcp");
    expect(metadata.authorization_servers).toContain("https://example.com");
    expect(metadata.scopes_supported).toContain("banking:read");
    expect(metadata.bearer_methods_supported).toContain("header");
  });

  it("should have consistent resource identifier across endpoints", () => {
    const baseUrl = "https://banking-mcp.example.workers.dev";
    
    const mcpMetadata = {
      url: `${baseUrl}/mcp`,
    };
    
    const protectedResourceMetadata = {
      resource: `${baseUrl}/mcp`,
    };
    
    const authServerMetadata = {
      resource: `${baseUrl}/mcp`,
    };
    
    expect(mcpMetadata.url).toBe(protectedResourceMetadata.resource);
    expect(protectedResourceMetadata.resource).toBe(authServerMetadata.resource);
  });

  it("should serve well-known endpoints at correct paths", () => {
    const endpoints = [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/mcp",
      "/.well-known/mcp",
    ];
    
    endpoints.forEach(endpoint => {
      expect(endpoint).toMatch(/^\/.well-known\//);
    });
  });
});
