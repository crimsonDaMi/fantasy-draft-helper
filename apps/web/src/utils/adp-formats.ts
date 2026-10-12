/** The columns of Sleeper's ADP sheet the API reads, with the labels it
 * shows for them (`ADP_FORMAT_LABELS` in the API). */
export const ADP_FORMATS = [
  { column: "Redraft PPR ADP", label: "1QB PPR" },
  { column: "Redraft Half PPR ADP", label: "1QB Half PPR" },
  { column: "Redraft SF ADP", label: "SF" },
  { column: "Dynasty PPR ADP", label: "Dynasty 1QB PPR" },
  { column: "Dynasty Half PPR ADP", label: "Dynasty 1QB Half PPR" },
  { column: "Dynasty SF ADP", label: "Dynasty SF" },
] as const;

export type AdpColumn = (typeof ADP_FORMATS)[number]["column"];
