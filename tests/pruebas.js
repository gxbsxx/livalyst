// Botones «Probar» de /widgets: cambiar un ajuste NO enseña la alerta; «Probar» sí, y suma a las metas y al ranking;
// «Quitar las pruebas» devuelve las metas y el ranking a como estaban (lo real se queda).
const { chromium } = require('playwright'); const assert = require('assert');
const stats = async () => (await fetch('http://localhost:8787/config')).ok && new Promise(ok => {
  const ws = new (require('ws'))('ws://localhost:8787', { headers: { origin: 'http://localhost:8787' } });
  ws.on('message', m => { const d = JSON.parse(m); if (d.stats) { ws.close(); ok(d.stats); } });
});
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await fetch('http://localhost:8787/stats/reset', { method: 'POST' });
  await p.goto('http://localhost:8787/widgets'); await p.waitForTimeout(2000);
  await p.selectOption('[data-k="style.anim"]', 'zoom'); await p.waitForTimeout(1200);
  assert.strictEqual(await p.frameLocator('#aprev').locator('.al').count(), 0, 'la alerta sale al cambiar un ajuste');
  const antes = await stats();
  await p.click('[data-test=follow]'); await p.click('[data-test=follow]'); await p.click('[data-test=gift]'); await p.waitForTimeout(1200);
  const con = await stats();
  assert.strictEqual(con.follows, antes.follows + 2); assert.strictEqual(con.diamonds, antes.diamonds + 5);
  assert.strictEqual(con.top['~prueba']?.d, 5, 'la prueba no entra en el ranking');
  assert.ok(await p.frameLocator('#aprev').locator('.al').count() > 0, 'no sale la alerta al pulsar Probar');
  const topTxt = await p.frameLocator('#canvas iframe >> nth=5').locator('body').textContent();
  assert.match(topTxt, /Prueba/, 'la vista previa del ranking no muestra la prueba');
  await p.screenshot({ path: 'pruebas.png' });
  await p.click('#undoTests'); await p.waitForTimeout(800);
  const despues = await stats();
  assert.deepStrictEqual([despues.follows, despues.diamonds, despues.top['~prueba']], [antes.follows, antes.diamonds, undefined]);
  console.log({ antes: [antes.follows, antes.diamonds], con: [con.follows, con.diamonds], despues: [despues.follows, despues.diamonds], errs });
  assert.strictEqual(errs.length, 0); await b.close();
})().catch(e => { console.error('FALLO', e.message); process.exit(1); });
