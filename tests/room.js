const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 400, height: 760 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8787/'); await p.waitForTimeout(800);
  await fetch('http://localhost:8787/test', { method: 'POST' }); await p.waitForTimeout(4200);
  await p.click('.alertbox button').catch(() => {}); await p.waitForTimeout(300);
  const names = () => p.$$eval('.who:not(.out) .u', r => r.map(x => x.textContent));
  const before = await names(); console.log('a los 4 s:', before.join(', '));
  assert.ok(before.includes('Mirón'));
  await p.screenshot({ path: 'room.png' });
  await p.waitForTimeout(3500);
  const after = await names(); console.log('a los 8 s:', after.join(', '));
  assert.ok(!after.includes('Mirón') && after.includes('Visitante'));

  console.log('errors:', errs); assert.strictEqual(errs.length, 0); await b.close();
})().catch(e => { console.error('FALLO', e.message); process.exit(1); });
