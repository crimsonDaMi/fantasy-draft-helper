import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiRequestError, importRankings } from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import type { RankingImportResponse } from "../types/api";
import { ErrorMessage } from "./ErrorMessage";

interface RankingsUploadProps {
  onImported: (result: RankingImportResponse) => void;
}

export function RankingsUpload({ onImported }: RankingsUploadProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File>();
  const [isFileMissing, setIsFileMissing] = useState(false);

  const importMutation = useMutation({
    mutationFn: (csvFile: File) => importRankings(csvFile),
    onSuccess: (result) => {
      onImported(result);

      // An import always adds a new saved ranking (named after the file)
      // rather than merging into an existing one. Refresh the list so
      // the selector — here and in the editor — includes it.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rankingList(),
      });
    },
  });

  const validationErrors =
    importMutation.data?.validationErrors ??
    rejectedRowErrors(importMutation.error);
  const error = isFileMissing
    ? "Please select a CSV file."
    : describeImportError(importMutation.error, validationErrors.length);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsFileMissing(!file);

    if (file) {
      importMutation.mutate(file);
    }
  }

  return (
    <div>
      <h2>Import rankings</h2>

      <form onSubmit={handleSubmit}>
        <div className="file-upload">
          <input
            id="rankings-file"
            className="file-upload__input"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0]);
            }}
          />
          <label htmlFor="rankings-file" className="file-upload__label">
            Choose CSV
          </label>
          {file && <span className="file-upload__filename">{file.name}</span>}

          <button
            type="submit"
            className="file-upload__submit"
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? "Importing…" : "Import"}
          </button>
        </div>
      </form>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      {validationErrors.length > 0 && (
        <ul className="upload-validation-list">
          {validationErrors.map((validationError) => (
            <li key={`${validationError.row}-${validationError.message}`}>
              Row {validationError.row}: {validationError.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Row errors of an import the API rejected for having no valid rows. */
function rejectedRowErrors(
  error: Error | null,
): RankingImportResponse["validationErrors"] {
  return error instanceof ApiRequestError && Array.isArray(error.details)
    ? error.details
    : [];
}

function describeImportError(
  importError: Error | null,
  validationErrorCount: number,
): string | undefined {
  if (importError) {
    return `${importError.message} Check the CSV headers and row values, then choose the corrected file and try again.`;
  }

  if (validationErrorCount > 0) {
    return "Import completed with CSV errors. Correct the listed rows and re-import the file, then delete this incomplete ranking.";
  }

  return undefined;
}
