import {Matrix4,PerspectiveCamera,Vector3,WebGPUCoordinateSystem} from 'three';
import {loadActor} from './actor';
import {openDevice} from './gpu';
import {recorder} from './report';
import {computeTimer} from './timer';
import {makeSwatch} from './swatch';

const $=s=>document.querySelector(s),canvas=$('canvas'),cam=new PerspectiveCamera(42,1,.025,60),vp=new Matrix4(),origin=new Matrix4().makeTranslation(0,0,-.85);
cam.coordinateSystem=WebGPUCoordinateSystem;
const report=recorder(),modes=['bullet','cut','gpu-face','gpu'];let dev,context,format,depth,canXR=false,actor,loading=false,dead=false;
let files=[],models=[],screenRaf=0,session=null,space,layer,binding,xrFormat,preparing=false;
let last=0,credit=0,yaw=.20,pitch=.13,distance=3.05,frames=0,lastDims='',buttons=new Map(),timer;
const status=text=>$('#status').textContent=text;
const faceLabel={standby:'待抬腿',preparing:'拟合中',active:'已贴合',unsupported:'未匹配',failed:'未就绪',stale:'姿势已变'};
function controls(){const off=loading||!actor||dead;for(const id of ['mode','pose','stroke'])$('#'+id).disabled=off;$('#xr').disabled=off||!canXR||preparing;$('#save').disabled=!report.rows.length;
  for(const id of ['swatch','folder','file','model'])$('#'+id).disabled=dead||loading||!!session;}
function mark(){last=0;credit=0;report.boundary();}
function choose(m){actor.mode=m;$('#mode').value=m;mark();}
function pose(){try{actor.pose();$('#pose').textContent=actor.raised?'恢复站立':'仰卧抬腿';mark();}catch(e){status(e.message);}}
function stop(e){if(dead)return;dead=true;cancelAnimationFrame(screenRaf);session?.end().catch(()=>{});depth?.destroy();actor?.dispose();actor=null;controls();status('实验停止：'+e.message+'。重新载入可重试。');}
async function ready(){if(dev)return;const {device,immerse}=await openDevice();dev=device;timer=computeTimer(dev);canXR=immerse;format=navigator.gpu.getPreferredCanvasFormat();context=canvas.getContext('webgpu');context.configure({device:dev,format});
  dev.addEventListener('uncapturederror',e=>stop(e.error));dev.lost.then(info=>{if(info.reason!=='destroyed')stop(Error('GPU 设备已断开'));});}
async function load(){if(loading||!models.length)return;loading=true;cancelAnimationFrame(screenRaf);actor?.dispose();actor=null;controls();status('正在读取原衣模型与裙链…');
  try{await ready();actor=await loadActor(dev,format,models[Number($('#model').value)||0],files);report.clear();mark();$('#mode').value='gpu';$('#pose').textContent='仰卧抬腿';$('#meter').textContent='';status(`${actor.info.particles} 个裙摆节点 · ${actor.info.pins} 个腰口固定点 · ${actor.info.textures} 个带贴图的材质${canXR?'':' · 本浏览器仅支持屏幕实验'}`);screenRaf=requestAnimationFrame(screen);}
  catch(e){status('未能打开：'+e.message);}finally{loading=false;controls();}}
function pick(e){files=Array.from(e.target.files);models=files.filter(f=>/\.pmx$/i.test(f.name));$('#model').replaceChildren(...models.map((m,i)=>new Option(m.name,String(i))));$('#model').hidden=models.length<2;if(models.length)void load();else status('目录中未找到 PMX 模型');}
$('#folder').onchange=pick;$('#file').onchange=pick;$('#model').onchange=load;$('#mode').onchange=e=>choose(e.target.value);$('#pose').onclick=pose;$('#stroke').onclick=()=>actor.startStroke();
$('#swatch').onclick=()=>pick({target:{files:[makeSwatch()]}});
$('#save').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({schema:1,experiment:'gpu-cloth',rig:actor?.info,timestampQuery:!!timer,windows:report.rows,gaps:report.gaps},null,2)],{type:'application/json'}));a.href=url;a.download='cloth-lab-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function render(time,views,hands,kind,hz){const dt=last?(time-last)/1000:0;last=time;if(dt<0||dt>.25){if(dt>.25)report.gap(kind,actor.mode,dt*1000);actor.reset();report.boundary();credit=0;}
  const safe=Math.min(.05,Math.max(0,dt));actor.update(safe,hands);const active=actor.mode.startsWith('gpu'),seed=actor.takeSeed();let steps=0;const enc=dev.createCommandEncoder();
  let stamp;if(active){credit+=safe;steps=Math.min(3,Math.floor(credit*72+1e-6));credit=Math.max(0,Math.min(1/72,credit-steps/72));if(seed){steps=1;credit=0;}stamp=steps&&!seed?timer?.begin():undefined;actor.gpu.solve(enc,steps,seed,stamp,actor.faceState==='active');if(stamp)timer.encode(enc);}
  const hint=faceLabel[actor.faceState]??'',label=kind==='xr'?$('#mode').selectedOptions[0].textContent+(hint?' · '+hint:''):null;
  for(let i=0;i<views.length;i++){const v=views[i];actor.gpu.draw(enc,v.format,i,v.mat,v.color,v.depth,v.viewport,active,label);}dev.queue.submit([enc.finish()]);frames++;
  if(stamp){const e=report.epoch;timer.collect(t=>report.sampleGPU(e,t/steps));}
  if(dt>0&&dt<=.25){const r=report.add({kind,mode:actor.mode,faceContact:actor.faceState,pose:actor.raised?'legsUp':'standing',stroke:actor.stroking,views:views.length,dimensions:lastDims,refreshHz:hz??null,bodies:actor.counts.bodies,joints:actor.counts.joints},dt*1000,steps,actor.counts.worldMs);
    if(r){$('#meter').textContent=(hint?'裙面'+hint+' · ':'')+`${r.fps} FPS · 帧间隔 P95 ${r.intervalP95Ms} ms · Bullet 步进中位 ${r.bulletWorldP50Ms??'—'} ms · ${r.bodies} 刚体 / ${r.joints} 关节`;$('#save').disabled=false;}}}
