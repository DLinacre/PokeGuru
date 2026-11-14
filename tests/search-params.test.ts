import { describe, expect, it } from "vitest";
import {
  applyParamUpdates,
  describeFilters,
  filtersFromParams,
  parsePage,
  parseSort,
  SEARCH_PAGE_SIZE,
} from "../src/utils/search";

describe("search URL parameters", () => {
  it("parses defaults", () => {
    const filters = filtersFromParams(new URLSearchParams());
    expect(filters).toEqual({
      query: "",
      category: "",
      rarity: "",
      setId: "",
      sort: "name",
      page: 1,
      pageSize: SEARCH_PAGE_SIZE,
    });
  });

  it("normalises legacy title-cased rarity links to the exact TCGdex value", () => {
    const filters = filtersFromParams(new URLSearchParams("rarity=Special+Illustration+Rare"));
    expect(filters.rarity).toBe("Special illustration rare");
  });

  it("parses every supported filter from the URL", () => {
    const filters = filtersFromParams(
      new URLSearchParams("q=charizard&category=Pokemon&rarity=Illustration+Rare&set=sv03.5&sort=value_high&page=3")
    );
    expect(filters).toMatchObject({
      query: "charizard",
      category: "Pokemon",
      rarity: "Illustration rare",
      setId: "sv03.5",
      sort: "value_high",
      page: 3,
    });
  });

  it("rejects invalid sort and page values", () => {
    expect(parseSort("nonsense")).toBe("name");
    expect(parseSort(null)).toBe("name");
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("2.9")).toBe(2);
  });

  it("resets pagination whenever a filter changes", () => {
    const current = new URLSearchParams("q=pikachu&page=4");
    const next = applyParamUpdates(current, { rarity: "Common" });
    expect(next.get("rarity")).toBe("Common");
    expect(next.get("page")).toBeNull();
    expect(next.get("q")).toBe("pikachu");
  });

  it("keeps an explicit page when only the page changes", () => {
    const current = new URLSearchParams("q=pikachu");
    expect(applyParamUpdates(current, { page: 3 }).get("page")).toBe("3");
    expect(applyParamUpdates(current, { page: 1 }).get("page")).toBeNull();
  });

  it("drops empty values and describes active filters", () => {
    const current = new URLSearchParams("q=x&rarity=Common&set=swsh3");
    const next = applyParamUpdates(current, { rarity: "", set: "swsh3", category: "Pokemon" });
    expect(next.get("rarity")).toBeNull();
    expect(describeFilters(filtersFromParams(next))).toBe("“x” · Pokémon · set swsh3");
  });
});
