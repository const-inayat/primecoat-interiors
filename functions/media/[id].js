import { ID_RE } from '../_lib.js';

// Public: serves photos and videos stored in KV (with video seeking support).
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const raw = String(params.id || '');
  const isThumb = raw.startsWith('t-');
  const id = isThumb ? raw.slice(2) : raw;
  if (!ID_RE.test(id)) return new Response('Not found', { status: 404 });

  const range = request.headers.get('Range');
  let cache = null;
  try { cache = caches.default; } catch (e) { /* not available */ }
  if (cache && !range) {
    try {
      const hit = await cache.match(request.url);
      if (hit) return hit;
    } catch (e) { /* ignore */ }
  }

  const { value, metadata } = await env.KV.getWithMetadata((isThumb ? 'thumb:' : 'media:') + id, 'arrayBuffer');
  if (!value) return new Response('Not found', { status: 404 });

  const total = value.byteLength;
  const headers = {
    'Content-Type': (metadata && metadata.type) || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  };

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m && (m[1] !== '' || m[2] !== '')) {
      let start;
      let end;
      if (m[1] === '') {
        start = Math.max(0, total - Number(m[2]));
        end = total - 1;
      } else {
        start = Number(m[1]);
        end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
      }
      if (start > end || start >= total) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
      }
      return new Response(value.slice(start, end + 1), {
        status: 206,
        headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}` },
      });
    }
  }

  const res = new Response(value, { headers });
  if (cache && total < 5 * 1024 * 1024) {
    try { context.waitUntil(cache.put(request.url, res.clone())); } catch (e) { /* ignore */ }
  }
  return res;
}
