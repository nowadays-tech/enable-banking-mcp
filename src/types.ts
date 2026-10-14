import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  BANKING_KV: KVNamespace;
  OAUTH_KV: KVNamespace;
  ENABLE_BANKING_APP_ID?: string;
  ENABLE_BANKING_PRIVATE_KEY?: string;
  ENABLE_BANKING_API_BASE?: string;
  AUTH_SECRET: string;
  OAUTH_PROVIDER: OAuthHelpers;
  /** Resend API key (secret). With OWNER_EMAIL, enables magic-link login. */
  RESEND_API_KEY?: string;
  /** The only address magic links are sent to (single owner for now). */
  OWNER_EMAIL?: string;
  /** Sender for magic-link emails. Defaults to bank@updates.lab.nowadays.tech. */
  MAGIC_LINK_FROM?: string;
}

export interface StoredCredentials {
  appId: string;
  encryptedPrivateKey: string;
  iv: string;
  salt: string;
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
  psuType?: "personal" | "business";
  label?: string;
  connectionId?: string;
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
}

export interface TransactionsResponse {
  transactions: {
    booked: Transaction[];
    pending?: Transaction[];
  };
  continuation_key?: string;
}

export interface UserSession {
  authenticated: boolean;
  authenticatedAt?: string;
}
