/**
 * Result of {@link parseJson}.
 */
export type JsonParseResult = { ok: true; value: unknown } | { ok: false; error: SyntaxError };

/**
 * Parses JSON without throwing. The value comes back as `unknown`, so callers have to check its
 * shape before using it.
 *
 * @param text - JSON text.
 * @returns The parsed value, or the syntax error.
 * @example
 * ```ts
 * const result = parseJson(message);
 * if (result.ok && isRecord(result.value)) handle(result.value);
 * ```
 */
export function parseJson(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof SyntaxError ? error : new SyntaxError(String(error)),
    };
  }
}
