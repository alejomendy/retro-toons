import type { Channel, ChannelId, ScheduleBlock } from "@/lib/types";

/**
 * Programación semanal de cada canal, como en la tele de los 90s/2000s: franjas temáticas
 * de lunes a viernes, especiales del viernes a la noche y grillas propias para sábado y domingo.
 *
 * Cada bloque lista sus series por el nombre que tienen en LACartoons (`lacartoons`) y,
 * opcionalmente, series locales (`shows`, ver data/shows.ts) que se pueden ver desde otras
 * fuentes legales si LACartoons no las tiene. `days` dice qué días va el bloque (0 = domingo);
 * los bloques de cada día tienen que cubrir las 24 hs. El episodio cambia día a día (lib/lacartoons-schedule.ts).
 */

const LUN_VIE = [1, 2, 3, 4, 5];
const LUN_JUE = [1, 2, 3, 4];
const VIE = [5];
const SAB = [6];
const DOM = [0];
const FINDE = [0, 6];
const TODOS = [0, 1, 2, 3, 4, 5, 6];

const b = (days: number[], name: string, start: string, end: string, lacartoons: string[], extra: Partial<ScheduleBlock> = {}): ScheduleBlock => ({
  name,
  start,
  end,
  days,
  lacartoons,
  ...extra,
});

