// Livalyst: chat unificado, alertas y metas para OBS (Twitch + YouTube + TikTok + Kick), con emotes FFZ/BTTV/7TV.
// Uso: node server.js  →  panel personalizado (dock) de OBS en http://localhost:8787
const http = require('http'), fs = require('fs'), path = require('path');
const WebSocket = require('ws');

const VERSION = '1.29';
// Tus datos (configuración, cuenta de Twitch, metas, sonidos e imágenes) viven fuera de la carpeta de la app,
// así cada versión nueva es una carpeta que se puede sustituir entera sin perder nada.
const DATA = process.env.APPDATA ? path.join(process.env.APPDATA, 'Livalyst') : path.join(__dirname, 'datos');
if (process.argv[2] !== 'test') fs.mkdirSync(DATA, { recursive: true });
const PORT = 8787, CFG = path.join(DATA, 'config.json');
const LOOK = { font: 'system', customFont: '', size: 14, weight: '400', spacing: '1', emote: '1.8', nameColor: 'user', textColor: '#efeff1',
  outline: 'none', bg: 100, bubble: false, badges: true, roles: true, time: false, anim: true, newestTop: false, max: 200 };
const DEFAULT = {
  twitch: '', youtube: '', tiktok: '', kick: '', ffz: true, bttv: true, seventv: true, twitchClientId: '',
  look: { dock: LOOK },
  filters: { hideCommands: false, hideBots: true, bots: 'nightbot, streamelements, streamlabs, moobot, fossabot, wizebot, botrixoficial, kicklet',
    blocked: '', highlight: '' },
  events: { join: true, gifts: true, follows: true, subs: true, shares: false, redeems: true, mod: true, box: true, inChat: true, room: true },
  widgets: WIDGETS_DEFAULT(),
};
// Widgets de TikTok (alertas y metas). Se configuran en http://localhost:8787/widgets
function WIDGETS_DEFAULT() {
  const alert = (text, on = true) => ({ on, text, sound: '', image: '', volume: 80, duration: 5 });
  const goal = (title, target, color) => ({ title, target, step: 0, start: 0, color });
  return {
    alerts: { gift: { ...alert('{user} ha enviado {gift} x{n}'), min: 1 }, follow: alert('{user} te ha empezado a seguir'),
      sub: alert('{user} se ha suscrito'), share: alert('{user} ha compartido el directo', false) },
    style: { theme: 'custom', twitch: false, fxOn: true, fx: 'theme', font: 'Roboto', size: 34, color: '#ffffff', accent: '#fe2c55', anim: 'pop' },
    goals: { likes: goal('Meta de likes', 10000, '#fe2c55'), follows: goal('Meta de seguidores', 50, '#25f4ee'),
      diamonds: goal('Meta de monedas', 1000, '#ffc400'), shares: goal('Meta de compartidos', 20, '#8be04e') },
    goalStyle: { theme: 'custom', fxOn: true, fx: 'theme', font: 'Roboto', size: 22, text: '#ffffff', bg: '#000000', bgAlpha: 55 },
    top: { title: 'Top regaladores', count: 3 }, // ranking de quien más monedas ha dado en el directo (usa el aspecto de las metas)
  };
}
const CONNECTION_KEYS = ['twitch', 'youtube', 'tiktok', 'kick', 'ffz', 'bttv', 'seventv'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

// Solo acepta claves conocidas y del tipo esperado (el panel es accesible en la red local).
function clean(def, inp) {
  const out = {};
  for (const [k, d] of Object.entries(def)) {
    const v = inp?.[k];
    if (d && typeof d === 'object') out[k] = clean(d, v);
    else if (typeof d === 'number') out[k] = Number.isFinite(+v) && v !== '' && v != null ? Math.max(0, Math.min(+v, 1e9)) : d;
    else if (typeof v === typeof d) out[k] = typeof v === 'string' ? v.slice(0, 500) : v;
    else out[k] = d;
  }
  return out;
}

// ---------- parsers (probados con `node server.js test`) ----------
function parseIrc(line) {
  const r = /^(?:@(\S+) )?(?::(\S+) )?(\S+)(?: (\S+))?(?: :(.*))?$/.exec(line);
  if (!r) return null;
  const tags = {};
  for (const kv of (r[1] || '').split(';')) { const i = kv.indexOf('='); if (i > 0) tags[kv.slice(0, i)] = kv.slice(i + 1); }
  let text = r[5] || '';
  if (text.startsWith('\x01ACTION ')) text = text.slice(8).replace(/\x01$/, ''); // /me
  return { tags, nick: (r[2] || '').split('!')[0], cmd: r[3], text };
}
const ircUnescape = s => (s || '').replace(/\\(.)/g, (_, c) => ({ s: ' ', ':': ';', '\\': '\\', r: '', n: '' }[c] ?? c));

function twitchParts(text, tag) {
  const chars = Array.from(text), spans = [];
  for (const e of (tag || '').split('/').filter(Boolean)) {
    const [id, ranges] = e.split(':');
    for (const r of ranges.split(',')) { const [a, b] = r.split('-').map(Number); spans.push([a, b, id]); }
  }
  spans.sort((x, y) => x[0] - y[0]);
  const parts = []; let i = 0;
  for (const [a, b, id] of spans) {
    if (a > i) parts.push({ t: chars.slice(i, a).join('') });
    parts.push({ img: `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`, alt: chars.slice(a, b + 1).join('') });
    i = b + 1;
  }
  if (i < chars.length) parts.push({ t: chars.slice(i).join('') });
  return parts;
}
const twitchRoles = badges => ['broadcaster', 'moderator', 'vip', 'subscriber'].filter(r => (badges || '').split(',').some(b => b.startsWith(r + '/') || (r === 'subscriber' && b.startsWith('founder/'))));

function kickParts(s) {
  const a = s.split(/\[emote:(\d+):([^\]]*)\]/), parts = [];
  for (let i = 0; i < a.length; i += 3) {
    if (a[i]) parts.push({ t: a[i] });
    if (a[i + 1]) parts.push({ img: `https://files.kick.com/emotes/${a[i + 1]}/fullsize`, alt: a[i + 2] });
  }
  return parts;
}

// ponytail: asume que `index` cuenta caracteres del texto; si los emotes de sub salen descolocados, revisar aquí
function tiktokParts(text, emotes = []) {
  const chars = Array.from(text), parts = [];
  let i = 0;
  for (const { index, emote } of [...emotes].sort((a, b) => a.index - b.index)) {
    const url = emote?.image?.urlList?.[0];
    if (!url) continue;
    if (index > i) parts.push({ t: chars.slice(i, index).join('') });
    parts.push({ img: url, alt: '' });
    i = Math.max(i, index);
  }
  if (i < chars.length) parts.push({ t: chars.slice(i).join('') });
  return parts;
}

// ---------- avisos de moderación de TikTok ----------
// Text de TikTok: patrón con huecos {0:string} que se rellenan con sus piezas.
const ttText = t => !t ? '' : typeof t === 'string' ? t
  : (t.defaultPattern || '').replace(/\{(\d+)(?::[^}]*)?\}/g, (_, i) => t.pieces?.[i]?.stringValue || t.pieces?.[i]?.userValue?.user?.nickname || '').trim();
