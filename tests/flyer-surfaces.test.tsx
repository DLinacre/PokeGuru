import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Footer from "../src/components/Layout/Footer";

describe("flyer entry points", () => {
  it("puts the download in the footer of every page", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://pokeguru.vercel.app");
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /Download PokeGuru Flyer/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Print flyer/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Share PokeGuru/i })).toBeTruthy();
    vi.unstubAllEnvs();
  });
});
