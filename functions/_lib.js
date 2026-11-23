// Shared helpers for the PrimeCoat API (Cloudflare Pages Functions).
// Gallery categories: edit this list to add or rename categories.
export const CATEGORIES = [
  'Interior Painting',
  'Exterior Painting',
  'Texture & Decorative',
  'Murals & Wall Art',
  'Metallic & Special Finish',
  'Putty & Wall Prep',
  'Construction Sites',
];

export const ID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const enc = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

export function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export function configured(env) {
  return Boolean(env.ADMIN_PASSWORD) && Boolean(env.SESSION_SECRET) && env.SESSION_SECRET.length >= 24;
}

export async function passwordOk(env, given) {
  // Compare SHA-256 digests so the comparison does not leak the password length.
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(given == null ? '' : given))),
    crypto.subtle.digest('SHA-256', enc.encode(String(env.ADMIN_PASSWORD || ''))),
  ]);
  return Boolean(env.ADMIN_PASSWORD) && safeEqual(hex(a), hex(b));
}

export const SESSION_SECONDS = 12 * 3600;

export async function makeSessionCookie(env) {
  const exp = Date.now() + SESSION_SECONDS * 1000;
  const sig = await hmac(env.SESSION_SECRET, 'sess.' + exp);
  return `pc_admin=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export const CLEAR_COOKIE = 'pc_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';

export async function isAdmin(request, env) {
  if (!configured(env)) return false;
  const m = /(?:^|;\s*)pc_admin=(\d+)\.([a-f0-9]{64})/.exec(request.headers.get('Cookie') || '');
  if (!m) return false;
  if (Number(m[1]) < Date.now()) return false;
  return safeEqual(m[2], await hmac(env.SESSION_SECRET, 'sess.' + m[1]));
}

// Browsers cannot add this header from another website without permission, which blocks cross-site forgery.
export function csrfOk(request) {
  if (request.headers.get('X-Requested-With') !== 'primecoat') return false;
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return false;
    } catch (e) {
      return false;
    }
  }
  return true;
}

/** Returns an error Response if the caller is not a logged-in admin, otherwise null. */
export async function guard(request, env) {
  if (!csrfOk(request)) return json({ error: 'Bad request' }, 400);
  if (!(await isAdmin(request, env))) return json({ error: 'Please log in again.' }, 401);
  return null;
}

export function youtubeId(url) {
  try {
    const u = new URL(url);
    let id = '';
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    else if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      id = u.searchParams.get('v') || ((u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/) || [])[2] || '');
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch (e) {
    return null;
  }
}

// ---------- e-sign (quotations and invoices signed through a private link) ----------

// The billing app runs on your own computer and calls these endpoints from the browser.
export const ESIGN_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Storage key for a signing link. Only a hash of the token is used, never the token itself. */
export async function tokenKey(token) {
  return 'esign:' + hex(await crypto.subtle.digest('SHA-256', enc.encode(token)));
}

export async function sha256Hex(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

/** True when the request carries the e-sign password you set as ESIGN_API_KEY. */
export async function apiKeyOk(request, env) {
  const key = env.ESIGN_API_KEY;
  if (!key || key.length < 24) return false;
  const given = request.headers.get('X-Api-Key') || '';
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(key)),
  ]);
  return safeEqual(hex(a), hex(b));
}

export function esignJson(data, status = 200, extra = {}) {
  return json(data, status, { ...ESIGN_CORS, ...extra });
}

/** Free Cloudflare rate limiter, if it is set up in wrangler.jsonc. Never blocks when it is missing. */
export async function rateOk(env, key) {
  if (!env.LOGIN_LIMIT) return true;
  try {
    const { success } = await env.LOGIN_LIMIT.limit({ key });
    return success;
  } catch (e) {
    return true;
  }
}
