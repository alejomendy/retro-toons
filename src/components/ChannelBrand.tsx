import Image from "next/image";
import type { ChannelId } from "@/lib/types";

/**
 * Estética de cada canal: colores, fondo, separadores de tanda y su logo de la época (de Wikimedia
 * Commons, donde figuran como dominio público por ser logos de texto; siguen siendo marcas registradas).
 */
export interface ChannelBrand {
  /** Fondo de pantalla de las placas y tandas (CSS `background`). */
  background: string;
  backgroundSize?: string;
  /** Texto sobre el fondo. */
  ink: string;
  /** Recuadro destacado (carteles de "Ya volvemos", etc.). */
  box: string;
  boxInk: string;
  /** Frases de los separadores de tanda. */
  out: string;
  back: string;
  /** Frase de la identificación del canal. */
  slogan: string;
}

export const CHANNEL_BRANDS: Record<ChannelId, ChannelBrand> = {
  "cartoon-network": {
    background: "conic-gradient(#000 25%, #fff 0 50%, #000 0 75%, #fff 0)",
    backgroundSize: "25% 50%",
    ink: "#000",
    box: "#000",
    boxInk: "#fff",
    out: "Ya volvemos",
    back: "Regresamos con",
    slogan: "Los mejores dibujos animados",
  },
  nickelodeon: {
    background:
      "radial-gradient(circle at 15% 20%, #7fd63b 0 9%, transparent 9.5%), radial-gradient(circle at 85% 75%, #7fd63b 0 12%, transparent 12.5%), radial-gradient(circle at 70% 15%, #7fd63b 0 5%, transparent 5.5%), #ff7a00",
    ink: "#fff",
    box: "#7fd63b",
    boxInk: "#111",
    out: "¡No cambies de canal!",
    back: "¡Volvimos con",
    slogan: "¡Nick, Nick, Nick!",
  },
  jetix: {
    background: "repeating-linear-gradient(-45deg, #e4002b 0 28px, #8f001b 28px 56px)",
    ink: "#fff",
    box: "#000",
    boxInk: "#fff",
    out: "¡No te vayas!",
    back: "Sigue la acción con",
    slogan: "¡Siente la acción!",
  },
  disney: {
    background:
      "radial-gradient(circle at 20% 30%, #fff 0 2px, transparent 3px), radial-gradient(circle at 75% 20%, #fff 0 2px, transparent 3px), radial-gradient(circle at 60% 80%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 35% 70%, #ffe680 0 2px, transparent 3px), linear-gradient(160deg, #113ccf, #061a66)",
    ink: "#fff",
    box: "#fff",
    boxInk: "#113ccf",
    out: "Enseguida volvemos",
    back: "Volvemos con",
    slogan: "La magia de la tarde",
  },
  warner: {
    background: "repeating-radial-gradient(circle at 50% 50%, #0a2d6e 0 26px, #12408f 26px 52px)",
    ink: "#ffd400",
    box: "#ffd400",
    boxInk: "#0a2d6e",
    out: "¡Ya volvemos, amigos!",
    back: "Regresamos con",
    slogan: "¡Eso es todo, amigos!",
  },
  fox: {
    background:
      "conic-gradient(from 200deg at 50% 110%, #f2f2f2 0 10deg, #d4d4d4 10deg 20deg, #f2f2f2 20deg 30deg, #d4d4d4 30deg 40deg, #f2f2f2 40deg)",
    ink: "#111",
    box: "#111",
    boxInk: "#f2f2f2",
    out: "Ya volvemos",
    back: "Regresamos con",
    slogan: "Animación para grandes",
  },
};

/** Fondo de marca del canal para un contenedor que ocupa toda la pantalla de la tele. */
export function brandBackground(id: ChannelId): React.CSSProperties {
  const b = CHANNEL_BRANDS[id];
  return { background: b.background, backgroundSize: b.backgroundSize, color: b.ink };
}

