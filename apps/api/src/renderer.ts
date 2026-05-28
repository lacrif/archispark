/**
 * SVG (and optionally PNG) renderer for ArchiMate views.
 *
 * renderViewToSvg  – pure string generation, no runtime dependencies
 * renderViewToPng  – requires the optional "sharp" package
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { ArchiView, ArchiNode, ArchiModel } from "@workspace/db";

const _srcDir = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(_srcDir, "..", "public", "images", "archimate");

// ---------------------------------------------------------------------------
// PNG icon loader (lazy, cached)
// ---------------------------------------------------------------------------

const _iconCache = new Map<string, string | null>();

function _typeToKebab(type: string): string {
  return type.replace(/([A-Z])/g, (m, _, i) => (i > 0 ? `-${m.toLowerCase()}` : m.toLowerCase()));
}

function loadIconDataUri(type: string): string | null {
  if (_iconCache.has(type)) return _iconCache.get(type) ?? null;
  const file = join(ICONS_DIR, `${_typeToKebab(type)}.png`);
  try {
    if (existsSync(file)) {
      const b64 = readFileSync(file).toString("base64");
      const uri = `data:image/png;base64,${b64}`;
      _iconCache.set(type, uri);
      return uri;
    }
  } catch { /* ignore */ }
  _iconCache.set(type, null);
  return null;
}

// ---------------------------------------------------------------------------
// ArchiMate layer default fill colours
// ---------------------------------------------------------------------------

// Colors from Archi source: AbstractArchimateElementUIProvider.java
// Business: new Color(255,255,181), Application: new Color(181,255,255), Technology: new Color(201,231,183)
// Motivation: new Color(204,204,255), Strategy: new Color(245,222,170), ImplMigration: new Color(255,224,224)
// Grouping: new Color(255,255,255), Location: new Color(237,207,226)
const ELEMENT_FILL: Record<string, string> = {
  // Business Layer
  BusinessActor: "#FFFFB5", BusinessRole: "#FFFFB5", BusinessCollaboration: "#FFFFB5",
  BusinessInterface: "#FFFFB5", BusinessProcess: "#FFFFB5", BusinessFunction: "#FFFFB5",
  BusinessInteraction: "#FFFFB5", BusinessEvent: "#FFFFB5", BusinessService: "#FFFFB5",
  BusinessObject: "#FFFFB5", Contract: "#FFFFB5", Representation: "#FFFFB5", Product: "#FFFFB5",
  // Application Layer
  ApplicationComponent: "#B5FFFF", ApplicationCollaboration: "#B5FFFF",
  ApplicationInterface: "#B5FFFF", ApplicationFunction: "#B5FFFF",
  ApplicationInteraction: "#B5FFFF", ApplicationProcess: "#B5FFFF",
  ApplicationEvent: "#B5FFFF", ApplicationService: "#B5FFFF", DataObject: "#B5FFFF",
  // Technology Layer (physical elements share the same default color in Archi)
  Node: "#C9E7B7", Device: "#C9E7B7", SystemSoftware: "#C9E7B7",
  TechnologyCollaboration: "#C9E7B7", TechnologyInterface: "#C9E7B7",
  Path: "#C9E7B7", CommunicationNetwork: "#C9E7B7", TechnologyFunction: "#C9E7B7",
  TechnologyProcess: "#C9E7B7", TechnologyInteraction: "#C9E7B7",
  TechnologyEvent: "#C9E7B7", TechnologyService: "#C9E7B7", Artifact: "#C9E7B7",
  // Physical Layer (uses defaultTechnologyColor in Archi)
  Equipment: "#C9E7B7", Facility: "#C9E7B7", DistributionNetwork: "#C9E7B7", Material: "#C9E7B7",
  // Motivation
  Stakeholder: "#CCCCFF", Driver: "#CCCCFF", Assessment: "#CCCCFF", Goal: "#CCCCFF",
  Outcome: "#CCCCFF", Principle: "#CCCCFF", Requirement: "#CCCCFF", Constraint: "#CCCCFF",
  Meaning: "#CCCCFF", Value: "#CCCCFF",
  // Strategy
  Resource: "#F5DEAA", Capability: "#F5DEAA", CourseOfAction: "#F5DEAA", ValueStream: "#F5DEAA",
  // Implementation & Migration
  WorkPackage: "#FFE0E0", Deliverable: "#FFE0E0", ImplementationEvent: "#FFE0E0",
  Plateau: "#FFE0E0", Gap: "#FFE0E0",
  // Composites
  Grouping: "#FFFFFF", Location: "#EDCFE2",
  AndJunction: "#000000", OrJunction: "#000000",
};

