// Renderiza cada tema con las fuentes reales al tamaño de OBS y mide si algo se sale.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FS = path.join(__dirname, 'node_modules/@fontsource');
const THEMES = (process.env.T || 'custom,retro,vaporwave,glass,fire,ice,minimal,forest,ticket,crt,polaroid,rpg,receipt,orbit,brick').split(',');
const BG = 'html{background:#3b4252 linear-gradient(135deg,#2e3440,#5e81ac) !important}';
async function fonts(page) { // sustituye Google Fonts por los mismos archivos de @fontsource
  await page.route('https://fonts.googleapis.com/**', r => {
    const fam = decodeURIComponent(new URL(r.request().url()).searchParams.get('family')).split(':')[0].replace(/\+/g, ' ');
    const dir = path.join(FS, fam.toLowerCase().replace(/ /g, '-'), 'files');
    let css = '';
    for (const w of [400, 700, 900]) {
      const f = path.join(dir, `${fam.toLowerCase().replace(/ /g, '-')}-latin-${w}-normal.woff2`);
      if (fs.existsSync(f)) css += `@font-face{font-family:"${fam}";font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')})}`;
    }
    r.fulfill({ contentType: 'text/css', body: css });
  });
}
module.exports = { fonts, THEMES, BG };
if (require.main !== module) return;
(async () => {
  const cfg = await (await fetch('http://localhost:8787/config')).json();
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const a = await b.newPage({ viewport: { width: +(process.env.AW||800), height: +(process.env.AH||600) } }), g = await b.newPage({ viewport: { width: +(process.env.GW||600), height: +(process.env.GH||120) } });
  await fonts(a); await fonts(g);
  await a.goto('http://localhost:8787/alertas'); await g.goto('http://localhost:8787/meta?t=diamonds' + (process.env.DEMO ? '&demo' : ''));
  const user = process.argv[2] || 'ElUsuarioConNombreLargo_2024', bad = [];
  for (const k in cfg.widgets.alerts) cfg.widgets.alerts[k].duration = 5; cfg.widgets.style.fxOn = false;
  for (const t of THEMES) {
    cfg.widgets.style.theme = cfg.widgets.goalStyle.theme = t; cfg.widgets.style.fx = 'none'; cfg.widgets.style.anim = 'fade';
    await fetch('http://localhost:8787/widgets', { method: 'POST', body: JSON.stringify(cfg.widgets) });
    await a.waitForTimeout(250);
    await a.addStyleTag({ content: BG }); await g.addStyleTag({ content: BG });
    await a.evaluate(u => { queue = []; clearTimeout(hideTimer); busy = false; push({ p: 'tiktok', ev: 'gift', user: u, gift: 'Universo', n: 99, diamonds: 3346200 }, true); }, user);
    await a.waitForTimeout(1300); await g.waitForTimeout(300);
    const m = await a.evaluate(() => { const r = document.querySelector('.al').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
    const n = await g.evaluate(() => { const e = document.getElementById('g'), r = e.getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, over: [...e.querySelectorAll('.row span')].some(s => s.scrollWidth > s.clientWidth + 1) || e.scrollWidth > e.clientWidth + 1 }; });
    const out = (r, W, H) => r.l < -2 || r.t < -2 || r.r > W + 2 || r.b > H + 2;
    if (out(m, +(process.env.AW||800), +(process.env.AH||600))) bad.push(`${t}: alerta se sale ${JSON.stringify(m)}`);
    if (out(n, +(process.env.GW||600), +(process.env.GH||120)) || n.over) bad.push(`${t}: meta se sale ${JSON.stringify(n)}`);
    await a.screenshot({ path: `c-a-${t}.png` }); await g.screenshot({ path: `c-g-${t}.png` });
  }
  console.log(bad.length ? bad.join('\n') : 'todo dentro');
  await b.close();
  if (bad.length) process.exit(1);
})();
