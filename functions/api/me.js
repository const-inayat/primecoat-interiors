import { json, isAdmin } from '../_lib.js';

export async function onRequestGet({ request, env }) {
  return (await isAdmin(request, env)) ? json({ ok: true }) : json({ ok: false }, 401);
}