const AGE_RE = /18|edad|adult|age|madur|mature|restric/i;
function alertFromTikTok(kind, d) {
  const p = d.punishInfo || {}, dlg = d.dialog || d.perceptionDialog || {}, sh = d.sheet || {};
  const lines = [ttText(dlg.title), ttText(dlg.subTitle), ttText(sh.title), ttText(sh.subTitle), ttText(sh.reasonInfo), ttText(sh.notAllowedText),
    ttText(d.toast), ttText(d.floatText), ttText(d.notice), ttText(d.content), ttText(d.violationReason), ttText(d.title), ttText(d.noticeContent),
    d.tips, p.showReason || p.punishReason, ttText(d.perceptionAudienceText)].filter(Boolean);
  const text = [...new Set(lines)].join('\n');
  const age = p.punishTypeId === 70 || p.punishTypeId === 'VIEWER_LIMIT' || AGE_RE.test(text + ' ' + (p.punishType || ''));
  const suspended = kind === 'control' && d.action === 4;
  const minutes = +p.duration > 0 ? Math.round(+p.duration / 60) : 0;
  return {
    id: 'a' + Date.now(), ts: Date.now(), age,
    title: age ? '🔞 TikTok ha activado la restricción +18 en tu directo' : suspended ? '⛔ TikTok ha suspendido tu directo' : '⚠️ Aviso de moderación de TikTok',
    text: text || 'TikTok ha enviado un aviso de moderación sin texto.',
    detail: [p.punishType && `Tipo: ${p.punishType}`, minutes && `Duración: ${minutes} min`].filter(Boolean).join(' · '),
  };
}
if (process.argv[2] === 'test') {
  const assert = require('assert');
  const m = parseIrc('@badges=moderator/1,subscriber/6;color=#FF0000;display-name=Pepe;emotes=25:0-4 :pepe!pepe@pepe.tmi.twitch.tv PRIVMSG #canal :Kappa hola a=b');
  assert.deepStrictEqual([m.cmd, m.nick, m.tags['display-name'], m.text], ['PRIVMSG', 'pepe', 'Pepe', 'Kappa hola a=b']);
  assert.deepStrictEqual(twitchRoles(m.tags.badges), ['moderator', 'subscriber']);
  assert.strictEqual(parseIrc(':x!x@x PRIVMSG #c :\x01ACTION baila\x01').text, 'baila');
  assert.strictEqual(ircUnescape('Pepe\\ssubscribed\\sat\\sTier\\s1.'), 'Pepe subscribed at Tier 1.');
  assert.deepStrictEqual(twitchParts('😀 Kappa hi Kappa', '25:2-6,11-15').map(p => p.t ?? p.alt), ['😀 ', 'Kappa', ' hi ', 'Kappa']);
  assert.deepStrictEqual(kickParts('hola [emote:37226:KEKW] ok'), [{ t: 'hola ' }, { img: 'https://files.kick.com/emotes/37226/fullsize', alt: 'KEKW' }, { t: ' ok' }]);
  assert.deepStrictEqual(tiktokParts('hola'), [{ t: 'hola' }]);
  assert.deepStrictEqual(tiktokParts('ab', [{ index: 1, emote: { image: { urlList: ['u'] } } }]), [{ t: 'a' }, { img: 'u', alt: '' }, { t: 'b' }]);
  const c = clean(DEFAULT, { twitch: 'x', size: 99, look: { dock: { size: '20', bubble: 'yes', evil: 1 } }, hack: 1 });
  assert.deepStrictEqual([c.twitch, c.look.dock.size, c.look.dock.bubble, c.look.dock.evil, c.hack], ['x', 20, false, undefined, undefined]);
  const a = alertFromTikTok('perception', { punishInfo: { punishTypeId: 70, duration: '1800' }, dialog: { title: { defaultPattern: 'Tu LIVE solo es visible para {0:string}', pieces: [{ stringValue: 'mayores de 18' }] } } });
  assert.ok(a.age && a.text === 'Tu LIVE solo es visible para mayores de 18' && a.detail === 'Duración: 30 min');
  assert.ok(!alertFromTikTok('control', { action: 4, tips: 'Contenido no permitido' }).age);
  const w = clean(DEFAULT.widgets, { style: { theme: 'neon', fx: 'hearts' }, goalStyle: { theme: 'gold' }, goals: { likes: { target: 50000 } } });
  assert.deepStrictEqual([w.style.theme, w.style.fx, w.goalStyle.theme, w.goals.likes.target], ['neon', 'hearts', 'gold', 50000]);
  const top = {};
  for (let i = 0; i < 35; i++) addTop(top, 'u' + i, 'U' + i, i + 1);
  addTop(top, 'u34', 'Ballena', 100); addTop(top, 'nadie', 'Nadie', 0);
  assert.deepStrictEqual([Object.keys(top).length, top.u34.d, top.u0, top.nadie], [30, 135, undefined, undefined]); // quita a los que menos dieron
  console.log('ok'); process.exit(0);
}

// ---------- estado y servidor ----------
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');
const { LiveChat } = require('youtube-chat');

let saved = {};
try { saved = JSON.parse(fs.readFileSync(CFG, 'utf8')) || {}; } catch {} // sin config o corrupta: valores por defecto
let cfg = clean(DEFAULT, saved);
let status = {}, emotes = {}, viewers = {}, gen = 0, stoppers = {}, emoteSeq = 0, seq = 0;
// Una conexión viva por plataforma: al reintentar se cierra la anterior (si no, se acumulan cada minuto).
function own(p, stop) { try { stoppers[p]?.(); } catch {} stoppers[p] = stop; }
let lastAlert = null; // último aviso de moderación de TikTok (se reenvía al recargar el panel hasta que lo cierres)
const history = [], events = []; // chat y eventos van separados: un mensaje de chat nunca puede convertirse en evento

// Contadores de las metas. Se guardan en disco para que sobrevivan a un reinicio en mitad del directo
// y se ponen a cero solo cuando TikTok da otra sala (= directo nuevo).
const STATS = path.join(DATA, 'stats.json');
let stats = { room: '', likes: 0, follows: 0, diamonds: 0, shares: 0, top: {} }, statsTimer, statsSend;
try { Object.assign(stats, JSON.parse(fs.readFileSync(STATS, 'utf8'))); } catch {}
function bump(k, v, absolute) {
  stats[k] = absolute ? v : stats[k] + v;
  statsSend ??= setTimeout(() => { statsSend = null; send({ stats }); }, 200); // los likes llegan a decenas por segundo
  clearTimeout(statsTimer); statsTimer = setTimeout(() => { try { fs.writeFileSync(STATS, JSON.stringify(stats)); } catch {} }, 2000); // los likes llegan a ráfagas
}
function resetStats(room = stats.room) { stats = { room, likes: 0, follows: 0, diamonds: 0, shares: 0, top: {} }; bump('likes', 0); }
// Ranking del directo: { login: { u: nombre, d: monedas } }. Se guardan los 30 mejores (el widget enseña como mucho 10).
function addTop(t, login, user, diamonds) {
  if (!login || !diamonds) return;
  const r = (t[login] ??= { u: user, d: 0 });
  r.u = user || r.u; r.d += diamonds;
  const keys = Object.keys(t);
  if (keys.length > 30) delete t[keys.reduce((a, b) => (t[a].d <= t[b].d ? a : b))];
}

