import type { ChannelId } from "@/lib/types";

/**
 * Estética de cada canal: colores, fondo, separadores de tanda y una marca tipográfica animada.
 * Inspirada en la época de cada señal pero con diseño propio (no son los logos oficiales).
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

/**
 * Marca del canal (tipográfica, animada). Los tamaños "lg" (identificaciones) y "md" (placas con más
 * información) se miden en ancho de la tele (unidades cqw), así entran igual en el celular y en modo cine;
 * "sm" es la marca de agua de la esquina. Con `animate` entra con la animación propia de cada canal.
 */
export function ChannelWordmark({ id, size = "lg", animate = false }: { id: ChannelId; size?: "lg" | "md" | "sm"; animate?: boolean }) {
  const sm = size === "sm";
  const k = size === "md" ? 0.6 : 1;
  /** Tamaño de letra en ancho de la tele; los bordes y márgenes van en em, así escalan juntos. */
  const font = (cqw: number): React.CSSProperties => (sm ? {} : { fontSize: `${cqw * k}cqw` });
  const anim = (name: string) => (animate ? `${name} ` : "");
  switch (id) {
    case "cartoon-network":
      return (
        <span className={`${anim("wm-cn")}inline-flex flex-col items-stretch`} style={font(6.5)}>
          <span className={`border-black bg-white font-display uppercase leading-none text-black ${sm ? "border-2 px-1.5 py-0.5 text-[10px] sm:text-xs" : "border-[0.12em] px-[0.35em] py-[0.15em]"}`}>
            Cartoon Network
          </span>
          <span className={`checker ${sm ? "h-1" : "h-[0.3em]"}`} style={sm ? undefined : { backgroundSize: "0.3em 0.3em" }} aria-hidden />
        </span>
      );
    case "nickelodeon":
      return (
        <span
          className={`${anim("wm-nick")}inline-block border-black bg-[#ff7a00] font-display leading-none text-white [text-shadow:0.05em_0.05em_0_#000] ${
            sm ? "border-2 px-2 py-0.5 text-[10px] sm:text-xs" : "border-[0.1em] px-[0.6em] py-[0.35em]"
          }`}
          style={{ ...font(6.5), borderRadius: "46% 54% 41% 59% / 58% 44% 56% 42%" }}
        >
          nickelodeon
        </span>
      );
    case "jetix":
      return (
        <span className={`${anim("wm-jetix")}relative inline-block -skew-x-12`} style={font(9)}>
          <span className={`block border-white bg-black font-display uppercase italic leading-none text-white ${sm ? "border-2 px-1.5 text-[11px] sm:text-sm" : "border-[0.08em] px-[0.4em] py-[0.12em]"}`}>
            Jetix
          </span>
          {/* Estela de velocidad debajo de la marca. */}
          <span className={`absolute -bottom-[0.18em] left-[15%] right-[-12%] block bg-[#e4002b] ${sm ? "h-0.5" : "h-[0.12em]"}`} aria-hidden />
        </span>
      );
    case "disney":
      return (
        <span
          className={`${anim("wm-disney")}relative inline-block font-display leading-none text-white [text-shadow:0_0_0.2em_#9bd1ff,0.05em_0.05em_0_#061a66] ${sm ? "px-1 text-xs sm:text-sm" : "px-[0.3em] pt-[0.3em]"}`}
          style={font(10)}
        >
          <span className={`${anim("wm-disney-arc")}pointer-events-none absolute inset-x-0 top-0 h-[0.7em] rounded-[50%] border-t-[0.06em] border-white/80`} aria-hidden />
          Disney
          <span className="absolute -right-[0.1em] top-0 text-[0.45em]" aria-hidden>
            ✦
          </span>
        </span>
      );
    case "warner":
      return (
        <span
          className={`${anim("wm-warner")}inline-grid place-items-center rounded-full border-black bg-[#0a2d6e] font-display uppercase leading-none text-[#ffd400] [text-shadow:0.06em_0.06em_0_#000] ${
            sm ? "border-2 px-2 py-0.5 text-[10px] sm:text-xs" : "size-[5.4em] border-[0.15em]"
          }`}
          style={{ ...font(4.5), boxShadow: sm ? undefined : "0 0 0 0.2em #ffd400, 0 0 0 0.35em #000" }}
        >
          <span className="text-center">Warner{sm ? " " : <br />}Channel</span>
        </span>
      );
    case "fox":
      return (
        <span
          className={`${anim("wm-fox")}inline-block border-[#f2f2f2] bg-[#111] font-display uppercase leading-none tracking-widest text-[#f2f2f2] ${sm ? "border-2 px-1.5 text-[11px] sm:text-sm" : "border-[0.06em] px-[0.3em] py-[0.1em]"}`}
          style={font(12)}
        >
          FOX
        </span>
      );
  }
}

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
