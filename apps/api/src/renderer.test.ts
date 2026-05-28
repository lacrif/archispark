/**
 * Tests for src/renderer.ts — renderViewToSvg and the GET /views/:view_id/image endpoint.
 */

import { describe, it, expect, beforeAll } from "vitest";
import _request from "supertest";
import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../src/auth.js";
import { renderViewToSvg } from "../src/renderer.js";
import { app } from "../src/app.js";
import { dataSource as _dataSource } from "../src/registry.js";
import type { ArchiElement, ArchiRelationship, ArchiNode, ArchiConnection, ArchiView } from "../src/model.js";
import type { ArchiModel } from "../src/model.js";
import type { ViewOut } from "../src/schemas.js";

const _TEST_TOKEN = jwt.sign({ id: "test-admin", username: "admin", role: "admin" }, JWT_SECRET);
function request(appArg: Parameters<typeof _request>[0]) {
  return _request.agent(appArg).set("Authorization", `Bearer ${_TEST_TOKEN}`);
}

const UNKNOWN_ID = "id-does-not-exist";

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeElement(overrides: Partial<ArchiElement> = {}): ArchiElement {
  return {
    uuid: "elem-001",
    name: "My Component",
    type: "ApplicationComponent",
    desc: null,
    props: {},
    ...overrides,
  };
}

function _makeRelationship(overrides: Partial<ArchiRelationship> = {}): ArchiRelationship {
  const src = makeElement({ uuid: "src-001", name: "Source" });
  const tgt = makeElement({ uuid: "tgt-001", name: "Target" });
  return {
    uuid: "rel-001",
    name: null,
    type: "Association",
    source: src,
    target: tgt,
    desc: null,
    props: {},
    access_type: null,
    is_directed: null,
    influence_strength: null,
    ...overrides,
  };
}

function makeNode(overrides: Partial<ArchiNode> = {}): ArchiNode {
  return {
    uuid: "node-001",
    name: null,
    ref: null,
    x: 10,
    y: 20,
    w: 120,
    h: 55,
    fill_color: { r: 255, g: 255, b: 255, a: 100 },
    line_color: { r: 0, g: 0, b: 0, a: 100 },
    font_name: null,
    font_size: null,
    font_color: null,
    line_width: null,
    archi_type: null,
    nodes: [],
    ...overrides,
  };
}

function makeConnection(overrides: Partial<ArchiConnection> = {}): ArchiConnection {
  return {
    uuid: "conn-001",
    name: null,
    ref: "rel-001",
    source: "node-src",
    target: "node-tgt",
    line_color: null,
    font_name: null,
    font_size: null,
    font_color: null,
    line_width: null,
    ...overrides,
  };
}

