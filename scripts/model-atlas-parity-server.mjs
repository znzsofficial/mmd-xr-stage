// Opt-in developer probe. Both arms use the same Three, stage and WebGL context.
// Only the legacy runtime's loader imports resolve to the historical package.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer,normalizePath} from 'vite';

const root=fileURLToPath(new URL('../',import.meta.url));
const release='https://registry.npmjs.org/@yohawing/three-mmd-loader/-/three-mmd-loader-0.8.6.tgz';
const integrity='sha512-F3vz/aCo9d/CxEstRQWF5l4oE6eXqtTlP436iI2L66+nkaePFZ/Hw7wZiISlUrMNaAjSUiKRsJpufEZ7+ckDNQ==';
const revision='dbd2e968fd7094042af4868db9fdb991bd2d099b'; // pre-atlas stage, including its real loader fixes
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
// A same-origin path under the dev root also serves the old parser's WASM
// via import.meta.url on Windows. This ignored directory is outside app dist/.
const parent=path.join(root,'scripts/dist');mkdirSync(parent,{recursive:true});
const scratch=mkdtempSync(path.join(parent,'atlas-reference-')),pkg=path.join(scratch,'package');
let server;
try{
  const local=process.env.ATLAS_BASELINE_TGZ;
  const bytes=local?readFileSync(local):await (async()=>{
    const r=await fetch(release);if(!r.ok)throw Error(`Baseline tarball HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer());
  })();
  if(`sha512-${createHash('sha512').update(bytes).digest('base64')}`!==integrity)throw Error('Wrong official baseline tarball');
  const tgz=path.join(scratch,'loader.tgz');writeFileSync(tgz,bytes);
  execFileSync('tar',['-xzf',tgz,'-C',scratch,'package/dist']);
  const patch=execFileSync('git',['show',`${revision}:patches/@yohawing__three-mmd-loader@0.8.6.patch`],{cwd:root});
  execFileSync('git',['apply','--no-index','-'],{cwd:pkg,input:patch,env:{...process.env,GIT_CEILING_DIRECTORIES:scratch}});

  const old=hash(path.join(pkg,'dist/three/outline.js'));
  const installed=createRequire(import.meta.url).resolve('@yohawing/three-mmd-loader/three');
  const candidate=hash(path.join(path.dirname(installed),'outline.js'));
  if(old===candidate)throw Error('The installed loader still contains the baseline proxy factories; install the candidate before comparing.');
  const source={old:{tarball:integrity,stagePatch:revision,outlineSha256:old},candidate:{outlineSha256:candidate}};
  const legacyRoot=`/${normalizePath(path.relative(root,pkg))}/dist`;
  server=await createServer({root,cacheDir:path.join(scratch,'vite-cache'),server:{host:'127.0.0.1',port:5174,strictPort:true},plugins:[{
    name:'atlas-parity-historical-loader',enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/mmdRuntime/mmdRuntime.ts?atlas-old'))return;
      // Import the full old loader and evaluator, not synthesized shells on
      // candidate meshes. Relative stage helpers and Three keep their identity.
      return code.replaceAll('"@yohawing/three-mmd-loader"',JSON.stringify(`${legacyRoot}/index.js`))
        .replaceAll('"@yohawing/three-mmd-loader/runtime"',JSON.stringify(`${legacyRoot}/runtime/index.js`))
        +`\nexport {ThreeMmdLoader as atlasLoader}; export const atlasSources=${JSON.stringify(source)};`;
    },
  }]});
  await server.listen();
  console.log('Atlas A/B: http://127.0.0.1:5174/scripts/model-atlas-parity.html');
  await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
}finally{
  await server?.close();rmSync(scratch,{recursive:true,force:true});
}