const MEDIA = path.join(DATA, 'media');
const MEDIA_TYPES = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.webm': 'video/webm', '.mp4': 'video/mp4', '.json': 'application/json' }; // .json = animación Lottie
const mediaName = n => { n = path.basename(String(n || '')).replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]/g, '_'); return MEDIA_TYPES[path.extname(n).toLowerCase()] ? n : null; };
const listMedia = () => { try { return fs.readdirSync(MEDIA).filter(mediaName); } catch { return []; } };
const saveCfg = () => { fs.writeFileSync(CFG + '.tmp', JSON.stringify(cfg, null, 2)); fs.renameSync(CFG + '.tmp', CFG); }; // escritura atómica
const twitchChannel = () => cfg.twitch.trim().toLowerCase().replace(/.*twitch\.tv\//, '').replace(/^#/, '');
const helix = path => fetch('https://api.twitch.tv/helix/' + path, { headers: { 'Client-Id': twAuth.client_id, Authorization: 'Bearer ' + twAuth.token } });
const readBody = (req, max, cb) => { const bufs = []; let n = 0; req.on('data', c => { n += c.length; if (n > max) req.destroy(); else bufs.push(c); }); req.on('end', () => cb(Buffer.concat(bufs))); };

const PAGES = { '/': 'panel.html', '/index.html': 'panel.html', '/widgets': 'widgets.html', '/alertas': 'overlay.html', '/meta': 'overlay.html' };
// Solo el propio panel puede cambiar cosas: bloquea que otra web abierta en el navegador toque los ajustes.
const sameOrigin = req => !req.headers.origin || req.headers.origin === 'http://' + req.headers.host;
// Solo desde este PC y con la dirección de siempre: ni otro aparato de la red local ni una web que se haga pasar por localhost.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/, LOCAL_IP = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const trusted = req => LOCAL_IP.has(req.socket.remoteAddress) && LOCAL_HOST.test(req.headers.host || '');
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (!trusted(req) || (req.method !== 'GET' && !sameOrigin(req))) { res.statusCode = 403; return res.end(); }
  if (url === '/config' && req.method === 'POST') return readBody(req, 1e5, b => {
    try {
      const next = clean(DEFAULT, JSON.parse(b));
      next.widgets = cfg.widgets; // los widgets solo se cambian desde /widgets (así el dock no los pisa con una copia vieja)
      const reconnect = CONNECTION_KEYS.some(k => next[k] !== cfg[k]);
      cfg = next; saveCfg();
      send({ cfg });
      if (reconnect) restart();
      res.end('ok');
    } catch { res.statusCode = 400; res.end('config no válida'); }
  });
  if (url === '/quit' && req.method === 'POST') { res.end('ok'); return setTimeout(() => process.exit(0), 100); } // lo usa «Iniciar Livalyst» para cerrar la versión abierta
  if (url === '/test' && req.method === 'POST') { sample(); return res.end('ok'); }
  if (url === '/widgets' && req.method === 'POST') return readBody(req, 1e5, b => {
    try {
      cfg.widgets = clean(DEFAULT.widgets, JSON.parse(b)); saveCfg();
      send({ cfg }); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(cfg.widgets));
    } catch { res.statusCode = 400; res.end('config no válida'); }
  });
  if (url === '/test-alert' && req.method === 'POST') { // no cuenta para las metas ni sale en el chat
    const ev = new URLSearchParams(req.url.split('?')[1]).get('ev');
    send({ alertTest: { p: 'tiktok', ev, user: 'Prueba', id: 't' + Date.now(), gift: 'Rosa', n: 5, diamonds: 5 } });
    return res.end('ok');
  }
  if (url === '/stats/reset' && req.method === 'POST') { resetStats(); return res.end('ok'); }
  if (url === '/room/clear' && req.method === 'POST') { room.clear(); roomDirty = true; return res.end('ok'); } // vuelven a salir en cuanto den señales
  if (url === '/media' && req.method === 'POST') {
    const name = mediaName(new URLSearchParams(req.url.split('?')[1]).get('name'));
    if (!name) { res.statusCode = 400; return res.end('formato no admitido'); }
    return readBody(req, 30e6, b => {
      try { fs.mkdirSync(MEDIA, { recursive: true }); fs.writeFileSync(path.join(MEDIA, name), b); res.end(name); }
      catch { res.statusCode = 500; res.end('no se pudo guardar'); }
    });
  }
  if (url === '/media') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(listMedia())); }
  if (url.startsWith('/media/')) {
    let name; try { name = mediaName(decodeURIComponent(url.slice(7))); } catch {} // un %XX mal formado no debe dejar la petición colgada
    if (!name || !fs.existsSync(path.join(MEDIA, name))) { res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', MEDIA_TYPES[path.extname(name).toLowerCase()]);
    return fs.createReadStream(path.join(MEDIA, name)).pipe(res);
  }
  if (url === '/lib/lottie.js') { // reproductor de animaciones Lottie para las alertas (sin depender de internet)
    res.setHeader('content-type', 'text/javascript'); res.setHeader('cache-control', 'max-age=86400');
    return fs.createReadStream(path.join(__dirname, 'node_modules/lottie-web/build/player/lottie_light.min.js')).pipe(res);
  }
  if (url.startsWith('/auth/twitch')) return twitchAuthRoute(url, req, res);
  if (url === '/config') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(cfg)); }
  const lg = /^\/logos\/(twitch|youtube|tiktok|kick)$/.exec(url);
  if (lg) {
    const dir = path.join(__dirname, 'logos');
    const f = fs.existsSync(dir) && fs.readdirSync(dir).find(n => n.toLowerCase().startsWith(lg[1] + '.'));
    const type = f && { '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' }[path.extname(f).toLowerCase()];
    if (!type) { res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', type);
    return fs.createReadStream(path.join(dir, f)).pipe(res);
  }
  if (!PAGES[url]) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  fs.createReadStream(path.join(__dirname, PAGES[url])).pipe(res);
});

const wss = new WebSocket.Server({ server, verifyClient: ({ req }) => trusted(req) && sameOrigin(req) });
wss.on('error', () => {}); // el puerto ocupado ya lo gestiona server.on('error') (reintenta tras un reinicio); sin esto el proceso se caía
const send = (o, only) => { const s = JSON.stringify(o); for (const c of only ? [only] : wss.clients) if (c.readyState === 1) c.send(s); };
const BOOT = { at: Date.now(), text: process.env.CU_RESTART ? `🔄 Livalyst v${VERSION} se ha actualizado` : process.argv.includes('--reiniciado') ? `🔄 Livalyst v${VERSION} se ha reiniciado` : `✅ Livalyst v${VERSION} se ha iniciado` };
const sendRoom = () => { const s = JSON.stringify({ room: [...room.values()] }); for (const c of wss.clients) if (c.wantsRoom && c.readyState === 1) c.send(s); };
wss.on('connection', (ws, req) => {
  ws.wantsRoom = req.url.includes('room'); // solo el panel del chat pinta la sala
  send({ boot: BOOT, cfg, status, emotes, viewers, history, events, auth: twAuthState, alert: lastAlert, stats, ...(ws.wantsRoom && { room: [...room.values()] }) }, ws);
});

