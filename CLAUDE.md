# Livalyst: reglas del proyecto

## Qué es
App local (Node.js, puerto 8787) para streamers: chat unificado de Twitch/TikTok/YouTube/Kick, alertas, metas y ranking para OBS.
- `server.js`: servidor HTTP + WebSocket, conexiones a plataformas, configuración (`clean()` acepta solo claves conocidas).
- `panel.html`: dock del chat de OBS. `widgets.html`: configuración de widgets. `overlay.html`: alertas (`/alertas`), metas y ranking (`/meta?t=…`).
- Datos del usuario en `%APPDATA%\Livalyst` (fuera de la carpeta de la app).

## Cómo trabajar aquí
- El dueño no es programador: explicaciones muy simples, paso a paso, sin abrumar con datos. Todo en español, bien escrito (sin abreviaturas coloquiales).
- Soluciones mínimas que funcionen (estilo Ponytail): reutilizar lo que ya existe, sin dependencias nuevas salvo que hagan falta de verdad.
- Antes de dar algo por terminado: `node server.js test` debe dar `ok`, y lo visual se comprueba con capturas.
- Seguridad: el servidor solo atiende a este PC (`trusted()`); nunca usar innerHTML con texto que venga de un chat.
- Versión: `VERSION` en `server.js` y `version` en `package.json` van a la par (1.x: cambios pequeños suben el segundo número).
- Al cambiar el nombre de la app, actualizarlo en todos los archivos y borrar los que queden con el nombre viejo.
