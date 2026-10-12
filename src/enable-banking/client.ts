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
    aspspId: string,
    redirectUrl: string,
    psuType: "personal" | "business" = "personal",
    state?: string
  ): Promise<AuthorizationResponse> {
    const body = {
      aspsp: { name: aspspId },
      redirect_url: redirectUrl,
      psu_type: psuType,
      access: {
        valid_until: this.getConsentValidUntil(),
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

  private getConsentValidUntil(): string {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date.toISOString().split("T")[0];
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

export function isConsentExpired(session: import("../types").BankSession): boolean {
  return new Date(session.consentValidUntil) <= new Date();
}

export async function storePendingAuth(
  kv: KVNamespace,
  state: string,
  aspspId: string,
  aspspName: string,
  aspspCountry: string
): Promise<void> {
  await kv.put(
    `pending_auth:${state}`,
    JSON.stringify({ aspspId, aspspName, aspspCountry }),
    { expirationTtl: 600 }
  );
}

export async function getPendingAuth(
  kv: KVNamespace,
  state: string
): Promise<{ aspspId: string; aspspName: string; aspspCountry: string } | null> {
  const data = await kv.get(`pending_auth:${state}`, "json");
  return data as { aspspId: string; aspspName: string; aspspCountry: string } | null;
}

export async function deletePendingAuth(
  kv: KVNamespace,
  state: string
): Promise<void> {
  await kv.delete(`pending_auth:${state}`);
}
