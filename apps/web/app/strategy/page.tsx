"use client";

import { useEffect, useState, useMemo } from "react";
import {
  fetchElements,
  fetchRelationships,
  type ElementOut,
  type RelationshipOut,
} from "@/lib/api";
import { ChevronDown, ChevronRight } from "lucide-react";

interface StratElement {
  identifier: string;
  name: string;
  type: string;
}

interface ValueStreamStep {
  identifier: string;
  name: string;
  elements: StratElement[];
}

interface CourseGroup {
  identifier: string;
  name: string;
  elements: StratElement[];
}

interface CapGroup {
  identifier: string;
  name: string;
  resources: StratElement[];
  courses: CourseGroup[];
  valueStreams: ValueStreamStep[];
  otherElements: StratElement[];
  subCaps: SubCap[];
}

interface SubCap {
  identifier: string;
  name: string;
  resources: StratElement[];
  courses: CourseGroup[];
  valueStreams: ValueStreamStep[];
  otherElements: StratElement[];
}

function buildStrategyView(
  elements: ElementOut[],
  relationships: RelationshipOut[]
): CapGroup[] {
  const elMap = new Map(elements.map((e) => [e.identifier, e]));

  const capabilities = elements.filter((e) => e.type === "Capability");
  const resources = elements.filter((e) => e.type === "Resource");
  const courses = elements.filter((e) => e.type === "CourseOfAction");
  const valueStreams = elements.filter((e) => e.type === "ValueStream");

  const capSet = new Set(capabilities.map((c) => c.identifier));
  const resSet = new Set(resources.map((r) => r.identifier));
  const courseSet = new Set(courses.map((c) => c.identifier));
  const vsSet = new Set(valueStreams.map((v) => v.identifier));

  // Composition/Aggregation: parent → children for capabilities
  const childOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();

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

  // Association/Realization/Serving links to capabilities
  const capLinked = new Map<string, Set<string>>();

  for (const rel of relationships) {
    if (capSet.has(rel.target)) {
      const set = capLinked.get(rel.target) || new Set();
      set.add(rel.source);
      capLinked.set(rel.target, set);
    }
    if (capSet.has(rel.source)) {
      const set = capLinked.get(rel.source) || new Set();
      set.add(rel.target);
      capLinked.set(rel.source, set);
    }
  }

  // CourseOfAction links
  const courseLinked = new Map<string, Set<string>>();
  for (const rel of relationships) {
    if (courseSet.has(rel.source)) {
      const set = courseLinked.get(rel.source) || new Set();
      set.add(rel.target);
      courseLinked.set(rel.source, set);
    }
    if (courseSet.has(rel.target)) {
      const set = courseLinked.get(rel.target) || new Set();
      set.add(rel.source);
      courseLinked.set(rel.target, set);
    }
  }

  function toEl(id: string): StratElement | null {
    const el = elMap.get(id);
    if (!el) return null;
    return { identifier: el.identifier, name: el.name, type: el.type };
  }

  // L1 capabilities (not child of another)
  const l1Caps = capabilities
    .filter((c) => !childOf.has(c.identifier))
    .sort((a, b) => a.name.localeCompare(b.name));

  function getLinkedOfType(capId: string, targetSet: Set<string>): StratElement[] {
    const linked = capLinked.get(capId);
    if (!linked) return [];
    return [...linked]
      .filter((id) => targetSet.has(id))
      .map(toEl)
      .filter(Boolean) as StratElement[];
  }

  function getNonStrategyLinked(capId: string): StratElement[] {
    const linked = capLinked.get(capId);
    if (!linked) return [];
    return [...linked]
      .filter((id) => !capSet.has(id) && !resSet.has(id) && !courseSet.has(id) && !vsSet.has(id))
      .map(toEl)
      .filter(Boolean) as StratElement[];
  }

  function buildCoursesForCap(capId: string): CourseGroup[] {
    return getLinkedOfType(capId, courseSet).map((c) => {
      const linked = courseLinked.get(c.identifier);
      const elements: StratElement[] = linked
        ? [...linked]
            .filter((id) => !capSet.has(id) && !courseSet.has(id))
            .map(toEl)
            .filter(Boolean) as StratElement[]
        : [];
      return { identifier: c.identifier, name: c.name, elements };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  function buildVSForCap(capId: string): ValueStreamStep[] {
    return getLinkedOfType(capId, vsSet).map((v) => ({
      identifier: v.identifier,
      name: v.name,
      elements: [],
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  return l1Caps.map((cap) => {
    const subIds = (childrenOf.get(cap.identifier) || [])
      .map((id) => elMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name)) as ElementOut[];

    const subCaps: SubCap[] = subIds.map((sub) => ({
      identifier: sub.identifier,
      name: sub.name,
      resources: getLinkedOfType(sub.identifier, resSet),
      courses: buildCoursesForCap(sub.identifier),
      valueStreams: buildVSForCap(sub.identifier),
      otherElements: getNonStrategyLinked(sub.identifier).sort((a, b) => a.name.localeCompare(b.name)),
    }));

    return {
      identifier: cap.identifier,
      name: cap.name,
      resources: getLinkedOfType(cap.identifier, resSet),
      courses: buildCoursesForCap(cap.identifier),
      valueStreams: buildVSForCap(cap.identifier),
      otherElements: getNonStrategyLinked(cap.identifier).sort((a, b) => a.name.localeCompare(b.name)),
      subCaps,
    };
  });
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Resource: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", border: "border-red-500 dark:border-red-400" },
  CourseOfAction: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", border: "border-red-400 dark:border-red-500" },
  ValueStream: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", border: "border-red-600 dark:border-red-300" },
  Capability: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", border: "border-amber-500 dark:border-amber-400" },
  default: { bg: "bg-gray-50 dark:bg-gray-800/30", text: "text-gray-700 dark:text-gray-300", border: "border-gray-400 dark:border-gray-500" },
};

function getColors(type: string) {
  return TYPE_COLORS[type] ?? TYPE_COLORS.default!;
}

export default function StrategyPage() {
  const [elements, setElements] = useState<ElementOut[]>([]);
  const [relationships, setRelationships] = useState<RelationshipOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([fetchElements(), fetchRelationships()])
      .then(([e, r]) => { setElements(e); setRelationships(r); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const landscape = useMemo(
    () => buildStrategyView(elements, relationships),
    [elements, relationships]
  );

  const stats = useMemo(() => {
    let res = 0, courses = 0, vs = 0, subCaps = 0;
    for (const g of landscape) {
      res += g.resources.length;
      courses += g.courses.length;
      vs += g.valueStreams.length;
      subCaps += g.subCaps.length;
      for (const s of g.subCaps) {
        res += s.resources.length;
        courses += s.courses.length;
        vs += s.valueStreams.length;
      }
    }
    return { caps: landscape.length, subCaps, res, courses, vs };
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
        <h1 className="text-lg font-semibold">Stratégie par Capability</h1>
        <p className="text-muted-foreground text-[13px] mt-0.5">
          {stats.caps} capabilities · {stats.subCaps} sous-capabilities · {stats.res} resources · {stats.courses} courses of action · {stats.vs} value streams
        </p>
      </div>

      {landscape.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-[40px] mb-3.5">🎯</div>
          <p className="text-sm">Aucune Capability trouvée dans le modèle.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {landscape.map((cap) => {
            const isCollapsed = collapsed.has(cap.identifier);
            const directTotal = cap.resources.length + cap.courses.length + cap.valueStreams.length + cap.otherElements.length;
            const total = directTotal + cap.subCaps.length;

            return (
              <div key={cap.identifier} className="border border-border rounded-xl bg-card overflow-hidden">
                <button
                  onClick={() => toggle(cap.identifier)}
                  className="w-full flex items-center gap-2.5 px-4 py-3 bg-secondary/50 hover:bg-secondary transition-colors text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <CapIcon />
                  <span className="font-semibold text-[13px] flex-1">{cap.name}</span>
                  {cap.subCaps.length > 0 && (
                    <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {cap.subCaps.length} sub
                    </span>
                  )}
                  {cap.resources.length > 0 && (
                    <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {cap.resources.length} res
                    </span>
                  )}
                  {cap.courses.length > 0 && (
                    <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {cap.courses.length} CoA
                    </span>
                  )}
                  {cap.valueStreams.length > 0 && (
                    <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {cap.valueStreams.length} VS
                    </span>
                  )}
                  {total === 0 && (
                    <span className="text-[11px] text-destructive border border-dashed border-destructive/40 px-1.5 py-0.5 rounded">
                      Isolé
                    </span>
                  )}
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-border">
                    {/* Direct resources */}
                    {cap.resources.length > 0 && (
                      <Section label="Resources">
                        {cap.resources.map((r) => (
                          <Pill key={r.identifier} el={r} />
                        ))}
                      </Section>
                    )}

                    {/* Direct courses of action */}
                    {cap.courses.map((course) => (
                      <CourseRow key={course.identifier} course={course} />
                    ))}

                    {/* Direct value streams */}
                    {cap.valueStreams.length > 0 && (
                      <Section label="Value Streams">
                        {cap.valueStreams.map((vs) => (
                          <Pill key={vs.identifier} el={{ ...vs, type: "ValueStream" }} />
                        ))}
                      </Section>
                    )}

                    {/* Direct other linked elements */}
                    {cap.otherElements.length > 0 && (
                      <Section label="Éléments liés">
                        {cap.otherElements.map((el) => (
                          <Pill key={el.identifier} el={el} />
                        ))}
                      </Section>
                    )}

                    {/* Sub-capabilities via Composition */}
                    {cap.subCaps.map((sub) => {
                      const subTotal = sub.resources.length + sub.courses.length + sub.valueStreams.length + sub.otherElements.length;
                      return (
                        <div key={sub.identifier} className="px-4 py-3 bg-muted/20">
                          <div className="flex items-center gap-2 mb-2.5">
                            <CompositionIcon />
                            <span className="text-[12px] font-semibold text-foreground">{sub.name}</span>
                            {subTotal === 0 && (
                              <span className="text-[10px] text-destructive border border-dashed border-destructive/40 px-1 py-0.5 rounded">
                                Isolé
                              </span>
                            )}
                          </div>
                          {subTotal > 0 ? (
                            <div className="ml-5 space-y-2">
                              {sub.resources.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold tracking-[0.6px] uppercase text-muted-foreground mb-1.5">Resources</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {sub.resources.map((r) => <Pill key={r.identifier} el={r} />)}
                                  </div>
                                </div>
                              )}
                              {sub.courses.map((course) => (
                                <CourseRow key={course.identifier} course={course} indent />
                              ))}
                              {sub.valueStreams.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold tracking-[0.6px] uppercase text-muted-foreground mb-1.5">Value Streams</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {sub.valueStreams.map((vs) => <Pill key={vs.identifier} el={{ ...vs, type: "ValueStream" }} />)}
                                  </div>
                                </div>
                              )}
                              {sub.otherElements.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold tracking-[0.6px] uppercase text-muted-foreground mb-1.5">Éléments liés</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {sub.otherElements.map((el) => <Pill key={el.identifier} el={el} />)}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="ml-5 text-[11px] text-muted-foreground italic">
                              Aucun élément stratégique lié
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {total === 0 && (
                      <div className="px-4 py-4 text-[11px] text-muted-foreground italic">
                        Aucun élément stratégique lié
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

function CourseRow({ course, indent }: { course: CourseGroup; indent?: boolean }) {
  return (
    <div className={indent ? "" : "px-4 py-3"}>
      <div className="flex items-center gap-2 mb-2">
        <CourseIcon />
        <span className="text-[12px] font-medium text-foreground">{course.name}</span>
      </div>
      {course.elements.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 ml-5">
          {course.elements.map((el) => (
            <Pill key={el.identifier} el={el} />
          ))}
        </div>
      ) : (
        <div className="ml-5 text-[11px] text-muted-foreground italic">
          Aucun élément lié
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-bold tracking-[0.6px] uppercase text-muted-foreground mb-2">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pill({ el }: { el: StratElement }) {
  const c = getColors(el.type);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] ${c.bg} ${c.text} border-l-2 ${c.border}`}>
      {el.name || el.identifier}
      <span className="text-[10px] opacity-60">{el.type}</span>
    </span>
  );
}

function CapIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" className="shrink-0 text-amber-600 dark:text-amber-400">
      <rect x="1" y="10" width="14" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="3" y="5" width="10" height="4" rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="5" y="0" width="6" height="4" rx="0.5" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

function CompositionIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" className="shrink-0 text-amber-500 dark:text-amber-400">
      <circle cx="8" cy="3" r="2" fill="currentColor" opacity="0.8" />
      <line x1="8" y1="5" x2="4" y2="10" stroke="currentColor" strokeWidth="1.2" />
      <line x1="8" y1="5" x2="12" y2="10" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4" cy="12" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function CourseIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" className="shrink-0 text-red-600 dark:text-red-400">
      <path d="M2 8h8m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="13" cy="8" r="2" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
