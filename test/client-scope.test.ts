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
import {
  resolveScope,
  grantIdFromAuthHeader,
  setClientScopeOverride,
  getClientScopeOverride,
  deleteClientScopeOverride,
  parseScopeForm,
  addToScope,
} from "../src/scope";
import { refreshSessionAccounts, maskIban, refreshNotice } from "../src/enable-banking/refresh";
import { renderWizardPage } from "../src/ui/pages";
import { listMcpClients } from "../src/mcp-clients";
import type { Env, BankSession } from "../src/types";
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
const env = (kv: any) => ({ BANKING_KV: kv }) as unknown as Env;

describe("grantIdFromAuthHeader", () => {
  it("extracts the grant id from an OAuth access token", () => {
    expect(grantIdFromAuthHeader("Bearer owner:grant123:secretsecret")).toBe("grant123");
    expect(grantIdFromAuthHeader("bearer owner:g:s")).toBe("g");
  });
  it("ignores AUTH_SECRET-style and malformed tokens", () => {
    expect(grantIdFromAuthHeader("Bearer plainsecret")).toBeUndefined();
    expect(grantIdFromAuthHeader("Bearer a:b")).toBeUndefined();
    expect(grantIdFromAuthHeader(null)).toBeUndefined();
  });
});

describe("server-side client scope override", () => {
  it("narrows an unscoped (pre-scoping, no scopeKey) grant without re-auth", async () => {
    const kv = threeBanks();
    await setClientScopeOverride(kv as any, "g1", { all: false, connectionIds: ["conn_kbh"] });
    createBankingMcpServer(env(kv), { userId: "owner" }, "g1");
    expect(parse(await handlers.list_connections({})).connections.map((c: any) => c.id)).toEqual(["conn_kbh"]);
  });

  it("widens a scoped token to all banks", async () => {
    const kv = threeBanks();
    await setClientScopeOverride(kv as any, "g2", { all: true });
    createBankingMcpServer(env(kv), { userId: "owner", scopeGroups: ["conn_hold"], scopeKey: "k" }, "g2");
    expect(parse(await handlers.list_connections({})).connections).toHaveLength(3);
  });

  it("falls back to token props when there is no override (or no grant id)", async () => {
    const kv = threeBanks();
    await setClientScopeOverride(kv as any, "other", { all: false, connectionIds: ["conn_kbh"] });
    const scope = await resolveScope(kv as any, { scopeGroups: ["conn_hold"], scopeKey: "k" }, "g3");
    expect([...scope.connectionIds]).toEqual(["conn_hold"]);
    expect((await resolveScope(kv as any, { userId: "owner" })).all).toBe(true);
  });

  it("enforces per-account selection in every data tool", async () => {
    const kv = threeBanks();
    await setClientScopeOverride(kv as any, "g4", {
      all: false,
      connectionIds: ["default", "conn_hold"],
      accountIds: { default: ["p2"] },
    });
    const client = await import("../src/enable-banking/client");
    const getBalances = vi.fn(async () => ({ balances: [] }));
    vi.spyOn(client.EnableBankingClient, "create").mockResolvedValue({ getBalances } as any);
    createBankingMcpServer(env(kv), { userId: "owner" }, "g4");
    const accounts = parse(await handlers.list_accounts({})).connections.flatMap((c: any) => c.accounts.map((a: any) => a.id));
    expect(accounts.sort()).toEqual(["h1", "p2"]);
    const denied = await handlers.get_balances({ account_id: "p1" });
    expect(denied.content[0].text).toContain("Account p1 not found");
    await handlers.get_balances({});
    expect(getBalances.mock.calls.map((c: any[]) => c[0]).sort()).toEqual(["h1", "p2"]);
  });

  it("records banks the app adds while overridden under the grant, and clears them on the next edit", async () => {
    const kv = threeBanks();
    await setClientScopeOverride(kv as any, "g5", { all: false, connectionIds: ["conn_hold"] });
    const scope = await resolveScope(kv as any, {}, "g5");
    expect(scope.scopeKey).toBe("grant:g5");
    await addToScope(kv as any, scope.scopeKey!, "conn_kbh");
    expect([...(await resolveScope(kv as any, {}, "g5")).connectionIds].sort()).toEqual(["conn_hold", "conn_kbh"]);
    await setClientScopeOverride(kv as any, "g5", { all: false, connectionIds: ["conn_hold"] });
    expect([...(await resolveScope(kv as any, {}, "g5")).connectionIds]).toEqual(["conn_hold"]);
    await deleteClientScopeOverride(kv as any, "g5");
    expect(await getClientScopeOverride(kv as any, "g5")).toBeNull();
  });
});

describe("parseScopeForm", () => {
  const sessions = [
    { connectionId: "default", accounts: [{ accountId: "p1" }, { accountId: "p2" }] },
    { connectionId: "conn_hold", accounts: [{ accountId: "h1" }] },
  ];
  it("all banks wins", () => {
    expect(parseScopeForm({ allBanks: true, connections: [], accounts: [] }, sessions)).toEqual({ all: true });
  });
  it("a ticked bank means the whole bank; partial accounts restrict", () => {
    expect(
      parseScopeForm({ allBanks: false, connections: ["conn_hold"], accounts: ["conn_hold|h1", "default|p1"] }, sessions)
    ).toEqual({ all: false, connectionIds: ["conn_hold", "default"], accountIds: { default: ["p1"] } });
  });
  it("every account ticked individually collapses to the whole bank", () => {
    expect(parseScopeForm({ allBanks: false, connections: [], accounts: ["default|p1", "default|p2"] }, sessions)).toEqual({
      all: false,
      connectionIds: ["default"],
    });
  });
  it("drops unknown banks/accounts and rejects an empty selection", () => {
    expect(parseScopeForm({ allBanks: false, connections: ["nope"], accounts: ["default|zzz", "junk"] }, sessions)).toBeNull();
  });
});

