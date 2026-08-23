import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Splitwise Killer — share expenses without the awkwardness",
    template: "%s · Splitwise Killer",
  },
  description:
    "Split bills with friends, flatmates and travel groups. Track who owes what, settle up, and keep everyone honest — free and self-hosted.",
  applicationName: "Splitwise Killer",
  appleWebApp: { capable: true, title: "Splitwise Killer", statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1614" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
