import { describe, it, expect, vi, beforeEach } from "vitest";

const handlers: Record<string, (args: any, extra?: any) => Promise<any>> = {};
vi.mock("@modelcontextprotocol/server", () => ({
  McpServer: class {
    registerTool(name: string, _config: unknown, handler: any) {
      handlers[name] = handler;
    }
  },
}));

import {
  monthlyWindows,
  fetchRangeWindowed,
  backfillAccountHistory,
  writeHistoryCache,
  getCacheIndex,
  deleteHistoryCache,
  getTransactionsWithHistory,
  dedupe,
  MAX_CACHE_VALUE_BYTES,
} from "../src/enable-banking/history";
import { consentValidUntil, maxConsentDaysFromSeconds, EnableBankingClient } from "../src/enable-banking/client";
import { createBankingMcpServer } from "../src/mcp/server";
import type { Env, Transaction } from "../src/types";

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

const tx = (date: string, id = `t-${date}`, amount = "10.00"): Transaction => ({
  transaction_id: id,
  booking_date: date,
  transaction_amount: { amount, currency: "DKK" },
  credit_debit_indicator: "DBIT",
  status: "BOOK",
});

/** A fake bank: one transaction per day from `earliest`, pages of `pageSize`, failing on windows longer than `maxWindowDays`. */
function fakeBank(opts: { earliest: string; today: string; pageSize?: number; maxWindowDays?: number; longest?: "ok" | "fail" }) {
  const days: string[] = [];
  for (let d = new Date(`${opts.earliest}T00:00:00Z`); d <= new Date(`${opts.today}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) {
    days.push(d.toISOString().slice(0, 10));
  }
  const pageSize = opts.pageSize ?? 1000;
  const calls: Array<{ from?: string; to?: string; key?: string; strategy?: string }> = [];
  const getTransactions = vi.fn(async (_id: string, from?: string, to?: string, key?: string, strategy?: string) => {
    calls.push({ from, to, key, strategy });
    if (strategy === "longest") {
      if (opts.longest === "fail") throw new Error("WRONG_REQUEST_PARAMETERS");
      from = opts.earliest;
      to = opts.today;
    }
    const span = (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000;
    if (opts.maxWindowDays && span > opts.maxWindowDays) throw new Error("Enable Banking API error: 400 ASPSP_ERROR");
    const inRange = days.filter((d) => d >= from! && d <= to!).map((d) => tx(d));
    const start = key ? Number(key) : 0;
    const page = inRange.slice(start, start + pageSize);
    const next = start + pageSize < inRange.length ? String(start + pageSize) : undefined;
    return { transactions: { booked: page, pending: [] }, ...(next ? { continuation_key: next } : {}) };
  });
  return { getTransactions, calls };
}

describe("monthlyWindows", () => {
  it("splits into calendar months, newest first", () => {
    expect(monthlyWindows("2026-01-15", "2026-03-10")).toEqual([
      ["2026-03-01", "2026-03-10"],
      ["2026-02-01", "2026-02-28"],
      ["2026-01-15", "2026-01-31"],
    ]);
    expect(monthlyWindows("2026-10-01", "2026-10-20")).toEqual([["2026-10-01", "2026-10-20"]]);
  });
});

describe("fetchRangeWindowed", () => {
  it("follows continuation pages within each window and merges without duplicates", async () => {
    const bank = fakeBank({ earliest: "2026-01-01", today: "2026-10-20", pageSize: 7 });
    const r = await fetchRangeWindowed(bank, "acc", "2026-01-01", "2026-10-20", 10000);
    expect(r.booked).toHaveLength(293);
    expect(r.booked[0].booking_date).toBe("2026-10-20");
    expect(r.booked.at(-1)!.booking_date).toBe("2026-01-01");
    expect(bank.calls.some((c) => c.key)).toBe(true);
    expect(r.truncated).toBe(false);
  });

  it("retries a failing window once as two halves (Danske-style long-range errors)", async () => {
    const bank = fakeBank({ earliest: "2026-01-01", today: "2026-10-20", maxWindowDays: 20 });
    const r = await fetchRangeWindowed(bank, "acc", "2026-01-01", "2026-10-20", 10000);
    expect(r.booked).toHaveLength(293);
    expect(r.failedWindows).toEqual([]);
  });

  it("reports windows that still fail after halving", async () => {
    const bank = fakeBank({ earliest: "2026-01-01", today: "2026-03-31", maxWindowDays: 5 });
    const r = await fetchRangeWindowed(bank, "acc", "2026-03-01", "2026-03-31", 10000);
    expect(r.failedWindows).toEqual(["2026-03-01..2026-03-16", "2026-03-17..2026-03-31"]);
  });

  it("stops at max_transactions, newest first, and flags truncation", async () => {
    const bank = fakeBank({ earliest: "2025-01-01", today: "2026-10-20" });
    const r = await fetchRangeWindowed(bank, "acc", "2025-01-01", "2026-10-20", 50);
    expect(r.booked).toHaveLength(50);
    expect(r.booked[0].booking_date).toBe("2026-10-20");
    expect(r.truncated).toBe(true);
    // Only the newest two monthly windows were requested.
    expect(bank.calls.length).toBe(2);
  });

  it("dedupes by transaction id, entry reference or content", () => {
    const a = tx("2026-01-01", "x");
    const noId = { ...tx("2026-01-02"), transaction_id: undefined };
    expect(dedupe([a, { ...a }, noId, { ...noId }])).toHaveLength(2);
  });
});

describe("history cache", () => {
  it("backfills with strategy=longest and stores one KV value per month", async () => {
    const kv = mockKV();
    const bank = fakeBank({ earliest: "2025-11-15", today: "2026-01-10", pageSize: 20 });
    const index = await backfillAccountHistory(kv as any, bank, "acc", "2026-01-10");
    expect(bank.calls[0].strategy).toBe("longest");
    expect(index.source).toBe("longest");
    expect(index.months).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(index.earliest).toBe("2025-11-01");
    expect(JSON.parse(kv.store.get("tx_cache:acc:2025-12")!).booked).toHaveLength(31);
  });

  it("falls back to windowed fetching when strategy=longest is rejected", async () => {
    const kv = mockKV();
    const bank = fakeBank({ earliest: "2026-08-01", today: "2026-10-20", longest: "fail" });
    const index = await backfillAccountHistory(kv as any, bank, "acc", "2026-10-20");
    expect(index.source).toBe("windowed");
    expect(index.months).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("serves dates older than ~80 days from the cache and merges live data", async () => {
    const kv = mockKV();
    const today = "2026-10-20";
    // History captured at connect time.
    await writeHistoryCache(kv as any, "acc", [tx("2026-01-05"), tx("2026-02-10"), tx("2026-07-30", "dup")], "longest");
    // The bank now only serves the last 90 days.
    const live = fakeBank({ earliest: "2026-07-22", today });
    const r = await getTransactionsWithHistory(kv as any, live, "acc", "2026-01-01", today, 5000, today);
    const dates = r.booked.map((t) => t.booking_date);
    expect(dates).toContain("2026-01-05");
    expect(dates).toContain("2026-02-10");
    expect(dates).toContain("2026-10-20");
    expect(r.cachedMonths).toContain("2026-01");
    // No live request reached back before the cutoff for cached months.
    expect(live.calls.every((c) => !c.from || c.from >= "2026-03-01" || c.from > "2026-07-31")).toBe(true);
    expect(new Set(r.booked.map((t) => t.transaction_id)).size).toBe(r.booked.length);
  });

  it("fetches live when nothing is cached", async () => {
    const kv = mockKV();
    const live = fakeBank({ earliest: "2026-01-01", today: "2026-10-20" });
    const r = await getTransactionsWithHistory(kv as any, live, "acc", "2026-01-01", "2026-10-20", 5000, "2026-10-20");
    expect(r.booked).toHaveLength(293);
    expect(r.cachedMonths).toEqual([]);
  });

  it("skips months too large for one KV value", async () => {
    const kv = mockKV();
    const big = { ...tx("2026-03-01", "big"), remittance_information: ["x".repeat(MAX_CACHE_VALUE_BYTES)] };
    const index = await writeHistoryCache(kv as any, "acc", [big, tx("2026-04-01")], "longest");
    expect(index.months).toEqual(["2026-04"]);
    expect(kv.store.has("tx_cache:acc:2026-03")).toBe(false);
  });

  it("re-backfill drops stale months; disconnect cleanup removes everything", async () => {
    const kv = mockKV();
    await writeHistoryCache(kv as any, "acc", [tx("2026-01-05"), tx("2026-02-05")], "longest");
    await writeHistoryCache(kv as any, "acc", [tx("2026-02-06")], "longest");
    expect(kv.store.has("tx_cache:acc:2026-01")).toBe(false);
    await deleteHistoryCache(kv as any, "acc");
    expect([...kv.store.keys()].filter((k) => k.includes("acc"))).toEqual([]);
    expect(await getCacheIndex(kv as any, "acc")).toBeNull();
  });
});

describe("get_transactions tool", () => {
  const future = new Date(Date.now() + 60 * 86400000).toISOString();
  const session = (id: string, accounts: string[]) =>
    JSON.stringify({ sessionId: `s-${id}`, aspspId: "b", aspspName: "Bank", aspspCountry: "DK", consentValidUntil: future,
      accounts: accounts.map((a) => ({ accountId: a, name: a })), createdAt: future, updatedAt: future, label: id, connectionId: id });

  it("serves cached history but never for out-of-scope accounts", async () => {
    const kv = mockKV({
      "session:default": session("default", ["p1"]),
      "session:conn_b": session("conn_b", ["b1"]),
      connection_index: JSON.stringify({ connections: [{ id: "conn_b", label: "conn_b", psuType: "business", aspspName: "Bank", aspspCountry: "DK", validUntil: future, createdAt: future }], updatedAt: future }),
    });
    await writeHistoryCache(kv as any, "b1", [tx("2025-06-01", "old-b1")], "longest");
    const live = fakeBank({ earliest: "2026-01-01", today: new Date().toISOString().slice(0, 10) });
    vi.spyOn(EnableBankingClient, "create").mockResolvedValue(live as any);

    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env, { scopeGroups: ["conn_b"], scopeKey: "k" });
    const ok = JSON.parse((await handlers.get_transactions({ account_id: "b1", date_from: "2025-06-01", date_to: "2025-06-30" })).content[0].text);
    expect(ok.transactions.map((t: any) => t.id)).toEqual(["old-b1"]);
    expect(ok.fromCache).toEqual(["2025-06"]);

    const denied = await handlers.get_transactions({ account_id: "p1", date_from: "2025-06-01" });
    expect(denied.content[0].text).toContain("Account p1 not found");
  });

  it("caps results with max_transactions and says so", async () => {
    const kv = mockKV({ "session:default": session("default", ["p1"]) });
    const today = new Date().toISOString().slice(0, 10);
    const live = fakeBank({ earliest: "2026-01-01", today });
    vi.spyOn(EnableBankingClient, "create").mockResolvedValue(live as any);
    createBankingMcpServer({ BANKING_KV: kv } as unknown as Env);
    const body = JSON.parse((await handlers.get_transactions({ account_id: "p1", date_from: "2026-01-01", max_transactions: 20 })).content[0].text);
    expect(body.transactions).toHaveLength(20);
    expect(body.truncated).toBe(true);
  });
});

describe("consent validity", () => {
  it("converts maximum_consent_validity seconds to days and drops the 90-day cap", () => {
    expect(maxConsentDaysFromSeconds(15552000)).toBe(180);
    expect(maxConsentDaysFromSeconds(undefined)).toBeUndefined();
    const now = Date.parse("2026-10-20T00:00:00Z");
    const until = Date.parse(consentValidUntil(180, now));
    expect(Math.round((until - now) / 86400000)).toBe(180);
    expect(until).toBeLessThan(now + 180 * 86400000);
    expect(Math.round((Date.parse(consentValidUntil(undefined, now)) - now) / 86400000)).toBe(90);
  });

  it("startAuthorization looks up the bank's maximum when none is passed", async () => {
    const client = Object.create(EnableBankingClient.prototype) as EnableBankingClient;
    const request = vi.fn(async (_m: string, path: string, body?: any) =>
      path.startsWith("/aspsps") ? { aspsps: [{ name: "Danske Bank", country: "DK", maximum_consent_validity: 15552000 }] } : { url: "u", body });
    (client as any).request = request;
    await client.startAuthorization("Danske Bank", "DK", "https://x/callback", "personal", "s");
    const authBody = request.mock.calls.find((c) => c[1] === "/auth")![2];
    const days = (Date.parse(authBody.access.valid_until) - Date.now()) / 86400000;
    expect(Math.round(days)).toBe(180);
  });
});
