# Lunalink test bot

A discord.js v14 bot with a slash command for every Lunalink feature, for trying the library by hand against real Lavalink and NodeLink servers.

## Run it

1. Build Lunalink first: `npm run build` in the repository root.
2. Here: copy `.env.example` to `.env` and fill it in.
3. `npm install`
4. `npm start`

The bot needs the `Guilds` and `GuildVoiceStates` intents (both are non-privileged). Set `DEV_GUILD_ID` to register commands in one server instantly; without it they're registered globally.

Leave `NODELINK_HOST` empty to run with Lavalink only. Players are saved to `STORE_PATH`, so `/restart` and crashes can be resumed.

## What's where

| File                   | Shows                                                                      |
| ---------------------- | -------------------------------------------------------------------------- |
| `src/lunalink.ts`      | Creating the client with a store, a plugin, auto-leave and player defaults |
| `src/register.d.ts`    | Typing `track.requester`                                                   |
| `src/radioPlugin.ts`   | A plugin: a resolver, a hook, a listener and a custom event                |
| `src/announcements.ts` | Reacting to events                                                         |
| `src/commands/*.ts`    | Every player, queue, filter, feature, node and debug call                  |

The checklist in [docs/TESTING.md](../../docs/TESTING.md) walks through every command.
