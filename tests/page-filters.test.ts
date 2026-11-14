import { describe, expect, it } from "vitest";
import { filterHydratedPage, filtersFromParams } from "../src/utils/search";
import type { TcgCard } from "../src/types/pokemon";

const card = (id: string, variants: TcgCard["variants"]): TcgCard => ({
  id,
  name: id,
  localId: "1",
  category: "Pokemon",
  images: {},
  set: { id: "swsh3", name: "Darkness Ablaze" },
  isDetailed: true,
  variants,
});

const rows = [
  { card: card("a", { normal: true }), value: 1 },
  { card: card("b", { holo: true }), value: 12.5 },
  { card: card("c", { reverse: true }), value: 4 },
  { card: card("d", undefined), value: null },
];

describe("page-scoped price and printing filters", () => {
  it("keeps only cards inside the GBP range and excludes unpriced cards", () => {
    const filters = { ...filtersFromParams(new URLSearchParams("min=2&max=13")) };
    const result = filterHydratedPage(rows, filters, (row) => row.value);
    expect(result.map((row) => row.card.id)).toEqual(["b", "c"]);
  });

  it("respects an open-ended minimum", () => {
    const filters = filtersFromParams(new URLSearchParams("min=4"));
    expect(filterHydratedPage(rows, filters, (row) => row.value).map((row) => row.card.id)).toEqual(["b", "c"]);
  });

  it("filters by printing using the card's own variant flags", () => {
    const filters = filtersFromParams(new URLSearchParams("printing=holo"));
    expect(filterHydratedPage(rows, filters, (row) => row.value).map((row) => row.card.id)).toEqual(["b"]);

    const reverse = filtersFromParams(new URLSearchParams("printing=reverse"));
    expect(filterHydratedPage(rows, reverse, (row) => row.value).map((row) => row.card.id)).toEqual(["c"]);
  });

  it("treats invalid price input as no filter rather than zero", () => {
    const filters = filtersFromParams(new URLSearchParams("min=abc"));
    expect(filterHydratedPage(rows, filters, (row) => row.value)).toHaveLength(rows.length);
  });

  it("parses collector number, illustrator and page filters from the URL", () => {
    const filters = filtersFromParams(
      new URLSearchParams("number=136&illustrator=Mitsuhiro+Arita&min=1&max=20&printing=normal")
    );
    expect(filters).toMatchObject({
      number: "136",
      illustrator: "Mitsuhiro Arita",
      minValue: "1",
      maxValue: "20",
      printing: "normal",
    });
  });
});
