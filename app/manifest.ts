import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Days Counter",
    short_name: "Days",
    description: "Countdowns and count-ups for the days that matter, synced to your Google Sheet.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f4f6",
    theme_color: "#c2410c",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New event", url: "/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Date calculator", url: "/calculator", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
