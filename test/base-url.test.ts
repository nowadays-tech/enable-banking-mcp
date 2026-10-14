import { describe, it, expect, vi } from "vitest";

const handlers: Record<string, (args: any, extra?: any) => Promise<any>> = {};
vi.mock("@modelcontextprotocol/server", () => ({
  McpServer: class {
    registerTool(name: string, _config: unknown, handler: any) {
      handlers[name] = handler;
    }
  },
}));

import { ensureBaseUrl, getBaseUrl } from "../src/enable-banking/client";
import { createBankingMcpServer } from "../src/mcp/server";
import type { Env } from "../src/types";

function mockKV(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get: vi.fn(async (k: string, type?: string) => {
      const v = store.get(k);
      if (v === undefined) return null;
      return type === "json" ? JSON.parse(v) : v;
    }),
    put: vi.fn(async (k: string, v: string) => void store.set(k, v)),
    delete: vi.fn(async (k: string) => void store.delete(k)),
    list: vi.fn(async () => ({ keys: [], list_complete: true })),
  };
}

const session = (days: number) => ({
  sessionId: "s1",
  aspspId: "danske",
  aspspName: "Danske Bank",
  aspspCountry: "DK",
  consentValidUntil: new Date(Date.now() + days * 86400000).toISOString(),
  accounts: [{ accountId: "acc-1", name: "Main" }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe("ensureBaseUrl", () => {
  it("stores the base URL when missing and skips the write when unchanged", async () => {
    const kv = mockKV();
    await ensureBaseUrl(kv as unknown as KVNamespace, "https://x.workers.dev");
    expect(await getBaseUrl(kv as unknown as KVNamespace)).toBe("https://x.workers.dev");
    await ensureBaseUrl(kv as unknown as KVNamespace, "https://x.workers.dev");
    expect(kv.put).toHaveBeenCalledTimes(1);
  });
});

describe("connection_status and expired-session mapping", () => {
  it("returns the Default connection with days left once the base URL is known", async () => {
    const kv = mockKV({ "session:default": JSON.stringify(session(88)) });
    await ensureBaseUrl(kv as unknown as KVNamespace, "https://x.workers.dev");
    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env);
    const res = await handlers.connection_status({});
    const body = JSON.parse(res.content[0].text);
    expect(body.connections[0].label).toBe("Default");
    expect(body.connections[0].daysLeft).toBe(88);
    expect(body.connections[0].renewUrl).toBe("https://x.workers.dev/renew/default");
  });

  it("maps bank expired-session API errors to the renew message", async () => {
    const kv = mockKV({
      "session:default": JSON.stringify(session(30)),
      "config:baseUrl": "https://x.workers.dev",
    });
    const client = await import("../src/enable-banking/client");
    vi.spyOn(client.EnableBankingClient, "create").mockResolvedValue({
      getBalances: async () => {
        throw new Error("Enable Banking API error: 401 Unauthorized - session_expired");
      },
    } as any);
    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env);
    const res = await handlers.get_balances({ account_id: "acc-1" });
    expect(res.content[0].text).toBe(
      "Connection 'Default' has expired. Renew here: https://x.workers.dev/renew/default"
    );
  });
});

describe("add_bank_connection", () => {
  it("returns a one-time /connect URL and stores the request with a 1h TTL", async () => {
    const kv = mockKV({ "config:baseUrl": "https://x.workers.dev" });
    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env);
    const res = await handlers.add_bank_connection({ label: "Test", psu_type: "personal" });
    const body = JSON.parse(res.content[0].text);
    expect(body.url).toMatch(/^https:\/\/x\.workers\.dev\/connect\?token=[0-9a-f-]{36}$/);
    expect(body).toMatchObject({ label: "Test", psuType: "personal", country: "DK", expiresIn: "1 hour" });
    const token = new URL(body.url).searchParams.get("token");
    expect(kv.put).toHaveBeenCalledWith(`connect_request:${token}`, expect.any(String), { expirationTtl: 3600 });
  });

  it("registers each tool name exactly once", () => {
    const names: string[] = [];
    const kv = mockKV();
    for (const k of Object.keys(handlers)) delete handlers[k];
    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env);
    names.push(...Object.keys(handlers));
    expect(names.sort()).toEqual([
      "add_bank_connection", "connection_status", "get_balances", "get_transactions",
      "list_accounts", "list_connections", "search_transactions", "summarize_spending",
    ]);
  });
});
