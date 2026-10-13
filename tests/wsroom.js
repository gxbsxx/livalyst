const WebSocket = require('../node_modules/ws'); const assert = require('assert');
const count = url => { const c = { room: 0, stats: 0 }; const w = new WebSocket(url, { headers: { Origin: 'http://localhost:8787' } }); w.on('message', d => { const m = JSON.parse(d); if (m.room) c.room++; if (m.stats) c.stats++; }); return c; };
const panel = count('ws://localhost:8787/?room'), overlay = count('ws://localhost:8787/');
setTimeout(() => fetch('http://localhost:8787/test', { method: 'POST' }), 500);
setTimeout(() => { console.log({ panel, overlay }); assert.ok(panel.room > 1 && overlay.room === 0); process.exit(0); }, 7000);
