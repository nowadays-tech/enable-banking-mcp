import { describe, it, expect, vi, beforeEach } from "vitest";
import { timingSafeEqual } from "node:crypto";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {
    constructor(public ctx: unknown, public env: unknown) {}
  },
  env: {},
}));
// The real provider imports cloudflare:workers from node_modules, which vi.mock can't reach.
vi.mock("@cloudflare/workers-oauth-provider", () => ({
  OAuthProvider: class {},
  AuthorizationError: class extends Error {},
  CimdFetchError: class extends Error {},
}));

// Workers-only API; Node's webcrypto lacks it.
Object.assign(crypto.subtle, {
  timingSafeEqual: (a: ArrayBufferView, b: ArrayBufferView) =>
    timingSafeEqual(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), new Uint8Array(b.buffer, b.byteOffset, b.byteLength)),
});

const { DefaultHandler } = await import("../src/index");
const { EnableBankingClient } = await import("../src/enable-banking/client");
const { MAX_FAILED_ATTEMPTS } = await import("../src/auth/password");
import type { Env } from "../src/types";

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

const future = new Date(Date.now() + 60 * 86400000).toISOString();
const SECRET = "correct horse battery staple";

function setup() {
  const kv = mockKV({
    "web_session:good": JSON.stringify({ createdAt: 0 }),
    "session:default": JSON.stringify({
      sessionId: "s1", aspspId: "Danske Bank", aspspName: "Danske Bank", aspspCountry: "DK", consentValidUntil: future,
      accounts: [{ accountId: "p1" }], createdAt: future, updatedAt: future, label: "Stale label",
    }),
    connection_index: JSON.stringify({
      connections: [{ id: "default", label: "Privat", psuType: "personal", aspspName: "Danske Bank", aspspCountry: "DK", validUntil: future, createdAt: future }],
      updatedAt: future,
    }),
  });
  const oauth = {
    parseAuthRequest: vi.fn(async () => ({ clientId: "c1", scope: ["banking:read"] })),
    describeConsent: vi.fn(async () => ({ clientName: "Grok", scope: ["banking:read"] })),
    beginConsent: vi.fn(async () => ({ handle: "h1", headers: new Headers() })),
    listUserGrants: vi.fn(async () => ({ items: [] })),
  };
  const env = { BANKING_KV: kv, AUTH_SECRET: SECRET, OAUTH_PROVIDER: oauth } as unknown as Env;
  const handler = new (DefaultHandler as any)({ waitUntil() {} }, env) as InstanceType<typeof DefaultHandler>;
  return { kv, handler };
}

function post(path: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
  return new Request(`https://bank.example.dev${path}`, { method: "POST", body: new URLSearchParams(fields), headers });
}

const loggedIn = { Cookie: "session=good" };

describe("password throttle", () => {
  it(`locks an IP out of /login after ${MAX_FAILED_ATTEMPTS} wrong passwords, even for the right one`, async () => {
    const { handler, kv } = setup();
    const ip = { "CF-Connecting-IP": "203.0.113.9" };
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      expect((await handler.fetch(post("/login", { password: "guess" }, ip))).status).toBe(401);
    }
    const locked = await handler.fetch(post("/login", { password: SECRET }, ip));
    expect(locked.status).toBe(429);
    expect(await locked.text()).toContain("Too many wrong passwords");
    expect(kv.put).toHaveBeenLastCalledWith("auth_failures:203.0.113.9", String(MAX_FAILED_ATTEMPTS), { expirationTtl: 900 });

    const other = await handler.fetch(post("/login", { password: SECRET }, { "CF-Connecting-IP": "198.51.100.1" }));
    expect(other.status).toBe(302);
    expect(other.headers.get("Set-Cookie")).toMatch(/^session=/);
  });

  it("counts wrong passwords on the OAuth consent page against the same limit", async () => {
    const { handler } = setup();
    const ip = { "CF-Connecting-IP": "203.0.113.10" };
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await handler.fetch(post("/login", { password: "guess" }, ip));
    }
    const res = await handler.fetch(post("/authorize?client_id=c1", { handle: "h1", action: "login", password: SECRET }, ip));
    expect(res.status).toBe(429);
  });

  it("does not count a magic-link request as a wrong password", async () => {
    const { handler, kv } = setup();
    await handler.fetch(post("/login", { action: "magic" }));
    expect([...kv.store.keys()].some((k) => k.startsWith("auth_failures:"))).toBe(false);
  });

  it("only follows same-origin return paths after login", async () => {
    const { handler } = setup();
    const res = await handler.fetch(post("/login", { password: SECRET, return: "//evil.example" }));
    expect(res.headers.get("Location")).toBe("/setup");
  });
});

describe("route guard", () => {
  it("serves public pages without a session", async () => {
    const { handler } = setup();
    expect((await handler.fetch(new Request("https://bank.example.dev/privacy"))).status).toBe(200);
    expect((await handler.fetch(new Request("https://bank.example.dev/.well-known/mcp"))).status).toBe(200);
  });

  it("sends every other path to the login page, keeping the destination", async () => {
    const { handler } = setup();
    for (const path of ["/setup", "/renew/default", "/connect?token=t", "/some/new/route"]) {
      const res = await handler.fetch(new Request(`https://bank.example.dev${path}`));
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe(`https://bank.example.dev/login?return=${encodeURIComponent(path)}`);
    }
    const api = await handler.fetch(post("/api/credentials", { action: "delete" }));
    expect(api.status).toBe(401);
  });

  it("no longer serves the old setup page", async () => {
    const { handler } = setup();
    for (const path of ["/auth/start", "/bank/connect", "/api/banks?country=DK"]) {
      expect((await handler.fetch(new Request(`https://bank.example.dev${path}`, { headers: loggedIn }))).status).toBe(404);
    }
  });
});

describe("setup actions", () => {
  it("redirect to /setup with a one-time flash message", async () => {
    const { handler, kv } = setup();
    const res = await handler.fetch(post("/connections/rename", { connection_id: "default", label: "Personlig" }, loggedIn));
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("https://bank.example.dev/setup");
    const flash = res.headers.get("Set-Cookie")!.split(";")[0];
    expect(JSON.parse(kv.store.get("connection_index")!).connections[0].label).toBe("Personlig");

    const page = await handler.fetch(new Request("https://bank.example.dev/setup", { headers: { Cookie: `session=good; ${flash}` } }));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Renamed to &quot;Personlig&quot;");
    expect(page.headers.get("Set-Cookie")).toBe("flash=; Path=/; Max-Age=0");
  });
});

describe("renew", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("starts the bank approval with label and PSU type from the connection index", async () => {
    const { handler, kv } = setup();
    const startAuthorization = vi.fn(async () => ({ url: "https://bank.example/mitid" }));
    vi.spyOn(EnableBankingClient, "create").mockResolvedValue({ startAuthorization } as any);

    const res = await handler.fetch(new Request("https://bank.example.dev/renew/default", { headers: loggedIn }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://bank.example/mitid");
    expect(startAuthorization).toHaveBeenCalledWith("Danske Bank", "DK", "https://bank.example.dev/callback", "personal", expect.any(String));
    const pendingKey = [...kv.store.keys()].find((k) => k.startsWith("pending_auth:"))!;
    expect(JSON.parse(kv.store.get(pendingKey)!)).toMatchObject({ connectionId: "default", label: "Privat", isRenewal: true });
  });
});