function screen(time){if(session||!actor||dead||loading)return;try{const w=Math.max(2,Math.round(canvas.clientWidth)),h=Math.max(2,Math.round(canvas.clientHeight));if(!depth||canvas.width!==w||canvas.height!==h){depth?.destroy();canvas.width=w;canvas.height=h;depth=dev.createTexture({size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});}
  const y=actor.raised?.50:1.0;cam.aspect=w/h;cam.position.set(distance*Math.sin(yaw)*Math.cos(pitch),y+distance*Math.sin(pitch),distance*Math.cos(yaw)*Math.cos(pitch));cam.lookAt(0,y,0);cam.updateProjectionMatrix();cam.updateMatrixWorld();lastDims=`${w}x${h}`;
  render(time,[{mat:vp.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse).elements,color:context.getCurrentTexture().createView(),depth:depth.createView(),format}],null,'screen',null);screenRaf=requestAnimationFrame(screen);
  }catch(e){stop(e);}}
let drag;canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;yaw-=(e.clientX-drag[0])*.008;pitch=Math.max(-.65,Math.min(1.35,pitch+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];};canvas.onlostpointercapture=()=>drag=null;
canvas.onwheel=e=>{e.preventDefault();distance=Math.max(.55,Math.min(4.5,distance*Math.exp(e.deltaY*.001)));};

async function enter(){if(preparing||session)return;preparing=true;controls();let s;
  try{s=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['webgpu','local-floor']});session=s;cancelAnimationFrame(screenRaf);s.addEventListener('end',()=>{if(session!==s)return;session=null;buttons.clear();actor?.reset();mark();controls();if(actor&&!dead)screenRaf=requestAnimationFrame(screen);},{once:true});
    binding=new XRGPUBinding(s,dev);xrFormat=binding.getPreferredColorFormat();await actor.gpu.prepareXR(xrFormat);if(session!==s)return;
    layer=binding.createProjectionLayer({colorFormat:xrFormat,depthStencilFormat:'depth24plus'});s.updateRenderState({layers:[layer]});space=await s.requestReferenceSpace('local-floor');if(s.supportedFrameRates?.includes(72))await s.updateTargetFrameRate(72).catch(()=>{});
    if(session===s){actor.reset();mark();s.requestAnimationFrame(xrFrame);}}
  catch(e){if(session===s&&s)await s.end().catch(()=>{});status('无法进入 WebGPU VR：'+e.message+'。屏幕对照仍可用。');}finally{preparing=false;controls();}}
function xrFrame(time,frame){const s=frame.session;if(session!==s||dead)return;try{const tracked=frame.getViewerPose(space);if(!tracked||s.visibilityState==='hidden'){actor.reset();mark();s.requestAnimationFrame(xrFrame);return;}
  const hands=[null,null];for(const source of s.inputSources){const side=source.handedness;if(side!=='left'&&side!=='right')continue;const p=source.gripSpace&&frame.getPose(source.gripSpace,space);if(p){const v=p.transform.position;hands[side==='left'?0:1]=new Vector3(v.x,v.y,v.z+.85);}
    const down=!!source.gamepad?.buttons[4]?.pressed;if(down&&!buttons.get(source)){if(side==='left')choose(modes[(modes.indexOf(actor.mode)+1)%modes.length]);else pose();}buttons.set(source,down);}for(const source of buttons.keys())if(!Array.from(s.inputSources).includes(source))buttons.delete(source);
  const views=tracked.views.map(v=>{const sub=binding.getViewSubImage(layer,v),desc=sub.getViewDescriptor();return {mat:new Matrix4().fromArray(v.projectionMatrix).multiply(new Matrix4().fromArray(v.transform.inverse.matrix)).multiply(origin).elements,
     color:sub.colorTexture.createView(desc),depth:sub.depthStencilTexture.createView(desc),viewport:sub.viewport,format:xrFormat};});lastDims=views.map(v=>`${v.viewport.width}x${v.viewport.height}`).join('/');render(time,views,hands,'xr',s.frameRate);s.requestAnimationFrame(xrFrame);
  }catch(e){status('XR 绘制失败：'+e.message);s.end().catch(()=>{});}}
$('#xr').onclick=enter;
document.addEventListener('visibilitychange',()=>{mark();actor?.reset();});
window.addEventListener('pagehide',event=>{if(event.persisted)return;dead=true;cancelAnimationFrame(screenRaf);void session?.end().catch(()=>{});actor?.dispose();actor=null;depth?.destroy();timer?.dispose();context?.unconfigure();dev?.destroy();});
if(new URLSearchParams(location.search).has('probe'))globalThis.clothProbe=()=>({actor,frames,report:report.rows,device:dev,screen,halt:()=>cancelAnimationFrame(screenRaf)});
