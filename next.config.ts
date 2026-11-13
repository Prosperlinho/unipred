import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones/laptops on the local network load dev assets (e.g. http://192.168.0.199:3000).
  // Development only: has no effect on production builds or Vercel.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
