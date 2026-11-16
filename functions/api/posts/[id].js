import { json, guard, clean, CATEGORIES } from '../../_lib.js';

// Admin: edit the text of a post.
export async function onRequestPatch({ request, env, params }) {
  const denied = await guard(request, env);
  if (denied) return denied;
  let b = null;
  try { b = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }

  const all = (await env.KV.get('posts', { type: 'json' })) || [];
  const p = all.find((x) => x.id === params.id);
  if (!p) return json({ error: 'Post not found' }, 404);

  const title = clean(b.title, 120);
  const category = clean(b.category, 80);
  if (!title) return json({ error: 'Please enter a title.' }, 400);
  if (!CATEGORIES.includes(category) && category !== p.category) return json({ error: 'Please choose a category.' }, 400);
  p.title = title;
  p.category = category;
  p.description = clean(b.description, 2000);
  p.location = clean(b.location, 120);
  await env.KV.put('posts', JSON.stringify(all));
  return json({ ok: true });
}

// Admin: delete a post and its stored photos and videos.
export async function onRequestDelete({ request, env, params }) {
  const denied = await guard(request, env);
  if (denied) return denied;

  const all = (await env.KV.get('posts', { type: 'json' })) || [];
  const p = all.find((x) => x.id === params.id);
  if (!p) return json({ error: 'Post not found' }, 404);

  await env.KV.put('posts', JSON.stringify(all.filter((x) => x.id !== params.id)));
  for (const it of p.items || []) {
    if (it.type === 'image' || it.type === 'video') {
      try {
        await env.KV.delete('media:' + it.id);
        await env.KV.delete('thumb:' + it.id);
      } catch (e) { /* leftover files are harmless */ }
    }
  }
  return json({ ok: true });
}
