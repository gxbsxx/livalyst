# Livalyst

Chat unificado, alertas y metas para OBS. Junta en un solo sitio el chat y los eventos de **Twitch, TikTok, YouTube y Kick**, y añade widgets para el directo.

## Qué incluye

- **Panel del chat** para OBS (dock): todos los chats juntos, con emotes de FrankerFaceZ, BTTV y 7TV, eventos (regalos, subs, follows…) y quién está en la sala.
- **Alertas** de regalos, seguidores, subs y compartidos, con 15 temas, efectos de partículas, sonidos e imágenes propios.
- **Metas** (likes, seguidores, monedas, compartidos) y **ranking de top regaladores**.
- **Avisos de moderación de TikTok** (por ejemplo, la restricción +18) en grande para que no se te pasen.

## Cómo se usa

1. Descarga **Livalyst.zip** de la sección *Releases*, descomprímelo donde quieras y abre **Livalyst.exe**. No hay que instalar nada.
   (Si prefieres usar el código directamente: instala [Node.js](https://nodejs.org) y abre **Iniciar Livalyst.vbs**.)
2. Para cerrarlo y volver a abrirlo, basta con abrir otra vez **Livalyst.exe**: cierra solo la copia anterior.
3. En OBS:
   - Panel del chat: *Docks → Docks de navegador personalizados* con `http://localhost:8787`
   - Configurar widgets: abre `http://localhost:8787/widgets`
   - Alertas: fuente de navegador de 800 × 600 con `http://localhost:8787/alertas`
   - Metas: fuente de navegador de 600 × 120 con `http://localhost:8787/meta?t=likes` (o `follows`, `diamonds`, `shares`)
   - Ranking: fuente de navegador de 600 × 260 con `http://localhost:8787/meta?t=top`

Tus ajustes se guardan aparte (en `%APPDATA%\Livalyst`), así que actualizar la app no los borra.

## Comprobar que todo funciona

```
npm test
```

## Licencia

MIT. Puedes usarlo, cambiarlo y compartirlo libremente.
