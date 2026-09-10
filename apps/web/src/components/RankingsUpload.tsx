import {
  useState,
} from "react";

import {
  importRankings,
} from "../api/fantasy-api";

import type {
  RankingImportError,
  RankingImportSummary,
} from "../types/api";

interface RankingsUploadProps {
  onImported: (
    summary: RankingImportSummary,

    rankingId: string,
  ) => void;
}

export function RankingsUpload({
  onImported,
}: RankingsUploadProps) {
  const [file, setFile] =
    useState<File>();

  const [isUploading, setIsUploading] =
    useState(false);

  const [error, setError] =
    useState<string>();

  const [validationErrors, setValidationErrors] =
    useState<RankingImportError[]>([]);

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!file) {
      setError(
        "Please select a CSV file.",
      );

      return;
    }

    try {
      setError(undefined);

      setValidationErrors([]);

      setIsUploading(true);

      const result =
        await importRankings(
          file,
        );

      onImported(
        result.summary,

        result.rankingId,
      );

      if (result.validationErrors.length > 0) {
        setValidationErrors(result.validationErrors);
        setError(
          "Import completed with CSV errors. Correct the listed rows and re-import the file.",
        );
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? `${error.message} Check the CSV headers and row values, then choose the corrected file and try again.`
          : "Failed to import rankings. Check the CSV headers and row values, then try again.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section>
      <h2>
        Import Rankings
      </h2>

      <form
        onSubmit={handleSubmit}
      >
        <input
          type="file"

          accept=".csv,text/csv"

          onChange={(event) => {
            setFile(
              event.target.files?.[0],
            );
          }}
        />

        <button
          type="submit"

          disabled={isUploading}
        >
          {isUploading
            ? "Importing..."
            : "Import Rankings"}
        </button>
      </form>

      {error && (
        <p>
          {error}
        </p>
      )}

      {validationErrors.length > 0 && (
        <ul>
          {validationErrors.map((validationError) => (
            <li key={`${validationError.row}-${validationError.message}`}>
              Row {validationError.row}: {validationError.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}