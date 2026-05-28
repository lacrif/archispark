/**
 * Tests for src/oxf-parser.ts
 */

import { describe, it, expect } from "vitest";
import { parseOpenExchange } from "../src/oxf-parser.js";

// OEF_FIXTURE is duplicated here (also in oxf-serializer.test.ts) per instructions.
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
// Unit tests – parseOpenExchange: core mappings
// ===========================================================================

describe("parseOpenExchange – core mappings", () => {
  it("parses model identifier, name, version, documentation", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    expect(m.uuid).toBe("m1");
    expect(m.name).toBe("FixtureModel");
    expect(m.version).toBe("3.1");
    expect(m.desc).toBe("model doc");
  });

  it("parses And/Or Junctions as elements", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    expect(m.elements.find((e) => e.uuid === "and-id")?.type).toBe("AndJunction");
    expect(m.elements.find((e) => e.uuid === "or-id")?.type).toBe("OrJunction");
  });

  it("skips elements with unknown xsi:type", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    expect(m.elements.find((e) => e.uuid === "ignored-id")).toBeUndefined();
  });

  it("parses documentation and properties on element", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const actor = m.elements.find((e) => e.uuid === "actor-id")!;
    expect(actor.desc).toBe("actor doc");
    expect(actor.props["propid-1"]).toBe("val-1");
  });

  it("parses relationship modifiers (accessType, isDirected, modifier)", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const acc = m.relationships.find((r) => r.uuid === "rel-acc")!;
    const ass = m.relationships.find((r) => r.uuid === "rel-ass")!;
    const inf = m.relationships.find((r) => r.uuid === "rel-inf")!;
    expect(acc.access_type).toBe("ReadWrite");
    expect(ass.is_directed).toBe(true);
    expect(inf.influence_strength).toBe("++");
  });

  it("skips relationships with unknown xsi:type", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    expect(m.relationships.find((r) => r.uuid === "rel-skip")).toBeUndefined();
  });

  it("parses named relationship", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    expect(m.relationships.find((r) => r.uuid === "rel-named")?.name).toBe("serves");
  });

  it("parses view nodes with style and connections with bendpoints", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    const v = m.views[0]!;
    expect(v.uuid).toBe("view1");
    expect(v.primary_viewpoint).toBe("Layered");
    expect(v.desc).toBe("view doc");
    const actorNode = v.nodes.find((n) => n.uuid === "n-actor")!;
    expect(actorNode.x).toBe(10);
    expect(actorNode.fill_color).toMatchObject({ r: 255, g: 0, b: 0 });
    expect(actorNode.font_name).toBe("Segoe UI");
    const labelNode = v.nodes.find((n) => n.uuid === "n-label")!;
    expect(labelNode.name).toBe("A label");
    const c = v.conns[0]!;
    expect(c.uuid).toBe("c1");
    expect(c.bendpoints?.[0]).toMatchObject({ x: 50, y: 30 });
  });
});

// ===========================================================================
// Unit tests – parseOpenExchange edge cases
// ===========================================================================

describe("oxf-parser – edge cases", () => {
  it("parses model with no <elements>/<relationships>/<views> sections", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="empty-m">
  <name xml:lang="fr">Empty</name>
</model>`;
    const m = parseOpenExchange(xml);
    expect(m.elements).toHaveLength(0);
    expect(m.relationships).toHaveLength(0);
    expect(m.views).toHaveLength(0);
  });

  it("parses viewpointRef as fallback for primary_viewpoint", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="m">
  <name xml:lang="fr">M</name>
  <views><diagrams>
    <view identifier="v1" xsi:type="Diagram" viewpointRef="vp-x">
      <name xml:lang="fr">V</name>
    </view>
  </diagrams></views>
</model>`;
    const m = parseOpenExchange(xml);
    expect(m.views[0]!.primary_viewpoint).toBe("vp-x");
  });

  it("parses node without elementRef as Label kind (no ref)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="m">
  <name xml:lang="fr">M</name>
  <views><diagrams>
    <view identifier="v1" xsi:type="Diagram">
      <name xml:lang="fr">V</name>
      <node identifier="n-x" xsi:type="Label" x="0" y="0" w="10" h="10"/>
    </view>
  </diagrams></views>
</model>`;
    const m = parseOpenExchange(xml);
    expect(m.views[0]!.nodes[0]!.ref).toBeNull();
  });
});

// ===========================================================================
// Unit tests – parseOpenExchange propertyDefinitions
// ===========================================================================

describe("parseOpenExchange – propertyDefinitions", () => {
  it("parses propertyDefinitions from XML", () => {
    const m = parseOpenExchange(OEF_FIXTURE);
    expect(m.propertyDefinitions).toHaveLength(1);
    expect(m.propertyDefinitions[0]!.uuid).toBe("propid-1");
    expect(m.propertyDefinitions[0]!.name).toBe("P1");
    expect(m.propertyDefinitions[0]!.type).toBe("string");
  });

  it("returns empty array when no propertyDefinitions in XML", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="m2">
  <name xml:lang="fr">Min</name>
</model>`;
    const m = parseOpenExchange(xml);
    expect(m.propertyDefinitions).toEqual([]);
  });
});
