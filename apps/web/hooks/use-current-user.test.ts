import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCurrentUser, useIsAdmin } from "./use-current-user";

function setAuthCookie(payload: object) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const token = encodeURIComponent(`${header}.${body}.sig`);
  Object.defineProperty(document, "cookie", { writable: true, value: `auth_token=${token}` });
}

function clearCookie() {
  Object.defineProperty(document, "cookie", { writable: true, value: "" });
}

describe("useCurrentUser", () => {
  afterEach(clearCookie);

  it("returns null when no auth cookie", () => {
    clearCookie();
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toBeNull();
  });

  it("returns user when valid JWT in cookie", async () => {
    setAuthCookie({ id: "u1", username: "alice", role: "admin" });
    const { result } = renderHook(() => useCurrentUser());
    await act(async () => {});
    expect(result.current?.username).toBe("alice");
    expect(result.current?.role).toBe("admin");
  });
});

describe("useIsAdmin", () => {
  afterEach(clearCookie);

  it("returns false when no user", () => {
    clearCookie();
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
  });

  it("returns true when user role is admin", async () => {
    setAuthCookie({ id: "u1", username: "alice", role: "admin" });
    const { result } = renderHook(() => useIsAdmin());
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it("returns false when user role is user", async () => {
    setAuthCookie({ id: "u2", username: "bob", role: "user" });
    const { result } = renderHook(() => useIsAdmin());
    await act(async () => {});
    expect(result.current).toBe(false);
  });
});
