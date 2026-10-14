import { describe, it, expect, vi, beforeEach } from "vitest";

const handlers: Record<string, (args: any, extra?: any) => Promise<any>> = {};
vi.mock("@modelcontextprotocol/server", () => ({
  McpServer: class {
    registerTool(name: string, _config: unknown, handler: any) {
      handlers[name] = handler;
    }
  },
}));

import { createBankingMcpServer } from "../src/mcp/server";
import { buildScopeProps, resolveScope, addToScope } from "../src/scope";
import {
  createMagicLink,
  consumeMagicLink,
  safeReturnPath,
  sendMagicLink,
  magicLinkEnabled,
  DEFAULT_MAGIC_LINK_FROM,
} from "../src/auth/magic-link";
import { renameConnection, getConnectionIndex, getStoredSession } from "../src/enable-banking/client";
import { renderConsentPage, renderConnectPage } from "../src/ui/pages";
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
    put: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    delete: vi.fn(async (k: string) => {
      store.delete(k);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true })),
  };
}

const future = new Date(Date.now() + 60 * 86400000).toISOString();
const sess = (id: string, label: string, accounts: string[]) =>
  JSON.stringify({
    sessionId: `s-${id}`,
    aspspId: "bank",
    aspspName: `${label} Bank`,
    aspspCountry: "DK",
    consentValidUntil: future,
    accounts: accounts.map((a) => ({ accountId: a, name: a })),
    createdAt: future,
    updatedAt: future,
    label,
    connectionId: id,
  });

function threeBanks() {
  const index = {
    connections: [
      { id: "conn_hold", label: "Holm Friis Holding", psuType: "business", aspspName: "Nordea", aspspCountry: "DK", validUntil: future, createdAt: future },
      { id: "conn_kbh", label: "Holm Friis København", psuType: "business", aspspName: "Spar Nord", aspspCountry: "DK", validUntil: future, createdAt: future },
    ],
    updatedAt: future,
  };
  return mockKV({
    "config:baseUrl": "https://x.workers.dev",
    "session:default": sess("default", "Personlige bankkonti", ["p1", "p2"]),
    "session:conn_hold": sess("conn_hold", "Holm Friis Holding", ["h1"]),
    "session:conn_kbh": sess("conn_kbh", "Holm Friis København", ["k1"]),
    connection_index: JSON.stringify(index),
  });
}

const parse = (res: any) => JSON.parse(res.content[0].text);

describe("buildScopeProps", () => {
  it("returns 'all' (no scopeGroups) when every connection is selected", () => {
    expect(buildScopeProps("owner", ["a", "b"], ["a", "b"])).toEqual({ userId: "owner" });
    expect(buildScopeProps("owner", [], [])).toEqual({ userId: "owner" });
  });
  it("returns scopeGroups and a scopeKey for a subset, dropping unknown ids", () => {
    expect(buildScopeProps("owner", ["a", "zzz"], ["a", "b"], () => "key1")).toEqual({
      userId: "owner",
      scopeGroups: ["a"],
      scopeKey: "key1",
    });
  });
});

describe("resolveScope", () => {
  it("treats legacy props without scopeGroups as all", async () => {
    const kv = mockKV();
    expect((await resolveScope(kv as any, { userId: "owner" })).all).toBe(true);
    expect((await resolveScope(kv as any, undefined)).all).toBe(true);
    expect((await resolveScope(kv as any, { scopeGroups: [] })).all).toBe(true);
  });
  it("includes connections added later for the same scopeKey", async () => {
    const kv = mockKV();
    await addToScope(kv as any, "k", "conn_new");
    await addToScope(kv as any, "k", "conn_new");
    const scope = await resolveScope(kv as any, { scopeGroups: ["default"], scopeKey: "k" });
    expect(scope.all).toBe(false);
    expect([...scope.connectionIds].sort()).toEqual(["conn_new", "default"]);
  });
});

