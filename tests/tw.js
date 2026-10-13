const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const cfg = await (await fetch('http://localhost:8787/config')).json(), w = cfg.widgets;
  const set = async () => fetch('http://localhost:8787/widgets', { method: 'POST', body: JSON.stringify(w) });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const run = async on => {
    w.style.twitch = on; w.style.fxOn = false; for (const k in w.alerts) w.alerts[k].duration = 1; await set();
    const p = await b.newPage({ viewport: { width: 800, height: 600 } }); const seen = [];
    await p.exposeFunction('seen', t => seen.push(t));
    await p.goto('http://localhost:8787/alertas'); await p.waitForTimeout(500);
    await p.evaluate(() => new MutationObserver(() => { const c = document.querySelector('.al'); if (c) seen(c.textContent); }).observe(document.getElementById('a'), { childList: true }));
    await fetch('http://localhost:8787/test', { method: 'POST' }); await p.waitForTimeout(16000); await p.close();
    return [...new Set(seen)];
  };
  const off = await run(false), on = await run(true);
  console.log({ off, on });
  assert.ok(!off.some(t => /SeguidorDeTwitch|Pepe_Gamer|500 bits/.test(t)));
  assert.ok(on.some(t => /SeguidorDeTwitch/.test(t)) && on.some(t => /Fan_123 ha enviado 500 bits/.test(t)));
  await b.close();
})().catch(e => { console.error('FALLO', e.message); process.exit(1); });
