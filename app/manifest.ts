import type { MetadataRoute } from "next";

/** Lets phones install UniPred to the home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UniPred",
    short_name: "UniPred",
    description: "Call what happens on campus. Get paid when you're right.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08170f",
    theme_color: "#08170f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
