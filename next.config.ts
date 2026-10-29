import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
