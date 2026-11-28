import type { MetadataRoute } from "next";

/**
 * Makes the checker installable and registers it as a Share target, so on
 * Android "PetSales Check" appears in the Share menu once the site is added
 * to the home screen. iPhone (Safari) does not support Web Share Target.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PetSales Scam Checker",
    short_name: "PetSales Check",
    description: "Check a Gumtree pet ad for scam warning signs before you pay.",
    start_url: "/",
    display: "standalone",
    background_color: "#12053b",
    theme_color: "#12053b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  } as MetadataRoute.Manifest;
}