/** Logos de la época (Wikimedia Commons). `bug`: cómo va la marca de agua de la esquina. */
export const CHANNEL_LOGOS: Record<ChannelId, { src: string; width: number; height: number; height_em: number; bug: "white" | "color" }> = {
  "cartoon-network": { src: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Cartoon_Network_logo_%281992-2004%29.svg", width: 1000, height: 290, height_em: 1.9, bug: "color" },
  nickelodeon: { src: "https://upload.wikimedia.org/wikipedia/commons/8/8f/Nickelodeon_%281984_logo%29.svg", width: 1000, height: 163, height_em: 1.1, bug: "white" },
  jetix: { src: "https://upload.wikimedia.org/wikipedia/commons/0/0a/JetixLogo.png", width: 500, height: 330, height_em: 2.8, bug: "white" },
  disney: { src: "https://upload.wikimedia.org/wikipedia/commons/8/88/2002_Disney_Channel_logo_%28Alt%29.svg", width: 1000, height: 817, height_em: 3.2, bug: "white" },
  warner: { src: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Warner_Channel_logo.png", width: 170, height: 236, height_em: 3.6, bug: "color" },
  fox: { src: "https://upload.wikimedia.org/wikipedia/commons/f/f7/FOX_wordmark-black.svg", width: 1000, height: 431, height_em: 1.9, bug: "white" },
};

/**
 * Logo del canal. "lg" (identificaciones) y "md" (placas con más información) se miden en ancho de la
 * tele (unidades cqw) y van sobre una placa blanca, así se leen sobre cualquier fondo; "sm" es la marca
 * de agua de la esquina (blanca y translúcida, como en la tele). Con `animate` entra con la animación del canal.
 */
export function ChannelWordmark({ id, size = "lg", animate = false }: { id: ChannelId; size?: "lg" | "md" | "sm"; animate?: boolean }) {
  const logo = CHANNEL_LOGOS[id];
  const name = channelNames[id];
  if (size === "sm") {
    return (
      <Image
        src={logo.src}
        alt={name}
        width={logo.width}
        height={logo.height}
        unoptimized
        className="h-5 w-auto sm:h-7"
        style={logo.bug === "white" ? { filter: "brightness(0) invert(1) drop-shadow(1px 1px 0 rgb(0 0 0 / 0.6))" } : undefined}
      />
    );
  }
  const anim = animate ? `wm-${ANIMATIONS[id]} ` : "";
  return (
    <span
      className={`${anim}inline-block rounded-[0.35em] border-[0.12em] border-black bg-white px-[0.45em] py-[0.3em] shadow-[0.15em_0.15em_0_#000]`}
      style={{ fontSize: `${(size === "md" ? 0.6 : 1) * 4}cqw` }}
    >
      <Image src={logo.src} alt={name} width={logo.width} height={logo.height} unoptimized priority className="block w-auto max-w-none" style={{ height: `${logo.height_em}em` }} />
    </span>
  );
}

/** Los logos casi cuadrados (Jetix, Disney, Warner) se ven chicos al lado de los apaisados: van más altos. */
const TALL: ChannelId[] = ["jetix", "disney", "warner"];

/** El logo tal cual (a color). `height` en px para los apaisados; los altos se agrandan para equilibrar. */
export function ChannelLogo({ id, height = 28, className = "" }: { id: ChannelId; height?: number; className?: string }) {
  const logo = CHANNEL_LOGOS[id];
  const h = TALL.includes(id) ? Math.round(height * 1.6) : height;
  return (
    <Image src={logo.src} alt={channelNames[id]} width={logo.width} height={logo.height} unoptimized className={`w-auto max-w-none ${className}`} style={{ height: h }} />
  );
}

/** Logo del canal sobre una placa blanca con borde (se lee sobre cualquier fondo). */
export function ChannelChip({ id, height = 22, className = "" }: { id: ChannelId; height?: number; className?: string }) {
  return (
    <span className={`inline-grid place-items-center rounded-md border-2 border-black bg-white px-1.5 py-0.5 ${className}`}>
      <ChannelLogo id={id} height={height} />
    </span>
  );
}

/** Logos de las cadenas del catálogo de LACartoons (para la biblioteca). */
export const GENRE_LOGOS: Record<string, { src: string; width: number; height: number } | ChannelId> = {
  "Cartoon Network": "cartoon-network",
  Nickelodeon: "nickelodeon",
  Disney: "disney",
  "Warner Channel": "warner",
  "Fox Kids": { src: "https://upload.wikimedia.org/wikipedia/commons/f/fa/FOX_Kids_logo.svg", width: 200, height: 176 },
  "Hanna Barbera": { src: "https://upload.wikimedia.org/wikipedia/commons/c/c0/Hanna-Barbera.svg", width: 585, height: 344 },
  Marvel: { src: "https://upload.wikimedia.org/wikipedia/commons/b/b9/Marvel_Logo.svg", width: 1000, height: 402 },
};

/** Logo de una cadena del catálogo (si hay); `null` si no tiene (se muestra el nombre). */
export function GenreLogo({ genre, height = 18 }: { genre: string; height?: number }) {
  const g = GENRE_LOGOS[genre];
  if (!g) return null;
  if (typeof g === "string") return <ChannelLogo id={g} height={height} />;
  return <Image src={g.src} alt={genre} width={g.width} height={g.height} unoptimized className="w-auto max-w-none" style={{ height: Math.round(height * 1.6) }} />;
}

/** Animación de entrada de cada logo (clases wm-* de globals.css). */
const ANIMATIONS: Record<ChannelId, string> = { "cartoon-network": "cn", nickelodeon: "nick", jetix: "jetix", disney: "disney", warner: "warner", fox: "fox" };
const channelNames: Record<ChannelId, string> = {
  "cartoon-network": "Cartoon Network",
  nickelodeon: "Nickelodeon",
  jetix: "Jetix",
  disney: "Disney Channel",
  warner: "Warner Channel",
  fox: "FOX",
};

/**
 * Identificación animada del canal (pantalla completa de la tele): fondo de marca en movimiento,
 * la marca entrando con su animación y el eslogan. Se usa al sintonizar y entre programas.
 */
export function ChannelIdentAnimation({ id, children }: { id: ChannelId; children?: React.ReactNode }) {
  const b = CHANNEL_BRANDS[id];
  return (
    <div className={`ident-bg-${id} absolute inset-0 overflow-hidden`} style={brandBackground(id)}>
      {id === "fox" && (
        <>
          <span className="fox-beam absolute bottom-0 left-[20%] h-[140%] w-16 origin-bottom bg-gradient-to-t from-white/0 via-black/10 to-black/0" aria-hidden />
          <span className="fox-beam fox-beam-2 absolute bottom-0 right-[20%] h-[140%] w-16 origin-bottom bg-gradient-to-t from-white/0 via-black/10 to-black/0" aria-hidden />
        </>
      )}
      <div className="absolute inset-0 grid place-items-center p-4 text-center">
        <div className="space-y-3">
          <ChannelWordmark id={id} animate />
          <p className="ident-slogan font-mono text-xl sm:text-2xl">
            <span className="rounded bg-black/70 px-2 py-0.5 text-white">{b.slogan}</span>
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}
