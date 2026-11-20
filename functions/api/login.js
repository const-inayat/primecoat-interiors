import { json, passwordOk, makeSessionCookie, csrfOk, configured } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  if (!csrfOk(request)) return json({ error: 'Bad request' }, 400);
  if (!configured(env)) {
    // Say exactly what is missing (never the values) so setup problems are easy to fix.
    const problems = [];
    if (!env.ADMIN_PASSWORD) problems.push('ADMIN_PASSWORD is missing');
    if (!env.SESSION_SECRET) problems.push('SESSION_SECRET is missing');
    else if (env.SESSION_SECRET.length < 24) problems.push('SESSION_SECRET is too short (it needs at least 24 characters)');
    return json({ error: 'Admin is not set up yet: ' + problems.join('; ') + '. Add them under Worker > Settings > Variables and Secrets, then redeploy.' }, 500);
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = 'fail:' + ip;
  let fails = 0;
  try {
    fails = Number(await env.KV.get(key)) || 0;
  } catch (e) { /* storage hiccup: carry on */ }
  if (fails >= 5) return json({ error: 'Too many wrong attempts. Try again in 15 minutes.' }, 429);

  let body = null;
  try { body = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }

  if (await passwordOk(env, body && body.password)) {
    return json({ ok: true }, 200, { 'Set-Cookie': await makeSessionCookie(env) });
  }
  try {
    await env.KV.put(key, String(fails + 1), { expirationTtl: 900 });
  } catch (e) { /* ignore */ }
  await new Promise((r) => setTimeout(r, 1200)); // slows down guessing
  return json({ error: 'Wrong password.' }, 401);
}
