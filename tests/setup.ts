import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // jsdom does not implement scrolling.
  Object.defineProperty(window, "scrollTo", { value: () => {}, writable: true });
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
});
