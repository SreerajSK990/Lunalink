/**
 * Guesses the Discord voice region from a voice server endpoint, for region-based node
 * selection. Discord doesn't document the endpoint format, so this is a heuristic (the same idea
 * Shoukaku uses): take the first part of the host name, drop a leading `c-`, and keep the
 * letters before the first digit. `c-bom06-1a2b.discord.media` gives `bom`.
 *
 * Pass your own `resolveRegion` option if it guesses wrong for you.
 *
 * @param endpoint - Endpoint from `VOICE_SERVER_UPDATE`, with or without a port.
 * @returns The region in lower case, or `null` when it can't tell.
 */
export function parseVoiceRegion(endpoint: string | null): string | null {
  if (!endpoint) return null;
  const host = endpoint.replace(/^wss?:\/\//, "").split(":")[0] ?? "";
  const label = (host.split(".")[0] ?? "").toLowerCase().replace(/^c-/, "");
  const match = /^([a-z]+(?:-[a-z]+)*?)\d/.exec(label);
  return match?.[1] ?? null;
}
