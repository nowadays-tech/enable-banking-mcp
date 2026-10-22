import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  BANKING_KV: KVNamespace;
  OAUTH_KV: KVNamespace;
  ENABLE_BANKING_APP_ID?: string;
  ENABLE_BANKING_PRIVATE_KEY?: string;
  ENABLE_BANKING_API_BASE?: string;
  /** Password for the setup pages and the OAuth consent screen. */
  AUTH_SECRET: string;
  /** Encrypts the Enable Banking private key in KV. Falls back to AUTH_SECRET when unset. */
  ENCRYPTION_SECRET?: string;
  OAUTH_PROVIDER: OAuthHelpers;
  /** Resend API key (secret). With OWNER_EMAIL and MAGIC_LINK_FROM, enables magic-link login. */
  RESEND_API_KEY?: string;
  /** The only address magic links are sent to (single owner for now). */
  OWNER_EMAIL?: string;
  /** Sender for magic-link emails, e.g. "Bank MCP <bank@your-domain>", on a domain verified in Resend. */
  MAGIC_LINK_FROM?: string;
}

export interface StoredCredentials {
  appId: string;
  encryptedPrivateKey: string;
  iv: string;
  salt: string;
  /** Secret the key is encrypted with; absent on records from before ENCRYPTION_SECRET (AUTH_SECRET). */
  encryptedWith?: "AUTH_SECRET" | "ENCRYPTION_SECRET";
  createdAt: string;
  updatedAt: string;
}

export interface BankSession {
  sessionId: string;
  aspspId: string;
  aspspName: string;
  aspspCountry: string;
  consentValidUntil: string;
  accounts: BankAccount[];
  createdAt: string;
  updatedAt: string;
}

/** A stored session joined with its connection index entry, the one source of label and PSU type. */
export interface ConnectedSession extends BankSession {
  connectionId: string;
  label: string;
  psuType: "personal" | "business";
}

export interface ConnectionInfo {
  id: string;
  label: string;
  psuType: "personal" | "business";
  aspspName: string;
  aspspCountry: string;
  validUntil: string;
  createdAt: string;
}

export interface ConnectionIndex {
  connections: ConnectionInfo[];
  updatedAt: string;
}

export type ConnectionStatus = "ok" | "expiring" | "expired";

export interface ConnectionStatusInfo {
  connectionId: string;
  label: string;
  bank: string;
  country: string;
  psuType: "personal" | "business";
  validUntil: string;
  daysLeft: number;
  status: ConnectionStatus;
  renewUrl: string;
  accountCount: number;
}

export interface BankAccount {
  accountId: string;
  iban?: string;
  name?: string;
  currency?: string;
  accountType?: string;
}

export interface AuthorizationResponse {
  url: string;
}

export interface SessionResponse {
  session_id: string;
  access: {
    valid_until: string;
  };
  accounts: Array<{
    uid: string;
    account_id: {
      iban?: string;
    };
    name?: string;
    currency?: string;
    account_type?: string;
  }>;
  aspsp: {
    name: string;
    country: string;
  };
}

export interface ASPSP {
  name: string;
  country: string;
  logo?: string;
  bic?: string;
  aspsp_id?: string;
  sandbox?: boolean;
  maximum_consent_validity?: number;
  psu_types_supported?: ("personal" | "business")[];
}

export interface ASPSPsResponse {
  aspsps: ASPSP[];
}

export interface BalanceResponse {
  balances: Array<{
    balance_amount: {
      amount: string;
      currency: string;
    };
    balance_type: string;
    reference_date?: string;
  }>;
}

export interface Transaction {
  transaction_id?: string;
  entry_reference?: string;
  booking_date?: string;
  value_date?: string;
  transaction_date?: string;
  transaction_amount: {
    amount: string;
    currency: string;
  };
  creditor_name?: string;
  debtor_name?: string;
  remittance_information?: string[];
  bank_transaction_code?: string;
  proprietary_bank_transaction_code?: string;
  merchant_category_code?: string;
  /** Enable Banking: "CRDT" (in) or "DBIT" (out); amounts are then unsigned. */
  credit_debit_indicator?: string;
  /** Enable Banking flat list: "BOOK", "PDNG", ... */
  status?: string;
}

export interface TransactionsResponse {
  /** Always normalized by the client (see enable-banking/transactions.ts). */
  transactions: {
    booked: Transaction[];
    pending: Transaction[];
  };
  continuation_key?: string;
}

export interface UserSession {
  authenticated: boolean;
  authenticatedAt?: string;
}
