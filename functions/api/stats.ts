import { json, type Env } from '../lib/http';
import { getStats } from '../lib/stats';
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET')
    return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  try {
    return json(await getStats(env.DB));
  } catch {
    return json(
      {
        error: 'Progress is temporarily unavailable. Please try again shortly.',
      },
      503,
    );
  }
};