export const channels: Channel[] = [
  {
    id: "cartoon-network",
    name: "Cartoon Network",
    tagline: "Lo mejor en dibujos animados",
    color: "#111111",
    ink: "#ffffff",
    years: "1992 – hoy",
    description: "Los Cartoon Cartoons, Toonami y los clásicos de Hanna-Barbera.",
    lacartoons: ["Cartoon Network", "Hanna Barbera"],
    blocks: [
      // Lunes a viernes
      b(LUN_VIE, "Madrugada Toon", "00:00", "06:00", [
        "Coraje El Perro Cobarde", "Samurai Jack", "Las Sombrias Aventuras de Billy Y Mandy", "Johnny Bravo",
        "Mike, Lu y Og", "Duck Dodgers", "Megas XLR", "Hi Hi Puffy AmiYumi", "Swat Kats", "Code Lyoko",
        "Drama Total", "Un Show Mas", "Hora de Aventura", "2 Perros Tontos", "Soy La Comadreja",
      ], { shows: ["billy-mandy", "dexter", "hora-de-aventura", "un-show-mas", "gumball", "drama-total", "camp-lazlo", "gym-partner", "foster"] }),
      b(LUN_VIE, "Boomerang", "06:00", "09:00", [
        "Tom y Jerry", "Looney Tunes", "Scooby-Doo, ¿Dónde estás?", "Los Picapiedras", "El Oso Yogui",
        "Don Gato y Su Pandilla", "Pixie, Dixie y El Gato Jinks", "Los Supersónicos", "Maguila Gorila",
        "Huckleberry Hound", "Hong Kong Phooey", "Capitan Cavernicola y los Angeles Adolescentes",
        "Los Autos Locos", "El Escuadrón Diabólico", "Los Pitufos", "La Hormiga Atomica",
        "Los peligros de Penélope Glamour", "Josie y sus gatimelódicas", "Jonny Quest", "Los Super Amigos",
        "Frankenstein Jr.", "Garfield",
      ]),
      b(LUN_VIE, "Cartoon Cartoons", "09:00", "13:00", [
        "El Laboratorio de Dexter", "Las Chicas Super Poderosas", "Johnny Bravo", "La Vaca y El Pollito",
        "Ed, Edd y Eddy", "Coraje El Perro Cobarde", "KND: Los Chicos Del Barrio",
        "Las Maravillosas Desventuras de FlapJack", "Soy La Comadreja", "Mike, Lu y Og",
        "Hi Hi Puffy AmiYumi", "Mucha Lucha", "Duck Dodgers", "2 Perros Tontos", "Los Sabados Secretos",
      ], { shows: ["dexter", "chicas-superpoderosas", "vaca-pollito", "ed-edd-eddy", "coraje", "johnny-bravo", "foster", "camp-lazlo", "gym-partner", "megas-xlr", "puffy-amiyumi", "kids-next-door"] }),
      b(LUN_VIE, "Hora del Almuerzo", "13:00", "16:00", [
        "Pokemon", "Ben 10", "Las Sombrias Aventuras de Billy Y Mandy", "KND: Los Chicos Del Barrio",
        "Mucha Lucha", "Un Show Mas", "Hora de Aventura", "Ed, Edd y Eddy", "Drama Total", "Code Lyoko",
        "Zatch Bell", "Las Aventuras de Jackie Chang", "La Mascara Serie Animada",
        "El Capitán Planeta y los planetarios", "Max Steel", "Garfield",
      ], { shows: ["billy-mandy", "hora-de-aventura", "un-show-mas", "gumball", "drama-total", "ben-10", "foster"] }),
      b(LUN_VIE, "Toonami", "16:00", "19:00", [
        "Dragon Ball Z", "Dragon Ball", "Dragon Ball GT", "Samurai X", "Yu yu Hakusho",
        "Sakura Card Captors", "Los Jovenes Titanes", "Samurai Jack", "Caballeros del Zodiaco",
        "Zatch Bell", "Megaman NT Warriors", "Robotech", "Star Wars: La Guerra De Los Clones",
        "Transformers Beast Machine", "Astro Boy 2003", "Ben 10: Fuerza Alienigena", "Generador Rex", "Static Shock",
      ], { shows: ["dbz", "dragon-ball-clasico", "dragon-ball-gt", "samurai-x", "yu-yu-hakusho", "saint-seiya", "samurai-jack", "jovenes-titanes", "inuyasha", "bakugan"] }),
      b(LUN_JUE, "Prime Toon", "19:00", "22:00", [
        "Liga de La Justicia", "Liga de La Justicia Ilimitada", "Static Shock", "Ben 10: Fuerza Alienigena",
        "Generador Rex", "Hora de Aventura", "Un Show Mas", "Justicia Joven",
        "Ben 10: Supremacia Alienigena", "Swat Kats", "Los Jovenes Titanes", "Batman El Valiente",
        "El Proyecto Zeta", "Star Wars: La Guerra De Los Clones",
      ], { shows: ["liga-justicia", "hora-de-aventura", "un-show-mas", "gumball", "jovenes-titanes"] }),
      b(VIE, "Viernes de Cartoon", "19:00", "22:00", [
        "El Laboratorio de Dexter", "Las Chicas Super Poderosas", "Johnny Bravo",
        "Coraje El Perro Cobarde", "Las Sombrias Aventuras de Billy Y Mandy", "Megas XLR",
        "Ed, Edd y Eddy", "La Vaca y El Pollito", "KND: Los Chicos Del Barrio", "Hi Hi Puffy AmiYumi",
      ], { shows: ["dexter", "chicas-superpoderosas", "billy-mandy", "vaca-pollito", "foster", "megas-xlr", "camp-lazlo"] }),
      b([0, 1, 2, 3, 4, 5], "Noche Toon", "22:00", "24:00", [
        "Coraje El Perro Cobarde", "Samurai Jack", "Harvey Birdman El Abogado", "CowBoy Bebop",
        "Trigun", "El Fantasma Del Espacio", "Duck Dodgers", "Mike, Lu y Og",
      ], { shows: ["coraje", "samurai-jack", "cowboy-bebop", "trigun"] }),
      // Fin de semana
      b(FINDE, "Trasnoche Toonami", "00:00", "07:00", [
        "CowBoy Bebop", "Trigun", "Samurai Champloo", "Samurai X", "Harvey Birdman El Abogado",
        "Yu yu Hakusho", "Robotech", "Caballeros del Zodiaco", "Mazinger Z", "Astro Boy 1980",
      ], { shows: ["inuyasha", "evangelion", "cowboy-bebop", "trigun", "samurai-champloo", "mazinger-z"] }),
      b(SAB, "Sábados de Hanna-Barbera", "07:00", "12:00", [
        "Los Picapiedras", "Los Supersónicos", "Scooby-Doo, ¿Dónde estás?", "El Oso Yogui",
        "Los Autos Locos", "Don Gato y Su Pandilla", "Tiro Loco Mcgraw", "Jonny Quest",
        "Las Olimpiadas De La Risa", "Maguila Gorila", "Los Herculoides", "Hong Kong Phooey",
        "Los Super Amigos", "Birdman", "Frankenstein Jr.", "Capitan Cavernicola y los Angeles Adolescentes",
        "Los Pitufos", "El Escuadrón Diabólico", "Thundarr El Bárbaro", "Las Nuevas Aventuras De Jonny Quest",
        "Ricky Ricón", "Yo Yogi!", "Canuto y Canito", "Los Imposibles",
      ]),
      b(SAB, "Maratón Cartoon Cartoons", "12:00", "17:00", [
        "El Laboratorio de Dexter", "Las Chicas Super Poderosas", "Johnny Bravo",
        "La Vaca y El Pollito", "Ed, Edd y Eddy", "Coraje El Perro Cobarde",
        "Las Sombrias Aventuras de Billy Y Mandy", "KND: Los Chicos Del Barrio", "Soy La Comadreja",
        "Hi Hi Puffy AmiYumi", "Mike, Lu y Og", "Mucha Lucha", "Duck Dodgers", "2 Perros Tontos",
      ], { shows: ["dexter", "chicas-superpoderosas", "vaca-pollito", "billy-mandy", "foster", "megas-xlr", "puffy-amiyumi", "kids-next-door", "camp-lazlo", "gym-partner"] }),
      b(SAB, "Sábado de Acción", "17:00", "21:00", [
        "Ben 10", "Liga de La Justicia", "Los Jovenes Titanes", "Static Shock", "Samurai Jack",
        "Batman El Valiente", "X-men Evolucion", "Justicia Joven", "Ben 10: Supremacia Alienigena",
        "Ben 10: Fuerza Alienigena", "Generador Rex", "Batman La Serie Animada",
        "Star Wars: La Guerra De Los Clones", "Max Steel",
      ], { shows: ["liga-justicia", "jovenes-titanes", "ben-10", "batman-tas"] }),
      b(SAB, "Toonami Sábado", "21:00", "24:00", [
        "Dragon Ball Z", "Dragon Ball GT", "Samurai X", "Yu yu Hakusho", "Pokemon",
        "Caballeros del Zodiaco", "Zatch Bell", "Sakura Card Captors",
      ], { shows: ["dbz", "dragon-ball-gt", "inuyasha", "bakugan", "saint-seiya", "yu-yu-hakusho"] }),
      b(DOM, "Hora Acme", "07:00", "12:00", [
        "Tom y Jerry", "Looney Tunes", "Popeye", "Droopy", "La Pantera Rosa",
        "Los Pequeños Looney Tunes", "El Coyote y El Corre Caminos", "El Gallo Claudio", "Taz-Mania",
        "Garfield", "Felix El Gato", "Gasparin y sus amigos", "La Pequeña Lulú",
      ]),
      b(DOM, "Domingo de Scooby-Doo", "12:00", "17:00", [
        "Scooby-Doo, ¿Dónde estás?", "El Show De Scooby Doo", "¿Qué hay de nuevo, Scooby-Doo?",
        "Scooby Doo Misterios S.A", "Un Cachorro Llamado Scooby Doo", "Los 13 Fantasmas de Sooby Doo!",
        "El show de Scooby-Doo y Scrappy-Doo", "Las Nuevas Peliculas De Scooby Doo", "Shaggy y Scooby-Doo detectives",
      ], { exclusive: true }),
      b(DOM, "Domingo de Aventura", "17:00", "22:00", [
        "Hora de Aventura", "Un Show Mas", "Ben 10", "Generador Rex",
        "Las Maravillosas Desventuras de FlapJack", "Johnny Test", "Las Aventuras de TinTin",
        "Las Increibles Aventuras de Jonny Quest", "Las Aventuras de Jackie Chang",
        "Drama Total", "KND: Los Chicos Del Barrio",
      ], { shows: ["hora-de-aventura", "un-show-mas", "ben-10", "gumball", "drama-total"] }),
    ],
  },
  {
    id: "nickelodeon",
    name: "Nickelodeon",
    tagline: "¡Nick, Nick, Nick!",
    color: "#ff7a00",
    ink: "#ffffff",
    years: "1979 – hoy",
    description: "Los Nicktoons, las series de Nick en vivo y SNICK los sábados a la noche.",
    lacartoons: ["Nickelodeon"],
    blocks: [
      b(LUN_VIE, "Nick at Nite", "00:00", "06:00", [
        "Alf", "La Familia Addams", "Mi Bella Genio", "Super Agente 86", "Los 3 Chiflados",
        "Blanco y Negro", "Los Munsters", "Hechizada", "El Principe Del Rap En Bel-Air",
        "Kenan & Kel", "Full House",
      ], { exclusive: true }),
      b(LUN_VIE, "Nick Jr.", "06:00", "09:00", [
        "La Tortuga Franklin", "El Mundo Fantastico de Richard Scarry",
        "Los Rugrats: Aventuras En Pañales", "Doug", "Los Thornberrys", "Bob Esponja",
        "¡Oye, Arnold!", "CatDog",
      ], { shows: ["rugrats", "hey-arnold", "catdog", "thornberrys", "doug"] }),
      b(LUN_VIE, "Nicktoons", "09:00", "13:00", [
        "¡Oye, Arnold!", "Los Rugrats: Aventuras En Pañales", "La Vida Moderna de Rocko", "CatDog",
        "Rocket Power", "Los padrinos mágicos", "Los Castores Cascarrabias", "Bob Esponja",
        "Mi Padre El Rockero", "Zona Tiza", "Kappa Mikey", "Aaahh!! Monstruos de Verdad",
        "Doug", "Los Thornberrys", "Ginger", "Ren y Stimpy", "La Robot Adolescente",
        "Creepie", "Poochini", "Super Duper Sumos",
      ], { shows: ["padrinos-magicos", "catdog", "castores", "rugrats", "hey-arnold", "rocko", "ren-stimpy", "thornberrys", "ginger", "nina-robot", "el-tigre", "aaahh-monstruos", "doug"] }),
      b(LUN_VIE, "Nick Después del Cole", "13:00", "17:00", [
        "Bob Esponja", "Las Aventuras de Jimmy Neutrón: El Niño Genio", "Danny Phantom",
        "La Robot Adolescente", "Los padrinos mágicos", "Rocket Power", "Los Pingüinos De Madagascar",
        "Ginger", "Mighty B!, La Sùper Abeja", "Mi Padre El Rockero", "CatDog",
        "Invasor Zim", "T.U.F.F. Puppy, Agente Secreto", "El Club Winx",
      ], { shows: ["padrinos-magicos", "bob-esponja", "jimmy-neutron", "danny-phantom", "nina-robot", "el-tigre", "la-granja", "tak", "los-x"] }),
      b([1, 2, 3, 4, 5, 6], "Nick en Vivo", "17:00", "20:00", [
        "Drake & Josh", "Kenan & Kel", "El Show de Amanda", "Zoey 101", "ICarly",
        "Clarissa Lo Explica Todo", "Victorius", "Manual De Supervivencia Escolar De Ned",
        "Sam & Cat", "Los Archivos Secretos De Shelby Woo", "Isa TKM", "Isa TK+", "31 Minutos",
      ], { shows: ["drake-josh", "kenan-kel", "icarly"] }),
      b([0, 1, 2, 3, 4, 5], "Horario Estelar Nick", "20:00", "24:00", [
        "Avatar La Leyenda de Aang", "Avatar La Leyenda de Korra", "Invasor Zim", "Danny Phantom",
        "Le Temes A La Oscuridad?", "El Misterio de Anubis", "Bob Esponja",
        "Las Aventuras de Jimmy Neutrón: El Niño Genio", "La Robot Adolescente",
      ], { shows: ["avatar", "invasor-zim", "danny-phantom", "bob-esponja"] }),
      b(FINDE, "Trasnoche Nick", "00:00", "07:00", [
        "Ren y Stimpy", "La Vida Moderna de Rocko", "Aaahh!! Monstruos de Verdad",
        "Los Castores Cascarrabias", "Invasor Zim", "Doug", "¡Oye, Arnold!", "Creepie",
      ], { shows: ["castores", "ren-stimpy", "rocko", "hey-arnold", "aaahh-monstruos", "invasor-zim"] }),
      b(SAB, "Sábados de Nicktoons", "07:00", "12:00", [
        "Los Rugrats: Aventuras En Pañales", "¡Oye, Arnold!", "Doug", "La Vida Moderna de Rocko",
        "CatDog", "Rocket Power", "Bob Esponja", "Los Thornberrys", "Zona Tiza", "Pelswick",
        "Los Castores Cascarrabias", "Ginger", "Aaahh!! Monstruos de Verdad", "Ren y Stimpy",
        "Poochini", "Super Duper Sumos",
      ], { shows: ["catdog", "rugrats", "hey-arnold", "castores", "thornberrys", "rocko", "ren-stimpy", "el-tigre", "doug"] }),
      b(SAB, "Sábado Bob Esponja", "12:00", "17:00", [
        "Bob Esponja", "Los padrinos mágicos", "Las Aventuras de Jimmy Neutrón: El Niño Genio",
        "Danny Phantom", "Rocket Power", "La Robot Adolescente",
      ], { shows: ["padrinos-magicos", "bob-esponja", "danny-phantom", "jimmy-neutron", "la-granja", "tak"] }),
      b(SAB, "SNICK", "20:00", "24:00", [
        "Le Temes A La Oscuridad?", "Ren y Stimpy", "Invasor Zim", "Aaahh!! Monstruos de Verdad",
        "Kenan & Kel", "El Show de Amanda", "Clarissa Lo Explica Todo",
        "Los Archivos Secretos De Shelby Woo",
      ], { shows: ["kenan-kel", "invasor-zim", "ren-stimpy"] }),
      b(DOM, "Domingo Nick", "07:00", "12:00", [
        "Los Rugrats: Aventuras En Pañales", "Rugrats Crecidos", "¡Oye, Arnold!", "Los Thornberrys",
        "Las Aventuras de Jimmy Neutrón: El Niño Genio", "El Show De Charlie Brown y Snoopy",
        "Doug", "CatDog", "Los Castores Cascarrabias",
      ], { shows: ["rugrats", "hey-arnold", "thornberrys", "catdog", "castores", "doug"] }),
      b(DOM, "Nicktoons de Domingo", "12:00", "17:00", [
        "Bob Esponja", "Los padrinos mágicos", "Danny Phantom", "La Robot Adolescente",
        "T.U.F.F. Puppy, Agente Secreto", "Los Pingüinos De Madagascar",
        "Mighty B!, La Sùper Abeja", "Kappa Mikey", "El Club Winx",
      ], { shows: ["padrinos-magicos", "bob-esponja", "danny-phantom", "nina-robot", "el-tigre", "los-x"] }),
      b(DOM, "Maratón Avatar", "17:00", "20:00", [
        "Avatar La Leyenda de Aang", "Avatar La Leyenda de Korra",
      ], { exclusive: true, shows: ["avatar"] }),
    ],
  },
  {
    id: "jetix",
    name: "Jetix",
    tagline: "¡Siente la acción!",
    color: "#e4002b",
    ink: "#ffffff",
    years: "1990 – 2009",
    description: "De Fox Kids a Jetix: Power Rangers, superhéroes de Marvel, Invasión Animé y la Doble Carga de los domingos.",
    lacartoons: ["Fox Kids", "Marvel"],
    blocks: [
      b(LUN_VIE, "Jetix Nocturno", "00:00", "06:00", [
        "X-Men Serie Animada", "Spider-Man: La Serie Animada", "Transformers G1",
        "He-Man y los Amos del Universo", "Las Tortugas Ninjas", "Double Dragon", "Gi Joe",
        "She-Ra La Princesa Del Poder", "Cadillacs y Dinosaurios", "Street Sharks", "Reboot",
        "Los Centuriones", "Thundercats", "Los Gatos Samurais", "Capitán N",
        "Los Verdaderos Cazafantasmas", "Street Fighter II-V", "Transformers La Guerra de Bestias",
        "Cybersix", "Wild C.A.T.S",
      ], { shows: ["x-men", "spider-man", "tmnt-2003"] }),
      b(LUN_VIE, "Jetix Mañana", "06:00", "09:00", [
        "Oggy Y Las Cucarachas", "Pucca", "Eek! El Gato", "El Inspector Gadget",
        "El Pájaro Loco y Amigos", "Yin Yang Yo!", "Kid Músculo", "El Colegio Del Agujero Negro",
        "Los Misterios de Moville", "Dientes De Lata", "Angela Anaconda", "Shuriken School",
        "Martin Mystery", "Oban Star Racers", "Sonic X", "El Mundo de Bobby", "La Garrapata",
        "¿Dónde en el mundo está Carmen Sandiego?", "Mad Jack El Pirata", "Jacobo Dos Dos",
      ], { shows: ["totally-spies", "kid-vs-kat", "oggy", "pucca", "eek"] }),
      b(LUN_VIE, "Fox Kids Clásico", "09:00", "13:00", [
        "Power Rangers", "X-Men Serie Animada", "Spider-Man: La Serie Animada",
        "Las Tortugas Ninjas", "Big Bad Beetleborgs", "Vr Troopers", "El Inspector Gadget",
        "Power Rangers Zeo", "Power Rangers Turbo", "Los Verdaderos Cazafantasmas",
        "He-Man y los Amos del Universo", "Thundercats", "Transformers G1",
        "Silver Surfer", "Los 4 Fantasticos La Serie Animada", "Transformers La Guerra de Bestias",
        "El Mundo de Bobby", "La Garrapata", "Spiderman y Sus Sorprendentes Amigos",
      ], { shows: ["power-rangers", "x-men", "spider-man", "tmnt-2003", "extreme-ghostbusters", "beetleborgs", "eek"] }),
      b(LUN_VIE, "Tardes de Acción", "13:00", "17:00", [
        "Power Rangers", "X-Men Serie Animada", "Spider-Man: La Serie Animada",
        "Las Tortugas Ninjas", "Los 4 Fantásticos: Los Héroes más Grandes del Mundo",
        "Alienators: Evolucion Continua", "Los Verdaderos Cazafantasmas", "Martin Mystery",
        "Transformers Armada", "El Increible Hulk", "Iron Man: La Serie Animada",
        "Los Vengadores: Los Héroes Más Poderosos Del Planeta", "X-men Evolucion",
        "Wolverine y los X-men", "El Espectacular Hombre Araña", "Los Vengadores: United They Stand",
      ], { shows: ["power-rangers", "x-men", "spider-man", "tmnt-2003", "totally-spies", "srmthfg", "monster-buster"] }),
      b(LUN_VIE, "Invasión Animé", "17:00", "21:00", [
        "Digimon: Digital Monsters", "Digimon Adventure 02", "Shaman King",
        "Sailor  Moon", "Monster Rancher", "Medabots", "BeyBlade", "Shinzo", "Sonic X",
        "Transformers Armada", "Digimon 3 Tamers", "Digimon 4 Frontier",
        "Caballeros del Zodiaco", "Dragon Ball Z", "Dragon Ball GT", "Dragon Quest",
      ], { shows: ["digimon", "shaman-king", "sailor-moon", "saint-seiya"] }),
      b(FINDE, "Jetix Max", "17:00", "21:00", [
        "Power Rangers", "Power Rangers Tormenta Ninja", "Power Rangers Dino Trueno",
        "Super Escuadrón Ciber Monos Hiperfuerza ¡Ya!", "Action Man: A.T.O.M.", "Sonic X",
        "Yin Yang Yo!", "Power Rangers En El Espacio", "Power Rangers Fuerza Mistica",
        "Power Rangers Super Patrulla Delta", "Martin Mystery", "Oban Star Racers",
        "Power Rangers En La Galaxia Perdida", "Power Rangers A La Velocidad De La Luz",
        "Power Rangers Fuerza Del Tiempo", "Power Rangers Fueza Salvaje",
        "Power Rangers Operacion Sobrecarga", "Power Rangers Furia Animal",
      ], { shows: ["totally-spies", "power-rangers", "witch", "galactik-football", "srmthfg", "monster-buster"] }),
      b(TODOS, "Héroes Marvel", "21:00", "24:00", [
        "X-Men Serie Animada", "Spider-Man: La Serie Animada", "El Increible Hulk",
        "Iron Man: La Serie Animada", "Los 4 Fantasticos La Serie Animada", "Silver Surfer",
        "Los Vengadores: Los Héroes Más Poderosos Del Planeta", "X-men Evolucion",
        "Wolverine y los X-men", "El Espectacular Hombre Araña", "Spiderman Sin Limites",
        "Los 4 Fantásticos: Los Héroes más Grandes del Mundo", "Los Vengadores: United They Stand",
        "Spiderman y Sus Sorprendentes Amigos", "Mujer Araña (Spider Woman)", "Iron Man: Aventuras De Hierro",
        "Ultimate Spider-Man",
      ], { shows: ["x-men", "spider-man"] }),
      b(FINDE, "Mysteria", "00:00", "03:00", [
        "Cuentos De La Cripta: Serie Animada", "Toonsylvania", "La Momia: La Serie Animada",
        "Momias  Aqui", "Alienators: Evolucion Continua", "Cybersix",
        "Sherlock Holmes En El Siglo XXII", "Grotescologia",
      ]),
      b(FINDE, "Trasnoche Jetix", "03:00", "07:00", [
        "Cuentos De La Cripta: Serie Animada", "Mortal Kombat: Defensores Del Reino",
        "Street Fighter II-V", "Robocop: La Serie Animada", "Gundam Wing", "Transformers G1",
        "Los Gatos Samurais", "Cadillacs y Dinosaurios", "Transformers La Guerra de Bestias",
        "Wild C.A.T.S", "X-Men Anime",
      ]),
      b(SAB, "Sábados de Fox Kids", "07:00", "12:00", [
        "Power Rangers", "X-Men Serie Animada", "Spider-Man: La Serie Animada",
        "Eek! El Gato", "Las Tortugas Ninjas", "Big Bad Beetleborgs",
        "El Show de Super Mario Bros", "Super Mario World", "Power Rangers Zeo",
        "Los Verdaderos Cazafantasmas", "Street Sharks", "He-Man y los Amos del Universo",
        "Thundercats", "El Inspector Gadget", "El Mundo de Bobby", "La Garrapata",
        "¿Dónde en el mundo está Carmen Sandiego?",
      ], { shows: ["power-rangers", "x-men", "spider-man", "tmnt-2003", "beetleborgs", "eek"] }),
      b(SAB, "Maratón Digimon", "12:00", "17:00", [
        "Digimon: Digital Monsters", "Digimon Adventure 02", "Digimon 3 Tamers", "Digimon 4 Frontier",
      ], { exclusive: true, shows: ["digimon"] }),
      b(DOM, "Domingo Jetix", "07:00", "11:00", [
        "Oggy Y Las Cucarachas", "Pucca", "Yin Yang Yo!", "El Inspector Gadget",
        "El Pájaro Loco y Amigos", "Sonic X", "Martin Mystery", "Shuriken School", "Kid Músculo",
      ], { shows: ["totally-spies", "kid-vs-kat", "oggy", "pucca", "witch"] }),
      // Doble Carga: dos episodios seguidos de la misma serie (domingos al mediodía en Fox Kids).
      b(DOM, "Doble Carga", "11:00", "12:00", [
        "Power Rangers", "X-Men Serie Animada", "Las Tortugas Ninjas",
        "Digimon: Digital Monsters", "Spider-Man: La Serie Animada", "Medabots", "Sonic X",
      ], { exclusive: true, double: true, shows: ["power-rangers", "digimon"] }),
      b(DOM, "Sonic y Mario", "12:00", "17:00", [
        "Sonic X", "Sonic Underground", "El Show de Super Mario Bros", "Super Mario Bros 3",
        "Super Mario World", "El Pais De Donkey Kong", "Capitán N",
      ]),
    ],
  },
  {
    id: "disney",
    name: "Disney",
    tagline: "La magia de Disney",
    color: "#113ccf",
    ink: "#ffffff",
    years: "1983 – hoy",
    description: "La tarde Disney, Recreo, Kim Possible, Phineas y Ferb y los clásicos de siempre.",
    lacartoons: ["Disney"],
    blocks: [
      b(LUN_VIE, "Clásicos de Madrugada", "00:00", "06:00", [
        "Gargolas, Heroes Goticos", "Pato Aventuras", "Chip & Dale: Guardianes Rescatadores",
        "El Pato Darkwing", "Aventureros Del Aire", "Bonkers", "Las Aventuras De Los Osos Gummis",
        "101 Dalmatas", "Quack Pack", "La Sirenita Serie Animada",
        "Aladdin La serie Animada", "La Leyenda De Tarzan",
      ], { shows: ["gargoyles", "ducktales", "chip-dale", "darkwing", "talespin", "bonkers", "goof-troop", "101-dalmatas", "sirenita-serie", "aladdin", "tarzan-serie", "osos-gummi"] }),
      b(LUN_VIE, "Disney Mañanero", "06:00", "09:00", [
        "Las Nuevas Aventuras De Winnie The Pooh", "Timon y Pumba", "101 Dalmatas",
        "Las Aventuras De Los Osos Gummis", "Lilo & Stich", "Quack Pack",
        "Aladdin La serie Animada", "La Sirenita Serie Animada", "Chip & Dale: Guardianes Rescatadores",
      ], { shows: ["winnie-pooh", "timon-pumbaa", "101-dalmatas", "lilo-stitch", "chip-dale", "sirenita-serie", "aladdin", "osos-gummi"] }),
      b(LUN_VIE, "Recreo de Disney", "09:00", "13:00", [
        "Recreo: La Serie Animada", "Pepper Ann", "Timon y Pumba", "Hercules: La Serie Animada",
        "Aladdin La serie Animada", "La Sirenita Serie Animada", "Quack Pack",
        "101 Dalmatas", "Bonkers", "Las Aventuras De Los Osos Gummis",
        "Pato Aventuras", "Chip & Dale: Guardianes Rescatadores",
      ], { shows: ["recreo", "pepper-ann", "doug", "timon-pumbaa", "hercules", "aladdin", "sirenita-serie", "101-dalmatas", "goof-troop", "ducktales", "chip-dale"] }),
      b(LUN_VIE, "Zapping Zone", "13:00", "17:00", [
        "Kim Possible", "Lilo & Stich", "Jake Long: El Dragón Occidental",
        "Las Aventuras de Brandy y El Señor Bigotes", "Las Nuevas Locuras Del Emperador",
        "Phineas y Pherb", "Sabrina: La Serie Animada", "Dave El Barbaro",
      ], { shows: ["kim-possible", "lilo-stitch", "jake-long", "brandy", "locuras-emperador", "phineas-ferb", "dave-barbarian", "replacements", "kick-buttowski", "randy-cunningham", "gravity-falls", "star-butterfly", "lizzie-mcguire", "es-tan-raven"] }),
      // Las series de imagen real del Disney Channel de los 2000s (salen de sus fuentes propias, ver data/shows.ts).
      b(TODOS, "Disney Channel en Vivo", "17:00", "19:00", [
        "Kim Possible", "Phineas y Pherb",
      ], { shows: ["hannah-montana", "hechiceros-waverly", "zack-cody", "es-tan-raven", "lizzie-mcguire"] }),
      b(TODOS, "Disney XD", "19:00", "21:00", [
        "Phineas y Pherb", "Kim Possible", "Jake Long: El Dragón Occidental",
        "Super Escuadrón Ciber Monos Hiperfuerza ¡Ya!", "Dave El Barbaro",
        "Power Rangers RPM", "Power Rangers Samurai", "Power Rangers Super Samurai",
      ], { shows: ["phineas-ferb", "kim-possible", "jake-long", "srmthfg", "dave-barbarian", "kick-buttowski", "randy-cunningham", "gravity-falls", "star-butterfly", "amphibia", "owl-house", "wander"] }),
      b(TODOS, "Noche Disney", "21:00", "24:00", [
        "Gargolas, Heroes Goticos", "El Pato Darkwing", "Hercules: La Serie Animada",
        "La Leyenda De Tarzan", "El Mundo De Quest", "Policia De Cuentos De Hadas",
        "Kim Possible", "Phineas y Pherb",
      ], { shows: ["gargoyles", "darkwing", "hercules", "tarzan-serie", "kim-possible", "gravity-falls", "phineas-ferb"] }),
      b(FINDE, "Trasnoche Disney", "00:00", "07:00", [
        "Gargolas, Heroes Goticos", "El Pato Darkwing", "Aventureros Del Aire", "Bonkers",
        "Los Vaqueros de Moo Mesa", "Chip & Dale: Guardianes Rescatadores",
        "Las Aventuras De Los Osos Gummis",
      ], { shows: ["gargoyles", "darkwing", "talespin", "bonkers", "chip-dale", "goof-troop", "osos-gummi"] }),
      b(SAB, "La Tarde Disney", "07:00", "12:00", [
        "Pato Aventuras", "Chip & Dale: Guardianes Rescatadores", "Aventureros Del Aire",
        "El Pato Darkwing", "Bonkers", "Las Aventuras De Los Osos Gummis",
        "La Sirenita Serie Animada", "Aladdin La serie Animada", "Hercules: La Serie Animada",
        "La Leyenda De Tarzan", "101 Dalmatas", "Quack Pack",
      ], { shows: ["ducktales", "chip-dale", "talespin", "darkwing", "bonkers", "sirenita-serie", "aladdin", "hercules", "tarzan-serie", "101-dalmatas", "goof-troop"] }),
      b(SAB, "Sábado Kim y Phineas", "12:00", "17:00", [
        "Kim Possible", "Phineas y Pherb", "Lilo & Stich", "Jake Long: El Dragón Occidental",
      ], { shows: ["kim-possible", "phineas-ferb", "lilo-stitch", "jake-long", "gravity-falls", "star-butterfly", "amphibia", "owl-house", "kick-buttowski", "randy-cunningham"] }),
      b(DOM, "Domingo Clásico", "07:00", "12:00", [
        "50 Clasicos de Disney", "Las Nuevas Aventuras De Winnie The Pooh", "Timon y Pumba",
        "La Sirenita Serie Animada", "Aladdin La serie Animada", "101 Dalmatas",
        "Pato Aventuras", "Chip & Dale: Guardianes Rescatadores", "Las Aventuras De Los Osos Gummis",
      ], { shows: ["winnie-pooh", "timon-pumbaa", "sirenita-serie", "aladdin", "101-dalmatas", "ducktales", "chip-dale"] }),
      b(DOM, "Domingo en Familia", "12:00", "17:00", [
        "Recreo: La Serie Animada", "Pepper Ann", "Las Nuevas Locuras Del Emperador",
        "Hercules: La Serie Animada", "La Leyenda De Tarzan",
        "Las Aventuras de Brandy y El Señor Bigotes", "Gargolas, Heroes Goticos",
      ], { shows: ["recreo", "pepper-ann", "doug", "locuras-emperador", "hercules", "tarzan-serie", "brandy", "gargoyles", "wander", "amphibia"] }),
    ],
  },
  {
    id: "warner",
    name: "Warner Channel",
    tagline: "¡Eso es todo, amigos!",
    color: "#0a2d6e",
    ink: "#ffd400",
    years: "1995 – hoy",
    description: "Looney Tunes, Animaniacs, los héroes de DC y las sitcoms de siempre.",
    lacartoons: ["Warner Channel"],
    blocks: [
      b(TODOS, "Trasnoche Warner", "00:00", "06:00", [
        "Batman La Serie Animada", "Superman La Serie Animada", "Batman Del Futuro",
        "Thundercats", "Los Halcones Galácticos", "Liga de La Justicia",
        "Batman El Valiente", "Los Jovenes Titanes", "Justicia Joven", "Static Shock",
        "El Proyecto Zeta", "The Batman",
      ], { shows: ["batman-tas", "batman-del-futuro"] }),
      b(LUN_VIE, "Warner de Mañana", "06:00", "09:00", [
        "El Mundo De Beakman", "Looney Tunes", "Las Aventuras de Silvestre y Piolin",
        "El Coyote y El Corre Caminos", "El Gallo Claudio", "Taz-Mania",
        "Tom y Jerry", "La Pantera Rosa", "El Pájaro Loco y Amigos",
      ]),
      b(LUN_VIE, "House of Toons", "09:00", "13:00", [
        "Animaniacs", "Tiny Toons", "Pinky y Cerebro", "Fenomenoide", "Taz-Mania",
        "Pinky, Elvira y Cerebro", "Loonatics", "Hombres de Negro", "Jumanji La Serie Animada",
      ]),
      b(LUN_VIE, "Looney Tunes Show", "13:00", "17:00", [
        "Looney Tunes", "Las Aventuras de Silvestre y Piolin", "El Coyote y El Corre Caminos",
        "El Gallo Claudio", "Taz-Mania", "Los Pequeños Looney Tunes",
        "Tom y Jerry", "La Pantera Rosa",
      ]),
      b(TODOS, "Sitcoms Warner", "17:00", "20:00", [
        "El Principe Del Rap En Bel-Air", "Full House", "El Mundo De Beakman",
        "Jumanji La Serie Animada", "Alf", "Mi Bella Genio", "Hechizada",
      ]),
      b(TODOS, "Héroes DC", "20:00", "24:00", [
        "Batman La Serie Animada", "Las Nuevas Aventuras De Batman",
        "Superman La Serie Animada", "Batman Del Futuro", "The Batman",
        "Liga de La Justicia", "Liga de La Justicia Ilimitada", "Static Shock",
        "Justicia Joven", "Batman El Valiente", "Los Jovenes Titanes", "El Proyecto Zeta",
      ], { shows: ["batman-tas", "batman-del-futuro", "liga-justicia", "jovenes-titanes"] }),
      b(SAB, "Kids WB Sábado", "06:00", "12:00", [
        "Animaniacs", "Pinky y Cerebro", "Tiny Toons", "Batman La Serie Animada",
        "Superman La Serie Animada", "Jumanji La Serie Animada", "Hombres de Negro",
        "Loonatics", "¿Qué hay de nuevo, Scooby-Doo?", "Las Aventuras de Jackie Chang",
        "Static Shock", "The Batman", "Xiaolin Chronicles",
      ], { shows: ["batman-tas"] }),
      b(SAB, "Thundercats y Halcones", "12:00", "17:00", [
        "Thundercats", "Los Halcones Galácticos", "Jumanji La Serie Animada",
        "El Zorro: Serie Animada", "Protagonistas De La Historia",
        "He-Man y los Amos del Universo", "She-Ra La Princesa Del Poder",
      ]),
      b(DOM, "Domingo Looney", "06:00", "12:00", [
        "Looney Tunes", "Las Aventuras de Silvestre y Piolin", "El Coyote y El Corre Caminos",
        "El Gallo Claudio", "Taz-Mania", "Los Pequeños Looney Tunes",
        "Tom y Jerry", "La Pantera Rosa", "El Pájaro Loco y Amigos",
      ]),
      b(DOM, "Domingo de Sitcoms", "12:00", "17:00", [
        "El Principe Del Rap En Bel-Air", "Full House", "El Mundo De Beakman",
      ], { exclusive: true }),
    ],
  },
  {
    id: "fox",
    name: "FOX",
    tagline: "Los Simpson, Futurama y más",
    color: "#f2f2f2",
    ink: "#111111",
    years: "1993 – hoy",
    description: "Animación para grandes y sitcoms de culto: Los Simpson, Futurama, Rick y Morty y Malcolm.",
    lacartoons: ["Otros"],
    blocks: [
      b(TODOS, "Trasnoche FOX", "00:00", "06:00", [
        "Rick y Morty", "Futurama", "La Casa De Los Dibujos", "Happy Tree Friends",
        "Daria", "Stripperella", "Mad", "Los Simpsons",
      ]),
      b(LUN_VIE, "Mañanas FOX", "06:00", "12:00", [
        "Salvados Por La Campana", "Malcolm En El Medio", "El Chavo Del 8", "Los Simpsons",
        "Alf", "Los 3 Chiflados", "Mi Bella Genio", "Hechizada", "Sabrina La Bruja Adolescente",
      ]),
      b(LUN_VIE, "Mediodía FOX", "12:00", "17:00", [
        "Los Simpsons", "Malcolm En El Medio", "Futurama", "El Chavo Del 8",
        "Salvados Por La Campana", "Sabrina La Bruja Adolescente",
        "Salvados Por La Campana: Años De Universidad", "La Familia Addams",
        "Los Munsters", "Star Trek",
      ]),
      b(TODOS, "Hora Simpson", "17:00", "20:00", ["Los Simpsons"], { exclusive: true }),
      b(TODOS, "Prime FOX", "20:00", "24:00", [
        "Futurama", "Rick y Morty", "Los Simpsons", "Malcolm En El Medio", "Daria",
        "La Casa De Los Dibujos",
      ]),
      b(SAB, "Sábado Anime", "06:00", "12:00", [
        "Death Note", "Detective Conan", "Dragon Ball Super", "Slam Dunk", "Ranma 1/2",
        "Super Campeones", "Yu-Gi-Oh!", "Meteoro", "Candy Candy",
        "Caballeros del Zodiaco", "Dragon Ball Z", "Dragon Ball GT",
      ], { shows: ["death-note", "naruto", "one-piece", "bleach", "detective-conan", "slam-dunk", "ranma", "capitan-tsubasa", "dragon-ball-super"] }),
      b(SAB, "Maratón Simpson", "12:00", "17:00", ["Los Simpsons"], { exclusive: true }),
      b(DOM, "Domingo Clásico", "06:00", "12:00", [
        "El Chavo Del 8", "Salvados Por La Campana", "Star Trek",
        "Xena La Princesa guerrera", "Super Agente 86", "Los 3 Chiflados",
        "Alf", "La Familia Addams", "Los Munsters",
      ]),
      b(DOM, "Maratón Futurama", "12:00", "17:00", ["Futurama"], { exclusive: true }),
    ],
  },
];

export const channelById = Object.fromEntries(channels.map((c) => [c.id, c])) as Record<ChannelId, Channel>;

/** Número de canal como en la tele ("01", "02"...), según el orden de la lista. */
export function channelNumber(id: ChannelId): string {
  return String(channels.findIndex((c) => c.id === id) + 1).padStart(2, "0");
}

/** Bloques que van un día dado (0 = domingo), en orden de horario. */
export function blocksForDay(channel: Channel, weekday: number): ScheduleBlock[] {
  return channel.blocks.filter((block) => !block.days || block.days.includes(weekday)).sort((x, y) => x.start.localeCompare(y.start));
}

export function isChannelId(value: string | undefined | null): value is ChannelId {
  return !!value && value in channelById;
}
