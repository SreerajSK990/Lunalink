import type { NodeOptions } from "lunalink";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in .env (see .env.example).`);
  return value;
}

function node(
  prefix: "LAVALINK" | "NODELINK",
  id: string,
  type: "lavalink" | "nodelink",
): NodeOptions | null {
  const host = process.env[`${prefix}_HOST`];
  if (!host) return null;
  return {
    id,
    type,
    host,
    port: Number(process.env[`${prefix}_PORT`] ?? (type === "lavalink" ? 2333 : 3000)),
    password: process.env[`${prefix}_PASSWORD`] ?? "youshallnotpass",
    secure: process.env[`${prefix}_SECURE`] === "true",
  };
}

export const env = {
  token: required("DISCORD_TOKEN"),
  devGuildId: process.env["DEV_GUILD_ID"] || undefined,
  storePath: process.env["STORE_PATH"] ?? "./data/lunalink.json",
  nodes: [
    node("LAVALINK", "lavalink", "lavalink"),
    node("NODELINK", "nodelink", "nodelink"),
  ].filter((entry): entry is NodeOptions => entry !== null),
};

if (env.nodes.length === 0) throw new Error("Configure at least one node in .env.");