// ---------------------------------------------------------------------------
// Relationship line styles
// ---------------------------------------------------------------------------

interface RelLineStyle {
  dashArray: string | null;
  markerStart: string | null;
  markerEnd: string | null;
}

const REL_LINE: Record<string, RelLineStyle> = {
  Composition:    { dashArray: null,  markerStart: "url(#diamond-filled)", markerEnd: null },
  Aggregation:    { dashArray: null,  markerStart: "url(#diamond-open)",   markerEnd: null },
  Assignment:     { dashArray: null,  markerStart: "url(#circle-solid)",   markerEnd: "url(#arrow-open)" },
  Realization:    { dashArray: "6,3", markerStart: null,                   markerEnd: "url(#arrow-hollow)" },
  Serving:        { dashArray: null,  markerStart: null,                   markerEnd: "url(#arrow-open)" },
  Access:         { dashArray: "4,3", markerStart: null,                   markerEnd: "url(#arrow-open)" },
  Influence:      { dashArray: "6,3", markerStart: null,                   markerEnd: "url(#arrow-open)" },
  Triggering:     { dashArray: null,  markerStart: null,                   markerEnd: "url(#arrow-filled)" },
  Flow:           { dashArray: "6,3", markerStart: null,                   markerEnd: "url(#arrow-filled)" },
  Specialization: { dashArray: null,  markerStart: null,                   markerEnd: "url(#arrow-hollow)" },
  Association:    { dashArray: null,  markerStart: null,                   markerEnd: null },
};

const DEFAULT_REL_LINE: RelLineStyle = { dashArray: null, markerStart: null, markerEnd: "url(#arrow-open)" };

// ---------------------------------------------------------------------------
// Node geometry. Per ArchiMate Open Exchange XSD (archimate3_Diagram.xsd),
// every node's x/y is measured "from the Top,Left (i.e. 0,0) corner of the
// diagram", so child coords are absolute, not parent-relative.
// ---------------------------------------------------------------------------

interface NodeGeom {
  node: ArchiNode;
  absX: number;
  absY: number;
  absW: number;
  absH: number;
  depth: number;
}

