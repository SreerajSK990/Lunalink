/**
 * A read-only view of `T`, all the way down.
 */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

/**
 * Freezes an object and everything inside it. Lunalink uses it for snapshots it hands to
 * plugins, so one plugin can't change data that another plugin or the core relies on.
 *
 * @param value - Object to freeze. It is frozen in place.
 * @returns The same object, typed as deeply read-only.
 */
export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
  }
  return value as DeepReadonly<T>;
}
