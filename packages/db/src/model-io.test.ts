import { describe, it, expect, beforeAll } from "vitest";
import { seedWorkspace, modelFromDb, modelToDb } from "./model-io.js";
import { runMigrations } from "./migrate.js";
import type { ArchiModel } from "./model.js";

beforeAll(() => {
  runMigrations();
});

function emptyModel(uuid: string, name = "Empty"): ArchiModel {
  return { uuid, name, desc: null, version: null, elements: [], relationships: [], propertyDefinitions: [], views: [] };
}

// ---------------------------------------------------------------------------
// seedWorkspace
// ---------------------------------------------------------------------------

describe("seedWorkspace", () => {
  it("creates workspace and returns numeric id", () => {
    const id = seedWorkspace(`SW-${Date.now()}`, emptyModel("sw-uuid-1"));
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("returns existing id when name already exists (idempotent)", () => {
    const name = `SW-dup-${Date.now()}`;
    const id1 = seedWorkspace(name, emptyModel("sw-dup-1"));
    const id2 = seedWorkspace(name, emptyModel("sw-dup-2"));
    expect(id2).toBe(id1);
  });
});

// ---------------------------------------------------------------------------
// modelFromDb — error paths
// ---------------------------------------------------------------------------

describe("modelFromDb", () => {
  it("throws when workspace id not found", () => {
    expect(() => modelFromDb(999999)).toThrow(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// Full roundtrip: modelToDb → modelFromDb
// ---------------------------------------------------------------------------

describe("modelToDb + modelFromDb roundtrip", () => {
  it("roundtrips a rich model with elements, relationships, propertyDefs, views", () => {
    const model: ArchiModel = {
      uuid: `rt-uuid-${Date.now()}`,
      name: "Roundtrip Model",
      desc: "model description",
      version: "2.0",
      propertyDefinitions: [
        { uuid: "pd1", name: "Category", type: "string" },
      ],
      elements: [
        {
          uuid: "e1", name: "App A", type: "ApplicationComponent",
          desc: "el desc", props: { pd1: "cat-a" },
        },
        {
          uuid: "e2", name: "Actor B", type: "BusinessActor",
          desc: null, props: {},
        },
      ],
      relationships: [
        {
          uuid: "r1", type: "Association", name: "uses",
          source: "e1",  // string form
          target: { uuid: "e2", name: "Actor B", type: "BusinessActor", desc: null, props: {} },  // object form
          desc: "rel desc", props: { pd1: "rel-cat" },
          access_type: "Write", is_directed: true, influence_strength: "high",
        },
        {
          uuid: "r2", type: "Realization", name: null,
          source: "e2", target: "e1",
          desc: null, props: {},
          access_type: null, is_directed: null, influence_strength: null,
        },
      ],
      views: [
        {
          uuid: "v1", name: "Main View",
          desc: "view desc", primary_viewpoint: "Layered",
          nodes: [
            {
              uuid: "n1", name: "Box A", ref: "e1",
              x: 10, y: 20, w: 120, h: 60,
              fill_color: { r: 255, g: 200, b: 100, a: 90 },
              line_color: { r: 50, g: 50, b: 50, a: 100 },
              font_color: { r: 0, g: 0, b: 0 },
              font_name: "Arial", font_size: 11, line_width: 2,
              archi_type: null,
              nodes: [
                {
                  uuid: "n2", name: null, ref: { uuid: "e2", name: "Actor B", type: "BusinessActor", desc: null, props: {} },
                  x: 5, y: 5, w: 60, h: 30,
                  fill_color: null, line_color: null, font_color: null,
                  font_name: null, font_size: null, line_width: null,
                  archi_type: null, nodes: [],
                },
              ],
            },
          ],
          conns: [
            {
              uuid: "c1", name: "Arrow",
              ref: "r1", source: "n1", target: "n2",
              line_color: { r: 80, g: 80, b: 80, a: 100 },
              font_color: { r: 0, g: 0, b: 0 },
              font_name: "Helvetica", font_size: 9, line_width: 1,
              bendpoints: [{ x: 50, y: 30 }, { x: 90, y: 55 }],
            },
            {
              uuid: "c2", name: null,
              ref: null, source: null, target: null,
              line_color: null, font_color: null,
              font_name: null, font_size: null, line_width: null,
              bendpoints: [],
            },
          ],
        },
        {
          uuid: "v2", name: "Empty View",
          desc: null, primary_viewpoint: null,
          nodes: [], conns: [],
        },
      ],
    };

    const wsId = seedWorkspace(`RT-WS-${Date.now()}`, model);
    const loaded = modelFromDb(wsId);

    // Workspace metadata
    expect(loaded.uuid).toBe(model.uuid);
    expect(loaded.desc).toBe("model description");
    expect(loaded.version).toBe("2.0");

    // Elements
    expect(loaded.elements).toHaveLength(2);
    const elA = loaded.elements.find((e) => e.uuid === "e1")!;
    expect(elA.desc).toBe("el desc");
    expect(elA.props["pd1"]).toBe("cat-a");

    // Relationships — both string and object source/target forms
    expect(loaded.relationships).toHaveLength(2);
    const rel1 = loaded.relationships.find((r) => r.uuid === "r1")!;
    expect(rel1.name).toBe("uses");
    expect(rel1.is_directed).toBe(true);
    expect(rel1.access_type).toBe("Write");
    expect(rel1.influence_strength).toBe("high");
    expect(rel1.props["pd1"]).toBe("rel-cat");
    const rel2 = loaded.relationships.find((r) => r.uuid === "r2")!;
    expect(rel2.access_type).toBeNull();
    expect(rel2.is_directed).toBeNull();

    // Property definitions
    expect(loaded.propertyDefinitions).toHaveLength(1);
    expect(loaded.propertyDefinitions[0]!.name).toBe("Category");

    // Views
    expect(loaded.views).toHaveLength(2);
    const v1 = loaded.views.find((v) => v.uuid === "v1")!;
    expect(v1.desc).toBe("view desc");
    expect(v1.primary_viewpoint).toBe("Layered");

    // Nodes — parent + nested child
    expect(v1.nodes).toHaveLength(1);
    const parentNode = v1.nodes[0]!;
    expect(parentNode.fill_color).toEqual({ r: 255, g: 200, b: 100, a: 90 });
    expect(parentNode.font_name).toBe("Arial");
    expect(parentNode.nodes).toHaveLength(1);
    const childNode = parentNode.nodes[0]!;
    expect(childNode.fill_color).toBeNull();  // null color roundtrip
    expect(childNode.line_color).toBeNull();

    // Connections
    expect(v1.conns).toHaveLength(2);
    const c1 = v1.conns.find((c) => c.uuid === "c1")!;
    expect(c1.bendpoints).toHaveLength(2);
    expect(c1.bendpoints![0]).toEqual({ x: 50, y: 30 });
    expect(c1.bendpoints![1]).toEqual({ x: 90, y: 55 });
    const c2 = v1.conns.find((c) => c.uuid === "c2")!;
    expect(c2.line_color).toBeNull();
    expect(c2.bendpoints).toHaveLength(0);

    // Empty view
    const v2 = loaded.views.find((v) => v.uuid === "v2")!;
    expect(v2.nodes).toHaveLength(0);
    expect(v2.conns).toHaveLength(0);
    expect(v2.primary_viewpoint).toBeNull();
  });

  it("replaces model data on second modelToDb call", () => {
    const initial = emptyModel(`upd-uuid-${Date.now()}`, "Initial");
    const wsId = seedWorkspace(`Upd-WS-${Date.now()}`, initial);

    const updated: ArchiModel = {
      ...initial,
      uuid: `upd-uuid2-${Date.now()}`,
      desc: "updated",
      elements: [{ uuid: "upd-e1", name: "New El", type: "ApplicationComponent", desc: null, props: {} }],
      relationships: [],
      propertyDefinitions: [],
      views: [],
    };

    modelToDb(wsId, updated);
    const loaded = modelFromDb(wsId);
    expect(loaded.desc).toBe("updated");
    expect(loaded.elements).toHaveLength(1);
    expect(loaded.elements[0]!.uuid).toBe("upd-e1");
  });

  it("handles element with multiple properties", () => {
    const model: ArchiModel = {
      uuid: `props-uuid-${Date.now()}`,
      name: "Props Model", desc: null, version: null,
      propertyDefinitions: [
        { uuid: "p1", name: "Owner", type: "string" },
        { uuid: "p2", name: "Cost", type: "number" },
      ],
      elements: [
        { uuid: "ep1", name: "El", type: "ApplicationComponent", desc: null, props: { p1: "team-a", p2: "1000" } },
      ],
      relationships: [], views: [],
    };
    const wsId = seedWorkspace(`Props-WS-${Date.now()}`, model);
    const loaded = modelFromDb(wsId);
    expect(loaded.elements[0]!.props["p1"]).toBe("team-a");
    expect(loaded.elements[0]!.props["p2"]).toBe("1000");
  });
});
