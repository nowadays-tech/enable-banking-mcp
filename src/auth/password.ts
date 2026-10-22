import type { Env } from "../types";

/** Wrong passwords allowed per client IP before it is locked out. */
export const MAX_FAILED_ATTEMPTS = 10;
/** Lockout length; every further wrong password restarts it. */
export const LOCKOUT_SECONDS = 15 * 60;

export type PasswordCheck = "ok" | "wrong" | "throttled";

const encoder = new TextEncoder();

async function constantTimeCompare(a: string, b: string): Promise<boolean> {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    const dummy = encoder.encode("x".repeat(Math.max(aBytes.length, bBytes.length)));
    await crypto.subtle.timingSafeEqual(dummy, dummy);
    return false;
  }

  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

function failuresKey(request: Request): string {
  return `auth_failures:${request.headers.get("CF-Connecting-IP") || "unknown"}`;
}

/**
 * Compare a submitted password with AUTH_SECRET. Wrong passwords are counted per
 * client IP in KV; after MAX_FAILED_ATTEMPTS the IP gets "throttled" without the
 * password being checked, until LOCKOUT_SECONDS pass with no new attempt.
 */
export async function checkPassword(env: Env, request: Request, password: string): Promise<PasswordCheck> {
  const key = failuresKey(request);
  const failures = Number(await env.BANKING_KV.get(key)) || 0;
  if (failures >= MAX_FAILED_ATTEMPTS) return "throttled";
  if (await constantTimeCompare(password, env.AUTH_SECRET)) return "ok";
  await env.BANKING_KV.put(key, String(failures + 1), { expirationTtl: LOCKOUT_SECONDS });
  return "wrong";
}

export function passwordError(result: Exclude<PasswordCheck, "ok">): { message: string; status: number } {
  return result === "throttled"
    ? { message: "Too many wrong passwords. Try again in 15 minutes.", status: 429 }
    : { message: "Invalid password. Please try again.", status: 401 };
}
