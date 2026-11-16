import { json, guard, ID_RE } from '../../_lib.js';

const MB = 1024 * 1024;

// Admin only: store one photo, photo thumbnail, video or video poster in KV.
export async function onRequestPut({ request, env, params }) {
  const denied = await guard(request, env);
  if (denied) return denied;

  const id = String(params.id || '');
  if (!ID_RE.test(id)) return json({ error: 'Bad id' }, 400);
  const kind = new URL(request.url).searchParams.get('t');
  if (!['full', 'thumb', 'video'].includes(kind)) return json({ error: 'Bad kind' }, 400);

  const buf = await request.arrayBuffer();
  const max = kind === 'video' ? 25 * MB : kind === 'full' ? 3 * MB : 0.5 * MB;
  if (buf.byteLength < 200) return json({ error: 'File is empty' }, 400);
  if (buf.byteLength > max) return json({ error: 'File is too large' }, 413);

  // Check the real file type from its first bytes, not from its name.
  const b = new Uint8Array(buf, 0, 12);
  let type = '';
  if (kind !== 'video') {
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) type = 'image/jpeg';
  } else if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    type = 'video/mp4';
  } else if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    type = 'video/webm';
  }
  if (!type) return json({ error: 'Only JPEG photos and MP4 or WebM videos are accepted' }, 415);

  await env.KV.put((kind === 'thumb' ? 'thumb:' : 'media:') + id, buf, { metadata: { type } });
  return json({ ok: true });
}
