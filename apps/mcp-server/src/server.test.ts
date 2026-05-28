import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Hoisted shared state — accessible inside vi.mock() factories
// ---------------------------------------------------------------------------

const shared = vi.hoisted(() => {
  let onInit: ((id: string) => void) | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleReq = vi.fn((_req: unknown, res: any) => {
    if (res?.status) res.status(200).json({ jsonrpc: "2.0", id: 1, result: {} });
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolHandlers = new Map<string, (args: any) => Promise<unknown>>();
  return {
    handleReq,
    toolHandlers,
    setOnInit: (fn: (id: string) => void) => { onInit = fn; },
    callOnInit: (id: string) => { if (onInit) onInit(id); },
  };
});

// ---------------------------------------------------------------------------
// Mock api package
// ---------------------------------------------------------------------------

vi.mock("api/package.json", () => ({ default: { version: "0.0.0-test" } }));

vi.mock("api/src/registry.js", () => ({
  dataSource: {
    model: { uuid: "m1", name: "Test", desc: null, version: null, views: [], elements: [], relationships: [], propertyDefinitions: [] },
    db: null,
    workspaceDbId: 1,
  },
}));

vi.mock("api/src/app.js", () => ({
  getModelInfo: vi.fn().mockReturnValue({ identifier: "m1", name: "Test" }),
  listElementTypes: vi.fn().mockReturnValue(["ApplicationComponent"]),
  listElements: vi.fn().mockReturnValue([]),
  getElementById: vi.fn().mockReturnValue(null),
  listRelationshipTypes: vi.fn().mockReturnValue(["Association"]),
  listRelationships: vi.fn().mockReturnValue([]),
  getRelationshipById: vi.fn().mockReturnValue(null),
  listViews: vi.fn().mockReturnValue([]),
  getViewById: vi.fn().mockReturnValue(null),
  createView: vi.fn().mockReturnValue({ identifier: "v1" }),
  createNode: vi.fn().mockReturnValue({ identifier: "n1" }),
  createElement: vi.fn().mockReturnValue({ identifier: "e1" }),
  updateElement: vi.fn().mockReturnValue({ identifier: "e1" }),
  deleteElement: vi.fn(),
  createRelationship: vi.fn().mockReturnValue({ identifier: "r1" }),
  updateRelationship: vi.fn().mockReturnValue({ identifier: "r1" }),
  deleteRelationship: vi.fn(),
  saveModel: vi.fn().mockReturnValue({ saved: true, path: "/data/test.xml" }),
  listPropertyDefinitions: vi.fn().mockReturnValue([]),
  getPropertyDefinitionById: vi.fn().mockReturnValue(null),
  createPropertyDefinition: vi.fn().mockReturnValue({ identifier: "pd1" }),
  updatePropertyDefinition: vi.fn().mockReturnValue({ identifier: "pd1" }),
  deletePropertyDefinition: vi.fn(),
}));

vi.mock("api/src/renderer.js", () => ({
  renderViewToSvg: vi.fn().mockReturnValue("<svg/>"),
  renderViewToPng: vi.fn().mockResolvedValue(Buffer.from("png")),
}));

vi.mock("api/src/schemas.js", () => ({
  ELEMENT_TYPES: new Set(["ApplicationComponent", "BusinessActor"]),
  RELATIONSHIP_TYPES: new Set(["Association", "Realization"]),
  PROPERTY_DEFINITION_TYPES: new Set(["string", "number"]),
}));

// ---------------------------------------------------------------------------
// Mock MCP SDK — capture registered tool handlers for direct testing
// ---------------------------------------------------------------------------

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  McpServer: vi.fn().mockImplementation(function McpServerMock(this: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.registerTool = vi.fn().mockImplementation((_name: string, _schema: unknown, handler: (args: any) => Promise<unknown>) => {
      shared.toolHandlers.set(_name, handler);
    });
    this.connect = vi.fn().mockImplementation(async () => shared.callOnInit("test-session-abc"));
  }),
}));

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StreamableHTTPServerTransport: vi.fn().mockImplementation(function TransportMock(this: any, opts: any) {
    shared.setOnInit(opts.onsessioninitialized);
    this.handleRequest = shared.handleReq;
  }),
}));

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  isInitializeRequest: vi.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { app } from "./server.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  getModelInfo, listElementTypes, listElements, getElementById,
  listRelationshipTypes, listRelationships, getRelationshipById,
  listViews, getViewById, createView, createNode,
  createElement, updateElement, deleteElement,
  createRelationship, updateRelationship, deleteRelationship,
  saveModel, listPropertyDefinitions, getPropertyDefinitionById,
  createPropertyDefinition, updatePropertyDefinition, deletePropertyDefinition,
} from "api/src/app.js";
import { renderViewToSvg, renderViewToPng } from "api/src/renderer.js";
import { dataSource } from "api/src/registry.js";