const stamp = m => ({ roles: [], ...m, id: String(m.id || 'm' + ++seq), user: m.user || '?', login: (m.login || m.user || '').toLowerCase(), ts: Date.now() });
// Mensaje de chat. m: { p, user, login?, color?, parts, roles?, first?, id?, extra? }
function msg(m) {
  m = stamp(m); delete m.ev; seen(m.p, m.user, m.login, 'here', m.avatar);
  history.push(m); if (history.length > 300) history.shift();
  send({ msg: m });
}
// Evento real que manda la plataforma (regalo, sub, follow…). Solo se crea desde aquí, nunca a partir del texto del chat.
// m: { p, ev, user, parts, amount?, big? }
function event(m) {
  m = stamp(m); seen(m.p, m.user, m.login, 'here', m.avatar);
  events.push(m); if (events.length > 200) events.shift();
  send({ ev: m });
}
function del(pred) {
  const ids = history.filter(pred).map(m => m.id);
  if (!ids.length) return;
  for (const id of ids) history.splice(history.findIndex(m => m.id === id), 1);
  send({ del: ids });
}
// ---------- sala: quién está en el directo ----------
// Twitch avisa de entradas y salidas (JOIN/PART del chat, con algo de retraso): al salir se quita al momento.
// Con la cuenta de Twitch conectada, además se pide cada 30 s la lista oficial de quién está en el chat y se quita a quien ya no está.
// TikTok y YouTube no avisan de las salidas: cada entrada, mensaje, regalo o like cuenta como «sigue aquí»
// (el top de espectadores de TikTok no sirve: puede incluir a gente que ya se fue y la mantenía para siempre),
// y quien pasa IDLE sin dar ninguna señal se quita (puede que siguiera mirando en silencio).
const room = new Map(), ROOM_MAX = 400, IDLE = 3 * 60e3, twAvatar = new Map();
let twChattersOk = null; // null = sin probar, false = la cuenta no tiene el permiso moderator:read:chatters
let roomDirty = false;
function seen(p, user, login, how = 'here', avatar) { // how: 'join' | 'here' | 'part'
  const id = (login || user || '').toLowerCase();
  if (!p || !id || id === '?') return;
  const k = p + ':' + id, now = Date.now(), r = room.get(k);
  if (how === 'part') { if (room.delete(k)) roomDirty = true; return; }
  if (!r) room.set(k, { k, p, user: user || login, login: id, avatar: avatar || twAvatar.get(id), since: now, last: now });
  else { r.last = now; if (user) r.user = user; if (avatar) r.avatar = avatar; }
  roomDirty = true;
}
// Twitch no manda la foto por el chat: se pide a la API (de 100 en 100) si la cuenta de Twitch está conectada.
async function twitchAvatars() {
  const need = [...room.values()].filter(r => r.p === 'twitch' && !r.avatar && !twAvatar.has(r.login)).slice(0, 100).map(r => r.login);
  if (!need.length || !twAuth) return;
  need.forEach(l => twAvatar.set(l, '')); // no repetir la petición aunque falle
  try {
    const res = await helix('users?' + need.map(l => 'login=' + encodeURIComponent(l)).join('&'));
    for (const u of (await res.json()).data || []) {
      twAvatar.set(u.login, u.profile_image_url);
      const r = room.get('twitch:' + u.login); if (r) { r.avatar = u.profile_image_url; roomDirty = true; }
    }
  } catch {}
}
async function twitchChatters() {
  const ch = twitchChannel();
  if (!twAuth || twChattersOk === false || ch !== twAuth.login || !status.twitch) return;
  const start = Date.now(), live = new Set(), id = twAuth.user_id;
  let after = '';
  try {
    do { // ponytail: tope de 5.000 personas; más allá de eso el panel no las podría pintar igualmente
      const res = await helix(`chat/chatters?broadcaster_id=${id}&moderator_id=${id}&first=1000${after && '&after=' + after}`);
      if (res.status === 401 || res.status === 403) {
        twChattersOk = false;
        return setAuth(twAuthState.ok, twAuthState.msg + ' · vuelve a conectar la cuenta para ver la sala de Twitch al momento');
      }
      if (!res.ok) return;
      const j = await res.json();
      for (const u of j.data || []) if (u.user_login !== ch) { live.add(u.user_login); seen('twitch', u.user_name, u.user_login); }
      after = j.pagination?.cursor || '';
    } while (after && live.size < 5000);
    twChattersOk = true;
  } catch { return; }
  for (const [k, r] of room) // quien ya no sale en la lista se ha ido (salvo si acaba de entrar y la lista aún no lo incluye)
    if (r.p === 'twitch' && !live.has(r.login) && r.since < start - 60e3) { room.delete(k); roomDirty = true; }
}
setInterval(twitchChatters, 30e3).unref();
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of room) if (r.p !== 'twitch' && now - r.last > IDLE) { room.delete(k); roomDirty = true; }
  if (room.size > ROOM_MAX) [...room].sort((a, b) => a[1].last - b[1].last).slice(0, room.size - ROOM_MAX).forEach(([k]) => room.delete(k));
  twitchAvatars();
  if (roomDirty) { roomDirty = false; sendRoom(); }
}, 2000).unref();

function setStatus(p, s) { status[p] = s; send({ status }); console.log(`[${p}] ${s}`); }
// Reintenta cada minuto hasta que empiece el directo. Cada conexión llama a done() una sola vez.
function retrier(p, fn, g) {
  let used = false;
  return (ms = 60000, s = 'esperando directo') => {
    if (used || g !== gen) return; used = true;
    if (p === 'tiktok') { delete viewers.tiktok; send({ viewers }); }
    setStatus(p, s); setTimeout(() => g === gen && fn(g), ms);
  };
}

function restart() {
  gen++; Object.values(stoppers).forEach(f => { try { f(); } catch {} }); stoppers = {}; status = {}; viewers = {}; room.clear(); roomDirty = true;
  const g = gen;
  for (const [p, fn] of Object.entries({ twitch, youtube, tiktok, kick }))
    if (cfg[p]) try { fn(g); } catch (e) { setStatus(p, 'error: ' + e.message); }
  loadEmotes().catch(() => {});
  send({ status, viewers });
}

