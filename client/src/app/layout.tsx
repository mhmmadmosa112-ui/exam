'use client'; // Note: This makes the layout a client component to handle dynamic theming.

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { useEffect } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The metadata export is not supported in client components.
// You can manage the title and favicon dynamically in the useEffect below.
// export const metadata: Metadata = {
//   title: "Smart Exam System",
//   description: "AI-powered examination platform",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    const savedTheme = localStorage.getItem('themeSettings');
    if (savedTheme) {
      try {
        const settings = JSON.parse(savedTheme);
        const root = document.documentElement;
        if (settings.primaryColor) root.style.setProperty('--color-primary', settings.primaryColor);
        if (settings.bgColor) root.style.setProperty('--color-bg', settings.bgColor);

        // Update favicon
        let favicon: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        if (settings.faviconUrl) favicon.href = settings.faviconUrl;
        document.title = "Smart Exam System"; // Set title dynamically
      } catch (e) {
        console.error("Failed to parse theme settings", e);
      }
    }
  }, []);

  return (
    <html suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}
        style={{ backgroundColor: 'var(--color-bg, #f3f4f6)' }}
      >
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}