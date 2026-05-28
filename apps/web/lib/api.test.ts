import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCurrentUser, viewImageUrl, fetchElements, fetchRelationships, login,
  fetchModel, fetchElementTypes, fetchRelationshipTypes, fetchViews, fetchView,
  createElement, updateElement, deleteElement,
  createRelationship, updateRelationship, deleteRelationship,
  createView, updateView, deleteView,
  saveModel, importModel,
  fetchUsers, createUser, updateUserApi, deleteUserApi,
  fetchPropertyDefinitions, createPropertyDefinition, updatePropertyDefinition, deletePropertyDefinition,
  fetchWorkspaces, createWorkspaceApi, updateWorkspaceApi, deleteWorkspaceApi, activateWorkspaceApi,
} from "./api";

function setAuthCookie(token: string) {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: `auth_token=${encodeURIComponent(token)}`,
  });
}

function clearCookie() {
  Object.defineProperty(document, "cookie", { writable: true, value: "" });
}

function makeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe("getCurrentUser", () => {
  beforeEach(clearCookie);
  afterEach(clearCookie);

  it("returns null when no cookie", () => {
    expect(getCurrentUser()).toBeNull();
  });

  it("returns decoded user from valid JWT", () => {
    const payload = { id: "u1", username: "admin", role: "admin" };
    setAuthCookie(makeJwt(payload));
    const user = getCurrentUser();
    expect(user?.username).toBe("admin");
    expect(user?.role).toBe("admin");
  });

  it("returns null for malformed token", () => {
    setAuthCookie("not.a.jwt");
    expect(getCurrentUser()).toBeNull();
  });

  it("returns null for token with no payload segment", () => {
    setAuthCookie("onlyone");
    expect(getCurrentUser()).toBeNull();
  });
});

describe("viewImageUrl", () => {
  it("generates SVG URL by default", () => {
    const url = viewImageUrl("view-1");
    expect(url).toContain("view-1");
    expect(url).toContain("format=svg");
  });

  it("generates PNG URL when requested", () => {
    const url = viewImageUrl("view-1", "png");
    expect(url).toContain("format=png");
  });

  it("encodes special characters in id", () => {
    const url = viewImageUrl("view/with spaces");
    expect(url).not.toContain(" ");
  });
});

describe("fetchElements", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ identifier: "e1", name: "App", type: "ApplicationComponent" }],
    }));
    clearCookie();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCookie();
  });

  it("fetches without filters", async () => {
    const result = await fetchElements();
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("ApplicationComponent");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements"),
      expect.any(Object)
    );
  });

  it("adds type query param when provided", async () => {
    await fetchElements("BusinessActor");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("type=BusinessActor"),
      expect.any(Object)
    );
  });

  it("adds name query param when provided", async () => {
    await fetchElements(null, "Search");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("name=Search"),
      expect.any(Object)
    );
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchElements()).rejects.toThrow("API error: 500");
  });
});

describe("fetchRelationships", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }));
    clearCookie();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCookie();
  });

  it("fetches without filters", async () => {
    const result = await fetchRelationships();
    expect(Array.isArray(result)).toBe(true);
  });

  it("adds type query param", async () => {
    await fetchRelationships("Association");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("type=Association"),
      expect.any(Object)
    );
  });
});

describe("login", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns token on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "my-token" }),
    }));
    const token = await login("admin", "admin");
    expect(token).toBe("my-token");
  });

  it("throws on wrong credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Identifiants incorrects." }),
    }));
    await expect(login("admin", "wrong")).rejects.toThrow("Identifiants incorrects.");
  });
});

// ---------------------------------------------------------------------------
// GET helpers
// ---------------------------------------------------------------------------

function mockFetchOk(data: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
}

function mockFetchError(status = 500) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ detail: `HTTP ${status}` }),
  }));
}

describe("GET functions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchModel returns model info", async () => {
    mockFetchOk({ identifier: "m1", name: "Model", element_count: 0, relationship_count: 0, view_count: 0, documentation: null, version: null, workspace_id: null, workspace_name: null });
    const m = await fetchModel();
    expect(m.identifier).toBe("m1");
  });

  it("fetchElementTypes returns string array", async () => {
    mockFetchOk(["ApplicationComponent", "BusinessActor"]);
    const types = await fetchElementTypes();
    expect(types).toContain("ApplicationComponent");
  });

  it("fetchRelationshipTypes returns string array", async () => {
    mockFetchOk(["Association", "Realization"]);
    const types = await fetchRelationshipTypes();
    expect(types).toContain("Association");
  });

  it("fetchViews returns views", async () => {
    mockFetchOk([{ identifier: "v1", name: "View 1", documentation: null }]);
    const views = await fetchViews();
    expect(views[0]!.identifier).toBe("v1");
  });

  it("fetchView returns view detail", async () => {
    mockFetchOk({ identifier: "v1", name: "View 1", documentation: null, nodes: [], connections: [] });
    const v = await fetchView("v1");
    expect(v.identifier).toBe("v1");
    expect(v.nodes).toEqual([]);
  });

  it("fetchUsers returns user list", async () => {
    mockFetchOk([{ id: "u1", username: "admin", role: "admin", created_at: "2024-01-01" }]);
    const users = await fetchUsers();
    expect(users[0]!.username).toBe("admin");
  });

  it("fetchPropertyDefinitions returns definitions", async () => {
    mockFetchOk([{ identifier: "pd1", name: "Cost", type: "string" }]);
    const defs = await fetchPropertyDefinitions();
    expect(defs[0]!.identifier).toBe("pd1");
  });

  it("fetchWorkspaces returns workspace list", async () => {
    mockFetchOk([{ id: "ws1", name: "Default", path: "/data", active: true }]);
    const ws = await fetchWorkspaces();
    expect(ws[0]!.name).toBe("Default");
  });

  it("throws API error on non-ok GET", async () => {
    mockFetchError(404);
    await expect(fetchViews()).rejects.toThrow("API error: 404");
  });
});

