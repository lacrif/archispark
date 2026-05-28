"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LayoutDashboard, ArrowRightLeft, LayoutGrid, Tag, Download, Users } from "lucide-react";
import { fetchModel, fetchElements, importModel, type ModelInfo } from "@/lib/api";
import { useIsAdmin } from "@/hooks/use-current-user";

interface LayerGroup {
  key: string;
  label: string;
  dot: string;
}

const LAYER_GROUPS: LayerGroup[] = [
  { key: "Strategy", label: "Stratégie", dot: "#dc2626" },
  { key: "Business", label: "Métier", dot: "#d97706" },
  { key: "Application", label: "Application", dot: "#2563eb" },
  { key: "Technology", label: "Technologie", dot: "#16a34a" },
  { key: "Motivation", label: "Motivation", dot: "#7c3aed" },
  { key: "Physical", label: "Physique", dot: "#059669" },
  { key: "Implementation", label: "Implémentation", dot: "#ea580c" },
  { key: "Composite", label: "Composite", dot: "#64748b" },
];

function getLayer(type: string): string {
  if (type.startsWith("Business") || ["Contract", "Representation", "Product"].includes(type))
    return "Business";
  if (type.startsWith("Application") || type === "DataObject") return "Application";
  if (
    type.startsWith("Technology") ||
    ["Node", "Device", "SystemSoftware", "Path", "CommunicationNetwork", "Artifact"].includes(type)
  )
    return "Technology";
  if (["Equipment", "Facility", "DistributionNetwork", "Material"].includes(type)) return "Physical";
  if (
    ["Stakeholder", "Driver", "Assessment", "Goal", "Outcome", "Principle", "Requirement", "Constraint", "Meaning", "Value"].includes(type)
  )
    return "Motivation";
  if (["Resource", "Capability", "CourseOfAction", "ValueStream"].includes(type)) return "Strategy";
  if (["WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap"].includes(type))
    return "Implementation";
  return "Composite";
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Suspense>
      <SidebarInner open={open} onClose={onClose} />
    </Suspense>
  );
}

