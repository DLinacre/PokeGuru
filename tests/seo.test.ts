import { describe, expect, it } from "vitest";
import {
  PRODUCTION_ORIGIN,
  absoluteAssetUrl,
  canonicalPath,
  canonicalUrl,
  faqSchema,
  graph,
  itemListSchema,
  webApplicationSchema,
  webSiteSchema,
} from "../src/services/seo";
import { formatTitle } from "../src/hooks/usePageMeta";

describe("canonical URLs (Vercel is the only canonical host)", () => {
  it("always resolves against the production origin", () => {
    expect(canonicalUrl("/")).toBe(PRODUCTION_ORIGIN);
    expect(canonicalUrl("/top-100")).toBe(`${PRODUCTION_ORIGIN}/top-100`);
  });

  it("strips query strings and hashes from canonical paths", () => {
    expect(canonicalPath("/search?q=charizard&sort=newest")).toBe("/search");
    expect(canonicalPath("/sets?page=2#results")).toBe("/sets");
    expect(canonicalPath("search")).toBe("/search");
  });

  it("collapses duplicate slashes", () => {
    expect(canonicalPath("//set//base1//")).toBe("/set/base1/");
  });

  it("builds absolute asset URLs", () => {
    expect(absoluteAssetUrl("/og.png")).toBe(`${PRODUCTION_ORIGIN}/og.png`);
    expect(absoluteAssetUrl("og.png")).toBe(`${PRODUCTION_ORIGIN}/og.png`);
    expect(absoluteAssetUrl("https://example.com/x.png")).toBe("https://example.com/x.png");
  });
});

describe("page titles", () => {
  it("appends the site name once", () => {
    expect(formatTitle("Card search")).toBe("Card search | PokeGuru");
  });

  it("never doubles a site suffix that a page already included", () => {
    expect(formatTitle("Top 100 most valuable Pokémon cards · PokeGuru")).toBe(
      "Top 100 most valuable Pokémon cards | PokeGuru"
    );
    expect(formatTitle("All sets | PokeGuru")).toBe("All sets | PokeGuru");
  });

  it("falls back to the brand default when no title is given", () => {
    expect(formatTitle()).toBe("PokeGuru — The Pokémon Card Guru");
  });

  it("shortens over-long titles instead of overflowing search snippets", () => {
    const long = formatTitle("A".repeat(120));
    expect(long.length).toBeLessThanOrEqual(70);
    expect(long.endsWith("| PokeGuru")).toBe(true);
  });
});

describe("structured data", () => {
  it("describes the site with a search action on the production host", () => {
    const schema = webSiteSchema();
    expect(schema["@type"]).toBe("WebSite");
    expect(schema.url).toBe(`${PRODUCTION_ORIGIN}/`);
    const action = schema.potentialAction as Record<string, unknown>;
    expect((action.target as Record<string, string>).urlTemplate).toBe(
      `${PRODUCTION_ORIGIN}/search?q={search_term_string}`
    );
  });

  it("declares the app free with no invented ratings", () => {
    const schema = webApplicationSchema();
    expect(schema.isAccessibleForFree).toBe(true);
    expect(JSON.stringify(schema)).not.toMatch(/aggregateRating|reviewCount/);
    expect(JSON.stringify(schema)).not.toMatch(/\$\d/);
  });

  it("mirrors visible FAQ copy one-to-one", () => {
    const items = [{ question: "Is it free?", answer: "Yes." }];
    const schema = faqSchema(items);
    expect(schema["@type"]).toBe("FAQPage");
    const entities = schema.mainEntity as Array<Record<string, unknown>>;
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe("Is it free?");
    expect((entities[0].acceptedAnswer as Record<string, string>).text).toBe("Yes.");
  });

  it("numbers ItemList entries from 1 and absolutises their URLs", () => {
    const schema = itemListSchema("Top cards", [
      { name: "Charizard", url: "/card/base1-4" },
      { name: "Pikachu", url: "/card/base1-58" },
    ]);
    const items = schema.itemListElement as Array<Record<string, unknown>>;
    expect(schema.numberOfItems).toBe(2);
    expect(items[0]).toMatchObject({ position: 1, name: "Charizard", url: `${PRODUCTION_ORIGIN}/card/base1-4` });
    expect(items[1]).toMatchObject({ position: 2 });
  });

  it("emits a single @graph document with the shared entities", () => {
    const doc = graph({ "@type": "WebPage", name: "Home" });
    expect(doc["@context"]).toBe("https://schema.org");
    const nodes = doc["@graph"] as Array<Record<string, unknown>>;
    const types = nodes.map((node) => node["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "WebApplication", "WebPage"]);
  });
});
