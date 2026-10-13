// el ranking (600×260 y más pequeño) no se sale en ningún tema, con nombres largos
const { chromium } = require('playwright'); const { fonts, BG } = require('./check.js');
(async () => {
  const cfg = await (await fetch('http://localhost:8787/config')).json(), bad = [];
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  for (const [W, H] of [[600, 260], [400, 160]]) {
    const g = await b.newPage({ viewport: { width: W, height: H } }); await fonts(g);
    await g.goto('http://localhost:8787/meta?t=top&demo');
    for (const t of 'custom,retro,vaporwave,glass,fire,ice,minimal,forest,ticket,crt,polaroid,rpg,receipt,orbit,brick'.split(',')) {
      cfg.widgets.goalStyle.theme = t; cfg.widgets.top.count = 5;
      await fetch('http://localhost:8787/widgets', { method: 'POST', body: JSON.stringify(cfg.widgets) });
      await g.waitForTimeout(350); await g.addStyleTag({ content: BG });
      const r = await g.evaluate(() => { const e = document.getElementById('g'), r = e.getBoundingClientRect(); return { b: r.bottom, rt: r.right, rows: e.querySelectorAll('.row').length }; });
      if (r.b > H + 2 || r.rt > W + 2 || r.rows !== 6) bad.push(`${t} ${W}x${H} ${JSON.stringify(r)}`);
      if (W === 600 && ['custom', 'rpg', 'fire', 'receipt'].includes(t)) await g.screenshot({ path: `top-${t}.png` });
    }
  }
  console.log(bad.length ? bad.join('\n') : 'ranking dentro'); await b.close(); if (bad.length) process.exit(1);
})();
