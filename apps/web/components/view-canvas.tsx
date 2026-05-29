"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  NodeResizer,
  Panel,
  Position,
  getNodesBounds,
  getSmoothStepPath,
  getViewportForBounds,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import "@xyflow/react/dist/style.css";
import {
  type NodeOut,
  type ConnectionOut,
  type ElementOut,
  createRelationship,
  createViewConnection,
  createViewNode,
  deleteViewConnection,
  deleteViewNode,
  updateViewConnection,
  updateViewNode,
} from "@/lib/api";
import { allowedRelationships } from "@/lib/archimate-rules";

const HANDLE_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "#fff",
  border: "1px solid #555",
  borderRadius: "50%",
  opacity: 0.85,
};

const ARCHIMATE_LAYER: Record<string, string> = {
  Resource: "strategy", Capability: "strategy", ValueStream: "strategy", CourseOfAction: "strategy",
  BusinessActor: "business", BusinessRole: "business", BusinessCollaboration: "business",
  BusinessInterface: "business", BusinessProcess: "business", BusinessFunction: "business",
  BusinessInteraction: "business", BusinessEvent: "business", BusinessService: "business",
  BusinessObject: "business", Contract: "business", Representation: "business", Product: "business",
  ApplicationComponent: "application", ApplicationCollaboration: "application",
  ApplicationInterface: "application", ApplicationFunction: "application",
  ApplicationInteraction: "application", ApplicationProcess: "application",
  ApplicationEvent: "application", ApplicationService: "application", DataObject: "application",
  Node: "technology", Device: "technology", SystemSoftware: "technology",
  TechnologyCollaboration: "technology", TechnologyInterface: "technology", Path: "technology",
  CommunicationNetwork: "technology", TechnologyFunction: "technology",
  TechnologyProcess: "technology", TechnologyInteraction: "technology",
  TechnologyEvent: "technology", TechnologyService: "technology", Artifact: "technology",
  Equipment: "physical", Facility: "physical", DistributionNetwork: "physical", Material: "physical",
  Stakeholder: "motivation", Driver: "motivation", Assessment: "motivation", Goal: "motivation",
  Outcome: "motivation", Principle: "motivation", Requirement: "motivation",
  Constraint: "motivation", Meaning: "motivation", Value: "motivation",
  WorkPackage: "implementation", Deliverable: "implementation",
  ImplementationEvent: "implementation", Plateau: "implementation", Gap: "implementation",
  Grouping: "other", Location: "other", Junction: "junction", AndJunction: "junction", OrJunction: "junction",
};

// Colors aligned with sidebar LAYER_GROUPS dots
const LAYER_COLOR: Record<string, { bg: string; border: string }> = {
  strategy:       { bg: "#fee2e2", border: "#dc2626" },  // red-100 / red-600
  business:       { bg: "#fef3c7", border: "#d97706" },  // amber-100 / amber-600
  application:    { bg: "#dbeafe", border: "#2563eb" },  // blue-100 / blue-600
  technology:     { bg: "#dcfce7", border: "#16a34a" },  // green-100 / green-600
  physical:       { bg: "#d1fae5", border: "#059669" },  // emerald-100 / emerald-600
  motivation:     { bg: "#ede9fe", border: "#7c3aed" },  // violet-100 / violet-700
  implementation: { bg: "#ffedd5", border: "#ea580c" },  // orange-100 / orange-600
  other:          { bg: "#f1f5f9", border: "#64748b" },  // slate-100 / slate-500
  junction:       { bg: "#000000", border: "#000000" },
};

function colorFor(elementType?: string): { bg: string; border: string } {
  const layer = elementType ? ARCHIMATE_LAYER[elementType] : undefined;
  return LAYER_COLOR[layer ?? "other"] ?? LAYER_COLOR.other;
}

const ViewIdContext = createContext<string | undefined>(undefined);

