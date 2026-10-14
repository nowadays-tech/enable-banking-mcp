/**
 * Per-token bank connection scoping.
 *
 * OAuth token props carry `scopeGroups` (connection ids). Empty or absent means
 * "all connections", which is also how tokens issued before scoping existed behave.
 * A scoped token also carries a random `scopeKey`; connections added through
 * add_bank_connection by that token are appended under `scope_additions:<scopeKey>`
 * so they become visible to it without re-authorizing.
 *
 * The owner can edit an app's access on /setup. That is stored server-side as
 * `client_scope:<grantId>` and takes precedence over the token props, so it applies
 * to the app's existing tokens immediately (grants from before scoping included).
 * While an override is scoped, banks the app adds itself are recorded under
 * `scope_additions:grant:<grantId>`.
 */

export interface TokenProps {
  userId?: string;
  scopeGroups?: string[];
  scopeKey?: string;
}

export interface AccessScope {
  all: boolean;
  connectionIds: Set<string>;
  /** Key for scope_additions when this token adds a bank. */
  scopeKey?: string;
  grantId?: string;
  /** True when an owner-set override from /setup is in effect. */
  overridden?: boolean;
  /** Per-connection account allowlist; connections not listed expose all their accounts. */
  accountIds?: Map<string, Set<string>>;
}

/** Owner-set access for one grant. */
export type ClientScopeOverride =
  | { all: true }
  | {
      all: false;
      connectionIds: string[];
      /** Optional account allowlist per connection id (subset of that bank's accounts). */
      accountIds?: Record<string, string[]>;
    };

const ADDITIONS_PREFIX = "scope_additions:";
const OVERRIDE_PREFIX = "client_scope:";

/** Grant id from an OAuth access token (`userId:grantId:secret`), else undefined. */
export function grantIdFromAuthHeader(header: string | null | undefined): string | undefined {
  const m = /^Bearer\s+(.+)$/i.exec(header?.trim() || "");
  const parts = m?.[1].split(":");
  return parts && parts.length === 3 && parts[1] ? parts[1] : undefined;
}

export async function getClientScopeOverride(kv: KVNamespace, grantId: string): Promise<ClientScopeOverride | null> {
  const v = (await kv.get(`${OVERRIDE_PREFIX}${grantId}`, "json")) as ClientScopeOverride | null;
  if (!v) return null;
  if (v.all) return { all: true };
  const out: ClientScopeOverride = {
    all: false,
    connectionIds: Array.isArray(v.connectionIds) ? v.connectionIds.map(String) : [],
  };
  if (v.accountIds && typeof v.accountIds === "object") {
    const acc: Record<string, string[]> = {};
    for (const [cid, ids] of Object.entries(v.accountIds)) {
      if (Array.isArray(ids) && ids.length > 0) acc[cid] = ids.map(String);
    }
    if (Object.keys(acc).length > 0) out.accountIds = acc;
  }
  return out;
}

export async function setClientScopeOverride(kv: KVNamespace, grantId: string, override: ClientScopeOverride): Promise<void> {
  await kv.put(`${OVERRIDE_PREFIX}${grantId}`, JSON.stringify(override));
  // The owner's explicit choice replaces banks the app added since the last edit.
  await kv.delete(`${ADDITIONS_PREFIX}grant:${grantId}`);
}

export async function deleteClientScopeOverride(kv: KVNamespace, grantId: string): Promise<void> {
  await kv.delete(`${OVERRIDE_PREFIX}${grantId}`);
  await kv.delete(`${ADDITIONS_PREFIX}grant:${grantId}`);
}

export const ALL_SCOPE: AccessScope = { all: true, connectionIds: new Set() };

