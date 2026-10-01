/**
 * Maps the TRUST_PROXY environment variable to Fastify's `trustProxy`
 * option, which decides whether `request.ip` comes from the
 * X-Forwarded-For header. Unset means the socket address, which behind a
 * reverse proxy is the proxy itself. Otherwise it is Fastify's
 * comma-separated list of trusted proxy IPs, CIDRs, or named ranges
 * (`loopback`, `uniquelocal`, …). Hop counts aren't supported: Fastify
 * ignores them because they can't verify the immediate peer.
 */
export function parseTrustProxy(value: string | undefined): boolean | string {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === "false") {
    return false;
  }

  if (trimmed === "true") {
    return true;
  }

  return trimmed;
}
