import {Matrix4,PerspectiveCamera,WebGPUCoordinateSystem} from 'three';
import {loadActor} from './actor';
import {openDevice} from './gpu';
import {recorder} from './report';
import {computeTimer} from './timer';
import {makeSwatch} from './swatch';
import {clothXR} from './xrLifecycle.js';
import {makeXRTargets} from './xrTargets.js';
import {xrPalms} from './xrPalms.js';
import {compareTake} from './danceTake.js';

const $=s=>document.querySelector(s),canvas=$('canvas'),cam=new PerspectiveCamera(42,1,.025,60),vp=new Matrix4(),origin=new Matrix4().makeTranslation(0,0,-.85);
cam.coordinateSystem=WebGPUCoordinateSystem;
const palms=xrPalms(),actorFromWorld=origin.clone().invert();
const report=recorder(),modes=['bullet','cut','gpu-face','gpu'];let dev,context,format,depth,canXR=false,actor,loading=false,dead=false;
let files=[],models=[],screenRaf=0,screenGpuCheck=null,motionBusy=false;
let last=0,credit=0,yaw=.20,pitch=.13,distance=3.05,frames=0,lastDims='',buttons=new Map(),timer;
const status=text=>$('#status').textContent=text;
const faceLabel={standby:'待抬腿',preparing:'拟合中',active:'已贴合',unsupported:'未匹配',failed:'未就绪',stale:'姿势已变'};
const takeLabels={dance:'播舞',settle:'暂停',lift:'抬手',both:'双手托住',right:'撤左手',release:'双手撤出',resume:'续播'};
function actionLabels(){if(!actor)return;$('#mode').value=actor.mode;$('#pose').textContent=actor.clipId?(actor.playing?'暂停动作':'播放动作'):actor.raised?'恢复站立':'仰卧抬腿';$('#pair').textContent=actor.take?'停止对照':'同段对照';}
function controls(){const off=loading||motionBusy||!actor||dead;for(const id of ['mode','pose','stroke'])$('#'+id).disabled=off;$('#stroke').disabled=off||!!actor?.take;$('#xr').disabled=off||!canXR;$('#save').disabled=!report.exportable;
  $('#dance').disabled=off||xr.busy;$('#unload').disabled=off||xr.busy||!actor?.clipId;$('#pair').disabled=off||!(actor?.duration>=8);actionLabels();
  $('#xr').textContent=xr.busy?(xr.session?'退出 VR':'取消进入 VR'):'进入 VR';
  for(const id of ['swatch','folder','file','model'])$('#'+id).disabled=dead||motionBusy||loading||xr.busy;}
function mark(){last=0;credit=0;report.boundary();}
function choose(m){actor.mode=m;mark();controls();}
function pose(){try{actor.pose();mark();controls();}catch(e){status(e.message);}}
function compare(){try{actor.compare();$('#comparison').textContent='';mark();controls();}catch(e){status(e.message);}}
$('#pair').onclick=compare;$('#unload').onclick=()=>{actor.clearDance();$('#dance').value='';$('#comparison').textContent='';mark();controls();status('已恢复站姿');};
$('#dance').onchange=async e=>{const owner=actor,file=e.target.files[0];if(!file||!owner||xr.busy||motionBusy)return;motionBusy=true;controls();
  try{await owner.loadDance(file);if(!dead&&actor===owner){mark();$('#comparison').textContent='';status(`身体动作 · ${owner.duration.toFixed(1)} 秒`);}}
  catch(err){status('未能载入身体动作：'+err.message);}finally{motionBusy=false;$('#dance').value='';controls();}};
function stop(e,stage='screen-draw'){if(dead)return;dead=true;cancelAnimationFrame(screenRaf);xr.fault(stage,e);depth?.destroy();actor?.dispose();actor=null;controls();status('实验停止：'+e.message+'。重新载入可重试。');}
async function ready(){if(dev)return;const {device,immerse}=await openDevice();if(dead){device.destroy();return;}dev=device;timer=computeTimer(dev);canXR=immerse;format=navigator.gpu.getPreferredCanvasFormat();context=canvas.getContext('webgpu');context.configure({device:dev,format});
  dev.addEventListener('uncapturederror',({error})=>{
    if(xr.session){xr.fault('gpu-uncaptured',error);return;}
    if(!report.xr.attempts.length){stop(error,'screen-gpu');return;}
    // Uncaptured events have no originating frame/session. A late device event
    // must not kill the returned canvas: check the next screen draw itself.
    screenGpuCheck=error.constructor.name==='GPUOutOfMemoryError'?'out-of-memory':error.constructor.name==='GPUInternalError'?'internal':'validation';
  });dev.lost.then(info=>{if(info.reason!=='destroyed')stop(Error('GPU 设备已断开'),'device-lost');});}
