#!/usr/bin/env node
/**
 * Revisa qué series de la programación tienen video que se pueda reproducir y lo guarda en
 * src/data/playable.json. La grilla usa ese archivo en vez de consultar al addon en cada visita
 * (eso saturaba al addon del plan gratis y hacía que la grilla cambiara al recargar).
 *
 * Uso:  LACARTOONS_ADDON_URL=https://retrotoons-tv-addon.onrender.com node scripts/check-playable.mjs
 * Lo corre cada semana .github/workflows/check-playable.yml. Va de a una serie, sin apuro.
 * Si una serie no responde se conserva lo que decía el archivo (no se marca "sin video" por un timeout).
 */
import fs from "node:fs";

const ADDON = (process.env.LACARTOONS_ADDON_URL || "http://127.0.0.1:7000").replace(/\/+$/, "");
const OUT = "src/data/playable.json";
const TIMEOUT_MS = 120_000;

const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { series: {} };

async function getJson(path) {
  const res = await fetch(`${ADDON}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} en ${path}`);
  return res.json();
}

// Igual que normalize() de src/lib/lacartoons-schedule.ts.
function normalize(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(el|la|los|las|de|del|y|the|and|of|serie|series|animada|animated|aventuras)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findByName(names, catalog) {
  const keys = names.map(normalize).filter((k) => k.length >= 3);
  const exact = catalog.find((c) => keys.includes(c.key));
  if (exact) return exact.series;
  const partial = catalog
    .filter((c) => c.key.length >= 4 && keys.some((k) => c.key.includes(k) || k.includes(c.key)))
    .sort((a, b) => a.key.length - b.key.length);
  return partial[0]?.series;
}

// Nombres de series que usa la programación: los de LACartoons de cada bloque y los de las series locales.
const channelsSrc = fs.readFileSync("src/data/channels.ts", "utf8");
const showsSrc = fs.readFileSync("src/data/shows.ts", "utf8");
const wanted = new Set();
for (const m of channelsSrc.matchAll(/b\([^,]+, "[^"]+", "\d\d:\d\d", "\d\d:\d\d", \[([^\]]*)\]/g)) {
  for (const n of m[1].matchAll(/"([^"]+)"/g)) wanted.add(JSON.stringify([n[1]]));
}
const localIds = new Set([...channelsSrc.matchAll(/shows: \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])));
for (const id of localIds) {
  const line = showsSrc.split("\n").find((l) => l.includes(`id: "${id}"`));
  if (!line) continue;
  const names = ["lacartoons", "title", "originalTitle"].map((k) => line.match(new RegExp(`${k}: "([^"]+)"`))?.[1]).filter(Boolean);
  wanted.add(JSON.stringify(names));
}

// Catálogo completo (paginado de a 20).
const catalog = [];
for (let skip = 0; skip < 2000; ) {
  const page = await getJson(`/catalog/series/lacart_catalogo/skip=${skip}.json`);
  const fresh = (page.metas ?? []).filter((m) => !catalog.some((c) => c.series.id === m.id));
  if (fresh.length === 0) break;
  catalog.push(...fresh.map((series) => ({ series, key: normalize(series.name) })));
  skip = catalog.length;
}
console.log(`Catálogo: ${catalog.length} series. A revisar: ${wanted.size} nombres.`);

const ids = new Map();
for (const w of wanted) {
  const found = findByName(JSON.parse(w), catalog);
  if (found) ids.set(found.id, found.name);
}

const series = { ...previous.series };
let i = 0;
// ONLY_FALSE=1: solo vuelve a revisar las que figuran sin video (o sin dato).
// ONLY_NEW=1: solo las que todavía no tienen dato (ej. recién sumadas a la programación).
const toCheck = [...ids]
  .sort()
  .filter(([id]) => process.env.ONLY_FALSE !== "1" || series[id]?.playable !== true)
  .filter(([id]) => process.env.ONLY_NEW !== "1" || series[id] === undefined);
console.log(`Revisando ${toCheck.length} series.`);
for (const [id, name] of toCheck) {
  i++;
  try {
    const meta = await getJson(`/meta/series/${encodeURIComponent(id)}.json`);
    // Se prueban hasta 3 episodios (primero, del medio y uno de los últimos): a veces justo el
    // primero está roto y el resto anda. Alcanza con que uno tenga video.
    const videos = meta.meta?.videos ?? [];
    const sample = [...new Set([0, Math.floor(videos.length / 2), Math.max(0, videos.length - 2)])].filter((k) => k < videos.length);
    let playable = false;
    for (const k of sample) {
      const streams = (await getJson(`/stream/series/${encodeURIComponent(videos[k].id)}.json`)).streams ?? [];
      if (streams.length > 0) {
        playable = true;
        break;
      }
    }
    series[id] = { name, playable };
    console.log(`[${i}/${toCheck.length}] ${playable ? "OK " : "-- "} ${name}`);
  } catch (error) {
    console.log(`[${i}/${toCheck.length}] ??  ${name} (sin respuesta, se conserva: ${series[id]?.playable ?? "sin dato"}) ${error.message}`);
  }
}

const sorted = Object.fromEntries(Object.entries(series).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })));
fs.writeFileSync(OUT, JSON.stringify({ checkedAt: new Date().toISOString(), series: sorted }, null, 2) + "\n");
console.log(`Listo: ${Object.values(sorted).filter((s) => s.playable).length} con video, ${Object.values(sorted).filter((s) => !s.playable).length} sin video.`);
