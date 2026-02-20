import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Bodoni_Moda } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Lumina — AI-Powered Creative Engine",
  description:
    "Generate stunning product videos and creatives at scale with AI. Batch render, customize themes, and export to every social format.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bodoni.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

