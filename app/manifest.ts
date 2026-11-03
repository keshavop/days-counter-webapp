import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Days Counter",
    short_name: "Days",
    description: "Countdowns and count-ups for the days that matter, saved as CSV in your Google Drive.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#09090b",
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
