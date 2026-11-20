// Isolated production-mode build; nothing here is imported by the stage.
import {build,preview} from 'vite';
import {fileURLToPath} from 'node:url';
import {cp} from 'node:fs/promises';
import path from 'node:path';
const root=fileURLToPath(new URL('./',import.meta.url)), outDir=path.join(root,'dist');
const config={root,configFile:false,publicDir:false,logLevel:'warn',build:{outDir,chunkSizeWarningLimit:5000}};
await build(config);
await cp(new URL('../../public/mmd/0.8.6',import.meta.url),path.join(outDir,'mmd/0.8.6'),{recursive:true});
if(!process.argv.includes('--build-only')){
  const server=await preview({...config,preview:{host:'127.0.0.1',port:4286,strictPort:true}});
  console.log(server.resolvedUrls.local[0]);
}
