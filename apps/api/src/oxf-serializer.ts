/**
 * Serializer for ArchiModel → ArchiMate 3.1 Open Exchange File format XML.
 * Inverse of oxf-parser.ts.
 *
 * Rebuilds <elements>, <relationships>, <views> from the in-memory ArchiModel.
 * Preserves <metadata>, <propertyDefinitions>, <organizations>, <viewpoints>
 * subtrees from `_raw` when present (lossless round-trip for those sections).
 */

import { writeFileSync } from "fs";
import type {
  ArchiModel,
  ArchiElement,
  ArchiRelationship,
  ArchiView,
  ArchiColor,
  ArchiConnection,
  ArchiNode,
} from "@workspace/db";

type XmlNode = Record<string, unknown>;

const NS = "http://www.opengroup.org/xsd/archimate/3.0/";
const XSI = "http://www.w3.org/2001/XMLSchema-instance";

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensureArr<T>(value: unknown): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

// ---------------------------------------------------------------------------
// Manual XML building helpers (preserve order of top-level sections)
// ---------------------------------------------------------------------------

function colorAttrs(c: ArchiColor | null | undefined): string {
  if (!c) return "";
  let s = ` r="${c.r}" g="${c.g}" b="${c.b}"`;
  if (c.a != null) s += ` a="${c.a}"`;
  return s;
}

function langText(text: string, indent: string, tag: string): string {
  return `${indent}<${tag} xml:lang="fr">${esc(text)}</${tag}>`;
}

function renderProperties(props: Record<string, string>, indent: string): string {
  const keys = Object.keys(props);
  if (keys.length === 0) return "";
  const lines: string[] = [`${indent}<properties>`];
  for (const k of keys) {
    lines.push(`${indent}  <property propertyDefinitionRef="${esc(k)}">`);
    lines.push(`${indent}    <value xml:lang="fr">${esc(props[k] ?? "")}</value>`);
    lines.push(`${indent}  </property>`);
  }
  lines.push(`${indent}</properties>`);
  return lines.join("\n");
}

function renderElement(e: ArchiElement, indent: string): string {
  const attrs = `identifier="${esc(e.uuid)}" xsi:type="${esc(e.type)}"`;
  const inner: string[] = [];
  if (e.name) inner.push(langText(e.name, `${indent}  `, "name"));
  if (e.desc) inner.push(`${indent}  <documentation xml:lang="fr">${esc(e.desc)}</documentation>`);
  const propsXml = renderProperties(e.props, `${indent}  `);
  if (propsXml) inner.push(propsXml);
  if (inner.length === 0) return `${indent}<element ${attrs} />`;
  return `${indent}<element ${attrs}>\n${inner.join("\n")}\n${indent}</element>`;
}

function renderRelationship(r: ArchiRelationship, indent: string): string {
  const srcId = typeof r.source === "string" ? r.source : r.source.uuid;
  const tgtId = typeof r.target === "string" ? r.target : r.target.uuid;
  const attrParts: string[] = [
    `identifier="${esc(r.uuid)}"`,
    `source="${esc(srcId)}"`,
    `target="${esc(tgtId)}"`,
    `xsi:type="${esc(r.type)}"`,
  ];
  if (r.type === "Access" && r.access_type) attrParts.push(`accessType="${esc(r.access_type)}"`);
  if (r.type === "Association" && r.is_directed != null) attrParts.push(`isDirected="${r.is_directed}"`);
  if (r.type === "Influence" && r.influence_strength) attrParts.push(`modifier="${esc(r.influence_strength)}"`);

  const inner: string[] = [];
  if (r.name) inner.push(langText(r.name, `${indent}  `, "name"));
  if (r.desc) inner.push(`${indent}  <documentation xml:lang="fr">${esc(r.desc)}</documentation>`);
  const propsXml = renderProperties(r.props, `${indent}  `);
  if (propsXml) inner.push(propsXml);
  if (inner.length === 0) return `${indent}<relationship ${attrParts.join(" ")} />`;
  return `${indent}<relationship ${attrParts.join(" ")}>\n${inner.join("\n")}\n${indent}</relationship>`;
}

