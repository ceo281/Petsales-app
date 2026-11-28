import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Anton, Poppins } from "next/font/google";

// Brand fonts: Anton for headings, Poppins for everything else.
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });

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
    <html lang="en-AU" className={`${anton.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
