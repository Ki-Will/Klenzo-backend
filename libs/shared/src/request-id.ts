/**
 * Request ID utilities.
 * Uses crypto.randomUUID() — available in Workers, Browsers, and Node ≥ 15.
 */

/**
 * Generate a new RFC 4122 v4 UUID for request correlation.
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Extract request ID from incoming headers, falling back to generating a new one.
 * Checks X-Request-ID and X-Correlation-ID in that order.
 */
export function getOrCreateRequestId(headers: Headers): string {
  return (
    headers.get('x-request-id') ||
    headers.get('x-correlation-id') ||
    generateRequestId()
  );
}

/**
 * Inject a request ID into a Headers object (mutates in place, returns it).
 */
export function injectRequestId(headers: Headers, requestId?: string): Headers {
  const id = requestId ?? generateRequestId();
  headers.set('x-request-id', id);
  return headers;
}
