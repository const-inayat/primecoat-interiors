import { json, guard, isAdmin, clean, youtubeId, CATEGORIES, ID_RE } from '../../_lib.js';

// Public: list posts, newest first, optionally one category.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const category = clean(url.searchParams.get('category') || '', 80);
  const page = Math.max(0, Math.min(parseInt(url.searchParams.get('page') || '0', 10) || 0, 200));
  const size = Math.max(1, Math.min(parseInt(url.searchParams.get('size') || '12', 10) || 12, 48));

  const fresh = url.searchParams.get('fresh') === '1' && (await isAdmin(request, env));
  const all = (await env.KV.get('posts', fresh ? { type: 'json' } : { type: 'json', cacheTtl: 30 })) || [];
  const categories = [...new Set(all.map((p) => p.category))].sort();
  const list = category ? all.filter((p) => p.category === category) : all;

  return json(
    { posts: list.slice(page * size, page * size + size), categories, allCategories: CATEGORIES, total: list.length, page, size },
    200,
    { 'Cache-Control': fresh ? 'no-store' : 'public, max-age=30' }
  );
}

// Admin: publish a new post.
export async function onRequestPost({ request, env }) {
  const denied = await guard(request, env);
  if (denied) return denied;

  let b = null;
  try { b = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }

  const title = clean(b.title, 120);
  const category = clean(b.category, 80);
  if (!title) return json({ error: 'Please enter a title.' }, 400);
  if (!CATEGORIES.includes(category)) return json({ error: 'Please choose a category.' }, 400);

  const items = [];
  for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 12)) {
    if (it && (it.type === 'image' || it.type === 'video') && ID_RE.test(String(it.id))) {
      items.push({ type: it.type, id: String(it.id), thumb: it.type === 'image' ? true : it.thumb === true });
    } else if (it && it.type === 'youtube') {
      const vid = youtubeId(String(it.url || ''));
      if (vid) items.push({ type: 'youtube', vid });
    }
  }
  if (!items.length) return json({ error: 'Add at least one photo, video or YouTube link.' }, 400);

  const post = {
    id: crypto.randomUUID(),
    title,
    category,
    description: clean(b.description, 2000),
    location: clean(b.location, 120),
    createdAt: new Date().toISOString(),
    items,
  };
  const all = (await env.KV.get('posts', { type: 'json' })) || [];
  all.unshift(post);
  await env.KV.put('posts', JSON.stringify(all));
  return json({ ok: true, post });
}
