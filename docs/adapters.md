# Adapters

An adapter connects Lunalink to your Discord library. It does three things: reports the bot's user id, sends op 4 voice updates on the right shard, and hands Lunalink the raw gateway packets. The shipped adapters use structural types only, so Lunalink never imports your library and works with any version that has the same shape.

Every library needs the `Guilds` and `GuildVoiceStates` intents (or their equivalent).

## discord.js

```ts
import { discordjs } from "lunalink/adapters/discordjs";
new Lunalink({ adapter: discordjs(client), nodes });
```

Works with v14 (`raw` client event, `guild.shard.send()`) and the next major (`client.ws.on("dispatch")`, `client.ws.send(shardId, payload)`). It checks which one it has when you create it.

## Eris

```ts
import { eris } from "lunalink/adapters/eris";
new Lunalink({ adapter: eris(client), nodes });
```

Uses the `rawWS` event and `guild.shard.sendWS()`.

## Oceanic

```ts
import { oceanic } from "lunalink/adapters/oceanic";
new Lunalink({ adapter: oceanic(client), nodes });
```

Uses the `packet` event and `guild.shard.send()`. The bot id comes from the `READY` packet, because `client.user` throws before the first `READY`.

## Seyfert

Seyfert has no raw event on the client object, so add a `raw` event file:

```ts
import { seyfert, seyfertRawEvent } from "lunalink/adapters/seyfert";

export const adapter = seyfert(client);
export const lunalink = new Lunalink({ adapter, nodes });
```

```ts
import { createEvent } from "seyfert";
import { seyfertRawEvent } from "lunalink/adapters/seyfert";
import { adapter } from "../lunalink.js";

export default createEvent(seyfertRawEvent(adapter));
```

Works with `Client` (`client.gateway.send()`) and `WorkerClient` (`client.shards.get(id).send()`).

## Anything else

```ts
import { raw } from "lunalink/adapters/raw";

const adapter = raw({
  clientId: () => botUserId,
  send: (guildId, payload) => shardFor(guildId).send(payload),
});
gateway.on("packet", (packet) => adapter.handle(packet));
```

Or implement `GatewayAdapter` yourself:

```ts
import { shardIdFor } from "lunalink/adapters/raw";

const adapter: GatewayAdapter = {
  clientId: () => botUserId,
  send: (guildId, payload) => shards[shardIdFor(guildId, shards.length)].send(payload),
  listen: (handler) => {
    const listener = (packet) => handler({ t: packet.t, d: packet.d });
    gateway.on("dispatch", listener);
    return () => gateway.off("dispatch", listener);
  },
};
```

`listen` hands over each dispatch packet and returns a function that stops listening.

Lunalink reads `VOICE_STATE_UPDATE`, `VOICE_SERVER_UPDATE`, `GUILD_CREATE`, `GUILD_DELETE` and `READY` and ignores the rest. `shardIdFor(guildId, shardCount)` uses Discord's formula, `(guild_id >> 22) % shard_count`.
