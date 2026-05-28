/**
 * Tests for src/registry.ts — workspace routes.
 */

import { describe, it, expect } from "vitest";
import _request from "supertest";
import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../src/auth.js";
import { app } from "../src/app.js";

const _TEST_TOKEN = jwt.sign({ id: "test-admin", username: "admin", role: "admin" }, JWT_SECRET);
function request(appArg: Parameters<typeof _request>[0]) {
  return _request.agent(appArg).set("Authorization", `Bearer ${_TEST_TOKEN}`);
}

// ===========================================================================
// Workspace routes
// ===========================================================================

describe("GET /workspaces", () => {
  it("returns list with at least one workspace", async () => {
    const res = await request(app).get("/workspaces");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name");
    expect(res.body[0]).toHaveProperty("active");
  });

  it("marks one workspace as active", async () => {
    const res = await request(app).get("/workspaces");
    const active = res.body.filter((w: { active: boolean }) => w.active);
    expect(active.length).toBe(1);
  });
});

describe("POST /workspaces", () => {
  it("returns 422 when name missing", async () => {
    const res = await request(app).post("/workspaces").send({});
    expect(res.status).toBe(422);
  });

  it("creates a workspace with empty model", async () => {
    const name = `Test Workspace ${Date.now()}`;
    const res = await request(app).post("/workspaces").send({ name });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(name);
    expect(res.body).toHaveProperty("id");
  });

  it("returns 422 for duplicate workspace name", async () => {
    await request(app).post("/workspaces").send({ name: "Duplicate WS" });
    const res = await request(app).post("/workspaces").send({ name: "Duplicate WS" });
    expect(res.status).toBe(422);
  });

  it("returns 422 for missing xml file path", async () => {
    const res = await request(app).post("/workspaces").send({ name: "XML WS", path: "nonexistent.xml" });
    expect(res.status).toBe(422);
  });
});

describe("PUT /workspaces/:id", () => {
  it("returns 422 when name missing", async () => {
    const wsRes = await request(app).get("/workspaces");
    const id = wsRes.body[0].id;
    const res = await request(app).put(`/workspaces/${id}`).send({});
    expect(res.status).toBe(422);
  });

  it("renames a workspace", async () => {
    const ts = Date.now();
    const createRes = await request(app).post("/workspaces").send({ name: `ToRename WS ${ts}` });
    const id = createRes.body.id;
    const res = await request(app).put(`/workspaces/${id}`).send({ name: `Renamed WS ${ts}` });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(`Renamed WS ${ts}`);
  });

  it("returns 404 for unknown workspace id", async () => {
    const res = await request(app).put("/workspaces/99999").send({ name: "X" });
    expect(res.status).toBe(404);
  });
});

describe("POST /workspaces/:id/activate", () => {
  it("activates a workspace and marks it active", async () => {
    const createRes = await request(app).post("/workspaces").send({ name: `WS To Activate ${Date.now()}` });
    const id = createRes.body.id;
    const res = await request(app).post(`/workspaces/${id}/activate`);
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
    const wsRes = await request(app).get("/workspaces");
    const active = wsRes.body.find((w: { id: string; active: boolean }) => w.id === id);
    expect(active?.active).toBe(true);
  });

  it("returns 404 for unknown workspace id", async () => {
    const res = await request(app).post("/workspaces/99999/activate");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /workspaces/:id", () => {
  it("returns 422 when deleting last workspace", async () => {
    const wsRes = await request(app).get("/workspaces");
    if (wsRes.body.length > 1) return;
    const id = wsRes.body[0].id;
    const res = await request(app).delete(`/workspaces/${id}`);
    expect(res.status).toBe(422);
  });

  it("returns 422 when deleting active workspace", async () => {
    await request(app).post("/workspaces").send({ name: "Extra WS for delete test" });
    const wsRes = await request(app).get("/workspaces");
    const active = wsRes.body.find((w: { active: boolean }) => w.active);
    const res = await request(app).delete(`/workspaces/${active.id}`);
    expect(res.status).toBe(422);
  });

  it("deletes an inactive workspace", async () => {
    const createRes = await request(app).post("/workspaces").send({ name: "WS To Delete" });
    const id = createRes.body.id;
    const res = await request(app).delete(`/workspaces/${id}`);
    expect(res.status).toBe(204);
  });

  it("returns 422 for unknown workspace id", async () => {
    await request(app).post("/workspaces").send({ name: "Extra WS for unknown delete" });
    const res = await request(app).delete("/workspaces/99999");
    expect(res.status).toBe(422);
  });
});
