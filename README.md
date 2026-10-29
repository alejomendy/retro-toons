# RetroToons

Dibujos de los 90s y 2000s (Cartoon Network, Nickelodeon, Disney XD, Jetix, Fox Kids), todo en **español latino**:

- **Programación del día** (`/programacion`): elegís un canal y "sintonizás" lo que está pasando ahora, con grilla por bloques (Toonami, Nicktoons, Jetix Max...), tandas entre programas y episodios que cambian cada día. Solo se programan episodios que **se pueden ver en la página** en español latino (canales oficiales de YouTube, Pluto TV o `videos.ts`). Si un bloque se queda con una sola serie disponible usa las del resto del canal, y si el canal tiene menos de 5 series disponibles se completa con otras del catálogo, que rotan cada día.
  - Cada episodio ocupa su duración más **1 minuto de tanda**, y el siguiente arranca enseguida: no hay huecos largos de "¡Ya volvemos!".
  - Las series de otros canales que completan la grilla se marcan como **INVITADA**, con un aviso que explica por qué.
  - Debajo de la tele: **Ahora** (con barra de avance y enlace para verlo desde el principio) y **A continuación**.
- **Modo cine** (botón en la tele, en la programación y en la biblioteca): agranda el reproductor dentro de la página y oscurece el resto, sin pasar a pantalla completa. Se sale con Esc, con "Achicar" o tocando el fondo. El video no se corta al entrar ni al salir, y en la programación sigue activo cuando cambia el programa.
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

- **Título de un episodio:** TMDB es-MX → wiki de fans → Doblaje Wiki → Pluto TV → canal oficial de YouTube (si numera igual que TMDB) → Wikipedia ES → TMDB es-ES → wiki de fans (España). Pluto no da el título original, así que se cruza por estructura: la serie entera o cada temporada tiene que tener la misma cantidad de episodios que en TMDB. Se descartan sus títulos genéricos ("Episodio 3") y las sinopsis repetidas. Las wikis se cruzan por el título original en inglés de TMDB (incluye segmentos "A / B" y coincidencia aproximada en las wikis de fans).
- **Video de un episodio:** `src/data/videos.ts` (a mano) → **canales oficiales** → **Pluto TV** → búsqueda en YouTube → Dailymotion → "sin señal". Solo se aceptan videos cuyo título nombre la serie **y** el episodio.

### Canales oficiales de YouTube

Cada serie puede tener `youtubeChannels` en `shows.ts`: canales **oficiales** que suben episodios completos. Se lee la lista completa de subidas (1 unidad de cuota cada 50 videos, guardada 1 día) y se cruza con los episodios:

- Por **nombre** del episodio (latino u original). Si el nombre es de una sola palabra, el título del video tiene que empezar con ella.
- Por **número** ("T1 EP5", "01x05", "S01E05"), salvo que la serie tenga `matchByNumber: false` (cuando el canal ordena distinto que TMDB).
- La duración tiene que ser la de un episodio y se descartan compilados ("1 hora de…", "lo mejor", "temporada completa"…).

| Serie | Canal oficial | Episodios con video |
| --- | --- | --- |
| Pucca | Pucca Español - LATAM Oficial | 117 / 117 |
| Kid vs. Kat | Niño Vs. Gato - WildBrain | 95 / 104 (con Pluto) |
| Tres Espías Sin Límite | Tres Espías Sin Límite - Totally Spies | 144 / 208 (solo por nombre: su "T4 EP16" es el S4E15 de TMDB) |
| Power Rangers | Power Rangers en Español - Canal Oficial | 297 / 973 (todos sus episodios completos; cruza por "S06 | E41") |
| Bob Esponja | Bob Esponja en Español | 4 / 659 (el canal sube casi solo compilados) |

Revisados sin resultado: **Nickelodeon en Español** (solo 1 episodio completo de Rocko, Rocket Power e Invasor Zim, que ya están en Pluto; las Tortugas son la serie nueva), **Oggy y sus amigos** (solo clips), los compilados de **Bob Esponja en Español** (son de momentos sueltos y no traen marcas de tiempo por episodio) y **Dailymotion** (no hay cuentas oficiales con estas series en español).

Para sumar un canal: verificá que sea **oficial** (no resubidas de usuarios), agregalo y revisá con una muestra que nombre y número lleven al mismo episodio.

### Pluto TV (gratis y legal, con publicidad)

Los episodios a demanda de Pluto TV se reproducen **dentro de la página** con `hls.js`. Usa los endpoints públicos de su web (sin clave; la región sale de la IP del servidor, desde Argentina: catálogo latam en español):

