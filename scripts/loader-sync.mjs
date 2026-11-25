// Loader source lives in the fork. The pnpm patch is a generated transport
// from the exact npm release; no second implementation is maintained here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),name='@yohawing/three-mmd-loader',upstream='https://github.com/yohawing/three-mmd-loader.git',fork='https://github.com/znzsofficial/three-mmd-loader.git';
const json=p=>JSON.parse(readFileSync(p,'utf8')),version=json(path.join(root,'package.json')).dependencies[name];
const pinFile=path.join(root,'loader-source.json'),patchFile=path.join(root,'patches',`@yohawing__three-mmd-loader@${version}.patch`);
const registry=`https://registry.npmjs.org/${encodeURIComponent(name)}/`,text=n=>/\.(?:[cm]?js|ts|json)$/.test(n);
const hash=(data,alg='sha256',fmt='hex')=>createHash(alg).update(data).digest(fmt);
const keys=p=>['name','version','type','exports','main','module','types','dependencies','peerDependencies','peerDependenciesMeta'].map(k=>[k,p[k]??null]);
const apiHash=p=>hash(JSON.stringify(keys(p)));
function command(cmd,args,cwd,opts={}){return execFileSync(cmd,args,{cwd,encoding:'utf8',maxBuffer:32*1024*1024,...opts});}
function git(cwd,...args){return command('git',['-c','core.autocrlf=false',...args],cwd).trim();}
function list(dir,prefix=''){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const rel=prefix+e.name;if(e.isDirectory())return list(path.join(dir,e.name),rel+'/');assert(e.isFile(),`Unexpected non-file: ${rel}`);return [rel];
}).sort();}
function dist(dir){const files=list(dir),digest=createHash('sha256');for(const f of files){const bytes=readFileSync(path.join(dir,f));digest.update(`${f}\0${hash(text(f)?bytes.toString('utf8').replaceAll('\r\n','\n'):bytes)}\n`);}return {files:files.length,sha256:digest.digest('hex')};}
function checkBullet(dir){for(const f of ['mmd_bullet.js','mmd_bullet.wasm'])assert(readFileSync(path.join(root,'public','mmd',version,f)).equals(readFileSync(path.join(dir,'physics','mmd',f))),`Public Bullet companion differs: ${f}`);}
async function fetchOK(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`${url}: HTTP ${r.status}`);return r;}
function checkLocal(){const pin=json(pinFile),installed=path.resolve(path.dirname(fileURLToPath(import.meta.resolve(name))),'..');
  assert.equal(pin.version,version,'Align the game dependency and loader-source.json');assert.equal(apiHash(json(path.join(installed,'package.json'))),pin.apiSha256,'Installed package entrypoints or dependency contract differ from the fork');
  assert.equal(hash(readFileSync(patchFile,'utf8').replaceAll('\r\n','\n')),pin.patchSha256,'Patch differs from the generated fork export');
  assert.deepEqual(dist(path.join(installed,'dist')),pin.dist,'Installed loader differs from the tested fork; regenerate the patch or install from the lockfile');
  checkBullet(path.join(installed,'dist'));console.log(`Loader verified: ${version}, fork ${pin.forkCommit.slice(0,12)}, ${pin.dist.files} dist files + public Bullet pair`);
}
async function checkUpstream(){const pin=json(pinFile),published=await (await fetchOK(registry+'latest')).json();
  const main=url=>git(root,'ls-remote','--exit-code',url,'refs/heads/main').split(/\s+/)[0];
  const tag=`refs/tags/v${pin.version}`,tags=new Map(git(root,'ls-remote','--exit-code',upstream,tag,tag+'^{}').split('\n').map(line=>line.trim().split(/\s+/).reverse()));
  const tip=main(upstream);if(tip!==pin.upstreamMain)console.log(`Upstream main changed since export: ${pin.upstreamMain} -> ${tip}; compare against the published release before adopting it.`);
  const refs={release:[pin.version,published.version],upstreamTag:[pin.upstreamTag,tags.get(tag+'^{}')??tags.get(tag)],tarball:[pin.registryIntegrity,published.dist.integrity],forkMain:[pin.forkCommit,main(fork)]};
  const changed=Object.entries(refs).filter(([,pair])=>pair[0]!==pair[1]);
  if(changed.length)throw Error('Loader update available. Merge upstream into the fork, test and export before promotion.\n'+changed.map(([k,p])=>`${k}: ${p.join(' -> ')}`).join('\n'));
  console.log(`Up to date: upstream npm ${published.version}, fork/main ${pin.forkCommit.slice(0,12)}`);
}
async function generate(dir){
  assert(dir,'Usage: node scripts/loader-sync.mjs export <fork checkout>');dir=path.resolve(dir);assert.match(version,/^\d+\.\d+\.\d+$/);
  assert.equal(git(dir,'status','--porcelain'),'','Use a clean, committed fork checkout');const commit=git(dir,'rev-parse','HEAD'),tag=git(dir,'rev-parse',`v${version}^{commit}`),upstreamMain=git(dir,'rev-parse','refs/remotes/upstream/main');
  git(dir,'merge-base','--is-ancestor',tag,commit);
  const meta=await (await fetchOK(registry+version)).json(),manifest=json(path.join(dir,'package.json'));assert.deepEqual(keys(manifest),keys(meta),'Review package resolution metadata before syncing dist');
  assert.equal(new URL(meta.dist.tarball).origin,'https://registry.npmjs.org');const packed=Buffer.from(await (await fetchOK(meta.dist.tarball)).arrayBuffer());assert.equal('sha512-'+hash(packed,'sha512','base64'),meta.dist.integrity);
  if(process.platform==='win32')command('cmd.exe',['/d','/c','npm.cmd run build'],dir,{stdio:'inherit'});
  else command('npm',['run','build'],dir,{stdio:'inherit'});
  assert.equal(git(dir,'rev-parse','HEAD'),commit);assert.equal(git(dir,'status','--porcelain'),'','Fork build changed the source tree');
  const forkDist=path.join(dir,'dist'),expected=dist(forkDist);checkBullet(forkDist);
  const parent=process.platform==='win32'?path.join(tmpdir(),'opencode'):tmpdir();mkdirSync(parent,{recursive:true});const tmp=mkdtempSync(path.join(parent,'mmd-loader-export-'));
  try{
    const work=path.join(tmp,'package'),release=path.join(work,'dist'),tgz=path.join(tmp,'upstream.tgz');writeFileSync(tgz,packed);command('tar',['-xf',tgz,'-C',tmp],tmp);git(work,'init','-q');git(work,'add','--','dist');const baseTree=git(work,'write-tree');
    const official=list(release),built=list(forkDist);for(const f of new Set([...official,...built])){if(!text(f))assert(official.includes(f)&&built.includes(f)&&readFileSync(path.join(forkDist,f)).equals(readFileSync(path.join(release,f))),`Native/asset change: refresh the official matching base, not a binary patch (${f})`);}
    rmSync(release,{recursive:true});cpSync(forkDist,release,{recursive:true});for(const f of built)if(text(f)){const p=path.join(release,f),s=readFileSync(p,'utf8');if(s.includes('\r\n'))writeFileSync(p,s.replaceAll('\r\n','\n'));}
    git(work,'-c','core.fileMode=false','add','-A','--','dist');const patch=command('git',['-c','core.abbrev=7','diff','--no-ext-diff','--no-renames','--no-color','--diff-algorithm=myers','--src-prefix=a/','--dst-prefix=b/',baseTree,git(work,'write-tree'),'--','dist'],work);assert(patch.startsWith('diff --git '),'No fork delta: review removal of the patch transport');
    const pin={version,upstreamTag:tag,upstreamMain,forkCommit:commit,registryIntegrity:meta.dist.integrity,apiSha256:apiHash(manifest),dist:expected,patchSha256:hash(patch)};
    writeFileSync(patchFile,patch);writeFileSync(pinFile,JSON.stringify(pin,null,2)+'\n');console.log(`Exported ${expected.files} fork files. Run pnpm install, then pnpm loader:verify.`);
  }finally{rmSync(tmp,{recursive:true,force:true});}
}
const [action,dir]=process.argv.slice(2);if(action==='verify')checkLocal();else if(action==='upstream')await checkUpstream();else if(action==='export')await generate(dir);else throw Error('Expected verify, upstream or export <fork checkout>');
