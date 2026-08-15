import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "r2.aresmoused.com" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "**.cloudflare.com" },
    ],
  },
};

export default nextConfig;
