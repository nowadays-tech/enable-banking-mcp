import type { Transaction, TransactionsResponse } from "../types";

/**
 * Raw /accounts/{id}/transactions payload. Enable Banking returns a flat array
 * (`transactions: [{ status: "BOOK" | "PDNG" | ..., ... }]`); some docs and older
 * code assume the Berlin Group shape (`transactions: { booked, pending }`).
 * Anything may be missing or null.
 */
export interface RawTransactionsResponse {
  transactions?: unknown;
  continuation_key?: string | null;
}

const asTxArray = (v: unknown): Transaction[] =>
  Array.isArray(v) ? (v.filter((t) => t && typeof t === "object") as Transaction[]) : [];

/** Normalize either response shape to `{ booked, pending }`, never throwing. */
export function normalizeTransactionsResponse(raw: unknown): TransactionsResponse {
  const r = (raw && typeof raw === "object" ? raw : {}) as RawTransactionsResponse;
  const tx = r.transactions;
  let booked: Transaction[] = [];
  let pending: Transaction[] = [];

  if (Array.isArray(tx)) {
    for (const t of asTxArray(tx)) {
      const status = String(t.status ?? "BOOK").toUpperCase();
      // PDNG = pending; everything else (BOOK, INFO, missing) counts as booked.
      if (status === "PDNG" || status === "PENDING") pending.push(t);
      else booked.push(t);
    }
  } else if (tx && typeof tx === "object") {
    const o = tx as { booked?: unknown; pending?: unknown };
    booked = asTxArray(o.booked);
    pending = asTxArray(o.pending);
  }

  const key = typeof r.continuation_key === "string" && r.continuation_key ? r.continuation_key : undefined;
  return { transactions: { booked, pending }, ...(key ? { continuation_key: key } : {}) };
}

/**
 * Signed amount: Enable Banking sends unsigned amounts plus
 * `credit_debit_indicator` (DBIT = money out). Already-signed amounts are kept.
 */
export function signedAmount(tx: Transaction): number {
  const n = parseFloat(tx.transaction_amount?.amount ?? "0");
  if (!Number.isFinite(n)) return 0;
  const ind = tx.credit_debit_indicator?.toUpperCase();
  if (ind === "DBIT") return -Math.abs(n);
  if (ind === "CRDT") return Math.abs(n);
  return n;
}

export interface TransactionPager {
  getTransactions(
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
    continuationKey?: string
  ): Promise<TransactionsResponse>;
}

/**
 * Walk all pages via continuation_key. `onPage` may return false to stop early.
 * Guards against a repeated key and caps the page count so a misbehaving bank
 * can't loop forever.
 */
export async function forEachTransactionPage(
  client: TransactionPager,
  accountId: string,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  onPage: (page: TransactionsResponse) => boolean | void,
  maxPages = 50
): Promise<void> {
  let key: string | undefined;
  const seen = new Set<string>();
  for (let i = 0; i < maxPages; i++) {
    const page = await client.getTransactions(accountId, dateFrom, dateTo, key);
    if (onPage(page) === false) return;
    key = page.continuation_key;
    if (!key || seen.has(key)) return;
    seen.add(key);
  }
}
