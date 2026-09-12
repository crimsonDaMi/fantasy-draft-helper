import { HttpError } from "../utils/http-error.js";

const ADP_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1wmjxi3K5rjIYME_lskUvquLbN331YV0vi-kg5VakpdY/export?format=csv&gid=148396479";

export class AdpClient {
  async getAdpCsv(): Promise<string> {
    const response = await fetch(ADP_SHEET_CSV_URL);

    if (!response.ok) {
      throw new HttpError(
        response.status,
        `ADP source request failed: ${response.status} ${response.statusText}`,
      );
    }

    return response.text();
  }
}