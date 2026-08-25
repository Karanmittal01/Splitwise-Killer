import { NextResponse } from "next/server";

/**
 * The PWA manifest — what the phone uses once the app is on a home screen.
 *
 * Two things here are doing real work:
 *
 * `background_color` is the launch screen. Android paints it full-bleed with
 * the icon in the middle while the first response is on its way, so a near-white
 * value reads as a broken page rather than a loading app. This is a deep
 * navy-teal pulled from under the icon's own gradient, so the icon sits *in* the
 * screen instead of floating on a grey card. `theme_color` matches it, which
 * keeps the status bar from cutting a stripe across the top of the launch.
 *
 * The `maskable` icons are a separate file from the `any` ones on purpose. A
 * launcher crops a maskable icon to its own shape — a circle on some phones —
 * so that variant keeps the artwork inside the middle 78% with the gradient
 * extended around it. Pointing both purposes at one file, as this used to,
 * means whichever one you optimise for, the other is wrong.
 */
export function GET() {
  return NextResponse.json({
    id: "/",
    name: "Splitwise Killer",
    short_name: "Split",
    description: "Share expenses with friends without the awkwardness.",
    lang: "en",
    dir: "ltr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#0b2a3d",
    theme_color: "#0b2a3d",
    categories: ["finance", "productivity", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-pressing the home-screen icon jumps straight to the two things
    // you actually open the app to do.
    shortcuts: [
      {
        name: "Add an expense",
        short_name: "Add",
        description: "Log a bill and split it",
        url: "/expenses/new",
      },
      {
        name: "Friends",
        short_name: "Friends",
        description: "Who owes what",
        url: "/friends",
      },
    ],
  });
}
