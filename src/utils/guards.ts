/**
 * Checks for a plain object, as opposed to `null`, an array or a primitive.
 *
 * @param value - Anything.
 * @returns `true` when `value` can be read like a record.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks for a non-empty string.
 *
 * @param value - Anything.
 * @returns `true` when `value` is a string with at least one character.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Checks for a finite number, which rules out `NaN` and the infinities.
 *
 * @param value - Anything.
 * @returns `true` when `value` is a finite number.
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

/**
 * Checks for a Discord id (a snowflake): 17 to 20 digits.
 *
 * @param value - Anything.
 * @returns `true` when `value` looks like a Discord id.
 */
export function isSnowflake(value: unknown): value is string {
  return typeof value === "string" && SNOWFLAKE_PATTERN.test(value);
}

/**
 * Marks a branch that should be impossible. TypeScript fails the build if a case is missed, and
 * this throws at runtime if bad data gets through anyway.
 *
 * @param value - The value that should have type `never` here.
 * @param context - Short label used in the error message.
 * @throws {TypeError} Always.
 */
export function assertNever(value: never, context: string): never {
  throw new TypeError(`Unexpected value in ${context}: ${JSON.stringify(value)}`);
}
