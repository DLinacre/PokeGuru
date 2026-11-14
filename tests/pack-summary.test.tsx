import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PullSummary from "../src/components/Packs/PullSummary";
import QuickRip from "../src/components/Packs/QuickRip";
import PackPicker from "../src/components/Packs/PackPicker";
import type { PackResult, PulledCard, RarityTier } from "../src/types/packs";
import type { PackCatalogueEntry } from "../src/hooks/usePacks";
import { configById } from "../src/data/packRules";
import { pullCounts } from "../src/utils/packHighlights";

function card(
  tier: RarityTier,
  name: string,
  index = 0,
  setId = "base1",
  setName = "Base Set",
): PulledCard {
  return {
    id: `${setId}-${tier}-${index}`,
    name,
    localId: String(index),
    setId,
    setName,
    rarity: tier,
    tier,
    treatment: "normal",
    slot: "rare",
  };
}

function pack(
  cards: PulledCard[],
  index = 0,
  setId = "base1",
  setName = "Base Set",
  configId = "base",
): PackResult {
  return {
    id: `pack-${index}`,
    setId,
    setName,
    seriesId: "base",
    configId,
    openedAt: 0,
    seed: "seed",
    cards,
    bestTier: cards.reduce<RarityTier>((_best, entry) => entry.tier, "common"),
  };
}

function catalogueEntry(setId: string, setName: string): PackCatalogueEntry {
  return {
    setId,
    setName,
    seriesId: "sv",
    seriesName: "Scarlet & Violet",
    configId: "sv",
    era: "Scarlet & Violet",
    confidence: "documented",
    supported: true,
    config: configById("sv")!,
  };
}

describe("pull summary honesty", () => {
  it("shows a base-set Charizard as a real pull instead of a zero", () => {
    // Base Set's pool has one combined rare tier: TCGdex files its holos as
    // plain rares, so the summary must not promise a holo tier that cannot
    // exist there.
    const results = [
      pack(
        [
          card("common", "Weedle"),
          card("rare", "Charizard", 4),
          card("uncommon", "Potion", 5),
        ],
        0,
      ),
      pack([card("common", "Gastly", 6), card("rare", "Ninetales", 7)], 1),
    ];

    render(
      <MemoryRouter>
        <PullSummary
          results={results}
          onOpenAnother={vi.fn()}
          onBack={vi.fn()}
        />
      </MemoryRouter>,
    );

    // The count is named after the era's own top tier, and the word "no" is
    // only used when nothing hit at all.
    expect(
      screen.getAllByText(/no holo rare or better/i).length,
    ).toBeGreaterThan(0);
    // The actual cards are shown as artwork entries, not just a number.
    expect(screen.getByText(/Rare or better pulled/i)).toBeTruthy();
    expect(screen.getAllByText(/Charizard \(Rare\)/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/cards · 0 /)).toBeNull();
  });

  it("counts chase pulls for a modern set as double rare or better", () => {
    const results = [
      pack(
        [
          card("doubleRare", "Pikachu ex", 1, "sv06", "Twilight Masquerade"),
          card("common", "Pidgey", 2, "sv06", "Twilight Masquerade"),
        ],
        0,
        "sv06",
        "Twilight Masquerade",
        "sv",
      ),
      pack(
        [card("common", "Pidgeotto", 3, "sv06", "Twilight Masquerade")],
        1,
        "sv06",
        "Twilight Masquerade",
        "sv",
      ),
    ];

    render(
      <MemoryRouter>
        <PullSummary
          results={results}
          onOpenAnother={vi.fn()}
          onBack={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/Double rare or better/).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText(/Pikachu ex \(Double rare\)/).length,
    ).toBeGreaterThan(0);
  });
});

describe("era thresholds", () => {
  const basePack = pack([card("rare", "Charizard", 4)], 0);

  it("counts a plain rare as a hit when the pool has no separate holo tier", () => {
    const counts = pullCounts([basePack], { hasSeparateHolo: false });
    expect(counts.hits).toBe(1);
    expect(counts.hitLabel).toBe("Rare or better");
    expect(counts.cards[0].name).toBe("Charizard");
  });

  it("uses holo as the threshold when the pool does separate holos", () => {
    const counts = pullCounts([basePack]);
    expect(counts.hits).toBe(0);
    expect(counts.hitLabel).toBe("Holo rare or better");
    // Still shown as a real pull, not buried under the zero.
    expect(counts.notable).toBe(1);
  });

  it("uses the modern chase tier for a modern set", () => {
    const modern = pack(
      [card("doubleRare", "Pikachu ex", 1, "sv06", "Twilight Masquerade")],
      0,
      "sv06",
      "Twilight Masquerade",
      "sv",
    );
    expect(pullCounts([modern]).hitLabel).toBe("Double rare or better");
    expect(pullCounts([modern]).hits).toBe(1);
  });
});

describe("fast re-ripping", () => {
  it("offers one-press repeats at each count", () => {
    const onRipAgain = vi.fn();
    render(
      <MemoryRouter>
        <QuickRip
          packs={[
            catalogueEntry("sv01", "Scarlet & Violet"),
            catalogueEntry("sv02", "Paldea Evolved"),
          ]}
          counts={[1, 5, 36]}
          quantity={5}
          activeSetId="sv01"
          onRipAgain={onRipAgain}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /36 packs/ }));
    expect(onRipAgain).toHaveBeenCalledWith(36);
  });

  it("links straight into another set at the same pack count", () => {
    render(
      <MemoryRouter>
        <QuickRip
          packs={[
            catalogueEntry("sv01", "Scarlet & Violet"),
            catalogueEntry("sv02", "Paldea Evolved"),
          ]}
          counts={[1, 5]}
          quantity={5}
          activeSetId="sv01"
          onRipAgain={vi.fn()}
        />
      </MemoryRouter>,
    );

    const next = screen.getByRole("link", { name: /Paldea Evolved/ });
    expect(next.getAttribute("href")).toBe("/packs/sv02?count=5");
    // The set you just ripped is not offered again as a "different" set.
    expect(
      screen.queryByRole("link", { name: /Scarlet & Violet$/ }),
    ).toBeNull();
  });

  it("keeps the pack count when switching sets", () => {
    render(
      <MemoryRouter>
        <PackPicker
          packs={[
            catalogueEntry("sv01", "Scarlet & Violet"),
            catalogueEntry("sv02", "Paldea Evolved"),
            catalogueEntry("sv03", "Obsidian Flames"),
          ]}
          activeSetId="sv01"
          quantity={36}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: /Paldea Evolved/ }).getAttribute("href"),
    ).toBe("/packs/sv02?count=36&recent=sv01");
    expect(
      screen
        .getByRole("link", { name: /Scarlet & Violet/ })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});
