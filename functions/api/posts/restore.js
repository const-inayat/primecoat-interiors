import { json, guard, clean, ID_RE } from '../../_lib.js';

// Admin only: puts posts from a website backup back. Photos and videos are uploaded separately first.
// Posts that already exist (same id) are left alone, so restoring twice does no harm.
export async function onRequestPost({ request, env }) {
  const denied = await guard(request, env);
  if (denied) return denied;

  let body = null;
  try { body = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }
  const incoming = Array.isArray(body && body.posts) ? body.posts.slice(0, 2000) : [];
  if (!incoming.length) return json({ error: 'The backup has no posts in it.' }, 400);

  const cleanPosts = [];
  for (const p of incoming) {
    if (!p || !ID_RE.test(String(p.id)) || !clean(p.title, 120)) continue;
    const items = [];
    for (const it of Array.isArray(p.items) ? p.items.slice(0, 12) : []) {
      if (it && (it.type === 'image' || it.type === 'video') && ID_RE.test(String(it.id))) {
        items.push({ type: it.type, id: String(it.id), thumb: it.type === 'image' ? true : it.thumb === true });
      } else if (it && it.type === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(String(it.vid))) {
        items.push({ type: 'youtube', vid: String(it.vid) });
      }
    }
    if (!items.length) continue;
    const when = new Date(p.createdAt);
    cleanPosts.push({
      id: String(p.id),
      title: clean(p.title, 120),
      category: clean(p.category, 80),
      description: clean(p.description, 2000),
      location: clean(p.location, 120),
      createdAt: isNaN(when) ? new Date().toISOString() : when.toISOString(),
      items,
    });
  }
  if (!cleanPosts.length) return json({ error: 'None of the posts in the backup could be used.' }, 400);

  const all = (await env.KV.get('posts', { type: 'json' })) || [];
  const have = new Set(all.map((x) => x.id));
  let added = 0;
  for (const p of cleanPosts) {
    if (!have.has(p.id)) { all.push(p); have.add(p.id); added++; }
  }
  all.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  await env.KV.put('posts', JSON.stringify(all));
  return json({ ok: true, added, alreadyThere: cleanPosts.length - added });
}
