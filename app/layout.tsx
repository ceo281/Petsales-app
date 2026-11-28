import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono, Rubik } from "next/font/google";

const rubik = Rubik({ subsets: ["latin"], variable: "--font-rubik", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], weight: ["800"], variable: "--font-archivo", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "PetSales Scam Checker",
  description: "Paste a Gumtree pet ad and get a scam-risk score out of 100 before you pay a cent. Free, from PetSales.",
  openGraph: {
    title: "PetSales Scam Checker",
    description: "Check a Gumtree pet ad for scam warning signs before you pay.",
    images: ["/dog.jpg"],
    locale: "en_AU",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#12053b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${rubik.variable} ${archivo.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
