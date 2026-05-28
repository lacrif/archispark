/**
 * Parser for the ArchiMate 3.1 Open Exchange File format.
 * Root element: <model> with children <elements>, <relationships>, <organizations>,
 * <propertyDefinitions>, <views><diagrams><view>...
 *
 * XSDs: archimate3_Model.xsd, archimate3_View.xsd, archimate3_Diagram.xsd.
 */

import { XMLParser } from "fast-xml-parser";
import { ELEMENT_TYPES, RELATIONSHIP_TYPES } from "./schemas.js";
import type {
  ArchiColor,
  ArchiElement,
  ArchiRelationship,
  ArchiNode,
  ArchiConnection,
  ArchiView,
  ArchiModel,
  ArchiPropertyDefinition,
  BendPoint,
} from "@workspace/db";

type XmlNode = Record<string, unknown>;

function ensureArray<T>(value: unknown): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

function langStringText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const items = ensureArray<unknown>(value);
  if (items.length === 0) return null;
  const first = items[0];
  if (typeof first === "string" || typeof first === "number" || typeof first === "boolean") {
    return String(first);
  }
  const node = first as XmlNode;
  if (node["#text"] !== undefined) return String(node["#text"]);
  return null;
}

function parseColor(node: unknown): ArchiColor | null {
  if (!node || typeof node !== "object") return null;
  const n = node as XmlNode;
  if (n["@_r"] === undefined || n["@_g"] === undefined || n["@_b"] === undefined) return null;
  const c: ArchiColor = {
    r: Number(n["@_r"]),
    g: Number(n["@_g"]),
    b: Number(n["@_b"]),
  };
  if (n["@_a"] !== undefined) c.a = Number(n["@_a"]);
  return c;
}

interface ParsedStyle {
  fill: ArchiColor | null;
  line: ArchiColor | null;
  fontName: string | null;
  fontSize: number | null;
  fontColor: ArchiColor | null;
  lineWidth: number | null;
}

function parseStyle(styleNode: unknown): ParsedStyle {
  const empty: ParsedStyle = {
    fill: null, line: null, fontName: null, fontSize: null, fontColor: null, lineWidth: null,
  };
  if (!styleNode || typeof styleNode !== "object") return empty;
  const s = styleNode as XmlNode;
  const font = s["font"] as XmlNode | undefined;
  return {
    fill: parseColor(s["fillColor"]),
    line: parseColor(s["lineColor"]),
    fontName: font?.["@_name"] != null ? String(font["@_name"]) : null,
    fontSize: font?.["@_size"] != null ? Number(font["@_size"]) : null,
    fontColor: font ? parseColor(font["color"]) : null,
    lineWidth: s["@_lineWidth"] != null ? Number(s["@_lineWidth"]) : null,
  };
}

function parseProps(elem: XmlNode): Record<string, string> {
  const result: Record<string, string> = {};
  const propsNode = elem["properties"] as XmlNode | undefined;
  if (!propsNode) return result;
  for (const prop of ensureArray<XmlNode>(propsNode["property"])) {
    const ref = prop["@_propertyDefinitionRef"];
    if (ref == null) continue;
    const value = langStringText(prop["value"]);
    result[String(ref)] = value ?? "";
  }
  return result;
}

function parseNode(raw: XmlNode, elementMap: Map<string, ArchiElement>): ArchiNode {
  const elementRef = raw["@_elementRef"] != null ? String(raw["@_elementRef"]) : null;
  const ref = elementRef ? (elementMap.get(elementRef) ?? elementRef) : null;
  const style = parseStyle(raw["style"]);
  const labelText = langStringText(raw["label"]);
  const children = ensureArray<XmlNode>(raw["node"]).map((c) => parseNode(c, elementMap));

  return {
    uuid: String(raw["@_identifier"]),
    name: labelText,
    ref,
    x: raw["@_x"] != null ? Number(raw["@_x"]) : null,
    y: raw["@_y"] != null ? Number(raw["@_y"]) : null,
    w: raw["@_w"] != null ? Number(raw["@_w"]) : null,
    h: raw["@_h"] != null ? Number(raw["@_h"]) : null,
    fill_color: style.fill,
    line_color: style.line,
    font_name: style.fontName,
    font_size: style.fontSize,
    font_color: style.fontColor,
    line_width: style.lineWidth,
    archi_type: null,
    nodes: children,
  };
}

function parseConnection(raw: XmlNode): ArchiConnection {
  const style = parseStyle(raw["style"]);
  const bendpoints: BendPoint[] = ensureArray<XmlNode>(raw["bendpoint"]).map((bp) => ({
    x: bp["@_x"] != null ? Number(bp["@_x"]) : 0,
    y: bp["@_y"] != null ? Number(bp["@_y"]) : 0,
  }));
  return {
    uuid: String(raw["@_identifier"]),
    name: langStringText(raw["name"]),
    ref: raw["@_relationshipRef"] != null ? String(raw["@_relationshipRef"]) : null,
    source: raw["@_source"] != null ? String(raw["@_source"]) : null,
    target: raw["@_target"] != null ? String(raw["@_target"]) : null,
    line_color: style.line,
    font_name: style.fontName,
    font_size: style.fontSize,
    font_color: style.fontColor,
    line_width: style.lineWidth,
    bendpoints,
  };
}

