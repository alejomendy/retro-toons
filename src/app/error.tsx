"use client";

import { useEffect } from "react";
import StateMessage from "@/components/series/StateMessage";

/**
 * Si algo falla al mostrar una página (ej. el reproductor al cambiar de episodio), en vez de la pantalla
 * en blanco de Next queda el header y un aviso para volver a sintonizar.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-10">
      <StateMessage
        tone="error"
        title="Se cortó la señal"
        action={
          <button
            type="button"
            onClick={reset}
            className="chunky mt-1 rounded-lg bg-accent px-4 py-2 font-bold text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
          >
            Volver a sintonizar
          </button>
        }
      >
        Algo falló al mostrar esta página. Probá de nuevo; si sigue pasando, recargá la página.
      </StateMessage>
    </div>
  );
}
