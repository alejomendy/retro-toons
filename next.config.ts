import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite correr un segundo servidor o un build sin pisar el .next del dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" }, // TMDB
      { protocol: "https", hostname: "upload.wikimedia.org" }, // Wikipedia
      { protocol: "https", hostname: "thumb.wikimedia.org" },
      { protocol: "https", hostname: "lacartoons.com" }, // Pósters y fondos de LACartoons
    ],
  },
};

export default nextConfig;
