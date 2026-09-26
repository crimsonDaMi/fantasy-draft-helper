/**
 * Client-side (React Router) routes that live under the same URL
 * prefix as a real API namespace and would otherwise be swallowed by
 * it — either by the auth guard's protected-prefix check, or by an
 * actual registered API route whose param shape happens to match
 * (GET /rankings/:rankingId matching "edit" as the id). These must
 * always serve the SPA shell, regardless of auth state, so a direct
 * browser reload behaves the same as in-app client-side navigation.
 */
const SPA_CLIENT_ROUTES = new Set(["/rankings/edit"]);

export function isSpaClientRoute(
  method: string,
  url: string | undefined,
): boolean {
  if (method !== "GET" || !url) {
    return false;
  }

  const pathname = url.split("?")[0];

  return SPA_CLIENT_ROUTES.has(pathname);
}
