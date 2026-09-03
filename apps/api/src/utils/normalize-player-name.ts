export function normalizePlayerName(
  name: string,
): string {
  return name
    .toLowerCase()
    .trim()

    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

    .replace(/[.'’`-]/g, "")

    .replace(/\s+/g, " ");
}