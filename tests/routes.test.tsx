import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App";
import { CARD_BRIEF, CARD_DETAIL, FX_PAYLOAD, SET_BRIEF } from "./fixtures";

const TCGDEX = "https://api.tcgdex.net/v2/en";

function installApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.frankfurter.dev")) {
        return new Response(JSON.stringify(FX_PAYLOAD), { status: 200 });
      }
      if (url === `${TCGDEX}/sets`) {
        return new Response(JSON.stringify([SET_BRIEF]), { status: 200 });
      }
      if (url === `${TCGDEX}/cards/swsh3-136`) {
        return new Response(JSON.stringify(CARD_DETAIL), { status: 200 });
      }
      if (url.startsWith(`${TCGDEX}/cards?`)) {
        return new Response(JSON.stringify([CARD_BRIEF]), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    })
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  installApi();
});

describe("routing and direct navigation", () => {
  it("renders the collection route directly", async () => {
    window.history.pushState({}, "", "/collection");
    render(<App />);
    expect(await screen.findByText("Your vault is empty")).toBeTruthy();
  });

  it("renders a deep-linked card route after a refresh", async () => {
    window.history.pushState({}, "", "/card/swsh3-136");
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "Furret" })).toBeTruthy();
    expect((await screen.findAllByText(/Darkness Ablaze/)).length).toBeGreaterThan(0);
  });

  it("renders search results for a query and reflects it in the title", async () => {
    window.history.pushState({}, "", "/search?q=pikachu");
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: /Results for/ })).toBeTruthy();
    expect(await screen.findByText("Furret")).toBeTruthy();
    expect(document.title).toContain("pikachu");
  });

  it("shows the not-found page for unknown routes", async () => {
    window.history.pushState({}, "", "/this-page-does-not-exist");
    render(<App />);
    expect(await screen.findByText("Page not found")).toBeTruthy();
  });
});
