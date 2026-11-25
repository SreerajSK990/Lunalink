import type { AutoLeave } from "../lifecycle/AutoLeave.js";
import type { Autoplay } from "../lifecycle/Autoplay.js";
import type { Persistence } from "../lifecycle/Persistence.js";
import type { Player } from "../player/Player.js";
import type { PlayerEventMap } from "../player/types.js";
import type { Hooks } from "../plugins/hooks.js";

/**
 * The lifecycle parts that react to player events.
 */
export interface LifecycleParts {
  /** Autoplay history. */
  autoplay: Autoplay;
  /** Idle timers. */
  autoLeave: AutoLeave;
  /** Snapshots, or `null` without resume. */
  persistence: Persistence | null;
  /** Plugin hooks. */
  hooks: Hooks;
}

type Args<Name extends keyof PlayerEventMap<Player>> = PlayerEventMap<Player>[Name];

const SNAPSHOT_EVENTS = new Set<string>([
  "playerCreate",
  "playerConnect",
  "playerMove",
  "playerNodeChange",
  "trackStart",
  "queueUpdate",
  "queueEnd",
]);

/**
 * Builds the function that feeds player events to auto-leave, autoplay, persistence and the
 * `afterTrackEnd` hook. It runs before plugins can intercept the event, so lifecycle behavior
 * never depends on what listeners see.
 *
 * @param parts - The lifecycle parts.
 * @returns A function to call with every player event.
 */
export function createLifecycleTap(
  parts: LifecycleParts,
): (name: string, args: readonly unknown[]) => void {
  return (name, args) => {
    switch (name) {
      case "trackStart": {
        const [player, track] = args as Args<"trackStart">;
        parts.autoplay.remember(player.guildId, track);
        parts.autoLeave.onTrackStart(player);
        break;
      }
      case "trackEnd": {
        const [player, track, reason] = args as Args<"trackEnd">;
        void parts.hooks.afterTrackEnd(player, track, reason);
        break;
      }
      case "queueEnd": {
        const [player] = args as Args<"queueEnd">;
        parts.autoLeave.onQueueEnd(player);
        break;
      }
      case "playerDestroy": {
        const [player, reason] = args as Args<"playerDestroy">;
        parts.autoplay.forget(player.guildId);
        parts.autoLeave.forget(player.guildId);
        if (reason !== "shutdown" && reason !== "nodeLost")
          void parts.persistence?.remove(player.guildId);
        return;
      }
      default:
        break;
    }
    if (SNAPSHOT_EVENTS.has(name)) {
      const player = args[0] as Player;
      parts.persistence?.schedule(player);
    }
  };
}
