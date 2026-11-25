/**
 * Package name, sent to nodes in the `Client-Name` header.
 */
export const LIBRARY_NAME = "lunalink";

/**
 * Package version. A unit test fails if it drifts from `package.json`.
 */
export const LIBRARY_VERSION = "0.1.0";

/**
 * The `Client-Name` header value, in the `NAME/VERSION` form Lavalink asks for.
 */
export const CLIENT_NAME: string = `${LIBRARY_NAME}/${LIBRARY_VERSION}`;
