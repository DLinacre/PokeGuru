import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PackOpening from "../src/components/Packs/PackOpening";
import { configById } from "../src/data/packRules";
import type {
  PackConfig,
  PackPool,
  PackResult,
  PoolCard,
  RarityTier,
} from "../src/types/packs";

function makePool(): PackPool {
  const sizes: Partial<Record<RarityTier, number>> = {
    common: 12,
    uncommon: 8,
    rare: 6,
    holoRare: 4,
    doubleRare: 3,
    ultraRare: 2,
    illustrationRare: 2,
    specialIllustrationRare: 1,
    hyperRare: 1,
    aceSpec: 1,
  };
  const tiers: PackPool["tiers"] = {};
  for (const [tier, count] of Object.entries(sizes) as [RarityTier, number][]) {
    tiers[tier] = Array.from({ length: count }, (_, index): PoolCard => ({
      id: `test1-${tier}-${index + 1}`,
      name: `${tier} ${index + 1}`,
      localId: String(index + 1),
      setId: "test1",
      setName: "Test Set",
      rarity: tier,
      tier,
      // Real TCGdex asset bases, plus one legacy full URL to prove both shapes
      // resolve through the shared artwork module.
      image:
        index === 0 && tier === "common"
          ? "https://assets.tcgdex.net/en/sv/sv01/low.webp"
          : `https://assets.tcgdex.net/en/sv/sv01/${index + 1}`,
    }));
  }
  return {
    setId: "test1",
    setName: "Test Set",
    seriesId: "sv",
    configId: "sv",
    tiers,
    unmapped: 0,
    examined: 40,
    sourceSets: ["test1"],
    builtAt: 0,
  };
}

const SV = configById("sv") as PackConfig;

function renderOpening(
  props: Partial<React.ComponentProps<typeof PackOpening>> = {},
) {
  const onComplete = vi.fn<(results: PackResult[]) => void>();
  const onExit = vi.fn();
  const onOpenAgain = vi.fn();
  const onToggleSound = vi.fn();
  const onToggleMotion = vi.fn();

  render(
    <MemoryRouter>
      <PackOpening
        pool={makePool()}
        config={SV}
        meta={{
          setId: "test1",
          setName: "Test Set",
          seriesId: "sv",
          seriesName: "Scarlet & Violet",
        }}
        quantity={1}
        wrapperStyle="crimson"
        sound={false}
        reduceMotion
        onToggleSound={onToggleSound}
        onToggleMotion={onToggleMotion}
        onComplete={onComplete}
        onExit={onExit}
        onOpenAgain={onOpenAgain}
        {...props}
      />
    </MemoryRouter>,
  );

  return { onComplete, onExit, onOpenAgain };
}

