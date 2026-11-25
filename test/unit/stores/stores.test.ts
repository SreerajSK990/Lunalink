import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonFileStore } from "../../../src/stores-builtin/JsonFileStore.js";
import { MemoryStore } from "../../../src/stores-builtin/MemoryStore.js";

describe("MemoryStore", () => {
  it("stores copies and lists keys by prefix", () => {
    const store = new MemoryStore();
    const value = { a: [1, 2] };
    store.set("player:1", value);
    store.set("other", 1);
    value.a.push(3);
    expect(store.get("player:1")).toEqual({ a: [1, 2] });
    expect(store.keys("player:")).toEqual(["player:1"]);
    store.delete("player:1");
    expect(store.get("player:1")).toBeNull();
  });
});

describe("JsonFileStore", () => {
  let dir = "";
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("saves to disk and reads it back", async () => {
    dir = await mkdtemp(join(tmpdir(), "lunalink-"));
    const path = join(dir, "nested", "store.json");
    const store = new JsonFileStore({ path, debounceMs: 10_000 });
    expect(await store.get("missing")).toBeNull();
    await store.set("player:1", { position: 5 });
    await store.flush();
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ "player:1": { position: 5 } });
    const reopened = new JsonFileStore({ path });
    expect(await reopened.get("player:1")).toEqual({ position: 5 });
    expect(await reopened.keys("player:")).toEqual(["player:1"]);
    await reopened.delete("player:1");
    await reopened.close();
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({});
  });
});
