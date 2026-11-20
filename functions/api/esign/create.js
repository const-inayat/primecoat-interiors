import { esignJson, apiKeyOk, rateOk, newToken, tokenKey } from '../../_lib.js';

const DAYS = 45;

// The billing app sends a copy of the quotation or invoice and gets back a private signing link.
export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await rateOk(env, 'esignkey:' + ip))) return esignJson({ error: 'Too many attempts. Wait a minute.' }, 429);
  if (!(await apiKeyOk(request, env))) {
    return esignJson({ error: 'The e-sign password does not match, or it is not set on your website yet.' }, 401);
  }

  let body = null;
  try { body = await request.json(); } catch (e) { return esignJson({ error: 'Bad request' }, 400); }
  const text = body && body.snapshot;
  if (typeof text !== 'string' || text.length < 20 || text.length > 450000) {
    return esignJson({ error: 'The document copy is missing or too large.' }, 400);
  }
  let snap = null;
  try { snap = JSON.parse(text); } catch (e) { return esignJson({ error: 'The document copy is not valid.' }, 400); }
  if (!snap || !snap.doc || typeof snap.doc.number !== 'string' || !Array.isArray(snap.items) || snap.items.length > 300 || !snap.totals) {
    return esignJson({ error: 'The document copy is not valid.' }, 400);
  }

  const token = newToken();
  const expiresAt = Date.now() + DAYS * 24 * 3600 * 1000;
  await env.KV.put(
    await tokenKey(token),
    JSON.stringify({ snapshot: text, createdAt: new Date().toISOString(), expiresAt, signed: null }),
    { expirationTtl: DAYS * 24 * 3600 + 3600 }
  );
  return esignJson({ token, link: new URL(request.url).origin + '/s/' + token, expiresAt: new Date(expiresAt).toISOString() });
}
