/**
 * Tests for src/oxf-serializer.ts
 */

import { describe, it, expect } from "vitest";
import { serializeToOpenExchange } from "../src/oxf-serializer.js";
import { parseOpenExchange } from "../src/oxf-parser.js";
import type { ArchiElement, ArchiRelationship, ArchiNode, ArchiConnection, ArchiView } from "../src/model.js";
import type { DataSource } from "../src/registry.js";
import type { ArchiModel } from "../src/model.js";

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

function makeRelationship(overrides: Partial<ArchiRelationship> = {}): ArchiRelationship {
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

function makeDataSource(overrides: Partial<ArchiModel> = {}): DataSource {
  const model: ArchiModel = {
    uuid: "model-001",
    name: "Test Model",
    desc: null,
    version: null,
    elements: [],
    relationships: [],
    propertyDefinitions: [],
    views: [],
    ...overrides,
  };
  return { workspaceDbId: 1, path: "data/test.xml", model, elementTypes: [], relationshipTypes: [] };
}

// OEF_FIXTURE is needed for round-trip tests
const OEF_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="m1" version="3.1">
  <name xml:lang="fr">FixtureModel</name>
  <documentation xml:lang="fr">model doc</documentation>
  <elements>
    <element identifier="and-id" xsi:type="AndJunction"><name xml:lang="fr">AndJ</name></element>
    <element identifier="or-id" xsi:type="OrJunction"><name xml:lang="fr">OrJ</name></element>
    <element identifier="actor-id" xsi:type="BusinessActor">
      <name xml:lang="fr">Actor</name>
      <documentation xml:lang="fr">actor doc</documentation>
      <properties>
        <property propertyDefinitionRef="propid-1"><value xml:lang="fr">val-1</value></property>
      </properties>
    </element>
    <element identifier="svc-id" xsi:type="BusinessService"><name xml:lang="fr">Svc</name></element>
    <element identifier="ignored-id" xsi:type="UnknownFutureConcept"><name xml:lang="fr">Skip</name></element>
  </elements>
  <relationships>
    <relationship identifier="rel-acc" source="actor-id" target="svc-id" xsi:type="Access" accessType="ReadWrite"/>
    <relationship identifier="rel-ass" source="actor-id" target="svc-id" xsi:type="Association" isDirected="true"/>
    <relationship identifier="rel-inf" source="actor-id" target="svc-id" xsi:type="Influence" modifier="++"/>
    <relationship identifier="rel-named" source="actor-id" target="svc-id" xsi:type="Serving">
      <name xml:lang="fr">serves</name>
    </relationship>
    <relationship identifier="rel-skip" source="actor-id" target="svc-id" xsi:type="NotARelType"/>
  </relationships>
  <organizations>
    <item><label xml:lang="fr">Business</label><item identifierRef="actor-id"/></item>
  </organizations>
  <propertyDefinitions>
    <propertyDefinition identifier="propid-1" type="string"><name>P1</name></propertyDefinition>
  </propertyDefinitions>
  <views>
    <diagrams>
      <view identifier="view1" xsi:type="Diagram" viewpoint="Layered">
        <name xml:lang="fr">View1</name>
        <documentation xml:lang="fr">view doc</documentation>
        <node identifier="n-actor" elementRef="actor-id" xsi:type="Element" x="10" y="20" w="120" h="55">
          <style>
            <fillColor r="255" g="0" b="0" a="100"/>
            <lineColor r="0" g="0" b="0"/>
            <font name="Segoe UI" size="9"><color r="10" g="20" b="30"/></font>
          </style>
        </node>
        <node identifier="n-label" xsi:type="Label" x="0" y="0" w="100" h="40">
          <label xml:lang="fr">A label</label>
        </node>
        <connection identifier="c1" relationshipRef="rel-ass" xsi:type="Relationship" source="n-actor" target="n-label">
          <bendpoint x="50" y="30"/>
        </connection>
      </view>
    </diagrams>
  </views>
</model>`;

// ===========================================================================
// Unit tests – serializeToOpenExchange
// ===========================================================================

describe("serializeToOpenExchange", () => {
  it("produces XML with <model> root and OEF namespace", () => {
    const xml = serializeToOpenExchange(makeDataSource().model);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<model ");
    expect(xml).toContain('xmlns="http://www.opengroup.org/xsd/archimate/3.0/"');
    expect(xml).toContain("</model>");
  });

  it("embeds model name and identifier", () => {
    const xml = serializeToOpenExchange(makeDataSource({ uuid: "a-uuid", name: "OEF Model" }).model);
    expect(xml).toContain('identifier="a-uuid"');
    expect(xml).toContain(">OEF Model<");
  });

  it("uses bare element type name in xsi:type", () => {
    const elem = makeElement({ uuid: "app-1", name: "My App", type: "ApplicationComponent" });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [elem] }).model);
    expect(xml).toContain('xsi:type="ApplicationComponent"');
    expect(xml).toContain('identifier="app-1"');
    expect(xml).toContain(">My App<");
  });

  it("relationship has bare type name (no Relationship suffix) and source/target", () => {
    const src = makeElement({ uuid: "s2" });
    const tgt = makeElement({ uuid: "t2" });
    const rel = makeRelationship({ uuid: "r2", source: src, target: tgt, type: "Association" });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [src, tgt], relationships: [rel] }).model);
    expect(xml).toContain('xsi:type="Association"');
    expect(xml).toContain('source="s2"');
    expect(xml).toContain('target="t2"');
  });

  it("emits Access accessType, Association isDirected, Influence modifier", () => {
    const src = makeElement({ uuid: "rs1" });
    const tgt = makeElement({ uuid: "rt1" });
    const acc = makeRelationship({ uuid: "r-acc", source: src, target: tgt, type: "Access", access_type: "Read" });
    const ass = makeRelationship({ uuid: "r-ass", source: src, target: tgt, type: "Association", is_directed: true });
    const inf = makeRelationship({ uuid: "r-inf", source: src, target: tgt, type: "Influence", influence_strength: "+" });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [src, tgt], relationships: [acc, ass, inf] }).model);
    expect(xml).toContain('accessType="Read"');
    expect(xml).toContain('isDirected="true"');
    expect(xml).toContain('modifier="+"');
  });

  it("renders element documentation and properties", () => {
    const elem = makeElement({
      uuid: "e-docs", name: "Documented", type: "BusinessActor",
      desc: "Important actor", props: { "propid-1": "team-a", "propid-2": "high" },
    });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [elem] }).model);
    expect(xml).toContain("<documentation");
    expect(xml).toContain("Important actor");
    expect(xml).toContain('propertyDefinitionRef="propid-1"');
    expect(xml).toContain(">team-a<");
  });

  it("renders view with nodes, connections, viewpoint, documentation", () => {
    const elem = makeElement({ uuid: "ve1", type: "ApplicationComponent" });
    const node = makeNode({
      uuid: "vn1", name: null, ref: elem.uuid,
      x: 10, y: 20, w: 120, h: 55,
      fill_color: { r: 255, g: 128, b: 0 },
      line_color: { r: 0, g: 0, b: 128 },
    });
    const conn = makeConnection({ uuid: "vc1", source: "vn1", target: "vn2", ref: "rel-x", name: "arrow" });
    const view = makeView({
      uuid: "vv1", name: "App View", desc: "Application architecture",
      primary_viewpoint: "Application Platform",
      nodes: [node], conns: [conn],
    });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [elem], views: [view] }).model);
    expect(xml).toContain('viewpoint="Application Platform"');
    expect(xml).toContain("Application architecture");
    expect(xml).toContain('elementRef="ve1"');
    expect(xml).toContain('relationshipRef="rel-x"');
    expect(xml).toContain('x="10"');
    expect(xml).toContain('<fillColor r="255" g="128" b="0"');
  });

  it("renders connection with bendpoints", () => {
    const conn = makeConnection({ uuid: "c-bp", source: "n1", target: "n2", bendpoints: [{ x: 100, y: 50 }, { x: 200, y: 75 }] });
    const view = makeView({ uuid: "v-bp", nodes: [], conns: [conn] });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('<bendpoint x="100" y="50"');
    expect(xml).toContain('<bendpoint x="200" y="75"');
  });

  it("renders empty-view xsi:type=Diagram as self-closing", () => {
    const view = makeView({ uuid: "empty-v", name: "" });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('identifier="empty-v"');
    expect(xml).toContain('xsi:type="Diagram"');
  });

  it("round-trips through parseOpenExchange", () => {
    const src = makeElement({ uuid: "as", name: "Src", type: "BusinessActor" });
    const tgt = makeElement({ uuid: "at", name: "Tgt", type: "BusinessService" });
    const rel = makeRelationship({ uuid: "ar", name: "uses", source: src, target: tgt, type: "Serving" });
    const original = makeDataSource({ uuid: "am", name: "Test OEF", elements: [src, tgt], relationships: [rel] }).model;
    const parsed = parseOpenExchange(serializeToOpenExchange(original));
    expect(parsed.uuid).toBe("am");
    expect(parsed.name).toBe("Test OEF");
    expect(parsed.elements).toHaveLength(2);
    expect(parsed.relationships).toHaveLength(1);
    expect(parsed.elements.find((e) => e.uuid === "as")?.type).toBe("BusinessActor");
    expect(parsed.relationships[0]!.type).toBe("Serving");
    expect(parsed.relationships[0]!.name).toBe("uses");
  });
});

// ===========================================================================
// Unit tests – round-trip with preserved raw sections
// ===========================================================================

describe("serializeToOpenExchange – round-trip preserves organizations / propertyDefinitions", () => {
  it("preserves organizations subtree through round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const xml = serializeToOpenExchange(m);
    expect(xml).toContain("<organizations>");
    expect(xml).toContain('identifierRef="actor-id"');
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.elements).toHaveLength(m.elements.length);
  });

  it("preserves propertyDefinitions subtree through round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const xml = serializeToOpenExchange(m);
    expect(xml).toContain('<propertyDefinition identifier="propid-1"');
    expect(xml).toContain("string");
  });

  it("updates existing element in-place across round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const actor = m.elements.find((e) => e.uuid === "actor-id")!;
    actor.name = "RenamedActor";
    const xml = serializeToOpenExchange(m);
    expect(xml).toContain("RenamedActor");
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.elements.find((e) => e.uuid === "actor-id")?.name).toBe("RenamedActor");
  });

  it("appends new element and relationship after round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    m.elements.push({ uuid: "new-id", name: "NewApp", type: "ApplicationComponent", desc: null, props: {} });
    m.relationships.push({
      uuid: "new-rel", name: null, type: "Association",
      source: "new-id", target: "actor-id",
      desc: null, props: {}, access_type: null, is_directed: null, influence_strength: null,
    });
    const xml = serializeToOpenExchange(m);
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.elements.find((e) => e.uuid === "new-id")).toBeTruthy();
    expect(reparsed.relationships.find((r) => r.uuid === "new-rel")).toBeTruthy();
  });

  it("appends new view through round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    m.views.push({ uuid: "v-new", name: "NewView", desc: null, primary_viewpoint: null, nodes: [], conns: [] });
    const xml = serializeToOpenExchange(m);
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.views.find((v) => v.uuid === "v-new")).toBeTruthy();
  });

  it("removes deleted elements through round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    m.elements = [];
    m.relationships = [];
    const xml = serializeToOpenExchange(m);
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.elements).toHaveLength(0);
    expect(reparsed.relationships).toHaveLength(0);
  });

  it("renders nested container nodes", () => {
    const child = makeNode({ uuid: "child-n", ref: null, name: null, fill_color: null, line_color: null });
    const parent = makeNode({ uuid: "parent-n", ref: null, name: null, fill_color: null, line_color: null, nodes: [child] });
    const view = makeView({ uuid: "view-c", nodes: [parent], conns: [] });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('identifier="parent-n"');
    expect(xml).toContain('identifier="child-n"');
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.views[0]!.nodes[0]!.nodes).toHaveLength(1);
  });

  it("serializes view without _raw (flat path, no model fixture)", () => {
    const view = makeView({ uuid: "vfr", name: "FromScratch", primary_viewpoint: "Layered" });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('identifier="vfr"');
    expect(xml).toContain('viewpoint="Layered"');
  });
});

// ===========================================================================
// Unit tests – additional serializer branches
// ===========================================================================

describe("serializeToOpenExchange – misc branches", () => {
  it("emits relationship with documentation and properties", () => {
    const src = makeElement({ uuid: "rsp1" });
    const tgt = makeElement({ uuid: "rtp1" });
    const rel = makeRelationship({
      uuid: "r-full", source: src, target: tgt, type: "Flow",
      name: "flows", desc: "rel doc", props: { "propid-1": "v1" },
    });
    const xml = serializeToOpenExchange(makeDataSource({ elements: [src, tgt], relationships: [rel] }).model);
    expect(xml).toContain(">rel doc<");
    expect(xml).toContain('propertyDefinitionRef="propid-1"');
    expect(xml).toContain('xsi:type="Flow"');
  });

  it("emits connection without relationshipRef as xsi:type=Line", () => {
    const conn = makeConnection({ uuid: "c-line", source: "n1", target: "n2", ref: null });
    const view = makeView({ uuid: "v-line", nodes: [], conns: [conn] });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('xsi:type="Line"');
  });

  it("emits node with line_width on style", () => {
    const node = makeNode({ uuid: "n-lw", ref: null, name: null, fill_color: null, line_color: null, line_width: 3 });
    const view = makeView({ uuid: "v-lw", nodes: [node], conns: [] });
    const xml = serializeToOpenExchange(makeDataSource({ views: [view] }).model);
    expect(xml).toContain('lineWidth="3"');
  });
});

// ===========================================================================
// Unit tests – serializeToOpenExchange propertyDefinitions
// ===========================================================================

describe("serializeToOpenExchange – propertyDefinitions", () => {
  it("serializes propertyDefinitions from model", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const xml = serializeToOpenExchange(m);
    expect(xml).toContain('<propertyDefinition identifier="propid-1" type="string">');
    expect(xml).toContain("<name>P1</name>");
  });

  it("adds new propertyDefinition through round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    m.propertyDefinitions.push({ uuid: "propid-new", name: "MyNew", type: "number" });
    const xml = serializeToOpenExchange(m);
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.propertyDefinitions.find((p) => p.uuid === "propid-new")).toBeTruthy();
    expect(reparsed.propertyDefinitions.find((p) => p.uuid === "propid-new")?.type).toBe("number");
  });

  it("removes deleted propertyDefinition through round-trip", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    m.propertyDefinitions = [];
    const xml = serializeToOpenExchange(m);
    expect(xml).not.toContain("<propertyDefinitions>");
    const reparsed = parseOpenExchange(xml);
    expect(reparsed.propertyDefinitions).toHaveLength(0);
  });
});
