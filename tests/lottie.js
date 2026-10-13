// Una alerta con una animación Lottie la reproduce (se dibuja en SVG y se mueve)
const { chromium } = require('playwright'); const assert = require('assert'); const fs = require('fs');
(async () => {
  const anim = fs.readFileSync(__dirname + '/fixtures/prueba-lottie.json');
  const up = await fetch('http://localhost:8787/media?name=prueba-lottie.json', { method: 'POST', body: anim });
  assert.strictEqual(await up.text(), 'prueba-lottie.json');
  const cfg = await (await fetch('http://localhost:8787/config')).json(), w = cfg.widgets;
  w.alerts.gift.image = 'prueba-lottie.json'; w.alerts.gift.duration = 5; w.style.theme = 'custom';
  await fetch('http://localhost:8787/widgets', { method: 'POST', body: JSON.stringify(w) });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8787/alertas'); await p.waitForTimeout(600);
  await p.evaluate(() => preview()); await p.waitForTimeout(900);
  const t1 = await p.evaluate(() => document.querySelector('.lot svg g')?.getAttribute('transform') || document.querySelector('.lot')?.innerHTML.length);
  await p.screenshot({ path: 'lottie.png' }); await p.waitForTimeout(300);
  const t2 = await p.evaluate(() => document.querySelector('.lot svg')?.innerHTML);
  const t3 = await p.evaluate(() => new Promise(r => setTimeout(() => r(document.querySelector('.lot svg')?.innerHTML), 250)));
  console.log({ dibuja: !!t2, seMueve: t2 !== t3, errs });
  assert.ok(t2 && t2 !== t3 && !errs.length);
  w.alerts.gift.image = ''; await fetch('http://localhost:8787/widgets', { method: 'POST', body: JSON.stringify(w) });
  await b.close();
})().catch(e => { console.error('FALLO', e.message); process.exit(1); });
