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
      { name: "Madrugada Toon", start: "00:00", end: "06:00", shows: ["coraje", "billy-mandy", "samurai-jack", "dexter", "johnny-bravo", "vaca-pollito"] },
      { name: "Despertate con Cartoon", start: "06:00", end: "09:00", shows: ["chicas-superpoderosas", "dexter", "ed-edd-eddy", "johnny-bravo"] },
      { name: "Cartoon Cartoons", start: "09:00", end: "13:00", shows: ["dexter", "vaca-pollito", "chicas-superpoderosas", "johnny-bravo", "ed-edd-eddy", "coraje", "kids-next-door", "foster"] },
      { name: "Hora del Almuerzo", start: "13:00", end: "16:00", shows: ["kids-next-door", "billy-mandy", "foster", "ed-edd-eddy", "ben-10"] },
      { name: "Toonami", start: "16:00", end: "19:00", shows: ["dbz", "samurai-jack", "ben-10", "dbz"] },
      { name: "Viernes de Cartoon", start: "19:00", end: "22:00", shows: ["coraje", "billy-mandy", "chicas-superpoderosas", "foster", "samurai-jack"] },
      { name: "Noche Toon", start: "22:00", end: "24:00", shows: ["coraje", "samurai-jack", "johnny-bravo", "billy-mandy"] },
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
      { name: "Nick at Nite", start: "00:00", end: "06:00", shows: ["rocko", "aaahh-monstruos", "hey-arnold", "rugrats", "catdog", "invasor-zim"] },
      { name: "Nick Mañanero", start: "06:00", end: "09:00", shows: ["rugrats", "bob-esponja", "thornberrys", "catdog"] },
      { name: "Nicktoons", start: "09:00", end: "13:00", shows: ["hey-arnold", "rocko", "rugrats", "bob-esponja", "rocket-power", "padrinos-magicos", "catdog", "aaahh-monstruos"] },
      { name: "Nick Después del Cole", start: "13:00", end: "17:00", shows: ["padrinos-magicos", "jimmy-neutron", "bob-esponja", "danny-phantom", "rocket-power"] },
      { name: "Prime Toons", start: "17:00", end: "20:00", shows: ["avatar", "danny-phantom", "bob-esponja", "padrinos-magicos", "invasor-zim"] },
      { name: "SNICK", start: "20:00", end: "24:00", shows: ["invasor-zim", "avatar", "hey-arnold", "rocko", "aaahh-monstruos"] },
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
      { name: "Fox Kids Nocturno", start: "00:00", end: "06:00", shows: ["x-men", "spider-man", "eek", "power-rangers"] },
      { name: "Fox Kids Club", start: "06:00", end: "10:00", shows: ["eek", "oggy", "power-rangers", "digimon"] },
      { name: "Héroes de la Mañana", start: "10:00", end: "14:00", shows: ["x-men", "spider-man", "power-rangers", "eek", "oggy"] },
      { name: "Zona Anime", start: "14:00", end: "17:00", shows: ["digimon", "shaman-king", "digimon"] },
      { name: "Power Hour", start: "17:00", end: "20:00", shows: ["power-rangers", "x-men", "spider-man", "shaman-king"] },
      { name: "Fox Kids Prime", start: "20:00", end: "24:00", shows: ["spider-man", "x-men", "digimon", "eek"] },
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
      { name: "Jetix Nocturno", start: "00:00", end: "06:00", shows: ["oggy", "totally-spies", "power-rangers", "witch"] },
      { name: "Jetix Mañana", start: "06:00", end: "10:00", shows: ["oggy", "totally-spies", "witch", "digimon"] },
      { name: "Jetix Max", start: "10:00", end: "14:00", shows: ["srmthfg", "power-rangers", "galactik-football", "monster-buster", "shaman-king"] },
      { name: "Jetix Girls", start: "14:00", end: "17:00", shows: ["totally-spies", "witch", "totally-spies"] },
      { name: "Hora de Acción", start: "17:00", end: "21:00", shows: ["power-rangers", "srmthfg", "galactik-football", "digimon", "shaman-king"] },
      { name: "Jetix Prime", start: "21:00", end: "24:00", shows: ["monster-buster", "galactik-football", "totally-spies", "oggy"] },
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
      { name: "Clásicos de Madrugada", start: "00:00", end: "06:00", shows: ["gargoyles", "timon-pumbaa", "pepper-ann", "recreo"] },
      { name: "Disney Mañanero", start: "06:00", end: "09:00", shows: ["timon-pumbaa", "lilo-stitch", "recreo"] },
      { name: "One Saturday Morning", start: "09:00", end: "13:00", shows: ["recreo", "pepper-ann", "timon-pumbaa", "gargoyles", "lilo-stitch"] },
      { name: "Zona Disney", start: "13:00", end: "17:00", shows: ["kim-possible", "lilo-stitch", "replacements", "jake-long"] },
      { name: "XD Prime", start: "17:00", end: "21:00", shows: ["phineas-ferb", "kim-possible", "jake-long", "replacements"] },
      { name: "Noche XD", start: "21:00", end: "24:00", shows: ["gargoyles", "jake-long", "kim-possible", "phineas-ferb"] },
    ],
  },
];

export const channelById = Object.fromEntries(channels.map((c) => [c.id, c])) as Record<ChannelId, Channel>;

export function isChannelId(value: string | undefined | null): value is ChannelId {
  return !!value && value in channelById;
}
