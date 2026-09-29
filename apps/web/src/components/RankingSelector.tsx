import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteRanking, renameRanking } from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import type { RankingSummary } from "../types/api";
import { ErrorMessage } from "./ErrorMessage";

interface RankingSelectorProps {
  rankings: RankingSummary[];
  selectedRanking: RankingSummary;
  onSelect: (rankingId: string) => void;
}

/** Pick the active saved ranking, and rename or delete it. */
export function RankingSelector({
  rankings,
  selectedRanking,
  onSelect,
}: RankingSelectorProps) {
  const queryClient = useQueryClient();
  const [draftName, setDraftName] = useState<string>();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  function refreshList() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.rankingList() });
  }

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameRanking(selectedRanking.id, name),
    onSuccess: () => setDraftName(undefined),
    onSettled: refreshList,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRanking(selectedRanking.id),
    onSuccess: () => {
      setIsConfirmingDelete(false);
      const next = rankings.find(
        (ranking) => ranking.id !== selectedRanking.id,
      );
      if (next) {
        onSelect(next.id);
      }
    },
    onSettled: refreshList,
  });

  const error = renameMutation.error ?? deleteMutation.error;

  if (draftName !== undefined) {
    return (
      <form
        className="ranking-selector"
        onSubmit={(event) => {
          event.preventDefault();
          if (draftName.trim() !== "") {
            renameMutation.mutate(draftName.trim());
          }
        }}
      >
        <input
          type="text"
          value={draftName}
          maxLength={60}
          onChange={(event) => setDraftName(event.target.value)}
          aria-label="Ranking name"
        />
        <button type="submit" disabled={renameMutation.isPending}>
          Save
        </button>
        <button type="button" onClick={() => setDraftName(undefined)}>
          Cancel
        </button>
        {error && (
          <ErrorMessage className="ranking-selector__error">
            {error.message}
          </ErrorMessage>
        )}
      </form>
    );
  }

  return (
    <div className="ranking-selector">
      <select
        value={selectedRanking.id}
        onChange={(event) => {
          setIsConfirmingDelete(false);
          onSelect(event.target.value);
        }}
        aria-label="Ranking"
      >
        {rankings.map((ranking) => (
          <option key={ranking.id} value={ranking.id}>
            {ranking.name} ({ranking.playerCount})
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setDraftName(selectedRanking.name)}>
        Rename
      </button>
      {isConfirmingDelete ? (
        <>
          <span className="ranking-selector__confirm">
            Delete "{selectedRanking.name}"?
          </span>
          <button
            type="button"
            className="ranking-selector__danger"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            Delete
          </button>
          <button type="button" onClick={() => setIsConfirmingDelete(false)}>
            Keep
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setIsConfirmingDelete(true)}>
          Delete…
        </button>
      )}
      {error && (
        <ErrorMessage className="ranking-selector__error">
          {error.message}
        </ErrorMessage>
      )}
    </div>
  );
}
