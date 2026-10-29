# RetroToons

La tele de la tarde de los 90s y 2000s, en **español latino**: seis canales con programación semanal en vivo y una biblioteca para ver cualquier serie cuando quieras.

- **Programación** (`/programacion`): Cartoon Network, Nickelodeon, Jetix, Disney, Warner Channel y FOX, cada uno con su grilla de lunes a viernes, especial del viernes y grillas propias de sábado y domingo. La tele pasa lo que está al aire desde el minuto que corresponde, con placa del canal, zócalo «Estás viendo», tanda con cuenta regresiva, control remoto (↑/↓, 1–6, deslizar en el celular) y modo cine estilo YouTube.
- **Biblioteca** (`/biblioteca`): todas las series de LACartoons con búsqueda, filtros por cadena, favoritos y «Continuar viendo»; más los clásicos que solo están en canales oficiales de YouTube o Pluto TV.

```bash
npm install
cp .env.example .env.local   # claves de TMDB y YouTube
npm run dev                  # http://localhost:3000
```

Necesita el addon de LACartoons corriendo (ver [Addon](#addon-de-lacartoons)). En local, `node addon.js` en el repo del addon (puerto 7000).

## Cómo funciona la programación

- **Canales y bloques:** `src/data/channels.ts`. Cada bloque tiene horario, días (`days`, 0 = domingo) y series por su nombre en LACartoons (`lacartoons`); opcionalmente series locales (`shows`, de `src/data/shows.ts`) que se ven desde otra fuente legal si LACartoons no las tiene. `exclusive: true` es una maratón (solo sus series). Los bloques de cada día tienen que cubrir las 24 hs: lo revisa `node scripts/validate-channels.mjs` (y el CI).
- **Grilla determinística y semanal:** misma fecha + mismo canal = misma grilla para todos (`src/lib/lacartoons-schedule.ts`), guardada en caché por día. Cada franja mantiene el orden de sus series toda la semana (como en la tele) y los episodios avanzan cada día; la semana siguiente se renueva.
- **Solo series con video:** `src/data/playable.json` dice qué series tienen video reproducible. Lo arma `scripts/check-playable.mjs` revisando de a una serie (lo corre una Action cada lunes). La grilla nunca consulta al addon durante una visita.
- **En vivo:** cada espacio trae episodios de reserva de la misma serie (`slot.more`). Si el del espacio no carga, la tele pasa otro desde el mismo punto; si termina con tiempo para otro igual de largo (cortos), sigue con el próximo; si no, tanda hasta el siguiente programa. El cambio de programa se agenda a la hora exacta.
- **Series de otras fuentes:** las icónicas que LACartoons no tiene (o tiene sin video) salen de los canales oficiales de YouTube o de Pluto TV si tienen episodios ahí (`src/lib/catalog.ts`); se reproducen con el embed de la fuente.

## Addon de LACartoons

El catálogo y los videos salen del addon de Stremio [stremio-lacartoons](https://github.com/masilvasol/stremio-lacartoons). La app lo consulta desde el servidor (`LACARTOONS_ADDON_URL`, por defecto `http://127.0.0.1:7000`).

- **Producción:** servicio Docker en Render (`retrotoons-tv-addon`, plan gratis) construido con `addon/Dockerfile` (Root Directory `addon`, variable `PUBLIC_URL` con su URL). La imagen descarga el addon en un commit fijo, instala Chromium de Playwright y aplica `addon/patch-low-memory.js` para entrar en 512 MB (Chromium liviano y una página a la vez). En Vercel, `LACARTOONS_ADDON_URL` apunta a ese servicio.
- **Fuentes:** primero las «(proxy)» del addon (HLS servido por el propio addon, reproducible en el navegador). Las directas de ok.ru piden encabezados y quedan firmadas para la IP del servidor, así que con el addon en la nube suelen fallar.
- **Cachés:** catálogo y fichas 24 h; fuentes de cada episodio 3 h (las URLs firmadas duran ~24 h); grilla por día hasta que cambia `playable.json`.

## Tareas automáticas (GitHub Actions)

| Workflow | Cuándo | Qué hace |
| --- | --- | --- |
| `ci.yml` | cada push y PR | tipos, lint y validación de la programación |
| `prewarm.yml` | cada 30 min (:20 y :50) | pide las fuentes del programa actual y el siguiente de cada canal, así la tele arranca al instante |
| `keep-addon-awake.yml` | cada 10 min | mantiene despierto el addon de Render; si no responde tras varios intentos el workflow falla y GitHub avisa por mail |
| `check-playable.yml` | lunes 03:00 (Argentina) | actualiza `src/data/playable.json` y lo commitea (Vercel redespliega) |

Se pueden correr a mano desde la pestaña **Actions** → workflow → **Run workflow**.

## API propia

| Ruta | Devuelve |
| --- | --- |
| `GET /api/series?q=&genre=&skip=` | Catálogo / búsqueda (sobre el catálogo en caché) → `{ success, results }` |
| `GET /api/series/:id` | Serie + episodios → `{ success, series }` (`series.videos`) |
| `GET /api/series/:episodeId/streams` | Fuentes del episodio → `{ success, streams }` |
| `GET /api/programacion?canal=&fecha=YYYY-MM-DD` | Grilla del día → `{ success, canal, slots }` |
| `GET /api/hls?url=` | Proxy de listas `.m3u8` de Pluto TV (CORS) |

Errores: `{ success: false, error, code }` con `code` en `ADDON_UNREACHABLE`, `ADDON_BAD_RESPONSE`, `INVALID_ID`, `SERIES_NOT_FOUND`, `NO_EPISODES`, `NO_STREAMS`, `MALFORMED_DATA`.

## Fuentes de datos

Configuración en `.env.local` (ver `.env.example`). **Nunca se muestra texto en inglés**: si un episodio no tiene título en español en ninguna fuente, aparece como «Temporada X · Episodio Y».

| Fuente | Para qué | Clave |
| --- | --- | --- |
| LACartoons (addon) | Catálogo, episodios y video de la programación y la biblioteca | — |
| [TMDB](https://developer.themoviedb.org) | Pósters y fondos de las series (si hay una coincidencia confiable), y datos de las series de otras fuentes | `TMDB_API_KEY` o `TMDB_READ_TOKEN` (gratis) |
| [Doblaje Wiki](https://doblaje.fandom.com/es), wikis de fans, [Wikipedia ES](https://es.wikipedia.org) | Títulos latinos y sinopsis de las series de otras fuentes | No necesita (`WIKIMEDIA_CONTACT` recomendado) |
| [YouTube Data API v3](https://developers.google.com/youtube/v3) | Episodios de canales oficiales | `YOUTUBE_API_KEY` (gratis) |
| Pluto TV | Episodios gratis con publicidad (vía `/api/hls`) | No necesita |

### Canales oficiales de YouTube

Cada serie de `shows.ts` puede tener `youtubeChannels`: canales **oficiales** que suben episodios completos. Se lee la lista completa de subidas y se cruza con los episodios por **nombre** (latino u original) o por **número** («T1 EP5», «S01E05»; salvo `matchByNumber: false`). Se descartan compilados y videos que no duran lo que un episodio. Hoy aportan, entre otras, *Tres Espías Sin Límite* y *Kid vs. Kat*. Para sumar un canal: verificá que sea oficial y revisá con una muestra que nombre y número lleven al mismo episodio.

### Pluto TV

Los episodios a demanda de Pluto TV se reproducen en la página con `hls.js`. Pluto solo deja leer sus listas `.m3u8` desde pluto.tv (CORS), así que `/api/hls` hace de proxy **solo de las listas** (restringido a dominios de Pluto); los segmentos van directo de Pluto al navegador, con sus cortes publicitarios. Son endpoints no documentados: si Pluto cambia su web, hay que ajustar `src/lib/pluto.ts`.

> No existe una API legal que entregue episodios completos doblados al latino. Solo se usan canales oficiales, Pluto TV y videos sobre los que se tengan derechos (`src/data/videos.ts`).

## Limitaciones

- El addon corre en el plan gratis de Render (0,1 CPU, 512 MB): un episodio que no está en caché tarda 15–30 s en tener fuentes, más si se piden varios a la vez. La precarga y la caché lo esconden casi siempre.
- El addon no informa la duración de los episodios: cada espacio dura lo del bloque (30 min) y lo que sobra es tanda (o el próximo episodio, en los cortos).
- Algunas series de LACartoons están alojadas en hosts que el addon no logra extraer: quedan fuera de la grilla (las marca `playable.json`).

## Estructura

- `src/data/` — canales y programación semanal (`channels.ts`), series locales para otras fuentes (`shows.ts`), series con video (`playable.json`), videos manuales (`videos.ts`)
- `src/lib/lacartoons.ts` — cliente del addon (validación + errores tipados); tipos compartidos en `lacartoons-types.ts`
- `src/lib/lacartoons-schedule.ts` — grilla semanal de cada canal, catálogo en caché y series de otras fuentes
- `src/lib/catalog.ts` — series de otras fuentes: TMDB, wikis, canales oficiales de YouTube, Pluto TV
- `src/lib/artwork.ts` + `tmdb.ts` — pósters y fondos de TMDB
- `src/lib/user-library.ts` — favoritos y progreso en `localStorage` (seguro para SSR)
- `src/components/VideoPlayer.tsx` — reproductor Video.js 8 (biblioteca y tele en vivo); `TvPlayer.tsx` — la tele retro
- `scripts/` — `check-playable.mjs`, `prewarm.mjs`, `validate-channels.mjs`
- `addon/` — imagen Docker del addon para Render
- `.github/workflows/` — CI y tareas automáticas
