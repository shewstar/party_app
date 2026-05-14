// Shared HMAC sign/verify for the party-pass cookie. Edge-compatible
// (uses Web Crypto, not node:crypto) so middleware can call it too.
//
// Token format: `<payload>.<signature>` where payload is one of
//   v1.<issuedAtSeconds>             — legacy, no identity binding
//   v2.<issuedAtSeconds>.<userId>    — device claimed a user; onboarding
//                                       refuses a second user from this cookie
// UUIDs don't contain dots, so splitting payload by "." is unambiguous.

const COOKIE_NAME = "party-pass";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

export const gateCookieName = COOKIE_NAME;
export const gateCookieMaxAge = COOKIE_MAX_AGE_SECONDS;

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export type GateClaims = {
  valid: boolean;
  userId: string | null;
  issuedAt: number | null;
};

export async function signGateToken(secret: string, userId?: string | null): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const payload = userId ? `v2.${ts}.${userId}` : `v1.${ts}`;
  const key = await hmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
  return `${payload}.${b64urlEncode(sig)}`;
}

export async function readGateClaims(token: string | undefined, secret: string): Promise<GateClaims> {
  const empty: GateClaims = { valid: false, userId: null, issuedAt: null };
  if (!token) return empty;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return empty;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!sig) return empty;
  let sigBytes: Uint8Array;
  try {
    sigBytes = b64urlDecode(sig);
  } catch {
    return empty;
  }
  const key = await hmacKey(secret);
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
  if (!timingSafeEqual(sigBytes, expected)) return empty;
  const parts = payload.split(".");
  if (parts[0] === "v1" && parts.length === 2) {
    return { valid: true, userId: null, issuedAt: parseInt(parts[1], 10) || null };
  }
  if (parts[0] === "v2" && parts.length === 3) {
    return { valid: true, userId: parts[2], issuedAt: parseInt(parts[1], 10) || null };
  }
  return empty;
}

export async function verifyGateToken(token: string | undefined, secret: string): Promise<boolean> {
  return (await readGateClaims(token, secret)).valid;
}

// Constant-time string equality for the password check.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  return timingSafeEqual(enc.encode(a), enc.encode(b));
}
