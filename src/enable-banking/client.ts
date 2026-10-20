import { normalizeTransactionsResponse } from "./transactions";
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
  ConnectionStatusInfo,
} from "../types";

const EXPIRY_WARNING_DAYS = 14;

export interface SessionStatusResponse {
  status?: string;
  accounts?: Array<string | { uid?: string }>;
  accounts_data?: Array<{ uid?: string }>;
  access?: { valid_until?: string };
}

export interface AccountDetailsResponse {
  uid?: string;
  account_id?: { iban?: string };
  name?: string;
  details?: string;
  currency?: string;
  cash_account_type?: string;
}

/** Default consent length when the bank's maximum is unknown. */
export const DEFAULT_CONSENT_DAYS = 90;

/** maximum_consent_validity (seconds) to whole days; undefined if missing/invalid. */
export function maxConsentDaysFromSeconds(seconds?: number): number | undefined {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.floor(seconds / 86400);
}

/**
 * valid_until for POST /auth: the bank's maximum (minus a 10-minute margin so
 * clock skew can't exceed it), or DEFAULT_CONSENT_DAYS when unknown.
 */
export function consentValidUntil(maxConsentValidityDays?: number, now = Date.now()): string {
  if (maxConsentValidityDays && maxConsentValidityDays > 0) {
    return new Date(now + maxConsentValidityDays * 86400000 - 10 * 60000).toISOString();
  }
  return new Date(now + DEFAULT_CONSENT_DAYS * 86400000).toISOString();
}

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
    if (maxConsentValidityDays === undefined) {
      maxConsentValidityDays = await this.lookupMaxConsentDays(aspspName, aspspCountry);
    }
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

  /** GET /sessions/{id}: status and the account uids the consent currently covers. */
  async getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
    return await this.request<SessionStatusResponse>("GET", `/sessions/${sessionId}`);
  }

  async getAccountDetails(accountId: string): Promise<AccountDetailsResponse> {
    return await this.request<AccountDetailsResponse>("GET", `/accounts/${accountId}/details`);
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
    continuationKey?: string,
    strategy?: "default" | "longest"
  ): Promise<TransactionsResponse> {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (continuationKey) params.set("continuation_key", continuationKey);
    // "longest" starts from the earliest available transaction and ignores date_to.
    if (strategy && strategy !== "default") params.set("strategy", strategy);

    const queryString = params.toString();
    const path = `/accounts/${accountId}/transactions${
      queryString ? `?${queryString}` : ""
    }`;

    // Enable Banking returns a flat array with per-item status; normalize so
    // callers always get { booked, pending } arrays.
    const raw = await this.request<unknown>("GET", path);
    return normalizeTransactionsResponse(raw);
  }

  /**
   * The bank's maximum consent validity in days (GET /aspsps reports seconds).
   * Undefined when the bank or the field isn't found.
   */
  async lookupMaxConsentDays(aspspName: string, aspspCountry: string): Promise<number | undefined> {
    try {
      const banks = await this.getASPSPs(aspspCountry);
      const bank = banks.find((b) => b.name === aspspName) || banks.find((b) => b.name.toLowerCase() === aspspName.toLowerCase());
      return maxConsentDaysFromSeconds(bank?.maximum_consent_validity);
    } catch (error) {
      console.warn("Could not read maximum_consent_validity:", error);
      return undefined;
    }
  }

  private getConsentValidUntil(maxConsentValidityDays?: number): string {
    return consentValidUntil(maxConsentValidityDays);
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

/** Rename a connection (index entry and stored session). Returns false if not found. */
export async function renameConnection(
  kv: KVNamespace,
  connectionId: string,
  label: string
): Promise<boolean> {
  const session = await getStoredSession(kv, connectionId);
  if (!session) return false;
  await storeSession(kv, { ...session, label, updatedAt: new Date().toISOString() }, connectionId);
  const index = await getConnectionIndex(kv);
  const entry = index?.connections.find((c) => c.id === connectionId);
  if (index && entry) {
    entry.label = label;
    index.updatedAt = new Date().toISOString();
    await storeConnectionIndex(kv, index);
  }
  return true;
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

export function buildConnectionInfo(
  session: BankSession,
  baseUrl: string
): ConnectionStatusInfo {
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

export interface PendingAuthData {
  aspspId: string;
  aspspName: string;
  aspspCountry: string;
  connectionId: string;
  psuType: "personal" | "business";
  label: string;
  isRenewal?: boolean;
  /** Scoped token that started this connection; the new connection joins its scope. */
  scopeKey?: string;
  /** Relative URL to continue at after the bank callback (e.g. the OAuth consent page). */
  returnTo?: string;
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

export async function storeBaseUrl(kv: KVNamespace, baseUrl: string): Promise<void> {
  await kv.put("config:baseUrl", baseUrl);
}

/** Store the worker's public base URL if it is missing or changed. */
export async function ensureBaseUrl(kv: KVNamespace, baseUrl: string): Promise<void> {
  const current = await kv.get("config:baseUrl");
  if (current !== baseUrl) {
    await kv.put("config:baseUrl", baseUrl);
  }
}

export async function getBaseUrl(kv: KVNamespace): Promise<string | null> {
  return await kv.get("config:baseUrl");
}
export interface ConnectRequest {
  label: string;
  psuType: "personal" | "business";
  country: string;
  bankName?: string;
  createdAt: number;
  /** Let the user choose label / account type / country on the connect page. */
  editable?: boolean;
  scopeKey?: string;
  returnTo?: string;
}

export async function storeConnectRequest(
  kv: KVNamespace,
  token: string,
  request: ConnectRequest
): Promise<void> {
  await kv.put(
    `connect_request:${token}`,
    JSON.stringify(request),
    { expirationTtl: 3600 }
  );
}

export async function getConnectRequest(
  kv: KVNamespace,
  token: string
): Promise<ConnectRequest | null> {
  const data = await kv.get(`connect_request:${token}`, "json");
  return data as ConnectRequest | null;
}

export async function deleteConnectRequest(
  kv: KVNamespace,
  token: string
): Promise<void> {
  await kv.delete(`connect_request:${token}`);
}
