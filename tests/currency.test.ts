import { beforeEach, describe, expect, it, vi } from "vitest";
import { FX_PAYLOAD } from "./fixtures";

const FX_URL = "https://api.frankfurter.dev/v2/rates?base=EUR&quotes=GBP";

async function loadCurrency() {
  vi.resetModules();
  return import("../src/services/currency");
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("EUR -> GBP conversion", () => {
  it("uses the Frankfurter v2 rate and reports the rate date", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(FX_PAYLOAD), { status: 200 })));

    const { getEurToGbpRate } = await loadCurrency();
    const rate = await getEurToGbpRate();

    expect(rate).toMatchObject({ rate: 0.855, date: "2026-11-14", base: "EUR", quote: "GBP", source: "network" });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(FX_URL);
  });

  it("caches the rate and does not refetch within the freshness window", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(FX_PAYLOAD), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { getEurToGbpRate } = await loadCurrency();
    await getEurToGbpRate();
    const second = await getEurToGbpRate();

    expect(second?.source).toBe("cache");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when the API is unavailable and nothing is cached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));

    const { getEurToGbpRate } = await loadCurrency();
    await expect(getEurToGbpRate()).resolves.toBeNull();
  });

  it("falls back to the persisted rate when the API fails later", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(FX_PAYLOAD), { status: 200 })));
    const first = await loadCurrency();
    const fresh = await first.getEurToGbpRate();
    expect(fresh?.rate).toBe(0.855);

    // Simulate a fresh page load with no network: module cache is gone but the
    // persisted rate in localStorage remains.
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const second = await loadCurrency();
    const cached = await second.getEurToGbpRate();

    expect(cached).toMatchObject({ rate: 0.855, date: "2026-11-14", source: "cache" });
  });

  it("converts safely and never invents a rate", async () => {
    const { eurToGbp } = await loadCurrency();
    expect(eurToGbp(10, null)).toBeNull();
    expect(eurToGbp(undefined, { rate: 0.85, date: "2026-11-14", base: "EUR", quote: "GBP", fetchedAt: 0, source: "cache" })).toBeNull();
    expect(eurToGbp(10, { rate: 0.85, date: "2026-11-14", base: "EUR", quote: "GBP", fetchedAt: 0, source: "cache" })).toBeCloseTo(8.5);
  });
});