function ArchiNode({ id, data, selected }: NodeProps) {
  const viewId = useContext(ViewIdContext);
  const elementType = (data.elementType as string | undefined) ?? undefined;
  const hasChildren = Boolean(data.hasChildren);
  const { bg, border } = colorFor(elementType);
  const containerStyle: React.CSSProperties = hasChildren
    ? {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: `1px solid ${border}`,
        borderRadius: 4,
        background: bg,
        color: "#111",
        padding: "16px 6px 6px 6px",
        fontSize: 11,
        textAlign: "left",
        overflow: "hidden",
        cursor: "grab",
        position: "relative",
      }
    : {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: `1px solid ${border}`,
        borderRadius: 4,
        background: bg,
        color: "#111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px",
        fontSize: 11,
        textAlign: "center",
        overflow: "hidden",
        cursor: "grab",
      };
  return (
    <div style={containerStyle}>
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={30}
        lineStyle={{ borderColor: "#3b82f6" }}
        handleStyle={{ width: 8, height: 8, background: "#fff", border: "1px solid #3b82f6", borderRadius: 2 }}
        onResizeEnd={(_e, params) => {
          if (!viewId) return;
          updateViewNode(viewId, id, { w: Math.round(params.width), h: Math.round(params.height) }).catch((err) =>
            console.error("updateViewNode resize failed", err)
          );
        }}
      />
      <Handle type="source" position={Position.Top} id="s-top" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} id="s-right" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left} id="s-left" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Top} id="t-top" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Right} id="t-right" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Bottom} id="t-bottom" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Left} id="t-left" style={HANDLE_STYLE} />
      {hasChildren ? (
        <span style={{ position: "absolute", top: 3, left: 6, fontWeight: 500, pointerEvents: "none" }}>
          {String(data.label ?? "")}
        </span>
      ) : (
        <span>{String(data.label ?? "")}</span>
      )}
    </div>
  );
}

interface ArchiEdgeStyle {
  strokeDasharray?: string;
  markerStart?: string;
  markerEnd?: string;
}

function archimateEdgeStyle(type?: string): ArchiEdgeStyle {
  switch (type) {
    case "Composition":
      return { markerStart: "url(#archi-diamond-filled)" };
    case "Aggregation":
      return { markerStart: "url(#archi-diamond-open)" };
    case "Assignment":
      return { markerStart: "url(#archi-dot-filled)", markerEnd: "url(#archi-arrow-filled)" };
    case "Realization":
      return { markerEnd: "url(#archi-triangle-open)", strokeDasharray: "6 3" };
    case "Serving":
    case "UsedBy":
      return { markerEnd: "url(#archi-arrow-open)" };
    case "Triggering":
      return { markerEnd: "url(#archi-arrow-filled)" };
    case "Flow":
      return { markerEnd: "url(#archi-arrow-filled)", strokeDasharray: "6 3" };
    case "Access":
      return { markerEnd: "url(#archi-arrow-open)", strokeDasharray: "1 4" };
    case "Influence":
      return { markerEnd: "url(#archi-arrow-open)", strokeDasharray: "6 3" };
    case "Specialization":
      return { markerEnd: "url(#archi-triangle-open)" };
    case "Association":
    default:
      return {};
  }
}

function ArchiEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  selected,
}: EdgeProps) {
  const viewId = useContext(ViewIdContext);
  const { setEdges } = useReactFlow();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const relType = (data?.relationshipType as string | undefined) ?? undefined;
  const archi = archimateEdgeStyle(relType);
  const strokeStyle: React.CSSProperties = {
    stroke: selected ? "#0096ff" : "#222",
    strokeWidth: selected ? 1.8 : 1.2,
    fill: "none",
    ...(archi.strokeDasharray ? { strokeDasharray: archi.strokeDasharray } : {}),
  };

  const removeEdge = () => {
    if (viewId) {
      deleteViewConnection(viewId, id).catch((err) => console.error("deleteViewConnection failed", err));
    }
    setEdges((eds) => eds.filter((e) => e.id !== id));
  };

  const renameEdge = () => {
    if (!viewId) return;
    const next = window.prompt("Étiquette de la liaison :", typeof label === "string" ? label : "");
    if (next === null) return;
    updateViewConnection(viewId, id, { name: next || null })
      .then(() => {
        setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label: next || undefined } : e)));
      })
      .catch((err) => console.error("updateViewConnection failed", err));
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={strokeStyle}
        markerStart={archi.markerStart}
        markerEnd={archi.markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          className="nodrag nopan"
        >
          {label ? (
            <span
              style={{
                background: "#fff",
                padding: "1px 4px",
                fontSize: 10,
                border: `1px solid ${selected ? "#0096ff" : "#ddd"}`,
                borderRadius: 3,
              }}
            >
              {label}
            </span>
          ) : null}
          {selected ? (
            <>
              <button
                type="button"
                onClick={renameEdge}
                title="Renommer"
                style={{
                  background: "#fff",
                  border: "1px solid #0096ff",
                  borderRadius: 3,
                  fontSize: 9,
                  padding: "1px 4px",
                  cursor: "pointer",
                  color: "#0096ff",
                }}
              >
                {relType ?? "Association"}
              </button>
              <button
                type="button"
                onClick={removeEdge}
                title="Retirer de la vue"
                aria-label="Retirer de la vue"
                style={{
                  background: "#ff1e56",
                  border: "1px solid #ff1e56",
                  color: "#fff",
                  borderRadius: 3,
                  width: 16,
                  height: 16,
                  fontSize: 11,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ×
              </button>
            </>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const NODE_TYPES = { archi: ArchiNode };
const EDGE_TYPES = { archi: ArchiEdge };

interface NodeRect { x: number; y: number; w: number; h: number }

function pickHandles(src: NodeRect, tgt: NodeRect): { sourceHandle: string; targetHandle: string } {
  const sx = src.x + src.w / 2;
  const sy = src.y + src.h / 2;
  const tx = tgt.x + tgt.w / 2;
  const ty = tgt.y + tgt.h / 2;
  const dx = tx - sx;
  const dy = ty - sy;

  let srcSide: string;
  let tgtSide: string;

  if (Math.abs(dx) >= Math.abs(dy)) {
    srcSide = dx >= 0 ? "right" : "left";
    tgtSide = dx >= 0 ? "left" : "right";
  } else {
    srcSide = dy >= 0 ? "bottom" : "top";
    tgtSide = dy >= 0 ? "top" : "bottom";
  }

  return { sourceHandle: `s-${srcSide}`, targetHandle: `t-${tgtSide}` };
}

function flattenNodes(
  nodes: NodeOut[] | null | undefined,
  elementNames: Map<string, string>,
  elementTypes: Map<string, string>,
  parentId?: string
): Node[] {
  if (!nodes) return [];
  return nodes.flatMap((n) => {
    const resolvedName =
      n.name ||
      (n.element_ref ? elementNames.get(n.element_ref) : undefined) ||
      "";
    const elementType = n.element_ref ? elementTypes.get(n.element_ref) : undefined;
    const hasChildren = Boolean(n.children && n.children.length > 0);
    const node: Node = {
      id: n.identifier,
      type: "archi",
      position: { x: n.x ?? 0, y: n.y ?? 0 },
      data: { label: resolvedName, elementType, elementRef: n.element_ref ?? null, hasChildren },
      style: { width: n.w ?? undefined, height: n.h ?? undefined },
      ...(parentId ? { parentId, extent: "parent" as const, expandParent: true } : {}),
    };
    return [node, ...flattenNodes(n.children, elementNames, elementTypes, n.identifier)];
  });
}

interface ViewCanvasProps {
  viewId?: string;
  nodes: NodeOut[];
  connections: ConnectionOut[];
  elements?: ElementOut[];
  elementNames?: Map<string, string>;
  elementTypes?: Map<string, string>;
  relationshipTypes?: Map<string, string>;
  relationshipNames?: Map<string, string>;
}

function ElementPalette({ elements }: { elements: ElementOut[] }) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? elements.filter((e) => e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q))
      : elements;
    const map = new Map<string, ElementOut[]>();
    for (const el of filtered) {
      const list = map.get(el.type) ?? [];
      list.push(el);
      map.set(el.type, list);
    }
    return [...map.entries()]
      .map(([type, items]) => ({
        type,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [elements, query]);

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, elementId: string) => {
    e.dataTransfer.setData("application/x-archi-element", elementId);
    e.dataTransfer.effectAllowed = "move";
  };

  const toggle = (type: string) => setCollapsed((s) => ({ ...s, [type]: !s[type] }));
  const collapseAll = () => setCollapsed(Object.fromEntries(grouped.map(({ type }) => [type, true])));
  const expandAll = () => setCollapsed({});

  return (
    <div
      style={{
        width: 240,
        borderRight: "1px solid var(--border, #e5e5e5)",
        background: "var(--card, #fff)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: 8, borderBottom: "1px solid var(--border, #e5e5e5)", display: "flex", flexDirection: "column", gap: 6 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher élément…"
          style={{
            width: "100%",
            fontSize: 12,
            padding: "4px 6px",
            border: "1px solid var(--border, #e5e5e5)",
            borderRadius: 4,
            background: "var(--background, #fff)",
            color: "var(--foreground, #0a0a0a)",
          }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={expandAll}
            title="Tout déplier"
            style={{
              flex: 1,
              fontSize: 10,
              padding: "3px 6px",
              border: "1px solid var(--border, #e5e5e5)",
              borderRadius: 3,
              background: "var(--background, #fff)",
              color: "var(--foreground, #0a0a0a)",
              cursor: "pointer",
            }}
          >
            ▾ Tout déplier
          </button>
          <button
            type="button"
            onClick={collapseAll}
            title="Tout replier"
            style={{
              flex: 1,
              fontSize: 10,
              padding: "3px 6px",
              border: "1px solid var(--border, #e5e5e5)",
              borderRadius: 3,
              background: "var(--background, #fff)",
              color: "var(--foreground, #0a0a0a)",
              cursor: "pointer",
            }}
          >
            ▸ Tout replier
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 4 }}>
        {grouped.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--muted-foreground, #666)", padding: 8 }}>Aucun élément.</div>
        ) : (
          grouped.map(({ type, items }) => {
            const { bg, border } = colorFor(type);
            const isCollapsed = collapsed[type] ?? false;
            return (
              <div key={type} style={{ marginBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => toggle(type)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "3px 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "var(--secondary, #f5f5f5)",
                    border: "1px solid var(--border, #e5e5e5)",
                    borderRadius: 3,
                    color: "var(--foreground, #0a0a0a)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>
                    <span style={{ display: "inline-block", width: 9, marginRight: 4, textAlign: "center" }}>
                      {isCollapsed ? "▸" : "▾"}
                    </span>
                    {type}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground, #666)", fontWeight: 400 }}>
                    {items.length}
                  </span>
                </button>
                {isCollapsed ? null : (
                  <div style={{ paddingLeft: 6, marginTop: 2 }}>
                    {items.map((el) => (
                      <div
                        key={el.identifier}
                        draggable
                        onDragStart={(e) => onDragStart(e, el.identifier)}
                        title={`${el.type} — ${el.name}`}
                        style={{
                          padding: "3px 6px",
                          margin: "2px 0",
                          fontSize: 11,
                          cursor: "grab",
                          background: bg,
                          border: `1px solid ${border}`,
                          borderRadius: 3,
                          color: "#111",
                        }}
                      >
                        {el.name || "(sans nom)"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 768;

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.setAttribute("download", filename);
  a.setAttribute("href", dataUrl);
  a.click();
}

function DownloadButton({ filename = "view.png" }: { filename?: string }) {
  const { getNodes } = useReactFlow();
  const handleClick = () => {
    const nodesBounds = getNodesBounds(getNodes());
    const viewport = getViewportForBounds(nodesBounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0);
    const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!el) return;
    toPng(el, {
      backgroundColor: "#ffffff",
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      style: {
        width: `${IMAGE_WIDTH}px`,
        height: `${IMAGE_HEIGHT}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    }).then((dataUrl) => downloadDataUrl(dataUrl, filename));
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        padding: "4px 10px",
        fontSize: 12,
        background: "#fff",
        border: "1px solid #b1b1b7",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      Télécharger PNG
    </button>
  );
}

const MARKER_DEFS = (
  <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden>
    <defs>
      <marker id="archi-diamond-filled" viewBox="0 0 14 10" refX="0" refY="5" markerWidth="14" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <path d="M0,5 L7,0 L14,5 L7,10 Z" fill="#222" stroke="#222" />
      </marker>
      <marker id="archi-diamond-open" viewBox="0 0 14 10" refX="0" refY="5" markerWidth="14" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <path d="M0,5 L7,0 L14,5 L7,10 Z" fill="#fff" stroke="#222" />
      </marker>
      <marker id="archi-triangle-open" viewBox="0 0 12 10" refX="11" refY="5" markerWidth="12" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L12,5 L0,10 Z" fill="#fff" stroke="#222" />
      </marker>
      <marker id="archi-arrow-filled" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L10,5 L0,10 Z" fill="#222" stroke="#222" />
      </marker>
      <marker id="archi-arrow-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L10,5 L0,10" fill="none" stroke="#222" strokeWidth="1.2" />
      </marker>
      <marker id="archi-dot-filled" viewBox="0 0 8 8" refX="0" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="3.2" fill="#222" />
      </marker>
    </defs>
  </svg>
);

export function ViewCanvas(props: ViewCanvasProps) {
  return (
    <ReactFlowProvider>
      <ViewCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function ViewCanvasInner({ viewId, nodes, connections, elements = [], elementNames = new Map(), elementTypes = new Map(), relationshipTypes = new Map(), relationshipNames = new Map() }: ViewCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const initialNodes = useMemo(() => flattenNodes(nodes, elementNames, elementTypes), [nodes, elementNames, elementTypes]);

  const nodeRectMap = useMemo(() => {
    const map = new Map<string, NodeRect>();
    function collect(ns: NodeOut[], parentX = 0, parentY = 0) {
      for (const n of ns ?? []) {
        const x = (n.x ?? 0) + parentX;
        const y = (n.y ?? 0) + parentY;
        map.set(n.identifier, { x, y, w: n.w ?? 0, h: n.h ?? 0 });
        collect(n.children ?? [], x, y);
      }
    }
    collect(nodes);
    return map;
  }, [nodes]);

  const initialEdges = useMemo<Edge[]>(
    () =>
      connections.map((c) => {
        const src = c.source ? nodeRectMap.get(c.source) : undefined;
        const tgt = c.target ? nodeRectMap.get(c.target) : undefined;
        const handles =
          src && tgt
            ? pickHandles(src, tgt)
            : { sourceHandle: "s-bottom", targetHandle: "t-top" };
        const relType = c.relationship_ref ? relationshipTypes.get(c.relationship_ref) : undefined;
        const relName = c.relationship_ref ? relationshipNames.get(c.relationship_ref) : undefined;
        const archiStyle = archimateEdgeStyle(relType);
        const label = c.name || relName || undefined;
        const sourceHandle = c.source_side ? `s-${c.source_side}` : handles.sourceHandle;
        const targetHandle = c.target_side ? `t-${c.target_side}` : handles.targetHandle;
        return {
          id: c.identifier,
          source: c.source ?? "",
          target: c.target ?? "",
          sourceHandle,
          targetHandle,
          type: "archi",
          label,
          animated: Boolean(archiStyle.strokeDasharray),
          reconnectable: true,
          data: { relationshipType: relType, relationshipRef: c.relationship_ref ?? null },
        };
      }),
    [connections, nodeRectMap, relationshipTypes, relationshipNames]
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initialNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(initialEdges);

  const nodeElementRef = (node: Node): string | null => {
    const ref = node.data?.elementRef;
    return typeof ref === "string" ? ref : null;
  };

  const nodeElementRefById = (id: string): string | null => {
    const node = rfNodes.find((n) => n.id === id);
    return node ? nodeElementRef(node) : null;
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (Array.from(e.dataTransfer.types).includes("application/x-archi-element")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!viewId) return;
    const elementId = e.dataTransfer.getData("application/x-archi-element");
    if (!elementId) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const W = 120;
    const H = 60;
    const x = Math.round(position.x - W / 2);
    const y = Math.round(position.y - H / 2);
    createViewNode(viewId, { element_id: elementId, x, y, w: W, h: H })
      .then((created) => {
        const elementType = created.element_ref ? elementTypes.get(created.element_ref) : undefined;
        const label = created.name || (created.element_ref ? elementNames.get(created.element_ref) : undefined) || "";
        setRfNodes((nds) => [
          ...nds,
          {
            id: created.identifier,
            type: "archi",
            position: { x: created.x ?? x, y: created.y ?? y },
            data: { label, elementType, elementRef: created.element_ref ?? null, hasChildren: false },
            style: { width: created.w ?? W, height: created.h ?? H },
          },
        ]);
      })
      .catch((err) => console.error("createViewNode failed", err));
  };

  const onReconnect = (oldEdge: Edge, newConn: Connection) => {
    setRfEdges((eds) => reconnectEdge(oldEdge, newConn, eds));
    if (!viewId) return;
    const body: {
      source?: string;
      target?: string;
      source_side?: "top" | "right" | "bottom" | "left" | null;
      target_side?: "top" | "right" | "bottom" | "left" | null;
    } = {};
    if (newConn.source && newConn.source !== oldEdge.source) body.source = newConn.source;
    if (newConn.target && newConn.target !== oldEdge.target) body.target = newConn.target;
    if (newConn.sourceHandle && newConn.sourceHandle.startsWith("s-")) {
      body.source_side = newConn.sourceHandle.slice(2) as "top" | "right" | "bottom" | "left";
    }
    if (newConn.targetHandle && newConn.targetHandle.startsWith("t-")) {
      body.target_side = newConn.targetHandle.slice(2) as "top" | "right" | "bottom" | "left";
    }
    updateViewConnection(viewId, oldEdge.id, body).catch((err) =>
      console.error("updateViewConnection reconnect failed", err)
    );
  };

  const onNodeDragStop = (_e: unknown, node: Node) => {
    if (!viewId) return;
    updateViewNode(viewId, node.id, { x: Math.round(node.position.x), y: Math.round(node.position.y) }).catch((err) =>
      console.error("updateViewNode drag failed", err)
    );
  };

  const onNodesDelete = (deleted: Node[]) => {
    if (!viewId) return;
    deleted.forEach((n) => {
      deleteViewNode(viewId, n.id).catch((err) => console.error("deleteViewNode failed", err));
    });
  };

  const onEdgesDelete = (deleted: Edge[]) => {
    if (!viewId) return;
    deleted.forEach((e) => {
      deleteViewConnection(viewId, e.id).catch((err) => console.error("deleteViewConnection failed", err));
    });
  };

  const [pendingConnection, setPendingConnection] = useState<{
    source: string;
    target: string;
    sourceElement: string;
    targetElement: string;
    sourceType?: string;
    targetType?: string;
  } | null>(null);

  const onConnect = (params: { source: string | null; target: string | null }) => {
    if (!params.source || !params.target) return;
    const sourceElement = nodeElementRefById(params.source);
    const targetElement = nodeElementRefById(params.target);
    if (!sourceElement || !targetElement) return;
    setPendingConnection({
      source: params.source,
      target: params.target,
      sourceElement,
      targetElement,
      sourceType: elementTypes.get(sourceElement),
      targetType: elementTypes.get(targetElement),
    });
  };

  const confirmRelationshipType = (type: string) => {
    if (!pendingConnection || !viewId) return;
    const { source, target, sourceElement, targetElement } = pendingConnection;
    setPendingConnection(null);
    createRelationship({ type, source: sourceElement, target: targetElement })
      .then((rel) =>
        createViewConnection(viewId, { relationship_id: rel.identifier, source, target }).then((conn) => ({ rel, conn }))
      )
      .then(({ rel, conn }) => {
        const archi = archimateEdgeStyle(rel.type);
        setRfEdges((eds) => [
          ...eds,
          {
            id: conn.identifier,
            source,
            target,
            type: "archi",
            animated: Boolean(archi.strokeDasharray),
            data: { relationshipType: rel.type, relationshipRef: rel.identifier },
          },
        ]);
      })
      .catch((err) => console.error("create relationship+connection failed", err));
  };

  const onEdgeDoubleClick = (_e: unknown, edge: Edge) => {
    if (!viewId) return;
    const next = window.prompt("Étiquette de la liaison :", typeof edge.label === "string" ? edge.label : "");
    if (next === null) return;
    updateViewConnection(viewId, edge.id, { name: next || null })
      .then(() => {
        setRfEdges((eds) => eds.map((e) => (e.id === edge.id ? { ...e, label: next || undefined } : e)));
      })
      .catch((err) => console.error("updateViewConnection failed", err));
  };

  const onNodeDoubleClick = (_e: unknown, node: Node) => {
    if (!viewId) return;
    const currentLabel = typeof node.data?.label === "string" ? (node.data.label as string) : "";
    const next = window.prompt("Nom du nœud (override de la vue) :", currentLabel);
    if (next === null) return;
    updateViewNode(viewId, node.id, { name: next || null })
      .then(() => {
        setRfNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: next } } : n)));
      })
      .catch((err) => console.error("updateViewNode failed", err));
  };

  useEffect(() => {
    setRfNodes(initialNodes);
  }, [initialNodes, setRfNodes]);

  useEffect(() => {
    setRfEdges(initialEdges);
  }, [initialEdges, setRfEdges]);

  return (
    <ViewIdContext.Provider value={viewId}>
    <div style={{ width: "100%", height: 600, position: "relative", display: "flex" }}>
      {viewId ? <ElementPalette elements={elements} /> : null}
      <div style={{ flex: 1, position: "relative" }} onDragOver={onDragOver} onDrop={onDrop}>
      {MARKER_DEFS}
      {pendingConnection ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setPendingConnection(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card, #fff)",
              color: "var(--card-foreground, #0a0a0a)",
              border: "1px solid var(--border, #e5e5e5)",
              borderRadius: 8,
              padding: 16,
              minWidth: 280,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Type ArchiMate
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground, #666)", marginBottom: 10 }}>
              {pendingConnection.sourceType ?? "?"} → {pendingConnection.targetType ?? "?"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {allowedRelationships(pendingConnection.sourceType, pendingConnection.targetType).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => confirmRelationshipType(t)}
                  style={{
                    padding: "6px 10px",
                    fontSize: 12,
                    background: "var(--secondary, #f5f5f5)",
                    color: "var(--secondary-foreground, #0a0a0a)",
                    border: "1px solid var(--border, #e5e5e5)",
                    borderRadius: 4,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setPendingConnection(null)}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  background: "transparent",
                  color: "var(--muted-foreground, #666)",
                  border: "1px solid var(--border, #e5e5e5)",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        nodesDraggable
        nodesConnectable
        deleteKeyCode={["Backspace", "Delete"]}
        colorMode="system"
      >
        <Background />
        <Controls />
        <Panel position="top-right">
          <DownloadButton />
        </Panel>
      </ReactFlow>
      </div>
    </div>
    </ViewIdContext.Provider>
  );
}
