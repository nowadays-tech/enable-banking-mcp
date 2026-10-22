import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BankSession, ConnectionIndex, ConnectionInfo } from "../src/types";
import {
  getStoredSession,
  storeSession,
  deleteStoredSession,
  getConnectionIndex,
  storeConnectionIndex,
  addConnectionToIndex,
  removeConnectionFromIndex,
  getAllSessions,
  findConnectionByAccountId,
  generateConnectionId,
} from "../src/enable-banking/client";

const createMockKV = () => {
  const store: Record<string, string> = {};
  return {
    get: vi.fn(async (key: string, type?: string) => {
      const value = store[key];
      if (!value) return null;
      if (type === "json") return JSON.parse(value);
      return value;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    delete: vi.fn(async (key: string) => {
      delete store[key];
    }),
    _store: store,
  };
};

const createMockSession = (overrides: Partial<BankSession> = {}): BankSession => ({
  sessionId: "session-123",
  aspspId: "test-bank",
  aspspName: "Test Bank",
  aspspCountry: "SE",
  consentValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
});

describe("Multi-Connection Session Storage", () => {
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  describe("getStoredSession / storeSession", () => {
    it("should store and retrieve session with custom connectionId", async () => {
      const session = createMockSession({ sessionId: "session-custom" });
      await storeSession(mockKV as unknown as KVNamespace, session, "my-connection");
      
      const retrieved = await getStoredSession(mockKV as unknown as KVNamespace, "my-connection");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.sessionId).toBe("session-custom");
    });

    it("should isolate sessions by connectionId", async () => {
      const session1 = createMockSession({ sessionId: "session-1", aspspName: "Bank A" });
      const session2 = createMockSession({ sessionId: "session-2", aspspName: "Bank B" });
      
      await storeSession(mockKV as unknown as KVNamespace, session1, "conn-1");
      await storeSession(mockKV as unknown as KVNamespace, session2, "conn-2");
      
      const retrieved1 = await getStoredSession(mockKV as unknown as KVNamespace, "conn-1");
      const retrieved2 = await getStoredSession(mockKV as unknown as KVNamespace, "conn-2");
      
      expect(retrieved1?.aspspName).toBe("Bank A");
      expect(retrieved2?.aspspName).toBe("Bank B");
    });
  });

  describe("deleteStoredSession", () => {
    it("should delete session by connectionId", async () => {
      const session = createMockSession();
      await storeSession(mockKV as unknown as KVNamespace, session, "my-conn");
      
      let retrieved = await getStoredSession(mockKV as unknown as KVNamespace, "my-conn");
      expect(retrieved).not.toBeNull();
      
      await deleteStoredSession(mockKV as unknown as KVNamespace, "my-conn");
      
      retrieved = await getStoredSession(mockKV as unknown as KVNamespace, "my-conn");
      expect(retrieved).toBeNull();
    });
  });
});

describe("Connection Index", () => {
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  describe("getConnectionIndex / storeConnectionIndex", () => {
    it("should return null when no index exists", async () => {
      const index = await getConnectionIndex(mockKV as unknown as KVNamespace);
      expect(index).toBeNull();
    });

    it("should store and retrieve connection index", async () => {
      const index: ConnectionIndex = {
        connections: [
          {
            id: "conn-1",
            label: "Personal",
            psuType: "personal",
            aspspName: "Test Bank",
            aspspCountry: "SE",
            validUntil: "2024-12-31",
            createdAt: "2024-01-01",
          },
        ],
        updatedAt: "2024-01-01",
      };
      
      await storeConnectionIndex(mockKV as unknown as KVNamespace, index);
      
      const retrieved = await getConnectionIndex(mockKV as unknown as KVNamespace);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.connections.length).toBe(1);
      expect(retrieved?.connections[0].label).toBe("Personal");
    });
  });

  describe("addConnectionToIndex", () => {
    it("should add connection to empty index", async () => {
      const connection: ConnectionInfo = {
        id: "conn-1",
        label: "Personal",
        psuType: "personal",
        aspspName: "Test Bank",
        aspspCountry: "SE",
        validUntil: "2024-12-31",
        createdAt: "2024-01-01",
      };
      
      await addConnectionToIndex(mockKV as unknown as KVNamespace, connection);
      
      const index = await getConnectionIndex(mockKV as unknown as KVNamespace);
      expect(index?.connections.length).toBe(1);
      expect(index?.connections[0].id).toBe("conn-1");
    });

    it("should update existing connection in index", async () => {
      const connection1: ConnectionInfo = {
        id: "conn-1",
        label: "Personal",
        psuType: "personal",
        aspspName: "Test Bank",
        aspspCountry: "SE",
        validUntil: "2024-12-31",
        createdAt: "2024-01-01",
      };
      
      await addConnectionToIndex(mockKV as unknown as KVNamespace, connection1);
      
      const connection1Updated: ConnectionInfo = {
        ...connection1,
        label: "Personal (Updated)",
        validUntil: "2025-06-30",
      };
      
      await addConnectionToIndex(mockKV as unknown as KVNamespace, connection1Updated);
      
      const index = await getConnectionIndex(mockKV as unknown as KVNamespace);
      expect(index?.connections.length).toBe(1);
      expect(index?.connections[0].label).toBe("Personal (Updated)");
    });

    it("should add multiple connections to index", async () => {
      const conn1: ConnectionInfo = {
        id: "conn-1",
        label: "Personal",
        psuType: "personal",
        aspspName: "Bank A",
        aspspCountry: "SE",
        validUntil: "2024-12-31",
        createdAt: "2024-01-01",
      };
      
      const conn2: ConnectionInfo = {
        id: "conn-2",
        label: "Business",
        psuType: "business",
        aspspName: "Bank B",
        aspspCountry: "DK",
        validUntil: "2024-12-31",
        createdAt: "2024-01-02",
      };
      
      await addConnectionToIndex(mockKV as unknown as KVNamespace, conn1);
      await addConnectionToIndex(mockKV as unknown as KVNamespace, conn2);
      
      const index = await getConnectionIndex(mockKV as unknown as KVNamespace);
      expect(index?.connections.length).toBe(2);
    });
  });

  describe("removeConnectionFromIndex", () => {
    it("should remove connection from index", async () => {
      const conn1: ConnectionInfo = {
        id: "conn-1",
        label: "Personal",
        psuType: "personal",
        aspspName: "Bank A",
        aspspCountry: "SE",
        validUntil: "2024-12-31",
        createdAt: "2024-01-01",
      };
      
      const conn2: ConnectionInfo = {
        id: "conn-2",
        label: "Business",
        psuType: "business",
        aspspName: "Bank B",
        aspspCountry: "DK",
        validUntil: "2024-12-31",
        createdAt: "2024-01-02",
      };
      
      await addConnectionToIndex(mockKV as unknown as KVNamespace, conn1);
      await addConnectionToIndex(mockKV as unknown as KVNamespace, conn2);
      
      await removeConnectionFromIndex(mockKV as unknown as KVNamespace, "conn-1");
      
      const index = await getConnectionIndex(mockKV as unknown as KVNamespace);
      expect(index?.connections.length).toBe(1);
      expect(index?.connections[0].id).toBe("conn-2");
    });

    it("should handle removing non-existent connection", async () => {
      await removeConnectionFromIndex(mockKV as unknown as KVNamespace, "non-existent");
      const index = await getConnectionIndex(mockKV as unknown as KVNamespace);
      expect(index).toBeNull();
    });
  });
});

