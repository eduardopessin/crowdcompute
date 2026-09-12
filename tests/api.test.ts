import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Miniflare } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { validateCommitment } from '../src/lib/validation';
import { onRequest as commit } from '../functions/api/commit';
import { onRequest as stats } from '../functions/api/stats';
import type { Env } from '../functions/lib/http';

const valid = {
  email: ' Person@Example.com ',
  country: 'PT',
  would_pay_59: 'yes',
  use_case: 'coding',
  model_vote: 'qwen',
  comment: 'An open future.',
  consent: true,
  turnstileToken: 'valid-token',
};
describe('server validation', () => {
  it('normalizes a valid form', () => {
    const result = validateCommitment(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.email).toBe('person@example.com');
  });
  it.each([
    'bad',
    'a@@example.com',
    'a@host',
    '.a@example.com',
    'a..b@example.com',
    'a.@example.com',
    'a@-example.com',
    `${'a'.repeat(65)}@example.com`,
  ])('rejects invalid email %s', (email) => {
    expect(validateCommitment({ ...valid, email }).ok).toBe(false);
  });
  it.each([false, undefined, 'true', 1])(
    'requires explicit consent: %s',
    (consent) => {
      expect(validateCommitment({ ...valid, consent }).ok).toBe(false);
    },
  );
  it.each(['would_pay_59', 'use_case', 'model_vote', 'country'])(
    'rejects invalid enum %s',
    (field) => {
      expect(validateCommitment({ ...valid, [field]: 'invalid' }).ok).toBe(
        false,
      );
    },
  );
  it('enforces comment and Turnstile token lengths', () => {
    expect(validateCommitment({ ...valid, comment: 'a'.repeat(501) }).ok).toBe(
      false,
    );
    expect(
      validateCommitment({ ...valid, turnstileToken: 'a'.repeat(2049) }).ok,
    ).toBe(false);
  });
  it('rejects null and arrays', () => {
    expect(validateCommitment(null).ok).toBe(false);
    expect(validateCommitment([]).ok).toBe(false);
  });
});

