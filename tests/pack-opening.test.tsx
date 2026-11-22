import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PackOpening from "../src/components/Packs/PackOpening";
import { configById } from "../src/data/packRules";
import type { PackConfig, PackPool, PackResult, PoolCard, RarityTier } from "../src/types/packs";

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
      image: index === 0 && tier === "common" ? "https://assets.tcgdex.net/en/sv/sv01/low.webp" : `https://assets.tcgdex.net/en/sv/sv01/${index + 1}`,
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

function renderOpening(props: Partial<React.ComponentProps<typeof PackOpening>> = {}) {
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
        meta={{ setId: "test1", setName: "Test Set", seriesId: "sv", seriesName: "Scarlet & Violet" }}
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
    </MemoryRouter>
  );

  return { onComplete, onExit, onOpenAgain };
}

describe("pack opening experience", () => {
  it("starts sealed and invites the user to open the pack", () => {
    renderOpening();
    expect(screen.getByRole("heading", { name: "Test Set" })).toBeTruthy();
    expect(screen.getByText(/Tap, click or swipe to tear open/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open this Test Set pack/ })).toBeTruthy();
    expect(screen.getByText(/Free and unlimited/)).toBeTruthy();
  });

  it("reveals the pack and shows a summary without inventing cards", async () => {
    const { onComplete } = renderOpening();
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const results = onComplete.mock.calls[0][0];
    expect(results).toHaveLength(1);
    expect(results[0].cards).toHaveLength(SV.cardsPerPack);
    for (const card of results[0].cards) expect(card.setId).toBe("test1");

    expect(await screen.findByRole("heading", { name: "Your Test Set pack" })).toBeTruthy();
    // The reveal must show the actual card, resolved through the shared artwork
    // module — never a bare broken image.
    const images = Array.from(document.querySelectorAll("img"));
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.getAttribute("src")).toMatch(/^https:\/\/assets\.tcgdex\.net\//);
      expect(image.getAttribute("src")).not.toMatch(/\.webp\//);
      expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
    }
    expect(screen.queryByText(/Image unavailable/i)).toBeNull();
    expect(screen.getByText("Best pull")).toBeTruthy();
    expect(screen.getByText(/Simulated — not owned/)).toBeTruthy();
  });

  it("opens a batch with the same rules and reports it honestly", async () => {
    const { onComplete } = renderOpening({ quantity: 5 });
    fireEvent.click(screen.getByRole("button", { name: "Open 5 packs" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const results = onComplete.mock.calls[0][0];
    expect(results).toHaveLength(5);
    for (const pack of results) expect(pack.cards).toHaveLength(SV.cardsPerPack);

    expect(await screen.findByRole("heading", { name: /5 packs of Test Set/ })).toBeTruthy();
    expect(screen.getByText("Cards pulled")).toBeTruthy();
  });

  it("never generates cards before the user opens the pack", () => {
    const { onComplete } = renderOpening();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("plays the tear beat, then reveals card by card with live announcements", async () => {
    const { onComplete } = renderOpening({ reduceMotion: false });
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));

    // The tear is a real beat, and it can always be skipped.
    expect(screen.getByText(/Tearing the wrapper/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Skip the theatre/ }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const [pack] = onComplete.mock.calls[0][0];
    const firstCard = pack.cards[0];

    // The stage starts with a face-down card that can be turned over.
    const faceDown = await screen.findByRole("button", { name: `Reveal card ${firstCard.name}` });
    fireEvent.click(faceDown);

    await waitFor(() => expect(screen.getByText(/Card 1 of 10:/)).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByText(new RegExp(`^Card 1 of ${pack.cards.length}:`))).toBeTruthy();
    // Progress is exposed as a list of revealed segments.
    expect(screen.getByText("Revealed")).toBeTruthy();

    // "Reveal all" is the honest shortcut: no extra draws, just the rest shown.
    fireEvent.click(screen.getByRole("button", { name: /Reveal all/ }));
    expect(await screen.findByRole("heading", { name: "Your Test Set pack" }, { timeout: 4000 })).toBeTruthy();
  });

  it("can skip the tear with a swipe and still generates only one pack", async () => {
    const { onComplete } = renderOpening({ reduceMotion: false });
    const pack = screen.getByRole("button", { name: /Open this Test Set pack/ });
    fireEvent.pointerDown(pack, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(pack, { clientX: 80, clientY: 24 });

    expect(screen.getByText(/Tearing the wrapper/)).toBeTruthy();
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(onComplete.mock.calls[0][0]).toHaveLength(1);
  });

  it("offers sound and motion controls", () => {
    renderOpening();
    expect(screen.getByRole("button", { name: /Muted/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Motion reduced/ })).toBeTruthy();
  });
});
