import { signJWT, createJWTPayload } from "./jwt";
import { getEffectiveCredentials } from "./credentials";
import type {
  Env,
  ASPSPsResponse,
  AuthorizationResponse,
  SessionResponse,
  BalanceResponse,
  TransactionsResponse,
  ASPSP,
  BankSession,
  ConnectionStatus,
  ConnectionInfo,
} from "../types";

const EXPIRY_WARNING_DAYS = 14;

export class EnableBankingClient {
  private env: Env;
  private baseUrl: string;
  private credentials: { appId: string; privateKey: string } | null = null;

  constructor(env: Env, credentials?: { appId: string; privateKey: string } | null) {
    this.env = env;
    this.baseUrl = env.ENABLE_BANKING_API_BASE || "https://api.enablebanking.com";
    if (credentials) {
      this.credentials = credentials;
    }
  }

  static async create(env: Env): Promise<EnableBankingClient> {
    const credentials = await getEffectiveCredentials(env);
    return new EnableBankingClient(env, credentials);
  }

  private async getCredentials(): Promise<{ appId: string; privateKey: string }> {
    if (this.credentials) {
      return this.credentials;
    }
    const creds = await getEffectiveCredentials(this.env);
    if (!creds) {
      throw new Error("Enable Banking credentials not configured. Please complete the setup wizard.");
    }
    this.credentials = creds;
    return creds;
  }

  private async getAuthToken(): Promise<string> {
    const creds = await this.getCredentials();
    const payload = createJWTPayload(creds.appId);
    return await signJWT(payload, creds.privateKey, creds.appId);
  }

