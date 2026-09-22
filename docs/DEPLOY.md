# Deploying CrowdCompute

Operational runbook for the demand-validation site at [crowdcompute.eu](https://crowdcompute.eu).
For the proposal itself, see [`docs/PROPOSAL.md`](PROPOSAL.md). For what the site is and why it
exists, see the [README](../README.md).

The site is already deployed. These steps document how it was set up and how to reproduce it.

## Project layout

```text
src/
  layouts/Base.astro          Shared HTML, SEO, navigation and footer
  pages/index.astro          Complete landing page and reservation form
  pages/privacy.astro        Privacy policy and organiser/contact variables
  pages/404.astro             Not-found page
  scripts/main.ts            Form, Turnstile, live stats and sharing
  styles/                    Design system and self-hosted fonts
  lib/                       Shared validation, countries and stats types
functions/
  api/commit.ts              POST /api/commit
  api/stats.ts               GET /api/stats
  lib/                       Bounded JSON parsing, safe responses and SQL aggregates
migrations/0001_commitments.sql
public/                      Security headers, routes, favicon, social card, sitemap
scripts/                     Deployment configuration checks, social-card renderer
tests/                       D1/validation tests and browser/accessibility checks
docs/                        Preview images and verification notes
wrangler.toml                Pages output directory and D1 binding
.env.example                 Public build configuration
.dev.vars.example            Official local-only Turnstile test secret
```

## 1. Prerequisites

Node.js **22.12+** and npm, Git, and (when you decide to deploy) a Cloudflare account with Pages, D1 and Turnstile available. Dependencies are open source. Cloudflare usage is subject to the account's limits and pricing; this project does not purchase infrastructure or use paid dependencies.

## 2. Install

```bash
git clone https://gitea.k8s.edubona.com/gitea_admin/crowdcompute.git
cd crowdcompute
npm install
# For reproducible installs after cloning, npm ci is also supported.
cp .env.example .env
cp .dev.vars.example .dev.vars
```

The example files contain **Cloudflare's publicly documented test keys only**, never real credentials. `.env` and `.dev.vars` are ignored by Git. The local example intentionally leaves privacy identity/contact empty; fill them before collecting public submissions.

## 3. Local development

For fast static editing with Astro hot reload:

```bash
npm run dev
# http://127.0.0.1:4321 — static preview, no Pages Functions
```

For the full app with real local Pages Functions and a local D1 database:

```bash
npm run dev:full
# http://localhost:8788
```

`dev:full` builds Astro, applies the local migration, then starts `wrangler pages dev`. Re-run `npm run build` after static source changes; Wrangler watches the build output and Functions. The static-only preview shows an honest unavailable state for API statistics. Use the full preview for submissions.

Turnstile's test widget still talks to Cloudflare, so an internet connection is needed for a real local form submission. Browser tests can stub that external service. `TURNSTILE_TEST_MODE=true` relaxes hostname/action checking **only on localhost/127.0.0.1** and never skips the Siteverify call. Production rejects test secrets or test mode.

Tests:

```bash
npm run check                # ESLint, Astro/TypeScript checks, integration tests, build
npx playwright install chromium
npm run db:migrate:local
npm run test:e2e             # Starts the full local server if it is not running
```

Browser tests require the public Turnstile test site key in `.env` when building. They use isolated API fixtures for the form-flow test; those fixtures are never seeded into the production database. API integration tests use an ephemeral, separate local D1 database. Test artifacts are ignored.

Regenerate the PNG social card after changing the brand:

```bash
node scripts/render-og.mjs
```

## 4. Create a production D1 database — when ready

Do not run deployment commands merely to preview this repository. They create Cloudflare resources and publish a public site.

```bash
npx wrangler login
npx wrangler d1 create crowdcompute --jurisdiction eu
```

Copy the returned `database_id` into `wrangler.toml`, replacing the all-zero placeholder. Keep the binding named `DB`, `database_name = "crowdcompute"` and `migrations_dir = "migrations"`.

The explicit EU jurisdiction constrains the D1 database location. It is separate from the future AI cluster and does not make all Cloudflare edge/security processing EU-only. Reference: [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/).

## 5. Apply migrations

```bash
# Development database on your machine
npx wrangler d1 migrations apply crowdcompute --local
# Production database in your Cloudflare account
npx wrangler d1 migrations apply crowdcompute --remote
```

Do not insert demo responses into production. The real progress starts at zero.

## 6. D1 binding and Pages project

```bash
npx wrangler pages project create crowdcompute --production-branch main
```

Wrangler deploys the `DB` binding from `wrangler.toml`. This is a **static Astro Pages project with separate Pages Functions**, not an Astro SSR Worker. No Cloudflare Astro adapter is needed. `dist/_routes.json` limits Functions execution to `/api/*`; static pages remain static.

Gitea is the source repository. Use Wrangler Direct Upload from a trusted machine or a separately configured Gitea CI job; this repository contains **no automatic deployment workflow**, so a Git push does not publish the site. See [Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) and [Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).

## 7. Create real Turnstile keys

In the Cloudflare dashboard, open **Turnstile → Add widget**, select **Managed**, and allow these production hostnames:

- `crowdcompute.eu`
- `www.crowdcompute.eu`
- The actual `crowdcompute.pages.dev` hostname if you want submissions on that hostname.

Set the public site key in `.env` (or the build environment). Keep local-only test keys in a separate local environment when switching back to development. Production keys should not allow local hostnames.

```dotenv
PUBLIC_TURNSTILE_SITE_KEY=YOUR_REAL_PUBLIC_SITE_KEY
PUBLIC_PRIVACY_CONTROLLER=Real organiser/controller identity
PUBLIC_PRIVACY_CONTACT_EMAIL=your-real-monitored-address@example.eu
```

The two privacy variables render on `/privacy/`. Do not invent a company or use an unmonitored address. See [Turnstile hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/) and [testing keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## 8. Store the server secret

```bash
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name crowdcompute
# Paste the real widget secret at the prompt. Never commit it.
```

Do not set `TURNSTILE_TEST_MODE` in production. `PUBLIC_*` values are intentionally public build-time values; the server secret is a Pages runtime secret, not an Astro public variable. If configuring preview deployments, use a separate database and Turnstile widget rather than collecting test submissions in production.

## 9. Deploy to Cloudflare Pages

Once the database ID, real site key, organiser identity/contact, remote migration and runtime secret are configured:

```bash
npm run deploy
```

This checks public configuration, runs lint/typechecks/tests/build, and executes:

```bash
npx wrangler pages deploy dist --project-name crowdcompute --branch main
```

The deploy script deliberately refuses placeholder D1 IDs, Turnstile test site keys or missing privacy identity/contact. It cannot verify your remote runtime secret or legal arrangements; configure those before publishing. Do not bypass the check by directly deploying a development build.

After deployment, verify `/api/stats`, submit an authorised test response, verify the same-browser update, and remove your test entry before opening reservations. Never log form bodies, cookies or emails for debugging. No Cloudflare resource has been created by this repository itself.

## 10. Connect crowdcompute.eu

1. Add the `crowdcompute.eu` zone to the same Cloudflare account, if not already present.
2. For the apex, configure the domain registrar with the Cloudflare nameservers assigned to that zone.
3. Open **Workers & Pages → crowdcompute → Custom domains → Set up a custom domain**.
4. Enter `crowdcompute.eu` and follow Cloudflare's DNS association instructions. Do not overwrite unrelated records.
5. Wait for DNS and the certificate to become active. Verify HTTPS and the Turnstile hostname.

## 11. Connect www.crowdcompute.eu

1. Add `www.crowdcompute.eu` as a second **Pages custom domain**.
2. Follow Cloudflare's DNS instructions (typically a CNAME pointing to the Pages hostname). Associate the custom domain in Pages first; a DNS record alone is insufficient.
3. Verify HTTPS and that the hostname is allowed in Turnstile.
4. Optional: configure a Cloudflare redirect rule from `www.crowdcompute.eu/*` to `https://crowdcompute.eu/`, preserving the path and query. Canonical metadata already uses the apex.

Reference: [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

## API behavior

`POST /api/commit` accepts a same-origin JSON request:

```json
{
  "email": "person@example.com",
  "country": "PT",
  "would_pay_59": "yes",
  "use_case": "coding",
  "model_vote": "qwen",
  "comment": "Optional, at most 500 characters",
  "consent": true,
  "turnstileToken": "a-fresh-client-generated-token"
}
```

- Validates fields and lengths before calling Turnstile; request body capped at 8 KiB, token at 2048 characters, email at 254.
- Verifies Turnstile success, hostname and `commit` action, with timeouts and safe error messages.
- Normalizes email case/whitespace; unique SQL constraint and atomic upsert prevent duplicate counting.
- Creates a random HttpOnly, SameSite=Strict, Secure-on-HTTPS browser receipt, storing only its SHA-256 hash. No account/login is created. Returning **in the same browser** updates the existing response.
- A submission for an existing email without the matching receipt gets the same generic success response but does **not** alter that person's vote or reveal that the email exists. Cookie loss/cross-device changes require contacting the organiser. This intentionally avoids arbitrary email-based vote overwrites.
- Status codes: `200` accepted/generic duplicate, `400` invalid request or security check, `403` origin mismatch, `405` wrong method, `415` wrong content type, `503` unavailable or not configured.
- No raw exceptions, personal data, IP addresses or security tokens are returned or logged.

`GET /api/stats` returns `target`, `committed`, `totalResponses`, and `modelVotes` (`glm`, `kimi`, `qwen`, `community`, `other`). It uses a single aggregate query for a consistent snapshot and `Cache-Control: no-store`. The frontend refreshes once per minute only while visible, and after a successful form submission. It clamps the progress bar at 300 but preserves the real count if it exceeds the target.

## Before opening public signups

- Identify the actual controller and a monitored privacy contact; confirm the factual privacy notice, consent basis, retention and Cloudflare processing arrangements. There is no invented legal entity in this project.
- Operate deletion/correction/withdrawal requests. Review retention monthly; the policy targets deletion within 12 months of the last update or earlier if abandoned. There is no background scheduler in this Pages-only MVP. An authorised operator can run the following maintenance command after reviewing retention requirements:

  ```bash
  npx wrangler d1 execute crowdcompute --remote --command "DELETE FROM commitments WHERE updated_at < datetime('now', '-12 months');"
  ```

- Restrict access to the Cloudflare account/D1, review infrastructure logs and backup/Time Travel retention. The app does not store IPs; Cloudflare itself processes network and security data.
- Turnstile and email uniqueness deter abuse but cannot prove 300 real people or verify email ownership. Disposable addresses and multiple emails remain possible. Confirm genuine demand before committing funds; email verification is deliberately not built into this no-auth MVP.
- Keep real secrets out of Git. No production secrets are included. Apply appropriate Cloudflare edge protections if abuse occurs; this app stores no IP-based rate-limit table.
- Maintain the boundary between intended future inference privacy and this signup system. No model fit, 1M context, tokens-per-second, SLA, fixed final price or GPU ownership is guaranteed.
- Complete contractual, tax and commercial requirements before collecting money. This version collects none.

## Routes

| Path                                                                              | Purpose                                            |
| --------------------------------------------------------------------------------- | -------------------------------------------------- |
| `/`                                                                               | Landing page, vote statistics and reservation form |
| `/#reserve`                                                                       | Reservation form                                   |
| `/#idea`, `/#cluster`, `/#why`, `/#economics`, `/#capacity`, `/#access`, `/#vote` | Proposal sections                                  |
| `/privacy/`                                                                       | Privacy notice                                     |
| `POST /api/commit`                                                                | Submit/update expression of interest               |
| `GET /api/stats`                                                                  | Aggregate public progress and votes                |
| `/favicon.svg`, `/og.png`, `/robots.txt`, `/sitemap.xml`                          | Static metadata assets                             |
| Any unknown path                                                                  | Custom 404 page                                    |
