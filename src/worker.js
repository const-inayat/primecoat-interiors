// Entry point for the Cloudflare Worker. Static pages are served from /public;
// /api/* and /media/* are handled by the files in /functions.
import * as login from '../functions/api/login.js';
import * as logout from '../functions/api/logout.js';
import * as me from '../functions/api/me.js';
import * as posts from '../functions/api/posts/index.js';
import * as post from '../functions/api/posts/[id].js';
import * as upload from '../functions/api/upload/[id].js';
import * as media from '../functions/media/[id].js';

const ROUTES = [
  [/^\/api\/login$/, login],
  [/^\/api\/logout$/, logout],
  [/^\/api\/me$/, me],
  [/^\/api\/posts$/, posts],
  [/^\/api\/posts\/([^/]+)$/, post],
  [/^\/api\/upload\/([^/]+)$/, upload],
  [/^\/media\/([^/]+)$/, media],
];

const HANDLER = {
  GET: 'onRequestGet',
  POST: 'onRequestPost',
  PUT: 'onRequestPut',
  PATCH: 'onRequestPatch',
  DELETE: 'onRequestDelete',
};

function plain(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;

    // Setup check: open /api/status to see what the Worker can see (never shows any values).
    if (path === '/api/status' && request.method === 'GET') {
      return new Response(JSON.stringify({
        kv: Boolean(env.KV),
        adminPassword: Boolean(env.ADMIN_PASSWORD),
        sessionSecret: !env.SESSION_SECRET ? 'missing' : env.SESSION_SECRET.length < 24 ? 'too short' : 'ok',
      }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    }

    for (const [re, mod] of ROUTES) {
      const m = re.exec(path);
      if (!m) continue;

      if (!env.KV) {
        return plain(500, 'Storage is not connected. Check the KV binding in wrangler.jsonc (see the setup guide).');
      }
      const method = request.method === 'HEAD' ? 'GET' : request.method;
      const fn = mod[HANDLER[method]];
      if (!fn) return plain(405, 'Method not allowed');

      let id;
      try {
        id = m[1] ? decodeURIComponent(m[1]) : undefined;
      } catch (e) {
        return plain(404, 'Not found');
      }
      try {
        return await fn({ request, env, params: { id }, waitUntil: (p) => ctx.waitUntil(p) });
      } catch (e) {
        console.error('Handler error', e && e.stack ? e.stack : e);
        return plain(500, 'Server error. Please try again.');
      }
    }
    return env.ASSETS.fetch(request);
  },
};
