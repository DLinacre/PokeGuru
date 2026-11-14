import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadCache() {
  vi.resetModules();
  return import("../src/services/cache");
}

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("persistent cache", () => {
  it("returns fresh values and honours the TTL", async () => {
    const cache = await loadCache();
    cache.writeCache("key", { hello: "world" }, 50);

    expect(cache.readCache<{ hello: string }>("key")).toMatchObject({ value: { hello: "world" }, stale: false });

    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(cache.readCache("key")).toBeNull();
    expect(cache.readCache<{ hello: string }>("key", { allowStale: true })).toMatchObject({
      value: { hello: "world" },
      stale: true,
    });
  });

  it("persists across module reloads (page refreshes)", async () => {
    const first = await loadCache();
    first.writeCache("cards", [1, 2, 3], 60_000);

    const second = await loadCache();
    expect(second.readCache<number[]>("cards")?.value).toEqual([1, 2, 3]);
  });

  it("clears its own entries without touching other app storage", async () => {
    localStorage.setItem("pokeguru_collection", "[]");
    const cache = await loadCache();
    cache.writeCache("a", 1, 60_000);
    cache.clearCache();

    expect(cache.readCache("a")).toBeNull();
    expect(localStorage.getItem("pokeguru_collection")).toBe("[]");
  });

  it("does not throw when storage is unavailable", async () => {
    const cache = await loadCache();
    const original = window.localStorage.setItem;
    const spy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });

    expect(() => cache.writeCache("x", { large: true }, 60_000)).not.toThrow();
    expect(cache.readCache("x")?.value).toEqual({ large: true });

    spy.mockRestore();
    window.localStorage.setItem = original;
  });
});
