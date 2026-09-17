/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function singleThreeRuntime(): Plugin {
  return {
    name: "single-three-runtime",
    apply: "build",
    generateBundle() {
      const entries = [...this.getModuleIds()].filter((id) => /\/three\/build\/three\.(module\.js|cjs)$/.test(id.replaceAll("\\", "/")));
      if (entries.length !== 1) this.error(`Expected one Three.js runtime, found ${entries.length}: ${entries.join(", ")}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), singleThreeRuntime()],
  resolve: { dedupe: ["three"] },
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
          if (id.includes("@yohawing")) return "vendor-mmd";
          if (/[\\/]node_modules[\\/](?:three|three-stdlib|@react-three[\\/][^\\/]+)[\\/]/.test(id)) return "vendor-three";
          if (id.includes("zustand") || id.includes("nanoid")) return "vendor-state";
          return undefined;
        },
      },
    },
  },
});