// Mensajes falsos para probar el aspecto sin estar en directo.
function sample() {
  const ps = ['twitch', 'youtube', 'tiktok', 'kick'].filter(p => cfg[p]);
  const lines = [
    ['Pepe_Gamer', '¡Buenas tardes! Qué tal el directo KEKW', ['subscriber']],
    ['LaModeradora', 'Recordad las normas del chat 😊 catJAM', ['moderator']],
    ['NuevoViewer', 'Primera vez por aquí, me encanta el contenido', [], true],
    ['Fan_123', `@${cfg.twitch || cfg.tiktok || 'streamer'} ¿qué juego viene después? PogChamp`, ['vip']],
  ];
  (ps.length ? ps : ['twitch', 'tiktok']).forEach((p, i) => lines.forEach(([u, t, roles, first], j) =>
    setTimeout(() => msg({ p, user: u, parts: [{ t }], roles, first, color: p === 'twitch' ? ['#FF7F50', '#1E90FF', '#9ACD32', '#DA70D6'][j] : null }), (i * lines.length + j) * 350)));
  setTimeout(() => msg({ p: 'tiktok', user: '🎁 Troll', parts: [{ t: 'ha enviado Rosa x5 💎 50 (esto es un mensaje de chat, no un regalo)' }] }), 2800);
  setTimeout(() => event({ p: 'tiktok', ev: 'gift', user: 'Generoso', parts: [{ t: 'ha enviado Rosa x5' }], amount: '💎 5', gift: 'Rosa', n: 5, diamonds: 5 }), 3100);
  setTimeout(() => event({ p: 'tiktok', ev: 'gift', user: 'Ballena', parts: [{ t: 'ha enviado León x1' }], amount: '💎 29999', big: true, gift: 'León', n: 1, diamonds: 29999 }), 3300);
  setTimeout(() => event({ p: 'tiktok', ev: 'follow', user: 'NuevoSeguidor', parts: [{ t: 'te ha empezado a seguir' }] }), 3500);
  setTimeout(() => event({ p: 'twitch', ev: 'sub', user: 'Pepe_Gamer', parts: [{ t: 'se ha suscrito durante 6 meses' }] }), 3700);
  setTimeout(() => event({ p: 'twitch', ev: 'bits', user: 'Fan_123', parts: [{ t: '¡Vamos!' }], amount: '💎 500 bits', big: true, gift: 'bits', n: 500, diamonds: 500 }), 3900);
  setTimeout(() => event({ p: 'twitch', ev: 'follow', user: 'SeguidorDeTwitch', parts: [{ t: 'te ha empezado a seguir' }] }), 4100);
  setTimeout(() => event({ p: 'twitch', ev: 'redeem', user: 'LaModeradora', parts: [{ t: 'ha canjeado «Hidratarse»' }], amount: '🔹 500' }), 4300);
  setTimeout(() => { send({ join: { user: 'Visitante' } }); seen(ps.includes('tiktok') ? 'tiktok' : ps[0] || 'tiktok', 'Visitante', 'visitante', 'join'); }, 3800);
  setTimeout(() => seen('twitch', 'Mirón', 'miron', 'join'), 1000);
  setTimeout(() => seen('twitch', 'Mirón', 'miron', 'part'), 6000);
  setTimeout(() => { lastAlert = { ...alertFromTikTok('test', { punishInfo: { punishTypeId: 70, duration: '1800' }, dialog: { title: { defaultPattern: '(PRUEBA) Tu LIVE solo se mostrará a mayores de 18 por lenguaje inapropiado' } } }) }; send({ alert: lastAlert }); }, 4600);
}

// ---------- plataformas ----------
function twitch(g) {
  const ch = twitchChannel();
  const done = retrier('twitch', twitch, g);
  const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  own('twitch', () => ws.terminate());
  ws.on('open', () => {
    ['CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership', 'PASS SCHMOOPIIE', 'NICK justinfan' + (Math.random() * 1e5 | 0), 'JOIN #' + ch].forEach(l => ws.send(l));
    setStatus('twitch', 'conectado');
  });
  ws.on('message', d => String(d).split('\r\n').forEach(line => {
    if (line.startsWith('PING')) return ws.send('PONG :tmi.twitch.tv');
    if (/^:\S+ 353 /.test(line)) return line.slice(line.indexOf(' :') + 2).split(' ').forEach(n => n !== ch && !n.startsWith('justinfan') && seen('twitch', n, n));
    const m = parseIrc(line);
    if (!m) return;
    if ((m.cmd === 'JOIN' || m.cmd === 'PART') && m.nick !== ch && !m.nick.startsWith('justinfan')) return seen('twitch', m.nick, m.nick, m.cmd === 'JOIN' ? 'join' : 'part');
    const t = m.tags, base = { p: 'twitch', id: t.id, user: t['display-name'] || t.login || m.nick, login: t.login || m.nick, color: t.color, roles: twitchRoles(t.badges) };
    if (m.cmd === 'ROOMSTATE' && t['room-id']) loadEmotes(ch, t['room-id']).catch(() => {});
    if (m.cmd === 'PRIVMSG' && t.bits) event({ ...base, ev: 'bits', parts: twitchParts(m.text, t.emotes), amount: `💎 ${t.bits} bits`, big: +t.bits >= 500, gift: 'bits', n: +t.bits, diamonds: +t.bits });
    else if (m.cmd === 'PRIVMSG') msg({ ...base, parts: twitchParts(m.text, t.emotes), first: t['first-msg'] === '1' });
    if (m.cmd === 'USERNOTICE') { // subs, subs regaladas, raids… (los anuncios de mods van al chat)
      const kind = { sub: 'sub', resub: 'sub', subgift: 'subgift', submysterygift: 'subgift', anonsubgift: 'subgift', raid: 'raid' }[t['msg-id']];
      const parts = [{ t: ircUnescape(t['system-msg']) }];
      if (m.text) parts.push({ t: ' — ' }, ...twitchParts(m.text, t.emotes));
      if (kind) event({ ...base, ev: kind, parts, big: kind === 'raid' || +t['msg-param-mass-gift-count'] >= 5 });
      else msg({ ...base, parts });
    }
    if (m.cmd === 'CLEARMSG') del(x => x.p === 'twitch' && x.id === t['target-msg-id']);
    if (m.cmd === 'CLEARCHAT') del(x => x.p === 'twitch' && (!m.text || x.login === m.text.toLowerCase()));
  }));
  ws.on('close', () => done(5000, 'reconectando'));
  ws.on('error', () => {});
}

function youtube(g) {
  const v = cfg.youtube.trim().replace(/.*youtube\.com\/(channel\/)?/, '').replace(/\/.*/, '');
  const done = retrier('youtube', youtube, g);
  const lc = new LiveChat(v.startsWith('UC') ? { channelId: v } : { handle: v.startsWith('@') ? v : '@' + v });
  own('youtube', () => lc.stop());
  lc.on('chat', c => {
    const m = {
      p: 'youtube', id: c.id, user: c.author.name, login: c.author.channelId, avatar: c.author.thumbnail?.url,
      roles: [c.isOwner && 'broadcaster', c.isModerator && 'moderator', c.isMembership && 'subscriber'].filter(Boolean),
      parts: c.message.map(x => (x.url ? { img: x.url, alt: x.alt || x.emojiText } : { t: x.text })),
    };
    c.superchat ? event({ ...m, ev: 'superchat', amount: `💰 ${c.superchat.amount}`, big: true }) : msg(m);
  });
  lc.on('end', () => done());
  lc.on('error', () => {});
  lc.start().then(ok => (ok ? g === gen && setStatus('youtube', 'en directo') : done())).catch(() => done());
}