let mf: Miniflare;
let env: Env;
const origin = 'https://crowdcompute.eu';
function context(request: Request) {
  return { request, env } as Parameters<typeof commit>[0];
}
function request(
  body: unknown = valid,
  cookie = '',
  overrides: Record<string, string> = {},
) {
  return new Request(`${origin}/api/commit`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      Cookie: cookie,
      ...overrides,
    },
    body: JSON.stringify(body),
  });
}
function verify(
  result: unknown = {
    success: true,
    hostname: 'crowdcompute.eu',
    action: 'commit',
  },
) {
  return vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
}
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ['DB'],
    compatibilityDate: '2026-07-01',
  });
  env = {
    DB: (await mf.getD1Database('DB')) as unknown as D1Database,
    TURNSTILE_SECRET_KEY: 'production-secret-for-tests',
  };
  const sql = await readFile(
    new URL('../migrations/0001_commitments.sql', import.meta.url),
    'utf8',
  );
  await env.DB.exec(sql.replace(/\n/g, ' '));
});
afterAll(async () => {
  await mf?.dispose();
});
beforeEach(async () => {
  await env.DB.prepare('DELETE FROM commitments').run();
  verify();
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('Pages Functions with a real local D1 database', () => {
  it('saves a valid submission with a secure receipt and no IP', async () => {
    const response = await commit(context(request()));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(response.headers.get('set-cookie')).toContain(
      'HttpOnly; SameSite=Strict',
    );
    expect(response.headers.get('set-cookie')).toContain('Secure');
    const row = await env.DB.prepare('SELECT * FROM commitments').first();
    expect(row).toMatchObject({
      email: 'person@example.com',
      country: 'PT',
      consent: 1,
    });
    expect(row).not.toHaveProperty('ip');
    expect(JSON.stringify(row)).not.toContain('valid-token');
  });
  it('validates before contacting Turnstile or D1', async () => {
    const response = await commit(
      context(request({ ...valid, consent: false })),
    );
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS n FROM commitments').first('n'),
    ).toBe(0);
  });
  it.each([
    { success: false },
    { success: true, hostname: 'evil.example', action: 'commit' },
    { success: true, hostname: 'crowdcompute.eu', action: 'login' },
  ])('rejects failed or mismatched Turnstile checks', async (result) => {
    verify(result);
    const response = await commit(context(request()));
    expect(response.status).toBe(400);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS n FROM commitments').first('n'),
    ).toBe(0);
  });
  it('fails closed during a Turnstile outage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('private internal detail');
      }),
    );
    const response = await commit(context(request()));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private internal detail');
  });
  it('updates duplicate email with the original receipt, counting it once', async () => {
    const first = await commit(context(request()));
    const cookie = first.headers.get('set-cookie')!.split(';')[0];
    const response = await commit(
      context(
        request(
          {
            ...valid,
            email: 'person@example.com',
            model_vote: 'glm',
            would_pay_59: 'maybe',
          },
          cookie,
        ),
      ),
    );
    expect(response.status).toBe(200);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS n FROM commitments').first('n'),
    ).toBe(1);
    expect(
      await env.DB.prepare(
        'SELECT model_vote, would_pay_59 FROM commitments',
      ).first(),
    ).toEqual({ model_vote: 'glm', would_pay_59: 'maybe' });
  });
  it('does not let another browser overwrite someone else’s vote or enumerate emails', async () => {
    const first = await commit(context(request()));
    const duplicate = await commit(
      context(request({ ...valid, model_vote: 'glm' })),
    );
    expect(await duplicate.json()).toEqual(await first.json());
    expect(
      await env.DB.prepare('SELECT model_vote FROM commitments').first(
        'model_vote',
      ),
    ).toBe('qwen');
  });
  it('handles concurrent duplicate submissions atomically', async () => {
    const responses = await Promise.all([
      commit(context(request())),
      commit(context(request())),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS n FROM commitments').first('n'),
    ).toBe(1);
  });
  it('returns real zero statistics from an empty database', async () => {
    const response = await stats(context(new Request(`${origin}/api/stats`)));
    expect(await response.json()).toEqual({
      target: 300,
      committed: 0,
      totalResponses: 0,
      modelVotes: { glm: 0, kimi: 0, qwen: 0, community: 0, other: 0 },
    });
  });
  it('counts only yes toward 300; includes all model votes and exposes no personal data', async () => {
    await commit(context(request()));
    await commit(
      context(
        request({
          ...valid,
          email: 'maybe@example.com',
          would_pay_59: 'maybe',
          model_vote: 'glm',
        }),
      ),
    );
    await commit(
      context(
        request({
          ...valid,
          email: 'no@example.com',
          would_pay_59: 'no',
          model_vote: 'community',
        }),
      ),
    );
    const response = await stats(context(new Request(`${origin}/api/stats`)));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const result = await response.json();
    expect(result).toEqual({
      target: 300,
      committed: 1,
      totalResponses: 3,
      modelVotes: { glm: 1, kimi: 0, qwen: 1, community: 1, other: 0 },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /email|comment|country|example.com|token/,
    );
  });
  it('rejects cross-origin requests, wrong content type, malformed JSON and large bodies', async () => {
    expect(
      (
        await commit(
          context(request(valid, '', { Origin: 'https://evil.example' })),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await commit(
          context(request(valid, '', { 'Content-Type': 'text/plain' })),
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await commit(
          context(
            new Request(`${origin}/api/commit`, {
              method: 'POST',
              headers: { Origin: origin, 'Content-Type': 'application/json' },
              body: '{',
            }),
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      (await commit(context(request({ ...valid, comment: 'a'.repeat(9000) }))))
        .status,
    ).toBe(400);
  });
  it('rejects production use of testing secrets', async () => {
    const response = await commit({
      ...context(request()),
      env: {
        ...env,
        TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        TURNSTILE_TEST_MODE: 'true',
      },
    });
    expect(response.status).toBe(503);
  });
  it('returns safe errors on database failure', async () => {
    const broken = {
      ...env,
      DB: {
        prepare: () => {
          throw new Error('database password and SQL');
        },
      } as unknown as D1Database,
    };
    const a = await commit({ ...context(request()), env: broken });
    const b = await stats({
      ...context(new Request(`${origin}/api/stats`)),
      env: broken,
    });
    expect(a.status).toBe(503);
    expect(b.status).toBe(503);
    expect(await a.text()).not.toContain('SQL');
    expect(await b.text()).not.toContain('password');
  });
  it('enforces methods and security headers', async () => {
    const a = await commit(context(new Request(`${origin}/api/commit`)));
    const b = await stats(
      context(new Request(`${origin}/api/stats`, { method: 'POST' })),
    );
    expect(a.status).toBe(405);
    expect(a.headers.get('Allow')).toBe('POST');
    expect(b.status).toBe(405);
    expect(b.headers.get('Content-Security-Policy')).toContain(
      "default-src 'none'",
    );
  });
});
