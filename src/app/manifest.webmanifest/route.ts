import { NextResponse } from "next/server";

/** Minimal PWA manifest so the app can be installed to a phone home screen. */
export function GET() {
  return NextResponse.json({
    name: "Splitwise Killer",
    short_name: "Split",
    description: "Share expenses with friends without the awkwardness.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f9f8",
    theme_color: "#14846b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });
}