function makeView(overrides: Partial<ArchiView> = {}): ArchiView {
  return {
    uuid: "view-001",
    name: "My View",
    desc: null,
    primary_viewpoint: null,
    nodes: [],
    conns: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared fixture: knownView for integration tests
// ---------------------------------------------------------------------------

let knownView: ViewOut;

beforeAll(async () => {
  const existing = (await request(app).get("/views")).body as ViewOut[];
  if (existing.length === 0) {
    await request(app).post("/views").send({ name: "Test View" });
  }
  const viewRes = await request(app).get("/views");
  const views = viewRes.body as ViewOut[];
  knownView = views.find((v) => v.identifier) ?? views[0]!;
});

// ===========================================================================
// Unit tests – renderViewToSvg: empty view
// ===========================================================================

describe("renderViewToSvg – empty view", () => {
  const emptyModel: ArchiModel = {
    uuid: "m1", name: "Model", desc: null, version: null,
    elements: [], relationships: [], propertyDefinitions: [], views: [],
  };

  it("returns a string starting with <svg", () => {
    const svg = renderViewToSvg(makeView(), emptyModel);
    expect(svg.trimStart()).toMatch(/^<svg /);
  });

  it("includes the view name in the output", () => {
    const svg = renderViewToSvg(makeView({ name: "My Test View" }), emptyModel);
    expect(svg).toContain("My Test View");
  });

  it("includes SVG namespace declaration", () => {
    const svg = renderViewToSvg(makeView(), emptyModel);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("closes the svg tag", () => {
    const svg = renderViewToSvg(makeView(), emptyModel);
    expect(svg).toContain("</svg>");
  });

  it("escapes XML special characters in view name", () => {
    const svg = renderViewToSvg(makeView({ name: "View <A> & 'B'" }), emptyModel);
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;");
    expect(svg).not.toContain("<A>");
  });
});

// ===========================================================================
// Unit tests – renderViewToSvg: with nodes
// ===========================================================================

describe("renderViewToSvg – with nodes", () => {
  const elem: ArchiElement = { uuid: "e1", name: "My App", type: "ApplicationComponent", desc: null, props: {} };
  const model: ArchiModel = {
    uuid: "m1", name: "Model", desc: null, version: null,
    elements: [elem], relationships: [], propertyDefinitions: [], views: [],
  };

  it("includes element name in rendered SVG", () => {
    const node = makeNode({ uuid: "n1", ref: elem, x: 10, y: 10, w: 120, h: 55 });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), model);
    expect(svg).toContain("My App");
  });

  it("renders a rect for the node", () => {
    const node = makeNode({ uuid: "n1", ref: elem });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), model);
    expect(svg).toContain("<rect ");
  });

  it("renders a connection line between two nodes", () => {
    const n1 = makeNode({ uuid: "n1", ref: elem, x: 10,  y: 10, w: 120, h: 55 });
    const n2 = makeNode({ uuid: "n2", ref: elem, x: 200, y: 10, w: 120, h: 55 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: null });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), model);
    expect(svg).toContain("<polyline ");
  });

  it("applies dashed stroke for Realization connection type", () => {
    const rel: ArchiRelationship = {
      uuid: "rel-r1", name: null, type: "Realization",
      source: elem, target: elem,
      desc: null, props: {}, access_type: null, is_directed: null, influence_strength: null,
    };
    const relModel = { ...model, relationships: [rel] };
    const n1 = makeNode({ uuid: "n1", ref: elem, x: 10,  y: 10, w: 120, h: 55 });
    const n2 = makeNode({ uuid: "n2", ref: elem, x: 200, y: 10, w: 120, h: 55 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: "rel-r1" });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), relModel);
    expect(svg).toContain('stroke-dasharray="6,3"');
  });

  it("renders junctions as circles (no element rect)", () => {
    const junction: ArchiElement = { uuid: "j1", name: "", type: "AndJunction", desc: null, props: {} };
    const jModel = { ...model, elements: [junction] };
    const node = makeNode({ uuid: "n1", ref: junction, x: 50, y: 50, w: 14, h: 14, fill_color: null, line_color: null });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), jModel);
    expect(svg).toContain("<circle ");
    expect(svg).toContain('fill="#000000"');
  });

  it("renders Grouping with dashed border", () => {
    const grouping: ArchiElement = { uuid: "g1", name: "My Group", type: "Grouping", desc: null, props: {} };
    const gModel = { ...model, elements: [grouping] };
    const node = makeNode({ uuid: "n1", ref: grouping, x: 0, y: 0, w: 300, h: 200 });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), gModel);
    expect(svg).toContain('stroke-dasharray="6,4"');
  });
});

// ===========================================================================
// Unit tests – renderViewToSvg: specialized shapes (archi_type=1)
// ===========================================================================

