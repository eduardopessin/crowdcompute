import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const font = (
  await readFile(
    'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  )
).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(`<!doctype html><html><head><style>
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font});font-weight:100 900}*{box-sizing:border-box}body{margin:0;background:#10120f;color:#f0f2e9;font-family:Inter,sans-serif;padding:48px 58px}.top{font-size:23px;font-weight:600;letter-spacing:-1px;display:flex;justify-content:space-between;border-bottom:1px solid #343b2b;padding-bottom:24px}.tag{font-family:monospace;color:#c0f58d;font-size:13px;letter-spacing:2px;align-self:center}.layout{display:flex;justify-content:space-between;margin-top:38px;gap:60px}h1{font-size:69px;font-weight:500;line-height:1.02;letter-spacing:-4px;margin:0}h1 span{color:#c0f58d}.cluster{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:22px;background:#192113;border:1px solid #455535;width:325px}.chip{height:57px;display:flex;align-items:center;justify-content:space-between;padding:12px;color:#c0f58d;border:1px solid #53653e;background:#26311c;font:15px monospace}.chip small{color:#a8b797;font-size:8px}.bottom{margin-top:31px;display:flex;justify-content:space-between;color:#b1bcaa;font-size:14px}.bottom strong{color:#f0f2e9;font-weight:400}
</style></head><body><div class="top"><span>CrowdCompute / EU</span><span class="tag">FOUNDING CLUSTER EU-01</span></div><div class="layout"><h1><span>300 people.</span><br>8 H200s.<br>One European<br>AI cluster.</h1><div class="cluster">${Array.from({ length: 8 }, (_, i) => `<div class="chip">H200 <small>0${i + 1}</small></div>`).join('')}</div></div><div class="bottom"><span>Community-funded. Open-weight. European.</span><strong>crowdcompute.eu</strong></div></body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
