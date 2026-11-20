import { json, csrfOk, clean, rateOk, sha256Hex, TOKEN_RE, tokenKey } from '../../_lib.js';

// Public: the client signs. One signature per link.
export async function onRequestPost({ request, env, params }) {
  if (!csrfOk(request)) return json({ error: 'Bad request' }, 400);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await rateOk(env, 'esignsign:' + ip))) return json({ error: 'Too many attempts. Please wait a minute and try again.' }, 429);

  const token = String(params.id || '');
  if (!TOKEN_RE.test(token)) return json({ error: 'This link is not valid.' }, 404);
  let b = null;
  try { b = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }

  const name = clean(b.name, 100);
  const sig = String(b.signature || '');
  if (name.length < 2) return json({ error: 'Please type your full name.' }, 400);
  if (b.consent !== true) return json({ error: 'Please tick the box to agree.' }, 400);
  if (!sig.startsWith('data:image/png;base64,') || sig.length < 800 || sig.length > 350000) {
    return json({ error: 'Please draw your signature in the box.' }, 400);
  }
  let head = '';
  try { head = atob(sig.slice(22, 22 + 16)); } catch (e) { return json({ error: 'The signature picture is not valid.' }, 400); }
  if (head.charCodeAt(0) !== 0x89 || head.slice(1, 4) !== 'PNG') return json({ error: 'The signature picture is not valid.' }, 400);

  const key = await tokenKey(token);
  const rec = await env.KV.get(key, { type: 'json' });
  if (!rec) return json({ error: 'This link is not valid or has expired.' }, 404);
  if (rec.signed) return json({ error: 'This document has already been signed.' }, 409);
  if (rec.expiresAt < Date.now()) return json({ error: 'This link has expired. Please ask for a new one.' }, 410);

  rec.signed = {
    name,
    signedAt: new Date().toISOString(),
    ip,
    userAgent: clean(request.headers.get('User-Agent'), 300),
    signature: sig,
    hash: await sha256Hex(rec.snapshot),
  };
  // keep the signed record for 60 days so the billing app can collect it
  await env.KV.put(key, JSON.stringify(rec), { expirationTtl: 60 * 24 * 3600 });
  return json({ ok: true });
}
