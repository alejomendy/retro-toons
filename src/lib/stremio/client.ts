import "server-only";
import { STREMIO_ADDONS, type StremioAddonKey } from "./addons";
import type { StremioManifest } from "./types";

const manifestCache = new Map<string, { expires: number; value: StremioManifest }>();

export async function getAddonManifest(key: StremioAddonKey): Promise<StremioManifest> {
  const addon = STREMIO_ADDONS[key];
  const cached = manifestCache.get(addon.id);
  if (cached && cached.expires > Date.now()) return cached.value;

  const response = await fetch(`${addon.baseUrl}/manifest.json`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${addon.name}: el manifest respondió HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || typeof (data as StremioManifest).id !== "string") {
    throw new Error(`${addon.name}: manifest inválido`);
  }
  const manifest = data as StremioManifest;
  manifestCache.set(addon.id, { expires: Date.now() + 15 * 60_000, value: manifest });
  return manifest;
}