// ---------------------------------------------------------------------------
// Helper: POST initialize to create a session
// ---------------------------------------------------------------------------

async function initSession(): Promise<void> {
  vi.mocked(isInitializeRequest).mockReturnValueOnce(true);
  await request(app).post("/mcp/").send({ method: "initialize", params: {} });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
  const handler = shared.toolHandlers.get(name);
  if (!handler) throw new Error(`Tool not registered: ${name}`);
  return handler(args);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CORS middleware", () => {
  it("responds 204 to OPTIONS", async () => {
    const res = await request(app).options("/mcp/");
    expect(res.status).toBe(204);
  });

  it("sets Access-Control-Allow-Origin: *", async () => {
    const res = await request(app).options("/mcp/");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("includes POST and DELETE in Allow-Methods", async () => {
    const res = await request(app).options("/mcp/");
    const methods = res.headers["access-control-allow-methods"] as string;
    expect(methods).toContain("POST");
    expect(methods).toContain("DELETE");
  });

  it("includes mcp-session-id in Allow-Headers", async () => {
    const res = await request(app).options("/mcp/");
    expect(res.headers["access-control-allow-headers"]).toContain("mcp-session-id");
  });
});

describe("POST /mcp/", () => {
  beforeEach(() => {
    vi.mocked(isInitializeRequest).mockReturnValue(false);
    shared.handleReq.mockClear();
  });

  it("returns 400 when no session and body is not an initialize request", async () => {
    const res = await request(app).post("/mcp/").send({ method: "tools/call" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/session/i);
  });

  it("returns 400 when unknown session-id and body is not initialize", async () => {
    const res = await request(app)
      .post("/mcp/")
      .set("mcp-session-id", "unknown-session")
      .send({ method: "tools/call" });
    expect(res.status).toBe(400);
  });

  it("handles initialize request — creates session, calls transport.handleRequest", async () => {
    vi.mocked(isInitializeRequest).mockReturnValueOnce(true);
    const res = await request(app).post("/mcp/").send({ method: "initialize", params: {} });
    expect(res.status).toBe(200);
    expect(shared.handleReq).toHaveBeenCalledOnce();
  });

  it("reuses existing session when mcp-session-id header matches", async () => {
    await initSession();
    shared.handleReq.mockClear();

    const res = await request(app)
      .post("/mcp/")
      .set("mcp-session-id", "test-session-abc")
      .send({ method: "tools/call" });
    expect(res.status).toBe(200);
    expect(shared.handleReq).toHaveBeenCalledOnce();
  });
});

describe("GET /mcp/", () => {
  beforeEach(() => shared.handleReq.mockClear());

  it("returns 405 when no mcp-session-id header", async () => {
    const res = await request(app).get("/mcp/");
    expect(res.status).toBe(405);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it("returns 405 when session-id does not exist in store", async () => {
    const res = await request(app).get("/mcp/").set("mcp-session-id", "ghost");
    expect(res.status).toBe(405);
  });

  it("delegates to transport.handleRequest when session exists", async () => {
    await initSession();
    shared.handleReq.mockClear();

    const res = await request(app).get("/mcp/").set("mcp-session-id", "test-session-abc");
    expect(res.status).toBe(200);
    expect(shared.handleReq).toHaveBeenCalledOnce();
  });
});

describe("DELETE /mcp/", () => {
  beforeEach(() => shared.handleReq.mockClear());

  it("returns 404 when no mcp-session-id header", async () => {
    const res = await request(app).delete("/mcp/");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/session not found/i);
  });

  it("returns 404 when session-id does not exist in store", async () => {
    const res = await request(app).delete("/mcp/").set("mcp-session-id", "unknown");
    expect(res.status).toBe(404);
  });

  it("delegates to transport and removes session from store", async () => {
    await initSession();
    shared.handleReq.mockClear();

    const res = await request(app).delete("/mcp/").set("mcp-session-id", "test-session-abc");
    expect(res.status).toBe(200);
    expect(shared.handleReq).toHaveBeenCalledOnce();

    // session purged — next delete returns 404
    const res2 = await request(app).delete("/mcp/").set("mcp-session-id", "test-session-abc");
    expect(res2.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// MCP tool handlers — called directly via captured handlers
// ---------------------------------------------------------------------------

describe("MCP tool: get_model_info", () => {
  it("returns model info wrapped in content", async () => {
    const result = await callTool("get_model_info");
    expect(vi.mocked(getModelInfo)).toHaveBeenCalledWith(dataSource);
    expect(result.content[0].text).toContain("m1");
  });
});

describe("MCP tool: list_element_types", () => {
  it("returns element types", async () => {
    const result = await callTool("list_element_types");
    expect(vi.mocked(listElementTypes)).toHaveBeenCalledWith(dataSource);
    expect(result.content[0].text).toContain("ApplicationComponent");
  });
});

describe("MCP tool: list_elements", () => {
  it("lists elements without filter", async () => {
    const result = await callTool("list_elements", {});
    expect(vi.mocked(listElements)).toHaveBeenCalled();
    expect(result.content[0].text).toBe("[]");
  });

  it("lists elements with valid type filter", async () => {
    await callTool("list_elements", { element_type: "ApplicationComponent" });
    expect(vi.mocked(listElements)).toHaveBeenCalledWith(dataSource, "ApplicationComponent", undefined);
  });

  it("throws on invalid element_type", async () => {
    await expect(callTool("list_elements", { element_type: "InvalidType" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: get_element", () => {
  it("calls getElementById", async () => {
    await callTool("get_element", { element_id: "e1" });
    expect(vi.mocked(getElementById)).toHaveBeenCalledWith(dataSource, "e1");
  });
});

describe("MCP tool: list_relationship_types", () => {
  it("returns relationship types", async () => {
    const result = await callTool("list_relationship_types");
    expect(vi.mocked(listRelationshipTypes)).toHaveBeenCalledWith(dataSource);
    expect(result.content[0].text).toContain("Association");
  });
});

describe("MCP tool: list_relationships", () => {
  it("lists relationships without filter", async () => {
    await callTool("list_relationships", {});
    expect(vi.mocked(listRelationships)).toHaveBeenCalled();
  });

  it("throws on invalid rel_type", async () => {
    await expect(callTool("list_relationships", { rel_type: "BadType" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: get_relationship", () => {
  it("calls getRelationshipById", async () => {
    await callTool("get_relationship", { relationship_id: "r1" });
    expect(vi.mocked(getRelationshipById)).toHaveBeenCalledWith(dataSource, "r1");
  });
});

describe("MCP tool: list_views", () => {
  it("returns views", async () => {
    await callTool("list_views");
    expect(vi.mocked(listViews)).toHaveBeenCalledWith(dataSource);
  });
});

describe("MCP tool: get_view", () => {
  it("calls getViewById", async () => {
    await callTool("get_view", { view_id: "v1" });
    expect(vi.mocked(getViewById)).toHaveBeenCalledWith(dataSource, "v1");
  });
});

describe("MCP tool: create_view", () => {
  it("calls createView", async () => {
    await callTool("create_view", { name: "My View" });
    expect(vi.mocked(createView)).toHaveBeenCalledWith(dataSource, { name: "My View", viewpoint: undefined, documentation: undefined });
  });
});

describe("MCP tool: create_node", () => {
  it("calls createNode", async () => {
    await callTool("create_node", { view_id: "v1", element_id: "e1" });
    expect(vi.mocked(createNode)).toHaveBeenCalledWith(dataSource, "v1", { element_id: "e1", x: undefined, y: undefined, w: undefined, h: undefined });
  });
});

describe("MCP tool: create_element", () => {
  it("creates element with valid type", async () => {
    await callTool("create_element", { name: "MyApp", type: "ApplicationComponent" });
    expect(vi.mocked(createElement)).toHaveBeenCalled();
  });

  it("throws on invalid type", async () => {
    await expect(callTool("create_element", { name: "X", type: "BadType" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: update_element", () => {
  it("updates element name", async () => {
    await callTool("update_element", { element_id: "e1", name: "NewName" });
    expect(vi.mocked(updateElement)).toHaveBeenCalledWith(dataSource, "e1", { name: "NewName" });
  });

  it("throws on invalid type", async () => {
    await expect(callTool("update_element", { element_id: "e1", type: "BadType" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: delete_element", () => {
  it("deletes element and returns confirmation", async () => {
    const result = await callTool("delete_element", { element_id: "e1" });
    expect(vi.mocked(deleteElement)).toHaveBeenCalledWith(dataSource, "e1");
    expect(JSON.parse(result.content[0].text)).toMatchObject({ deleted: true, identifier: "e1" });
  });
});

describe("MCP tool: create_relationship", () => {
  it("creates relationship with valid type", async () => {
    await callTool("create_relationship", { type: "Association", source: "e1", target: "e2" });
    expect(vi.mocked(createRelationship)).toHaveBeenCalled();
  });

  it("throws on invalid type", async () => {
    await expect(callTool("create_relationship", { type: "BadType", source: "e1", target: "e2" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: update_relationship", () => {
  it("updates relationship name", async () => {
    await callTool("update_relationship", { relationship_id: "r1", name: "NewName" });
    expect(vi.mocked(updateRelationship)).toHaveBeenCalledWith(dataSource, "r1", { name: "NewName" });
  });

  it("throws on invalid type", async () => {
    await expect(callTool("update_relationship", { relationship_id: "r1", type: "BadType" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: delete_relationship", () => {
  it("deletes relationship and returns confirmation", async () => {
    const result = await callTool("delete_relationship", { relationship_id: "r1" });
    expect(vi.mocked(deleteRelationship)).toHaveBeenCalledWith(dataSource, "r1");
    expect(JSON.parse(result.content[0].text)).toMatchObject({ deleted: true, identifier: "r1" });
  });
});

describe("MCP tool: list_property_definitions", () => {
  it("returns property definitions", async () => {
    await callTool("list_property_definitions");
    expect(vi.mocked(listPropertyDefinitions)).toHaveBeenCalledWith(dataSource);
  });
});

describe("MCP tool: get_property_definition", () => {
  it("calls getPropertyDefinitionById", async () => {
    await callTool("get_property_definition", { id: "pd1" });
    expect(vi.mocked(getPropertyDefinitionById)).toHaveBeenCalledWith(dataSource, "pd1");
  });
});

describe("MCP tool: create_property_definition", () => {
  it("creates with valid type", async () => {
    await callTool("create_property_definition", { name: "Cost", type: "number" });
    expect(vi.mocked(createPropertyDefinition)).toHaveBeenCalled();
  });

  it("throws on invalid type", async () => {
    await expect(callTool("create_property_definition", { name: "X", type: "badtype" }))
      .rejects.toThrow(/invalide/i);
  });

  it("creates without type (defaults to string)", async () => {
    await callTool("create_property_definition", { name: "Note" });
    expect(vi.mocked(createPropertyDefinition)).toHaveBeenCalledWith(dataSource, { name: "Note", type: undefined });
  });
});

describe("MCP tool: update_property_definition", () => {
  it("updates property definition name", async () => {
    await callTool("update_property_definition", { id: "pd1", name: "NewName" });
    expect(vi.mocked(updatePropertyDefinition)).toHaveBeenCalledWith(dataSource, "pd1", { name: "NewName" });
  });

  it("throws on invalid type", async () => {
    await expect(callTool("update_property_definition", { id: "pd1", type: "badtype" }))
      .rejects.toThrow(/invalide/i);
  });
});

describe("MCP tool: delete_property_definition", () => {
  it("deletes and returns confirmation", async () => {
    const result = await callTool("delete_property_definition", { id: "pd1" });
    expect(vi.mocked(deletePropertyDefinition)).toHaveBeenCalledWith(dataSource, "pd1");
    expect(JSON.parse(result.content[0].text)).toMatchObject({ deleted: true, identifier: "pd1" });
  });
});

describe("MCP tool: save_model", () => {
  it("calls saveModel", async () => {
    const result = await callTool("save_model");
    expect(vi.mocked(saveModel)).toHaveBeenCalledWith(dataSource);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ saved: true });
  });
});

describe("MCP tool: render_view", () => {
  it("returns SVG by default when view exists", async () => {
    vi.mocked(dataSource as { model: { views: { uuid: string }[] } }).model.views = [{ uuid: "v1" } as never];
    const result = await callTool("render_view", { view_id: "v1" });
    expect(vi.mocked(renderViewToSvg)).toHaveBeenCalled();
    expect(result.content[0].mimeType).toBe("image/svg+xml");
  });

  it("returns PNG when format=png", async () => {
    vi.mocked(dataSource as { model: { views: { uuid: string }[] } }).model.views = [{ uuid: "v2" } as never];
    const result = await callTool("render_view", { view_id: "v2", format: "png" });
    expect(vi.mocked(renderViewToPng)).toHaveBeenCalled();
    expect(result.content[0].mimeType).toBe("image/png");
  });

  it("throws when view not found", async () => {
    vi.mocked(dataSource as { model: { views: unknown[] } }).model.views = [];
    await expect(callTool("render_view", { view_id: "missing" }))
      .rejects.toThrow(/introuvable/i);
  });
});
