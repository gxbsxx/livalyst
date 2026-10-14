const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); await require('./check.js').fonts(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8787/widgets'); await p.waitForTimeout(1000);

  // 1) elegir tema en el panel → se guarda, la vista previa y OBS lo aplican
  await p.selectOption('[data-k="style.theme"]', 'vaporwave');
  await p.click('#tab-goals'); await p.selectOption('[data-k="goalStyle.theme"]', 'ice'); await p.click('#tab-alerts');
  await p.waitForTimeout(1500);
  const saved = await p.textContent('#saved');
  const cfg = await (await fetch('http://localhost:8787/config')).json();
  const alertTheme = await p.frameLocator('#aprev').locator('html').getAttribute('data-theme');
  const goalTheme = await p.frameLocator('#canvas iframe >> nth=1').locator('html').getAttribute('data-theme');
  await p.click('[data-test=gift]'); await p.waitForTimeout(900); // la alerta solo sale al pulsar «Probar»
  const card = await p.frameLocator('#aprev').locator('.al').count();
  const obs = await b.newPage(); await obs.goto('http://localhost:8787/meta?t=likes'); await obs.waitForTimeout(800);
  const obsTheme = await obs.locator('html').getAttribute('data-theme');
  console.log({ saved, cfgAlert: cfg.widgets.style.theme, cfgGoal: cfg.widgets.goalStyle.theme, alertTheme, goalTheme, previewCard: card, obsTheme });
  assert.strictEqual(cfg.widgets.style.theme, 'vaporwave'); assert.strictEqual(cfg.widgets.goalStyle.theme, 'ice');
  assert.strictEqual(alertTheme, 'vaporwave'); assert.strictEqual(goalTheme, 'ice'); assert.strictEqual(obsTheme, 'ice'); assert.ok(card > 0);
  await p.screenshot({ path: 'e2e-panel.png' });

  // 2) servidor antiguo (responde "ok" y tira el tema) → el panel avisa
  await p.route('**/widgets', r => r.request().method() === 'POST' ? r.fulfill({ body: 'ok' }) : r.continue());
  await p.selectOption('[data-k="style.theme"]', 'fire'); await p.waitForTimeout(900);
  const warn = await p.textContent('#saved');
  console.log({ warn });
  assert.match(warn, /versión antigua/);
  console.log('errors:', errs);
  await b.close();
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
