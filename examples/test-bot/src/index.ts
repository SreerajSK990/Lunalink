import { Events, MessageFlags, REST, Routes } from "discord.js";
import { LunalinkError } from "lunalink";
import { announce } from "./announcements.js";
import { commands, commandsByName } from "./commands/index.js";
import { UserError } from "./commands/types.js";
import { env } from "./env.js";
import { client, lunalink } from "./lunalink.js";

announce();

client.once(Events.ClientReady, async (ready) => {
  const body = commands.map((command) => command.data.toJSON());
  const rest = new REST().setToken(env.token);
  await rest.put(
    env.devGuildId
      ? Routes.applicationGuildCommands(ready.user.id, env.devGuildId)
      : Routes.applicationCommands(ready.user.id),
    { body },
  );
  console.log(`Logged in as ${ready.user.tag}, registered ${body.length} commands.`);
  await lunalink.connect();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
  const command = commandsByName.get(interaction.commandName);
  if (!command) return;
  try {
    await command.run(interaction);
  } catch (error) {
    const known = error instanceof UserError || error instanceof LunalinkError;
    if (!known) console.error(error);
    const message = known ? error.message : "Something went wrong. Check the console.";
    if (interaction.deferred || interaction.replied)
      await interaction.editReply(message).catch(() => undefined);
    else
      await interaction
        .reply({ content: message, flags: MessageFlags.Ephemeral })
        .catch(() => undefined);
  }
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void lunalink.shutdown({ mode: "pause" }).finally(() => process.exit(0));
  });
}

await client.login(env.token);
