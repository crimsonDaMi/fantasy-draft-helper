import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Inside the data volume in Docker (`/app/data/announcement.txt`), so the
 * operator can change it with `docker compose exec` and no restart. */
export const DEFAULT_ANNOUNCEMENT_PATH = resolve(
  process.cwd(),
  "data",
  "announcement.txt",
);

// Keeps a mistake in the file from filling the page.
export const MAX_ANNOUNCEMENT_LENGTH = 500;

/** The operator's message to all visitors, e.g. planned downtime, or
 * `null` when the file is missing or blank. Read on every call, so a
 * change takes effect without a restart. */
export async function readAnnouncement(path: string): Promise<string | null> {
  let content: string;

  try {
    content = await readFile(path, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  const message = content.trim();

  if (!message) {
    return null;
  }

  return message.length > MAX_ANNOUNCEMENT_LENGTH
    ? `${message.slice(0, MAX_ANNOUNCEMENT_LENGTH - 1)}…`
    : message;
}
