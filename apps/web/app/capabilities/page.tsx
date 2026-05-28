"use client";

import { useEffect, useState, useMemo } from "react";
import {
  fetchElements,
  fetchRelationships,
  type ElementOut,
  type RelationshipOut,
} from "@/lib/api";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CapApp {
  identifier: string;
  name: string;
  type: string;
}

interface L2Cap {
  identifier: string;
  name: string;
  apps: CapApp[];
}

interface L1Cap {
  identifier: string;
  name: string;
  apps: CapApp[];
  l2: L2Cap[];
}

function isAppType(type: string): boolean {
  return (
    type.startsWith("Application") || type === "DataObject"
  );
}

function isBusinessBehavior(type: string): boolean {
  return [
    "BusinessProcess",
    "BusinessFunction",
    "BusinessService",
    "BusinessInteraction",
  ].includes(type);
}

function buildLandscape(
  elements: ElementOut[],
  relationships: RelationshipOut[]
): L1Cap[] {
  const elMap = new Map(elements.map((e) => [e.identifier, e]));

  const capabilities = elements.filter((e) => e.type === "Capability");
  const apps = elements.filter((e) => isAppType(e.type));
  const bizElements = elements.filter((e) => isBusinessBehavior(e.type));

  const appSet = new Set(apps.map((a) => a.identifier));
  const capSet = new Set(capabilities.map((c) => c.identifier));
  const bizSet = new Set(bizElements.map((b) => b.identifier));

  // Composition: parent → children (L1 → L2)
  const childOf = new Map<string, string>(); // child → parent
  const childrenOf = new Map<string, string[]>(); // parent → children

  for (const rel of relationships) {
    if (
      (rel.type === "Composition" || rel.type === "Aggregation") &&
      capSet.has(rel.source) &&
      capSet.has(rel.target)
    ) {
      childOf.set(rel.target, rel.source);
      const kids = childrenOf.get(rel.source) || [];
      kids.push(rel.target);
      childrenOf.set(rel.source, kids);
    }
  }

  // Direct: App → Realization → Capability
  const capApps = new Map<string, Set<string>>(); // cap id → app ids

  for (const rel of relationships) {
    if (rel.type === "Realization") {
      if (appSet.has(rel.source) && capSet.has(rel.target)) {
        const set = capApps.get(rel.target) || new Set();
        set.add(rel.source);
        capApps.set(rel.target, set);
      }
    }
  }

  // Indirect: App → Serving/Association → BizElement → Realization → Capability
  const bizToCap = new Map<string, Set<string>>(); // biz id → cap ids
  for (const rel of relationships) {
    if (rel.type === "Realization" && bizSet.has(rel.source) && capSet.has(rel.target)) {
      const set = bizToCap.get(rel.source) || new Set();
      set.add(rel.target);
      bizToCap.set(rel.source, set);
    }
  }

  for (const rel of relationships) {
    if (
      (rel.type === "Serving" || rel.type === "Association") &&
      appSet.has(rel.source) &&
      bizSet.has(rel.target)
    ) {
      const caps = bizToCap.get(rel.target);
      if (caps) {
        for (const capId of caps) {
          const set = capApps.get(capId) || new Set();
          set.add(rel.source);
          capApps.set(capId, set);
        }
      }
    }
  }

  function toCapApp(id: string): CapApp | null {
    const el = elMap.get(id);
    if (!el) return null;
    return { identifier: el.identifier, name: el.name, type: el.type };
  }

  function getApps(capId: string): CapApp[] {
    const ids = capApps.get(capId);
    if (!ids) return [];
    return [...ids].map(toCapApp).filter(Boolean) as CapApp[];
  }

  // L1 = capabilities that are NOT a child of another capability
  const l1Caps = capabilities
    .filter((c) => !childOf.has(c.identifier))
    .sort((a, b) => a.name.localeCompare(b.name));

  return l1Caps.map((cap) => {
    const children = (childrenOf.get(cap.identifier) || [])
      .map((id) => elMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name)) as ElementOut[];

    return {
      identifier: cap.identifier,
      name: cap.name,
      apps: getApps(cap.identifier),
      l2: children.map((child) => ({
        identifier: child.identifier,
        name: child.name,
        apps: getApps(child.identifier),
      })),
    };
  });
}

