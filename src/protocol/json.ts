/**
 * A JSON primitive as it appears on the wire.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Any value that survives `JSON.stringify` and `JSON.parse` unchanged.
 */
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

/**
 * A plain JSON object. Used for free-form fields such as `pluginInfo` and `userData`.
 */
export interface JsonObject {
  [key: string]: JsonValue;
}
