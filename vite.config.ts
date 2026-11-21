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
      const checked=new Set<string>();
      function eagerPlanet(name:string):boolean {
        const chunk=bundle[name];if(checked.has(name)||chunk?.type!=='chunk')return false;checked.add(name);
        return chunk.moduleIds.some(id=>id.replaceAll('\\','/').includes('/@dimforge/rapier3d-compat/'))||chunk.imports.some(eagerPlanet);
      }
      if(prep&&eagerPlanet(prep.fileName))this.error('Planet physics must only load on entering the planetoid in XR');
    },
  };
}

export default defineConfig(({mode}) => ({
  plugins: [react(), singleThreeRuntime(), sceneReadyWithPrep()],
  // experiments/ has standalone apps with their own React and Fiber. Scanning
  // their HTML into the product dev cache splits the Rapier/Fiber contexts.
  optimizeDeps:{entries:['index.html']},
  resolve: { dedupe: ['react','react-dom','three','@react-three/fiber','@react-three/rapier'], ...(mode === 'test' && {mainFields:['module','main']}) },
  ...(mode === 'test' && {ssr: {resolve: {mainFields:['module','main']}}}),
  test: {
    // Use these packages' published ESM entries in Node/jsdom too. Native
    // external resolution selects meshline/fiber's CJS main and a second Three.
    server: {deps:{inline:['@react-three/xr','@pmndrs/xr','@react-three/fiber','meshline']}},
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Put only the standalone WASM package here. Putting its React
          // wrapper here would hoist shared Three/React deps into this chunk.
          if (/[\\/]node_modules[\\/]@dimforge[\\/]rapier3d-compat[\\/]/.test(id)) return 'planet-physics';
          if (/[\\/]node_modules[\\/]@react-three[\\/]rapier[\\/]/.test(id)) return;
          if (id.includes("react-dom") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("@yohawing")) return "vendor-mmd";
          if (/[\\/]node_modules[\\/](?:three|three-stdlib|@react-three[\\/][^\\/]+)[\\/]/.test(id)) return "vendor-three";
          if (id.includes("zustand")) return "vendor-state";
          return undefined;
        },
      },
    },
  },
}));