function collectNodes(
  nodes: ArchiNode[],
  _offsetX: number,
  _offsetY: number,
  depth: number,
  out: Map<string, NodeGeom>
): void {
  for (const n of nodes) {
    const x = n.x ?? 0;
    const y = n.y ?? 0;
    const w = n.w ?? 120;
    const h = n.h ?? 55;
    out.set(n.uuid, { node: n, absX: x, absY: y, absW: w, absH: h, depth });
    collectNodes(n.nodes, 0, 0, depth + 1, out);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rgbStr(c: { r: number; g: number; b: number } | null | undefined): string | null {
  if (!c) return null;
  return `rgb(${c.r},${c.g},${c.b})`;
}

// Archi's derived line color: fill_color × 0.7 (see ColorFactory.getDerivedLineColor)
function derivedLineColor(fill: string): string {
  let r = 0, g = 0, b = 0;
  if (fill.startsWith("#") && fill.length === 7) {
    r = parseInt(fill.slice(1, 3), 16);
    g = parseInt(fill.slice(3, 5), 16);
    b = parseInt(fill.slice(5, 7), 16);
  } else {
    const m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(fill);
    if (m) { r = +m[1]!; g = +m[2]!; b = +m[3]!; }
  }
  return `rgb(${Math.floor(r * 0.7)},${Math.floor(g * 0.7)},${Math.floor(b * 0.7)})`;
}

function nodeType(n: ArchiNode): string {
  if (!n.ref || typeof n.ref === "string") return "Grouping";
  return n.ref.type || "Grouping";
}

function nodeName(n: ArchiNode): string {
  if (n.name) return n.name;
  if (!n.ref || typeof n.ref === "string") return "";
  return n.ref.name || "";
}

function wrapText(text: string, maxChars: number): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    if (cur.length > 0 && cur.length + 1 + word.length > maxChars) {
      lines.push(cur);
      cur = word;
    } else {
      cur = cur.length > 0 ? `${cur} ${word}` : word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Point on the boundary of rect (rx,ry,rw,rh) closest to the line coming from (fx,fy)
function rectEdge(
  fx: number, fy: number,
  rx: number, ry: number, rw: number, rh: number
): { x: number; y: number } {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const dx = cx - fx;
  const dy = cy - fy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy };
  const hw = rw / 2;
  const hh = rh / 2;
  const sx = Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Infinity;
  const sy = Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx - dx * s, y: cy - dy * s };
}

// Orthogonal (Manhattan) route when no bendpoints are stored.
// Matches Archi's default router: use x-overlap or y-overlap midpoint for
// straight segments; L-shape when no overlap.
// Returns [start, ...intermediates, end] as absolute SVG points.
function _orthogonalRoute(
  sx: number, sy: number, sw: number, sh: number,
  tx: number, ty: number, tw: number, th: number,
): Array<{ x: number; y: number }> {
  const scy = sy + sh / 2;
  const scx = sx + sw / 2;
  const tcx = tx + tw / 2;
  const tcy = ty + th / 2;
  const dy = tcy - scy;
  const dx = tcx - scx;

  // X-overlap → straight vertical line at the midpoint of the shared x-band
  const xOvL = Math.max(sx, tx);
  const xOvR = Math.min(sx + sw, tx + tw);
  if (xOvL < xOvR) {
    const midX  = (xOvL + xOvR) / 2;
    const startY = dy < 0 ? sy : sy + sh;       // exit top if target above
    const endY   = dy < 0 ? ty + th : ty;       // enter bottom if target above
    return [{ x: midX, y: startY }, { x: midX, y: endY }];
  }

  // Y-overlap → straight horizontal line at the midpoint of the shared y-band
  const yOvT = Math.max(sy, ty);
  const yOvB = Math.min(sy + sh, ty + th);
  if (yOvT < yOvB) {
    const midY  = (yOvT + yOvB) / 2;
    const startX = dx < 0 ? sx : sx + sw;       // exit left if target to left
    const endX   = dx < 0 ? tx + tw : tx;
    return [{ x: startX, y: midY }, { x: endX, y: midY }];
  }

  // No overlap → L-shape.  Prefer vertical-first when |dy| > |dx|.
  if (Math.abs(dy) > Math.abs(dx)) {
    const startY = dy < 0 ? sy : sy + sh;
    const endX   = dx < 0 ? tx + tw : tx;
    return [
      { x: scx,  y: startY },
      { x: scx,  y: tcy },
      { x: endX, y: tcy },
    ];
  } else {
    const startX = dx < 0 ? sx : sx + sw;
    const endY   = dy < 0 ? ty + th : ty;
    return [
      { x: startX, y: scy },
      { x: tcx,    y: scy },
      { x: tcx,    y: endY },
    ];
  }
}

// ---------------------------------------------------------------------------
// Shape category detection (based on Archi Java figure classes)
// ---------------------------------------------------------------------------

type ShapeKind =
  | "junction"     // And/OrJunction — circle
  | "grouping"     // Grouping — dashed rect
  | "service"      // *Service — rounded pill (ServiceFigureDelegate)
  | "event"        // *Event — chevron (EventFigure)
  | "component"    // ApplicationComponent — rect with nubs
  | "collaboration"// *Collaboration — two overlapping circles
  | "interface"    // *Interface — circle
  | "function"     // *Function — hexagon (FunctionFigure)
  | "process"      // *Process — right-arrow (ProcessFigureDelegate)
  | "interaction"  // *Interaction — two overlapping ellipses (InteractionFigure)
  | "data-object"  // DataObject / BusinessObject / Artifact — rect with header line
  | "rect";        // default — plain rectangle

function getShapeKind(type: string, archiType: number = 0): ShapeKind {
  if (type === "AndJunction" || type === "OrJunction") return "junction";
  if (type === "Grouping") return "grouping";
  if (type === "DataObject" || type === "BusinessObject" || type === "Artifact") return "data-object";
  if (archiType !== 1) return "rect";
  if (type.endsWith("Service")) return "service";
  if (type.endsWith("Event") || type === "ImplementationEvent") return "event";
  if (type === "ApplicationComponent") return "component";
  if (type.endsWith("Collaboration")) return "collaboration";
  if (type.endsWith("Interface")) return "interface";
  if (type.endsWith("Function")) return "function";
  if (type.endsWith("Process")) return "process";
  if (type.endsWith("Interaction")) return "interaction";
  return "rect";
}

// ---------------------------------------------------------------------------
// Shape SVG generators
// Each returns an array of SVG element strings.
// All coordinates are already in absolute SVG space.
// ---------------------------------------------------------------------------

const ICON_SIZE = 16;   // px for embedded icons
const ICON_PAD = 4;     // padding from right/top edge
const DATA_HEADER = 14; // px for data-object header line

interface ShapeOut {
  svg: string[];            // shape + fill SVG elements
  textX: number;            // center x for the label
  textY: number;            // center y for the label
  textW: number;            // available width for text wrap
  textH: number;            // available height for text
  iconX: number | null;     // icon top-left x (null = no icon)
  iconY: number | null;     // icon top-left y
}

function shapeRect(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string, lw: number,
  rx = 2
): ShapeOut {
  const svg = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`,
  ];
  return {
    svg,
    textX: x + w / 2,
    textY: y + h / 2,
    textW: w - ICON_SIZE - ICON_PAD * 2 - 4,
    textH: h,
    iconX: x + w - ICON_SIZE - ICON_PAD,
    iconY: y + ICON_PAD,
  };
}

function shapeGrouping(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string, lw: number,
  _FONT: string
): { svg: string[]; nameY: number } {
  return {
    svg: [
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="${lw}" stroke-dasharray="6,4"/>`,
    ],
    nameY: y + 14,
  };
}

