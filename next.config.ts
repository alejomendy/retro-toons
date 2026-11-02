import type { NextConfig } from "next";
import { IMAGE_HOSTS } from "./src/lib/image-hosts";

const nextConfig: NextConfig = {
  // Permite correr un segundo servidor o un build sin pisar el .next del dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["webtorrent"],
  webpack: (config) => {
    config.infrastructureLogging = { level: "error" };
    return config;
  },
  images: {
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({ protocol: "https", hostname })),
  },
};

export default nextConfig;
