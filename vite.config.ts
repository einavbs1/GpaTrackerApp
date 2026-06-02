import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }))
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
