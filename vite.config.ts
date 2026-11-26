/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function singleThreeRuntime(): Plugin {
  return {
    name: "single-three-runtime",
    apply: "build",
    generateBundle(_,bundle) {
      const ids = [...this.getModuleIds()].map(id=>id.replaceAll('\\','/'));
      const floorModule=(raw:string)=>{
        const id=raw.replaceAll('\\','/');return id.includes('/scripts/webgpu-actor/')||/\/three\/build\/three\.webgpu(?:\.nodes)?\.js$/.test(id);
      };
      const chunks=Object.values(bundle).filter(c=>c.type==='chunk');
      {
        const visited=new Set<string>();
        const eager=(file:string):boolean=>{
          const c=bundle[file];if(visited.has(file)||c?.type!=='chunk')return false;visited.add(file);
          return c.moduleIds.some(floorModule)||c.imports.some(eager);
        };
        const prep=chunks.find(c=>c.isEntry&&c.facadeModuleId?.endsWith('index.html'));
        if(!prep||eager(prep.fileName)||!chunks.some(c=>c.moduleIds.some(id=>id.replaceAll('\\','/').endsWith('/scripts/webgpu-actor/stage-host.jsx'))))
          this.error('The optional WebGPU floor must load on demand from the real prep entry');
      }
      const entries = ids.filter((id) => /\/three\/build\/three\.(module\.js|cjs)$/.test(id));
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
        return chunk.moduleIds.some(id => id.replaceAll("\\", "/").endsWith("/mmdVrShowcase/xr/MmdVrScene.tsx"))
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
  // Review artifacts are local files, not a second asset tree for the dev server.
  server:{watch:{ignored:['**/local-review/**','**/.openchamber/**']},fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/local-review/**','**/.openchamber/**']}},
  resolve: { dedupe: ['react','react-dom','three','@react-three/fiber','@react-three/rapier'], ...(mode === 'test' && {mainFields:['module','main']}) },
  ...(mode === 'test' && {ssr: {resolve: {mainFields:['module','main']}}}),
  test: {
    maxWorkers:1,
    // Use these packages' published ESM entries in Node/jsdom too. Native
    // external resolution selects meshline/fiber's CJS main and a second Three.
    server: {deps:{inline:['@react-three/xr','@pmndrs/xr','@react-three/fiber','meshline']}},
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  build: {
    // Keep the optional real-device artifact separate from the production Pages upload.
    ...(mode==='webgpu-qualification'&&{outDir:'dist-qualification'}),
    // Split by usage as on the qualified build. Grouping by vendor would
    // make WebGL players download the WebGPU renderer with the prep page.
  },
}));
