import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createRankingFromAdp } from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import { ADP_FORMATS, type AdpColumn } from "../utils/adp-formats";
import { ErrorMessage } from "./ErrorMessage";

interface AdpRankingStartProps {
  /** Preselected ADP column, e.g. the monitored draft's; the first format
   * when omitted or not one of `ADP_FORMATS`. */
  defaultColumn?: string;
  onCreated: (rankingId: string) => void;
}

/** Starts a saved ranking from Sleeper's ADP, for users without a CSV. */
export function AdpRankingStart({
  defaultColumn,
  onCreated,
}: AdpRankingStartProps) {
  const queryClient = useQueryClient();
  const selectId = useId();
  // Follows `defaultColumn` (which can arrive after the first render)
  // until the user picks a format.
  const [pickedColumn, setPickedColumn] = useState<AdpColumn>();
  const column =
    pickedColumn ??
    ADP_FORMATS.find((format) => format.column === defaultColumn)?.column ??
    ADP_FORMATS[0].column;

  const createMutation = useMutation({
    mutationFn: createRankingFromAdp,
    onSuccess: ({ rankingId }) => {
      onCreated(rankingId);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rankingList(),
      });
    },
  });

  return (
    <div className="adp-ranking-start">
      <label htmlFor={selectId}>No CSV? Start from Sleeper ADP:</label>
      <span className="adp-ranking-start__controls">
        <select
          id={selectId}
          className="select"
          value={column}
          onChange={(event) => setPickedColumn(event.target.value as AdpColumn)}
        >
          {ADP_FORMATS.map((format) => (
            <option key={format.column} value={format.column}>
              {format.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button-secondary"
          onClick={() => createMutation.mutate(column)}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? "Creating…" : "Create ranking"}
        </button>
      </span>
      {createMutation.error && (
        <ErrorMessage onRetry={() => createMutation.mutate(column)}>
          Couldn't create the ranking: {createMutation.error.message}
        </ErrorMessage>
      )}
    </div>
  );
}
