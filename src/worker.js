// Entry point for the Cloudflare Worker. Static pages are served from /public;
// /api/* and /media/* are handled by the files in /functions.
import * as login from '../functions/api/login.js';
import * as logout from '../functions/api/logout.js';
import * as me from '../functions/api/me.js';
import * as posts from '../functions/api/posts/index.js';
import * as postsRestore from '../functions/api/posts/restore.js';
import * as post from '../functions/api/posts/[id].js';
import * as upload from '../functions/api/upload/[id].js';
import * as media from '../functions/media/[id].js';
import * as esignPing from '../functions/api/esign/ping.js';
import * as esignCreate from '../functions/api/esign/create.js';
import * as esignStatus from '../functions/api/esign/status.js';
import * as esignView from '../functions/api/esign/view.js';
import * as esignSign from '../functions/api/esign/sign.js';
import { ESIGN_CORS } from '../functions/_lib.js';

const ROUTES = [
  [/^\/api\/login$/, login],
  [/^\/api\/logout$/, logout],
  [/^\/api\/me$/, me],
  [/^\/api\/posts$/, posts],
  [/^\/api\/posts\/restore$/, postsRestore],
  [/^\/api\/posts\/([^/]+)$/, post],
  [/^\/api\/upload\/([^/]+)$/, upload],
  [/^\/media\/([^/]+)$/, media],
  [/^\/api\/esign\/ping$/, esignPing],
  [/^\/api\/esign\/create$/, esignCreate],
  [/^\/api\/esign\/status\/([^/]+)$/, esignStatus],
  [/^\/api\/esign\/view\/([^/]+)$/, esignView],
  [/^\/api\/esign\/sign\/([^/]+)$/, esignSign],
];

const HANDLER = {
  GET: 'onRequestGet',
  POST: 'onRequestPost',
  PUT: 'onRequestPut',
  PATCH: 'onRequestPatch',
  DELETE: 'onRequestDelete',
};

function plain(status, error, path) {
  // e-sign replies also carry CORS headers, so the billing app can read even an error message
  const cors = path && path.startsWith('/api/esign/') ? ESIGN_CORS : {};
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;

    // The billing app (on your computer) calls the e-sign endpoints from the browser, which first asks permission.
    if (request.method === 'OPTIONS' && path.startsWith('/api/esign/')) {
      return new Response(null, { status: 204, headers: ESIGN_CORS });
    }

    // The private signing page: /s/<link>
    const page = /^\/s\/[A-Za-z0-9_-]{43}$/.exec(path);
    if (page && (request.method === 'GET' || request.method === 'HEAD')) {
      let res = await env.ASSETS.fetch(new Request(new URL('/sign', request.url).toString(), { method: 'GET' }));
      for (let i = 0; i < 2 && res.status >= 300 && res.status < 400 && res.headers.get('Location'); i++) {
        res = await env.ASSETS.fetch(new Request(new URL(res.headers.get('Location'), request.url).toString(), { method: 'GET' }));
      }
      const out = new Response(res.body, res);
      out.headers.set('Cache-Control', 'no-store');
      out.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return out;
    }

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
        return plain(500, 'Storage is not connected. Check the KV binding in wrangler.jsonc (see the setup guide).', path);
      }
      const method = request.method === 'HEAD' ? 'GET' : request.method;
      const fn = mod[HANDLER[method]];
      if (!fn) return plain(405, 'Method not allowed', path);

      let id;
      try {
        id = m[1] ? decodeURIComponent(m[1]) : undefined;
      } catch (e) {
        return plain(404, 'Not found', path);
      }
      try {
        return await fn({ request, env, params: { id }, waitUntil: (p) => ctx.waitUntil(p) });
      } catch (e) {
        console.error('Handler error', e && e.stack ? e.stack : e);
        return plain(500, 'Server error. Please try again.', path);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
