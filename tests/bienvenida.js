// Bienvenida: se abre y guarda los nombres al escribirlos; con #bienvenida (como la primera vez) y con «Cómo empezar»; «Empezar» la cierra y quita el #.
const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8787/widgets'); await p.waitForTimeout(500);
  assert.ok(await p.isHidden('#hello'), 'sin #bienvenida no debe salir');
  await p.goto('http://localhost:8787/widgets#bienvenida'); await p.waitForTimeout(500);
  assert.ok(await p.isVisible('#hello')); await p.screenshot({ path: 'bienvenida.png' });
  await p.fill('[data-h=tiktok]', 'mi_tiktok'); await p.waitForTimeout(1200); // se guarda solo
  assert.strictEqual((await (await fetch('http://localhost:8787/config')).json()).tiktok, 'mi_tiktok');
  assert.ok(await p.isHidden('[data-h=twitch]')); await p.click('#hTwType'); assert.ok(await p.isVisible('[data-h=twitch]'));
  await p.click('#hello .go'); await p.waitForTimeout(300);
  assert.ok(await p.isHidden('#hello')); assert.strictEqual(new URL(p.url()).hash, '');
  await p.click('a[href="#bienvenida"]'); await p.waitForTimeout(300);
  assert.ok(await p.isVisible('#hello'), '«Cómo empezar» debe abrirla otra vez');
  console.log({ bienvenida: true, errores: errs }); assert.strictEqual(errs.length, 0);
  await b.close();
})().catch(e => { console.error('FALLO', e.message); process.exit(1); });
