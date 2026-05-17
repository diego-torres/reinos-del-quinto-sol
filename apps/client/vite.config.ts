import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const clientDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(clientDir, "../..");

export default defineConfig({
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  resolve: {
    alias: {
      "@repo-assets": path.join(repoRoot, "assets"),
    },
  },
});
