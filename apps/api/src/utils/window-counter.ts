/** Counts events per key within a window that starts at the key's first
 * event. Kept in memory, so a restart resets it. Expired keys are swept
 * at most once per window, so keys that never come back don't
 * accumulate. */
export class WindowCounter {
  private readonly entries = new Map<
    string,
    { count: number; windowStartedAt: number }
  >();
  private lastSweepAt = 0;

  constructor(private readonly windowMs: number) {}

  count(key: string): number {
    const entry = this.entries.get(key);

    if (!entry) {
      return 0;
    }

    if (Date.now() - entry.windowStartedAt >= this.windowMs) {
      this.entries.delete(key);
      return 0;
    }

    return entry.count;
  }

  record(key: string): void {
    const now = Date.now();
    this.sweep(now);

    const entry = this.entries.get(key);

    if (entry && now - entry.windowStartedAt < this.windowMs) {
      entry.count += 1;
    } else {
      this.entries.set(key, { count: 1, windowStartedAt: now });
    }
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  /** Keys currently tracked, expired ones included until the next sweep. */
  get size(): number {
    return this.entries.size;
  }

  private sweep(now: number): void {
    if (now - this.lastSweepAt < this.windowMs) {
      return;
    }

    this.lastSweepAt = now;

    for (const [key, entry] of this.entries) {
      if (now - entry.windowStartedAt >= this.windowMs) {
        this.entries.delete(key);
      }
    }
  }
}