- **Episodios completos** por stream HLS. Se cruzan por nombre, tolerando diferencias de escritura ("Carl & Maude" = "Carl y Maude", "D-esestabilizada" = "Des-estabilizada") y episodios que Pluto agrupa en segmentos ("Musculoso / Dummy Dummy"). Si no, por posición solo cuando Pluto tiene la misma cantidad de episodios que la serie. Los que Pluto tradujo con otro título no se pueden cruzar con seguridad.
- Pluto solo deja leer sus listas `.m3u8` desde pluto.tv (CORS), así que `/api/hls` hace de proxy **solo de las listas** (restringido a dominios de Pluto); los segmentos de video van directo de Pluto al navegador.
- Los cortes publicitarios de Pluto van incluidos en el stream (`serverSideAds=true`): Pluto se financia así.
- **Canales en vivo** de una sola serie (*¡Oye Arnold!*, *Rugrats*, *Los Padrinos Mágicos*, *Bob Esponja*, *Avatar*): también se ven en la página, por el mismo proxy. En la ficha, si el episodio elegido no tiene video, la tele pasa el canal en vivo de la serie y muestra lo que está pasando **ahora**. Con `?vivo=1` se fuerza el canal.
- Si lo que hay en Pluto con ese nombre es otra versión, poné `pluto: false` en la serie (ej. *Las Tortugas Ninja*: Pluto tiene la de 2012, no la de 2003).
- Son endpoints no documentados: si Pluto cambia su web, hay que ajustar `src/lib/pluto.ts`.

Descartadas para esto: Tubi (no disponible en la región), Samsung TV Plus (sin canales de Latinoamérica en su lista pública) Plex (las series que faltan solo están con suscripción en Argentina: Paramount+, Crunchyroll) ViX (en Latinoamérica solo tiene contenido infantil propio, no estas series), Mercado Play (de estas series solo tiene *Shaman King*, que ya está completa en Pluto; el resto son películas) y Rakuten TV (europea).

La lista de episodios disponibles por serie (la que usa la programación) se guarda **en memoria durante una hora** y no con `unstable_cache`: anidada con las cachés de YouTube y TMDB devolvía resultados armados con datos viejos.
- **Caché:** TMDB 1 día; wikis, YouTube y Dailymotion 7 días. Las wikis a veces limitan pedidos (HTTP 429): esos errores no se guardan en caché y se reintenta en la próxima visita.

> No existe una API legal que entregue episodios completos doblados al latino. YouTube y Dailymotion tienen sobre todo clips e intros subidos por usuarios. Cargá solo videos sobre los que tengas derechos o publicados oficialmente; con `YOUTUBE_CHANNEL_IDS` / `DAILYMOTION_OWNERS` limitás la búsqueda a canales oficiales.

"Dónde verla legalmente" muestra las plataformas de TMDB/JustWatch de la región, las **gratis con publicidad** primero (Mercado Play, ViX...) y después las de suscripción.