function tiktok(g) {
  const done = retrier('tiktok', tiktok, g);
  const c = new TikTokLiveConnection(cfg.tiktok.trim(), {});
  own('tiktok', () => c.disconnect());
  const name = u => u?.nickname || u?.uniqueId || u?.displayId, pic = u => u?.avatarThumb?.urlList?.[0];
  const base = d => ({
    p: 'tiktok', user: name(d.user), login: d.user?.uniqueId || d.user?.displayId, avatar: pic(d.user),
    roles: [d.userIdentity?.isAnchor && 'broadcaster', d.userIdentity?.isModeratorOfAnchor && 'moderator', d.userIdentity?.isSubscriberOfAnchor && 'subscriber'].filter(Boolean),
  });
  // v2.5 usa `content` (el README aún dice `comment`, que llega vacío)
  c.on(WebcastEvent.CHAT, d => msg({ ...base(d), id: d.common?.msgId, parts: tiktokParts(d.content ?? d.comment ?? '', d.emotes) }));
  c.on(WebcastEvent.EMOTE, d => msg({ ...base(d), parts: (d.emoteList || []).map(e => ({ img: e.image?.urlList?.[0], alt: '' })).filter(p => p.img) }));
  c.on(WebcastEvent.MEMBER, d => { seen('tiktok', name(d.user), d.user?.uniqueId, 'join', pic(d.user)); send({ join: { user: name(d.user) || 'Alguien' } }); }); // no va al historial
  c.on(WebcastEvent.GIFT, d => {
    const gift = d.giftDetails || d.gift || {};
    if ((gift.giftType ?? gift.type) === 1 && !d.repeatEnd) return; // racha en curso: se muestra solo al terminar
    const icon = gift.giftImage?.giftPictureUrl || gift.image?.urlList?.[0] || gift.icon?.urlList?.[0];
    const n = d.repeatCount || 1, diamonds = (gift.diamondCount || 0) * n, giftName = gift.giftName || gift.name || 'un regalo';
    const who = base(d);
    addTop(stats.top, who.login, who.user, diamonds);
    bump('diamonds', diamonds);
    event({ ...who, ev: 'gift', parts: [{ t: `ha enviado ${giftName}` }, ...(icon ? [{ img: icon, alt: '' }] : []), { t: ` x${n}` }],
      amount: diamonds ? `💎 ${diamonds}` : '', big: diamonds >= 100, gift: giftName, n, diamonds, icon });
  });
  c.on(WebcastEvent.FOLLOW, d => { bump('follows', 1); event({ ...base(d), ev: 'follow', parts: [{ t: 'te ha empezado a seguir' }] }); });
  c.on(WebcastEvent.SHARE, d => { bump('shares', 1); event({ ...base(d), ev: 'share', parts: [{ t: 'ha compartido el directo' }] }); });
  c.on(WebcastEvent.LIKE, d => {
    seen('tiktok', name(d.user), d.user?.uniqueId, 'here', pic(d.user));
    +d.total > 0 ? bump('likes', Math.max(stats.likes, +d.total), true) : bump('likes', +d.count || 0); // total = likes de toda la sala
  });
  c.on(WebcastEvent.SUB_NOTIFY, d => event({ ...base(d), ev: 'sub', parts: [{ t: +d.subMonth > 1 ? `se ha suscrito (${d.subMonth} meses)` : 'se ha suscrito' }], big: true }));
  // Avisos de moderación de TikTok (los que Live Studio enseña como ventana): sanciones, restricción +18, suspensión…
  c.on(WebcastEvent.PERCEPTION, d => tiktokAlert('perception', d));
  c.on(WebcastEvent.ACCESS_RECALL, d => tiktokAlert('accessRecall', d));
  c.on(WebcastEvent.CONTROL_MESSAGE, d => (d.punishInfo || d.perceptionDialog || d.action === 4) && tiktokAlert('control', d));
  c.on(WebcastEvent.NOTICE, d => d.violationReason && tiktokAlert('notice', d));
  c.on(WebcastEvent.ROOM_VERIFY, d => (d.closeRoom || d.content) && tiktokAlert('roomVerify', d));
  c.on(WebcastEvent.ROOM_USER, d => { const n = +(d.viewerCount ?? d.total); if (n >= 0) { viewers.tiktok = n; send({ viewers }); } });
  let live = false;
  c.on(WebcastEvent.STREAM_END, () => {
    for (const [k, r] of room) if (r.p === 'tiktok') { room.delete(k); roomDirty = true; } // directo terminado: sala de TikTok vacía
    done();
  });
  c.on('disconnected', () => (live ? done(5000, 'reconectando') : done())); // corte en pleno directo: volver enseguida
  c.on('error', () => {});
  c.connect().then(st => {
    if (g !== gen) return;
    if (st?.roomId && st.roomId !== stats.room) resetStats(st.roomId); // directo nuevo: metas a cero
    live = true; setStatus('tiktok', 'en directo');
  }).catch(() => done());
}

