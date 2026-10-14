import type { BankAccount, BankSession } from "../types";
import type { AccountDetailsResponse, SessionStatusResponse } from "./client";

export interface RefreshClient {
  getSessionStatus(sessionId: string): Promise<SessionStatusResponse>;
  getAccountDetails(accountId: string): Promise<AccountDetailsResponse>;
}

export interface RefreshResult {
  session: BankSession;
  added: BankAccount[];
  removed: BankAccount[];
  /** False when the consent is no longer authorized (Renew needed). */
  authorized: boolean;
}

function uidsFrom(status: SessionStatusResponse): string[] {
  const raw = status.accounts?.length ? status.accounts : status.accounts_data || [];
  return raw
    .map((a) => (typeof a === "string" ? a : a?.uid))
    .filter((u): u is string => typeof u === "string" && u.length > 0);
}

/**
 * Re-read which accounts the bank consent covers and update the stored list.
 * The consent decides which accounts are visible: accounts opened or added at the
 * bank after the MitID approval only appear after a Renew (new approval).
 */
export async function refreshSessionAccounts(client: RefreshClient, session: BankSession): Promise<RefreshResult> {
  const status = await client.getSessionStatus(session.sessionId);
  if (status.status && status.status !== "AUTHORIZED") {
    return { session, added: [], removed: [], authorized: false };
  }
  const uids = uidsFrom(status);
  const known = new Map(session.accounts.map((a) => [a.accountId, a]));
  const accounts: BankAccount[] = [];
  const added: BankAccount[] = [];
  for (const uid of uids) {
    const existing = known.get(uid);
    let next: BankAccount = existing || { accountId: uid };
    try {
      const d = await client.getAccountDetails(uid);
      next = {
        accountId: uid,
        iban: d.account_id?.iban ?? existing?.iban,
        name: d.name ?? existing?.name,
        currency: d.currency ?? existing?.currency,
        accountType: d.cash_account_type ?? existing?.accountType,
      };
    } catch {
      // Keep what we had; details are best-effort.
    }
    accounts.push(next);
    if (!existing) added.push(next);
  }
  const seen = new Set(uids);
  const removed = session.accounts.filter((a) => !seen.has(a.accountId));
  return {
    session: {
      ...session,
      accounts,
      consentValidUntil: status.access?.valid_until || session.consentValidUntil,
      updatedAt: new Date().toISOString(),
    },
    added,
    removed,
    authorized: true,
  };
}

/** "•••• 4010" from an IBAN (or account number). */
export function maskIban(iban?: string): string {
  const clean = (iban || "").replace(/\s+/g, "");
  return clean.length >= 4 ? `•••• ${clean.slice(-4)}` : "";
}

/** Flash message after Refresh accounts. Unchanged lists explain that adding accounts needs Renew. */
export function refreshNotice(label: string, added: number, removed: number, total: number): string {
  if (added === 0 && removed === 0) {
    return `${label}: no new accounts. Your bank only shares the accounts you approved with MitID. To add accounts, use Renew and select them at your bank.`;
  }
  const parts = [];
  if (added) parts.push(`${added} new account${added === 1 ? "" : "s"}`);
  if (removed) parts.push(`${removed} removed`);
  return `${label}: ${parts.join(", ")}. ${total} account${total === 1 ? "" : "s"} now shared.`;
}
