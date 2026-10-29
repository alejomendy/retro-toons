import "server-only";
import { cache } from "react";
import { fetchSeries, LcError } from "./lacartoons";
import type { LcErrorCode, LcSeries } from "./lacartoons-types";

export type SeriesResult = { ok: true; series: LcSeries } | { ok: false; code: LcErrorCode; message: string };

/** Carga una serie para las páginas (deduplicado entre generateMetadata y el render). */
export const loadSeries = cache(async (rawId: string): Promise<SeriesResult> => {
  try {
    return { ok: true, series: await fetchSeries(safeDecode(rawId)) };
  } catch (error) {
    const err = error instanceof LcError ? error : new LcError("ADDON_UNREACHABLE");
    return { ok: false, code: err.code, message: err.message };
  }
});

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
