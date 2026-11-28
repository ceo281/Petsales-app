import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PetSales Scam Checker",
  description: "Check a Gumtree pet listing for scam warning signs before you pay a cent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
