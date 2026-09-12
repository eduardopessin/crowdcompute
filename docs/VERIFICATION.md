# Verification

Verified locally on 12 September 2026 with Node.js 22.23.1, npm 10.9.8 and Chromium through Playwright. Nothing was deployed to Cloudflare.

| Check                                         | Result                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| ESLint                                        | Passed                                                                              |
| Astro and Functions TypeScript                | Passed; zero errors/warnings                                                        |
| Vitest validation + real local D1 integration | 34 passed                                                                           |
| Playwright browser checks                     | 8 passed                                                                            |
| axe WCAG A/AA checks on desktop and mobile    | Zero detected violations                                                            |
| Mobile horizontal overflow                    | None at 320px or 390px                                                              |
| Astro static production build                 | Passed                                                                              |
| npm dependency audit                          | Zero known vulnerabilities at verification time                                     |
| Real local Turnstile + Pages + D1 smoke test  | Insert, cookie-protected update and aggregate counts passed; test record removed    |
| Deployment configuration guard                | Correctly rejects test keys, placeholder D1 ID and missing privacy identity/contact |

The D1 suite covers valid submissions, invalid emails/enums/countries, missing consent, length limits, invalid/mismatched/unavailable Turnstile, normalized duplicates, receipt-protected updates, concurrent duplicates, empty and populated statistics, no public PII, origin/content-type/method checks, test-key rejection in production and safe database errors.

The browser suite covers desktop/mobile rendering, keyboard navigation, automated accessibility checks, actual local statistics, dynamic percentages, unavailable states, the complete form/success/share flow with an isolated external-widget fixture, and privacy/404 routes. No fixture data is deployed.

## Lighthouse

A local mobile Lighthouse run against the production build served by Wrangler produced:

| Category       | Score |
| -------------- | ----- |
| Performance    | 100   |
| Accessibility  | 100   |
| Best practices | 100   |
| SEO            | 100   |

These are local lab results, not a guarantee for the future public domain or real-user traffic. Cloudflare delivery, network conditions and real Turnstile challenges may change the results. Automated accessibility checks do not replace testing with assistive technology.

The first-party browser JavaScript bundle is approximately **5.7 KB uncompressed**. No component framework is hydrated. The first page is approximately 33 KB HTML, with local font files and one shared stylesheet. Turnstile loads its own external security script only when a site key is configured.

## Design previews

- [Desktop hero](desktop-preview.png)
- [Full desktop page](desktop-full.png)
- [Mobile hero](mobile-preview.png)

These screenshots show the real empty local database: 0 interested members. They are previews of the design, not a live public deployment.

## Dependency note

The D1 test harness uses the stable Miniflare 4 API. Wrangler brings its own runtime version. Explicit overrides keep the transitive `undici` and `sharp` packages at patched versions; the D1 and browser tests passed with those overrides. Review these pins during future dependency upgrades.
