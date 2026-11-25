// Host-side, opt-in ADB measurements. Never import this into the stage.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';

const run=promisify(execFile),phases=['empty','placing','standing','returned'];
export function browserProcesses(output,pkg){
  return new Map(output.split(/\r?\n/).flatMap(line=>{const m=line.match(/^\s*(\d+)\s+(\S+)/);return m&&(m[2]===pkg||m[2].startsWith(pkg+':'))?[[Number(m[1]),m[2]]]:[];}));
}
export function processPss(text,pid,name){
  const id=text.match(/\*\* MEMINFO in pid (\d+) \[([^\]]+)\] \*\*/),pss=text.match(/^\s*TOTAL PSS:\s+(\d+)\b/m);
  return id&&Number(id[1])===pid&&id[2]===name&&pss?Number(pss[1]):null;
}
export async function snapshot(pkg,shell){
  const list=async()=>browserProcesses(await shell(['ps','-A','-o','PID,ARGS']),pkg),before=await list();
  if(!before.size)return {error:'no-matching-processes'};
  let sum=0;for(const [pid,name] of before){const k=processPss(await shell(['dumpsys','meminfo',String(pid)]),pid,name);if(k===null)return {error:'unreadable-process'};sum+=k;}
  const after=await list();if(after.size!==before.size||[...before].some(([pid,name])=>after.get(pid)!==name))return {error:'process-list-changed'};
  return {processes:before.size,sumPssKiB:sum};
}
function summary(rows){return Object.fromEntries(phases.map(stage=>{const sorted=rows.filter(r=>r.stage===stage&&r.sumPssKiB!=null).map(r=>r.sumPssKiB).sort((a,b)=>a-b),n=sorted.length;
  return [stage,{samples:n,medianKiB:n?(sorted[(n-1)>>1]+sorted[n>>1])/2:null,maxSampleKiB:n?sorted[n-1]:null}];}));}
async function main(){
  if(process.argv.includes('--help')){console.log('node scripts/quest-browser-pss.mjs [browser.package]   (default com.oculus.browser)\nOne authorized ADB device, or use ANDROID_SERIAL. Press Enter at each stage; q stops early. Writes to local-review/verification/quest-memory/.');return;}
  const pkg=process.argv[2]??'com.oculus.browser';if(!/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/.test(pkg)||process.argv.length>3)throw Error('Expected one Android browser package name');
  const adb=async args=>(await run('adb',args,{timeout:10000,maxBuffer:4*1024*1024,windowsHide:true})).stdout;
  if((await adb(['get-state'])).trim()!=='device')throw Error('Connect one authorized Quest via ADB');
  const shell=args=>adb(['shell',...args]);if(!browserProcesses(await shell(['ps','-A','-o','PID,ARGS']),pkg).size)throw Error('No browser processes with this package name; open the browser and verify the package');
  const started=new Date(),zero=performance.now(),rows=[],marks=[{phase:'empty',atMs:0}],prompt=['空场取样几次；即将确认放置时回车','现在放置；角色站稳时回车','保持角色在场几次取样；收回背包时回车','保持空场几次取样；回车完成'];let index=0,done=false;
  const input=createInterface({input:process.stdin,output:process.stdout});const stop=()=>{done=true;};
  input.on('line',line=>{if(done)return;if(line.trim()==='q'||index===3){stop();return;}index++;marks.push({phase:phases[index],atMs:Math.round(performance.now()-zero)});console.log(prompt[index]);});input.on('close',stop);input.on('SIGINT',stop);
  console.log('仅测浏览器同包名/前缀进程的 PSS；另开标签页会干扰，不能当整机或演员显存。\n'+prompt[0]);
  try{while(!done&&performance.now()-zero<600000){const i=index,fromMs=Math.round(performance.now()-zero);let v;
    try{v=await snapshot(pkg,shell);}catch{v={error:'adb-sample-unavailable'};}
    const toMs=Math.round(performance.now()-zero);if(i!==index||done)v={error:'stage-boundary'};rows.push({stage:phases[i],fromMs,toMs,...v});
    console.log(phases[i],v.error??`${(v.sumPssKiB/1024).toFixed(1)} MiB (${v.processes} processes)`);if(!done)await delay(2000);
  }}finally{input.close();}
  const dir='local-review/verification/quest-memory';await mkdir(dir,{recursive:true});const file=`${dir}/pss-${started.getTime()}.json`;
  await writeFile(file,JSON.stringify({schema:1,source:'adb-package-prefixed-process-pss',started:started.toISOString(),marks,rows,summary:summary(rows)},null,2));console.log(file);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
