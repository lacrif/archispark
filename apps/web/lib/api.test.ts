import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCurrentUser, viewImageUrl, fetchElements, fetchRelationships, login } from "./api";

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
