import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    protocol: "src/protocol/index.ts",
    "transport/ws": "src/entries/transportWs.ts",
    plugin: "src/entries/plugin.ts",
    testing: "src/testing/index.ts",
    "adapters/discordjs": "src/adapters/discordjs.ts",
    "adapters/eris": "src/adapters/eris.ts",
    "adapters/oceanic": "src/adapters/oceanic.ts",
    "adapters/seyfert": "src/adapters/seyfert.ts",
    "adapters/raw": "src/adapters/raw.ts",
    "stores/memory": "src/stores-builtin/MemoryStore.ts",
    "stores/json-file": "src/stores-builtin/JsonFileStore.ts",
  },
  format: ["esm", "cjs"],
  platform: "neutral",
  target: "node22",
  dts: true,
  tsconfig: "tsconfig.lib.json",
  fixedExtension: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  publint: true,
});
