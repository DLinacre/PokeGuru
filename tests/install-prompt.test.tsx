import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import InstallPrompt from "../src/components/UI/InstallPrompt";

const SHOW_DELAY = 7000;
const DISMISS_KEY = "pokeguru_install_prompt_v1";

interface FakeInstallEvent extends Event {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function makeInstallEvent(buttonLabel = "beforeinstallprompt"): FakeInstallEvent {
  const event = new Event(buttonLabel, { cancelable: true }) as FakeInstallEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: "accepted" });
  return event;
}

function stubUserAgent(userAgent: string, platform = "Linux x86_64") {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
  vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
}

function stubStandalone(standalone: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: standalone && query.includes("standalone"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("InstallPrompt", () => {
  it("stays hidden until the app has loaded, then invites the visitor", async () => {
    vi.useFakeTimers();
    stubStandalone(false);
    stubUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0");

    render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });
    expect(screen.queryByText(/take pokeguru with you/i)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(SHOW_DELAY - 1);
    });
    expect(screen.queryByText(/take pokeguru with you/i)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText(/take pokeguru with you/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Install PokeGuru/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Maybe later/i })).toBeTruthy();
  });

  it("only calls the browser's install prompt after Install is chosen", async () => {
    vi.useFakeTimers();
    stubStandalone(false);
    stubUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0");

    render(<InstallPrompt />);
    const event = makeInstallEvent();
    await act(async () => {
      window.dispatchEvent(event);
      vi.advanceTimersByTime(SHOW_DELAY);
    });

    // Capturing the event must not open the browser dialogue on its own.
    expect(event.prompt).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Install PokeGuru/i }));
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it("remembers a dismissal instead of asking again on the next page view", async () => {
    vi.useFakeTimers();
    stubStandalone(false);
    stubUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0");

    const first = render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
      vi.advanceTimersByTime(SHOW_DELAY);
    });
    fireEvent.click(screen.getByRole("button", { name: /Maybe later/i }));

    expect(localStorage.getItem(DISMISS_KEY)).toBeTruthy();
    expect(screen.queryByText(/take pokeguru with you/i)).toBeNull();
    first.unmount();

    render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
      vi.advanceTimersByTime(SHOW_DELAY);
    });
    expect(screen.queryByText(/take pokeguru with you/i)).toBeNull();
  });

  it("stays hidden once the app is installed", async () => {
    vi.useFakeTimers();
    stubStandalone(true);
    stubUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0");

    render(<InstallPrompt />);
    await act(async () => {
      vi.advanceTimersByTime(SHOW_DELAY * 2);
    });
    expect(screen.queryByText(/take pokeguru with you/i)).toBeNull();
  });

  it("explains the Safari share sheet on iOS instead of pretending to install", async () => {
    vi.useFakeTimers();
    stubStandalone(false);
    stubUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1", "iPhone");

    render(<InstallPrompt />);
    await act(async () => {
      vi.advanceTimersByTime(SHOW_DELAY);
    });

    expect(screen.getByText(/take pokeguru with you/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Install PokeGuru/i }));
    expect(screen.getByText(/Add to Home Screen/i)).toBeTruthy();
    expect(screen.getByText(/Share button in Safari/i)).toBeTruthy();
  });

  it("never advertises an install it cannot perform on unsupported browsers", async () => {
    vi.useFakeTimers();
    stubStandalone(false);
    stubUserAgent("Mozilla/5.0 (Windows NT 10.0; rv:130.0) Gecko/20100101 Firefox/130.0", "Win32");

    render(<InstallPrompt />);
    await act(async () => {
      vi.advanceTimersByTime(SHOW_DELAY);
    });
    expect(screen.queryByText(/take pokeguru with you/i)).toBeNull();
  });
});