// Pill/stadium shape (Service) — rx/ry = half the shorter side
function shapeService(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string, lw: number
): ShapeOut {
  const arc = Math.min(h / 2, w * 0.4);
  const svg = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${arc}" ry="${arc}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`,
  ];
  return {
    svg,
    textX: x + w / 2,
    textY: y + h / 2,
    textW: w - arc * 2 - ICON_SIZE - ICON_PAD * 2,
    textH: h,
    iconX: x + w - ICON_SIZE - ICON_PAD - arc / 2,
    iconY: y + ICON_PAD,
  };
}

// Chevron/event shape — left notch, right arc cap
function shapeEvent(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string, lw: number
): ShapeOut {
  const indent = Math.min(h / 3, w / 3);
  const cx = x + w - indent; // x where arc cap starts
  const cy = y + h / 2;
  // SVG path: top-left → notch-point → bottom-left → bottom-right → arc-top → close
  const d =
    `M ${x},${y} ` +
    `L ${x + indent},${cy} ` +
    `L ${x},${y + h} ` +
    `L ${cx},${y + h} ` +
    `A ${indent},${h / 2} 0 0 1 ${cx},${y} ` +
    `Z`;
  const svg = [`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`];
  return {
    svg,
    textX: x + indent + (w - indent * 2) / 2,
    textY: cy,
    textW: w - indent * 2 - ICON_SIZE - ICON_PAD * 2,
    textH: h,
    iconX: x + w - ICON_SIZE - ICON_PAD - indent / 2,
    iconY: y + ICON_PAD,
  };
}

// ApplicationComponent — rectangle with two nubs on the left side
function shapeComponent(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string, lw: number
): ShapeOut {
  const INDENT = 12;   // nub protrusion
  const NUB_W = INDENT * 2;
  const NUB_H = Math.max(10, Math.min(13, h / 5));
  const nub1Y = y + Math.max(8, h / 5);
  const nub2Y = nub1Y + NUB_H * 1.8;

  // Main body (shifted right by INDENT)
  const bodyX = x + INDENT;
  const bodyW = w - INDENT;

  const svg = [
    // Main rectangle body
    `<rect x="${bodyX}" y="${y}" width="${bodyW}" height="${h}" rx="1" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`,
    // Nub 1 (upper)
    `<rect x="${x}" y="${nub1Y}" width="${NUB_W}" height="${NUB_H}" rx="1" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`,
    // Nub 2 (lower)
    `<rect x="${x}" y="${nub2Y}" width="${NUB_W}" height="${NUB_H}" rx="1" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`,
  ];
  return {
    svg,
    textX: bodyX + bodyW / 2,
    textY: y + h / 2,
    textW: bodyW - ICON_SIZE - ICON_PAD * 2 - 4,
    textH: h,
    iconX: bodyX + bodyW - ICON_SIZE - ICON_PAD,
    iconY: y + ICON_PAD,
  };
}

// Collaboration — two overlapping circles
function shapeCollaboration(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string, lw: number
): ShapeOut {
  const diameter = Math.min(h * 0.85, (w / 3) * 2);
  const cy = y + (h - diameter) / 2;
  // x1 centered slightly left, x2 = x1 + diameter/2
  const x1 = x + (w - diameter * 1.5) / 2;
  const x2 = x1 + diameter / 2;
  const svg = [
    `<ellipse cx="${x1 + diameter / 2}" cy="${cy + diameter / 2}" rx="${diameter / 2}" ry="${diameter / 2}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`,
    `<ellipse cx="${x2 + diameter / 2}" cy="${cy + diameter / 2}" rx="${diameter / 2}" ry="${diameter / 2}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`,
  ];
  return {
    svg,
    textX: x + w / 2,
    textY: y + h / 2,
    textW: w - 8,
    textH: h - diameter - 4,
    iconX: x + w - ICON_SIZE - ICON_PAD,
    iconY: y + ICON_PAD,
  };
}

