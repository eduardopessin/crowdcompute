import { validateCommitment } from '../../src/lib/validation';
import { json, readJSON, type Env } from '../lib/http';

async function hash(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'POST')
    return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  const url = new URL(request.url);
  if (request.headers.get('Origin') !== url.origin)
    return json({ error: 'Submit the form from this website.' }, 403);
  if (
    request.headers.get('Content-Type')?.split(';')[0].trim() !==
    'application/json'
  )
    return json({ error: 'Expected JSON.' }, 415);
  let body: unknown;
  try {
    body = await readJSON(request);
  } catch {
    return json({ error: 'The form is invalid or too large.' }, 400);
  }
  const valid = validateCommitment(body);
  if (!valid.ok)
    return json(
      { error: 'Please check the highlighted fields.', fields: valid.errors },
      400,
    );
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const testMode = local && env.TURNSTILE_TEST_MODE === 'true';
  const dummySecret = /^[123]x0/.test(env.TURNSTILE_SECRET_KEY || '');
  if (
    !env.TURNSTILE_SECRET_KEY ||
    (dummySecret && !testMode) ||
    (!local && env.TURNSTILE_TEST_MODE === 'true')
  )
    return json(
      { error: 'Reservations are not available yet. Please try again later.' },
      503,
    );
  const data = valid.data;
  try {
    // No IP address is sent or stored by this application.
    const verification = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: data.turnstileToken,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!verification.ok)
      return json(
        { error: 'Security check unavailable. Please try again.' },
        503,
      );
    const result = (await verification.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
    };
    if (
      !result.success ||
      (!testMode &&
        (result.hostname !== url.hostname || result.action !== 'commit'))
    )
      return json(
        {
          error: 'Security check failed. Please try again.',
          fields: { turnstileToken: 'Please complete a new security check.' },
        },
        400,
      );
  } catch {
    return json(
      { error: 'Security check unavailable. Please try again.' },
      503,
    );
  }
  try {
    // A random, HttpOnly browser receipt protects existing votes without accounts or login.
    const prior = request.headers
      .get('Cookie')
      ?.match(/(?:^|;\s*)cc_receipt=([a-f0-9]{64})(?:;|$)/)?.[1];
    const receipt =
      prior ??
      Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('');
    const receiptHash = await hash(receipt);
    await env.DB.prepare(
      `INSERT INTO commitments
      (email, country, would_pay_59, use_case, model_vote, comment, consent, consent_version, edit_token_hash)
      VALUES (?, ?, ?, ?, ?, ?, 1, '2026-09-12', ?)
      ON CONFLICT(email) DO UPDATE SET country = excluded.country,
        would_pay_59 = excluded.would_pay_59, use_case = excluded.use_case,
        model_vote = excluded.model_vote, comment = excluded.comment, consent = 1,
        consent_version = excluded.consent_version, updated_at = CURRENT_TIMESTAMP
      WHERE commitments.edit_token_hash = excluded.edit_token_hash`,
    )
      .bind(
        data.email,
        data.country,
        data.would_pay_59,
        data.use_case,
        data.model_vote,
        data.comment || null,
        receiptHash,
      )
      .run();
    // Identical response whether new, updated, or already registered in another browser.
    return json(
      {
        ok: true,
        message:
          'Your interest is registered. Existing responses can be updated from the browser originally used to submit them.',
      },
      200,
      {
        'Set-Cookie': `cc_receipt=${receipt}; HttpOnly; SameSite=Strict; Path=/api/commit; Max-Age=15552000${url.protocol === 'https:' ? '; Secure' : ''}`,
      },
    );
  } catch {
    return json(
      { error: 'We could not save your response. Please try again shortly.' },
      503,
    );
  }
};
