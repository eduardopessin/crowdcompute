import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
const config = Object.assign(
  {},
  ...['.env', '.env.local', '.env.production', '.env.production.local']
    .filter(existsSync)
    .map((path) => parseEnv(readFileSync(path, 'utf8'))),
  process.env,
);
const problems = [];
if (
  !config.PUBLIC_TURNSTILE_SITE_KEY ||
  /^[123]x0/.test(config.PUBLIC_TURNSTILE_SITE_KEY)
)
  problems.push(
    'Set a real PUBLIC_TURNSTILE_SITE_KEY in .env or the build environment.',
  );
if (!config.PUBLIC_PRIVACY_CONTROLLER?.trim())
  problems.push(
    'Set PUBLIC_PRIVACY_CONTROLLER to the real organiser/controller identity.',
  );
if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.PUBLIC_PRIVACY_CONTACT_EMAIL || '')
)
  problems.push(
    'Set PUBLIC_PRIVACY_CONTACT_EMAIL to a monitored privacy contact.',
  );
if (
  readFileSync('wrangler.toml', 'utf8').includes(
    '00000000-0000-0000-0000-000000000000',
  )
)
  problems.push('Replace the placeholder D1 database_id in wrangler.toml.');
if (problems.length) {
  console.error(
    'Deployment is not configured:\n' +
      problems.map((p) => `- ${p}`).join('\n'),
  );
  process.exit(1);
}
console.log(
  'Public configuration checks passed. Ensure the production TURNSTILE_SECRET_KEY is set in Pages and remote D1 migrations have been applied.',
);
