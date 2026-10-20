import type { Transaction, TransactionsResponse } from "../types";

/**
 * Transaction history beyond what one bank request returns.
 *
 * - Long ranges are split into calendar-month windows (some banks, e.g. Danske,
 *   fail on a single 10-month request). Each window follows continuation pages;
 *   a failing window is retried once as two halves.
 * - Right after a new or renewed consent, full history is fetched with
 *   strategy=longest (falling back to windows) and cached per account and month
 *   as `tx_cache:<accountId>:<YYYY-MM>`. Many banks only serve >90 days of
 *   history shortly after the MitID approval; older dates are served from the cache.
 */

export type TxStrategy = "default" | "longest";

export interface HistoryClient {
  getTransactions(
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
    continuationKey?: string,
    strategy?: TxStrategy
  ): Promise<TransactionsResponse>;
}

export interface FetchResult {
  booked: Transaction[];
  pending: Transaction[];
  /** True when max_transactions was reached and older transactions were left out. */
  truncated: boolean;
  /** Windows that failed even after halving (YYYY-MM-DD..YYYY-MM-DD). */
  failedWindows: string[];
  /** Months served from the cache. */
  cachedMonths: string[];
}

export const DEFAULT_MAX_TRANSACTIONS = 500;
export const CACHE_CUTOFF_DAYS = 80;
const MAX_PAGES_PER_WINDOW = 50;
const MAX_BACKFILL_PAGES = 200;
const FALLBACK_BACKFILL_MONTHS = 24;
/** KV values are limited to 25 MiB; stay well below. */
export const MAX_CACHE_VALUE_BYTES = 20 * 1024 * 1024;

const DAY = 86400000;
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const parseDate = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => isoDate(new Date(parseDate(s).getTime() + n * DAY));
const monthOf = (s: string) => s.slice(0, 7);
const txDate = (t: Transaction) => t.booking_date || t.value_date || t.transaction_date || "";

/** Stable identity for de-duplication across windows, pages and cache. */
export function txKey(t: Transaction): string {
  if (t.transaction_id) return `id:${t.transaction_id}`;
  if (t.entry_reference) return `ref:${t.entry_reference}`;
  return [
    "h",
    txDate(t),
    t.transaction_amount?.amount,
    t.transaction_amount?.currency,
    t.credit_debit_indicator,
    (t.remittance_information || []).join("|"),
    t.creditor_name || t.debtor_name || "",
  ].join(":");
}

