import type { NodeEvent } from "../drivers/types.js";
import { Track } from "../track/Track.js";
import type { VoiceBridgeHost } from "../voice/VoiceBridge.js";
import type { PlayerRuntime } from "./PlayerRuntime.js";

/**
 * The parts of a player these helpers read.
 */
export interface EventSource {
  /** Guild id. */
  readonly guildId: string;
  /** The playing track. */
  readonly current: Track | null;
}

/**
 * Turns a normalized node event into the matching public player event.
 *
 * @param player - The player the event belongs to.
 * @param runtime - Gives access to `emit`.
 * @param event - The node event.
 */
export function emitNodeEvent<P extends EventSource>(
  player: P,
  runtime: Pick<PlayerRuntime<P>, "emit" | "debug">,
  event: NodeEvent,
): void {
  const { emit } = runtime;
  const known = (encoded: string): Track | null =>
    player.current?.encoded === encoded ? player.current : null;
  switch (event.type) {
    case "trackStart":
      emit("trackStart", player, known(event.track.encoded) ?? new Track(event.track));
      return;
    case "trackEnd":
      emit("trackEnd", player, known(event.track.encoded) ?? new Track(event.track), event.reason);
      return;
    case "trackException":
      emit("trackError", player, known(event.track.encoded) ?? new Track(event.track), {
        kind: "exception",
        message: event.exception.message ?? event.exception.cause,
        exception: event.exception,
        cause: null,
      });
      return;
    case "trackStuck":
      emit(
        "trackStuck",
        player,
        known(event.track.encoded) ?? new Track(event.track),
        event.thresholdMs,
      );
      return;
    case "voiceClosed":
      emit("voiceClosed", player, event.code, event.reason, event.byRemote);
      return;
    case "segmentsLoaded":
      emit("segmentsLoaded", player, event.segments);
      return;
    case "segmentSkipped":
      emit("segmentSkipped", player, event.segment);
      return;
    case "chaptersLoaded":
      emit("chaptersLoaded", player, event.chapters);
      return;
    case "chapterStarted":
      emit("chapterStarted", player, event.chapter);
      return;
    case "lyricsFound":
      emit("lyricsFound", player, event.lyrics);
      return;
    case "lyricsNotFound":
      emit("lyricsNotFound", player);
      return;
    case "lyricsLine":
      emit("lyricsLine", player, event.line, event.lineIndex, event.skipped);
      return;
    case "nodeLinkEvent":
      emit("nodeLinkEvent", player, event.name, event.payload);
      return;
    case "unknown":
      runtime.debug({
        scope: `player:${player.guildId}`,
        level: "trace",
        message: `Unhandled event ${event.name}`,
      });
  }
}

/**
 * Builds the voice bridge callbacks that turn voice changes into player events.
 *
 * @param player - The player.
 * @param runtime - Gives access to `emit` and `debug`.
 * @returns Callbacks for the voice bridge host.
 */
export function voiceCallbacks<P extends EventSource>(
  player: P,
  runtime: Pick<PlayerRuntime<P>, "emit" | "debug">,
): Pick<VoiceBridgeHost, "onDisconnected" | "onMoved" | "onStateFlags" | "onPushError"> {
  return {
    onDisconnected: () => {
      runtime.emit("playerDisconnect", player);
    },
    onMoved: (from, to) => {
      runtime.emit("playerMove", player, from, to);
    },
    onStateFlags: () => undefined,
    onPushError: (error) => {
      runtime.debug({
        scope: `player:${player.guildId}`,
        level: "error",
        message: "Sending voice credentials to the node failed",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    },
  };
}
