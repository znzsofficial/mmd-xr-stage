import {current} from './current.js';
import {candidate} from './candidate.js';

const $=id=>document.getElementById(id), names=['Three + current MMD','Babylon + babylon-mmd'];
const yieldUI=()=>new Promise(r=>setTimeout(r,0));
const median=arr=>{const a=arr.toSorted((x,y)=>x-y),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2};
const round=x=>+x.toFixed(3),delta=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const ensure=(ok,msg)=>{if(!ok)throw Error(msg)};
function view(label){const f=document.createElement('figure'),c=document.createElement('canvas'),cap=document.createElement('figcaption');c.width=c.height=400;cap.textContent=label;f.append(c,cap);$('views').append(f);return c;}

async function compare(files,vmd){
  const pmx=files.find(f=>f.webkitRelativePath===$('pmx').value);ensure(pmx&&vmd,'需要一份 PMX 和身体 VMD');
  const report={viewport:'400x400 WebGL2, no XR, shadows/AA off',bones:[],modes:[]},previous=[[],[]];
  $('views').replaceChildren();
  for(const on of [false,true]){
    const rigs=[],times=[[],[]],draws=[[],[]],first=[],wristTravel=[0,0],physicsDiff=[0,0];
    try{
      for(const [k,factory] of [current,candidate].entries()){
        $('status').textContent=`加载 ${names[k]} (${on?'开':'关'}物理)`;
        const canvas=view(names[k]+' · '+(on?'物理开':'物理关')),r=await factory(canvas,pmx,files,vmd,on);
        const gl=canvas.getContext('webgl2'),pixel=new Uint8Array(4);
        r.sync=()=>gl.readPixels(200,200,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);rigs.push(r);
      }
      ensure(rigs.every(r=>r.duration>=8),'选一支至少 8 秒的身体动作');
      const counts=rigs.map(r=>r.boneCount);ensure(counts[0]===counts[1],'两边加载的骨骼数不同');report.bones=counts;
      report.diffuseMaterials=rigs.map(r=>r.diffuseMaps);ensure(report.diffuseMaterials[0]===report.diffuseMaterials[1],`漫反射贴图材质数不一致：${report.diffuseMaterials}`);
      ensure(!rigs[0].textureWarnings,'当前运行时报告缺贴图或贴图告警');
      const wrist=['右手首','左手首','RightHand','LeftHand','rightwrist'].find(n=>rigs.every(r=>r.xyz(n)));
      const cloth=rigs[1].dynamicBones.filter(n=>rigs.every(r=>r.xyz(n)));
      ensure(wrist&&cloth.length,'找不到共用的腕骨或 PMX 动态刚体骨');
      for(let block=0;block<20;block++){
        const blockMs=[];
        for(const k of block%2?[1,0]:[0,1]){
          const r=rigs[k];const t=performance.now();
          for(let i=1;i<=24;i++)r.update(block*24+i);
          blockMs[k]=(performance.now()-t)/24;
          if(block>=4)times[k].push(blockMs[k]);
          const pos=r.xyz(wrist);first[k]??=pos;wristTravel[k]=Math.max(wristTravel[k],delta(pos,first[k]));
          const sample=cloth.map(n=>r.xyz(n));ensure(sample.flat().every(Number.isFinite),'姿态非有限值');
          if(!on)previous[k].push(sample);else for(let i=0;i<sample.length;i++)physicsDiff[k]=Math.max(physicsDiff[k],delta(sample[i],previous[k][block][i]));
        }
        $('status').textContent=`${on?'开':'关'}物理：更新 ${block+1}/20`;await yieldUI();
      }
      ensure(wristTravel.every(x=>x>1e-4),'动作没有驱动手腕');if(on)ensure(physicsDiff.every(x=>x>1e-4),'开关物理的动态骨姿态没有差异');
      // Static final pose; measure end-to-end drawing separately, flushing both GL queues.
      for(let block=0;block<12;block++)for(const k of block%2?[1,0]:[0,1]){
        const r=rigs[k];r.sync();const t=performance.now();for(let i=0;i<4;i++)r.draw();r.sync();
        if(block>=4)draws[k].push((performance.now()-t)/4);
      }
      report.modes.push({physics:on,updateMs:times.map(a=>round(median(a))),staticDrawMs:draws.map(a=>round(median(a))),
        updateBlocksMs:times.map(a=>a.map(round)),staticDrawBlocksMs:draws.map(a=>a.map(round)),
        babylonFasterBlocks:times[1].filter((b,i)=>b<times[0][i]).length,comparedDynamicBones:cloth.length,wristTravel:wristTravel.map(round),physicsVsOffMaxDisplacement:on?physicsDiff.map(round):null});
      // Keep an image even after disposing these worlds. Snapshots stay in the browser.
      for(const canvas of $('views').querySelectorAll('canvas')){const img=new Image();img.width=img.height=400;img.src=canvas.toDataURL();canvas.replaceWith(img)}
    }finally{for(const r of rigs)r.dispose();}
  }
  return report;
}
$('model').onchange=()=>{const select=$('pmx');select.replaceChildren();for(const f of $('model').files)if(/\.pmx$/i.test(f.name))select.add(new Option(f.webkitRelativePath,f.webkitRelativePath));};
const button=$('run');button.disabled=false;
button.onclick=async()=>{button.disabled=true;delete window.abDone;$('result').textContent='';try{const r=await compare([...$('model').files],$('motion').files[0]);$('result').textContent=JSON.stringify(r,null,2);window.abDone={report:r};$('status').textContent='完成';}catch(e){$('status').textContent='失败：'+e.message;console.error(e);window.abDone={error:e.message};}finally{button.disabled=false;}};
