import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
    coverage: {
      include: ["src/**/*.ts"],
      reporter: ["text", "html"],
    },
  },
});
