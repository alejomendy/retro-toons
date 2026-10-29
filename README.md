# RetroToons

Dibujos de los 90s y 2000s (Cartoon Network, Nickelodeon, Disney XD, Jetix, Fox Kids) con:

- **Programación del día** (`/programacion`): elegís un canal y "sintonizás" lo que está pasando ahora, con grilla por bloques (Toonami, Nicktoons, Jetix Max...), tandas entre programas y episodios que cambian cada día.
- **Biblioteca** (`/biblioteca`): todas las series con búsqueda y filtros; cada serie tiene su lista de episodios para ver el que quieras.

```bash
npm install
cp .env.example .env.local   # opcional, para YouTube
npm run dev                  # http://localhost:3000
```

## APIs externas

Todo prioriza **español latino**. Configuración en `.env.local` (ver `.env.example`).

| API | Para qué | Clave |
| --- | --- | --- |
| [TMDB](https://developer.themoviedb.org) (`es-MX`) | Títulos y sinopsis en latino de series y episodios, pósters, fondos, openings/trailers, **dónde verla legalmente** por país | `TMDB_API_KEY` o `TMDB_READ_TOKEN` (gratis) |
| [Wikipedia ES](https://es.wikipedia.org/api/rest_v1/) | Descripción en español + imagen | No necesita |
| [TVmaze](https://www.tvmaze.com/api) | Estructura de temporadas/episodios (respaldo en inglés) | No necesita |
| [YouTube Data API v3](https://developers.google.com/youtube/v3/docs/search/list) | Video embebible por episodio (`relevanceLanguage=es`) | `YOUTUBE_API_KEY` (gratis, ≈100 búsquedas/día) |
| [Dailymotion](https://developers.dailymotion.com/api/) | Video embebible por episodio (`languages=es`) | No necesita para buscar; `NEXT_PUBLIC_DAILYMOTION_PLAYER_ID` para embeber |

- Info de la serie: TMDB → Wikipedia → TVmaze.
- Video de un episodio: `src/data/videos.ts` (a mano) → YouTube → Dailymotion → pantalla "sin señal". Solo se aceptan videos cuyo título nombre la serie.
- Cache: TVmaze/TMDB 1 día, Wikipedia/YouTube/Dailymotion 7 días. Si una API falla, el sitio sigue con lo que tenga.

> No existe una API legal que entregue episodios completos doblados al latino. YouTube y Dailymotion tienen sobre todo clips e intros subidos por usuarios. Cargá solo videos sobre los que tengas derechos o publicados oficialmente; con `YOUTUBE_CHANNEL_IDS` / `DAILYMOTION_OWNERS` limitás la búsqueda a canales oficiales.

Descartadas: Fanart.tv (logos, pide clave y ID de TheTVDB), TheTVDB (pago), Pluto TV (tiene canales clásicos gratis y legales en Latinoamérica, pero no ofrece API ni embed).

## API propia

| Ruta | Devuelve |
| --- | --- |
| `GET /api/canales` | Canales con sus bloques de programación |
| `GET /api/series?q=&canal=` | Catálogo filtrable |
| `GET /api/series/:id` | Serie + episodios (con datos de TVmaze) |
| `GET /api/programacion?canal=&fecha=YYYY-MM-DD` | Grilla del día |
| `GET /api/video?serie=&ep=` | Fuente de video del episodio o `null` |

## Estructura

- `src/data/` — canales y bloques (`channels.ts`), series (`shows.ts`), videos manuales (`videos.ts`)
- `src/lib/schedule.ts` — arma la grilla diaria (determinística por fecha)
- `src/lib/tvmaze.ts`, `src/lib/youtube.ts` — clientes de las APIs
- `src/lib/catalog.ts` — combina datos locales + APIs
- `src/instrumentation.ts` — sube el timeout de conexión de Node (sin esto TVmaze falla con ETIMEDOUT en conexiones lentas)