async function kick(g) {
  const slug = cfg.kick.trim().toLowerCase().replace(/.*kick\.com\//, '');
  const done = retrier('kick', kick, g);
  try {
    const r = await fetch('https://kick.com/api/v2/channels/' + slug, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    const chatroom = (await r.json()).chatroom.id;
    if (g !== gen) return;
    const ws = new WebSocket('wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flavor=false');
    own('kick', () => ws.terminate());
    ws.on('open', () => {
      ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${chatroom}.v2` } }));
      setStatus('kick', 'conectado');
    });
    ws.on('message', d => { try {
      const e = JSON.parse(d);
      if (e.event === 'pusher:ping') ws.send('{"event":"pusher:pong","data":{}}');
      if (e.event === 'App\\Events\\ChatMessageEvent') {
        const m = JSON.parse(e.data), badges = (m.sender?.identity?.badges || []).map(b => b.type);
        msg({ p: 'kick', id: m.id, user: m.sender?.username, color: m.sender?.identity?.color, parts: kickParts(m.content || ''),
          roles: ['broadcaster', 'moderator', 'vip', 'subscriber'].filter(r => badges.includes(r) || (r === 'subscriber' && badges.includes('founder'))) });
      }
      // ponytail: formato de subs de Kick sin probar en directo real; si no aparecen, revisar estos nombres de evento
      if (e.event === 'App\\Events\\SubscriptionEvent') { const s = JSON.parse(e.data); event({ p: 'kick', ev: 'sub', user: s.username, parts: [{ t: s.months > 1 ? `se ha suscrito (${s.months} meses)` : 'se ha suscrito' }] }); }
      if (e.event === 'App\\Events\\GiftedSubscriptionsEvent') { const s = JSON.parse(e.data), n = (s.gifted_usernames || []).length; event({ p: 'kick', ev: 'subgift', user: s.gifter_username || 'Anónimo', parts: [{ t: `ha regalado ${n} sub${n === 1 ? '' : 's'}` }], big: n >= 5 }); }
      if (e.event === 'App\\Events\\MessageDeletedEvent') { const id = JSON.parse(e.data).message?.id; del(x => x.p === 'kick' && x.id === id); }
    } catch {} });
    ws.on('close', () => done(5000, 'reconectando'));
    ws.on('error', () => {});
  } catch { done(60000, 'no se pudo conectar, reintentando'); }
}

// ---------- avisos de moderación de TikTok ----------
function tiktokAlert(kind, d) {
  try { fs.appendFileSync(path.join(DATA, 'tiktok-avisos.log'), `${new Date().toISOString()} ${kind} ${JSON.stringify(d)}\n`); } catch {}
  lastAlert = alertFromTikTok(kind, d);
  send({ alert: lastAlert });
  event({ p: 'tiktok', ev: 'mod', user: 'TikTok', parts: [{ t: lastAlert.title.replace(/^\S+\s/, '') }], big: true });
}

// ---------- emotes FFZ / BTTV / 7TV (se aplican a todas las plataformas) ----------
async function loadEmotes(login, id) {
  const mySeq = ++emoteSeq; // gana la última carga (la del canal), no la de solo globales
  const get = u => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const map = {};
  const add = (name, url) => { if (name && url) map[name] = url.startsWith('//') ? 'https:' + url : url; };
  const ffz = (d, ids) => d && (ids || Object.keys(d.sets || {})).forEach(k => d.sets?.[k]?.emoticons.forEach(e => add(e.name, e.urls['2'] || e.urls['1'])));
  const bttv = l => (l || []).forEach(e => add(e.code, `https://cdn.betterttv.net/emote/${e.id}/2x`));
  const stv = l => (l || []).forEach(e => add(e.name, e.data?.host?.url && e.data.host.url + '/2x.webp'));

  const [bg, bc, fg, fc, sg, sc] = await Promise.all([
    cfg.bttv && get('https://api.betterttv.net/3/cached/emotes/global'),
    cfg.bttv && id && get('https://api.betterttv.net/3/cached/users/twitch/' + id),
    cfg.ffz && get('https://api.frankerfacez.com/v1/set/global'),
    cfg.ffz && login && get('https://api.frankerfacez.com/v1/room/' + login),
    cfg.seventv && get('https://7tv.io/v3/emote-sets/global'),
    cfg.seventv && id && get('https://7tv.io/v3/users/twitch/' + id),
  ]);
  bttv(bg); bttv(bc?.channelEmotes); bttv(bc?.sharedEmotes);
  ffz(fg, fg?.default_sets); ffz(fc);
  stv(sg?.emotes); stv(sc?.emote_set?.emotes);
  if (mySeq !== emoteSeq) return;
  emotes = map;
  send({ emotes });
  console.log(`[emotes] ${Object.keys(map).length} cargados`);
}

let portTries = 0;
server.on('error', e => {
  // tras un reinicio automático el proceso viejo tarda un instante en soltar el puerto
  if (e.code === 'EADDRINUSE' && (process.env.CU_RESTART || process.argv.includes('--reiniciado')) && portTries++ < 20) return setTimeout(() => server.listen(PORT), 500);
  console.error(e.code === 'EADDRINUSE' ? 'Ya está abierto.' : e); process.exit(0);
});
// Si se actualiza server.js, se reinicia solo (antes seguía funcionando la versión vieja hasta reabrir el lanzador).
// Un fallo inesperado (p. ej. un dato raro de una plataforma) se apunta en el registro en vez de cerrar Livalyst y cortar el chat.
process.on('uncaughtException', e => console.error(new Date().toLocaleTimeString('es-ES'), '[error]', e?.stack || e));
process.on('unhandledRejection', e => console.error(new Date().toLocaleTimeString('es-ES'), '[error]', e?.stack || e));
try { require('os').setPriority(require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch {} // Livalyst nunca compite con el juego ni con OBS
fs.watchFile(__filename, { interval: 2000 }, (now, prev) => {
  if (now.mtimeMs === prev.mtimeMs || !now.size) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(reload, 1500); // esperar a que termine de copiarse
});
let reloadTimer;
function reload() {
  const cp = require('child_process');
  if (cp.spawnSync(process.execPath, ['--check', __filename]).status !== 0) return console.log('server.js nuevo con errores: sigo con la versión actual');
  console.log('server.js actualizado: reiniciando…');
  let out = 'ignore'; // la versión nueva sigue escribiendo en el mismo registro… salvo si Windows lo tiene bloqueado: entonces reinicia igual, sin registro
  try { out = fs.openSync(path.join(__dirname, 'livalyst.log'), 'a'); } catch {}
  cp.spawn(process.execPath, [__filename], { cwd: __dirname, detached: true, stdio: ['ignore', out, out], windowsHide: true,
    env: { ...process.env, CU_RESTART: '1' } }).unref();
  process.exit(0);
}
// ---------- cuenta de Twitch (EventSub): follows, canjes de puntos, hype train, shoutouts y power-ups ----------
// El chat de Twitch se lee sin cuenta; esto añade los eventos que Twitch solo da al dueño del canal.
// El token se guarda en twitch-auth.json (nunca en config.json, que se envía al panel).
const AUTH = path.join(DATA, 'twitch-auth.json');
const TW_SCOPES = 'moderator:read:followers channel:read:redemptions channel:read:hype_train moderator:read:shoutouts bits:read moderator:read:chatters';
const REDIRECT = `http://localhost:${PORT}/auth/twitch`;
let twAuth = null, twAuthState = { ok: false, msg: 'sin conectar' }, oauthState = null, esGen = 0, esWs = null;
try { twAuth = JSON.parse(fs.readFileSync(AUTH, 'utf8')); } catch {}

function setAuth(ok, msg) { twAuthState = { ok, msg }; send({ auth: twAuthState }); console.log('[cuenta twitch] ' + msg); }
const validate = token => fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + token } }).then(r => (r.ok ? r.json() : null)).catch(() => null);
function stopEventSub() { esGen++; if (esWs) { esWs.retired = true; try { esWs.terminate(); } catch {} } esWs = null; }

async function startEventSub() {
  stopEventSub();
  if (!twAuth) return setAuth(false, 'sin conectar');
  const my = esGen;
  if (!(await validate(twAuth.token))) { if (my === esGen) setAuth(false, 'la sesión ha caducado: vuelve a conectar la cuenta'); return; }
  if (my === esGen) connectEventSub('wss://eventsub.wss.twitch.tv/ws', my);
}
function connectEventSub(url, my, prev) {
  const ws = new WebSocket(url);
  let keepalive = 10, timer;
  const watchdog = () => { clearTimeout(timer); timer = setTimeout(() => ws.terminate(), (keepalive + 10) * 1000); };
  esWs = ws;
  ws.on('message', async d => { try {
    const { metadata: md, payload: pl } = JSON.parse(d);
    if (my !== esGen) return;
    watchdog();
    if (md.message_type === 'session_welcome') {
      keepalive = pl.session.keepalive_timeout_seconds || 10; watchdog();
      if (prev) { prev.retired = true; prev.terminate(); } // reconexión pedida por Twitch: las suscripciones se mantienen
      else await subscribeAll(pl.session.id, my);
    }
    if (md.message_type === 'session_reconnect') connectEventSub(pl.session.reconnect_url, my, ws);
    if (md.message_type === 'notification') twitchEvent(pl.subscription.type, pl.event);
    if (md.message_type === 'revocation') setAuth(false, 'Twitch ha retirado un permiso: vuelve a conectar la cuenta');
  } catch {} });
  ws.on('close', () => {
    clearTimeout(timer);
    if (ws.retired || my !== esGen) return;
    setAuth(false, 'reconectando eventos…');
    setTimeout(() => my === esGen && startEventSub(), 5000);
  });
  ws.on('error', () => {});
}
async function subscribeAll(session, my) {
  const id = twAuth.user_id, both = { broadcaster_user_id: id, moderator_user_id: id }, self = { broadcaster_user_id: id };
  const subs = [['channel.follow', '2', both, 'follows'], ['channel.channel_points_custom_reward_redemption.add', '1', self, 'canjes'],
    ['channel.hype_train.begin', '2', self, 'hype train'], ['channel.hype_train.end', '2', self, 'hype train'],
    ['channel.shoutout.receive', '1', both, 'shoutouts'], ['channel.bits.use', '1', self, 'power-ups']];
  const ok = await Promise.all(subs.map(([type, version, condition]) => fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST', headers: { 'Client-Id': twAuth.client_id, Authorization: 'Bearer ' + twAuth.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, version, condition, transport: { method: 'websocket', session_id: session } }),
  }).then(r => r.ok).catch(() => false)));
  if (my !== esGen) return;
  const missing = [...new Set(subs.filter((_, i) => !ok[i]).map(s => s[3]))];
  setAuth(ok.some(Boolean), (ok.some(Boolean) ? `conectado como ${twAuth.login}` : 'no se pudo activar ningún evento') + (missing.length ? ` (sin ${missing.join(', ')})` : ''));
}
const POWER_UP = { message_effect: 'un efecto de mensaje', celebration: 'una celebración', gigantify_an_emote: 'un emote gigante' };
function twitchEvent(type, e) {
  const base = { p: 'twitch', user: e.user_name, login: e.user_login };
  if (type === 'channel.follow') event({ ...base, ev: 'follow', parts: [{ t: 'te ha empezado a seguir' }] });
  if (type === 'channel.channel_points_custom_reward_redemption.add')
    event({ ...base, ev: 'redeem', parts: [{ t: `ha canjeado «${e.reward?.title || 'una recompensa'}»` }, ...(e.user_input ? [{ t: ' — ' + e.user_input }] : [])], amount: `🔹 ${e.reward?.cost ?? ''}` });
  if (type === 'channel.hype_train.begin') event({ p: 'twitch', ev: 'hype', user: 'Hype Train', parts: [{ t: `¡ha empezado! (nivel ${e.level ?? 1})` }], big: true });
  if (type === 'channel.hype_train.end') event({ p: 'twitch', ev: 'hype', user: 'Hype Train', parts: [{ t: `ha terminado en el nivel ${e.level}` }], big: true });
  if (type === 'channel.shoutout.receive')
    event({ p: 'twitch', ev: 'shoutout', user: e.from_broadcaster_user_name, parts: [{ t: `te ha hecho un shoutout (${e.viewer_count ?? 0} espectadores)` }], big: true });
  if (type === 'channel.bits.use' && e.type !== 'cheer') // los cheers normales ya llegan por el chat
    event({ ...base, ev: 'powerup', parts: [{ t: `ha usado ${POWER_UP[e.power_up?.type] || e.custom_power_up?.title || 'un Power-up'}` }, ...(e.message?.text ? [{ t: ' — ' + e.message.text }] : [])],
      amount: `💎 ${e.bits} bits`, big: e.bits >= 500, gift: 'bits', n: e.bits, diamonds: e.bits });
}
setInterval(async () => { if (twAuth && !(await validate(twAuth.token))) { stopEventSub(); setAuth(false, 'la sesión ha caducado: vuelve a conectar la cuenta'); } }, 3600e3); // Twitch pide validar cada hora

const CALLBACK_PAGE = `<!doctype html><meta charset="utf-8"><title>Conectar Twitch</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0e0e10;color:#efeff1;font:16px system-ui,sans-serif;text-align:center">
<p id="m">Conectando…</p><script>
const h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search), m = document.getElementById('m');
history.replaceState(null, '', location.pathname); // que el token no se quede en la barra de direcciones
if (!h.get('access_token')) m.textContent = 'No se ha conectado: ' + (q.get('error_description') || 'permiso denegado');
else fetch('/auth/twitch/token', { method: 'POST', body: JSON.stringify({ token: h.get('access_token'), state: h.get('state') }) })
  .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
  .then(d => m.textContent = '✅ Cuenta conectada: ' + d.login + '. Ya puedes cerrar esta ventana.')
  .catch(t => m.textContent = 'No se pudo conectar: ' + (t || 'inténtalo otra vez desde el panel'));
</script>`;
function twitchAuthRoute(url, req, res) {
  const page = (code, html) => { res.statusCode = code; res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html); };
  if (url === '/auth/twitch/start') {
    const id = cfg.twitchClientId.trim();
    if (!/^[a-z0-9]{20,40}$/.test(id)) return page(400, '<p style="font:16px system-ui">Primero pega el Client ID de tu aplicación de Twitch en los ajustes del panel.</p>');
    oauthState = require('crypto').randomBytes(16).toString('hex');
    res.statusCode = 302;
    res.setHeader('location', 'https://id.twitch.tv/oauth2/authorize?' + new URLSearchParams({ response_type: 'token', client_id: id, redirect_uri: REDIRECT, scope: TW_SCOPES, state: oauthState, force_verify: 'true' }));
    return res.end();
  }
  if (url === '/auth/twitch' && req.method === 'GET') return page(200, CALLBACK_PAGE);
  if (url === '/auth/twitch/token' && req.method === 'POST') {
    readBody(req, 1e4, async b => {
      try {
        const { token, state } = JSON.parse(b);
        if (!oauthState || state !== oauthState) throw 'la petición ha caducado, vuelve a pulsar «Conectar» en el panel';
        oauthState = null;
        const v = await validate(token);
        if (!v || v.client_id !== cfg.twitchClientId.trim()) throw 'Twitch no ha aceptado la conexión';
        twAuth = { token, login: v.login, user_id: v.user_id, client_id: v.client_id }; twChattersOk = null;
        fs.writeFileSync(AUTH, JSON.stringify(twAuth));
        startEventSub();
        res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ login: v.login }));
      } catch (e) { res.statusCode = 400; res.end(typeof e === 'string' ? e : 'datos no válidos'); }
    });
    return;
  }
  if (url === '/auth/twitch/logout' && req.method === 'POST') {
    if (twAuth) fetch('https://id.twitch.tv/oauth2/revoke', { method: 'POST', body: new URLSearchParams({ client_id: twAuth.client_id, token: twAuth.token }) }).catch(() => {});
    twAuth = null; try { fs.unlinkSync(AUTH); } catch {}
    stopEventSub(); setAuth(false, 'sin conectar');
    return res.end('ok');
  }
  res.statusCode = 404; res.end();
}

