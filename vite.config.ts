/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-dom") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("three")) return "vendor-three";
          if (id.includes("@yohawing")) return "vendor-mmd";
          if (id.includes("zustand") || id.includes("nanoid")) return "vendor-state";
          return undefined;
        },
      },
    },
  },
});
