import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
      "server-only": new URL("./tests/support/server-only-stub.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}", "tests/**/*.vitest.mjs"],
    passWithNoTests: false,
  },
});
