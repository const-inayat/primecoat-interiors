import { esignJson, apiKeyOk, rateOk, TOKEN_RE, tokenKey } from '../../_lib.js';

// The billing app asks whether a link has been signed, and collects the signature.
export async function onRequestGet({ request, env, params }) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await rateOk(env, 'esignkey:' + ip))) return esignJson({ error: 'Too many attempts. Wait a minute.' }, 429);
  if (!(await apiKeyOk(request, env))) return esignJson({ error: 'The e-sign password does not match.' }, 401);
  const token = String(params.id || '');
  if (!TOKEN_RE.test(token)) return esignJson({ error: 'Bad link' }, 400);

  const rec = await env.KV.get(await tokenKey(token), { type: 'json' });
  if (!rec) return esignJson({ error: 'This signing link was not found. It may have expired. Create a new link.' }, 404);
  if (!rec.signed) return esignJson({ signed: false });
  const s = rec.signed;
  return esignJson({ signed: true, name: s.name, signedAt: s.signedAt, ip: s.ip, userAgent: s.userAgent, hash: s.hash, signature: s.signature });
}
