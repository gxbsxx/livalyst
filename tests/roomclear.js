const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 400, height: 760 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8787/'); await p.waitForTimeout(800);
  await fetch('http://localhost:8787/test', { method: 'POST' }); await p.waitForTimeout(5000);
  await p.click('.alertbox button').catch(() => {});
  const n0 = await p.$$eval('.who:not(.out)', r => r.length);
  await p.click('#roomClear'); await p.waitForTimeout(3000);
  const n1 = await p.$$eval('.who', r => r.length);
  console.log({ antes: n0, despues: n1, vacio: await p.isVisible('#roomempty') });
  await p.screenshot({ path: 'roomclear.png', clip: { x: 0, y: 190, width: 400, height: 120 } });
  assert.ok(n0 > 0 && n1 === 0); assert.strictEqual(errs.length, 0); await b.close();
})().catch(e => { console.error('FALLO', e.message); process.exit(1); });
