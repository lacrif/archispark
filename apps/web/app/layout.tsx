"use client";

import { Inter, Geist_Mono } from "next/font/google";
import "@workspace/ui/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Nav } from "@/components/nav";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@workspace/ui/lib/utils";
import { useState } from "react";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <Nav onToggleSidebar={() => setSidebarOpen((v) => !v)} />
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="mt-[var(--nav-h)] md:ml-[var(--sidebar-w)] min-h-[calc(100vh-var(--nav-h))]">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
