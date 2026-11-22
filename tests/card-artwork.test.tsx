import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CardArtwork from "../src/components/Cards/CardArtwork";

const BASE = "https://assets.tcgdex.net/en/sv/sv06.5/016";

describe("CardArtwork", () => {
  it("uses the cheapest published derivative first", () => {
    render(<CardArtwork card={{ id: "sv06.5-016", imageBase: BASE }} alt="Drowzee card" />);
    const img = screen.getByAltText("Drowzee card") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(`${BASE}/low.webp`);
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("falls through to the next derivative when one is missing upstream", () => {
    render(<CardArtwork card={{ id: "sv06.5-016", imageBase: BASE }} alt="Drowzee card" />);
    const src = () => (screen.getByAltText("Drowzee card") as HTMLImageElement).getAttribute("src");
    fireEvent.error(screen.getByAltText("Drowzee card"));
    expect(src()).toBe(`${BASE}/low.png`);
    fireEvent.error(screen.getByAltText("Drowzee card"));
    expect(src()).toBe(`${BASE}/high.webp`);
  });

  it("reports a load failure honestly and offers a retry", () => {
    const onStateChange = vi.fn();
    render(
      <CardArtwork card={{ id: "sv06.5-016", imageBase: BASE }} alt="Drowzee card" onStateChange={onStateChange} />
    );
    let img: HTMLImageElement = screen.getByAltText("Drowzee card") as HTMLImageElement;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      fireEvent.error(img);
      const next = screen.queryByAltText("Drowzee card") as HTMLImageElement | null;
      if (!next) break;
      img = next;
    }
    expect(screen.getByRole("img", { name: /artwork could not be loaded/i })).toBeTruthy();
    expect(screen.getByText(/tap to retry/i)).toBeTruthy();
    expect(onStateChange).toHaveBeenCalledWith("failed");

    fireEvent.click(screen.getByText(/tap to retry/i));
    return waitFor(() => {
      const retried = screen.getByAltText("Drowzee card") as HTMLImageElement;
      expect(retried.getAttribute("src")).toBe(`${BASE}/low.webp`);
    });
  });

  it("distinguishes 'no artwork published' from a broken image", () => {
    render(<CardArtwork card={{ id: "tk-sm-r-22", name: "Drowzee" }} alt="Promo Drowzee card" />);
    expect(screen.getByRole("img", { name: /no artwork available/i })).toBeTruthy();
    expect(screen.queryByAltText("Promo Drowzee card")).toBeNull();
  });

  it("fills the plate with the card's own details when no scan exists", () => {
    // Shining Fates Shiny Vault and the other subset sets have no scans in the
    // TCGdex asset library at all: the tile must still look like a card.
    render(
      <CardArtwork
        card={{
          id: "swsh4.5sv-SV122",
          name: "Eternatus VMAX",
          localId: "SV122",
          setName: "Shining Fates Shiny Vault",
          rarity: "Secret Rare",
        }}
        alt="Eternatus VMAX from Shining Fates Shiny Vault"
      />
    );
    expect(screen.getByText("Eternatus VMAX")).toBeTruthy();
    expect(screen.getByText("Shining Fates Shiny Vault · #SV122")).toBeTruthy();
    expect(screen.getByText(/no scan/i)).toBeTruthy();
    // It is labelled as a stand-in, never as the card's artwork.
    expect(screen.getByRole("img", { name: /no artwork available/i })).toBeTruthy();
  });

  it("keeps thumbnails quiet: motif only, and hidden from assistive tech", () => {
    const { container } = render(
      <CardArtwork
        card={{ id: "swsh4.5sv-SV122", name: "Eternatus VMAX", setName: "Shining Fates Shiny Vault" }}
        alt=""
        placeholder="motif"
      />
    );
    expect(screen.queryByText("Eternatus VMAX")).toBeNull();
    expect(screen.queryByText(/no scan/i)).toBeNull();
    expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
  });

  it("recovers artwork saved as a full URL", () => {
    render(<CardArtwork card={{ id: "sv06.5-016", images: { small: `${BASE}/low.webp` } }} alt="Drowzee card" />);
    const img = screen.getByAltText("Drowzee card") as HTMLImageElement;
    expect(img.getAttribute("src")).not.toContain(".webp/low");
    expect(img.getAttribute("src")).toBe(`${BASE}/low.webp`);
  });

  it("resets to the first candidate when the card changes", () => {
    const { rerender } = render(<CardArtwork card={{ id: "a", imageBase: BASE }} alt="First card" />);
    const img = screen.getByAltText("First card") as HTMLImageElement;
    fireEvent.error(img);
    expect((screen.getByAltText("First card") as HTMLImageElement).getAttribute("src")).toBe(`${BASE}/low.png`);

    rerender(<CardArtwork card={{ id: "b", imageBase: `${BASE}x` }} alt="Second card" />);
    expect((screen.getByAltText("Second card") as HTMLImageElement).getAttribute("src")).toBe(`${BASE}x/low.webp`);
  });
});
