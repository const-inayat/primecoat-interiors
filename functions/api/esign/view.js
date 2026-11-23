import { json, TOKEN_RE, tokenKey } from '../../_lib.js';

// Public: the signing page asks for the document that belongs to its private link.
export async function onRequestGet({ env, params }) {
  const token = String(params.id || '');
  if (!TOKEN_RE.test(token)) return json({ error: 'This link is not valid.' }, 404);
  const rec = await env.KV.get(await tokenKey(token), { type: 'json' });
  if (!rec || (!rec.signed && rec.expiresAt < Date.now())) {
    return json({ error: 'This link is not valid or has expired. Please ask for a new one.' }, 404, { 'X-Robots-Tag': 'noindex' });
  }
  let snapshot = null;
  try { snapshot = JSON.parse(rec.snapshot); } catch (e) { return json({ error: 'This document could not be shown.' }, 500); }
  return json(
    { snapshot, signed: rec.signed ? { name: rec.signed.name, signedAt: rec.signed.signedAt } : null },
    200,
    { 'X-Robots-Tag': 'noindex' }
  );
}
