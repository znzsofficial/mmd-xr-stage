// A local receipt for the entire upload, including the legacy-tab bridge.
// Never seal a pre-existing dist on its own: prepare runs the release checks.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,hash} from 'node:crypto';
import {readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)), dir=join(root,'dist'), receipt=join(root,'stage-release.local');
export async function identifyDist(directory) {
  const digest=createHash('sha256'), names=[];
  async function walk(prefix){
    for(const f of await readdir(join(directory,prefix),{withFileTypes:true})){
      const name=prefix+f.name;
      if(f.isDirectory())await walk(name+'/');
      else {assert(f.isFile(),`Unsupported dist entry: ${name}`);names.push(name);}
    }
  }
  await walk('');
  for(const required of ['index.html','labs/cloth/index.html'])assert(names.includes(required),`Incomplete dist: missing ${required}`);
  for(const name of names.sort())digest.update(`${name}\0${hash('sha256',await readFile(join(directory,name)))}\n`);
  return {files:names.length,sha256:digest.digest('hex')};
}

function cleanRevision(){
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  assert(!git('status','--porcelain'),'Commit the release source before preparing or promoting its dist.');
  return git('rev-parse','HEAD');
}

// Check the actual entry pages and immutable dependencies on the production
// origin. A missing file can return the SPA index with HTTP 200.
async function verifyLive(quick){
  const paths=new Set(['index.html','labs/cloth/index.html']);
  const {version}=JSON.parse(await readFile(join(root,'loader-source.json'),'utf8'));
  for(const page of ['index.html','labs/cloth/index.html']){
    const html=await readFile(join(dir,page),'utf8');
    const entries=[...html.matchAll(/(?:href|src)="\/((?:labs\/cloth\/)?assets\/[^"?#]+)"/g)].map(m=>m[1]);
    assert(entries.some(p=>/(?:^|\/)index-[\w-]+\.js$/.test(p)),`No built JS entry in ${page}`);
    for(const p of entries)if(!quick||/(?:^|\/)index-[\w-]+\.(?:js|css)$/.test(p))paths.add(p);
  }
  // The renderer's on-demand planet chunk, and its separately bundled WASM.
  const entry=[...paths].find(p=>/^assets\/index-[\w-]+\.js$/.test(p));assert(entry);
  if(!quick){
    paths.add('assets/organ.worker-dQG0D6Ad.js');
    for(const bulletVersion of ['0.8.6',version]){
      paths.add(`mmd/${bulletVersion}/mmd_bullet.js`);
      paths.add(`mmd/${bulletVersion}/mmd_bullet.wasm`);
    }
     const js=await readFile(join(dir,entry),'utf8');
     const organ=js.match(/organ\.worker-[\w-]+\.js/)?.[0];assert(organ,'Missing current anatomy worker');paths.add('assets/'+organ);
     // Fresh entry into the station park must serve the actual local images;
     // a Pages SPA fallback returns HTTP 200 for missing print/probe URLs.
     for(const file of await readdir(join(dir,'scenery/terminus')))if(/^park-.*\.webp$|^fountain-(px|nx|py|ny|pz|nz)\.webp$/.test(file))paths.add('scenery/terminus/'+file);
     for(const file of await readdir(join(dir,'assets')))if(/^zelkova-(sprays|shade|bark)-.*\.webp$/.test(file))paths.add('assets/'+file);
    const host=js.match(/stage-host-[\w-]+\.js/)?.[0];assert(host,'Missing optional WebGPU floor');
    paths.add('assets/'+host);
    const floorJs=await readFile(join(dir,'assets',host),'utf8');
    for(const m of floorJs.matchAll(/(?:actorStyleMaps\.worker-|three\.webgpu[^/"']*?-)[\w-]+\.js/g))paths.add('assets/'+m[0]);
    for(const m of js.matchAll(/(?:PlanetPhysics-|planet-physics-)[\w-]+\.js/g))paths.add('assets/'+m[0]);
    for(const file of await readdir(join(dir,'assets')))if(/^mmd_anim_wasm_bg-.*\.wasm$/.test(file))paths.add('assets/'+file);
    for(const file of await readdir(join(dir,'labs/cloth/assets')))paths.add('labs/cloth/assets/'+file);
  }
  const pending=paths.values();
  await Promise.all(Array.from({length:3},async()=>{for(const p of pending){
    const expected=await readFile(join(dir,p));
    for(let attempt=1;;attempt++)try{
      const url='https://mmd-xr-stage.pages.dev/'+p.replace(/(^|\/)index\.html$/,'$1')+'?release='+Date.now();
      const r=await fetch(url,{signal:AbortSignal.timeout(60000)});assert(r.ok,`HTTP ${r.status}`);
      assert(expected.equals(Buffer.from(await r.arrayBuffer())),'differs from prepared dist');break;
    }catch(e){if(attempt===3)throw Error(`Production verification failed: ${p}`,{cause:e});await new Promise(done=>setTimeout(done,3000*attempt));}
  }}));
  console.log(`Matched ${paths.size} production pages/resources including ${entry}`);
}

async function main(action){
  if(action==='prepare'||action==='quick'){
    await rm(receipt,{force:true});
    const revision=cleanRevision(), opts={cwd:root,stdio:'inherit'};
    execFileSync(process.execPath,['scripts/loader-sync.mjs','upstream'],opts);
    const quick=action==='quick', files=process.argv.slice(3).map(p=>relative(root,resolve(p)).replaceAll('\\','/'));
    if(quick){
      if(!files.length)console.log('Fast build only (no local test files selected); check the changed behavior on this dist.');
      const vitest=[],node=[];for(const file of files){
        if(/^src\/.+\.(?:spec|test)\.tsx?$/.test(file))vitest.push(file);
        else if(/^(?:scripts|experiments)\/.+\.test\.[cm]?js$/.test(file))node.push(file);
        else throw Error(`Not a project test file: ${file}`);
        execFileSync('git',['ls-files','--error-unmatch','--',file],{cwd:root,stdio:'pipe'});
      }
      if(vitest.length)execFileSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...vitest],opts);
      if(node.length)execFileSync(process.execPath,['--test',...node],opts);
    }
    const task=quick?'build':'check';
    if(process.platform==='win32')execFileSync('cmd.exe',['/d','/c',`pnpm run ${task}`],opts);
    else execFileSync('pnpm',['run',task],opts);
    execFileSync(process.execPath,['scripts/retain-legacy-scene.mjs'],opts);
    const dist=await identifyDist(dir);assert.equal(cleanRevision(),revision,'Source changed during checks');
    await writeFile(receipt,JSON.stringify({revision,dist,checks:quick?{mode:'focused',files}:{mode:'full'}},null,2)+'\n');
    console.log(`Prepared ${revision.slice(0,7)}: ${dist.files} files, sha256 ${dist.sha256}`);
  }else if(action==='verify'||action==='live'){
    const r=JSON.parse(await readFile(receipt,'utf8').catch(()=>{throw Error('No prepared release; run pnpm run release:prepare first.');}));
    // Upload requires the matching clean checkout. Read-only verification of
    // an already published artifact must still work after a documentation commit.
    if(action==='verify')assert.equal(cleanRevision(),r.revision,'The prepared release belongs to another commit');
    assert.deepEqual(await identifyDist(dir),r.dist,'dist changed after release checks; refusing to promote');
    console.log(`Matched prepared ${r.revision.slice(0,7)}: ${r.dist.files} files, sha256 ${r.dist.sha256}`);
    if(action==='live')await verifyLive(r.checks?.mode==='focused');
  }else throw Error('Expected quick, prepare, verify or live');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main(process.argv[2]);
