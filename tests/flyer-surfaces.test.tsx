import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Footer from "../src/components/Layout/Footer";
import FlyerPage from "../src/pages/FlyerPage";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("flyer entry points", () => {
  it("links to the dedicated flyer page from the footer instead of embedding the controls", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://pokeguru.vercel.app");
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /Printable flyer/i });
    expect(link.getAttribute("href")).toBe("/flyer");

    // The download/print controls live on /flyer only — not in the shared chrome
    // that is rendered on every page.
    expect(screen.queryByRole("button", { name: /Download PokeGuru Flyer/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Print flyer/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Share PokeGuru/i })).toBeNull();
  });

  it("gives the flyer its own page with the 5 × 6 in photo-paper dimensions", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://pokeguru.vercel.app");
    render(
      <MemoryRouter initialEntries={["/flyer"]}>
        <FlyerPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: /The PokeGuru flyer/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Download PokeGuru Flyer/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Print flyer/i })).toBeTruthy();
    expect(screen.getAllByText(/127 × 152\.4 mm/).length).toBeGreaterThan(0);
    expect(screen.getByText(/PokeGuru-5x6-QR-Flyer\.pdf/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Printing it on 5 × 6 photo paper/i })).toBeTruthy();
  });
});
