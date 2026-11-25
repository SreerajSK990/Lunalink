/**
 * Reads a `Retry-After` header. Servers send either a number of seconds or an HTTP date.
 *
 * @param header - Raw header value, or `null` when the header was missing.
 * @param now - Current time in Unix milliseconds. Defaults to `Date.now()`.
 * @returns Wait time in milliseconds, or `undefined` when the header is missing or unreadable.
 */
export function parseRetryAfter(
  header: string | null,
  now: number = Date.now(),
): number | undefined {
  if (header === null) return undefined;
  const value = header.trim();
  if (value.length === 0) return undefined;
  if (/^\d+(\.\d+)?$/.test(value)) return Math.round(Number(value) * 1000);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - now);
}
