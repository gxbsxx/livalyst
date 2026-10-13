// «Cerrar Livalyst»: el primer clic pide confirmación, el segundo cierra la app y lo dice en pantalla (va la última)
const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
  await p.goto('http://localhost:8787/widgets'); await p.waitForTimeout(1200);
  await p.click('#quit'); await p.waitForTimeout(200);
  assert.ok(await p.isVisible('#quit.sure') && !(await p.$('#bye')), 'el primer clic solo debe pedir confirmación');
  assert.strictEqual(await fetch('http://localhost:8787/config').then(r => r.status), 200);
  await p.click('#quit'); await p.waitForTimeout(800);
  await p.screenshot({ path: 'quit.png' });
  assert.ok(await p.isVisible('#bye'), 'falta el aviso de cerrado');
  const vivo = await fetch('http://localhost:8787/config').then(() => true, () => false);
  console.log({ cerrado: !vivo }); assert.ok(!vivo, 'Livalyst sigue abierto');
  await b.close();
})().catch(e => { console.error('FALLO', e.message); process.exit(1); });