describe("tool scoping", () => {
  beforeEach(() => {
    for (const k of Object.keys(handlers)) delete handlers[k];
  });

  it("an unscoped token sees all connections in list_connections", async () => {
    const kv = threeBanks();
    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env, { userId: "owner" });
    const body = parse(await handlers.list_connections({}));
    expect(body.connections.map((c: any) => c.id)).toEqual(["default", "conn_hold", "conn_kbh"]);
    expect(body.connections[1]).toMatchObject({
      label: "Holm Friis Holding",
      bank: "Holm Friis Holding Bank",
      psuType: "business",
      accountCount: 1,
      renewUrl: "https://x.workers.dev/renew/conn_hold",
    });
  });

  it("a scoped token only sees its connections in every listing tool", async () => {
    const kv = threeBanks();
    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env, { userId: "owner", scopeGroups: ["conn_hold"], scopeKey: "k" });
    expect(parse(await handlers.list_connections({})).connections.map((c: any) => c.id)).toEqual(["conn_hold"]);
    expect(parse(await handlers.connection_status({})).connections.map((c: any) => c.connectionId)).toEqual(["conn_hold"]);
    expect(parse(await handlers.list_accounts({})).connections.map((c: any) => c.connectionId)).toEqual(["conn_hold"]);
  });

  it("refuses out-of-scope accounts and groups server-side", async () => {
    const kv = threeBanks();
    const client = await import("../src/enable-banking/client");
    const getBalances = vi.fn(async () => ({ balances: [] }));
    vi.spyOn(client.EnableBankingClient, "create").mockResolvedValue({ getBalances } as any);
    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env, { scopeGroups: ["conn_hold"], scopeKey: "k" });
    const res = await handlers.get_balances({ account_id: "p1" });
    expect(res.content[0].text).toContain("Account p1 not found");
    const res2 = await handlers.get_balances({ group: "Personlige bankkonti" });
    expect(res2.content[0].text).toContain('No connection found with group "Personlige bankkonti"');
    expect(getBalances).not.toHaveBeenCalled();
  });

  it("get_balances without account_id covers all in-scope accounts, filtered by group", async () => {
    const kv = threeBanks();
    const client = await import("../src/enable-banking/client");
    const getBalances = vi.fn(async () => ({
      balances: [{ balance_amount: { amount: "10.00", currency: "DKK" }, balance_type: "CLAV" }],
    }));
    vi.spyOn(client.EnableBankingClient, "create").mockResolvedValue({ getBalances } as any);
    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env);
    const all = parse(await handlers.get_balances({}));
    expect(all.accounts.map((a: any) => a.accountId)).toEqual(["p1", "p2", "h1", "k1"]);
    const one = parse(await handlers.get_balances({ group: "holm friis københavn" }));
    expect(one.accounts.map((a: any) => a.accountId)).toEqual(["k1"]);
    expect(one.accounts[0].group).toBe("Holm Friis København");
  });

  it("get_transactions rejects continuation_key without account_id", async () => {
    const kv = threeBanks();
    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env);
    const res = await handlers.get_transactions({ continuation_key: "x" });
    expect(res.content[0].text).toBe("continuation_key requires account_id.");
  });

  it("add_bank_connection records the scopeKey only for scoped tokens", async () => {
    const kv = threeBanks();
    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env, { scopeGroups: ["conn_hold"], scopeKey: "k" });
    const scoped = parse(await handlers.add_bank_connection({ label: "New" }));
    const t1 = new URL(scoped.url).searchParams.get("token");
    expect(JSON.parse(kv.store.get(`connect_request:${t1}`)!).scopeKey).toBe("k");

    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env, { userId: "owner" });
    const all = parse(await handlers.add_bank_connection({ label: "New" }));
    const t2 = new URL(all.url).searchParams.get("token");
    expect(JSON.parse(kv.store.get(`connect_request:${t2}`)!).scopeKey).toBeUndefined();
  });
});

