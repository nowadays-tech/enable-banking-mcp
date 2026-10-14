/**
 * Per-token bank connection scoping.
 *
 * OAuth token props carry `scopeGroups` (connection ids). Empty or absent means
 * "all connections", which is also how tokens issued before scoping existed behave.
 * A scoped token also carries a random `scopeKey`; connections added through
 * add_bank_connection by that token are appended under `scope_additions:<scopeKey>`
 * so they become visible to it without re-authorizing.
 */

export interface TokenProps {
  userId?: string;
  scopeGroups?: string[];
  scopeKey?: string;
}

export interface AccessScope {
  all: boolean;
  connectionIds: Set<string>;
  scopeKey?: string;
}

const ADDITIONS_PREFIX = "scope_additions:";

export const ALL_SCOPE: AccessScope = { all: true, connectionIds: new Set() };

export async function resolveScope(kv: KVNamespace, props?: TokenProps | null): Promise<AccessScope> {
  const groups = props?.scopeGroups;
  if (!Array.isArray(groups) || groups.length === 0) {
    return { all: true, connectionIds: new Set(), scopeKey: props?.scopeKey };
  }
  const ids = new Set(groups);
  if (props?.scopeKey) {
    const additions = (await kv.get(`${ADDITIONS_PREFIX}${props.scopeKey}`, "json")) as string[] | null;
    for (const id of additions || []) ids.add(id);
  }
  return { all: false, connectionIds: ids, scopeKey: props?.scopeKey };
}

export function inScope(scope: AccessScope, connectionId: string): boolean {
  return scope.all || scope.connectionIds.has(connectionId);
}

export function filterByScope<T extends { connectionId: string }>(scope: AccessScope, items: T[]): T[] {
  return scope.all ? items : items.filter((i) => scope.connectionIds.has(i.connectionId));
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
