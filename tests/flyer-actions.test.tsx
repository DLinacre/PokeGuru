import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import FlyerActions from "../src/components/Flyer/FlyerActions";

const PRODUCTION_URL = "https://pokeguru.vercel.app";

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:flyer"), writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), writable: true });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("FlyerActions", () => {
  it("downloads a single PDF with the agreed filename", async () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", PRODUCTION_URL);
    render(<FlyerActions />);

    const button = screen.getByRole("button", { name: /Download PokeGuru Flyer/i });
    expect(button.textContent).toContain("🎴");

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => expect(screen.getByText(/PokeGuru-5x6-QR-Flyer\.pdf/)).toBeTruthy());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    const blob = (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("shows the production host it will print", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", PRODUCTION_URL);
    render(<FlyerActions />);
    expect(screen.getByText("pokeguru.vercel.app")).toBeTruthy();
    expect(screen.queryByText(/Flyer not configured/i)).toBeNull();
  });

  it("warns clearly instead of producing a dummy flyer when the address is missing", async () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
    render(<FlyerActions />);

    expect(screen.getByText(/Flyer not configured/i)).toBeTruthy();
    expect(screen.getByText(/VITE_PUBLIC_SITE_URL/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Download PokeGuru Flyer/i }));
    });

    await waitFor(() => expect(screen.getByText(/needs a public site address/i)).toBeTruthy());
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it("offers printing as a second, clearly labelled option", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", PRODUCTION_URL);
    render(<FlyerActions />);
    expect(screen.getByRole("button", { name: /Print flyer/i })).toBeTruthy();
  });
});
