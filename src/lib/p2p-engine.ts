import "server-only";
import fs from "fs";
import path from "path";
import WebTorrent, { type Torrent } from "webtorrent";

type WebTorrentInstance = InstanceType<typeof WebTorrent>;

const P2P_DIR = process.env.P2P_DIR?.trim() || path.join(process.cwd(), ".p2p-cache");
const MAX_CONNS = Number.parseInt(process.env.P2P_MAX_CONNS || "80", 10);
const IDLE_TIMEOUT_MS = Number.parseInt(process.env.P2P_IDLE_MS || "900000", 10);

const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://tracker.openbittorrent.com:6969/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://explodie.org:6969/announce",
  "http://tracker.openbittorrent.com:80/announce",
];

// Singleton en globalThis para evitar múltiples instancias con Fast Refresh en dev
declare global {
  var __p2pClient: WebTorrentInstance | undefined;
  var __p2pServer: unknown;
  var __p2pServerPort: number | undefined;
  var __p2pLastUsed: Map<string, number> | undefined;
}

function ensureCacheDir() {
  try {
    if (!fs.existsSync(P2P_DIR)) {
      fs.mkdirSync(P2P_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn("[p2p] No se pudo crear directorio cache:", e);
  }
}

export function getClient(): WebTorrentInstance {
  if (globalThis.__p2pClient) return globalThis.__p2pClient;

  ensureCacheDir();
  const client = new WebTorrent({
    maxConns: MAX_CONNS,
  });

  globalThis.__p2pClient = client;
  globalThis.__p2pLastUsed = new Map<string, number>();

  // Limpieza periódica de torrents inactivos
  setInterval(() => {
    const lastUsed = globalThis.__p2pLastUsed;
    if (!lastUsed || !globalThis.__p2pClient) return;

    const now = Date.now();
    for (const torrent of globalThis.__p2pClient.torrents) {
      const last = lastUsed.get(torrent.infoHash) || 0;
      if (now - last > IDLE_TIMEOUT_MS) {
        console.log(`[p2p] Removiendo torrent inactivo: ${torrent.name || torrent.infoHash}`);
        torrent.destroy();
        lastUsed.delete(torrent.infoHash);
      }
    }
  }, 60000);

  return client;
}

export async function getServerPort(): Promise<number> {
  if (globalThis.__p2pServerPort) return globalThis.__p2pServerPort;

  const client = getClient();
  const server = client.createServer({ origin: "*" });

  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      globalThis.__p2pServer = server;
      globalThis.__p2pServerPort = port;
      console.log(`[p2p] Servidor HTTP WebTorrent activo en puerto ${port}`);
      resolve(port);
    });
    (server as unknown as { on?: (event: string, cb: (err: unknown) => void) => void }).on?.("error", reject);
  });
}

/**
 * Asegura que el torrent esté añadido y con sus metadatos listos.
 */
export async function ensureTorrentReady(infoHash: string, timeoutMs = 25000): Promise<Torrent> {
  const client = getClient();
  const lowerHash = infoHash.toLowerCase();

  if (!globalThis.__p2pLastUsed) globalThis.__p2pLastUsed = new Map();
  globalThis.__p2pLastUsed.set(lowerHash, Date.now());

  // client.torrents es un array síncrono con los torrents actuales
  const existing = client.torrents.find((t: Torrent) => t.infoHash === lowerHash);
  if (existing) {
    if (existing.ready) return existing;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout esperando metadatos")), timeoutMs);
      existing.once("ready", () => {
        clearTimeout(timer);
        resolve(existing);
      });
      existing.once("error", (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  ensureCacheDir();
  const magnetOrHash = lowerHash.startsWith("magnet:") ? lowerHash : `magnet:?xt=urn:btih:${lowerHash}`;

  return new Promise((resolve, reject) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`[p2p] Timeout (${timeoutMs}ms) esperando torrent ${lowerHash}`));
      }
    }, timeoutMs);

    const torrent = client.add(magnetOrHash, {
      path: P2P_DIR,
      announce: TRACKERS,
    });

    torrent.once("ready", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(torrent);
      }
    });

    torrent.once("error", (err: unknown) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}
