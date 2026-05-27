"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchModel, fetchElements, type ModelInfo, type ElementOut } from "@/lib/api";

const LAYER_COLORS: Record<string, string> = {
  Business: "#d97706",
  Application: "#2563eb",
  Technology: "#16a34a",
  Motivation: "#7c3aed",
  Strategy: "#dc2626",
  Physical: "#059669",
  Implementation: "#ea580c",
};

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

const SECTIONS = [
  { href: "/elements", label: "Éléments", desc: "Parcourir tous les éléments ArchiMate du modèle" },
  { href: "/relationships", label: "Relations", desc: "Explorer les relations entre éléments" },
  { href: "/views", label: "Vues", desc: "Visualiser les diagrammes du modèle" },
];

export default function OverviewPage() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [elements, setElements] = useState<ElementOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchModel(), fetchElements()])
      .then(([m, e]) => {
        setModel(m);
        setElements(e);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const layerCounts = elements.reduce<Record<string, number>>((acc, el) => {
    const layer = getLayer(el.type);
    acc[layer] = (acc[layer] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <div className="size-4 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          Erreur : {error}
        </div>
        <p className="text-muted-foreground text-xs mt-2">
          Assurez-vous que l&apos;API ArchiMate tourne sur le port 8000.
        </p>
      </div>
    );
  }

  return (
    <div className="p-7 max-w-5xl">
      {model && (
        <div className="mb-6">
          <h1 className="text-lg font-semibold">{model.name}</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            {model.documentation || "Modèle ArchiMate"}
            {model.version && <> · v{model.version}</>}
          </p>
        </div>
      )}

      {/* Stats cards */}
      <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-muted-foreground mb-3">
        Aperçu du modèle
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 mb-7">
        <StatCard label="Total éléments" value={model?.element_count ?? 0} />
        {Object.entries(layerCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([layer, count]) => (
            <StatCard
              key={layer}
              label={layer}
              value={count}
              color={LAYER_COLORS[layer]}
            />
          ))}
        <StatCard label="Relations" value={model?.relationship_count ?? 0} />
        <StatCard label="Vues" value={model?.view_count ?? 0} />
      </div>

      {/* Navigation cards */}
      <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-muted-foreground mb-3 mt-2">
        Explorer
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="bg-card border border-border rounded-lg px-4 py-3.5 no-underline transition-colors hover:border-primary"
          >
            <div className="text-[13px] font-semibold mb-0.5 text-foreground">{s.label}</div>
            <div className="text-[12px] text-muted-foreground">{s.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">{label}</div>
      <div className="text-2xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
