import { debugCommands } from "./debug.js";
import { featureCommands } from "./features.js";
import { filterCommands } from "./filters.js";
import { nodeCommands } from "./nodes.js";
import { playbackCommands } from "./playback.js";
import { queueCommands } from "./queue.js";
import type { Command } from "./types.js";

export const commands: Command[] = [
  ...playbackCommands,
  ...queueCommands,
  ...filterCommands,
  ...featureCommands,
  ...nodeCommands,
  ...debugCommands,
];

export const commandsByName = new Map(commands.map((command) => [command.data.name, command]));
