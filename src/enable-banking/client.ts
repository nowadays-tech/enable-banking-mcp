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
} from "../types";

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
  connectionId: string = "default"
): Promise<import("../types").BankSession | null> {
  const data = await kv.get(`session:${connectionId}`, "json");
  return data as import("../types").BankSession | null;
}

export async function storeSession(
  kv: KVNamespace,
  session: import("../types").BankSession,
  connectionId: string = "default"
): Promise<void> {
  const expirationTtl = Math.floor(
    (new Date(session.consentValidUntil).getTime() - Date.now()) / 1000
  );
  await kv.put(`session:${connectionId}`, JSON.stringify(session), {
    expirationTtl: Math.max(expirationTtl, 60),
  });
}

export async function deleteStoredSession(
  kv: KVNamespace,
  connectionId: string = "default"
): Promise<void> {
  await kv.delete(`session:${connectionId}`);
}

const CONNECTION_INDEX_KEY = "connection_index";

export async function getConnectionIndex(
  kv: KVNamespace
): Promise<import("../types").ConnectionIndex | null> {
  const data = await kv.get(CONNECTION_INDEX_KEY, "json");
  return data as import("../types").ConnectionIndex | null;
}

export async function storeConnectionIndex(
  kv: KVNamespace,
  index: import("../types").ConnectionIndex
): Promise<void> {
  await kv.put(CONNECTION_INDEX_KEY, JSON.stringify(index));
}

export async function addConnectionToIndex(
  kv: KVNamespace,
  connection: import("../types").ConnectionInfo
): Promise<void> {
  const index = await getConnectionIndex(kv) || { connections: [], updatedAt: new Date().toISOString() };
  const existingIdx = index.connections.findIndex(c => c.id === connection.id);
  if (existingIdx >= 0) {
    index.connections[existingIdx] = connection;
  } else {
    index.connections.push(connection);
  }
  index.updatedAt = new Date().toISOString();
  await storeConnectionIndex(kv, index);
}

export async function removeConnectionFromIndex(
  kv: KVNamespace,
  connectionId: string
): Promise<void> {
  const index = await getConnectionIndex(kv);
  if (!index) return;
  index.connections = index.connections.filter(c => c.id !== connectionId);
  index.updatedAt = new Date().toISOString();
  await storeConnectionIndex(kv, index);
}

export async function getAllSessions(
  kv: KVNamespace
): Promise<Array<import("../types").BankSession & { connectionId: string }>> {
  const sessions: Array<import("../types").BankSession & { connectionId: string }> = [];
  
  const defaultSession = await getStoredSession(kv, "default");
  if (defaultSession) {
    sessions.push({ ...defaultSession, connectionId: "default" });
  }
  
  const index = await getConnectionIndex(kv);
  if (index) {
    for (const conn of index.connections) {
      if (conn.id === "default") continue;
      const session = await getStoredSession(kv, conn.id);
      if (session) {
        sessions.push({ ...session, connectionId: conn.id });
      }
    }
  }
  
  return sessions;
}

export async function findConnectionByAccountId(
  kv: KVNamespace,
  accountId: string
): Promise<{ session: import("../types").BankSession; connectionId: string } | null> {
  const sessions = await getAllSessions(kv);
  for (const session of sessions) {
    const account = session.accounts.find(a => a.accountId === accountId);
    if (account) {
      return { session, connectionId: session.connectionId };
    }
  }
  return null;
}

export function generateConnectionId(): string {
  return `conn_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function isConsentExpired(session: import("../types").BankSession): boolean {
  return new Date(session.consentValidUntil) <= new Date();
}

export interface PendingAuthData {
  aspspId: string;
  aspspName: string;
  aspspCountry: string;
  connectionId: string;
  psuType: "personal" | "business";
  label: string;
}

export async function storePendingAuth(
  kv: KVNamespace,
  state: string,
  data: PendingAuthData
): Promise<void> {
  await kv.put(
    `pending_auth:${state}`,
    JSON.stringify(data),
    { expirationTtl: 600 }
  );
}

export async function getPendingAuth(
  kv: KVNamespace,
  state: string
): Promise<PendingAuthData | null> {
  const data = await kv.get(`pending_auth:${state}`, "json");
  return data as PendingAuthData | null;
}

export async function deletePendingAuth(
  kv: KVNamespace,
  state: string
): Promise<void> {
  await kv.delete(`pending_auth:${state}`);
}