export async function resolveScope(
  kv: KVNamespace,
  props?: TokenProps | null,
  grantId?: string
): Promise<AccessScope> {
  if (grantId) {
    const override = await getClientScopeOverride(kv, grantId);
    if (override) {
      if (override.all) return { all: true, connectionIds: new Set(), grantId, overridden: true };
      const scopeKey = `grant:${grantId}`;
      const ids = new Set(override.connectionIds);
      const additions = (await kv.get(`${ADDITIONS_PREFIX}${scopeKey}`, "json")) as string[] | null;
      for (const id of additions || []) ids.add(id);
      const accountIds = override.accountIds
        ? new Map(Object.entries(override.accountIds).map(([cid, a]) => [cid, new Set(a)]))
        : undefined;
      return { all: false, connectionIds: ids, scopeKey, grantId, overridden: true, ...(accountIds ? { accountIds } : {}) };
    }
  }
  const groups = props?.scopeGroups;
  if (!Array.isArray(groups) || groups.length === 0) {
    return { all: true, connectionIds: new Set(), scopeKey: props?.scopeKey, grantId };
  }
  const ids = new Set(groups);
  if (props?.scopeKey) {
    const additions = (await kv.get(`${ADDITIONS_PREFIX}${props.scopeKey}`, "json")) as string[] | null;
    for (const id of additions || []) ids.add(id);
  }
  return { all: false, connectionIds: ids, scopeKey: props?.scopeKey, grantId };
}

export function inScope(scope: AccessScope, connectionId: string): boolean {
  return scope.all || scope.connectionIds.has(connectionId);
}

export function filterByScope<T extends { connectionId: string }>(scope: AccessScope, items: T[]): T[] {
  return scope.all ? items : items.filter((i) => scope.connectionIds.has(i.connectionId));
}

/** Drop accounts outside a per-account allowlist. Sessions without an allowlist keep all accounts. */
export function filterAccountsByScope<T extends { connectionId: string; accounts: { accountId: string }[] }>(
  scope: AccessScope,
  sessions: T[]
): T[] {
  if (scope.all || !scope.accountIds) return sessions;
  return sessions.map((s) => {
    const allowed = scope.accountIds!.get(s.connectionId);
    return allowed ? { ...s, accounts: s.accounts.filter((a) => allowed.has(a.accountId)) } : s;
  });
}

/**
 * Parse the /setup access editor. A ticked bank means all its accounts (including
 * new ones); ticking only some accounts of a bank restricts the app to those.
 * Returns null when nothing valid was selected.
 */
export function parseScopeForm(
  form: { allBanks: boolean; connections: string[]; accounts: string[] },
  sessions: { connectionId: string; accounts: { accountId: string }[] }[]
): ClientScopeOverride | null {
  if (form.allBanks) return { all: true };
  const byId = new Map(sessions.map((s) => [s.connectionId, new Set(s.accounts.map((a) => a.accountId))]));
  const whole = new Set(form.connections.filter((id) => byId.has(id)));
  const partial: Record<string, string[]> = {};
  for (const entry of form.accounts) {
    const sep = entry.indexOf("|");
    if (sep < 0) continue;
    const cid = entry.slice(0, sep);
    const aid = entry.slice(sep + 1);
    if (whole.has(cid) || !byId.get(cid)?.has(aid)) continue;
    (partial[cid] ||= []).includes(aid) || partial[cid].push(aid);
  }
  // Every account of a bank ticked individually is the same as the whole bank.
  for (const [cid, ids] of Object.entries(partial)) {
    if (ids.length === byId.get(cid)!.size) {
      whole.add(cid);
      delete partial[cid];
    }
  }
  const connectionIds = [...whole, ...Object.keys(partial)];
  if (connectionIds.length === 0) return null;
  return Object.keys(partial).length > 0
    ? { all: false, connectionIds, accountIds: partial }
    : { all: false, connectionIds };
}

export async function addToScope(kv: KVNamespace, scopeKey: string, connectionId: string): Promise<void> {
  const key = `${ADDITIONS_PREFIX}${scopeKey}`;
  const existing = ((await kv.get(key, "json")) as string[] | null) || [];
  if (existing.includes(connectionId)) return;
  await kv.put(key, JSON.stringify([...existing, connectionId]));
}

/**
 * Build token props from the consent-page selection. Selecting every existing
 * connection (or there being none) means "all", so future banks are included too.
 */
export function buildScopeProps(
  userId: string,
  selectedIds: string[],
  allIds: string[],
  newScopeKey: () => string = () => crypto.randomUUID()
): TokenProps {
  const selected = [...new Set(selectedIds)].filter((id) => allIds.includes(id));
  if (allIds.length === 0 || allIds.every((id) => selected.includes(id))) {
    return { userId };
  }
  return { userId, scopeGroups: selected, scopeKey: newScopeKey() };
}
