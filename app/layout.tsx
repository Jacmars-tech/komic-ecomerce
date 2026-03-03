import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { ChatBubble } from "@/components/ChatBubble";
import { SiteFooter } from "@/components/SiteFooter";
import { TopNav } from "@/components/TopNav";
import { getSessionUser } from "@/lib/auth";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
  fallback: ["Segoe UI", "Roboto", "Arial"],
  adjustFontFallback: true,
  preload: true,
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: "ShopLocal | Scalable E-commerce Starter",
  description:
    "Modular-monolith e-commerce web app starter with auth, catalog, cart, checkout, orders, payments, and admin tools."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = getSessionUser();

  return (
    <html lang="en">
      <body className={`${inter.variable}`}>
        <TopNav />
        {children}
        <SiteFooter />
        {session?.role === "ADMIN" || session?.role === "VENDOR" ? null : <ChatBubble />}
      </body>
    </html>
  );
}
