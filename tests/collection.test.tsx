import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { TcgCard } from "../src/types/pokemon";

const CARD: TcgCard = {
  id: "swsh3-136",
  name: "Furret",
  localId: "136",
  category: "Pokemon",
  images: { small: "https://assets.tcgdex.net/en/swsh/swsh3/136/low.webp" },
  set: { id: "swsh3", name: "Darkness Ablaze" },
  isDetailed: false,
};

const OTHER: TcgCard = { ...CARD, id: "swsh3-137", name: "Dubwool", localId: "137" };

async function loadStore() {
  vi.resetModules();
  return import("../src/hooks/useCollection");
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("collection vault store", () => {
  it("adds, de-duplicates and removes cards", async () => {
    const store = await loadStore();
    store.addCardToCollection(CARD);
    store.addCardToCollection(CARD);
    expect(store.isCardInCollection(CARD.id)).toBe(true);

    const saved = JSON.parse(localStorage.getItem("pokeguru_collection") ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].card.name).toBe("Furret");

    store.removeCardFromCollection(CARD.id);
    expect(store.isCardInCollection(CARD.id)).toBe(false);
    expect(JSON.parse(localStorage.getItem("pokeguru_collection") ?? "[]")).toHaveLength(0);
  });

  it("migrates the legacy pokemontcg.io collection format", async () => {
    localStorage.setItem(
      "pokeguru_collection",
      JSON.stringify([
        {
          addedAt: 1700000000000,
          card: {
            id: "base1-4",
            name: "Charizard",
            number: "4",
            artist: "Mitsuhiro Arita",
            rarity: "Rare Holo",
            supertype: "Pokémon",
            images: { small: "https://images.pokemontcg.io/base1/4.png", large: "https://images.pokemontcg.io/base1/4_hires.png" },
            set: { id: "base1", name: "Base Set", series: "Base", releaseDate: "1999-01-09" },
            tcgplayer: { prices: { holofoil: { market: 300 } } },
          },
        },
      ])
    );

    const store = await loadStore();
    const items = store.getCollectionSnapshot();
    expect(items).toHaveLength(1);
    expect(items[0].card).toMatchObject({ id: "base1-4", name: "Charizard", localId: "4" });
    expect(items[0].card.set.name).toBe("Base Set");
    expect(items[0].card.images.small).toContain("images.pokemontcg.io");
    expect(items[0].card.pricing).toBeUndefined();
  });

  it("persists across reloads and merges refreshed card data", async () => {
    const first = await loadStore();
    first.addCardToCollection(CARD);

    const second = await loadStore();
    expect(second.getCollectionSnapshot()).toHaveLength(1);

    second.updateCollectionCards([{ ...CARD, isDetailed: true, rarity: "Uncommon" }]);
    expect(second.getCollectionSnapshot()[0].card).toMatchObject({ isDetailed: true, rarity: "Uncommon" });
  });

  it("clears the vault", async () => {
    const store = await loadStore();
    store.addCardToCollection(CARD);
    store.addCardToCollection(OTHER);
    store.clearCollection();
    expect(store.getCollectionSnapshot()).toHaveLength(0);
    expect(localStorage.getItem("pokeguru_collection")).toBe("[]");
  });

  it("notifies subscribed components immediately", async () => {
    const { useCollection } = await loadStore();

    function Probe() {
      const { collection, addToCollection, removeFromCollection } = useCollection();
      return (
        <div>
          <span data-testid="count">{collection.length}</span>
          <button type="button" onClick={() => addToCollection(CARD)}>
            add
          </button>
          <button type="button" onClick={() => removeFromCollection(CARD.id)}>
            remove
          </button>
        </div>
      );
    }

    render(<Probe />);
    expect(screen.getByTestId("count").textContent).toBe("0");

    await act(async () => {
      fireEvent.click(screen.getByText("add"));
    });
    expect(screen.getByTestId("count").textContent).toBe("1");

    await act(async () => {
      fireEvent.click(screen.getByText("remove"));
    });
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
