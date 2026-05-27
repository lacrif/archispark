"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Box, ArrowRightLeft, LayoutGrid } from "lucide-react";
import { fetchModel, type ModelInfo } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  dot?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { href: "/elements", label: "Éléments", icon: Box, dot: "#d97706" },
  { href: "/relationships", label: "Relations", icon: ArrowRightLeft, dot: "#2563eb" },
  { href: "/views", label: "Vues", icon: LayoutGrid, dot: "#16a34a" },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [model, setModel] = useState<ModelInfo | null>(null);

  useEffect(() => {
    fetchModel().then(setModel).catch(() => {});
  }, []);

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-foreground/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-[var(--nav-h)] bottom-0 left-0 z-40 w-[var(--sidebar-w)] bg-secondary border-r border-border flex flex-col overflow-y-auto transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Model info */}
        {model && (
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <div className="text-[13px] font-semibold text-foreground whitespace-nowrap overflow-hidden text-ellipsis mb-1">
              {model.name}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {model.element_count} éléments · {model.relationship_count} relations · {model.view_count} vues
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 py-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-md text-sm no-underline transition-colors ${
                  active
                    ? "bg-card text-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.dot ? (
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ background: item.dot }}
                  />
                ) : (
                  <Icon className="size-4 shrink-0" />
                )}
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Import zone */}
        <div className="px-3 py-3 border-t border-border">
          <label
            className="border-2 border-dashed border-border rounded-lg p-3.5 text-center text-muted-foreground cursor-pointer transition-colors hover:border-primary hover:text-foreground block"
          >
            <div className="text-2xl mb-1.5">↑</div>
            <p className="text-xs">Importer un modèle</p>
            <div className="text-[11px] mt-0.5 opacity-70">.xml (AOEF)</div>
            <input type="file" accept=".xml" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </aside>
    </>
  );
}

function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = "";
  // TODO: implement import via API
  console.log("Import file:", file.name);
}
