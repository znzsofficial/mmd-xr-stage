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

// An already-open prep page must be able to start XR after a Pages deployment
// removes its old hashed chunks. Check reachability through static imports only.
function sceneReadyWithPrep(): Plugin {
  return {
    name: "scene-ready-with-prep",
    apply: "build",
    generateBundle(_options, bundle) {
      const seen = new Set<string>();
      function hasScene(name: string): boolean {
        const chunk = bundle[name];
        if (seen.has(name) || chunk?.type !== "chunk") return false;
        seen.add(name);
        return chunk.moduleIds.some(id => id.replaceAll("\\", "/").endsWith("/mmdVrShowcase/MmdVrScene.tsx"))
          || chunk.imports.some(hasScene);
      }
      const prep = Object.values(bundle).find(c => c.type === "chunk" && c.isEntry && c.facadeModuleId?.endsWith("index.html"));
      if (!prep || !hasScene(prep.fileName)) this.error("VR scene must be available before the prep page accepts files");
    },
  };
}

export default defineConfig({
  plugins: [react(), singleThreeRuntime(), sceneReadyWithPrep()],
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
