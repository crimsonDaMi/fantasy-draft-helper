// Internal tier representation: S (best), then A-Z, skipping S's natural
// alphabetical position (it's pulled to the front instead). Numeric
// display/import conversion maps 1:1 onto this sequence: S=1, A=2, B=3, ...
const TIER_SEQUENCE = [
  "S",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

export function numericTierToLabel(n: number): string | undefined {
  if (!Number.isInteger(n) || n < 1 || n > TIER_SEQUENCE.length) {
    return undefined;
  }
  return TIER_SEQUENCE[n - 1];
}

export function labelTierToNumeric(label: string): number | undefined {
  const index = TIER_SEQUENCE.indexOf(label.trim().toUpperCase());
  return index === -1 ? undefined : index + 1;
}

export function isValidTierLabel(value: string): boolean {
  return TIER_SEQUENCE.includes(value.trim().toUpperCase());
}

/** The next-worse tier in sequence. Stays at "Z" if already there — no
+ * tier past the worst one. */
export function nextTierLabel(label: string): string {
  const index = TIER_SEQUENCE.indexOf(label.trim().toUpperCase());

  if (index === -1) {
    return label;
  }

  return TIER_SEQUENCE[Math.min(index + 1, TIER_SEQUENCE.length - 1)];
}

/** Normalizes a raw tier value (numeric string or letter) to the internal
 * label. Returns undefined if the value is missing or unrecognized. */
export function normalizeTierValue(
  value: string | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().toUpperCase();

  if (isValidTierLabel(trimmed)) {
    return trimmed;
  }

  const asNumber = Number(trimmed);

  return Number.isInteger(asNumber) ? numericTierToLabel(asNumber) : undefined;
}
