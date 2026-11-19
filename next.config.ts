import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones/laptops on the local network load dev assets (e.g. http://192.168.0.199:3000).
  // Development only: has no effect on production builds or Vercel.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // The result-card route reads these fonts from disk; make sure Vercel ships them with it.
  outputFileTracingIncludes: {
    "/api/card/*": ["./assets/fonts/**/*"],
  },
  // Admins upload sponsor banner images through a server action (images are capped at 3MB in the action).
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
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