async function load(){if(dead||xr.busy||loading||!models.length)return;loading=true;cancelAnimationFrame(screenRaf);actor?.dispose();actor=null;$('#comparison').textContent='';controls();status('正在读取原衣模型与裙链…');
  try{await ready();if(dead)return;const loaded=await loadActor(dev,format,models[Number($('#model').value)||0],files);if(dead){loaded.dispose();return;}actor=loaded;report.clear();mark();$('#mode').value='gpu';$('#pose').textContent='仰卧抬腿';$('#meter').textContent='';status(`${actor.info.particles} 个裙摆节点 · ${actor.info.pins} 个腰口固定点 · ${actor.info.textures} 个带贴图的材质${canXR?'':' · 本浏览器仅支持屏幕实验'}`);screenRaf=requestAnimationFrame(screen);}
  catch(e){status('未能打开：'+e.message);}finally{loading=false;controls();}}
function pick(e){files=Array.from(e.target.files);models=files.filter(f=>/\.pmx$/i.test(f.name));$('#model').replaceChildren(...models.map((m,i)=>new Option(m.name,String(i))));$('#model').hidden=models.length<2;if(models.length)void load();else status('目录中未找到 PMX 模型');}
$('#folder').onchange=pick;$('#file').onchange=pick;$('#model').onchange=load;$('#mode').onchange=e=>choose(e.target.value);$('#pose').onclick=pose;$('#stroke').onclick=()=>actor.startStroke();
$('#swatch').onclick=()=>pick({target:{files:[makeSwatch()]}});
$('#save').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(report.export(actor?.info,!!timer),null,2)],{type:'application/json'}));a.href=url;a.download='cloth-lab-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function render(time,views,hands,kind,hz,submit=enc=>dev.queue.submit([enc.finish()])){const dt=last?(time-last)/1000:0;last=time;if(dt<0||dt>.25){if(dt>.25)report.gap(kind,actor.mode,dt*1000);if(actor.take){actor.cancelTake();controls();}actor.reset();report.boundary();credit=0;}
  const safe=Math.min(.05,Math.max(0,dt)),round=actor.take?.round,prevTake=actor.take?.phase,prevMode=actor.mode,wasPlaying=actor.playing;
  actor.update(safe,hands,dt>0&&dt<=.25?dt:0);if(prevTake!==actor.take?.phase||prevMode!==actor.mode||actor.playing!==wasPlaying)controls();
  if(round&&!actor.take){const rows=compareTake(report.rows,actor.clipId,round);$('#comparison').textContent=rows.length?'本轮回调 P95（Bullet / GPU，ms） · '+rows.map(r=>`${takeLabels[r.phase]} ${r.bulletP95.toFixed(1)} / ${r.gpuP95.toFixed(1)}`).join('　'):'本轮缺少可配对的完整窗口';}
  const active=actor.mode.startsWith('gpu'),seed=actor.takeSeed();let steps=0;const enc=dev.createCommandEncoder();
  let stamp;if(active){credit+=safe;steps=Math.min(3,Math.floor(credit*72+1e-6));credit=Math.max(0,Math.min(1/72,credit-steps/72));if(seed){steps=1;credit=0;}stamp=steps&&!seed?timer?.begin():undefined;actor.gpu.solve(enc,steps,seed,stamp,actor.faceState==='active');}
  const hint=actor.take?takeLabels[actor.take.phase]:actor.clipId?(actor.playing?'播舞':'暂停'):faceLabel[actor.faceState]??'',label=kind==='xr'?$('#mode').selectedOptions[0].textContent+(hint?' · '+hint:''):null;
  for(let i=0;i<views.length;i++){const v=views[i];actor.gpu.draw(enc,v.format,i,v.mat,v.color,v.depth,v.viewport,active,label,kind==='xr'?v:undefined);}
  if(stamp)timer.encode(enc);try{submit(enc);}finally{if(stamp){const e=report.epoch;timer.collect(t=>report.sampleGPU(e,t/steps));}}frames++;
  if(dt>0&&dt<=.25){const r=report.add({kind,mode:actor.mode,faceContact:actor.faceState,pose:actor.clipId?'vmd':actor.raised?'legsUp':'standing',...(actor.clipId&&{clip:actor.clipId,playing:actor.playing,take:actor.take?.round??null,phase:actor.take?.phase??'manual'}),stroke:actor.stroking,views:views.length,dimensions:lastDims,refreshHz:hz??null,bodies:actor.counts.bodies,joints:actor.counts.joints},dt*1000,steps,actor.counts.worldMs,actor.clipId?actor.seconds:null);
    if(r){let meter=(hint?hint+' · ':'')+`${r.fps} FPS · 帧间隔 P95 ${r.intervalP95Ms} ms · Bullet 步进中位 ${r.bulletWorldP50Ms??'—'} ms · ${r.bodies} 刚体 / ${r.joints} 关节`;
      $('#meter').textContent=meter;$('#save').disabled=false;}}}
