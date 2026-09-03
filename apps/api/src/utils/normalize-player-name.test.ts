import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizePlayerName,
} from "./normalize-player-name.js";

describe(
  "normalizePlayerName",

  () => {
    it(
      "normalizes case",

      () => {
        expect(
          normalizePlayerName(
            "Patrick Mahomes",
          ),
        ).toBe(
          "patrick mahomes",
        );
      },
    );

    it(
      "removes punctuation",

      () => {
        expect(
          normalizePlayerName(
            "D.J. Moore",
          ),
        ).toBe(
          "dj moore",
        );
      },
    );

    it(
      "removes apostrophes",

      () => {
        expect(
          normalizePlayerName(
            "Ja'Marr Chase",
          ),
        ).toBe(
          "jamarr chase",
        );
      },
    );

    it(
      "normalizes whitespace",

      () => {
        expect(
          normalizePlayerName(
            "  Josh   Allen  ",
          ),
        ).toBe(
          "josh allen",
        );
      },
    );
  },
);