describe("renderViewToSvg – specialized shapes (archi_type=1)", () => {
  const baseModel = (type: string, uuid = "e1"): ArchiModel => ({
    uuid: "m1", name: "Model", desc: null, version: null,
    elements: [{ uuid, name: type, type, desc: null, props: {} }],
    relationships: [], propertyDefinitions: [], views: [],
  });

  function makeIconNode(type: string, uuid = "e1") {
    const m = baseModel(type, uuid);
    const node = makeNode({
      uuid: "n1",
      ref: m.elements[0]!,
      archi_type: 1,
      x: 10, y: 10, w: 120, h: 55,
    });
    return { node, model: m };
  }

  it("Service shape renders pill rect (large rx)", () => {
    const { node, model: m } = makeIconNode("BusinessService");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toMatch(/rx="\d+(\.\d+)?" ry="\d+(\.\d+)?"/);
  });

  it("Event shape renders a path element", () => {
    const { node, model: m } = makeIconNode("BusinessEvent");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });

  it("ImplementationEvent also renders event path", () => {
    const { node, model: m } = makeIconNode("ImplementationEvent");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });

  it("ApplicationComponent renders three rects (body + 2 nubs)", () => {
    const { node, model: m } = makeIconNode("ApplicationComponent");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect((svg.match(/<rect /g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("Collaboration shape renders two ellipses", () => {
    const { node, model: m } = makeIconNode("BusinessCollaboration");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect((svg.match(/<ellipse /g) ?? []).length).toBe(2);
  });

  it("Interface shape renders a circle", () => {
    const { node, model: m } = makeIconNode("BusinessInterface");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<circle ");
  });

  it("Function shape renders a path element", () => {
    const { node, model: m } = makeIconNode("BusinessFunction");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });

  it("Process shape renders a path element", () => {
    const { node, model: m } = makeIconNode("BusinessProcess");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });

  it("Interaction shape renders two half-ellipse paths", () => {
    const { node, model: m } = makeIconNode("BusinessInteraction");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("Interaction shape renders wider-than-tall node (w > h branch)", () => {
    const m = baseModel("ApplicationInteraction");
    const node = makeNode({ uuid: "n1", ref: m.elements[0]!, archi_type: 1, x: 10, y: 10, w: 200, h: 55 });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });

  it("Interaction shape renders taller-than-wide node (w <= h branch)", () => {
    const m = baseModel("ApplicationInteraction");
    const node = makeNode({ uuid: "n1", ref: m.elements[0]!, archi_type: 1, x: 10, y: 10, w: 55, h: 120 });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<path ");
  });
});

// ===========================================================================
// Unit tests – renderViewToSvg: data-object shapes
// ===========================================================================

describe("renderViewToSvg – data-object shapes", () => {
  function makeDataNode(type: string) {
    const m: ArchiModel = {
      uuid: "m1", name: "M", desc: null, version: null,
      elements: [{ uuid: "e1", name: type, type, desc: null, props: {} }],
      relationships: [], propertyDefinitions: [], views: [],
    };
    const node = makeNode({ uuid: "n1", ref: m.elements[0]!, x: 10, y: 10, w: 100, h: 60 });
    return { node, model: m };
  }

  it("DataObject renders rect + header line", () => {
    const { node, model: m } = makeDataNode("DataObject");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<line ");
    expect(svg).toContain("<rect ");
  });

  it("BusinessObject renders data-object shape", () => {
    const { node, model: m } = makeDataNode("BusinessObject");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<line ");
  });

  it("Artifact renders data-object shape", () => {
    const { node, model: m } = makeDataNode("Artifact");
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("<line ");
  });
});

// ===========================================================================
// Unit tests – renderViewToSvg: color and style helpers
// ===========================================================================

describe("renderViewToSvg – color and style helpers", () => {
  it("uses derivedLineColor (rgb branch) when line_color is null and fill is rgb", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Node", type: "ApplicationComponent", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], propertyDefinitions: [], views: [] };
    const node = makeNode({ uuid: "n1", ref: elem, fill_color: { r: 180, g: 200, b: 220, a: 255 }, line_color: null });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    // derivedLineColor: Math.floor(180*0.7)=125, Math.floor(200*0.7)=140, Math.floor(220*0.7)=154
    expect(svg).toContain("rgb(125,140,154)");
  });

  it("applies custom font_size and font_name from node", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Elem", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], propertyDefinitions: [], views: [] };
    const node = makeNode({ uuid: "n1", ref: elem, font_size: 14, font_name: "Courier,monospace" });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain('font-size="14"');
    expect(svg).toContain('font-family="Courier,monospace"');
  });

  it("applies custom font_color from node", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Elem", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], propertyDefinitions: [], views: [] };
    const node = makeNode({ uuid: "n1", ref: elem, font_color: { r: 255, g: 0, b: 0, a: 255 } });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain('fill="rgb(255,0,0)"');
  });

  it("OrJunction renders inner white ring", () => {
    const junction: ArchiElement = { uuid: "j1", name: "", type: "OrJunction", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [junction], relationships: [], propertyDefinitions: [], views: [] };
    const node = makeNode({ uuid: "n1", ref: junction, x: 50, y: 50, w: 14, h: 14, fill_color: null, line_color: null });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect((svg.match(/<circle /g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('fill="white"');
  });
});

// ===========================================================================
// Unit tests – renderViewToSvg: node name edge cases
// ===========================================================================

describe("renderViewToSvg – node name edge cases", () => {
  it("uses node.name when set (overrides ref.name)", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Elem Name", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], propertyDefinitions: [], views: [] };
    const node = makeNode({ uuid: "n1", name: "Override Name", ref: elem });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("Override Name");
    expect(svg).not.toContain("Elem Name");
  });

  it("uses ref.name when node.name is null", () => {
    const elem: ArchiElement = { uuid: "e1", name: "From Ref", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], propertyDefinitions: [], views: [] };
    const node = makeNode({ uuid: "n1", name: null, ref: elem });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain("From Ref");
  });

  it("treats string ref as unresolved (nodeType → Grouping, nodeName → empty)", () => {
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [], relationships: [], propertyDefinitions: [], views: [] };
    const node = makeNode({ uuid: "n1", name: null, ref: "unresolved-uuid" });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect(svg).toContain('stroke-dasharray="6,4"');
  });

  it("wraps long names across multiple text lines", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Word1 Word2 Word3 Word4 Word5", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem], relationships: [], propertyDefinitions: [], views: [] };
    const node = makeNode({ uuid: "n1", ref: elem, w: 40, h: 80 });
    const svg = renderViewToSvg(makeView({ nodes: [node] }), m);
    expect((svg.match(/<text /g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("renders top-left label when node has children", () => {
    const elem: ArchiElement = { uuid: "e1", name: "Parent", type: "Node", desc: null, props: {} };
    const child: ArchiElement = { uuid: "e2", name: "Child", type: "Node", desc: null, props: {} };
    const m: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [elem, child], relationships: [], propertyDefinitions: [], views: [] };
    const childNode = makeNode({ uuid: "n2", ref: child, x: 10, y: 10, w: 80, h: 40 });
    const parentNode = makeNode({ uuid: "n1", ref: elem, x: 0, y: 0, w: 200, h: 150, nodes: [childNode] });
    const svg = renderViewToSvg(makeView({ nodes: [parentNode] }), m);
    expect(svg).toContain("Parent");
    expect(svg).toContain("Child");
  });
});

// ===========================================================================
// Unit tests – renderViewToSvg: connection features
// ===========================================================================

describe("renderViewToSvg – connection features", () => {
  const e1: ArchiElement = { uuid: "e1", name: "A", type: "Node", desc: null, props: {} };
  const e2: ArchiElement = { uuid: "e2", name: "B", type: "Node", desc: null, props: {} };
  const baseModel: ArchiModel = { uuid: "m1", name: "M", desc: null, version: null, elements: [e1, e2], relationships: [], propertyDefinitions: [], views: [] };

  it("renders connection label from conn.name", () => {
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: null, name: "my label" });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), baseModel);
    expect(svg).toContain("my label");
  });

  it("renders connection label from relationship name when conn.name is null", () => {
    const rel: ArchiRelationship = {
      uuid: "rel1", name: "flows to", type: "Flow",
      source: e1, target: e2, desc: null, props: {},
      access_type: null, is_directed: null, influence_strength: null,
    };
    const m = { ...baseModel, relationships: [rel] };
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: "rel1", name: null });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), m);
    expect(svg).toContain("flows to");
  });

  it("renders connection with bendpoints (waypoints path)", () => {
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({
      uuid: "c1", source: "n1", target: "n2", ref: null,
      bendpoints: [{ x: 150, y: 35 }],
    });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), baseModel);
    expect(svg).toContain("<polyline ");
  });

  it("skips connection when source node not in geomMap", () => {
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "no-such-node", target: "n2", ref: null });
    const svg = renderViewToSvg(makeView({ nodes: [n2], conns: [conn] }), baseModel);
    expect(svg).not.toContain("<polyline ");
  });

  it("skips connection when target node not in geomMap", () => {
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "no-such-node", ref: null });
    const svg = renderViewToSvg(makeView({ nodes: [n1], conns: [conn] }), baseModel);
    expect(svg).not.toContain("<polyline ");
  });

  it("suppresses Composition arrow when target is visually nested inside source", () => {
    const rel: ArchiRelationship = {
      uuid: "rel1", name: null, type: "Composition",
      source: e1, target: e2, desc: null, props: {},
      access_type: null, is_directed: null, influence_strength: null,
    };
    const m = { ...baseModel, relationships: [rel] };
    const childNode = makeNode({ uuid: "n2", ref: e2, x: 10, y: 10, w: 80, h: 40 });
    const parentNode = makeNode({ uuid: "n1", ref: e1, x: 0, y: 0, w: 200, h: 150, nodes: [childNode] });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: "rel1" });
    const svg = renderViewToSvg(makeView({ nodes: [parentNode], conns: [conn] }), m);
    expect(svg).not.toContain("<polyline ");
  });

  it("does NOT suppress non-structural relation for nested nodes", () => {
    const rel: ArchiRelationship = {
      uuid: "rel1", name: null, type: "Association",
      source: e1, target: e2, desc: null, props: {},
      access_type: null, is_directed: null, influence_strength: null,
    };
    const m = { ...baseModel, relationships: [rel] };
    const childNode = makeNode({ uuid: "n2", ref: e2, x: 10, y: 10, w: 80, h: 40 });
    const parentNode = makeNode({ uuid: "n1", ref: e1, x: 0, y: 0, w: 200, h: 150, nodes: [childNode] });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: "rel1" });
    const svg = renderViewToSvg(makeView({ nodes: [parentNode], conns: [conn] }), m);
    expect(svg).toContain("<polyline ");
  });

  it("renders connection with custom line_color", () => {
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: null, line_color: { r: 255, g: 0, b: 0, a: 255 } });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), baseModel);
    expect(svg).toContain('stroke="rgb(255,0,0)"');
  });

  it("applies marker-start and marker-end for Composition relation", () => {
    const rel: ArchiRelationship = {
      uuid: "rel1", name: null, type: "Composition",
      source: e1, target: e2, desc: null, props: {},
      access_type: null, is_directed: null, influence_strength: null,
    };
    const m = { ...baseModel, relationships: [rel] };
    const n1 = makeNode({ uuid: "n1", ref: e1, x: 10, y: 10, w: 100, h: 50 });
    const n2 = makeNode({ uuid: "n2", ref: e2, x: 200, y: 10, w: 100, h: 50 });
    const conn = makeConnection({ uuid: "c1", source: "n1", target: "n2", ref: "rel1" });
    const svg = renderViewToSvg(makeView({ nodes: [n1, n2], conns: [conn] }), m);
    expect(svg).toContain('marker-start="url(#diamond-filled)"');
  });

  it("sorts Grouping nodes before other nodes", () => {
    const groupElem: ArchiElement = { uuid: "g1", name: "Group", type: "Grouping", desc: null, props: {} };
    const m: ArchiModel = { ...baseModel, elements: [e1, groupElem] };
    const groupNode = makeNode({ uuid: "ng", ref: groupElem, x: 0, y: 0, w: 300, h: 200 });
    const childNode = makeNode({ uuid: "n1", ref: e1, x: 20, y: 20, w: 100, h: 50 });
    const svg = renderViewToSvg(makeView({ nodes: [childNode, groupNode] }), m);
    const groupIdx = svg.indexOf('stroke-dasharray="6,4"');
    const childIdx = svg.indexOf("<rect ", groupIdx + 1);
    expect(groupIdx).toBeLessThan(childIdx);
  });
});

// ===========================================================================
// Integration tests – GET /views/:view_id/image
// ===========================================================================

describe("GET /views/:view_id/image", () => {
  it("returns SVG for a real view (default format)", async () => {
    const res = await request(app).get(`/views/${knownView.identifier}/image`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/svg/);
    const body = Buffer.isBuffer(res.body) ? res.body.toString() : String(res.body);
    expect(body).toMatch(/^<svg /);
  });

  it("returns SVG when format=svg", async () => {
    const res = await request(app).get(`/views/${knownView.identifier}/image?format=svg`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/svg/);
  });

  it("returns 404 for unknown view id", async () => {
    const res = await request(app).get(`/views/${UNKNOWN_ID}/image`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("detail");
  });

  it("returns 422 for invalid format", async () => {
    const res = await request(app).get(`/views/${knownView.identifier}/image?format=gif`);
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty("detail");
  });

  it("returns 200 with PNG image when sharp is installed", async () => {
    const res = await request(app).get(`/views/${knownView.identifier}/image?format=png`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/image\/png/);
  });
});
