#!/usr/bin/env node
/**
 * Deja listas las fuentes de lo que está por salir al aire en todos los canales, así la tele
 * arranca al instante en vez de esperar al addon (5-30 s por episodio en el plan gratis).
 * Pide a la app la grilla de hoy (hora de Argentina) y, para el programa actual y el siguiente de
 * cada canal, pide sus fuentes: eso las guarda 3 h en la caché del servidor.
 *
 * Uso:  SITE_URL=https://retro-toons.vercel.app node scripts/prewarm.mjs
 * Lo corre .github/workflows/prewarm.yml cada 30 minutos (10 minutos antes de cada cambio de programa).
 */
const SITE = (process.env.SITE_URL || "https://retro-toons.vercel.app").replace(/\/+$/, "");
const TZ = process.env.SCHEDULE_TZ || "America/Argentina/Buenos_Aires";
const CHANNELS = ["cartoon-network", "nickelodeon", "jetix", "disney", "warner", "fox"];

// Fecha y minuto del día en la zona horaria de la programación.
const parts = Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date())
    .map((p) => [p.type, p.value]),
);
const fecha = `${parts.year}-${parts.month}-${parts.day}`;
const minute = Number(parts.hour) * 60 + Number(parts.minute);
console.log(`Grilla del ${fecha}, ${parts.hour}:${parts.minute} (${TZ})`);

async function getJson(path, timeoutMs = 90_000) {
  const res = await fetch(`${SITE}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  return res.json();
}

const episodes = [];
for (const canal of CHANNELS) {
  try {
    const grid = await getJson(`/api/programacion?canal=${canal}&fecha=${fecha}`);
    if (!grid.success) throw new Error(grid.error);
    const i = grid.slots.findIndex((s) => minute >= s.start && minute < s.end);
    for (const slot of grid.slots.slice(Math.max(0, i), i + 2)) {
      if (!slot.external) episodes.push({ canal, name: slot.series.name, id: slot.episode.id });
    }
  } catch (error) {
    console.log(`${canal}: no se pudo leer la grilla (${error.message})`);
  }
}

// De a uno: el addon tiene poca CPU y abre una página de Chromium por vez.
let ok = 0;
for (const ep of episodes) {
  const started = Date.now();
  try {
    const data = await getJson(`/api/series/${encodeURIComponent(ep.id)}/streams`);
    const count = data.streams?.length ?? 0;
    if (count > 0) ok++;
    console.log(`${ep.canal.padEnd(16)} ${ep.name} (${ep.id}): ${count} fuentes en ${Math.round((Date.now() - started) / 1000)} s`);
  } catch (error) {
    console.log(`${ep.canal.padEnd(16)} ${ep.name} (${ep.id}): error ${error.message}`);
  }
}
console.log(`Listo: ${ok}/${episodes.length} episodios con fuentes en caché.`);
