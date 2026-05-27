"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

const BREADCRUMBS: Record<string, string> = {
  elements: "Elements",
  relationships: "Relations",
  views: "Vues",
};

export function Nav({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 border-b border-border bg-secondary px-5 h-[var(--nav-h)]">
      <button
        onClick={onToggleSidebar}
        className="flex items-center justify-center size-8 rounded-md hover:bg-muted md:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="size-[18px]" />
      </button>

      <Link href="/" className="flex items-center gap-2.5 no-underline shrink-0">
        <svg width="22" height="22" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <polygon points="16,2 27,8 27,22 16,28 5,22 5,8" fill="#2563eb" />
          <polygon
            points="16,9 22,13 22,21 16,25 10,21 10,13"
            fill="none"
            stroke="white"
            strokeWidth="0.8"
            strokeLinejoin="round"
            opacity="0.4"
          />
          <polygon points="16,14 19,16 19,19 16,21 13,19 13,16" fill="white" opacity="0.15" />
        </svg>
        <span className="text-[17px] leading-none tracking-tight" style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif" }}>
          <span className="font-light text-foreground">Archi</span>
          <span className="font-bold text-primary">Spark</span>
        </span>
      </Link>

      <div className="w-px h-5 bg-border mx-1" />

      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground overflow-hidden">
        {segments.length === 0 ? (
          <span className="text-muted-foreground">Vue d&apos;ensemble</span>
        ) : (
          <>
            <Link href="/" className="text-muted-foreground hover:text-foreground no-underline whitespace-nowrap">
              Accueil
            </Link>
            {segments.map((seg, i) => {
              const isLast = i === segments.length - 1;
              const label = BREADCRUMBS[seg] || decodeURIComponent(seg);
              const href = "/" + segments.slice(0, i + 1).join("/");
              return (
                <span key={seg} className="flex items-center gap-1.5">
                  <span className="text-border">/</span>
                  {isLast ? (
                    <span className="text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
                  ) : (
                    <Link href={href} className="text-muted-foreground hover:text-foreground no-underline whitespace-nowrap">
                      {label}
                    </Link>
                  )}
                </span>
              );
            })}
          </>
        )}
      </div>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </nav>
  );
}
