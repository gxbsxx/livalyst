const { chromium } = require('playwright'); const { fonts, BG } = require('./check.js');
const assert = require('assert');
(async () => {
  const set = async w => { await fetch('http://localhost:8787/widgets', { method: 'POST', body: JSON.stringify(w) }); };
  const cfg = await (await fetch('http://localhost:8787/config')).json(), w = cfg.widgets;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const errs = [];
  const a = await b.newPage({ viewport: { width: 800, height: 600 } }); a.on('pageerror', e => errs.push(e.message)); await fonts(a);
  await a.goto('http://localhost:8787/alertas'); await a.addStyleTag({ content: BG });
  w.style.theme = 'custom'; w.style.fx = 'confetti'; w.style.fxOn = true; await set(w); await a.waitForTimeout(300);
  await a.evaluate(() => preview());
  for (const t of [250, 700, 1500, 2600]) { await a.waitForTimeout(t - (t > 250 ? [250, 700, 1500][[700, 1500, 2600].indexOf(t)] : 0)); await a.screenshot({ path: `fx-${t}.png` }); }
  w.style.fx = 'hearts'; await set(w); await a.waitForTimeout(300); await a.evaluate(() => preview()); await a.waitForTimeout(700); await a.screenshot({ path: 'fx-hearts.png' });
  // interruptor apagado: no debe salir ninguna partícula
  w.style.fx = 'confetti'; w.style.fxOn = false; await set(w); await a.waitForTimeout(300);
  await a.evaluate(() => preview()); await a.waitForTimeout(500);
  const off = await a.evaluate(() => parts.length);
  console.log({ particlesWhenOff: off }); assert.strictEqual(off, 0);
  // panel: el interruptor oculta el selector de efecto
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', e => errs.push(e.message)); await fonts(p);
  await p.goto('http://localhost:8787/widgets'); await p.waitForTimeout(900);
  const hidden = await p.locator('[data-k="style.fx"]').isHidden();
  await p.click('[data-k="style.fxOn"]'); await p.waitForTimeout(900);
  const shown = await p.locator('[data-k="style.fx"]').isVisible();
  const saved = (await (await fetch('http://localhost:8787/config')).json()).widgets.style.fxOn;
  console.log({ selectorHiddenWhenOff: hidden, selectorShownWhenOn: shown, savedFxOn: saved });
  assert.ok(hidden && shown && saved === true);
  await p.screenshot({ path: 'fx-panel.png', clip: { x: 0, y: 60, width: 800, height: 420 } });
  console.log('errors:', errs); await b.close();
})().catch(e => { console.error('FALLO', e.message); process.exit(1); });