describe("getAllSessions", () => {
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  it("should return empty array when no sessions exist", async () => {
    const sessions = await getAllSessions(mockKV as unknown as KVNamespace);
    expect(sessions).toEqual([]);
  });

  it("ignores a stored session that has no index entry", async () => {
    await storeSession(mockKV as unknown as KVNamespace, createMockSession(), "default");
    expect(await getAllSessions(mockKV as unknown as KVNamespace)).toEqual([]);
  });

  it("returns indexed sessions with label and PSU type from the index", async () => {
    const stale = { ...createMockSession({ aspspName: "Bank A" }), label: "Old name", psuType: "business" };
    await storeSession(mockKV as unknown as KVNamespace, stale, "conn-1");
    await storeSession(mockKV as unknown as KVNamespace, createMockSession({ aspspName: "Bank B" }), "conn-2");
    for (const [id, label] of [["conn-1", "Personal"], ["conn-2", "Gone"]]) {
      await addConnectionToIndex(mockKV as unknown as KVNamespace, {
        id, label, psuType: "personal", aspspName: "Bank", aspspCountry: "SE", validUntil: "2024-12-31", createdAt: "2024-01-01",
      });
    }
    await deleteStoredSession(mockKV as unknown as KVNamespace, "conn-2");

    const sessions = await getAllSessions(mockKV as unknown as KVNamespace);
    expect(sessions.map((s) => [s.connectionId, s.label, s.psuType, s.aspspName])).toEqual([
      ["conn-1", "Personal", "personal", "Bank A"],
    ]);
  });
});

describe("findConnectionByAccountId", () => {
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  it("should return null when no sessions exist", async () => {
    const result = await findConnectionByAccountId(mockKV as unknown as KVNamespace, "acc-1");
    expect(result).toBeNull();
  });

  it("should find account in specific connection", async () => {
    const conn1Session = createMockSession({
      accounts: [{ accountId: "acc-conn1", iban: "SE456", name: "Conn1 Account", currency: "SEK" }],
    });
    await storeSession(mockKV as unknown as KVNamespace, conn1Session, "conn-1");
    
    const conn1: ConnectionInfo = {
      id: "conn-1",
      label: "Personal",
      psuType: "personal",
      aspspName: "Bank A",
      aspspCountry: "SE",
      validUntil: "2024-12-31",
      createdAt: "2024-01-01",
    };
    await addConnectionToIndex(mockKV as unknown as KVNamespace, conn1);
    
    const result = await findConnectionByAccountId(mockKV as unknown as KVNamespace, "acc-conn1");
    expect(result).not.toBeNull();
    expect(result?.connectionId).toBe("conn-1");
  });

  it("should return null for non-existent account", async () => {
    const session = createMockSession();
    await storeSession(mockKV as unknown as KVNamespace, session, "conn-1");
    
    const result = await findConnectionByAccountId(mockKV as unknown as KVNamespace, "non-existent");
    expect(result).toBeNull();
  });
});

describe("generateConnectionId", () => {
  it("should generate unique connection IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateConnectionId());
    }
    expect(ids.size).toBe(100);
  });

  it("should generate connection IDs with correct prefix", () => {
    const id = generateConnectionId();
    expect(id.startsWith("conn_")).toBe(true);
  });
});
