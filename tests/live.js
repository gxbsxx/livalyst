// Editar el directo de Twitch: carga título y categoría, busca categorías al escribir, se eligen con el teclado y guarda.
// Twitch se simula; además se comprueba que sin cuenta conectada el servidor pide conectarla.
const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  assert.deepStrictEqual(await (await fetch('http://localhost:8787/stream')).json(), { need: 'login' });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: 420, height: 760 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const CATS = [{ id: '509658', name: 'Just Chatting', box: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }, { id: '27471', name: 'Minecraft', box: '' }];
  let saved = null, asked = [];
  await p.route('**/stream', r => r.request().method() === 'POST' ? (saved = JSON.parse(r.request().postData()), r.fulfill({ json: { ok: true } }))
    : r.fulfill({ json: { title: 'Directo de prueba', game: { id: '27471', name: 'Minecraft' } } }));
  await p.route('**/stream/categories?**', r => { const q = new URL(r.request().url()).searchParams.get('q'); asked.push(q); r.fulfill({ json: CATS.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) }); });
  await p.goto('http://localhost:8787/');
  await p.waitForTimeout(500); if (await p.isVisible('#alert')) await p.click('#alertClose'); // aviso de moderación de pruebas anteriores
  await p.click('#liveBtn'); await p.waitForTimeout(300);
  assert.strictEqual(await p.inputValue('#liveTitle'), 'Directo de prueba');
  assert.strictEqual(await p.inputValue('#liveCat'), 'Minecraft');
  assert.strictEqual(await p.textContent('#liveCnt'), '17 / 140');
  await p.fill('#liveTitle', 'Nuevo título');
  await p.fill('#liveCat', ''); await p.type('#liveCat', 'chat', { delay: 30 }); await p.waitForTimeout(500);
  assert.ok(asked.length <= 2, 'pregunta a Twitch por cada letra: ' + asked.join(','));
  assert.deepStrictEqual(await p.$$eval('#liveList li', l => l.map(e => e.textContent)), ['Just Chatting']);
  await p.screenshot({ path: 'live.png' });
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  assert.strictEqual(await p.inputValue('#liveCat'), 'Just Chatting');
  assert.ok(await p.isHidden('#liveList'));
  await p.click('#liveSave'); await p.waitForTimeout(300);
  assert.deepStrictEqual(saved, { title: 'Nuevo título', game: '509658' });
  assert.match(await p.textContent('#liveMsg'), /Guardado/);
  // categoría escrita sin elegirla de la lista: avisa y no guarda
  saved = null; await p.click('#liveBtn'); await p.waitForTimeout(300);
  await p.fill('#liveCat', 'algo que no existe'); await p.waitForTimeout(400); await p.click('#liveSave'); await p.waitForTimeout(200);
  assert.strictEqual(saved, null); assert.match(await p.textContent('#liveMsg'), /Elige la categoría/);
  console.log({ guardado: true, errores: errs }); assert.strictEqual(errs.length, 0);
  await b.close();
})().catch(e => { console.error('FALLO', e.message); process.exit(1); });