export function dedupe(list: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  return list.filter((t) => {
    const k = txKey(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const newestFirst = (a: Transaction, b: Transaction) => txDate(b).localeCompare(txDate(a));

/** Calendar-month windows covering [from, to], newest first. */
export function monthlyWindows(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  let end = to;
  while (end >= from) {
    const monthStart = `${monthOf(end)}-01`;
    const start = monthStart > from ? monthStart : from;
    out.push([start, end]);
    end = addDays(start, -1);
  }
  return out;
}

async function fetchWindow(
  client: HistoryClient,
  accountId: string,
  from: string,
  to: string
): Promise<{ booked: Transaction[]; pending: Transaction[] }> {
  const booked: Transaction[] = [];
  const pending: Transaction[] = [];
  let key: string | undefined;
  const seen = new Set<string>();
  for (let i = 0; i < MAX_PAGES_PER_WINDOW; i++) {
    const page = await client.getTransactions(accountId, from, to, key);
    booked.push(...(page.transactions?.booked ?? []));
    pending.push(...(page.transactions?.pending ?? []));
    key = page.continuation_key;
    if (!key || seen.has(key)) break;
    seen.add(key);
  }
  return { booked, pending };
}

/** One window; on failure retry once as two halves. Returns failed sub-windows. */
async function fetchWindowWithRetry(
  client: HistoryClient,
  accountId: string,
  from: string,
  to: string
): Promise<{ booked: Transaction[]; pending: Transaction[]; failed: string[] }> {
  try {
    return { ...(await fetchWindow(client, accountId, from, to)), failed: [] };
  } catch (error) {
    const days = Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY);
    if (days < 1) return { booked: [], pending: [], failed: [`${from}..${to}`] };
    const mid = addDays(from, Math.floor(days / 2));
    const out = { booked: [] as Transaction[], pending: [] as Transaction[], failed: [] as string[] };
    for (const [a, b] of [[from, mid], [addDays(mid, 1), to]] as [string, string][]) {
      try {
        const r = await fetchWindow(client, accountId, a, b);
        out.booked.push(...r.booked);
        out.pending.push(...r.pending);
      } catch {
        out.failed.push(`${a}..${b}`);
      }
    }
    return out;
  }
}

/**
 * Live fetch of [from, to], windowed by month (newest first), stopping once
 * maxTransactions booked transactions are collected.
 */
export async function fetchRangeWindowed(
  client: HistoryClient,
  accountId: string,
  from: string,
  to: string,
  maxTransactions = DEFAULT_MAX_TRANSACTIONS
): Promise<FetchResult> {
  const booked: Transaction[] = [];
  const pending: Transaction[] = [];
  const failedWindows: string[] = [];
  let truncated = false;
  for (const [a, b] of monthlyWindows(from, to)) {
    const r = await fetchWindowWithRetry(client, accountId, a, b);
    booked.push(...r.booked);
    pending.push(...r.pending);
    failedWindows.push(...r.failed);
    if (dedupe(booked).length >= maxTransactions) {
      truncated = a > from;
      break;
    }
  }
  return finalize(booked, pending, failedWindows, [], maxTransactions, truncated);
}

function finalize(
  booked: Transaction[],
  pending: Transaction[],
  failedWindows: string[],
  cachedMonths: string[],
  maxTransactions: number,
  truncated: boolean
): FetchResult {
  const b = dedupe(booked).sort(newestFirst);
  return {
    booked: b.slice(0, maxTransactions),
    pending: dedupe(pending),
    truncated: truncated || b.length > maxTransactions,
    failedWindows,
    cachedMonths,
  };
}

// ---------------------------------------------------------------------------
// Cache

interface CachedMonth {
  fetchedAt: string;
  booked: Transaction[];
}

const cacheKey = (accountId: string, month: string) => `tx_cache:${accountId}:${month}`;
const indexKey = (accountId: string) => `tx_cache_index:${accountId}`;

export interface CacheIndex {
  months: string[];
  fetchedAt: string;
  earliest?: string;
  source: "longest" | "windowed";
}

export async function getCacheIndex(kv: KVNamespace, accountId: string): Promise<CacheIndex | null> {
  return (await kv.get(indexKey(accountId), "json")) as CacheIndex | null;
}

/** Store booked transactions per month. Months too large for one KV value are skipped. */
export async function writeHistoryCache(
  kv: KVNamespace,
  accountId: string,
  booked: Transaction[],
  source: CacheIndex["source"]
): Promise<CacheIndex> {
  const byMonth = new Map<string, Transaction[]>();
  for (const t of dedupe(booked)) {
    const d = txDate(t);
    if (!/^\d{4}-\d{2}/.test(d)) continue;
    const m = monthOf(d);
    (byMonth.get(m) || byMonth.set(m, []).get(m)!).push(t);
  }
  const fetchedAt = new Date().toISOString();
  const previous = await getCacheIndex(kv, accountId);
  const months: string[] = [];
  for (const [m, list] of byMonth) {
    const value = JSON.stringify({ fetchedAt, booked: list.sort(newestFirst) } satisfies CachedMonth);
    if (value.length > MAX_CACHE_VALUE_BYTES) {
      console.warn(`tx_cache ${accountId} ${m}: ${value.length} bytes, too large to cache`);
      continue;
    }
    await kv.put(cacheKey(accountId, m), value);
    months.push(m);
  }
  // Drop months from a previous cache that the new fetch didn't return.
  for (const m of previous?.months || []) {
    if (!months.includes(m)) await kv.delete(cacheKey(accountId, m));
  }
  months.sort();
  const index: CacheIndex = { months, fetchedAt, source, ...(months[0] ? { earliest: `${months[0]}-01` } : {}) };
  await kv.put(indexKey(accountId), JSON.stringify(index));
  return index;
}

export async function deleteHistoryCache(kv: KVNamespace, accountId: string): Promise<void> {
  const index = await getCacheIndex(kv, accountId);
  for (const m of index?.months || []) await kv.delete(cacheKey(accountId, m));
  await kv.delete(indexKey(accountId));
}

/**
 * Fetch full history for one account: strategy=longest first, then windowed
 * fetching (24 months back) if the bank rejects it.
 */
export async function backfillAccountHistory(
  kv: KVNamespace,
  client: HistoryClient,
  accountId: string,
  today = isoDate(new Date())
): Promise<CacheIndex> {
  try {
    const booked: Transaction[] = [];
    let key: string | undefined;
    const seen = new Set<string>();
    for (let i = 0; i < MAX_BACKFILL_PAGES; i++) {
      const page = await client.getTransactions(accountId, undefined, undefined, key, "longest");
      booked.push(...(page.transactions?.booked ?? []));
      key = page.continuation_key;
      if (!key || seen.has(key)) break;
      seen.add(key);
    }
    if (booked.length > 0) return await writeHistoryCache(kv, accountId, booked, "longest");
  } catch (error) {
    console.warn(`strategy=longest failed for ${accountId}, falling back to windows:`, error);
  }
  const from = `${monthOf(addDays(today, -FALLBACK_BACKFILL_MONTHS * 31))}-01`;
  const r = await fetchRangeWindowed(client, accountId, from, today, Number.MAX_SAFE_INTEGER);
  return await writeHistoryCache(kv, accountId, r.booked, "windowed");
}

/** Backfill every account of a session; errors are logged, never thrown. */
export async function backfillSessionHistory(
  kv: KVNamespace,
  client: HistoryClient,
  accountIds: string[]
): Promise<void> {
  for (const id of accountIds) {
    try {
      await backfillAccountHistory(kv, client, id);
    } catch (error) {
      console.error(`History backfill failed for ${id}:`, error);
    }
  }
}

/**
 * Transactions for [from, to]: dates older than CACHE_CUTOFF_DAYS come from the
 * cache where available (live windows otherwise); newer dates are fetched live.
 */
export async function getTransactionsWithHistory(
  kv: KVNamespace,
  client: HistoryClient,
  accountId: string,
  from: string,
  to: string,
  maxTransactions = DEFAULT_MAX_TRANSACTIONS,
  today = isoDate(new Date())
): Promise<FetchResult> {
  const cutoff = addDays(today, -CACHE_CUTOFF_DAYS);
  const index = from < cutoff ? await getCacheIndex(kv, accountId) : null;
  if (!index || index.months.length === 0) {
    return fetchRangeWindowed(client, accountId, from, to, maxTransactions);
  }

  const booked: Transaction[] = [];
  const pending: Transaction[] = [];
  const failedWindows: string[] = [];
  const cachedMonths: string[] = [];
  let truncated = false;

  // Live part: (cutoff, to]
  if (to > cutoff) {
    const live = await fetchRangeWindowed(client, accountId, from > cutoff ? from : addDays(cutoff, 1), to, maxTransactions);
    booked.push(...live.booked);
    pending.push(...live.pending);
    failedWindows.push(...live.failedWindows);
    truncated = live.truncated;
  }

  // Older part: [from, min(to, cutoff)], month by month, newest first.
  const oldTo = to < cutoff ? to : cutoff;
  if (!truncated && from <= oldTo) {
    for (const [a, b] of monthlyWindows(from, oldTo)) {
      if (dedupe(booked).length >= maxTransactions) {
        truncated = true;
        break;
      }
      const m = monthOf(a);
      const cached = index.months.includes(m)
        ? ((await kv.get(cacheKey(accountId, m), "json")) as CachedMonth | null)
        : null;
      if (cached) {
        booked.push(...cached.booked.filter((t) => txDate(t) >= a && txDate(t) <= b));
        cachedMonths.push(m);
      } else {
        const r = await fetchWindowWithRetry(client, accountId, a, b);
        booked.push(...r.booked);
        failedWindows.push(...r.failed);
      }
    }
  }
  return finalize(booked, pending, failedWindows, cachedMonths, maxTransactions, truncated);
}
