# RetroToons

Dibujos de los 90s y 2000s (Cartoon Network, Nickelodeon, Disney XD, Jetix, Fox Kids), todo en **español latino**:

- **Programación del día** (`/programacion`): elegís un canal y "sintonizás" lo que está pasando ahora, con grilla por bloques (Toonami, Nicktoons, Jetix Max...), tandas entre programas y episodios que cambian cada día.
- **Biblioteca** (`/biblioteca`): todas las series con búsqueda y filtros; cada serie tiene su lista de episodios para ver el que quieras.

```bash
npm install
cp .env.example .env.local   # claves de TMDB y YouTube
npm run dev                  # http://localhost:3000
```

## Fuentes de datos

Configuración en `.env.local` (ver `.env.example`). **Nunca se muestra texto en inglés**: si un episodio no tiene título en español en ninguna fuente, aparece como "Temporada X · Episodio Y".

| Fuente | Para qué | Clave |
| --- | --- | --- |
| [TMDB](https://developer.themoviedb.org) | Temporadas y episodios, títulos/sinopsis en `es-MX` (y `es-ES` como último recurso), pósters, fondos, presentaciones en español, **dónde verla legalmente** | `TMDB_API_KEY` o `TMDB_READ_TOKEN` (gratis) |
| [Doblaje Wiki](https://doblaje.fandom.com/es) | Títulos **latinos** de episodios (`'''Título latino''' (''Original'')`) | No necesita |
| Wikis de fans (Fandom) | Títulos latinos de series puntuales, configuradas con `fanWiki` en `shows.ts` | No necesita |
| [Wikipedia ES](https://es.wikipedia.org) | Descripción de la serie y anexos "Episodios de …" (título + sinopsis) | No necesita (`WIKIMEDIA_CONTACT` recomendado) |
| [YouTube Data API v3](https://developers.google.com/youtube/v3/docs/search/list) | Video embebible por episodio | `YOUTUBE_API_KEY` (gratis, ≈100 búsquedas/día) |
| [Dailymotion](https://developers.dailymotion.com/api/) | Video embebible por episodio | No necesita para buscar; `NEXT_PUBLIC_DAILYMOTION_PLAYER_ID` para embeber |

- **Título de un episodio:** TMDB es-MX → wiki de fans → Doblaje Wiki → Wikipedia ES → TMDB es-ES → wiki de fans (España). Las wikis se cruzan por el título original en inglés de TMDB (incluye segmentos "A / B" y coincidencia aproximada en las wikis de fans).
- **Video de un episodio:** `src/data/videos.ts` (a mano) → YouTube → Dailymotion → "sin señal". Solo se aceptan videos cuyo título nombre la serie **y** el episodio.
- **Caché:** TMDB 1 día; wikis, YouTube y Dailymotion 7 días. Las wikis a veces limitan pedidos (HTTP 429): esos errores no se guardan en caché y se reintenta en la próxima visita.

> No existe una API legal que entregue episodios completos doblados al latino. YouTube y Dailymotion tienen sobre todo clips e intros subidos por usuarios. Cargá solo videos sobre los que tengas derechos o publicados oficialmente; con `YOUTUBE_CHANNEL_IDS` / `DAILYMOTION_OWNERS` limitás la búsqueda a canales oficiales.

Descartadas: TVmaze (solo en inglés), Fanart.tv (logos, pide clave y ID de TheTVDB), TheTVDB (pago), Jikan/MyAnimeList (solo anime; TMDB ya lo cubre en español), Pluto TV (canales clásicos legales en Latinoamérica, pero sin API ni embed).

## Agregar una serie

1. Buscá su ID en TMDB: `https://www.themoviedb.org/search/tv?query=<título>` (fijate el año de estreno).
2. Agregala en `src/data/shows.ts` con `tmdbId`, `originalTitle`, `seasons` y `episodeCount` (la suma de episodios de sus temporadas en TMDB, sin especiales).
3. Si existe una wiki de fans en español con su lista de episodios, sumá `fanWiki: { wiki: "<subdominio>", page: "<página>" }`.
4. Sumá su `id` a uno o más bloques en `src/data/channels.ts` para que aparezca en la programación.

## API propia

| Ruta | Devuelve |
| --- | --- |
| `GET /api/canales` | Canales con sus bloques de programación |
| `GET /api/series?q=&canal=` | Catálogo filtrable |
| `GET /api/series/:id` | Serie + episodios en español |
| `GET /api/programacion?canal=&fecha=YYYY-MM-DD` | Grilla del día |
| `GET /api/video?serie=&ep=` | Fuente de video del episodio o `null` |

## Estructura

- `src/data/` — canales y bloques (`channels.ts`), series (`shows.ts`), videos manuales (`videos.ts`)
- `src/lib/schedule.ts` — arma la grilla diaria (determinística por fecha)
- `src/lib/catalog.ts` — combina datos locales + todas las fuentes
- `src/lib/tmdb.ts`, `doblaje.ts`, `fanwiki.ts`, `wikipedia.ts`, `youtube.ts`, `dailymotion.ts` — clientes de cada fuente
- `src/lib/http.ts` — caché de JSON que no guarda errores
- `src/instrumentation.ts` — sube el timeout de conexión de Node (sin esto las APIs lejanas fallan con ETIMEDOUT en conexiones lentas)
