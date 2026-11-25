import type { Track } from "../track/Track.js";
import type { UnresolvedTrack } from "../track/UnresolvedTrack.js";

/**
 * Search identifiers tried, in order, to find a playable copy of an unresolved track. These are
 * the same two defaults LavaSrc uses (`DefaultMirroringAudioTrackResolver`): an ISRC search,
 * then a title and author search.
 *
 * @param track - The unresolved track.
 * @returns Identifiers to try.
 */
export function mirrorQueries(track: UnresolvedTrack): string[] {
  const queries: string[] = [];
  if (track.isrc) queries.push(`ytsearch:"${track.isrc.replace(/-/g, "")}"`);
  queries.push(`ytsearch:${track.searchText()}`);
  return queries;
}

function sameIsrc(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.replace(/-/g, "") === b.replace(/-/g, "");
}

const VERSION_WORDS = [
  "live",
  "remix",
  "cover",
  "karaoke",
  "instrumental",
  "sped up",
  "slowed",
  "nightcore",
  "8d",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordOverlap(a: string, b: string): number {
  const left = new Set(normalize(a).split(" ").filter(Boolean));
  const right = new Set(normalize(b).split(" ").filter(Boolean));
  if (left.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / left.size;
}

/**
 * Scores a candidate against the track it should match. Higher is better; below 0 means
 * "don't use this". It rewards a close length and matching words, and punishes versions the
 * original isn't, like "live" or "remix".
 *
 * @param wanted - The unresolved track.
 * @param candidate - A search result.
 * @returns The score.
 */
export function scoreCandidate(wanted: UnresolvedTrack, candidate: Track): number {
  let score = wordOverlap(wanted.title, candidate.info.title) * 50;
  if (wanted.author)
    score += wordOverlap(wanted.author, `${candidate.info.author} ${candidate.info.title}`) * 25;
  if (wanted.durationMs !== null && wanted.durationMs > 0) {
    const difference = Math.abs(wanted.durationMs - candidate.info.length);
    if (difference <= 2_000) score += 30;
    else if (difference <= 10_000) score += 15;
    else if (difference > 30_000) score -= 40;
  }
  const original = normalize(`${wanted.title} ${wanted.author ?? ""}`);
  const found = normalize(candidate.info.title);
  for (const word of VERSION_WORDS) {
    if (found.includes(word) && !original.includes(word)) score -= 20;
  }
  if (sameIsrc(wanted.isrc, candidate.info.isrc)) score += 100;
  return score;
}

/**
 * Picks the best candidate, or `undefined` when none scores at least 0.
 *
 * @param wanted - The unresolved track.
 * @param candidates - Search results.
 * @returns The best match.
 */
export function pickBestMatch(
  wanted: UnresolvedTrack,
  candidates: readonly Track[],
): Track | undefined {
  let best: Track | undefined;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (candidate.isStream) continue;
    const score = scoreCandidate(wanted, candidate);
    if (score >= bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