function renderStyle(
  fill: ArchiColor | null,
  line: ArchiColor | null,
  fontName: string | null,
  fontSize: number | null,
  fontColor: ArchiColor | null,
  lineWidth: number | null,
  indent: string
): string {
  const hasAny = fill || line || fontName || fontSize !== null || fontColor || lineWidth !== null;
  if (!hasAny) return "";
  const inner: string[] = [];
  if (line) inner.push(`${indent}  <lineColor${colorAttrs(line)} />`);
  if (fill) inner.push(`${indent}  <fillColor${colorAttrs(fill)} />`);
  if (fontName || fontSize !== null || fontColor) {
    const fa: string[] = [];
    if (fontName) fa.push(`name="${esc(fontName)}"`);
    if (fontSize !== null) fa.push(`size="${fontSize}"`);
    const fontInner = fontColor ? `\n${indent}    <color${colorAttrs(fontColor)} />\n${indent}  ` : "";
    if (fontInner) {
      inner.push(`${indent}  <font${fa.length ? " " + fa.join(" ") : ""}>${fontInner}</font>`);
    } else {
      inner.push(`${indent}  <font${fa.length ? " " + fa.join(" ") : ""} />`);
    }
  }
  const lwAttr = lineWidth !== null ? ` lineWidth="${lineWidth}"` : "";
  if (inner.length === 0) return `${indent}<style${lwAttr} />`;
  return `${indent}<style${lwAttr}>\n${inner.join("\n")}\n${indent}</style>`;
}

function renderNode(n: ArchiNode, indent: string): string {
  const ref = n.ref;
  const elementRef = ref == null ? null : typeof ref === "string" ? ref : ref.uuid;
  const xsiType = elementRef ? "Element" : n.nodes.length > 0 ? "Container" : "Label";
  const attrParts: string[] = [`identifier="${esc(n.uuid)}"`];
  if (elementRef) attrParts.push(`elementRef="${esc(elementRef)}"`);
  attrParts.push(`xsi:type="${xsiType}"`);
  if (n.x != null) attrParts.push(`x="${Math.round(n.x)}"`);
  if (n.y != null) attrParts.push(`y="${Math.round(n.y)}"`);
  if (n.w != null) attrParts.push(`w="${Math.round(n.w)}"`);
  if (n.h != null) attrParts.push(`h="${Math.round(n.h)}"`);

  const inner: string[] = [];
  if (n.name && !elementRef) inner.push(langText(n.name, `${indent}  `, "label"));
  const styleXml = renderStyle(n.fill_color, n.line_color, n.font_name, n.font_size, n.font_color, n.line_width, `${indent}  `);
  if (styleXml) inner.push(styleXml);
  for (const child of n.nodes) inner.push(renderNode(child, `${indent}  `));

  if (inner.length === 0) return `${indent}<node ${attrParts.join(" ")} />`;
  return `${indent}<node ${attrParts.join(" ")}>\n${inner.join("\n")}\n${indent}</node>`;
}

function renderConnection(c: ArchiConnection, indent: string): string {
  const xsiType = c.ref ? "Relationship" : "Line";
  const attrParts: string[] = [`identifier="${esc(c.uuid)}"`];
  if (c.ref) attrParts.push(`relationshipRef="${esc(c.ref)}"`);
  attrParts.push(`xsi:type="${xsiType}"`);
  if (c.source) attrParts.push(`source="${esc(c.source)}"`);
  if (c.target) attrParts.push(`target="${esc(c.target)}"`);

  const inner: string[] = [];
  if (c.name) inner.push(langText(c.name, `${indent}  `, "name"));
  const styleXml = renderStyle(null, c.line_color, c.font_name, c.font_size, c.font_color, c.line_width, `${indent}  `);
  if (styleXml) inner.push(styleXml);
  for (const bp of c.bendpoints ?? []) {
    inner.push(`${indent}  <bendpoint x="${Math.round(bp.x)}" y="${Math.round(bp.y)}" />`);
  }

  if (inner.length === 0) return `${indent}<connection ${attrParts.join(" ")} />`;
  return `${indent}<connection ${attrParts.join(" ")}>\n${inner.join("\n")}\n${indent}</connection>`;
}

function renderView(v: ArchiView, indent: string): string {
  const attrParts: string[] = [`identifier="${esc(v.uuid)}"`];
  if (v.primary_viewpoint) attrParts.push(`viewpoint="${esc(v.primary_viewpoint)}"`);
  attrParts.push(`xsi:type="Diagram"`);

  const inner: string[] = [];
  if (v.name) inner.push(langText(v.name, `${indent}  `, "name"));
  if (v.desc) inner.push(`${indent}  <documentation xml:lang="fr">${esc(v.desc)}</documentation>`);
  for (const n of v.nodes) inner.push(renderNode(n, `${indent}  `));
  for (const c of v.conns) inner.push(renderConnection(c, `${indent}  `));

  if (inner.length === 0) return `${indent}<view ${attrParts.join(" ")} />`;
  return `${indent}<view ${attrParts.join(" ")}>\n${inner.join("\n")}\n${indent}</view>`;
}

// ---------------------------------------------------------------------------
// Preserved subtree rendering (organizations, propertyDefinitions, viewpoints, metadata)
// ---------------------------------------------------------------------------

