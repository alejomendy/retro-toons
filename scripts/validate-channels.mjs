#!/usr/bin/env node
/**
 * Revisa la programación de src/data/channels.ts:
 *   - cada canal cubre las 24 hs de cada día de la semana, sin huecos ni solapamientos;
 *   - cada bloque tiene nombre, horario válido y al menos una serie.
 * Con CHECK_CATALOG=1 además confirma que cada serie exista en el catálogo de LACartoons
 * (necesita el addon: LACARTOONS_ADDON_URL). Sale con error si encuentra problemas (lo usa el CI).
 */
import fs from "node:fs";

const src = fs.readFileSync("src/data/channels.ts", "utf8");
const consts = Object.fromEntries(
  [...src.matchAll(/const ([A-Z_]+) = (\[[\d, ]*\]);/g)].map((m) => [m[1], JSON.parse(m[2])]),
);
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const problems = [];
const names = new Set();

const channelRe = /id: "([a-z-]+)",[\s\S]*?blocks: \[([\s\S]*?)\n {4}\],/g;
let channels = 0;
for (const [, id, body] of src.matchAll(channelRe)) {
  channels++;
  const blocks = [...body.matchAll(/b\((\[[^\]]*\]|[A-Z_]+), "([^"]+)", "([^"]+)", "([^"]+)", \[([^\]]*)\]/g)].map((m) => ({
    days: m[1].startsWith("[") ? JSON.parse(m[1]) : consts[m[1]],
    name: m[2],
    start: m[3],
    end: m[4],
    series: [...m[5].matchAll(/"([^"]+)"/g)].map((s) => s[1]),
  }));
  if (blocks.length === 0) problems.push(`${id}: no tiene bloques`);
  for (const b of blocks) {
    if (!b.days) problems.push(`${id} / ${b.name}: días desconocidos`);
    if (!/^\d\d:\d\d$/.test(b.start) || !/^\d\d:\d\d$/.test(b.end) || toMin(b.end) <= toMin(b.start)) problems.push(`${id} / ${b.name}: horario inválido ${b.start}-${b.end}`);
    if (b.series.length === 0) problems.push(`${id} / ${b.name}: sin series`);
    b.series.forEach((n) => names.add(n));
  }
  for (let day = 0; day < 7; day++) {
    const today = blocks.filter((b) => b.days?.includes(day)).sort((a, b) => toMin(a.start) - toMin(b.start));
    let t = 0;
    for (const b of today) {
      if (toMin(b.start) !== t) problems.push(`${id}, día ${day}: ${toMin(b.start) > t ? "hueco" : "solapamiento"} a las ${b.start} (${b.name})`);
      t = Math.max(t, toMin(b.end));
    }
    if (t !== 1440) problems.push(`${id}, día ${day}: la grilla termina a las ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`);
  }
}
if (channels === 0) problems.push("No se encontró ningún canal en channels.ts");

if (process.env.CHECK_CATALOG === "1") {
  const addon = (process.env.LACARTOONS_ADDON_URL || "http://127.0.0.1:7000").replace(/\/+$/, "");
  const norm = (n) =>
    n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ")
      .replace(/\b(el|la|los|las|de|del|y|the|and|of|serie|series|animada|animated|aventuras)\b/g, " ").replace(/\s+/g, " ").trim();
  const keys = [];
  for (let skip = 0; skip < 2000; skip = keys.length) {
    const page = await (await fetch(`${addon}/catalog/series/lacart_catalogo/skip=${skip}.json`)).json();
    const fresh = (page.metas ?? []).map((m) => norm(m.name)).filter((k) => !keys.includes(k));
    if (fresh.length === 0) break;
    keys.push(...fresh);
  }
  for (const n of names) {
    const k = norm(n);
    if (!keys.includes(k) && !keys.some((c) => c.length >= 4 && (c.includes(k) || k.includes(c)))) problems.push(`No está en el catálogo: ${n}`);
  }
}

if (problems.length > 0) {
  console.error(`La programación tiene ${problems.length} problema(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Programación OK: ${channels} canales, ${names.size} series, 24 hs cubiertas los 7 días.`);
