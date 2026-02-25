import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { testB2Connection } from '$lib/server/b2';

export const GET: RequestHandler = async () => {
  const result = await testB2Connection();
  if (result.ok) {
    return json({ ok: true });
  }
  return json({ ok: false, error: result.error }, { status: 503 });
};
