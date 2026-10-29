import type { Channel, ChannelId } from "@/lib/types";

/**
 * Grilla tipo de cada canal. Los bloques imitan cómo se armaba la
 * programación en los 90s/2000s: franjas temáticas que rotan series.
 * El episodio de cada espacio cambia día a día (ver lib/schedule.ts).
 */
export const channels: Channel[] = [
  {
    id: "cartoon-network",
    name: "Cartoon Network",
    tagline: "Lo mejor en dibujos animados",
    color: "#111111",
    ink: "#ffffff",
    years: "1992 – hoy",
    description: "Los Cartoon Cartoons, Toonami y las noches de Cartoon Network.",
    blocks: [
      { name: "Madrugada Toon", start: "00:00", end: "06:00", shows: ["coraje", "billy-mandy", "samurai-jack", "dexter", "johnny-bravo", "vaca-pollito", "mike-lu-og", "duck-dodgers"] },
      { name: "Despertate con Cartoon", start: "06:00", end: "09:00", shows: ["chicas-superpoderosas", "dexter", "ed-edd-eddy", "johnny-bravo", "camp-lazlo", "puffy-amiyumi"] },
      { name: "Cartoon Cartoons", start: "09:00", end: "13:00", shows: ["dexter", "vaca-pollito", "chicas-superpoderosas", "johnny-bravo", "ed-edd-eddy", "coraje", "kids-next-door", "foster", "mike-lu-og", "gym-partner"] },
      { name: "Hora del Almuerzo", start: "13:00", end: "16:00", shows: ["kids-next-door", "billy-mandy", "foster", "ed-edd-eddy", "ben-10", "camp-lazlo", "gym-partner", "puffy-amiyumi", "duck-dodgers"] },
      { name: "Toonami", start: "16:00", end: "19:00", shows: ["dbz", "samurai-jack", "ben-10", "dbz", "jovenes-titanes", "liga-justicia", "megas-xlr"] },
      { name: "Viernes de Cartoon", start: "19:00", end: "22:00", shows: ["coraje", "billy-mandy", "chicas-superpoderosas", "foster", "samurai-jack", "jovenes-titanes", "megas-xlr"] },
      { name: "Noche Toon", start: "22:00", end: "24:00", shows: ["coraje", "samurai-jack", "johnny-bravo", "billy-mandy", "liga-justicia"] },
    ],
  },
  {
    id: "nickelodeon",
    name: "Nickelodeon",
    tagline: "¡Nick, Nick, Nick!",
    color: "#ff7a00",
    ink: "#ffffff",
    years: "1979 – hoy",
    description: "Los Nicktoons, el slime verde y SNICK los sábados a la noche.",
    blocks: [
      { name: "Nick de Noche", start: "00:00", end: "06:00", shows: ["rocko", "aaahh-monstruos", "hey-arnold", "rugrats", "catdog", "invasor-zim", "ren-stimpy", "castores", "doug"] },
      { name: "Nick Mañanero", start: "06:00", end: "09:00", shows: ["rugrats", "bob-esponja", "thornberrys", "catdog", "doug"] },
      { name: "Nicktoons", start: "09:00", end: "13:00", shows: ["hey-arnold", "rocko", "rugrats", "bob-esponja", "rocket-power", "padrinos-magicos", "catdog", "aaahh-monstruos", "castores", "ren-stimpy", "ginger"] },
      { name: "Nick Después del Cole", start: "13:00", end: "17:00", shows: ["padrinos-magicos", "jimmy-neutron", "bob-esponja", "danny-phantom", "rocket-power", "nina-robot", "ginger"] },
      { name: "Horario Estelar Nick", start: "17:00", end: "20:00", shows: ["avatar", "danny-phantom", "bob-esponja", "padrinos-magicos", "invasor-zim", "el-tigre", "nina-robot"] },
      { name: "SNICK", start: "20:00", end: "24:00", shows: ["invasor-zim", "avatar", "hey-arnold", "rocko", "aaahh-monstruos", "ren-stimpy", "castores"] },
    ],
  },
  {
    id: "fox-kids",
    name: "Fox Kids",
    tagline: "¡Diversión sin límites!",
    color: "#1d4ed8",
    ink: "#fde047",
    years: "1990 – 2004",
    description: "Superhéroes, Power Rangers y anime antes de convertirse en Jetix.",
    blocks: [
      { name: "Fox Kids Nocturno", start: "00:00", end: "06:00", shows: ["x-men", "spider-man", "eek", "power-rangers", "extreme-ghostbusters"] },
      { name: "Fox Kids Club", start: "06:00", end: "10:00", shows: ["eek", "oggy", "power-rangers", "digimon", "beetleborgs"] },
      { name: "Héroes de la Mañana", start: "10:00", end: "14:00", shows: ["x-men", "spider-man", "power-rangers", "eek", "oggy", "tmnt-2003", "beetleborgs"] },
      { name: "Zona Anime", start: "14:00", end: "17:00", shows: ["digimon", "shaman-king", "digimon"] },
      { name: "La Hora del Poder", start: "17:00", end: "20:00", shows: ["power-rangers", "x-men", "spider-man", "shaman-king", "tmnt-2003", "extreme-ghostbusters"] },
      { name: "Fox Kids de Noche", start: "20:00", end: "24:00", shows: ["spider-man", "x-men", "digimon", "eek", "tmnt-2003"] },
    ],
  },
  {
    id: "jetix",
    name: "Jetix",
    tagline: "¡Con toda la acción!",
    color: "#e4002b",
    ink: "#ffffff",
    years: "2004 – 2009",
    description: "El heredero de Fox Kids: acción, aventura y Jetix Max.",
    blocks: [
      { name: "Jetix Nocturno", start: "00:00", end: "06:00", shows: ["oggy", "totally-spies", "power-rangers", "witch", "kid-vs-kat"] },
      { name: "Jetix Mañana", start: "06:00", end: "10:00", shows: ["oggy", "totally-spies", "witch", "digimon", "pucca"] },
      { name: "Jetix Max", start: "10:00", end: "14:00", shows: ["srmthfg", "power-rangers", "galactik-football", "monster-buster", "shaman-king", "tmnt-2003"] },
      { name: "Jetix Chicas", start: "14:00", end: "17:00", shows: ["totally-spies", "witch", "totally-spies", "pucca"] },
      { name: "Hora de Acción", start: "17:00", end: "21:00", shows: ["power-rangers", "srmthfg", "galactik-football", "digimon", "shaman-king", "tmnt-2003", "kid-vs-kat"] },
      { name: "Jetix de Noche", start: "21:00", end: "24:00", shows: ["monster-buster", "galactik-football", "totally-spies", "oggy", "pucca"] },
    ],
  },
  {
    id: "disney-xd",
    name: "Disney XD",
    tagline: "Toon Disney · Jetix · Disney XD",
    color: "#0a0a0a",
    ink: "#39ff14",
    years: "1998 – hoy",
    description: "De Toon Disney a Disney XD: clásicos animados de Disney.",
    blocks: [
      { name: "Clásicos de Madrugada", start: "00:00", end: "06:00", shows: ["gargoyles", "timon-pumbaa", "pepper-ann", "recreo", "ducktales", "chip-dale", "darkwing", "goof-troop"] },
      { name: "Disney Mañanero", start: "06:00", end: "09:00", shows: ["timon-pumbaa", "lilo-stitch", "recreo", "ducktales", "goof-troop", "chip-dale"] },
      { name: "Sábados de Disney", start: "09:00", end: "13:00", shows: ["recreo", "pepper-ann", "timon-pumbaa", "gargoyles", "lilo-stitch", "darkwing", "aladdin", "hercules"] },
      { name: "Zona Disney", start: "13:00", end: "17:00", shows: ["kim-possible", "lilo-stitch", "replacements", "jake-long", "brandy", "dave-barbarian", "aladdin"] },
      { name: "Horario Estelar XD", start: "17:00", end: "21:00", shows: ["phineas-ferb", "kim-possible", "jake-long", "replacements", "kid-vs-kat", "dave-barbarian"] },
      { name: "Noche XD", start: "21:00", end: "24:00", shows: ["gargoyles", "jake-long", "kim-possible", "phineas-ferb", "hercules", "brandy"] },
    ],
  },
];

export const channelById = Object.fromEntries(channels.map((c) => [c.id, c])) as Record<ChannelId, Channel>;

export function isChannelId(value: string | undefined | null): value is ChannelId {
  return !!value && value in channelById;
}
