import { describe, expect, it } from "vitest";
import {
  cardImageCandidates,
  cardImageSource,
  hasCardArtwork,
  imageBasePath,
  imageUrlFor,
  normaliseImageBase,
  preferredCardImage,
} from "../src/services/cardImages";

const BASE = "https://assets.tcgdex.net/en/sv/sv06.5/016";

describe("normaliseImageBase", () => {
  it("accepts a plain TCGdex asset base", () => {
    expect(normaliseImageBase(BASE)).toBe(BASE);
  });

  it("strips an already-appended quality derivative", () => {
    expect(normaliseImageBase(`${BASE}/low.webp`)).toBe(BASE);
    expect(normaliseImageBase(`${BASE}/high.png`)).toBe(BASE);
  });

  it("strips a bare extension, which used to produce …/016.webp/low.webp", () => {
    expect(normaliseImageBase(`${BASE}.webp`)).toBe(BASE);
    expect(normaliseImageBase(`${BASE}.jpg`)).toBe(BASE);
  });

  it("removes queries, fragments and trailing slashes", () => {
    expect(normaliseImageBase(`${BASE}/?v=21#art`)).toBe(BASE);
    expect(normaliseImageBase(`${BASE}///`)).toBe(BASE);
  });

  it("refuses anything that is not a TCGdex asset", () => {
    expect(normaliseImageBase(undefined)).toBeUndefined();
    expect(normaliseImageBase(null)).toBeUndefined();
    expect(normaliseImageBase("")).toBeUndefined();
    expect(normaliseImageBase("   ")).toBeUndefined();
    expect(normaliseImageBase("/relative/path")).toBeUndefined();
    expect(normaliseImageBase("https://example.com/en/sv/sv06.5/016")).toBeUndefined();
    expect(normaliseImageBase("javascript:alert(1)")).toBeUndefined();
    expect(normaliseImageBase("https://assets.tcgdex.net/en/../../etc/passwd")).toBeUndefined();
  });
});

describe("imageUrlFor / imageBasePath", () => {
  it("builds the documented derivative URLs", () => {
    expect(imageUrlFor(BASE, "low", "webp")).toBe(`${BASE}/low.webp`);
    expect(imageUrlFor(`${BASE}.webp`, "high", "png")).toBe(`${BASE}/high.png`);
  });

  it("returns undefined instead of guessing", () => {
    expect(imageUrlFor("https://example.com/x", "low", "webp")).toBeUndefined();
    expect(imageBasePath(undefined)).toBeUndefined();
    expect(imageBasePath(BASE)).toBe("/en/sv/sv06.5/016");
  });
});

describe("cardImageCandidates", () => {
  it("returns ordered thumbnails for a card with artwork", () => {
    const urls = cardImageCandidates({ imageBase: BASE }, "thumb").map((candidate) => candidate.url);
    expect(urls).toEqual([`${BASE}/low.webp`, `${BASE}/low.png`, `${BASE}/high.webp`, `${BASE}/high.png`]);
    expect(urls.every((url) => !/\.webp\/low/.test(url))).toBe(true);
  });

  it("prefers the large scan for the detail view", () => {
    expect(preferredCardImage({ imageBase: BASE }, "full")).toBe(`${BASE}/high.webp`);
    expect(preferredCardImage({ imageBase: BASE }, "thumb")).toBe(`${BASE}/low.webp`);
  });

  it("marks exactly one candidate as preferred", () => {
    const candidates = cardImageCandidates({ imageBase: BASE }, "thumb");
    expect(candidates.filter((candidate) => candidate.preferred)).toHaveLength(1);
    expect(candidates[0].preferred).toBe(true);
  });

  it("recovers a base from legacy absolute image URLs", () => {
    const urls = cardImageCandidates({ images: { small: `${BASE}/low.webp`, large: `${BASE}/high.webp` } }, "thumb").map(
      (candidate) => candidate.url
    );
    expect(urls).toEqual([`${BASE}/low.webp`, `${BASE}/low.png`, `${BASE}/high.webp`, `${BASE}/high.png`]);
  });

  it("treats a pool image base the same way", () => {
    expect(preferredCardImage({ image: BASE })).toBe(`${BASE}/low.webp`);
    expect(preferredCardImage({ image: `${BASE}/low.webp` })).toBe(`${BASE}/low.webp`);
  });

  it("keeps non-TCGdex URLs as a last resort instead of rewriting them", () => {
    const urls = cardImageCandidates({ images: { small: "https://example.com/card.webp" } }).map((candidate) => candidate.url);
    expect(urls).toEqual(["https://example.com/card.webp"]);
  });

  it("returns nothing when the API published no artwork", () => {
    expect(cardImageCandidates({})).toEqual([]);
    expect(cardImageCandidates({ imageBase: null, images: {} })).toEqual([]);
    expect(preferredCardImage({})).toBeUndefined();
    expect(hasCardArtwork({})).toBe(false);
    expect(hasCardArtwork({ imageBase: BASE })).toBe(true);
  });

  it("de-duplicates identical candidates", () => {
    const urls = cardImageCandidates({ imageBase: BASE, images: { small: `${BASE}/low.webp` } }).map((c) => c.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("cardImageSource", () => {
  it("prefers imageBase but keeps other absolute URLs available", () => {
    const source = cardImageSource({ imageBase: BASE, images: { small: "https://example.com/x.webp" } });
    expect(source.base).toBe(BASE);
    expect(source.direct).toEqual(["https://example.com/x.webp"]);
  });
});
