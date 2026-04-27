import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const coreEntry = fileURLToPath(new URL("../core/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "twincat-ads-core": coreEntry,
    },
  },
});
