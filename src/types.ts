export interface Env {
  BANKING_KV: KVNamespace;
  OAUTH_KV: KVNamespace;
  ENABLE_BANKING_APP_ID?: string;
  ENABLE_BANKING_PRIVATE_KEY?: string;
  ENABLE_BANKING_API_BASE: string;
  AUTH_SECRET: string;
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
