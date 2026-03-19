import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Bodoni_Moda } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { NextIntlClientProvider } from "next-intl";
import Script from "next/script";
import { RechargeModal } from "@/components/modals/recharge-modal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "next-auth/react";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Wrap in try-catch: during static pre-rendering of /_not-found,
  // next-intl server APIs are not available and will throw.
  let locale = "fr";
  let messages: Record<string, unknown> = {};
  try {
    const { getLocale, getMessages } = await import("next-intl/server");
    locale = await getLocale();
    messages = await getMessages() as Record<string, unknown>;
  } catch {
    // Static pre-rendering fallback — use defaults
    try {
      messages = (await import("@/messages/fr.json")).default;
    } catch {
      messages = {};
    }
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bodoni.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          <SessionProvider>
            <NextIntlClientProvider messages={messages}>
              <TooltipProvider>
                {children}
              </TooltipProvider>
              <Toaster />
              <RechargeModal />
            </NextIntlClientProvider>
          </SessionProvider>
        </ThemeProvider>
        <Script src="https://app.lemonsqueezy.com/js/lemon.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