function screen(time){if(xr.session||!actor||dead||loading)return;
  const check=screenGpuCheck;screenGpuCheck=null;if(check)dev.pushErrorScope(check);
  try{const w=Math.max(2,Math.round(canvas.clientWidth)),h=Math.max(2,Math.round(canvas.clientHeight));if(!depth||canvas.width!==w||canvas.height!==h){depth?.destroy();canvas.width=w;canvas.height=h;depth=dev.createTexture({size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});}
  const y=actor.raised?.50:1.0;cam.aspect=w/h;cam.position.set(distance*Math.sin(yaw)*Math.cos(pitch),y+distance*Math.sin(pitch),distance*Math.cos(yaw)*Math.cos(pitch));cam.lookAt(0,y,0);cam.updateProjectionMatrix();cam.updateMatrixWorld();lastDims=`${w}x${h}`;
   render(time,[{mat:vp.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse).elements,color:context.getCurrentTexture().createView(),depth:depth.createView(),format}],null,'screen',null);xr.screenSubmitted();screenRaf=requestAnimationFrame(screen);
   }catch(e){stop(e);}finally{if(check){const attempt=report.xr.attempts.at(-1),owner=actor;
     const finish=e=>{if(e&&owner===actor&&!xr.busy&&report.xr.attempts.at(-1)===attempt)stop(e,'screen-gpu');};dev.popErrorScope().then(finish,finish);}}}
let drag;canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;yaw-=(e.clientX-drag[0])*.008;pitch=Math.max(-.65,Math.min(1.35,pitch+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];};canvas.onlostpointercapture=()=>drag=null;
canvas.onwheel=e=>{e.preventDefault();distance=Math.max(.55,Math.min(4.5,distance*Math.exp(e.deltaY*.001)));};

function drawXR({time,frame,space,poses,targets,withActor,submit,inputs}){
   const s=frame.session;for(let i=0;i<poses.length;i++){const v=poses[i];targets[i].mat=new Matrix4().fromArray(v.projectionMatrix).multiply(new Matrix4().fromArray(v.transform.inverse.matrix)).multiply(origin).elements;}
   if(!withActor){const enc=dev.createCommandEncoder();for(const t of targets)t.beginPass(enc,t.mat).end();submit(enc);return;}
   const hands=palms.read(frame,space,actorFromWorld);inputs(palms.kinds);
   for(const source of s.inputSources){const side=source.handedness;if(side!=='left'&&side!=='right')continue;
     const down=(source.gamepad?.buttons[4]?.pressed?1:0)|(source.gamepad?.buttons[5]?.pressed?2:0),pressed=down&~(buttons.get(source)??0);if(pressed&1){if(side==='left')choose(modes[(modes.indexOf(actor.mode)+1)%modes.length]);else pose();}else if(side==='left'&&(pressed&2)&&actor.clipId)compare();buttons.set(source,down);}for(const source of buttons.keys())if(!Array.from(s.inputSources).includes(source))buttons.delete(source);
   lastDims=targets.map(v=>`${v.viewport.width}x${v.viewport.height}`).join('/');render(time,targets,hands,'xr',s.frameRate,submit);
}
const xr=clothXR({receipts:report.xr,requestSession:(...args)=>navigator.xr.requestSession(...args),makeBinding:(s,d)=>new XRGPUBinding(s,d),makeTargets:makeXRTargets,
   prepareActor:f=>actor.gpu.prepareXR(f),draw:drawXR,trackingGap(){palms.reset();actor.cancelTake();actor.reset();mark();controls();},acquired(){cancelAnimationFrame(screenRaf);palms.reset();actor.cancelTake();actor.reset();mark();},
   returned(paused){buttons.clear();palms.reset();if(paused&&!dead&&actor){actor.cancelTake();actor.reset();mark();controls();screenRaf=requestAnimationFrame(screen);}},
  changed(r){controls();const messages={requesting:'正在申请 VR 会话…',initializing:'VR 已连接，正在准备投影层…','awaiting-frame':'VR 已连接，等待头显首帧…',
    hidden:'VR 会话已隐藏',noPose:'VR 已连接，等待头部追踪…',noViews:'VR 已取得姿态，等待眼视图…',
    landmark:r.actorState==='failed'?'VR 已提交地标；角色绘制未就绪':'VR 已提交地标；等待角色首帧…',actor:'VR 已提交地标和角色',
    ended:`VR 已结束 · ${r.frames.stereoSubmitted} 次双眼提交（含角色 ${r.frames.withActor} 帧）`,failed:`VR 失败：${r.error?.stage} / ${r.error?.type}。可导出本次记录。`};status(messages[r.phase]);}});
$('#xr').onclick=()=>xr.busy?xr.close():xr.enter(dev);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&actor?.take){actor.cancelTake();controls();}mark();actor?.reset();});
window.addEventListener('pagehide',event=>{if(event.persisted)return;dead=true;cancelAnimationFrame(screenRaf);xr.close('pagehide');actor?.dispose();actor=null;depth?.destroy();timer?.dispose();context?.unconfigure();dev?.destroy();});
if(new URLSearchParams(location.search).has('probe'))globalThis.clothProbe=()=>({actor,frames,report:report.rows,xrAttempts:report.xr.attempts,device:dev,screen,halt:()=>cancelAnimationFrame(screenRaf)});
