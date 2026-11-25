import type {
  ApiLoadResult,
  ApiPlayer,
  ApiRoutePlannerStatus,
  ApiSession,
  ApiTrack,
  ApiUpdatePlayer,
  ApiUpdateSession,
} from "../protocol/index.js";
import type { HttpClient, HttpMethod, RequestOptions } from "../transport/http/HttpClient.js";
import { Routes } from "../transport/http/routes.js";

/**
 * Typed calls for the REST endpoints every Lavalink v4 and NodeLink server has. Anything else
 * can go through {@link NodeRest.request}.
 */
export class NodeRest {
  readonly #http: HttpClient;
  readonly #sessionId: () => string;

  /**
   * Creates the REST helper.
   *
   * @param http - HTTP client for this node.
   * @param sessionId - Returns the current session id, or throws when the node isn't ready.
   */
  constructor(http: HttpClient, sessionId: () => string) {
    this.#http = http;
    this.#sessionId = sessionId;
  }

  /**
   * Sends any request to the node. Use it for endpoints Lunalink doesn't wrap, such as
   * NodeLink's `/v4/workers` or a custom server plugin.
   *
   * @param method - HTTP method.
   * @param path - Path starting with `/`.
   * @param options - Query, body, signal and timeout.
   * @returns The parsed response body.
   * @throws {RestError} When the request fails.
   * @example
   * ```ts
   * const workers = await node.rest.request<unknown>("GET", "/v4/workers");
   * ```
   */
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T> {
    return this.#http.request<T>(method, path, options);
  }

  /**
   * Resolves an identifier: a link, or a search such as `ytsearch:never gonna give you up`.
   *
   * @param identifier - What to load.
   * @param signal - Cancels the request.
   * @returns The load result.
   */
  loadTracks(identifier: string, signal?: AbortSignal): Promise<ApiLoadResult> {
    return this.#http.request("GET", Routes.loadTracks(), {
      query: { identifier },
      ...(signal ? { signal } : {}),
    });
  }

  /**
   * Decodes one encoded track.
   *
   * @param encoded - Encoded track.
   * @returns The track.
   */
  decodeTrack(encoded: string): Promise<ApiTrack> {
    return this.#http.request("GET", Routes.decodeTrack(), { query: { encodedTrack: encoded } });
  }

  /**
   * Decodes several encoded tracks in one request.
   *
   * @param encoded - Encoded tracks.
   * @returns The tracks, in the same order.
   */
  decodeTracks(encoded: readonly string[]): Promise<ApiTrack[]> {
    return this.#http.request("POST", Routes.decodeTracks(), { body: encoded });
  }

  /**
   * Lists the players of this session on the server.
   *
   * @returns The players.
   */
  getPlayers(): Promise<ApiPlayer[]> {
    return this.#http.request("GET", Routes.players(this.#sessionId()));
  }

  /**
   * Gets one player from the server.
   *
   * @param guildId - Guild id.
   * @returns The player.
   */
  getPlayer(guildId: string): Promise<ApiPlayer> {
    return this.#http.request("GET", Routes.player(this.#sessionId(), guildId));
  }

  /**
   * Creates or updates a player on the server. Only the fields you send change.
   *
   * @param guildId - Guild id.
   * @param body - Fields to change. NodeLink also accepts its own extra fields here.
   * @param noReplace - When `true`, a new track is ignored if one is already playing.
   * @returns The player after the update.
   */
  updatePlayer(guildId: string, body: ApiUpdatePlayer, noReplace = false): Promise<ApiPlayer> {
    return this.#http.request("PATCH", Routes.player(this.#sessionId(), guildId), {
      body,
      query: { noReplace },
    });
  }

  /**
   * Destroys a player on the server and leaves the voice channel there.
   *
   * @param guildId - Guild id.
   */
  async destroyPlayer(guildId: string): Promise<void> {
    await this.#http.request("DELETE", Routes.player(this.#sessionId(), guildId));
  }

  /**
   * Changes session settings, such as resuming.
   *
   * @param body - Settings to change.
   * @returns The session settings after the change.
   */
  updateSession(body: ApiUpdateSession): Promise<ApiSession> {
    return this.#http.request("PATCH", Routes.session(this.#sessionId()), { body });
  }

  /**
   * Gets raw server statistics. `node.refreshStats()` normalizes them for you.
   *
   * @returns The stats body as the server sent it.
   */
  stats(): Promise<unknown> {
    return this.#http.request("GET", Routes.stats());
  }

  /**
   * Gets the server's version string.
   *
   * @returns For example `4.2.2`.
   */
  version(): Promise<string> {
    return this.#http.request("GET", Routes.version());
  }

  /**
   * Gets the route planner status.
   *
   * @returns The status, or `undefined` when no route planner is configured.
   */
  routePlannerStatus(): Promise<ApiRoutePlannerStatus | undefined> {
    return this.#http.request("GET", Routes.routePlannerStatus());
  }

  /**
   * Stops treating one address as failing.
   *
   * @param address - The address.
   */
  async freeRoutePlannerAddress(address: string): Promise<void> {
    await this.#http.request("POST", Routes.routePlannerFreeAddress(), { body: { address } });
  }

  /**
   * Stops treating every address as failing.
   */
  async freeAllRoutePlannerAddresses(): Promise<void> {
    await this.#http.request("POST", Routes.routePlannerFreeAll());
  }
}
