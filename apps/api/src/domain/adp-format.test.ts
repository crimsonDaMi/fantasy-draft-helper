import { describe, expect, it } from "vitest";

import { adpFormatFor } from "./adp-format.js";

describe("adpFormatFor", () => {
  it("uses 1QB PPR ADP for a 1QB PPR draft", () => {
    expect(
      adpFormatFor({ rosterSlots: { QB: 1, FLEX: 2 }, scoringType: "ppr" }),
    ).toEqual({ column: "Redraft PPR ADP", label: "1QB PPR" });
  });

  it("uses half-PPR ADP for a 1QB half-PPR draft", () => {
    expect(
      adpFormatFor({ rosterSlots: { QB: 1 }, scoringType: "half_ppr" }),
    ).toEqual({ column: "Redraft Half PPR ADP", label: "1QB Half PPR" });
  });

  it("uses Superflex ADP when the lineup has a SUPER_FLEX slot", () => {
    expect(
      adpFormatFor({
        rosterSlots: { QB: 1, SUPER_FLEX: 1 },
        scoringType: "half_ppr",
      }),
    ).toEqual({ column: "Redraft SF ADP", label: "SF" });
  });

  it("uses Superflex ADP for a two-QB lineup", () => {
    expect(
      adpFormatFor({ rosterSlots: { QB: 2 }, scoringType: "2qb" }),
    ).toEqual({ column: "Redraft SF ADP", label: "SF" });
  });

  it("uses dynasty ADP for dynasty drafts", () => {
    expect(
      adpFormatFor({
        rosterSlots: { QB: 1, SUPER_FLEX: 1 },
        scoringType: "dynasty_2qb",
      }),
    ).toEqual({ column: "Dynasty SF ADP", label: "Dynasty SF" });
    expect(
      adpFormatFor({ rosterSlots: { QB: 1 }, scoringType: "dynasty_ppr" }),
    ).toEqual({ column: "Dynasty PPR ADP", label: "Dynasty 1QB PPR" });
  });

  it("falls back to redraft PPR ADP without a scoring type", () => {
    expect(adpFormatFor({ rosterSlots: {} })).toEqual({
      column: "Redraft PPR ADP",
      label: "1QB PPR",
    });
  });
});