describe("refreshSessionAccounts", () => {
  const base: BankSession = {
    sessionId: "s1", aspspId: "d", aspspName: "Danske Bank", aspspCountry: "DK",
    consentValidUntil: "2027-01-10T00:00:00Z", createdAt: "x", updatedAt: "x",
    accounts: [{ accountId: "a1", name: "Old", iban: "DK0530004930364010", currency: "DKK" }, { accountId: "gone", name: "Closed" }],
  };
  it("adds new accounts, drops removed ones and refreshes details", async () => {
    const client = {
      getSessionStatus: vi.fn(async () => ({ status: "AUTHORIZED", accounts: ["a1", "a2"], access: { valid_until: "2027-01-11T00:00:00Z" } })),
      getAccountDetails: vi.fn(async (uid: string) =>
        uid === "a2" ? { account_id: { iban: "DK2330003363222277" }, name: "Opsparing", currency: "DKK" } : { name: "Lønkonto" }),
    };
    const r = await refreshSessionAccounts(client, base);
    expect(r.authorized).toBe(true);
    expect(r.added.map((a) => a.accountId)).toEqual(["a2"]);
    expect(r.removed.map((a) => a.accountId)).toEqual(["gone"]);
    expect(r.session.accounts).toEqual([
      { accountId: "a1", name: "Lønkonto", iban: "DK0530004930364010", currency: "DKK", accountType: undefined },
      { accountId: "a2", name: "Opsparing", iban: "DK2330003363222277", currency: "DKK", accountType: undefined },
    ]);
    expect(r.session.consentValidUntil).toBe("2027-01-11T00:00:00Z");
  });
  it("reports an inactive consent instead of wiping accounts", async () => {
    const client = { getSessionStatus: vi.fn(async () => ({ status: "EXPIRED", accounts: [] })), getAccountDetails: vi.fn() };
    const r = await refreshSessionAccounts(client, base);
    expect(r.authorized).toBe(false);
    expect(r.session.accounts).toHaveLength(2);
    expect(client.getAccountDetails).not.toHaveBeenCalled();
  });
  it("explains that new accounts need Renew when nothing changed", () => {
    expect(refreshNotice("Privat", 0, 0, 6)).toContain("use Renew");
    expect(refreshNotice("Privat", 1, 0, 7)).toBe("Privat: 1 new account. 7 accounts now shared.");
    expect(maskIban("DK05 3000 4930 3640 10")).toBe("•••• 4010");
  });
});

describe("setup overview: accounts + access editor", () => {
  const day = 86400000;
  const connections = [
    { id: "default", label: "Privat", aspspName: "Danske Bank", aspspCountry: "DK", psuType: "personal" as const, accountCount: 2,
      validUntil: new Date(Date.now() + 80 * day).toISOString(),
      accounts: [{ accountId: "p1", name: "Lønkonto", iban: "DK0530004930364010", currency: "DKK" }, { accountId: "p2", name: "Budget", iban: "DK2330003363222277", currency: "DKK" }] },
    { id: "conn_hold", label: "Holm & Friis Holding", aspspName: "Nordea", aspspCountry: "DK", psuType: "business" as const, accountCount: 1,
      validUntil: new Date(Date.now() + 80 * day).toISOString(), accounts: [{ accountId: "h1", name: "Drift", currency: "DKK" }] },
  ];
  const html = renderWizardPage("https://x.dev", {
    hasCredentials: true, credentialsFromEnv: false, hasBankSession: true, connections,
    clients: [{ grantId: "g1", clientId: "c", clientName: "Grok", connectedAt: Date.now(), scope: ["default"], accountIds: { default: ["p2"] }, edited: true }],
  }, ["DK"]);
  it("lists accounts with masked IBANs under each bank and a Refresh action", () => {
    expect(html).toContain("Lønkonto");
    expect(html).toContain("•••• 4010");
    expect(html).not.toContain("DK0530004930364010");
    expect(html).toContain('action="/connections/refresh"');
  });
  it("renders the editor with the current selection", () => {
    expect(html).toContain('action="/clients/scope"');
    expect(html).toContain("All banks, including future ones");
    expect(html).toContain('value="default|p2" data-bank="default" checked');
    expect(html).not.toContain('value="default|p1" data-bank="default" checked');
    expect(html).toContain("Privat (1 of 2 accounts)");
    expect(html).toContain("access edited");
  });
});

describe("listMcpClients with overrides", () => {
  it("prefers the server-side override over grant metadata", async () => {
    const kv = threeBanks();
    await setClientScopeOverride(kv as any, "g1", { all: false, connectionIds: ["conn_kbh"] });
    const helpers = {
      listUserGrants: vi.fn(async () => ({ items: [{ id: "g1", clientId: "c1", userId: "owner", scope: [], metadata: { scopeGroups: "all" }, createdAt: 1 }] })),
      lookupClient: vi.fn(async () => ({ clientId: "c1", clientName: "Grok", redirectUris: [] })),
    };
    const [c] = await listMcpClients(helpers as any, "owner", kv as any);
    expect(c.scope).toEqual(["conn_kbh"]);
    expect(c.edited).toBe(true);
  });
});
