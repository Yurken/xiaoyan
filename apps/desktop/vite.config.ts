import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Path to desktop's own React — force all React resolution to this single copy.
const desktopNodeModules = path.resolve(__dirname, "node_modules");

export default defineConfig({
  plugins: [react()],
  server: { port: 1420, strictPort: true },
  build: { outDir: "dist", sourcemap: true },
  resolve: {
    alias: {
      "@": "/src",
      // Force single React/ReactDOM instance for the entire bundle
      react: path.join(desktopNodeModules, "react"),
      "react-dom": path.join(desktopNodeModules, "react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["lucide-react"],
  },
});