Revisada la lista [public-apis](https://github.com/public-apis/public-apis) (categorías Video, Entretenimiento, Anime, Datos abiertos): ninguna API da episodios legales de estas series. Las de video (Vimeo, Archive.org, AniAPI) no las tienen o son subidas sin permiso, y las demás (TVDB, Trakt, Simkl, Kitsu, AniList) solo dan datos que ya trae TMDB. Watchmode daría lo mismo que los proveedores de TMDB.

Descartadas: TVmaze (solo en inglés), Fanart.tv (logos, pide clave y ID de TheTVDB), TheTVDB (pago), Jikan/MyAnimeList (solo anime; TMDB ya lo cubre en español).

## Agregar una serie

1. Buscá su ID en TMDB: `https://www.themoviedb.org/search/tv?query=<título>` (fijate el año de estreno).
2. Agregala en `src/data/shows.ts` con `tmdbId`, `originalTitle`, `seasons` y `episodeCount` (la suma de episodios de sus temporadas en TMDB, sin especiales).
3. Si existe una wiki de fans en español con su lista de episodios, sumá `fanWiki: { wiki: "<subdominio>", page: "<página>" }`.
4. Sumá su `id` a uno o más bloques en `src/data/channels.ts` para que aparezca en la programación.

## API propia

| Ruta | Devuelve |
| --- | --- |
| `GET /api/canales` | Canales con sus bloques de programación |
| `GET /api/series?q=&genre=&skip=` | Catálogo / búsqueda de LACartoons → `{ success, results }` |
| `GET /api/series/:id` | Serie de LACartoons + episodios → `{ success, series }` (`series.videos`) |
| `GET /api/series/:episodeId/streams` | Fuentes del episodio → `{ success, streams }` |
| `GET /api/programacion?canal=&fecha=YYYY-MM-DD` | Grilla del día con series de LACartoons → `{ success, canal, slots }` |
| `GET /api/video?serie=&ep=` | Fuente de video del episodio o `null` |

## Catálogo LACartoons (addon de Stremio)

Requiere el addon corriendo (por defecto `http://127.0.0.1:7000`, configurable con `LACARTOONS_ADDON_URL`, solo del lado del servidor).

- `/biblioteca` — catálogo de LACartoons con búsqueda (debounce), filtro por cadena (salen del manifiesto del addon), «Mis favoritos» y «Continuar viendo» (en `localStorage`; solo IDs y posición, nunca URLs de streams porque caducan).
- `/biblioteca/:id` — portada, fondo, descripción, temporadas y episodios.
- `/biblioteca/:id/ver?ep=<episodeId>&t=<segundos>` — reproductor (Video.js 8) con selector de fuente, anterior/siguiente y paso automático al siguiente episodio.
- `/programacion` — cada bloque pasa las series icónicas del canal: las de su lista `shows` (buscadas por nombre en LACartoons; si el nombre difiere se usa `lacartoons` en `src/data/shows.ts`) más los clásicos extra de `lacartoons` en el bloque (`src/data/channels.ts`). Si a un bloque le quedan menos de 4, se suman las icónicas del resto del canal; si el canal tiene menos de 6, se completa con otras series de sus cadenas. Las icónicas que LACartoons no tiene salen de las fuentes legales de `src/lib/catalog.ts` (canales oficiales de YouTube, Pluto TV, `src/data/videos.ts`) si tienen episodios ahí: hoy, Tres Espías sin Límite y Kid vs. Kat. Esos espacios se reproducen con el embed de la fuente y pasan la tanda según la duración del episodio. Es determinística por canal y fecha; el episodio sale al aire desde el minuto que corresponde y, si termina antes que el espacio, pasa la tanda.
- Errores de la API: `{ success: false, error, code }` con `code` en `ADDON_UNREACHABLE`, `ADDON_BAD_RESPONSE`, `INVALID_ID`, `SERIES_NOT_FOUND`, `NO_EPISODES`, `NO_STREAMS`, `MALFORMED_DATA`.

### Limitaciones de las fuentes

- Las fuentes directas de ok.ru vienen marcadas `notWebReady` y con `proxyHeaders` (Referer/User-Agent). El navegador no puede mandar esos encabezados desde un `<video>`: hoy reproducen, pero si ok.ru empieza a exigirlos van a fallar. Para soportarlas siempre haría falta un proxy del lado del servidor.
- Las fuentes «(proxy)» son HLS servidas por el propio addon en `127.0.0.1:7000`: solo funcionan si el navegador corre en la misma máquina que el addon.
- Las URLs firmadas caducan y están atadas a la IP que pidió el stream; por eso se consultan de nuevo en cada reproducción.
- El addon no informa duración de episodios: no se muestra, y en la programación cada espacio dura lo del bloque (30 min por defecto).
- Algunos episodios no tienen video en LACartoons: el addon tarda ~20 s en confirmarlo y la tele muestra «Sin señal» durante ese espacio.

## Estructura

- `src/data/` — canales y bloques (`channels.ts`), series (`shows.ts`), videos manuales (`videos.ts`)
- `src/lib/schedule.ts` — arma la grilla diaria (determinística por fecha)
- `src/lib/catalog.ts` — combina datos locales + todas las fuentes
- `src/lib/tmdb.ts`, `doblaje.ts`, `fanwiki.ts`, `wikipedia.ts`, `youtube.ts`, `dailymotion.ts` — clientes de cada fuente
- `src/lib/http.ts` — caché de JSON que no guarda errores
- `src/lib/lacartoons.ts` — cliente del addon LACartoons (validación + errores tipados); tipos compartidos en `lacartoons-types.ts`
- `src/lib/lacartoons-schedule.ts` — grilla diaria de cada canal con series de LACartoons
- `src/lib/user-library.ts` — favoritos y progreso en `localStorage` (seguro para SSR)
- `src/instrumentation.ts` — sube el timeout de conexión de Node (sin esto las APIs lejanas fallan con ETIMEDOUT en conexiones lentas)
