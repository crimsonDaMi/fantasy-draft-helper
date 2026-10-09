import { afterEach, describe, expect, it, vi } from "vitest";

import { WindowCounter } from "./window-counter.js";

const WINDOW_MS = 15 * 60 * 1000;

describe("WindowCounter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts events per key", () => {
    const counter = new WindowCounter(WINDOW_MS);

    counter.record("a");
    counter.record("a");
    counter.record("b");

    expect(counter.count("a")).toBe(2);
    expect(counter.count("b")).toBe(1);
    expect(counter.count("c")).toBe(0);
  });

  it("starts over once the window since the first event has passed", () => {
    vi.useFakeTimers();
    const counter = new WindowCounter(WINDOW_MS);
    counter.record("a");

    vi.advanceTimersByTime(WINDOW_MS - 1);
    counter.record("a");
    expect(counter.count("a")).toBe(2);

    vi.advanceTimersByTime(1);
    expect(counter.count("a")).toBe(0);
    counter.record("a");
    expect(counter.count("a")).toBe(1);
  });

  it("clears a key", () => {
    const counter = new WindowCounter(WINDOW_MS);
    counter.record("a");

    counter.clear("a");

    expect(counter.count("a")).toBe(0);
  });

  it("sweeps expired keys that never come back", () => {
    vi.useFakeTimers();
    const counter = new WindowCounter(WINDOW_MS);
    for (let i = 0; i < 100; i += 1) {
      counter.record(`attacker-${i}`);
    }
    expect(counter.size).toBe(100);

    vi.advanceTimersByTime(WINDOW_MS);
    counter.record("someone-new");

    expect(counter.size).toBe(1);
  });
});