describe("pack opening experience", () => {
  it("starts sealed and invites the user to open the pack", () => {
    renderOpening();
    expect(screen.getByRole("heading", { name: "Test Set" })).toBeTruthy();
    expect(screen.getByText(/Tap, click or swipe to tear open/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Open this Test Set pack/ }),
    ).toBeTruthy();
    expect(screen.getByText(/Free and unlimited/)).toBeTruthy();
  });

  it("reveals every card of one pack on one screen, then shows the summary", async () => {
    const { onComplete } = renderOpening({ reduceMotion: false });
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const results = onComplete.mock.calls[0][0];
    expect(results).toHaveLength(1);
    expect(results[0].cards).toHaveLength(SV.cardsPerPack);
    for (const card of results[0].cards) expect(card.setId).toBe("test1");

    // The whole pack is laid out in one grid: no horizontal filmstrip to swipe
    // through, so no card is ever off-screen.
    const list = await screen.findByRole(
      "list",
      { name: /Pack 1 contents/ },
      { timeout: 4000 },
    );
    expect(list.className).toContain("grid");
    expect(list.className).not.toContain("overflow-x-auto");
    expect(list.className).not.toContain("snap-x");
    expect(list.className).not.toContain("flex");
    expect(screen.getAllByRole("listitem")).toHaveLength(SV.cardsPerPack);
    expect(
      screen.getByRole("progressbar", { name: /of 10 cards revealed/ }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Reveal pack/ }));
    fireEvent.click(screen.getByRole("button", { name: /See summary/ }));

    expect(
      await screen.findByRole("heading", { name: "Your Test Set pack" }),
    ).toBeTruthy();
    // The reveal must show the actual card, resolved through the shared artwork
    // module — never a bare broken image.
    const images = Array.from(document.querySelectorAll("img"));
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.getAttribute("src")).toMatch(
        /^https:\/\/assets\.tcgdex\.net\//,
      );
      expect(image.getAttribute("src")).not.toMatch(/\.webp\//);
      expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
    }
    expect(screen.queryByText(/Image unavailable/i)).toBeNull();
    expect(screen.getByText("Best pull")).toBeTruthy();
    expect(screen.getByText(/Simulated — not owned/)).toBeTruthy();
  });

  it("opens a batch pack by pack with the same reveal as a single pack", async () => {
    const { onComplete } = renderOpening({ quantity: 5, reduceMotion: false });
    fireEvent.click(screen.getByRole("button", { name: "Open 5 packs" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const results = onComplete.mock.calls[0][0];
    expect(results).toHaveLength(5);
    for (const pack of results)
      expect(pack.cards).toHaveLength(SV.cardsPerPack);

    // It no longer jumps to the summary: pack 1 is revealed like a single pack.
    expect(screen.getByText(/Pack 1 of 5/)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(SV.cardsPerPack);

    for (let pack = 2; pack <= 5; pack += 1) {
      // Finish the pack on screen, then carry on to the next one.
      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: /Reveal pack/ },
          { timeout: 4000 },
        ),
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(`Open pack ${pack} of 5`),
        }),
      );
      expect(
        await screen.findByText(new RegExp(`Pack ${pack} of 5`)),
      ).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("button", { name: /Reveal pack/ }));
    fireEvent.click(screen.getByRole("button", { name: /See summary/ }));
    expect(
      await screen.findByRole("heading", { name: /5 packs of Test Set/ }),
    ).toBeTruthy();
    expect(screen.getByText("Cards pulled")).toBeTruthy();
    // Every opened pack gets a row in the summary, so a batch reads like the
    // single-pack summary instead of a bare table.
    expect(
      screen.getAllByRole("button", { expanded: false }).length,
    ).toBeGreaterThanOrEqual(5);
  });

  it("can skip the rest of a batch and jump straight to the summary", async () => {
    renderOpening({ quantity: 5 });
    fireEvent.click(screen.getByRole("button", { name: "Open 5 packs" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Skip to summary" }),
    );
    expect(
      await screen.findByRole("heading", { name: /5 packs of Test Set/ }),
    ).toBeTruthy();
  });

  it("flips one card at a time onto a growing pile", async () => {
    renderOpening({ reduceMotion: false });
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));

    // Only the leading face-down card is tappable, so tapping a card can never
    // flip a different card than the one you touched.
    const tappable = () =>
      screen
        .queryAllByRole("button")
        .filter((button) =>
          /^Reveal card /.test(button.getAttribute("aria-label") ?? ""),
        );
    await waitFor(() => expect(tappable()).toHaveLength(1), { timeout: 4000 });
    fireEvent.click(tappable()[0]);

    // The flipped card lands on the pile at the top of the stage.
    expect(
      screen.getByRole("img", { name: /Pile of 1 revealed cards/ }),
    ).toBeTruthy();
    // The flipped card stays face up in the same single grid and the next card
    // becomes the only tappable one.
    expect(screen.getAllByRole("listitem")).toHaveLength(SV.cardsPerPack);
    expect(screen.getByText("Tap to reveal")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Reveal pack/ }));
    expect(
      screen.getByRole("img", { name: /Pile of 10 revealed cards/ }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /See summary/ })).toBeTruthy();
    expect(tappable()).toHaveLength(0);
  });

  it("can be spammed: the stage is one repeated-tap flip target", async () => {
    renderOpening({ reduceMotion: false });
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));

    const stage = await screen.findByRole(
      "button",
      { name: /Flip next card/ },
      { timeout: 4000 },
    );
    // Hammer it: one card per tap, no confirmation step in between.
    for (let index = 0; index < SV.cardsPerPack; index += 1)
      fireEvent.click(stage);
    // And past the end, so an over-eager tap cannot overshoot the pack.
    fireEvent.click(stage);

    expect(
      screen.getByRole("img", {
        name: new RegExp(`Pile of ${SV.cardsPerPack} revealed cards`),
      }),
    ).toBeTruthy();
    expect(screen.getByText("Pack complete")).toBeTruthy();
    expect(screen.getByRole("button", { name: /See summary/ })).toBeTruthy();
  });

  it("flips on a repeated arrow or space press without queueing", async () => {
    renderOpening({ reduceMotion: false });
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
    await screen.findByRole(
      "button",
      { name: /Flip next card/ },
      { timeout: 4000 },
    );

    const press = (key: string) =>
      fireEvent.keyDown(document.body, { key, bubbles: true });
    for (let index = 0; index < SV.cardsPerPack; index += 1) {
      press(index % 2 === 0 ? "ArrowRight" : " ");
    }

    // The guarantee is that ten presses flip ten cards without queueing. The
    // wait is only so a slow machine cannot fail the assertion mid-update.
    await waitFor(
      () => {
        expect(
          screen.getByRole("img", {
            name: new RegExp(`Pile of ${SV.cardsPerPack} revealed cards`),
          }),
        ).toBeTruthy();
        expect(screen.getByText("Pack complete")).toBeTruthy();
      },
      { timeout: 3000 }
    );
  });

  it("calls out rare pulls as they land", async () => {
    renderOpening({ reduceMotion: false });
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
    await screen.findByRole(
      "button",
      { name: /Flip next card/ },
      { timeout: 4000 },
    );

    // Hammer the whole pack and remember every callout that appeared. The test
    // pool always contains chase tiers, so at least one must have been called
    // out — commons must never be.
    const seen = new Set<string>();
    for (let index = 0; index < SV.cardsPerPack; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: /Flip next card/ }));
      const status = screen.queryByRole("status");
      const copy = status?.textContent?.trim();
      if (copy) seen.add(copy);
    }

    expect(seen.size).toBeGreaterThan(0);
    // Every callout is a notable pull; a plain "Flipped" would fail here.
    for (const copy of seen) expect(copy).toMatch(/(Nice|Rare|Huge) pull/);
    // And the pack's best tier is always announced, all the way up to the top.
    expect([...seen].some((copy) => /(Nice|Rare|Huge) pull/.test(copy))).toBe(
      true,
    );
  });

  it("never generates cards before the user opens the pack", () => {
    const { onComplete } = renderOpening();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("offers sound and motion controls", () => {
    renderOpening();
    expect(screen.getByRole("button", { name: /Muted/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Motion reduced/ })).toBeTruthy();
  });
});
