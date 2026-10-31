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
      b(LUN_VIE, "Madrugada Toon", "00:00", "06:00", ["Coraje El Perro Cobarde", "Samurai Jack", "Las Sombrias Aventuras de Billy Y Mandy", "Johnny Bravo", "Mike, Lu y Og", "Duck Dodgers", "Megas XLR", "Hi Hi Puffy AmiYumi", "Swat Kats", "Code Lyoko", "Drama Total"], { shows: ["billy-mandy", "dexter"] }),
      b(LUN_VIE, "Boomerang", "06:00", "09:00", ["Tom y Jerry", "Looney Tunes", "Scooby-Doo, ¿Dónde estás?", "Los Picapiedras", "El Oso Yogui", "Don Gato y Su Pandilla", "Pixie, Dixie y El Gato Jinks", "Los Supersónicos", "Maguila Gorila", "Huckleberry Hound", "Hong Kong Phooey", "Capitan Cavernicola y los Angeles Adolescentes"]),
      b(LUN_VIE, "Cartoon Cartoons", "09:00", "13:00", ["El Laboratorio de Dexter", "Las Chicas Super Poderosas", "Johnny Bravo", "La Vaca y El Pollito", "Ed, Edd y Eddy", "Coraje El Perro Cobarde", "KND: Los Chicos Del Barrio", "Las Maravillosas Desventuras de FlapJack", "Soy La Comadreja"], { shows: ["dexter", "chicas-superpoderosas", "vaca-pollito"] }),
      b(LUN_VIE, "Hora del Almuerzo", "13:00", "16:00", ["Pokemon", "Ben 10", "Las Sombrias Aventuras de Billy Y Mandy", "KND: Los Chicos Del Barrio", "Mucha Lucha", "Un Show Mas", "Hora de Aventura", "Ed, Edd y Eddy", "Drama Total", "Code Lyoko", "Zatch Bell", "Las Aventuras de Jackie Chang", "La Mascara Serie Animada", "El Capitán Planeta y los planetarios"], { shows: ["billy-mandy"] }),
      b(LUN_VIE, "Toonami", "16:00", "19:00", ["Dragon Ball Z", "Dragon Ball", "Dragon Ball GT", "Samurai X", "Yu yu Hakusho", "Sakura Card Captors", "Los Jovenes Titanes", "Samurai Jack", "Caballeros del Zodiaco", "Zatch Bell", "Megaman NT Warriors", "Robotech"]),
      b(LUN_JUE, "Prime Toon", "19:00", "22:00", ["Liga de La Justicia", "Liga de La Justicia Ilimitada", "Static Shock", "Ben 10: Fuerza Alienigena", "Generador Rex", "Hora de Aventura", "Un Show Mas", "Justicia Joven", "Ben 10: Supremacia Alienigena", "Swat Kats"]),
      b(VIE, "Viernes de Cartoon", "19:00", "22:00", ["El Laboratorio de Dexter", "Las Chicas Super Poderosas", "Johnny Bravo", "Coraje El Perro Cobarde", "Las Sombrias Aventuras de Billy Y Mandy", "Megas XLR", "Ed, Edd y Eddy"], { shows: ["dexter", "chicas-superpoderosas", "billy-mandy"] }),
      b([0, 1, 2, 3, 4, 5], "Noche Toon", "22:00", "24:00", ["Coraje El Perro Cobarde", "Samurai Jack", "Harvey Birdman El Abogado", "CowBoy Bebop", "Trigun", "El Fantasma Del Espacio"]),
      // Fin de semana
      b(FINDE, "Trasnoche Toonami", "00:00", "07:00", ["CowBoy Bebop", "Trigun", "Samurai Champloo", "Samurai X", "Harvey Birdman El Abogado", "Yu yu Hakusho", "Robotech", "Caballeros del Zodiaco", "Mazinger Z"]),
      b(SAB, "Sábados de Hanna-Barbera", "07:00", "12:00", ["Los Picapiedras", "Los Supersónicos", "Scooby-Doo, ¿Dónde estás?", "El Oso Yogui", "Los Autos Locos", "Don Gato y Su Pandilla", "Tiro Loco Mcgraw", "Jonny Quest", "Las Olimpiadas De La Risa", "Maguila Gorila", "Los Herculoides", "Hong Kong Phooey", "Los Super Amigos", "Birdman", "Frankenstein Jr.", "Capitan Cavernicola y los Angeles Adolescentes"]),
      b(SAB, "Maratón Cartoon Cartoons", "12:00", "17:00", ["El Laboratorio de Dexter", "Las Chicas Super Poderosas", "Johnny Bravo", "La Vaca y El Pollito", "Ed, Edd y Eddy", "Coraje El Perro Cobarde", "Las Sombrias Aventuras de Billy Y Mandy", "KND: Los Chicos Del Barrio", "Soy La Comadreja"], { shows: ["dexter", "chicas-superpoderosas", "vaca-pollito", "billy-mandy"] }),
      b(SAB, "Sábado de Acción", "17:00", "21:00", ["Ben 10", "Liga de La Justicia", "Los Jovenes Titanes", "Static Shock", "Samurai Jack", "Batman El Valiente", "X-men Evolucion", "Justicia Joven", "Ben 10: Supremacia Alienigena"]),
      b(SAB, "Toonami Sábado", "21:00", "24:00", ["Dragon Ball Z", "Dragon Ball GT", "Samurai X", "Yu yu Hakusho", "Pokemon"]),
      b(DOM, "Hora Acme", "07:00", "12:00", ["Tom y Jerry", "Looney Tunes", "Popeye", "Droopy", "La Pantera Rosa", "Los Pequeños Looney Tunes"]),
      b(DOM, "Domingo de Scooby-Doo", "12:00", "17:00", ["Scooby-Doo, ¿Dónde estás?", "El Show De Scooby Doo", "¿Qué hay de nuevo, Scooby-Doo?", "Scooby Doo Misterios S.A", "Un Cachorro Llamado Scooby Doo", "Los 13 Fantasmas de Sooby Doo!"], { exclusive: true }),
      b(DOM, "Domingo de Aventura", "17:00", "22:00", ["Hora de Aventura", "Un Show Mas", "Ben 10", "Generador Rex", "Las Maravillosas Desventuras de FlapJack", "Johnny Test", "Las Aventuras de TinTin", "Las Increibles Aventuras de Jonny Quest", "Las Aventuras de Jackie Chang"]),
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
      b(LUN_VIE, "Nick at Nite", "00:00", "06:00", ["Alf", "La Familia Addams", "Mi Bella Genio", "Super Agente 86", "Los 3 Chiflados", "Blanco y Negro", "Los Munsters", "Hechizada"], { exclusive: true }),
      b(LUN_VIE, "Nick Jr.", "06:00", "09:00", ["La Tortuga Franklin", "El Mundo Fantastico de Richard Scarry", "Los Rugrats: Aventuras En Pañales", "Doug", "Los Thornberrys", "Bob Esponja"]),
      b(LUN_VIE, "Nicktoons", "09:00", "13:00", ["¡Oye, Arnold!", "Los Rugrats: Aventuras En Pañales", "La Vida Moderna de Rocko", "CatDog", "Rocket Power", "Los padrinos mágicos", "Los Castores Cascarrabias", "Bob Esponja", "Mi Padre El Rockero", "Zona Tiza", "Kappa Mikey"], { shows: ["padrinos-magicos", "catdog", "castores"] }),
      b(LUN_VIE, "Nick Después del Cole", "13:00", "17:00", ["Bob Esponja", "Las Aventuras de Jimmy Neutrón: El Niño Genio", "Danny Phantom", "La Robot Adolescente", "Los padrinos mágicos", "Rocket Power", "Los Pingüinos De Madagascar", "Ginger", "Mighty B!, La Sùper Abeja", "Mi Padre El Rockero"], { shows: ["padrinos-magicos"] }),
      b([1, 2, 3, 4, 5, 6], "Nick en Vivo", "17:00", "20:00", ["Drake & Josh", "Kenan & Kel", "El Show de Amanda", "Zoey 101", "ICarly", "Clarissa Lo Explica Todo", "Victorius", "Manual De Supervivencia Escolar De Ned", "Sam & Cat", "Los Archivos Secretos De Shelby Woo", "31 Minutos"]),
      b([0, 1, 2, 3, 4, 5], "Horario Estelar Nick", "20:00", "24:00", ["Avatar La Leyenda de Aang", "Avatar La Leyenda de Korra", "Invasor Zim", "Danny Phantom", "Le Temes A La Oscuridad?", "El Misterio de Anubis"]),
      b(FINDE, "Trasnoche Nick", "00:00", "07:00", ["Ren y Stimpy", "La Vida Moderna de Rocko", "Aaahh!! Monstruos de Verdad", "Los Castores Cascarrabias", "Invasor Zim"], { shows: ["castores"] }),
      b(SAB, "Sábados de Nicktoons", "07:00", "12:00", ["Los Rugrats: Aventuras En Pañales", "¡Oye, Arnold!", "Doug", "La Vida Moderna de Rocko", "CatDog", "Rocket Power", "Bob Esponja", "Los Thornberrys", "Zona Tiza", "Pelswick"], { shows: ["catdog"] }),
      b(SAB, "Sábado Bob Esponja", "12:00", "17:00", ["Bob Esponja", "Los padrinos mágicos", "Las Aventuras de Jimmy Neutrón: El Niño Genio", "Danny Phantom"], { shows: ["padrinos-magicos"] }),
      b(SAB, "SNICK", "20:00", "24:00", ["Le Temes A La Oscuridad?", "Ren y Stimpy", "Invasor Zim", "Aaahh!! Monstruos de Verdad", "Kenan & Kel", "El Show de Amanda"]),
      b(DOM, "Domingo Nick", "07:00", "12:00", ["Los Rugrats: Aventuras En Pañales", "Rugrats Crecidos", "¡Oye, Arnold!", "Los Thornberrys", "Las Aventuras de Jimmy Neutrón: El Niño Genio", "El Show De Charlie Brown y Snoopy"]),
      b(DOM, "Nicktoons de Domingo", "12:00", "17:00", ["Bob Esponja", "Los padrinos mágicos", "Danny Phantom", "La Robot Adolescente", "T.U.F.F. Puppy, Agente Secreto", "Los Pingüinos De Madagascar", "Mighty B!, La Sùper Abeja", "Kappa Mikey"], { shows: ["padrinos-magicos"] }),
      b(DOM, "Maratón Avatar", "17:00", "20:00", ["Avatar La Leyenda de Aang", "Avatar La Leyenda de Korra"], { exclusive: true }),
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
      b(LUN_VIE, "Jetix Nocturno", "00:00", "06:00", ["X-Men Serie Animada", "Spider-Man: La Serie Animada", "Transformers G1", "He-Man y los Amos del Universo", "Las Tortugas Ninjas", "Double Dragon", "Gi Joe", "She-Ra La Princesa Del Poder", "Cadillacs y Dinosaurios", "Street Sharks", "Reboot", "Los Centuriones"]),
      b(LUN_VIE, "Jetix Mañana", "06:00", "09:00", ["Oggy Y Las Cucarachas", "Pucca", "Eek! El Gato", "El Inspector Gadget", "El Pájaro Loco y Amigos", "Yin Yang Yo!", "Kid Músculo", "El Colegio Del Agujero Negro", "Los Misterios de Moville", "Dientes De Lata", "Angela Anaconda", "Shuriken School"], { shows: ["totally-spies", "kid-vs-kat"] }),
      b(LUN_VIE, "Fox Kids Clásico", "09:00", "13:00", ["Power Rangers", "X-Men Serie Animada", "Spider-Man: La Serie Animada", "Las Tortugas Ninjas", "Big Bad Beetleborgs", "Vr Troopers", "El Inspector Gadget", "Power Rangers Zeo", "Power Rangers Turbo", "Los Verdaderos Cazafantasmas"]),
      b(LUN_VIE, "Tardes de Acción", "13:00", "17:00", ["Power Rangers", "X-Men Serie Animada", "Spider-Man: La Serie Animada", "Las Tortugas Ninjas", "Los 4 Fantásticos: Los Héroes más Grandes del Mundo", "Alienators: Evolucion Continua", "Los Verdaderos Cazafantasmas", "Martin Mystery", "Transformers Armada"]),
      b(LUN_VIE, "Invasión Animé", "17:00", "21:00", ["Digimon: Digital Monsters", "Digimon Adventure 02", "Shaman King", "Sailor  Moon", "Monster Rancher", "Medabots", "BeyBlade", "Shinzo", "Sonic X", "Transformers Armada"]),
      b(FINDE, "Jetix Max", "17:00", "21:00", ["Power Rangers", "Power Rangers Tormenta Ninja", "Power Rangers Dino Trueno", "Super Escuadrón Ciber Monos Hiperfuerza ¡Ya!", "Action Man: A.T.O.M.", "Sonic X", "Yin Yang Yo!", "Power Rangers En El Espacio", "Power Rangers Fuerza Mistica", "Power Rangers Super Patrulla Delta", "Martin Mystery", "Oban Star Racers", "Power Rangers En La Galaxia Perdida", "Power Rangers A La Velocidad De La Luz", "Power Rangers Fuerza Del Tiempo", "Power Rangers Fueza Salvaje", "Power Rangers Operacion Sobrecarga"], { shows: ["totally-spies"] }),
      b(TODOS, "Héroes Marvel", "21:00", "24:00", ["X-Men Serie Animada", "Spider-Man: La Serie Animada", "El Increible Hulk", "Iron Man: La Serie Animada", "Los 4 Fantasticos La Serie Animada", "Silver Surfer", "Los Vengadores: Los Héroes Más Poderosos Del Planeta", "X-men Evolucion", "Wolverine y los X-men", "El Espectacular Hombre Araña", "Spiderman Sin Limites"]),
      b(FINDE, "Mysteria", "00:00", "03:00", ["Cuentos De La Cripta: Serie Animada", "Toonsylvania", "La Momia: La Serie Animada", "Momias  Aqui", "Alienators: Evolucion Continua"]),
      b(FINDE, "Trasnoche Jetix", "03:00", "07:00", ["Cuentos De La Cripta: Serie Animada", "Mortal Kombat: Defensores Del Reino", "Street Fighter II-V", "Robocop: La Serie Animada", "Gundam Wing", "Transformers G1", "Los Gatos Samurais", "Cadillacs y Dinosaurios"]),
      b(SAB, "Sábados de Fox Kids", "07:00", "12:00", ["Power Rangers", "X-Men Serie Animada", "Spider-Man: La Serie Animada", "Eek! El Gato", "Las Tortugas Ninjas", "Big Bad Beetleborgs", "El Show de Super Mario Bros", "Super Mario World", "Power Rangers Zeo", "Los Verdaderos Cazafantasmas", "Street Sharks"]),
      b(SAB, "Maratón Digimon", "12:00", "17:00", ["Digimon: Digital Monsters", "Digimon Adventure 02", "Digimon 3 Tamers", "Digimon 4 Frontier"], { exclusive: true }),
      b(DOM, "Domingo Jetix", "07:00", "11:00", ["Oggy Y Las Cucarachas", "Pucca", "Yin Yang Yo!", "El Inspector Gadget", "El Pájaro Loco y Amigos"], { shows: ["totally-spies", "kid-vs-kat"] }),
      // Doble Carga: dos episodios seguidos de la misma serie (domingos al mediodía en Fox Kids).
      b(DOM, "Doble Carga", "11:00", "12:00", ["Power Rangers", "X-Men Serie Animada", "Las Tortugas Ninjas", "Digimon: Digital Monsters", "Spider-Man: La Serie Animada", "Medabots", "Sonic X"], { exclusive: true, double: true }),
      b(DOM, "Sonic y Mario", "12:00", "17:00", ["Sonic X", "Sonic Underground", "El Show de Super Mario Bros", "Super Mario Bros 3", "Super Mario World", "El Pais De Donkey Kong", "Capitán N"]),
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
      b(LUN_VIE, "Clásicos de Madrugada", "00:00", "06:00", ["Gargolas, Heroes Goticos", "Pato Aventuras", "Chip & Dale: Guardianes Rescatadores", "El Pato Darkwing", "Aventureros Del Aire", "Bonkers", "Las Aventuras De Los Osos Gummis"]),
      b(LUN_VIE, "Disney Mañanero", "06:00", "09:00", ["Las Nuevas Aventuras De Winnie The Pooh", "Timon y Pumba", "101 Dalmatas", "Las Aventuras De Los Osos Gummis", "Lilo & Stich", "Quack Pack"]),
      b(LUN_VIE, "Recreo de Disney", "09:00", "13:00", ["Recreo: La Serie Animada", "Pepper Ann", "Timon y Pumba", "Hercules: La Serie Animada", "Aladdin La serie Animada", "La Sirenita Serie Animada", "Quack Pack"]),
      b(LUN_VIE, "Zapping Zone", "13:00", "17:00", ["Kim Possible", "Lilo & Stich", "Jake Long: El Dragón Occidental", "Las Aventuras de Brandy y El Señor Bigotes", "Las Nuevas Locuras Del Emperador", "Phineas y Pherb", "Sabrina: La Serie Animada"]),
      b(TODOS, "Disney XD", "17:00", "21:00", ["Phineas y Pherb", "Kim Possible", "Jake Long: El Dragón Occidental", "Super Escuadrón Ciber Monos Hiperfuerza ¡Ya!", "Dave El Barbaro", "Power Rangers RPM", "Power Rangers Samurai"]),
      b(TODOS, "Noche Disney", "21:00", "24:00", ["Gargolas, Heroes Goticos", "El Pato Darkwing", "Hercules: La Serie Animada", "La Leyenda De Tarzan", "El Mundo De Quest", "Policia De Cuentos De Hadas"]),
      b(FINDE, "Trasnoche Disney", "00:00", "07:00", ["Gargolas, Heroes Goticos", "El Pato Darkwing", "Aventureros Del Aire", "Bonkers", "Los Vaqueros de Moo Mesa"]),
      b(SAB, "La Tarde Disney", "07:00", "12:00", ["Pato Aventuras", "Chip & Dale: Guardianes Rescatadores", "Aventureros Del Aire", "El Pato Darkwing", "Bonkers", "Las Aventuras De Los Osos Gummis"]),
      b(SAB, "Sábado Kim y Phineas", "12:00", "17:00", ["Kim Possible", "Phineas y Pherb", "Lilo & Stich", "Jake Long: El Dragón Occidental"]),
      b(DOM, "Domingo Clásico", "07:00", "12:00", ["50 Clasicos de Disney", "Las Nuevas Aventuras De Winnie The Pooh", "Timon y Pumba", "La Sirenita Serie Animada", "Aladdin La serie Animada", "101 Dalmatas"]),
      b(DOM, "Domingo en Familia", "12:00", "17:00", ["Recreo: La Serie Animada", "Pepper Ann", "Las Nuevas Locuras Del Emperador", "Hercules: La Serie Animada", "La Leyenda De Tarzan", "Las Aventuras de Brandy y El Señor Bigotes"]),
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
      b(TODOS, "Trasnoche Warner", "00:00", "06:00", ["Batman La Serie Animada", "Superman La Serie Animada", "Batman Del Futuro", "Thundercats", "Los Halcones Galácticos"]),
      b(LUN_VIE, "Warner de Mañana", "06:00", "09:00", ["El Mundo De Beakman", "Looney Tunes", "Las Aventuras de Silvestre y Piolin", "El Coyote y El Corre Caminos", "El Gallo Claudio", "Taz-Mania"]),
      b(LUN_VIE, "House of Toons", "09:00", "13:00", ["Animaniacs", "Tiny Toons", "Pinky y Cerebro", "Fenomenoide", "Taz-Mania", "Pinky, Elvira y Cerebro", "Loonatics"]),
      b(LUN_VIE, "Looney Tunes Show", "13:00", "17:00", ["Looney Tunes", "Las Aventuras de Silvestre y Piolin", "El Coyote y El Corre Caminos", "El Gallo Claudio", "Taz-Mania", "Los Pequeños Looney Tunes"]),
      b(TODOS, "Sitcoms Warner", "17:00", "20:00", ["El Principe Del Rap En Bel-Air", "Full House", "El Mundo De Beakman", "Jumanji La Serie Animada"]),
      b(TODOS, "Héroes DC", "20:00", "24:00", ["Batman La Serie Animada", "Las Nuevas Aventuras De Batman", "Superman La Serie Animada", "Batman Del Futuro", "The Batman", "Liga de La Justicia", "Static Shock"]),
      b(SAB, "Kids WB Sábado", "06:00", "12:00", ["Animaniacs", "Pinky y Cerebro", "Tiny Toons", "Batman La Serie Animada", "Superman La Serie Animada", "Jumanji La Serie Animada", "Hombres de Negro"]),
      b(SAB, "Thundercats y Halcones", "12:00", "17:00", ["Thundercats", "Los Halcones Galácticos", "Jumanji La Serie Animada", "El Zorro: Serie Animada", "Protagonistas De La Historia"]),
      b(DOM, "Domingo Looney", "06:00", "12:00", ["Looney Tunes", "Las Aventuras de Silvestre y Piolin", "El Coyote y El Corre Caminos", "El Gallo Claudio", "Taz-Mania", "Los Pequeños Looney Tunes"]),
      b(DOM, "Domingo de Sitcoms", "12:00", "17:00", ["El Principe Del Rap En Bel-Air", "Full House", "El Mundo De Beakman"], { exclusive: true }),
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
      b(TODOS, "Trasnoche FOX", "00:00", "06:00", ["Rick y Morty", "Futurama", "La Casa De Los Dibujos", "Happy Tree Friends", "Daria", "Stripperella", "Mad"]),
      b(LUN_VIE, "Mañanas FOX", "06:00", "12:00", ["Salvados Por La Campana", "Malcolm En El Medio", "El Chavo Del 8", "Los Simpsons", "Alf", "Los 3 Chiflados", "Mi Bella Genio", "Hechizada", "Sabrina La Bruja Adolescente"]),
      b(LUN_VIE, "Mediodía FOX", "12:00", "17:00", ["Los Simpsons", "Malcolm En El Medio", "Futurama", "El Chavo Del 8", "Salvados Por La Campana", "Sabrina La Bruja Adolescente", "Salvados Por La Campana: Años De Universidad", "La Familia Addams", "Los Munsters"]),
      b(TODOS, "Hora Simpson", "17:00", "20:00", ["Los Simpsons"], { exclusive: true }),
      b(TODOS, "Prime FOX", "20:00", "24:00", ["Futurama", "Rick y Morty", "Los Simpsons", "Malcolm En El Medio", "Daria"]),
      b(SAB, "Sábado Anime", "06:00", "12:00", ["Death Note", "Detective Conan", "Dragon Ball Super", "Slam Dunk", "Ranma 1/2", "Super Campeones", "Yu-Gi-Oh!", "Meteoro", "Candy Candy"]),
      b(SAB, "Maratón Simpson", "12:00", "17:00", ["Los Simpsons"], { exclusive: true }),
      b(DOM, "Domingo Clásico", "06:00", "12:00", ["El Chavo Del 8", "Salvados Por La Campana", "Star Trek", "Xena La Princesa guerrera", "Super Agente 86", "Los 3 Chiflados", "Alf", "La Familia Addams", "Los Munsters"]),
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
