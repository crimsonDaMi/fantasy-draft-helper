import {
  useState,
} from "react";

import {
  importRankings,
} from "../api/fantasy-api";

import type {
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

      setIsUploading(true);

      const result =
        await importRankings(
          file,
        );

      onImported(
        result.summary,

        result.rankingId,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to import rankings.",
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
    </section>
  );
}