// Interface — single circle
function shapeInterface(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string, lw: number
): ShapeOut {
  const diameter = Math.min(w, h) * 0.85;
  const cx = x + w / 2;
  const cy = y + (h - diameter) / 2 + diameter / 2;
  const svg = [
    `<circle cx="${cx}" cy="${cy}" r="${diameter / 2}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`,
  ];
  return {
    svg,
    textX: x + w / 2,
    textY: y + h - (h - diameter) / 4,
    textW: w - 8,
    textH: (h - diameter) / 2,
    iconX: x + w - ICON_SIZE - ICON_PAD,
    iconY: y + ICON_PAD,
  };
}

// Function — hexagon (top-peak, bottom-notch)
function shapeFunction(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string, lw: number
): ShapeOut {
  const OFFSET = 5; // fraction denominator
  const y1 = y + h / OFFSET;
  const y2 = y + h - h / OFFSET;
  const cx = x + w / 2;
  const d =
    `M ${x},${y + h} ` +
    `L ${x},${y1} ` +
    `L ${cx},${y} ` +
    `L ${x + w},${y1} ` +
    `L ${x + w},${y + h} ` +
    `L ${cx},${y2} ` +
    `Z`;
  const svg = [`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`];
  return {
    svg,
    textX: cx,
    textY: y + h / 2,
    textW: w - ICON_SIZE - ICON_PAD * 2 - 4,
    textH: h - h / OFFSET * 2,
    iconX: x + w - ICON_SIZE - ICON_PAD,
    iconY: y + h / OFFSET + ICON_PAD,
  };
}

// Process — right-pointing arrow shape
function shapeProcess(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string, lw: number
): ShapeOut {
  const x1 = x + w * 0.7;
  const y1 = y + h / 5;
  const y2 = y + h - h / 5;
  const d =
    `M ${x},${y1} ` +
    `L ${x1},${y1} ` +
    `L ${x1},${y} ` +
    `L ${x + w},${y + h / 2} ` +
    `L ${x1},${y + h} ` +
    `L ${x1},${y2} ` +
    `L ${x},${y2} ` +
    `Z`;
  const svg = [`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`];
  return {
    svg,
    textX: (x + x1) / 2,
    textY: y + h / 2,
    textW: x1 - x - ICON_SIZE - ICON_PAD * 2,
    textH: h - h / 5 * 2,
    iconX: x + w * 0.7 - ICON_SIZE - ICON_PAD,
    iconY: y + h / 5 + ICON_PAD,
  };
}

// Interaction — two overlapping filled ellipses (Venn-like)
function shapeInteraction(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string, lw: number
): ShapeOut {
  const FRACTION = 0.86;
  let diameter: number;
  let x1: number;
  let x2: number;
  if (w <= h) {
    diameter = w * FRACTION;
    x1 = x + (w - diameter) / 2;
    x2 = x + w - (w - diameter) / 2;
  } else {
    diameter = Math.min(h, w * 0.85);
    x1 = x + (w - diameter) / 2 - diameter * (1 - FRACTION) / 2;
    x2 = x1 + diameter * FRACTION;
  }
  const ey = y + (h - diameter) / 2;
  const svg = [
    // Left half-ellipse
    `<path d="M ${x1 + diameter / 2},${ey} A ${diameter / 2},${diameter / 2} 0 0 0 ${x1 + diameter / 2},${ey + diameter} Z" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`,
    // Right half-ellipse
    `<path d="M ${x2 + diameter / 2},${ey} A ${diameter / 2},${diameter / 2} 0 0 1 ${x2 + diameter / 2},${ey + diameter} Z" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`,
  ];
  return {
    svg,
    textX: x + w / 2,
    textY: y + h / 2,
    textW: w - 8,
    textH: h,
    iconX: x + w - ICON_SIZE - ICON_PAD,
    iconY: y + ICON_PAD,
  };
}

