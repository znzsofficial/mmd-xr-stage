import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

// A separate entry and build: the normal prep/XR runtime never imports WebGPU.
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'/labs/cloth/',publicDir:false,
  build:{outDir:'../../dist/labs/cloth',emptyOutDir:true}});
