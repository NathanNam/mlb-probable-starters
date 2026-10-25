import type { Metadata, Viewport } from "next";
import { Alfa_Slab_One, Courier_Prime, Oswald } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const slab = Alfa_Slab_One({ weight: "400", subsets: ["latin"], variable: "--f-slab", display: "swap" });
const cond = Oswald({ subsets: ["latin"], variable: "--f-cond", display: "swap" });
const mono = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"], variable: "--f-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Probable Starters",
  description: "Who's on the mound today: every MLB game's probable starters with their season lines, plus a rotation watch for the pitchers you want to see.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d9c8a2" },
    { media: "(prefers-color-scheme: dark)", color: "#1d2330" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${slab.variable} ${cond.variable} ${mono.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