export default function CapabilitiesPage() {
  const [elements, setElements] = useState<ElementOut[]>([]);
  const [relationships, setRelationships] = useState<RelationshipOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([fetchElements(), fetchRelationships()])
      .then(([e, r]) => {
        setElements(e);
        setRelationships(r);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const landscape = useMemo(
    () => buildLandscape(elements, relationships),
    [elements, relationships]
  );

  const totalApps = useMemo(() => {
    const ids = new Set<string>();
    for (const l1 of landscape) {
      for (const a of l1.apps) ids.add(a.identifier);
      for (const l2 of l1.l2) {
        for (const a of l2.apps) ids.add(a.identifier);
      }
    }
    return ids.size;
  }, [landscape]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          Erreur : {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Application par Capability</h1>
        <p className="text-muted-foreground text-[13px] mt-0.5">
          {landscape.length} capabilities · {totalApps} applications
        </p>
      </div>

      {landscape.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-[40px] mb-3.5">🗺️</div>
          <p className="text-sm">
            Aucune Capability trouvée dans le modèle.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {landscape.map((l1) => {
            const isCollapsed = collapsed.has(l1.identifier);
            const totalL1Apps =
              l1.apps.length +
              l1.l2.reduce((sum, l2) => sum + l2.apps.length, 0);
            const isGap = totalL1Apps === 0 && l1.l2.length === 0;

            return (
              <div
                key={l1.identifier}
                className="border border-border rounded-xl bg-card overflow-hidden"
              >
                {/* L1 header */}
                <button
                  onClick={() => toggle(l1.identifier)}
                  className="w-full flex items-center gap-2.5 px-4 py-3 bg-secondary/50 hover:bg-secondary transition-colors text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <CapIcon />
                  <span className="font-semibold text-[13px] flex-1">
                    {l1.name}
                  </span>
                  {totalL1Apps > 0 && (
                    <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {totalL1Apps} app{totalL1Apps !== 1 ? "s" : ""}
                    </span>
                  )}
                  {l1.l2.length > 0 && (
                    <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {l1.l2.length} sub
                    </span>
                  )}
                  {isGap && (
                    <span className="text-[11px] text-destructive border border-dashed border-destructive/40 px-1.5 py-0.5 rounded">
                      Gap
                    </span>
                  )}
                </button>

                {/* L1 content */}
                {!isCollapsed && (
                  <div className="divide-y divide-border">
                    {/* Apps directly on L1 */}
                    {l1.apps.length > 0 && (
                      <div className="px-4 py-3">
                        <div className="text-[10px] font-bold tracking-[0.6px] uppercase text-muted-foreground mb-2">
                          Général
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {l1.apps.map((app) => (
                            <AppPill key={app.identifier} app={app} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* L2 sub-capabilities */}
                    {l1.l2.map((l2) => (
                      <div key={l2.identifier} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <CapIcon small />
                          <span className="text-[12px] font-medium text-foreground">
                            {l2.name}
                          </span>
                          {l2.apps.length === 0 && (
                            <span className="text-[10px] text-destructive border border-dashed border-destructive/40 px-1 py-0.5 rounded">
                              Gap
                            </span>
                          )}
                        </div>
                        {l2.apps.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 ml-5">
                            {l2.apps.map((app) => (
                              <AppPill key={app.identifier} app={app} />
                            ))}
                          </div>
                        ) : (
                          <div className="ml-5 text-[11px] text-muted-foreground italic">
                            Aucune application
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Empty L1 with no sub-caps and no apps */}
                    {l1.apps.length === 0 && l1.l2.length === 0 && (
                      <div className="px-4 py-4 text-[11px] text-muted-foreground italic">
                        Aucune application ni sous-capability
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AppPill({ app }: { app: CapApp }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] bg-blue-50 text-blue-800 border-l-2 border-blue-500 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-400">
      <AppIcon />
      {app.name || app.identifier}
    </span>
  );
}

function CapIcon({ small }: { small?: boolean }) {
  const size = small ? 12 : 14;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-amber-600 dark:text-amber-400"
    >
      <rect x="1" y="10" width="14" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="3" y="5" width="10" height="4" rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="5" y="0" width="6" height="4" rx="0.5" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

function AppIcon() {
  return (
    <svg
      width={11}
      height={11}
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-blue-600 dark:text-blue-400"
    >
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="4" width="4" height="4" rx="0.5" fill="currentColor" />
      <rect x="10" y="4" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="4" y="10" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