// ---------------------------------------------------------------------------
// Element mutations
// ---------------------------------------------------------------------------

describe("element mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createElement posts and returns element", async () => {
    mockFetchOk({ identifier: "e1", name: "App", type: "ApplicationComponent", documentation: null, properties: [] });
    const el = await createElement({ name: "App", type: "ApplicationComponent" });
    expect(el.identifier).toBe("e1");
  });

  it("updateElement puts and returns element", async () => {
    mockFetchOk({ identifier: "e1", name: "Updated", type: "ApplicationComponent", documentation: null, properties: [] });
    const el = await updateElement("e1", { name: "Updated" });
    expect(el.name).toBe("Updated");
  });

  it("deleteElement sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteElement("e1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/elements/e1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("updateElement throws on error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Not found" }),
    }));
    await expect(updateElement("bad", { name: "x" })).rejects.toThrow("Not found");
  });

  it("deleteElement throws when non-ok with no detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new Error("parse fail"); },
    }));
    await expect(deleteElement("bad")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Relationship mutations
// ---------------------------------------------------------------------------

describe("relationship mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createRelationship posts and returns relationship", async () => {
    mockFetchOk({ identifier: "r1", name: "Rel", type: "Association", source: "e1", target: "e2", documentation: null, properties: [] });
    const rel = await createRelationship({ type: "Association", source: "e1", target: "e2" });
    expect(rel.identifier).toBe("r1");
  });

  it("updateRelationship puts", async () => {
    mockFetchOk({ identifier: "r1", name: "Updated", type: "Association", source: "e1", target: "e2", documentation: null, properties: [] });
    const rel = await updateRelationship("r1", { name: "Updated" });
    expect(rel.name).toBe("Updated");
  });

  it("deleteRelationship sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteRelationship("r1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/relationships/r1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// View mutations
// ---------------------------------------------------------------------------

describe("view mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createView posts and returns view", async () => {
    mockFetchOk({ identifier: "v1", name: "New View", documentation: null });
    const v = await createView({ name: "New View" });
    expect(v.identifier).toBe("v1");
  });

  it("updateView puts", async () => {
    mockFetchOk({ identifier: "v1", name: "Renamed", documentation: null });
    const v = await updateView("v1", { name: "Renamed" });
    expect(v.name).toBe("Renamed");
  });

  it("deleteView sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteView("v1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/views/v1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// Other mutations
// ---------------------------------------------------------------------------

describe("saveModel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts and returns saved status", async () => {
    mockFetchOk({ saved: true, path: "/data/model.xml" });
    const res = await saveModel();
    expect(res.saved).toBe(true);
  });
});

describe("importModel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts XML and returns model info", async () => {
    mockFetchOk({ identifier: "m1", name: "Imported", element_count: 5, relationship_count: 2, view_count: 1, documentation: null, version: null, workspace_id: null, workspace_name: null });
    const m = await importModel("<xml/>");
    expect(m.identifier).toBe("m1");
  });

  it("throws on import error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Invalid XML" }),
    }));
    await expect(importModel("<bad")).rejects.toThrow("Invalid XML");
  });
});

// ---------------------------------------------------------------------------
// User mutations
// ---------------------------------------------------------------------------

describe("user mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createUser posts and returns user", async () => {
    mockFetchOk({ id: "u2", username: "bob", role: "user", created_at: "2024-01-01" });
    const u = await createUser({ username: "bob", password: "pass" });
    expect(u.username).toBe("bob");
  });

  it("updateUserApi puts", async () => {
    mockFetchOk({ id: "u2", username: "bob", role: "admin", created_at: "2024-01-01" });
    const u = await updateUserApi("u2", { role: "admin" });
    expect(u.role).toBe("admin");
  });

  it("deleteUserApi sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteUserApi("u2");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/users/u2"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// Property definition mutations
// ---------------------------------------------------------------------------

describe("property definition mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createPropertyDefinition posts", async () => {
    mockFetchOk({ identifier: "pd1", name: "Cost", type: "string" });
    const pd = await createPropertyDefinition({ name: "Cost" });
    expect(pd.identifier).toBe("pd1");
  });

  it("updatePropertyDefinition puts", async () => {
    mockFetchOk({ identifier: "pd1", name: "Updated", type: "string" });
    const pd = await updatePropertyDefinition("pd1", { name: "Updated" });
    expect(pd.name).toBe("Updated");
  });

  it("deletePropertyDefinition sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deletePropertyDefinition("pd1");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/property-definitions/pd1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// Workspace mutations
// ---------------------------------------------------------------------------

describe("workspace mutations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createWorkspaceApi posts", async () => {
    mockFetchOk({ id: "ws2", name: "New WS", path: "/data", active: false });
    const ws = await createWorkspaceApi({ name: "New WS" });
    expect(ws.name).toBe("New WS");
  });

  it("updateWorkspaceApi puts", async () => {
    mockFetchOk({ id: "ws2", name: "Renamed", path: "/data", active: false });
    const ws = await updateWorkspaceApi("ws2", { name: "Renamed" });
    expect(ws.name).toBe("Renamed");
  });

  it("deleteWorkspaceApi sends DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteWorkspaceApi("ws2");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/workspaces/ws2"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("activateWorkspaceApi posts to activate endpoint", async () => {
    mockFetchOk({ id: "ws2", name: "WS", path: "/data", active: true });
    const ws = await activateWorkspaceApi("ws2");
    expect(ws.active).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/workspaces/ws2/activate"),
      expect.any(Object)
    );
  });
});
