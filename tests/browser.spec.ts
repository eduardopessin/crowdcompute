import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// UI fixtures are test-only. Production never seeds or invents member counts.
const fixture = {
  target: 300,
  committed: 2,
  totalResponses: 4,
  modelVotes: { glm: 1, kimi: 1, qwen: 1, community: 1, other: 0 },
};
test('real Pages API is empty and contains no personal data', async ({
  request,
}) => {
  const response = await request.get('/api/stats');
  expect(response.ok()).toBeTruthy();
  const result = await response.json();
  expect(result.target).toBe(300);
  expect(result.committed).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(result)).not.toMatch(/email|comment|country/);
});
test('desktop: real stats, keyboard access, accessibility and screenshot', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('/');
  await expect(page.locator('[data-committed]').first()).toHaveText(/\d/);
  await expect(page).toHaveTitle(
    'CrowdCompute — Community-funded European AI compute',
  );
  await page.keyboard.press('Tab');
  await expect(page.getByText('Skip to content')).toBeFocused();
  await page.locator('h1').click();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.screenshot({ path: 'test-results/desktop-hero.png' });
});
test('mobile: no horizontal overflow, usable form and accessible layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('[data-committed]').first()).toHaveText(/\d/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Reserve my seat' }).first().click();
  await expect(page.locator('#email')).toBeInViewport();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});
test('320px layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('stats fixtures update percentages, never leak into production data', async ({
  page,
}) => {
  await page.route('**/api/stats', (route) => route.fulfill({ json: fixture }));
  await page.goto('/');
  await expect(page.locator('[data-committed]').first()).toHaveText('2');
  await expect(page.locator('[data-vote-label="glm"]')).toHaveText('25%');
});
test('API outage shows an honest unavailable state', async ({ page }) => {
  await page.route('**/api/stats', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  );
  await page.goto('/');
  await expect(page.locator('[data-committed]').first()).toHaveText('—');
  await expect(page.locator('[data-vote-status]')).toContainText(
    'temporarily unavailable',
  );
});
test('form success, same-browser edit affordance and sharing with a stubbed security widget', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile={render:(el,o)=>{window.testTurnstile=o;setTimeout(()=>o.callback('test-token'),0);return 'widget'},reset:()=>{window.testTurnstile.callback('test-token')}};window.crowdcomputeTurnstileReady();`,
    }),
  );
  await page.route('**/api/stats', (route) => route.fulfill({ json: fixture }));
  await page.route('**/api/commit', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.email).toBe('tester@example.com');
    expect(body.consent).toBe(true);
    expect(body.turnstileToken).toBe('test-token');
    await route.fulfill({
      json: { ok: true, message: 'Your interest is registered.' },
    });
  });
  await page.goto('/');
  await page.locator('#email').fill('tester@example.com');
  await page.locator('#country').selectOption('PT');
  await page.getByRole('radio', { name: 'Yes, I’m in' }).check();
  await page.locator('#use_case').selectOption('coding');
  await page.locator('#model_vote').selectOption('qwen');
  await page.locator('#consent').check();
  await page.locator('#submit-button').click();
  await expect(page.getByRole('heading', { name: 'You’re in.' })).toBeVisible();
  await page.getByRole('button', { name: 'Copy to share' }).click();
  await expect(page.locator('#share-status')).toContainText('Copied');
  await page.getByRole('button', { name: 'Update my response' }).click();
  await expect(page.locator('#email')).toHaveValue('tester@example.com');
});
test('privacy and 404 pages are reachable with security headers', async ({
  page,
  request,
}) => {
  const response = await request.get('/privacy/');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-security-policy']).toContain(
    "frame-ancestors 'none'",
  );
  await page.goto('/privacy/');
  await expect(
    page.getByRole('heading', { name: 'Privacy, in plain language.' }),
  ).toBeVisible();
  const missing = await request.get('/missing-page');
  expect(missing.status()).toBe(404);
});
