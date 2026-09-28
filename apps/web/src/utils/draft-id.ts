/** The draft ID from what the user entered: a bare ID, or a pasted Sleeper
 * draft link such as `https://sleeper.com/draft/nfl/1234567890` (the only
 * way to reach mock drafts, which Sleeper doesn't list by user). Anything
 * else is returned trimmed, for the API to reject. */
export function parseDraftId(input: string): string {
  const trimmed = input.trim();

  return trimmed.match(/\/draft\/[a-z]+\/(\d+)/i)?.[1] ?? trimmed;
}
