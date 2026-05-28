/**
 * Tests for src/auth.ts — requireAuth, requireAdmin middleware and auth/users routes.
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
// Auth middleware
// ===========================================================================

describe("requireAuth middleware", () => {
  it("returns 401 when no Authorization header", async () => {
    const res = await _request(app).get("/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.detail).toMatch(/authentifié/i);
  });

  it("returns 401 when Authorization is not Bearer", async () => {
    const res = await _request(app).get("/auth/me").set("Authorization", "Basic abc");
    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid token", async () => {
    const res = await _request(app).get("/auth/me").set("Authorization", "Bearer invalid.token.here");
    expect(res.status).toBe(401);
    expect(res.body.detail).toMatch(/invalide/i);
  });

  it("passes with valid token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("admin");
  });
});

describe("requireAdmin middleware", () => {
  it("returns 403 when user role is not admin", async () => {
    const userToken = jwt.sign({ id: "test-user", username: "user", role: "user" }, JWT_SECRET);
    const res = await _request(app).get("/users").set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.detail).toMatch(/administrateurs/i);
  });
});

// ===========================================================================
// POST /auth/login
// ===========================================================================

describe("POST /auth/login", () => {
  it("returns 422 when username missing", async () => {
    const res = await _request(app).post("/auth/login").send({ password: "admin" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when password missing", async () => {
    const res = await _request(app).post("/auth/login").send({ username: "admin" });
    expect(res.status).toBe(422);
  });

  it("returns 401 for wrong credentials", async () => {
    const res = await _request(app).post("/auth/login").send({ username: "admin", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("returns token for valid credentials", async () => {
    const res = await _request(app).post("/auth/login").send({ username: "admin", password: "admin" });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });
});

// ===========================================================================
// Users routes
// ===========================================================================

describe("GET /users", () => {
  it("returns list of users", async () => {
    const res = await request(app).get("/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty("username");
    expect(res.body[0]).toHaveProperty("role");
  });
});

describe("POST /users", () => {
  it("returns 422 when username missing", async () => {
    const res = await request(app).post("/users").send({ password: "pass123" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when password missing", async () => {
    const res = await request(app).post("/users").send({ username: "newuser" });
    expect(res.status).toBe(422);
  });

  it("creates a new user", async () => {
    const username = `testuser-${Date.now()}`;
    const res = await request(app).post("/users").send({ username, password: "pass1234", role: "user" });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe(username);
    expect(res.body.role).toBe("user");
  });

  it("returns 422 for duplicate username", async () => {
    const res = await request(app).post("/users").send({ username: "admin", password: "pass1234" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when password too short", async () => {
    const res = await request(app).post("/users").send({ username: "shortpass", password: "abc" });
    expect(res.status).toBe(422);
  });
});

describe("PUT /users/:id", () => {
  it("returns 404 for unknown user id", async () => {
    const res = await request(app).put("/users/nonexistent-id").send({ role: "user" });
    expect(res.status).toBe(404);
  });

  it("updates user role", async () => {
    const listRes = await request(app).get("/users");
    const user = listRes.body.find((u: { username: string }) => u.username === "user");
    if (!user) return;
    const res = await request(app).put(`/users/${user.id}`).send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
    await request(app).put(`/users/${user.id}`).send({ role: "user" });
  });

  it("returns 200 with no changes when body is empty (no-op patch)", async () => {
    const listRes = await request(app).get("/users");
    const user = listRes.body[0];
    const res = await request(app).put(`/users/${user.id}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });
});

describe("DELETE /users/:id", () => {
  it("returns 422 when trying to delete last user", async () => {
    const listRes = await request(app).get("/users");
    const userToken = jwt.sign({ id: "solo", username: "solo", role: "admin" }, JWT_SECRET);
    if (listRes.body.length > 1) return;
    const res = await _request(app).delete(`/users/${listRes.body[0].id}`).set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(422);
  });

  it("deletes a user successfully", async () => {
    const createRes = await request(app).post("/users").send({ username: "todelete", password: "pass1234" });
    const id = createRes.body.id;
    const res = await request(app).delete(`/users/${id}`);
    expect(res.status).toBe(204);
  });

  it("returns 422 for unknown user id", async () => {
    const res = await request(app).delete("/users/nonexistent-id");
    expect(res.status).toBe(422);
  });
});
