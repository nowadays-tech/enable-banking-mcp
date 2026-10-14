import { describe, it, expect, vi } from "vitest";
import { renderWizardPage } from "../src/ui/pages";
import { listMcpClients, describeClientScope } from "../src/mcp-clients";

const day = 86400000;
const connections = [
  { id: "default", label: "Privat", aspspName: "Danske Bank", aspspCountry: "DK", psuType: "personal" as const, accountCount: 6, validUntil: new Date(Date.now() + 88 * day).toISOString() },
  { id: "conn_hold", label: "Holm & Friis Holding", aspspName: "Nordea", aspspCountry: "DK", psuType: "business" as const, accountCount: 2, validUntil: new Date(Date.now() + 9 * day).toISOString() },
];
const base = { hasCredentials: true, credentialsFromEnv: false, appId: "app_1", hasBankSession: true, connections };

describe("setup overview", () => {
  it("separates bank connections from MCP clients", () => {
    const html = renderWizardPage("https://x.dev", {
      ...base,
      clients: [
        { grantId: "g1", clientId: "c1", clientName: "Grok", connectedAt: Date.now(), scope: "all" },
        { grantId: "g2", clientId: "c2", clientName: "Grok (business)", connectedAt: Date.now(), scope: ["conn_hold", "gone"] },
      ],
    }, ["DK"]);
    const banksAt = html.indexOf("Bank connections");
    const clientsAt = html.indexOf("MCP clients");
    expect(banksAt).toBeGreaterThan(-1);
    expect(clientsAt).toBeGreaterThan(banksAt);
    expect(html).toContain("Banks you&#039;ve approved with MitID. Each is one bank login.");
    expect(html).toContain("Adding a client doesn&#039;t add a bank.");
    expect(html).toContain("https://x.dev/mcp");
    expect(html).toContain("Holm &amp; Friis Holding");
    expect(html).toContain("All banks");
    expect(html).toContain("Removed bank");
    expect(html).toContain('name="grant_id" value="g2"');
    expect(html).toContain('action="/connections/new"');
    expect(html).toContain("Expires in 9d");
    expect(html).toContain("Danger zone");
  });

  it("shows an empty state and a warning when clients can't be loaded", () => {
    expect(renderWizardPage("https://x.dev", { ...base, clients: [] }, ["DK"])).toContain("No apps connected yet");
    expect(renderWizardPage("https://x.dev", { ...base, clientsUnavailable: true }, ["DK"])).toContain("Couldn&#039;t load clients");
  });

  it("keeps the step wizard while setup is incomplete", () => {
    const html = renderWizardPage("https://x.dev", { ...base, hasBankSession: false, connections: [], clients: [] }, ["DK"]);
    expect(html).not.toContain("MCP clients");
  });
});

describe("listMcpClients", () => {
  it("joins grants with client names and reads scope from metadata", async () => {
    const helpers = {
      listUserGrants: vi.fn()
        .mockResolvedValueOnce({ items: [{ id: "g1", clientId: "c1", userId: "owner", scope: [], metadata: { scopeGroups: "all" }, createdAt: 1 }], cursor: "n" })
        .mockResolvedValueOnce({ items: [{ id: "g2", clientId: "c1", userId: "owner", scope: [], metadata: { scopeGroups: ["conn_hold"] }, createdAt: 2 }] }),
      lookupClient: vi.fn().mockResolvedValue({ clientId: "c1", clientName: "Grok", redirectUris: [] }),
    };
    const out = await listMcpClients(helpers as any);
    expect(helpers.listUserGrants).toHaveBeenCalledWith("owner", expect.anything());
    expect(helpers.lookupClient).toHaveBeenCalledTimes(1);
    expect(out.map((c) => c.grantId)).toEqual(["g2", "g1"]);
    expect(out[0].scope).toEqual(["conn_hold"]);
    expect(out[1].scope).toBe("all");
    expect(describeClientScope(out[0].scope, connections).labels).toEqual(["Holm & Friis Holding"]);
  });
});
