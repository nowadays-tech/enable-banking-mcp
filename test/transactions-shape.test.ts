import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizeTransactionsResponse,
  signedAmount,
  forEachTransactionPage,
} from "../src/enable-banking/transactions";
import { EnableBankingClient } from "../src/enable-banking/client";
import type { Env, Transaction, TransactionsResponse } from "../src/types";

const tx = (id: string, extra: Partial<Transaction> = {}): Transaction => ({
  entry_reference: id,
  transaction_amount: { amount: "10.00", currency: "DKK" },
  ...extra,
});

describe("normalizeTransactionsResponse", () => {
  it("splits Enable Banking's flat array by status", () => {
    const r = normalizeTransactionsResponse({
      transactions: [tx("a", { status: "BOOK" }), tx("b", { status: "PDNG" }), tx("c")],
      continuation_key: "k1",
    });
    expect(r.transactions.booked.map((t) => t.entry_reference)).toEqual(["a", "c"]);
    expect(r.transactions.pending.map((t) => t.entry_reference)).toEqual(["b"]);
    expect(r.continuation_key).toBe("k1");
  });

  it("keeps the Berlin Group { booked, pending } shape", () => {
    const r = normalizeTransactionsResponse({ transactions: { booked: [tx("a")], pending: [tx("b")] } });
    expect(r.transactions.booked).toHaveLength(1);
    expect(r.transactions.pending).toHaveLength(1);
  });

  it.each([
    [{}],
    [{ transactions: null }],
    [{ transactions: [] }],
    [{ transactions: {} }],
    [{ transactions: { booked: null } }],
    [null],
    [undefined],
    ["nonsense"],
  ])("handles empty or missing data: %j", (raw) => {
    const r = normalizeTransactionsResponse(raw);
    expect(r.transactions).toEqual({ booked: [], pending: [] });
    expect(r.continuation_key).toBeUndefined();
  });

  it("drops a null/empty continuation_key", () => {
    expect(normalizeTransactionsResponse({ transactions: [], continuation_key: null }).continuation_key).toBeUndefined();
    expect(normalizeTransactionsResponse({ transactions: [], continuation_key: "" }).continuation_key).toBeUndefined();
  });
});

describe("signedAmount", () => {
  it("uses credit_debit_indicator for unsigned amounts", () => {
    expect(signedAmount(tx("a", { credit_debit_indicator: "DBIT" }))).toBe(-10);
    expect(signedAmount(tx("a", { credit_debit_indicator: "CRDT" }))).toBe(10);
  });
  it("keeps already-signed amounts without indicator", () => {
    expect(signedAmount(tx("a", { transaction_amount: { amount: "-5.5", currency: "DKK" } }))).toBe(-5.5);
  });
  it("does not double-negate a signed debit", () => {
    expect(signedAmount(tx("a", { credit_debit_indicator: "DBIT", transaction_amount: { amount: "-5", currency: "DKK" } }))).toBe(-5);
  });
});

describe("forEachTransactionPage", () => {
  const pages: Record<string, TransactionsResponse> = {
    "": { transactions: { booked: [tx("1")], pending: [] }, continuation_key: "p2" },
    p2: { transactions: { booked: [tx("2")], pending: [] }, continuation_key: "p3" },
    p3: { transactions: { booked: [tx("3")], pending: [] } },
  };
  const client = { getTransactions: vi.fn(async (_a: string, _f?: string, _t?: string, k?: string) => pages[k ?? ""]) };

  it("follows continuation_key to the end", async () => {
    const ids: string[] = [];
    await forEachTransactionPage(client, "acc", "2026-01-01", "2026-01-31", (p) => {
      ids.push(...p.transactions.booked.map((t) => t.entry_reference!));
    });
    expect(ids).toEqual(["1", "2", "3"]);
  });

  it("stops early when onPage returns false", async () => {
    client.getTransactions.mockClear();
    await forEachTransactionPage(client, "acc", undefined, undefined, () => false);
    expect(client.getTransactions).toHaveBeenCalledTimes(1);
  });

  it("stops on a repeated continuation_key", async () => {
    const loop = { getTransactions: vi.fn(async () => ({ transactions: { booked: [], pending: [] }, continuation_key: "same" })) };
    await forEachTransactionPage(loop, "acc", undefined, undefined, () => {});
    expect(loop.getTransactions).toHaveBeenCalledTimes(2);
  });
});

describe("EnableBankingClient.getTransactions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("normalizes the flat Enable Banking response (the Spar Nord bug)", async () => {
    vi.spyOn(EnableBankingClient.prototype as any, "request").mockResolvedValue({
      transactions: [
        tx("x", { status: "BOOK", credit_debit_indicator: "DBIT" }),
        tx("y", { status: "PDNG", credit_debit_indicator: "CRDT" }),
      ],
      continuation_key: "next",
    });
    const client = new EnableBankingClient({} as Env, { appId: "a", privateKey: "k" } as any);
    const r = await client.getTransactions("acc", "2026-10-01", "2026-10-14");
    expect(r.transactions.booked).toHaveLength(1);
    expect(r.transactions.pending).toHaveLength(1);
    expect(r.continuation_key).toBe("next");
  });
});
