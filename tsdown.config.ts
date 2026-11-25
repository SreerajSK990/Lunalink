import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    protocol: "src/protocol/index.ts",
  },
  format: ["esm", "cjs"],
  platform: "neutral",
  target: "node22",
  dts: true,
  fixedExtension: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  publint: true,
});
