import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BankSession, ConnectionInfo, ConnectionStatus } from "../src/types";
import {
  isConsentExpired,
  getDaysUntilExpiry,
  getConnectionStatus,
  isConsentExpiring,
  getConnectionId,
  getConnectionLabel,
  buildConnectionInfo,
  buildExpiryWarning,
  isExpiredSessionError,
} from "../src/enable-banking/client";

const createMockSession = (
  daysUntilExpiry: number,
  overrides: Partial<BankSession> = {}
): BankSession => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);
  
  return {
    sessionId: "session-123",
    aspspId: "test-bank",
    aspspName: "Test Bank",
    aspspCountry: "SE",
    consentValidUntil: expiryDate.toISOString().split("T")[0],
    accounts: [
      {
        accountId: "acc-1",
        iban: "SE1234567890123456",
        name: "Main Account",
        currency: "SEK",
        accountType: "Current",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
};

describe("Consent Expiry Detection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should detect expired consent", () => {
    const expiredSession = createMockSession(-1);
    expect(isConsentExpired(expiredSession)).toBe(true);
  });

  it("should detect valid consent", () => {
    const validSession = createMockSession(30);
    expect(isConsentExpired(validSession)).toBe(false);
  });

  it("should detect consent expiring today as expired", () => {
    const expiringTodaySession = createMockSession(0);
    expect(isConsentExpired(expiringTodaySession)).toBe(true);
  });
});

describe("Days Until Expiry Calculation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should calculate days until expiry correctly", () => {
    const session = createMockSession(30);
    expect(getDaysUntilExpiry(session)).toBe(30);
  });

  it("should return negative days for expired sessions", () => {
    const session = createMockSession(-5);
    expect(getDaysUntilExpiry(session)).toBeLessThan(0);
  });

  it("should return 0 for sessions expiring today", () => {
    const session = createMockSession(0);
    expect(getDaysUntilExpiry(session)).toBeLessThanOrEqual(1);
  });

  it("should handle sessions expiring in 14 days (warning threshold)", () => {
    const session = createMockSession(14);
    expect(getDaysUntilExpiry(session)).toBe(14);
  });
});

describe("Connection Status", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 'ok' for sessions with more than 14 days left", () => {
    const session = createMockSession(30);
    expect(getConnectionStatus(session)).toBe("ok");
  });

  it("should return 'expiring' for sessions with 14 days or less left", () => {
    const session14days = createMockSession(14);
    expect(getConnectionStatus(session14days)).toBe("expiring");

    const session7days = createMockSession(7);
    expect(getConnectionStatus(session7days)).toBe("expiring");

    const session1day = createMockSession(1);
    expect(getConnectionStatus(session1day)).toBe("expiring");
  });

  it("should return 'expired' for sessions with 0 or negative days", () => {
    const session0days = createMockSession(0);
    expect(getConnectionStatus(session0days)).toBe("expired");

    const sessionExpired = createMockSession(-1);
    expect(getConnectionStatus(sessionExpired)).toBe("expired");
  });

  it("should identify expiring sessions", () => {
    const expiringSession = createMockSession(10);
    expect(isConsentExpiring(expiringSession)).toBe(true);

    const validSession = createMockSession(30);
    expect(isConsentExpiring(validSession)).toBe(false);
  });
});

describe("Connection Identification", () => {
  it("should return connectionId if present", () => {
    const session = createMockSession(30, { connectionId: "my-connection" });
    expect(getConnectionId(session)).toBe("my-connection");
  });

  it("should return label as connectionId if no connectionId but label exists", () => {
    const session = createMockSession(30, { label: "Privat" });
    expect(getConnectionId(session)).toBe("Privat");
  });

  it("should return 'default' for Default label", () => {
    const session = createMockSession(30, { label: "Default" });
    expect(getConnectionId(session)).toBe("default");
  });

  it("should return 'default' if no connectionId or label", () => {
    const session = createMockSession(30);
    expect(getConnectionId(session)).toBe("default");
  });

  it("should return label if present", () => {
    const session = createMockSession(30, { label: "Privat" });
    expect(getConnectionLabel(session)).toBe("Privat");
  });

  it("should return 'Default' if no label", () => {
    const session = createMockSession(30);
    expect(getConnectionLabel(session)).toBe("Default");
  });
});

