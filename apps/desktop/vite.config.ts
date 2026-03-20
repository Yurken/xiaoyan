import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Tauri dev server listens here
  server: { port: 1420, strictPort: true },
  build: { outDir: "dist", sourcemap: true },
  resolve: { alias: { "@": "/src" } },
});
