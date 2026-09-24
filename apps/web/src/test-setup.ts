import "@testing-library/jest-dom/vitest";

// @tanstack/react-virtual needs real element dimensions to compute which
// rows are visible. jsdom has no layout engine, so every element reports
// 0 for offsetHeight/clientHeight by default, which would make the
// virtualizer render zero rows in tests. Stub a fixed, non-zero size so
// virtualized lists render their normal (small, fixture-sized) content.
Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  value: 600,
});
Object.defineProperty(window.HTMLElement.prototype, "clientHeight", {
  configurable: true,
  value: 600,
});
