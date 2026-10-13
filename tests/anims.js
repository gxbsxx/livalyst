// Animaciones del panel de widgets: nada aparece a medias, la raya de las pestañas y los fondos de los segmentos
// acaban justo debajo de lo elegido, y el lienzo de la vista previa no hace zoom al cambiar.
const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 760 } }); const w = ms => p.waitForTimeout(ms);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const off = () => p.evaluate(() => {
    const r = e => e.getBoundingClientRect(), d = (a, b) => Math.round(Math.abs(r(a).left - r(b).left) + Math.abs(r(a).width - r(b).width));
    return [d(document.querySelector('.tabink'), document.querySelector('[role=tab][aria-selected=true]')),
      ...[...document.querySelectorAll('.seg')].map(s => d(s.querySelector('.thumb'), s.querySelector('[aria-pressed=true]')))];
  });
  await p.goto('http://localhost:8787/widgets');
  const half = await p.evaluate(() => document.body.classList.contains('loading') ? 'oculto' : document.querySelectorAll('#style select').length ? 'completo' : 'a medias');
  assert.notStrictEqual(half, 'a medias', 'el panel se ve a medias mientras carga');
  await w(1500); assert.deepStrictEqual(await off(), [0, 0, 0], 'indicadores descolocados al cargar');
  await p.click('#tab-goals'); await w(600); assert.deepStrictEqual(await off(), [0, 0, 0], 'raya descolocada al cambiar de pestaña');
  assert.ok(await p.isVisible('#p-goals') && await p.isHidden('#p-alerts'));
  const t = await p.evaluate(() => { const c = getComputedStyle(document.getElementById('canvas')); return { p: c.transitionProperty, d: c.transitionDuration }; });
  assert.ok(!/transform|all/.test(t.p) || /^0s(, 0s)*$/.test(t.d), 'el lienzo no debe animar su escala');
  await p.click('[data-canvas=v]'); await w(600); assert.deepStrictEqual(await off(), [0, 0, 0], 'fondo del segmento descolocado');
  await p.setViewportSize({ width: 900, height: 760 }); await w(400); assert.deepStrictEqual(await off(), [0, 0, 0], 'descolocado al cambiar el tamaño');
  console.log({ carga: half, errores: errs }); assert.strictEqual(errs.length, 0);
  await p.click('[data-canvas=z]'); await b.close();
})().catch(e => { console.error('FALLO', e.message); process.exit(1); });
