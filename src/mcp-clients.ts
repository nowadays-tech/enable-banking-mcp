import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

/** The single user id every consent grant is created under. */
export const OWNER_USER_ID = "owner";

export interface McpClientView {
  grantId: string;
  clientId: string;
  clientName: string;
  clientUri?: string;
  connectedAt: number;
  /** "all" or the connection ids the grant is scoped to. */
  scope: "all" | string[];
}

function scopeFromMetadata(metadata: unknown): "all" | string[] {
  const groups = (metadata as { scopeGroups?: unknown } | null)?.scopeGroups;
  if (Array.isArray(groups) && groups.length > 0) return groups.map(String);
  return "all";
}

/** Lists authorized MCP clients (OAuth grants) for the owner, newest first. */
export async function listMcpClients(helpers: OAuthHelpers, userId = OWNER_USER_ID): Promise<McpClientView[]> {
  const grants = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res = await helpers.listUserGrants(userId, { cursor, limit: 100 });
    grants.push(...res.items);
    cursor = res.cursor;
    if (!cursor) break;
  }
  const clientCache = new Map<string, Awaited<ReturnType<OAuthHelpers["lookupClient"]>>>();
  const views: McpClientView[] = [];
  for (const g of grants) {
    if (!clientCache.has(g.clientId)) {
      clientCache.set(g.clientId, await helpers.lookupClient(g.clientId).catch(() => null));
    }
    const client = clientCache.get(g.clientId);
    views.push({
      grantId: g.id,
      clientId: g.clientId,
      clientName: client?.clientName || "Unnamed client",
      clientUri: client?.clientUri,
      connectedAt: g.createdAt,
      scope: scopeFromMetadata(g.metadata),
    });
  }
  return views.sort((a, b) => b.connectedAt - a.connectedAt);
}

/** Human-readable bank list for a grant scope. */
export function describeClientScope(
  scope: "all" | string[],
  connections: { id: string; label: string }[]
): { all: boolean; labels: string[] } {
  if (scope === "all") return { all: true, labels: [] };
  const labels = scope.map((id) => connections.find((c) => c.id === id)?.label ?? "Removed bank");
  return { all: false, labels };
}