export function parseOpenExchange(xmlContent: string): ArchiModel {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
    textNodeName: "#text",
    isArray: (name) =>
      [
        "element", "relationship", "view", "node", "connection", "bendpoint",
        "item", "property", "propertyDefinition", "viewpoint", "name",
        "documentation", "label", "value", "concern", "stakeholder",
      ].includes(name),
  });

  const parsed = parser.parse(xmlContent);
  const modelRaw = (parsed["model"] ?? parsed["archimate:model"]) as XmlNode;

  // ---- Elements ----
  const elementsContainer = modelRaw["elements"] as XmlNode | undefined;
  const elementRaws = ensureArray<XmlNode>(elementsContainer?.["element"]);
  const elementArray: ArchiElement[] = [];
  for (const raw of elementRaws) {
    const xsiType = raw["@_xsi:type"] != null ? String(raw["@_xsi:type"]) : "";
    if (!ELEMENT_TYPES.has(xsiType)) continue;
    elementArray.push({
      uuid: String(raw["@_identifier"]),
      name: langStringText(raw["name"]) ?? "",
      type: xsiType,
      desc: langStringText(raw["documentation"]),
      props: parseProps(raw),
    });
  }
  const elementMap = new Map<string, ArchiElement>(elementArray.map((e) => [e.uuid, e]));

  // ---- Relationships ----
  const relsContainer = modelRaw["relationships"] as XmlNode | undefined;
  const relRaws = ensureArray<XmlNode>(relsContainer?.["relationship"]);
  const relationshipArray: ArchiRelationship[] = [];
  for (const raw of relRaws) {
    const xsiType = raw["@_xsi:type"] != null ? String(raw["@_xsi:type"]) : "";
    if (!RELATIONSHIP_TYPES.has(xsiType)) continue;
    const srcId = raw["@_source"] != null ? String(raw["@_source"]) : "";
    const tgtId = raw["@_target"] != null ? String(raw["@_target"]) : "";
    relationshipArray.push({
      uuid: String(raw["@_identifier"]),
      name: langStringText(raw["name"]),
      type: xsiType,
      source: elementMap.get(srcId) ?? srcId,
      target: elementMap.get(tgtId) ?? tgtId,
      desc: langStringText(raw["documentation"]),
      props: parseProps(raw),
      access_type: raw["@_accessType"] != null ? String(raw["@_accessType"]) : null,
      is_directed: raw["@_isDirected"] != null ? Boolean(raw["@_isDirected"]) : null,
      influence_strength: raw["@_modifier"] != null ? String(raw["@_modifier"]) : null,
    });
  }

  // ---- PropertyDefinitions ----
  const pdContainer = modelRaw["propertyDefinitions"] as XmlNode | undefined;
  const pdRaws = ensureArray<XmlNode>(pdContainer?.["propertyDefinition"]);
  const propertyDefinitions: ArchiPropertyDefinition[] = [];
  for (const raw of pdRaws) {
    const id = raw["@_identifier"] != null ? String(raw["@_identifier"]) : null;
    if (!id) continue;
    propertyDefinitions.push({
      uuid: id,
      name: langStringText(raw["name"]) ?? "",
      type: raw["@_type"] != null ? String(raw["@_type"]) : "string",
    });
  }

  // ---- Views ----
  const viewsContainer = modelRaw["views"] as XmlNode | undefined;
  const diagramsContainer = viewsContainer?.["diagrams"] as XmlNode | undefined;
  const viewRaws = ensureArray<XmlNode>(diagramsContainer?.["view"]);
  const viewArray: ArchiView[] = viewRaws.map((raw) => {
    const nodes = ensureArray<XmlNode>(raw["node"]).map((n) => parseNode(n, elementMap));
    const conns: ArchiConnection[] = ensureArray<XmlNode>(raw["connection"]).map(parseConnection);
    return {
      uuid: String(raw["@_identifier"]),
      name: langStringText(raw["name"]) ?? "",
      desc: langStringText(raw["documentation"]),
      primary_viewpoint:
        raw["@_viewpoint"] != null
          ? String(raw["@_viewpoint"])
          : raw["@_viewpointRef"] != null
            ? String(raw["@_viewpointRef"])
            : null,
      nodes,
      conns,
    };
  });

  return {
    uuid: modelRaw["@_identifier"] != null ? String(modelRaw["@_identifier"]) : "",
    name: langStringText(modelRaw["name"]) ?? "",
    desc: langStringText(modelRaw["documentation"]),
    version: modelRaw["@_version"] != null ? String(modelRaw["@_version"]) : null,
    elements: elementArray,
    relationships: relationshipArray,
    propertyDefinitions,
    views: viewArray,
    _raw: modelRaw,
  };
}
