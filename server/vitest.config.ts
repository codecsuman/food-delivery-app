import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Each test file starts its own single-node replica set. Running files in
    // parallel races the replica-set election and fails with
    // "no replset config has been received", so the suite runs serially.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 180000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["tests/**", "dist/**", "*.config.ts"],
    },
  },
});