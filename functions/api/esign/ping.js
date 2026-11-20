import { esignJson, apiKeyOk, rateOk } from '../../_lib.js';

// Lets the billing app test its connection.
export async function onRequestGet({ request, env }) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await rateOk(env, 'esignkey:' + ip))) return esignJson({ error: 'Too many attempts. Wait a minute.' }, 429);
  if (!env.ESIGN_API_KEY) {
    return esignJson({ error: 'Online signing is not set up on your website yet. Add the ESIGN_API_KEY secret (see the guide).' }, 500);
  }
  if (!(await apiKeyOk(request, env))) {
    return esignJson({ error: 'The e-sign password does not match. Check it in Business details and on your website.' }, 401);
  }
  return esignJson({ ok: true });
}
