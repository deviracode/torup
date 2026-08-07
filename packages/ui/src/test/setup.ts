import "@testing-library/jest-dom/vitest";

// jsdom does not implement ResizeObserver; cmdk's CommandList uses it to
// measure list height. A no-op mock keeps it from crashing in tests.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

// jsdom does not implement scrollIntoView; cmdk calls it to scroll the
// selected item into view.
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}