  hasCredentials(): boolean {
    return this.credentials !== null;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await this.getAuthToken();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Enable Banking API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  async getASPSPs(country?: string): Promise<ASPSP[]> {
    let path = "/aspsps";
    if (country) {
      path += `?country=${encodeURIComponent(country)}`;
    }
    const response = await this.request<ASPSPsResponse>("GET", path);
    return response.aspsps;
  }

  async startAuthorization(
    aspspName: string,
    aspspCountry: string,
    redirectUrl: string,
    psuType: "personal" | "business" = "personal",
    state?: string,
    maxConsentValidityDays?: number
  ): Promise<AuthorizationResponse> {
    const body = {
      aspsp: { name: aspspName, country: aspspCountry },
      redirect_url: redirectUrl,
      psu_type: psuType,
      access: {
        valid_until: this.getConsentValidUntil(maxConsentValidityDays),
      },
      state,
    };

    return await this.request<AuthorizationResponse>("POST", "/auth", body);
  }

  async createSession(code: string): Promise<SessionResponse> {
    return await this.request<SessionResponse>("POST", "/sessions", { code });
  }

  async getSession(sessionId: string): Promise<SessionResponse> {
    return await this.request<SessionResponse>("GET", `/sessions/${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request<void>("DELETE", `/sessions/${sessionId}`);
  }

  async getBalances(accountId: string): Promise<BalanceResponse> {
    return await this.request<BalanceResponse>(
      "GET",
      `/accounts/${accountId}/balances`
    );
  }

  async getTransactions(
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
    continuationKey?: string
  ): Promise<TransactionsResponse> {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (continuationKey) params.set("continuation_key", continuationKey);

    const queryString = params.toString();
    const path = `/accounts/${accountId}/transactions${
      queryString ? `?${queryString}` : ""
    }`;

    return await this.request<TransactionsResponse>("GET", path);
  }

  private getConsentValidUntil(maxConsentValidityDays?: number): string {
    const defaultDays = 90;
    const days = maxConsentValidityDays && maxConsentValidityDays > 0 
      ? Math.min(maxConsentValidityDays, defaultDays) 
      : defaultDays;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  buildAuthRequestBody(
    aspspName: string,
    aspspCountry: string,
    redirectUrl: string,
    psuType: "personal" | "business",
    state?: string,
    maxConsentValidityDays?: number
  ): Record<string, unknown> {
    return {
      aspsp: { name: aspspName, country: aspspCountry },
      redirect_url: redirectUrl,
      psu_type: psuType,
      access: {
        valid_until: this.getConsentValidUntil(maxConsentValidityDays),
      },
      state,
    };
  }
}

export async function getStoredSession(
  kv: KVNamespace,
  userId: string = "default"
): Promise<import("../types").BankSession | null> {
  const data = await kv.get(`session:${userId}`, "json");
  return data as import("../types").BankSession | null;
}

export async function storeSession(
  kv: KVNamespace,
  session: import("../types").BankSession,
  userId: string = "default"
): Promise<void> {
  const expirationTtl = Math.floor(
    (new Date(session.consentValidUntil).getTime() - Date.now()) / 1000
  );
  await kv.put(`session:${userId}`, JSON.stringify(session), {
    expirationTtl: Math.max(expirationTtl, 60),
  });
}

export async function deleteStoredSession(
  kv: KVNamespace,
  userId: string = "default"
): Promise<void> {
  await kv.delete(`session:${userId}`);
}

export function isConsentExpired(session: BankSession): boolean {
  return new Date(session.consentValidUntil) <= new Date();
}

export function getDaysUntilExpiry(session: BankSession): number {
  const expiryDate = new Date(session.consentValidUntil);
  const now = new Date();
  return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getConnectionStatus(session: BankSession): ConnectionStatus {
  const daysLeft = getDaysUntilExpiry(session);
  if (daysLeft <= 0) return "expired";
  if (daysLeft <= EXPIRY_WARNING_DAYS) return "expiring";
  return "ok";
}

export function isConsentExpiring(session: BankSession): boolean {
  return getConnectionStatus(session) === "expiring";
}

export function getConnectionId(session: BankSession): string {
  if (session.connectionId) return session.connectionId;
  if (session.label && session.label !== "Default") return session.label;
  return "default";
}

export function getConnectionLabel(session: BankSession): string {
  return session.label || "Default";
}

export async function getAllSessions(kv: KVNamespace): Promise<BankSession[]> {
  const sessions: BankSession[] = [];
  let cursor: string | undefined;
  
  do {
    const result = await kv.list({ prefix: "session:", cursor });
    
    for (const key of result.keys) {
      const data = await kv.get(key.name, "json");
      if (data) {
        const session = data as BankSession;
        const connectionId = key.name.replace("session:", "");
        session.connectionId = connectionId;
        if (!session.label) {
          session.label = connectionId === "default" ? "Default" : connectionId;
        }
        sessions.push(session);
      }
    }
    
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  
  return sessions;
}

export function buildConnectionInfo(
  session: BankSession,
  baseUrl: string
): ConnectionInfo {
  const connectionId = getConnectionId(session);
  const daysLeft = getDaysUntilExpiry(session);
  const status = getConnectionStatus(session);
  
  return {
    connectionId,
    label: getConnectionLabel(session),
    bank: session.aspspName,
    country: session.aspspCountry,
    psuType: session.psuType || "personal",
    validUntil: session.consentValidUntil,
    daysLeft,
    status,
    renewUrl: `${baseUrl}/renew/${encodeURIComponent(connectionId)}`,
    accountCount: session.accounts.length,
  };
}

export function buildExpiryWarning(
  sessions: BankSession[],
  baseUrl: string
): string | null {
  const warnings: string[] = [];
  
  for (const session of sessions) {
    const status = getConnectionStatus(session);
    if (status === "expiring" || status === "expired") {
      const daysLeft = getDaysUntilExpiry(session);
      const label = getConnectionLabel(session);
      const connectionId = getConnectionId(session);
      const renewUrl = `${baseUrl}/renew/${encodeURIComponent(connectionId)}`;
      
      if (status === "expired") {
        warnings.push(
          `⚠️ Connection '${label}' has expired. Renew here: ${renewUrl}`
        );
      } else {
        warnings.push(
          `⚠️ Connection '${label}' expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Renew here: ${renewUrl}`
        );
      }
    }
  }
  
  return warnings.length > 0 ? warnings.join("\n") : null;
}

export function isExpiredSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("session_expired") ||
    msg.includes("consent_expired") ||
    msg.includes("invalid_session") ||
    msg.includes("session not found") ||
    msg.includes("consent not found") ||
    (msg.includes("enable banking api error") && 
     (msg.includes("401") || msg.includes("403")) &&
     (msg.includes("session") || msg.includes("consent")))
  );
}

export interface PendingAuth {
  aspspId: string;
  aspspName: string;
  aspspCountry: string;
  psuType?: "personal" | "business";
  label?: string;
  connectionId?: string;
  isRenewal?: boolean;
}

export async function storePendingAuth(
  kv: KVNamespace,
  state: string,
  aspspId: string,
  aspspName: string,
  aspspCountry: string,
  psuType?: "personal" | "business",
  label?: string,
  connectionId?: string,
  isRenewal?: boolean
): Promise<void> {
  const data: PendingAuth = {
    aspspId,
    aspspName,
    aspspCountry,
    psuType,
    label,
    connectionId,
    isRenewal,
  };
  await kv.put(`pending_auth:${state}`, JSON.stringify(data), {
    expirationTtl: 600,
  });
}

export async function getPendingAuth(
  kv: KVNamespace,
  state: string
): Promise<PendingAuth | null> {
  const data = await kv.get(`pending_auth:${state}`, "json");
  return data as PendingAuth | null;
}

export async function deletePendingAuth(
  kv: KVNamespace,
  state: string
): Promise<void> {
  await kv.delete(`pending_auth:${state}`);
}

export async function storeBaseUrl(kv: KVNamespace, baseUrl: string): Promise<void> {
  await kv.put("config:baseUrl", baseUrl);
}

export async function getBaseUrl(kv: KVNamespace): Promise<string | null> {
  return await kv.get("config:baseUrl");
}
