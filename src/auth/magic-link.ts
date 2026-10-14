import type { Env } from "../types";

export const MAGIC_LINK_TTL_SECONDS = 900; // 15 minutes
const RATE_LIMIT_SECONDS = 60;
export const DEFAULT_MAGIC_LINK_FROM = "Enable Banking MCP <bank@updates.lab.nowadays.tech>";

export interface MagicLinkData {
  email: string;
  returnTo: string;
  createdAt: number;
}

/** Magic-link login is offered only when both the Resend key and the owner email are configured. */
export function magicLinkEnabled(env: Pick<Env, "RESEND_API_KEY" | "OWNER_EMAIL">): boolean {
  return Boolean(env.RESEND_API_KEY && env.OWNER_EMAIL);
}

/** Only same-origin relative paths are allowed as post-login destinations. */
export function safeReturnPath(returnTo: string | null | undefined, fallback = "/setup"): string {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.startsWith("/\\")) {
    return fallback;
  }
  return returnTo;
}

export async function createMagicLink(kv: KVNamespace, email: string, returnTo: string): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const data: MagicLinkData = { email, returnTo: safeReturnPath(returnTo), createdAt: Date.now() };
  await kv.put(`magic_link:${token}`, JSON.stringify(data), { expirationTtl: MAGIC_LINK_TTL_SECONDS });
  return token;
}

/** Returns the link data if valid and not yet used, and deletes it (one-time use). */
export async function consumeMagicLink(kv: KVNamespace, token: string): Promise<MagicLinkData | null> {
  if (!token) return null;
  const key = `magic_link:${token}`;
  const data = (await kv.get(key, "json")) as MagicLinkData | null;
  if (!data) return null;
  await kv.delete(key);
  if (Date.now() - data.createdAt > MAGIC_LINK_TTL_SECONDS * 1000) return null;
  return data;
}

export async function peekMagicLink(kv: KVNamespace, token: string): Promise<boolean> {
  if (!token) return false;
  return (await kv.get(`magic_link:${token}`)) !== null;
}

/**
 * Create a link and email it to OWNER_EMAIL. The address is never taken from the
 * request, so the endpoint cannot be used to mail arbitrary people. Rate limited
 * to one email per minute; returns "rate_limited" without sending in that case.
 */
export async function sendMagicLink(
  env: Env,
  baseUrl: string,
  returnTo: string,
  fetchImpl: typeof fetch = fetch
): Promise<"sent" | "rate_limited" | "disabled"> {
  if (!magicLinkEnabled(env)) return "disabled";
  const rateKey = "magic_link_rate";
  if (await env.BANKING_KV.get(rateKey)) return "rate_limited";
  await env.BANKING_KV.put(rateKey, "1", { expirationTtl: RATE_LIMIT_SECONDS });

  const email = env.OWNER_EMAIL!;
  const token = await createMagicLink(env.BANKING_KV, email, returnTo);
  const link = `${baseUrl}/auth/magic?token=${encodeURIComponent(token)}`;
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAGIC_LINK_FROM || DEFAULT_MAGIC_LINK_FROM,
      to: [email],
      subject: "Your Enable Banking MCP login link",
      text: `Log in to your Enable Banking MCP server:\n\n${link}\n\nThe link works once and expires in 15 minutes. If you didn't request it, ignore this email.`,
      html: `<p>Log in to your Enable Banking MCP server:</p><p><a href="${link}">Log in</a></p><p style="color:#666;font-size:13px">The link works once and expires in 15 minutes. If you didn't request it, ignore this email.</p>`,
    }),
  });
  if (!res.ok) {
    console.error("Resend send failed:", res.status);
    throw new Error(`Failed to send login email (${res.status})`);
  }
  return "sent";
}
