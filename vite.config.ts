import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

function git(command: string): string {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

// Marked dirty when the tree has uncommitted work, so a deployed build can never
// claim a commit that does not actually contain it.
const commit = git("git rev-parse --short HEAD") || "unknown";
const buildRef = git("git status --porcelain") ? `${commit}+dirty` : commit;

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })),
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_COMMIT__: JSON.stringify(buildRef)
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
