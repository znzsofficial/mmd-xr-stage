// Standalone runner, one device/browser at a time. Example (set env first):
//   node experiments/gpu-cloth/fixtures/check-bimanual-run.mjs
// CLOTH_URL: built /labs/cloth/ URL. Set CLOTH_MODEL_DIR (PMX + textures) or
// CLOTH_MODEL_FILE, or CLOTH_SPARSE=1 for the original broad-panel swatch.
// CLOTH_OUTPUT: local evidence directory; writes bimanual-{actor,sparse}.json.
// CLOTH_PLAN: baseline JSON (entire report or its plan); same PMX and input.
// CLOTH_RECORD_ONLY=1: save a failing baseline without a failure exit code.
// PLAYWRIGHT_CORE, CHANNEL: same as smoke.cjs. CLOTH_MODEL_INDEX: optional
// zero-based selection in a directory with more than one model. Optionally set
// CLOTH_MATERIAL_INDEX to the zero-based exterior garment draw material.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {checkBimanual} from './check-bimanual.mjs';
import {bimanualSparsePmx} from './check-bimanual-sparse.mjs';

const env=process.env, require=createRequire(import.meta.url);
const {chromium}=require(env.PLAYWRIGHT_CORE||'playwright-core');
const sparse=env.CLOTH_SPARSE==='1', label=sparse?'sparse':'actor';
if(!sparse&&!env.CLOTH_MODEL_DIR&&!env.CLOTH_MODEL_FILE)throw Error('Choose a local PMX directory/file or set CLOTH_SPARSE=1');
const replay=env.CLOTH_PLAN?JSON.parse(await readFile(env.CLOTH_PLAN,'utf8')):null;
const out=resolve(env.CLOTH_OUTPUT||'local-review/verification/bimanual');
const file=join(out,`bimanual-${label}.json`);
if(env.CLOTH_PLAN && resolve(env.CLOTH_PLAN)===file)throw Error('Choose another output directory to preserve the replay baseline');
const url=new URL(env.CLOTH_URL||'http://localhost:4173/labs/cloth/');url.searchParams.set('probe','1');
const browser=await chromium.launch({channel:env.CHANNEL||'msedge',headless:true,args:['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
try{
  const page=await browser.newPage({viewport:{width:920,height:760}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(90_000);
  await page.goto(url.href);
  if(sparse){const f=bimanualSparsePmx();await page.locator('#file').setInputFiles({name:f.name,mimeType:'application/octet-stream',buffer:Buffer.from(await f.arrayBuffer())});}
  else if(env.CLOTH_MODEL_DIR)await page.locator('#folder').setInputFiles(env.CLOTH_MODEL_DIR);
  else await page.locator('#file').setInputFiles(env.CLOTH_MODEL_FILE);
  const ready=async()=>{
    await page.waitForFunction(()=>globalThis.clothProbe?.().actor && !document.querySelector('#mode').disabled || /未能打开|实验停止/.test(document.querySelector('#status').textContent));
    if(!await page.evaluate(()=>!!clothProbe().actor))throw Error('Actor import failed; check PMX, textures and WebGPU support');
  };
  await ready();
  if(!sparse && env.CLOTH_MODEL_INDEX!=null && env.CLOTH_MODEL_INDEX!=='0'){
    await page.locator('#model').selectOption(env.CLOTH_MODEL_INDEX);await ready();
  }
  const result=await page.evaluate(checkBimanual,{plan:replay?.plan??replay,materialIndex:env.CLOTH_MATERIAL_INDEX!=null?Number(env.CLOTH_MATERIAL_INDEX):null});
  if(errors.length)throw Error('Browser page errors: '+errors.length);
  await mkdir(out,{recursive:true});await writeFile(file,JSON.stringify(result,null,2)+'\n');
  console.table(result.checks);console.log(`${result.pass?'PASS':'FAIL'} ${file}`);
  if(!result.pass && env.CLOTH_RECORD_ONLY!=='1')process.exitCode=1;
}finally{await browser.close();}
