import { describe, it, expect, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ DurableObject: class {}, WorkerEntrypoint: class {}, env: {} }));

const { createMcpHandler } = await import("agents/mcp/server");
const { McpServer } = await import("@modelcontextprotocol/server");

// Mirrors MCP_HANDLER_OPTIONS in src/index.ts (imported indirectly would pull Worker-only modules).
const OPTIONS = { allowedOriginHostnames: "*" as const, corsOptions: { origin: "*" } };

const initBody = JSON.stringify({
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
});

function req(host: string, origin?: string) {
  const headers: Record<string, string> = {
    host, "content-type": "application/json",
    accept: "application/json, text/event-stream",
    authorization: "Bearer test-token",
  };
  if (origin) headers.origin = origin;
  return new Request(`https://${host}/mcp`, { method: "POST", headers, body: initBody });
}

const factory = () => new McpServer({ name: "test", version: "1.0.0" });
const ctx = { waitUntil() {}, passThroughOnException() {} } as any;

describe("MCP handler host/origin validation", () => {
  it("does not return 403 Invalid Host on a workers.dev hostname", async () => {
    const res = await createMcpHandler(factory as any, OPTIONS)(req("enable-banking-mcp.example.workers.dev"), {} as any, ctx);
    expect(res.status).not.toBe(403);
  });
  it("accepts a non-browser Origin header", async () => {
    const res = await createMcpHandler(factory as any, OPTIONS)(req("enable-banking-mcp.example.workers.dev", "https://www.cursor.com"), {} as any, ctx);
    expect(res.status).not.toBe(403);
  });
  it("regression: allowedHostnames ['*'] rejects every host", async () => {
    const res = await createMcpHandler(factory as any, { ...OPTIONS, allowedHostnames: ["*"] })(req("enable-banking-mcp.example.workers.dev"), {} as any, ctx);
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("Invalid Host");
  });
});