function SidebarInner({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [layerCounts, setLayerCounts] = useState<Record<string, number>>({});
  const isAdmin = useIsAdmin();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([fetchModel(), fetchElements()]).then(([m, elements]) => {
      setModel(m);
      const counts: Record<string, number> = {};
      for (const el of elements) {
        const layer = getLayer(el.type);
        counts[layer] = (counts[layer] || 0) + 1;
      }
      setLayerCounts(counts);
    }).catch(() => {});
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const { exportModelUrl: url } = await import("@/lib/api");
      const token = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/)?.[1];
      const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${decodeURIComponent(token)}` } } : {});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="?([^";\n]+)"?/)?.[1] ?? "model.xml";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      // silently ignore
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const xml = await file.text();
      const info = await importModel(xml);
      setModel(info);
      // Recompute layer counts
      const { fetchElements: fe } = await import("@/lib/api");
      const elements = await fe();
      const counts: Record<string, number> = {};
      for (const el of elements) {
        const layer = getLayer(el.type);
        counts[layer] = (counts[layer] || 0) + 1;
      }
      setLayerCounts(counts);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const currentLayer = pathname === "/elements" ? searchParams.get("layer") : null;

  const visibleLayers = LAYER_GROUPS.filter((g) => (layerCounts[g.key] || 0) > 0);

  return (
    <>
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

        <div className="flex-1 py-2 overflow-y-auto">
          {/* Overview */}
          <Link
            href="/"
            onClick={onClose}
            className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-md text-sm no-underline transition-colors ${
              pathname === "/"
                ? "bg-card text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            Vue d&apos;ensemble
          </Link>

          {/* Separator */}
          <div className="mx-4 mt-3 mb-1 border-t border-border" />

          {/* Layer sections */}
          <div className="px-2 pt-2 pb-1">
            <div className="text-[10px] font-bold tracking-[0.8px] uppercase text-muted-foreground px-2 mb-1">
              Éléments
            </div>
            {/* All elements */}
            <Link
              href="/elements"
              onClick={onClose}
              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                pathname === "/elements" && !currentLayer
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full shrink-0 bg-foreground/30" />
                Tous
              </span>
              {model && (
                <span className="text-[11px] text-muted-foreground">{model.element_count}</span>
              )}
            </Link>
            {visibleLayers.map((group) => {
              const active = pathname === "/elements" && currentLayer === group.key;
              return (
                <Link
                  key={group.key}
                  href={`/elements?layer=${group.key}`}
                  onClick={onClose}
                  className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                    active
                      ? "bg-card text-foreground font-medium shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{ background: group.dot }}
                    />
                    {group.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {layerCounts[group.key] || 0}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Separator */}
          <div className="mx-4 mt-2 mb-1 border-t border-border" />

          {/* Landscape views */}
          <div className="px-2 pt-2 pb-1">
            <div className="text-[10px] font-bold tracking-[0.8px] uppercase text-muted-foreground px-2 mb-1">
              Paysages
            </div>
            <Link
              href="/capabilities"
              onClick={onClose}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                pathname === "/capabilities"
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="size-1.5 rounded-full shrink-0" style={{ background: "#2563eb" }} />
              App par Capability
            </Link>
            <Link
              href="/strategy"
              onClick={onClose}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                pathname === "/strategy"
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="size-1.5 rounded-full shrink-0" style={{ background: "#dc2626" }} />
              Stratégie par Capability
            </Link>
            <Link
              href="/composition"
              onClick={onClose}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                pathname === "/composition"
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="size-1.5 rounded-full shrink-0" style={{ background: "#64748b" }} />
              Composition
            </Link>
          </div>

          {/* Separator */}
          <div className="mx-4 mt-2 mb-1 border-t border-border" />

          {/* Relations */}
          <Link
            href="/relationships"
            onClick={onClose}
            className={`flex items-center justify-between gap-2 px-3 py-2 mx-2 rounded-md text-sm no-underline transition-colors ${
              pathname === "/relationships" || pathname.startsWith("/relationships/")
                ? "bg-card text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <ArrowRightLeft className="size-4 shrink-0" />
              Relations
            </span>
            {model && (
              <span className="text-[11px] text-muted-foreground">{model.relationship_count}</span>
            )}
          </Link>

          {/* Views */}
          <Link
            href="/views"
            onClick={onClose}
            className={`flex items-center justify-between gap-2 px-3 py-2 mx-2 rounded-md text-sm no-underline transition-colors ${
              pathname === "/views" || pathname.startsWith("/views/")
                ? "bg-card text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <LayoutGrid className="size-4 shrink-0" />
              Vues
            </span>
            {model && (
              <span className="text-[11px] text-muted-foreground">{model.view_count}</span>
            )}
          </Link>

          {/* Separator */}
          <div className="mx-4 mt-2 mb-1 border-t border-border" />

          {/* Model metadata */}
          <div className="px-2 pt-2 pb-1">
            <div className="text-[10px] font-bold tracking-[0.8px] uppercase text-muted-foreground px-2 mb-1">
              Modèle
            </div>
            <Link
              href="/properties"
              onClick={onClose}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                pathname === "/properties"
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Tag className="size-4 shrink-0" />
              Propriétés
            </Link>
            {isAdmin && (
              <Link
                href="/users"
                onClick={onClose}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                  pathname === "/users"
                    ? "bg-card text-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Users className="size-4 shrink-0" />
                Utilisateurs
              </Link>
            )}
          </div>
        </div>

        {/* Import / Export zone */}
        <div className="px-3 py-3 border-t border-border space-y-2">
          {isAdmin && importError && (
            <div className="text-[11px] text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5 break-words">
              {importError}
            </div>
          )}
          {isAdmin && (
            <label className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors block ${importing ? "border-primary/50 opacity-60 pointer-events-none" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"}`}>
              <div className="text-xl mb-1">{importing ? "⏳" : "↑"}</div>
              <p className="text-xs">{importing ? "Importation…" : "Importer un modèle"}</p>
              <div className="text-[11px] mt-0.5 opacity-70">.xml (AOEF)</div>
              <input type="file" accept=".xml" className="hidden" disabled={importing} onChange={handleImport} />
            </label>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-border text-muted-foreground text-xs hover:border-primary hover:text-foreground transition-colors disabled:opacity-60 disabled:pointer-events-none"
          >
            <Download className="size-3.5" />
            {exporting ? "Exportation…" : "Exporter le modèle"}
          </button>
        </div>
      </aside>
    </>
  );
}