// Diagnóstico de arranque: durante 90 s apunta en el registro cuánto procesador y memoria usa el PC entero y cuánto Livalyst,
// para saber de dónde vienen los tirones del ratón al abrirlo. Medirlo cuesta lo mismo que leer la hora.
function bootDiag() {
  const os = require('os'), cpu = () => os.cpus().reduce((a, c) => { const t = c.times; a.busy += t.user + t.nice + t.sys + t.irq; a.all += t.user + t.nice + t.sys + t.irq + t.idle; return a; }, { busy: 0, all: 0 });
  let prev = cpu(), mine = process.cpuUsage(), n = 0, peak = 0;
  const t = setInterval(() => {
    const now = cpu(), pc = Math.round((now.busy - prev.busy) / Math.max(1, now.all - prev.all) * 100);
    const me = process.cpuUsage(mine), own = Math.round((me.user + me.system) / 1e3 / 5000 / os.cpus().length * 100);
    const mem = Math.round((1 - os.freemem() / os.totalmem()) * 100);
    prev = now; mine = process.cpuUsage(); peak = Math.max(peak, pc);
    console.log(`[diagnóstico +${(++n) * 5}s] procesador del PC ${pc}% · Livalyst ${own}% · memoria del PC en uso ${mem}% · Livalyst ${Math.round(process.memoryUsage().rss / 1048576)} MB`);
    if (n === 18) { clearInterval(t); console.log(`[diagnóstico] pico del procesador del PC al arrancar: ${peak}%`); }
  }, 5000);
  t.unref();
}

server.listen(PORT, () => {
  bootDiag();
  console.log(`Livalyst v${VERSION} en http://localhost:${PORT} (datos en ${DATA})`); restart(); startEventSub();
  bandeja();
});
// Icono junto al reloj de Windows (build/bandeja.cs). Si ya hay uno, el nuevo se cierra solo.
function bandeja() {
  const exe = path.join(__dirname, 'LivalystBandeja.exe');
  if (process.platform !== 'win32' || !fs.existsSync(exe)) return;
  try { require('child_process').spawn(exe, [], { detached: true, stdio: 'ignore' }).unref(); } catch (e) { console.log('Sin icono en la bandeja:', e.message); }
}