describe("magic link", () => {
  it("is enabled only with both RESEND_API_KEY and OWNER_EMAIL", () => {
    expect(magicLinkEnabled({ RESEND_API_KEY: "k" })).toBe(false);
    expect(magicLinkEnabled({ OWNER_EMAIL: "a@b.c" })).toBe(false);
    expect(magicLinkEnabled({ RESEND_API_KEY: "k", OWNER_EMAIL: "a@b.c" })).toBe(true);
  });

  it("tokens are one-time use and stored with a short TTL", async () => {
    const kv = mockKV();
    const token = await createMagicLink(kv as any, "a@b.c", "/authorize?x=1");
    expect(kv.put).toHaveBeenCalledWith(`magic_link:${token}`, expect.any(String), { expirationTtl: 900 });
    expect(await consumeMagicLink(kv as any, token)).toMatchObject({ email: "a@b.c", returnTo: "/authorize?x=1" });
    expect(await consumeMagicLink(kv as any, token)).toBeNull();
  });

  it("only allows relative return paths", () => {
    expect(safeReturnPath("/authorize?a=b")).toBe("/authorize?a=b");
    expect(safeReturnPath("https://evil.example")).toBe("/setup");
    expect(safeReturnPath("//evil.example")).toBe("/setup");
    expect(safeReturnPath("/\\evil.example")).toBe("/setup");
  });

  it("sends to OWNER_EMAIL from the default sender and rate-limits", async () => {
    const kv = mockKV();
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const env = { BANKING_KV: kv, RESEND_API_KEY: "test-key", OWNER_EMAIL: "owner@example.com" } as unknown as Env;
    expect(await sendMagicLink(env, "https://x.workers.dev", "/setup", fetchImpl as any)).toBe("sent");
    const [, init] = fetchImpl.mock.calls[0] as any;
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.from).toBe(DEFAULT_MAGIC_LINK_FROM);
    expect(body.text).toMatch(/https:\/\/x\.workers\.dev\/auth\/magic\?token=/);
    expect(await sendMagicLink(env, "https://x.workers.dev", "/setup", fetchImpl as any)).toBe("rate_limited");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("renameConnection", () => {
  it("renames the Default connection in both session and index", async () => {
    const kv = threeBanks();
    const index = JSON.parse(kv.store.get("connection_index")!);
    index.connections.push({ id: "default", label: "Default", psuType: "personal", aspspName: "Danske", aspspCountry: "DK", validUntil: future, createdAt: future });
    kv.store.set("connection_index", JSON.stringify(index));
    expect(await renameConnection(kv as any, "default", "Personlige bankkonti")).toBe(true);
    expect((await getStoredSession(kv as any, "default"))!.label).toBe("Personlige bankkonti");
    expect((await getConnectionIndex(kv as any))!.connections.find((c) => c.id === "default")!.label).toBe("Personlige bankkonti");
    expect(await renameConnection(kv as any, "nope", "X")).toBe(false);
  });
});

describe("consent and connect pages", () => {
  const conns = [
    { id: "default", label: "Personlige bankkonti", aspspName: "Danske Bank", psuType: "personal" as const, accountCount: 6, validUntil: future },
    { id: "conn_hold", label: "Holm <Friis>", aspspName: "Nordea", psuType: "business" as const, accountCount: 1, validUntil: future },
  ];
  it("lists connections as checkboxes, all ticked by default, with an add-bank button", () => {
    const html = renderConsentPage("Grok", ["banking:read"], "h", false, undefined, { connections: conns });
    expect(html.match(/name="connection" value="[^"]+" checked/g)).toHaveLength(2);
    expect(html).toContain('value="add_bank"');
    expect(html).toContain("Add new bank connection");
    expect(html).toContain("Holm &lt;Friis&gt;");
  });
  it("respects a previous selection", () => {
    const html = renderConsentPage("Grok", ["banking:read"], "h", false, undefined, { connections: conns, selected: ["conn_hold"] });
    expect(html).toContain('value="conn_hold" checked');
    expect(html).not.toContain('value="default" checked');
  });
  it("offers the magic link only when enabled", () => {
    expect(renderConsentPage("Grok", [], "h", true)).not.toContain('value="magic"');
    expect(renderConsentPage("Grok", [], "h", true, undefined, { magicLinkEnabled: true })).toContain('value="magic"');
  });
  it("editable connect page asks for label and account type", () => {
    const html = renderConnectPage("https://x", "", "personal", "DK", [], "tok", undefined, { editable: true, countries: ["DK", "SE"], returnTo: "/authorize?a=1" });
    expect(html).toContain('name="label"');
    expect(html).toContain('<select id="psuTypeSelect" name="psu_type" form="connectForm">');
    expect(html).toContain('href="/authorize?a=1"');
  });
});
