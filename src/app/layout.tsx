import type { Metadata, Viewport } from "next";
import { Overpass_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin", "latin-ext"],
});

const overpassMono = Overpass_Mono({
  variable: "--font-overpass-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Tenuto — Garanția e ținută. Rezervarea e onorată.",
    template: "%s · Tenuto",
  },
  description:
    "Rezervări pentru orice afacere — restaurante, saloane, clinici, service-uri, studiouri. Fără cont și fără aplicație; cardul e taxat doar dacă clientul nu vine.",
};

export const viewport: Viewport = {
  themeColor: "#f4eee1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className={`${spaceGrotesk.variable} ${overpassMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
