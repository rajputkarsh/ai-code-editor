import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { env } from "@/lib/config/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Code Editor",
  description: "AI-powered web-based code editor with intelligent assistance",
};

/**
 * Root Layout
 * 
 * ClerkProvider is configured here to provide authentication context
 * throughout the application. This is the ONLY place where Clerk is
 * directly imported at the UI layer.
 * 
 * Editor components should never import Clerk directly.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  return (
    <ClerkProvider publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''}>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable}`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
