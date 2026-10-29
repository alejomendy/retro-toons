import StateMessage from "@/components/series/StateMessage";
import { lcErrorMessages } from "@/lib/lacartoons-types";

export default function SerieNotFound() {
  return (
    <StateMessage tone="empty" title="Serie no encontrada" action={{ href: "/biblioteca", label: "Ir a la biblioteca" }}>
      {lcErrorMessages.SERIES_NOT_FOUND}
    </StateMessage>
  );
}
