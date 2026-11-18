// Optional PNG export using the web workspace's existing Playwright dependency.
const { chromium } = require(require.resolve('playwright', { paths: [require('node:path').resolve(__dirname, '../../apps/web')] }));
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true, timeout: 20000 });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    for (const name of fs.readdirSync(__dirname).filter(n => n.endsWith('.svg'))) {
      await page.goto(pathToFileURL(path.join(__dirname, name)).href);
      if (await page.locator('parsererror').count()) throw new Error(`Invalid SVG: ${name}`);
      await page.locator('svg').screenshot({ path: path.join(__dirname, name.replace('.svg', '.png')), timeout: 15000 });
      console.log(`Rendered ${name}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