// DataObject/BusinessObject — rectangle with a header line at the top
function shapeDataObject(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string, lw: number
): ShapeOut {
  const svg = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`,
    `<line x1="${x}" y1="${y + DATA_HEADER}" x2="${x + w}" y2="${y + DATA_HEADER}" ` +
    `stroke="${stroke}" stroke-width="${lw}"/>`,
  ];
  return {
    svg,
    textX: x + w / 2,
    textY: y + DATA_HEADER + (h - DATA_HEADER) / 2,
    textW: w - ICON_SIZE - ICON_PAD * 2 - 4,
    textH: h - DATA_HEADER,
    iconX: x + w - ICON_SIZE - ICON_PAD,
    iconY: y + ICON_PAD,
  };
}

// ---------------------------------------------------------------------------
// SVG marker defs (arrows, diamonds, circle)
// ---------------------------------------------------------------------------

const SVG_DEFS = `  <defs>
    <marker id="arrow-open" markerWidth="9" markerHeight="8" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L8,3.5 L0,7" fill="none" stroke="#000" stroke-width="1.2"/>
    </marker>
    <marker id="arrow-filled" markerWidth="9" markerHeight="8" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L8,3.5 L0,7 Z" fill="#000" stroke="none"/>
    </marker>
    <marker id="arrow-hollow" markerWidth="11" markerHeight="9" refX="10" refY="4" orient="auto">
      <path d="M0,0 L9,4 L0,8 Z" fill="white" stroke="#000" stroke-width="1.2"/>
    </marker>
    <marker id="diamond-filled" markerWidth="12" markerHeight="8" refX="0" refY="4" orient="auto-start-reverse">
      <path d="M0,4 L5,0 L10,4 L5,8 Z" fill="#000" stroke="#000" stroke-width="0.5"/>
    </marker>
    <marker id="diamond-open" markerWidth="12" markerHeight="8" refX="0" refY="4" orient="auto-start-reverse">
      <path d="M0,4 L5,0 L10,4 L5,8 Z" fill="white" stroke="#000" stroke-width="1"/>
    </marker>
    <marker id="circle-solid" markerWidth="7" markerHeight="7" refX="0" refY="3.5" orient="auto-start-reverse">
      <circle cx="3.5" cy="3.5" r="3" fill="#000" stroke="#000"/>
    </marker>
  </defs>`;

// ---------------------------------------------------------------------------
// Main export: SVG renderer
// ---------------------------------------------------------------------------

export function renderViewToSvg(view: ArchiView, model: ArchiModel): string {
  const PADDING = 10;
  const FONT = "Arial,Helvetica,sans-serif";

  // Build relationship lookup (id → type, name)
  const relTypeMap = new Map<string, string>(
    model.relationships.map((r) => [r.uuid, r.type])
  );
  const relNameMap = new Map<string, string | null>(
    model.relationships.map((r) => [r.uuid, r.name])
  );

  // Build flat node geometry map
  const geomMap = new Map<string, NodeGeom>();
  collectNodes(view.nodes, 0, 0, 0, geomMap);

  // Bounding box of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const g of geomMap.values()) {
    minX = Math.min(minX, g.absX);
    minY = Math.min(minY, g.absY);
    maxX = Math.max(maxX, g.absX + g.absW);
    maxY = Math.max(maxY, g.absY + g.absH);
  }
  if (geomMap.size === 0) { minX = 0; minY = 0; maxX = 400; maxY = 250; }

  const ox = PADDING - minX;
  const oy = PADDING - minY;
  const totalW = maxX - minX + PADDING * 2;
  const totalH = maxY - minY + PADDING * 2;

  // Build visual parent-child pairs (to suppress Composition arrows for nested nodes)
  const visualChildPairs = new Set<string>();
  function collectChildPairs(nodes: ArchiNode[], parentId: string | null): void {
    for (const n of nodes) {
      if (parentId) visualChildPairs.add(`${parentId}→${n.uuid}`);
      collectChildPairs(n.nodes, n.uuid);
    }
  }
  collectChildPairs(view.nodes, null);

  // Sort: Groupings first, then by depth (parents before children)
  const geomList = [...geomMap.values()].sort((a, b) => {
    const ag = nodeType(a.node) === "Grouping" ? 0 : 1;
    const bg = nodeType(b.node) === "Grouping" ? 0 : 1;
    if (ag !== bg) return ag - bg;
    return a.depth - b.depth;
  });

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`);
  out.push(`<title>${escXml(view.name)}</title>`);
  out.push(SVG_DEFS);
  out.push(`<rect width="${totalW}" height="${totalH}" fill="white"/>`);

  // Nodes
  for (const g of geomList) {
    const { node, absX, absY, absW, absH } = g;
    const x = absX + ox;
    const y = absY + oy;
    const type = nodeType(node);
    const name = nodeName(node);
    const fill = rgbStr(node.fill_color) ?? ELEMENT_FILL[type] ?? "#F5F5F5";
    const stroke = rgbStr(node.line_color) ?? derivedLineColor(fill);
    const lw = node.line_width ?? 1;
    const fontColor = rgbStr(node.font_color) ?? "#000000";
    const fontSize = node.font_size ?? 11;
    const fontName = node.font_name ?? FONT;

    const kind = getShapeKind(type, node.archi_type ?? 0);

    // Junctions — circle
    if (kind === "junction") {
      const r = Math.min(absW, absH) / 2;
      const cx = x + absW / 2;
      const cy = y + absH / 2;
      out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`);
      if (type === "OrJunction") {
        out.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="white" stroke="${stroke}" stroke-width="${lw}"/>`);
      }
      continue;
    }

    // Grouping — dashed rect + name top-left + icon top-right
    if (kind === "grouping") {
      const { svg, nameY } = shapeGrouping(x, y, absW, absH, fill, stroke, lw, FONT);
      out.push(...svg);
      const groupingIcon = loadIconDataUri(type);
      if (groupingIcon) {
        out.push(
          `<image href="${groupingIcon}" x="${(x + absW - ICON_SIZE - ICON_PAD).toFixed(1)}" ` +
          `y="${(y + ICON_PAD).toFixed(1)}" width="${ICON_SIZE}" height="${ICON_SIZE}"/>`
        );
      }
      if (name) {
        out.push(
          `<text x="${x + 5}" y="${nameY}" font-family="${FONT}" font-size="11" ` +
          `font-style="italic" fill="#444">${escXml(name)}</text>`
        );
      }
      continue;
    }

    // All other shapes
    let shape: ShapeOut;
    switch (kind) {
      case "service":      shape = shapeService(x, y, absW, absH, fill, stroke, lw); break;
      case "event":        shape = shapeEvent(x, y, absW, absH, fill, stroke, lw); break;
      case "component":    shape = shapeComponent(x, y, absW, absH, fill, stroke, lw); break;
      case "collaboration":shape = shapeCollaboration(x, y, absW, absH, fill, stroke, lw); break;
      case "interface":    shape = shapeInterface(x, y, absW, absH, fill, stroke, lw); break;
      case "function":     shape = shapeFunction(x, y, absW, absH, fill, stroke, lw); break;
      case "process":      shape = shapeProcess(x, y, absW, absH, fill, stroke, lw); break;
      case "interaction":  shape = shapeInteraction(x, y, absW, absH, fill, stroke, lw); break;
      case "data-object":  shape = shapeDataObject(x, y, absW, absH, fill, stroke, lw); break;
      default:             shape = shapeRect(x, y, absW, absH, fill, stroke, lw); break;
    }

    out.push(...shape.svg);

    // PNG icon for box-mode shapes; specialized icon-mode shapes are the notation
    const iconUri = (kind === "rect" || kind === "data-object") ? loadIconDataUri(type) : null;
    if (iconUri && shape.iconX !== null && shape.iconY !== null) {
      out.push(
        `<image href="${iconUri}" x="${shape.iconX.toFixed(1)}" y="${shape.iconY.toFixed(1)}" ` +
        `width="${ICON_SIZE}" height="${ICON_SIZE}"/>`
      );
    }

    // Name label — top when container has nested children, centered otherwise
    if (name) {
      const availW = shape.textW > 0 ? shape.textW : absW - 8;
      const maxChars = Math.max(4, Math.floor(availW / (fontSize * 0.58)));
      const lines = wrapText(name, maxChars);
      const lineH = fontSize + 3;
      const textBlock = lines.length * lineH;
      const hasChildren = node.nodes.length > 0;
      const startY = hasChildren
        ? y + fontSize + 4
        : shape.textY - textBlock / 2 + fontSize;
      for (let i = 0; i < lines.length; i++) {
        out.push(
          `<text x="${shape.textX.toFixed(1)}" y="${(startY + i * lineH).toFixed(1)}" ` +
          `font-family="${fontName}" font-size="${fontSize}" ` +
          `text-anchor="middle" fill="${fontColor}">${escXml(lines[i]!)}</text>`
        );
      }
    }
  }

  // Connections
  for (const conn of view.conns) {
    if (!conn.source || !conn.target) continue;
    const srcG = geomMap.get(conn.source);
    const tgtG = geomMap.get(conn.target);
    if (!srcG || !tgtG) continue;

    const relType = conn.ref ? (relTypeMap.get(conn.ref) ?? "Association") : "Association";

    // Skip structural relations when target is visually nested inside source —
    // Archi shows nesting via containment, not a redundant arrow.
    const NESTED_SUPPRESSED = new Set(["Composition", "Aggregation", "Assignment", "Realization", "Access"]);
    if (
      NESTED_SUPPRESSED.has(relType) &&
      visualChildPairs.has(`${conn.source}→${conn.target}`)
    ) continue;

    const sx = srcG.absX + ox, sy = srcG.absY + oy;
    const tx = tgtG.absX + ox, ty = tgtG.absY + oy;
    const srcCx = sx + srcG.absW / 2, srcCy = sy + srcG.absH / 2;
    const tgtCx = tx + tgtG.absW / 2, tgtCy = ty + tgtG.absH / 2;

    const style = REL_LINE[relType] ?? DEFAULT_REL_LINE;
    const lineColor = rgbStr(conn.line_color) ?? "#000000";
    const lw = conn.line_width ?? 1;

    const dashAttr = style.dashArray ? ` stroke-dasharray="${style.dashArray}"` : "";
    const msAttr   = style.markerStart ? ` marker-start="${style.markerStart}"` : "";
    const meAttr   = style.markerEnd   ? ` marker-end="${style.markerEnd}"`     : "";

    // Build waypoints using bendpoints (Archi: offsets from src/tgt centers)
    const waypoints: Array<{ x: number; y: number }> = [];
    for (const bp of conn.bendpoints ?? []) {
      waypoints.push({ x: bp.x, y: bp.y });
    }
    void srcCx; void srcCy; void tgtCx; void tgtCy;

    let allPts: Array<{ x: number; y: number }>;
    if (waypoints.length === 0) {
      const start = rectEdge(tgtCx, tgtCy, sx, sy, srcG.absW, srcG.absH);
      const end   = rectEdge(srcCx, srcCy, tx, ty, tgtG.absW, tgtG.absH);
      allPts = [start, end];
    } else {
      const firstWp = waypoints[0]!;
      const lastWp  = waypoints[waypoints.length - 1]!;
      const start = rectEdge(firstWp.x, firstWp.y, sx, sy, srcG.absW, srcG.absH);
      const end   = rectEdge(lastWp.x,  lastWp.y,  tx, ty, tgtG.absW, tgtG.absH);
      allPts = [start, ...waypoints, end];
    }
    const pointsAttr = allPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    out.push(
      `<polyline points="${pointsAttr}" fill="none" ` +
      `stroke="${lineColor}" stroke-width="${lw}"${dashAttr}${msAttr}${meAttr}/>`
    );

    // Label: prefer connection name, fall back to relationship name
    const label = conn.name ?? (conn.ref ? (relNameMap.get(conn.ref) ?? null) : null);
    if (label) {
      const midIdx = Math.floor((allPts.length - 1) / 2);
      const p1 = allPts[midIdx]!;
      const p2 = allPts[midIdx + 1] ?? p1;
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2 - 4;
      out.push(
        `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-family="${FONT}" font-size="9" ` +
        `text-anchor="middle" fill="#555" font-style="italic">${escXml(label)}</text>`
      );
    }
  }

  out.push("</svg>");
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// PNG export (requires optional "sharp" package)
// ---------------------------------------------------------------------------

export async function renderViewToPng(view: ArchiView, model: ArchiModel): Promise<Buffer> {
  let sharpFn: (input: Buffer) => { png(): { toBuffer(): Promise<Buffer> } };
  try {
    const mod = await import("sharp");
    sharpFn = mod.default as typeof sharpFn;
  } catch {
    throw new Error(
      "PNG generation requires the 'sharp' package. Install it with: npm install sharp"
    );
  }
  const svg = renderViewToSvg(view, model);
  return sharpFn(Buffer.from(svg)).png().toBuffer();
}