function attrsXml(node: XmlNode): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(node)) {
    if (!k.startsWith("@_")) continue;
    parts.push(`${k.slice(2)}="${esc(String(v))}"`);
  }
  return parts.length > 0 ? " " + parts.join(" ") : "";
}

function renderRawNode(name: string, node: unknown, indent: string): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return `${indent}<${name}>${esc(String(node))}</${name}>`;
  }
  if (typeof node !== "object") return "";
  const n = node as XmlNode;
  const attrStr = attrsXml(n);
  const inner: string[] = [];
  for (const [k, v] of Object.entries(n)) {
    if (k.startsWith("@_")) continue;
    if (k === "#text") continue;
    for (const child of ensureArr<unknown>(v)) {
      const rendered = renderRawNode(k, child, `${indent}  `);
      if (rendered) inner.push(rendered);
    }
  }
  const text = n["#text"] !== undefined ? esc(String(n["#text"])) : "";
  if (inner.length === 0 && !text) return `${indent}<${name}${attrStr} />`;
  if (inner.length === 0) return `${indent}<${name}${attrStr}>${text}</${name}>`;
  return `${indent}<${name}${attrStr}>\n${inner.join("\n")}\n${indent}</${name}>`;
}

function renderPreservedSection(raw: XmlNode | undefined, sectionName: string, indent: string): string {
  if (!raw) return "";
  const node = raw[sectionName];
  if (!node) return "";
  const items = ensureArr<unknown>(node);
  return items.map((item) => renderRawNode(sectionName, item, indent)).join("\n");
}

// ---------------------------------------------------------------------------
// Main serializer
// ---------------------------------------------------------------------------

export function serializeToOpenExchange(model: ArchiModel): string {
  const raw = model._raw as XmlNode | undefined;
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');

  const modelAttrs: string[] = [
    `xmlns="${NS}"`,
    `xmlns:xsi="${XSI}"`,
    `xsi:schemaLocation="${NS} http://www.opengroup.org/xsd/archimate/3.1/archimate3_Diagram.xsd"`,
    `identifier="${esc(model.uuid)}"`,
  ];
  if (model.version) modelAttrs.push(`version="${esc(model.version)}"`);

  out.push(`<model ${modelAttrs.join(" ")}>`);

  if (model.name) out.push(langText(model.name, "  ", "name"));
  if (model.desc) out.push(`  <documentation xml:lang="fr">${esc(model.desc)}</documentation>`);

  // Preserved metadata (if any was present in source)
  const metadata = renderPreservedSection(raw, "metadata", "  ");
  if (metadata) out.push(metadata);

  // Elements
  if (model.elements.length > 0) {
    out.push("  <elements>");
    for (const e of model.elements) out.push(renderElement(e, "    "));
    out.push("  </elements>");
  }

  // Relationships
  if (model.relationships.length > 0) {
    out.push("  <relationships>");
    for (const r of model.relationships) out.push(renderRelationship(r, "    "));
    out.push("  </relationships>");
  }

  // Preserved organizations
  const orgs = renderPreservedSection(raw, "organizations", "  ");
  if (orgs) out.push(orgs);

  // PropertyDefinitions
  if (model.propertyDefinitions.length > 0) {
    out.push("  <propertyDefinitions>");
    for (const pd of model.propertyDefinitions) {
      out.push(`    <propertyDefinition identifier="${esc(pd.uuid)}" type="${esc(pd.type)}">`);
      out.push(`      <name>${esc(pd.name)}</name>`);
      out.push(`    </propertyDefinition>`);
    }
    out.push("  </propertyDefinitions>");
  }

  // Views
  const viewpoints = renderPreservedSection(raw, "views", "  ");
  // viewpoints rendering above renders the whole <views> subtree; we replace it with our own.
  // Build views section from current model, but preserve <viewpoints> child if present.
  if (model.views.length > 0 || (raw && raw["views"])) {
    const rawViews = raw?.["views"] as XmlNode | undefined;
    const vpNode = rawViews?.["viewpoints"];
    out.push("  <views>");
    if (vpNode) {
      for (const vp of ensureArr<unknown>(vpNode)) {
        out.push(renderRawNode("viewpoints", vp, "    "));
      }
    }
    if (model.views.length > 0) {
      out.push("    <diagrams>");
      for (const v of model.views) out.push(renderView(v, "      "));
      out.push("    </diagrams>");
    }
    out.push("  </views>");
  }
  // Suppress unused variable
  void viewpoints;

  out.push("</model>");
  return out.join("\n");
}

export function saveModelToFile(model: ArchiModel, filePath: string): void {
  writeFileSync(filePath, serializeToOpenExchange(model), "utf-8");
}
