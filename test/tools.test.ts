import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BankSession, Transaction, Env } from "../src/types";
import { 
  isConsentExpired, 
  EnableBankingClient,
  storeConnectRequest,
  getConnectRequest,
  deleteConnectRequest,
  type ConnectRequest,
} from "../src/enable-banking/client";

const mockSession: BankSession = {
  sessionId: "session-123",
  aspspId: "test-bank",
  aspspName: "Test Bank",
  aspspCountry: "SE",
  consentValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  accounts: [
    {
      accountId: "acc-1",
      iban: "SE1234567890123456",
      name: "Main Account",
      currency: "SEK",
      accountType: "Current",
    },
    {
      accountId: "acc-2",
      iban: "SE9876543210987654",
      name: "Savings",
      currency: "SEK",
      accountType: "Savings",
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockExpiredSession: BankSession = {
  ...mockSession,
  consentValidUntil: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0],
};

const mockTransactions: Transaction[] = [
  {
    transaction_id: "tx-1",
    booking_date: "2024-01-15",
    transaction_amount: { amount: "-50.00", currency: "SEK" },
    creditor_name: "Grocery Store",
    remittance_information: ["Weekly groceries"],
    merchant_category_code: "5411",
  },
  {
    transaction_id: "tx-2",
    booking_date: "2024-01-14",
    transaction_amount: { amount: "2500.00", currency: "SEK" },
    debtor_name: "Employer Inc",
    remittance_information: ["Salary January"],
  },
  {
    transaction_id: "tx-3",
    booking_date: "2024-01-13",
    transaction_amount: { amount: "-120.00", currency: "SEK" },
    creditor_name: "Restaurant ABC",
    remittance_information: ["Dinner"],
    merchant_category_code: "5812",
  },
];

describe("Session Management", () => {
  it("should detect expired consent", () => {
    expect(isConsentExpired(mockSession)).toBe(false);
    expect(isConsentExpired(mockExpiredSession)).toBe(true);
  });

  it("should handle session with future expiry", () => {
    const futureSession: BankSession = {
      ...mockSession,
      consentValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    };

    expect(isConsentExpired(futureSession)).toBe(false);
  });
});

function categorizeTransactionHelper(tx: Transaction): string {
  const mcc = tx.merchant_category_code;
  const info = (tx.remittance_information || []).join(" ").toLowerCase();
  const creditor = (tx.creditor_name || "").toLowerCase();

  if (mcc) {
    const mccNum = parseInt(mcc);
    if (mccNum >= 5411 && mccNum <= 5499) return "Groceries";
    if (mccNum >= 5812 && mccNum <= 5814) return "Restaurants";
    if (mccNum >= 4011 && mccNum <= 4789) return "Transportation";
    if (mccNum >= 5200 && mccNum <= 5261) return "Home";
    if (mccNum >= 5300 && mccNum <= 5399) return "Shopping";
    if (mccNum >= 6011 && mccNum <= 6399) return "Financial";
    if (mccNum >= 7800 && mccNum <= 7999) return "Entertainment";
    if (mccNum >= 8011 && mccNum <= 8099) return "Healthcare";
  }

  const keywords: Record<string, string[]> = {
    Groceries: ["grocery", "supermarket", "food", "market"],
    Restaurants: ["restaurant", "cafe", "coffee", "pizza", "burger"],
    Transportation: ["uber", "lyft", "taxi", "transit", "fuel", "gas", "parking"],
    Utilities: ["electric", "water", "gas", "internet", "phone"],
    Entertainment: ["netflix", "spotify", "cinema", "movie", "game"],
    Shopping: ["amazon", "ebay", "shop", "store"],
    Healthcare: ["pharmacy", "doctor", "hospital", "medical"],
    Subscription: ["subscription", "membership"],
  };

  for (const [category, words] of Object.entries(keywords)) {
    if (words.some((w) => info.includes(w) || creditor.includes(w))) {
      return category;
    }
  }

  return "Other";
}

describe("Transaction Categorization", () => {
  it("should categorize groceries by MCC", () => {
    const tx: Transaction = {
      transaction_amount: { amount: "-50", currency: "SEK" },
      merchant_category_code: "5411",
    };

    const category = categorizeTransactionHelper(tx);
    expect(category).toBe("Groceries");
  });

  it("should categorize restaurants by MCC", () => {
    const tx: Transaction = {
      transaction_amount: { amount: "-30", currency: "SEK" },
      merchant_category_code: "5812",
    };

    const category = categorizeTransactionHelper(tx);
    expect(category).toBe("Restaurants");
  });

  it("should categorize by keywords when no MCC", () => {
    const tx: Transaction = {
      transaction_amount: { amount: "-15", currency: "SEK" },
      creditor_name: "Netflix",
      remittance_information: ["Monthly subscription"],
    };

    const category = categorizeTransactionHelper(tx);
    expect(category).toBe("Entertainment");
  });

  it("should categorize uber as transportation", () => {
    const tx: Transaction = {
      transaction_amount: { amount: "-25", currency: "SEK" },
      creditor_name: "Uber",
    };

    const category = categorizeTransactionHelper(tx);
    expect(category).toBe("Transportation");
  });

  it("should return Other for unknown transactions", () => {
    const tx: Transaction = {
      transaction_amount: { amount: "-100", currency: "SEK" },
      creditor_name: "Random Company XYZ",
    };

    const category = categorizeTransactionHelper(tx);
    expect(category).toBe("Other");
  });
});

describe("Amount Formatting", () => {
  function formatAmount(amount: string, currency: string): string {
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(num);
  }

  it("should format SEK amounts", () => {
    expect(formatAmount("100.50", "SEK")).toContain("100");
    expect(formatAmount("100.50", "SEK")).toContain("SEK");
  });

  it("should format EUR amounts", () => {
    expect(formatAmount("50.00", "EUR")).toContain("50");
    expect(formatAmount("50.00", "EUR")).toContain("€");
  });

  it("should handle negative amounts", () => {
    const formatted = formatAmount("-25.00", "USD");
    expect(formatted).toContain("25");
  });

  it("should handle large amounts", () => {
    const formatted = formatAmount("1234567.89", "USD");
    expect(formatted).toContain("1,234,567");
  });
});

describe("Spending Summary", () => {
  it("should separate spending and income", () => {
    const spending: Record<string, number> = {};
    const income: Record<string, number> = {};
    let totalSpending = 0;
    let totalIncome = 0;

    for (const tx of mockTransactions) {
      const amount = parseFloat(tx.transaction_amount.amount);
      const category = categorizeTransactionHelper(tx);

      if (amount < 0) {
        const absAmount = Math.abs(amount);
        spending[category] = (spending[category] || 0) + absAmount;
        totalSpending += absAmount;
      } else {
        income[category] = (income[category] || 0) + amount;
        totalIncome += amount;
      }
    }

    expect(totalSpending).toBe(170);
    expect(totalIncome).toBe(2500);
    expect(spending["Groceries"]).toBe(50);
    expect(spending["Restaurants"]).toBe(120);
    expect(income["Other"]).toBe(2500);
  });

  it("should calculate net flow correctly", () => {
    let totalSpending = 0;
    let totalIncome = 0;

    for (const tx of mockTransactions) {
      const amount = parseFloat(tx.transaction_amount.amount);
      if (amount < 0) {
        totalSpending += Math.abs(amount);
      } else {
        totalIncome += amount;
      }
    }

    const netFlow = totalIncome - totalSpending;
    expect(netFlow).toBe(2330);
  });
});

describe("Account Lookup", () => {
  it("should find account by ID", () => {
    const account = mockSession.accounts.find((a) => a.accountId === "acc-1");
    expect(account).toBeDefined();
    expect(account?.name).toBe("Main Account");
  });

  it("should return undefined for unknown account", () => {
    const account = mockSession.accounts.find((a) => a.accountId === "unknown");
    expect(account).toBeUndefined();
  });
});

describe("Date Range Defaults", () => {
  it("should default to last 30 days for transactions", () => {
    const now = new Date();
    const toDate = now.toISOString().split("T")[0];
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    expect(toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should default to last 90 days for search", () => {
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    expect(fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should handle month range for summary", () => {
    const targetMonth = "2024-01";
    const [year, mon] = targetMonth.split("-").map(Number);
    const fromDate = `${year}-${String(mon).padStart(2, "0")}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const toDate = `${year}-${String(mon).padStart(2, "0")}-${lastDay}`;

    expect(fromDate).toBe("2024-01-01");
    expect(toDate).toBe("2024-01-31");
  });

  it("should handle last3 months for summary", () => {
    const now = new Date();
    const toDate = now.toISOString().split("T")[0];
    now.setMonth(now.getMonth() - 3);
    const fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    expect(fromDate).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

describe("Transaction Search", () => {
  it("should find transactions by counterparty name", () => {
    const query = "grocery";
    const matches = mockTransactions.filter((tx) => {
      const counterparty = tx.creditor_name || tx.debtor_name || "";
      return counterparty.toLowerCase().includes(query.toLowerCase());
    });

    expect(matches.length).toBe(1);
    expect(matches[0].creditor_name).toBe("Grocery Store");
  });

  it("should find transactions by description", () => {
    const query = "salary";
    const matches = mockTransactions.filter((tx) => {
      const description = (tx.remittance_information || []).join(" ");
      return description.toLowerCase().includes(query.toLowerCase());
    });

    expect(matches.length).toBe(1);
    expect(matches[0].debtor_name).toBe("Employer Inc");
  });

  it("should be case insensitive", () => {
    const query = "GROCERY";
    const matches = mockTransactions.filter((tx) => {
      const counterparty = tx.creditor_name || tx.debtor_name || "";
      const description = (tx.remittance_information || []).join(" ");
      return (
        counterparty.toLowerCase().includes(query.toLowerCase()) ||
        description.toLowerCase().includes(query.toLowerCase())
      );
    });

    expect(matches.length).toBe(1);
  });

  it("should return empty for no matches", () => {
    const query = "nonexistent";
    const matches = mockTransactions.filter((tx) => {
      const counterparty = tx.creditor_name || tx.debtor_name || "";
      const description = (tx.remittance_information || []).join(" ");
      return (
        counterparty.toLowerCase().includes(query.toLowerCase()) ||
        description.toLowerCase().includes(query.toLowerCase())
      );
    });

    expect(matches.length).toBe(0);
  });
});

describe("Auth Request Body Shape", () => {
  const mockCredentials = {
    appId: "test-app-id",
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7o5IDAUqyXWZE
7oKzL1er35DmLazWuMHDtSeRHgh1lMAdqUn6yclNHQKZHdHKO/HNBJugS+r7O0Ej
BCDM8eNnAqBcaGq23YzBpuqPPBt/3ZLvDr7FfYMthQFP5ywGhmCvtAV57K4i+M5x
ePDqp08MRBPtqIyQKzQ6UUxFQ+dN9M+WbQOCKYY5xIPKJgxMELx0fQ6dCjWPaXJI
3jY4k6mLhXD1V0d2DjnLF5PxYFnAy0FH2D8DJyh3fRhxH4JJpNZ8MHKx5w7Kpupl
yMSi9JxV8qxYKi2PHx2L8+y6UZiMFJnM6qNGzLsAjQ5qXvhODc5xKI2t1a6OzJ2K
zL5tJE7BAgMBAAECggEABzL7CXRSA/LLjJH+RbGi8YO/8lNwE8kMR0m9TbFmVy5/
wzOLQPNOLi6lJwv2ks9oBmyfCkSHAVnMZ9CdCLiI0eGPdYbJdJsb1xGCJZ9xNLnV
dEJcHiWZjkq7SAL5XYYGnVTxD7dRhYFU9nYVHGHhSJIGGJqFJ/DhZCZ0+QBKbCMT
lE+14WyWIbQEdbZPylI4hy7opVMSLBgMpXDHFBCANJIZcQsr5hOuBglL/aRz7K6f
g5SQFYh7z9x6+PMF5LCX9C0B1nv5jL7cXqA1xv3xlGn8C5zO8i1VqN5/F5EMdMyl
l8MBPZHqFErFwSE5xaqxH0d5+P2m4JrZqF0dLNZvIQKBgQD0GkTPVmYlfDLsWvPs
A0x7F0AhN3NSrNP5RkUH2ZOM8SL5MUAWPingqPLhTD2rCNJ0CZH5aJhhhVzz7eZD
xYFz5UL6uN5iF4KKg0VYG7HVPBLJhD5JyP5LNqJe9m7/J7kGTyKX4DW+cVkNVYik
8zV2i0P5pAR+b7hD9Y6tUPb4CQKBgQDE+i9J+NjrqGIh5tlBIiLG3ndENKPh4BLh
5iM/1Fp5y/2x5hJM0w7uHC8h7XsMU7l5HCNN5BWE0hSJHFgq+fz+d6xYKJJgCh+F
VDpfJ5nLD9xUqVXvd3k5m6Lvn7qL5wUz/J5XNkTCxYHYSghAfAYNKQuB3/QzZPVS
lpYihCLN6QKBgEp0tIWdlJa0rJME8b3y7D5g8Wdl4x4ngV7wIp6T7E1S5M0M8gNl
g5lFa7v/rhYK8dm2yOFM/McX0ja0nzPXtzJKIGI9MqPcP9GgUYqTR7M8IrYBb0yS
L6WDfeSfNTf5L8fJ7pM6zYMUfvN0H1lNkC5J5hpJXkPD4iqQmNwv0ub5AoGBAK0/
ZT9VQHI9Yz7+m5p8+j3dwP3I2j7R0jdepJmprKiJeXMgCZhDO/NZ6N2xzQ8NQCBR
d7SfYPYPv0gR2vXZLLQ5Fxv5cK9CDh+HMhE2gG9Lxp3P8qUxHxpL/ohXLvPWC5m5
QYQM+RfNnVBFqXqJlNe3sJYH9MJh5X9mHrMJ7bZhAoGBANiNiL9lM0p1PE7y9sNl
u0kHCyqoF7RJLM5QbMoEu1K/F7HNNLB2GfQU7kGJH7dJx9xZwZdPAqOz8M1kEnCH
MIeNKP2q7j6v3P3mHl2QF7hG3z5dQLs4R2xYIYXNXiX9q5kHYz5lJfNXM2F1gXFN
cBPC3yZ0OB/L3d4dQ6xKDBJn
-----END PRIVATE KEY-----`,
  };

  const mockEnv = {
    BANKING_KV: {} as KVNamespace,
    OAUTH_KV: {} as KVNamespace,
    AUTH_SECRET: "test-secret",
  } as Env;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should include aspsp with both name and country", () => {
    const client = new EnableBankingClient(mockEnv, mockCredentials);
    const body = client.buildAuthRequestBody(
      "Danske Bank",
      "DK",
      "https://example.com/callback",
      "personal",
      "test-state"
    );

    expect(body.aspsp).toBeDefined();
    expect(body.aspsp).toHaveProperty("name", "Danske Bank");
    expect(body.aspsp).toHaveProperty("country", "DK");
  });

  it("should include valid_until as full ISO 8601 datetime with timezone", () => {
    const client = new EnableBankingClient(mockEnv, mockCredentials);
    const body = client.buildAuthRequestBody(
      "Nordea Bank",
      "SE",
      "https://example.com/callback",
      "personal",
      "test-state"
    );

    expect(body.access).toBeDefined();
    const access = body.access as { valid_until: string };
    expect(access.valid_until).toBeDefined();
    
    expect(access.valid_until).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    
    const parsedDate = new Date(access.valid_until);
    expect(parsedDate.toISOString()).toBe(access.valid_until);
  });

  it("should set valid_until to ~90 days from now by default", () => {
    const client = new EnableBankingClient(mockEnv, mockCredentials);
    const body = client.buildAuthRequestBody(
      "Test Bank",
      "NO",
      "https://example.com/callback",
      "personal"
    );

    const access = body.access as { valid_until: string };
    const validUntil = new Date(access.valid_until);
    const now = new Date("2024-06-15T12:00:00.000Z");
    const daysDiff = Math.floor((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    expect(daysDiff).toBe(90);
  });

  it("should respect maximum_consent_validity if provided and less than 90 days", () => {
    const client = new EnableBankingClient(mockEnv, mockCredentials);
    const body = client.buildAuthRequestBody(
      "Test Bank",
      "FI",
      "https://example.com/callback",
      "personal",
      "test-state",
      30
    );

    const access = body.access as { valid_until: string };
    const validUntil = new Date(access.valid_until);
    const now = new Date("2024-06-15T12:00:00.000Z");
    const daysDiff = Math.floor((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    expect(daysDiff).toBe(30);
  });

  it("should cap maximum_consent_validity at 90 days", () => {
    const client = new EnableBankingClient(mockEnv, mockCredentials);
    const body = client.buildAuthRequestBody(
      "Test Bank",
      "DE",
      "https://example.com/callback",
      "personal",
      "test-state",
      180
    );

    const access = body.access as { valid_until: string };
    const validUntil = new Date(access.valid_until);
    const now = new Date("2024-06-15T12:00:00.000Z");
    const daysDiff = Math.floor((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    expect(daysDiff).toBe(90);
  });

  it("should include all required fields in auth request body", () => {
    const client = new EnableBankingClient(mockEnv, mockCredentials);
    const body = client.buildAuthRequestBody(
      "Nordea Bank",
      "SE",
      "https://example.com/callback",
      "personal",
      "my-state-123"
    );

    expect(body).toHaveProperty("aspsp");
    expect(body).toHaveProperty("redirect_url", "https://example.com/callback");
    expect(body).toHaveProperty("psu_type", "personal");
    expect(body).toHaveProperty("access");
    expect(body).toHaveProperty("state", "my-state-123");
    
    const aspsp = body.aspsp as { name: string; country: string };
    expect(aspsp.name).toBe("Nordea Bank");
    expect(aspsp.country).toBe("SE");
  });

  it("should support business psu_type", () => {
    const client = new EnableBankingClient(mockEnv, mockCredentials);
    const body = client.buildAuthRequestBody(
      "Business Bank",
      "GB",
      "https://example.com/callback",
      "business",
      "biz-state"
    );

    expect(body).toHaveProperty("psu_type", "business");
  });
});

describe("Connect Request Management", () => {
  const createMockKV = () => {
    const store = new Map<string, string>();
    return {
      put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
        store.set(key, value);
      }),
      get: vi.fn(async (key: string, type?: string) => {
        const value = store.get(key);
        if (!value) return null;
        if (type === "json") return JSON.parse(value);
        return value;
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    } as unknown as KVNamespace;
  };

  it("should store and retrieve a connect request", async () => {
    const kv = createMockKV();
    const token = "test-token-123";
    const request: ConnectRequest = {
      label: "Holm & Friis Holding",
      psuType: "business",
      country: "DK",
      bankName: "Danske Bank",
      createdAt: Date.now(),
    };

    await storeConnectRequest(kv, token, request);
    const retrieved = await getConnectRequest(kv, token);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.label).toBe("Holm & Friis Holding");
    expect(retrieved?.psuType).toBe("business");
    expect(retrieved?.country).toBe("DK");
    expect(retrieved?.bankName).toBe("Danske Bank");
  });

  it("should return null for non-existent token", async () => {
    const kv = createMockKV();
    const retrieved = await getConnectRequest(kv, "non-existent-token");
    expect(retrieved).toBeNull();
  });

  it("should delete a connect request", async () => {
    const kv = createMockKV();
    const token = "delete-test-token";
    const request: ConnectRequest = {
      label: "Test Account",
      psuType: "personal",
      country: "SE",
      createdAt: Date.now(),
    };

    await storeConnectRequest(kv, token, request);
    let retrieved = await getConnectRequest(kv, token);
    expect(retrieved).not.toBeNull();

    await deleteConnectRequest(kv, token);
    retrieved = await getConnectRequest(kv, token);
    expect(retrieved).toBeNull();
  });

  it("should store with expiration TTL", async () => {
    const kv = createMockKV();
    const token = "ttl-test-token";
    const request: ConnectRequest = {
      label: "TTL Test",
      psuType: "personal",
      country: "NO",
      createdAt: Date.now(),
    };

    await storeConnectRequest(kv, token, request);
    
    expect(kv.put).toHaveBeenCalledWith(
      `connect_request:${token}`,
      expect.any(String),
      { expirationTtl: 3600 }
    );
  });

  it("should handle optional bankName", async () => {
    const kv = createMockKV();
    const token = "no-bank-token";
    const request: ConnectRequest = {
      label: "No Bank Specified",
      psuType: "personal",
      country: "FI",
      createdAt: Date.now(),
    };

    await storeConnectRequest(kv, token, request);
    const retrieved = await getConnectRequest(kv, token);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.bankName).toBeUndefined();
  });
});