describe("Connection Info Builder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should build complete connection info", () => {
    const session = createMockSession(30, {
      label: "Privat",
      psuType: "personal",
      connectionId: "privat-conn",
    });
    
    const info = buildConnectionInfo(session, "https://example.com");
    
    expect(info.connectionId).toBe("privat-conn");
    expect(info.label).toBe("Privat");
    expect(info.bank).toBe("Test Bank");
    expect(info.country).toBe("SE");
    expect(info.psuType).toBe("personal");
    expect(info.daysLeft).toBe(30);
    expect(info.status).toBe("ok");
    expect(info.renewUrl).toBe("https://example.com/renew/privat-conn");
    expect(info.accountCount).toBe(1);
  });

  it("should default psuType to 'personal' if not set", () => {
    const session = createMockSession(30);
    const info = buildConnectionInfo(session, "https://example.com");
    expect(info.psuType).toBe("personal");
  });

  it("should URL-encode connectionId in renewUrl", () => {
    const session = createMockSession(30, { connectionId: "my connection" });
    const info = buildConnectionInfo(session, "https://example.com");
    expect(info.renewUrl).toBe("https://example.com/renew/my%20connection");
  });
});

describe("Expiry Warning Builder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return null when no connections are expiring", () => {
    const sessions = [createMockSession(30), createMockSession(60)];
    const warning = buildExpiryWarning(sessions, "https://example.com");
    expect(warning).toBeNull();
  });

  it("should return warning for expiring connection", () => {
    const session = createMockSession(10, { label: "Privat" });
    const warning = buildExpiryWarning([session], "https://example.com");
    
    expect(warning).not.toBeNull();
    expect(warning).toContain("Privat");
    expect(warning).toContain("10 days");
    expect(warning).toContain("https://example.com/renew/Privat");
  });

  it("should return warning for expired connection", () => {
    const session = createMockSession(-1, { label: "Business", connectionId: "biz" });
    const warning = buildExpiryWarning([session], "https://example.com");
    
    expect(warning).not.toBeNull();
    expect(warning).toContain("Business");
    expect(warning).toContain("has expired");
    expect(warning).toContain("https://example.com/renew/biz");
  });

  it("should combine multiple warnings", () => {
    const sessions = [
      createMockSession(5, { label: "Privat" }),
      createMockSession(-1, { label: "Business" }),
    ];
    const warning = buildExpiryWarning(sessions, "https://example.com");
    
    expect(warning).not.toBeNull();
    expect(warning).toContain("Privat");
    expect(warning).toContain("Business");
  });

  it("should use singular 'day' for 1 day left", () => {
    const session = createMockSession(1, { label: "Test" });
    const warning = buildExpiryWarning([session], "https://example.com");
    
    expect(warning).toContain("1 day");
    expect(warning).not.toContain("1 days");
  });
});

describe("Expired Session Error Detection", () => {
  it("should detect session_expired error", () => {
    const error = new Error("Enable Banking API error: session_expired");
    expect(isExpiredSessionError(error)).toBe(true);
  });

  it("should detect consent_expired error", () => {
    const error = new Error("Enable Banking API error: consent_expired");
    expect(isExpiredSessionError(error)).toBe(true);
  });

  it("should detect invalid_session error", () => {
    const error = new Error("Enable Banking API error: invalid_session");
    expect(isExpiredSessionError(error)).toBe(true);
  });

  it("should detect session not found error", () => {
    const error = new Error("Session not found");
    expect(isExpiredSessionError(error)).toBe(true);
  });

  it("should detect 401 session error", () => {
    const error = new Error("Enable Banking API error: 401 - session invalid");
    expect(isExpiredSessionError(error)).toBe(true);
  });

  it("should detect 403 consent error", () => {
    const error = new Error("Enable Banking API error: 403 - consent revoked");
    expect(isExpiredSessionError(error)).toBe(true);
  });

  it("should not detect generic errors as expired", () => {
    const error = new Error("Network error");
    expect(isExpiredSessionError(error)).toBe(false);
  });

  it("should not detect non-Error types as expired", () => {
    expect(isExpiredSessionError("string error")).toBe(false);
    expect(isExpiredSessionError({ message: "object error" })).toBe(false);
    expect(isExpiredSessionError(null)).toBe(false);
    expect(isExpiredSessionError(undefined)).toBe(false);
  });
});

describe("PendingAuth with Renewal Fields", () => {
  it("should support psuType in pending auth", async () => {
    const mockKV = {
      put: vi.fn(),
      get: vi.fn(),
    };

    const { storePendingAuth, getPendingAuth } = await import(
      "../src/enable-banking/client"
    );

    await storePendingAuth(mockKV as unknown as KVNamespace, "state-123", {
      aspspId: "bank-id",
      aspspName: "Bank Name",
      aspspCountry: "SE",
      psuType: "business",
      label: "Business Account",
      connectionId: "biz-conn",
      isRenewal: true,
    });

    expect(mockKV.put).toHaveBeenCalledWith(
      "pending_auth:state-123",
      expect.stringContaining('"psuType":"business"'),
      { expirationTtl: 600 }
    );

    expect(mockKV.put).toHaveBeenCalledWith(
      "pending_auth:state-123",
      expect.stringContaining('"isRenewal":true'),
      { expirationTtl: 600 }
    );
  });
});
