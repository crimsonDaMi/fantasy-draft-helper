import { Draft } from "./draft.js";

/** Columns of Sleeper's ADP sheet this app reads. */
export const ADP_COLUMNS = [
  "Redraft PPR ADP",
  "Redraft SF ADP",
  "Redraft Half PPR ADP",
  "Dynasty PPR ADP",
  "Dynasty SF ADP",
  "Dynasty Half PPR ADP",
] as const;

export type AdpColumn = (typeof ADP_COLUMNS)[number];

/** Short label per column, shown next to ADP and in ranking names. */
export const ADP_FORMAT_LABELS: Record<AdpColumn, string> = {
  "Redraft PPR ADP": "1QB PPR",
  "Redraft SF ADP": "SF",
  "Redraft Half PPR ADP": "1QB Half PPR",
  "Dynasty PPR ADP": "Dynasty 1QB PPR",
  "Dynasty SF ADP": "Dynasty SF",
  "Dynasty Half PPR ADP": "Dynasty 1QB Half PPR",
};

export interface AdpFormat {
  column: AdpColumn;
  /** Short label shown next to ADP, e.g. `1QB PPR` or `Dynasty SF`. */
  label: string;
}

/**
 * Picks the ADP column matching the draft's league format: Superflex when
 * the lineup has a `SUPER_FLEX` slot or two QB slots, otherwise the 1QB
 * column for the draft's scoring. The sheet has no standard-scoring column,
 * so standard drafts use PPR ADP.
 */
export function adpFormatFor(
  draft: Pick<Draft, "rosterSlots" | "scoringType">,
): AdpFormat {
  const scoringType = draft.scoringType ?? "";
  const dynasty = scoringType.startsWith("dynasty");
  const superflex =
    (draft.rosterSlots.SUPER_FLEX ?? 0) > 0 || (draft.rosterSlots.QB ?? 0) >= 2;
  const scoring = superflex
    ? "SF"
    : scoringType.includes("half")
      ? "Half PPR"
      : "PPR";

  const column: AdpColumn = `${dynasty ? "Dynasty" : "Redraft"} ${scoring} ADP`;

  return { column, label: ADP_FORMAT_LABELS[column] };
}
