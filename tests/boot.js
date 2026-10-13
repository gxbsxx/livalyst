const { chromium } = require('playwright'); const assert = require('assert');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 400, height: 500 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8787/'); await p.waitForTimeout(1200);
  const t = await p.textContent('#boot').catch(() => null); await p.screenshot({ path: 'boot.png' });
  await p.reload(); await p.waitForTimeout(1200); const again = await p.$('#boot');
  console.log({ banner: t, shownAgainOnReload: !!again, errs }); assert.ok(t && /Livalyst v[\d.]+ se ha/.test(t) && !again && !errs.length); await b.close(); })();
