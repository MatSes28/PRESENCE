import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: "index.html",
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
  define: {
    // Ensure proper environment variable handling
    "import.meta.env": {
      DEV: process.env.NODE_ENV === "development",
      PROD: process.env.NODE_ENV === "production",
    },
  },
});
