import { json, csrfOk, CLEAR_COOKIE } from '../_lib.js';

export async function onRequestPost({ request }) {
  if (!csrfOk(request)) return json({ error: 'Bad request' }, 400);
  return json({ ok: true }, 200, { 'Set-Cookie': CLEAR_COOKIE });
}
