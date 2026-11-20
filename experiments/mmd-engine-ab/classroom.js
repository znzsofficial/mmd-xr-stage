import {Engine} from '@babylonjs/core/Engines/engine';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color';
import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Culling/ray';
import {WebXRExperienceHelper} from '@babylonjs/core/XR/webXRExperienceHelper';
import {SdefInjector} from 'babylon-mmd/esm/Loader/sdefInjector';
import {expandAssetFiles} from '../../src/mmdImport/importArchive';
import {withAssetPath} from '../../src/mmdImport/assetPaths';
import {clothSmokeFixture} from '../../scripts/cloth-smoke-fixture.js';
import {classroom,canStand} from './room-geometry';
import {loadContactRig} from './contact-rig';

const $=id=>document.getElementById(id),canvas=$('view'),say=s=>{$('status').textContent=s};
const engine=new Engine(canvas,false,{stencil:true,audioEngine:false},false);SdefInjector.OverrideEngineCreateEffect(engine);
const scene=new Scene(engine);scene.clearColor=new Color4(.66,.79,.86,1);scene.ambientColor=new Color3(.32,.32,.32);
new DirectionalLight('window',new Vector3(.65,-.6,.35),scene).intensity=.95;
new HemisphericLight('fill',Vector3.Up(),scene).intensity=.65;
const floor=classroom(scene),eye=new ArcRotateCamera('screen',-Math.PI/2,1.38,3.2,new Vector3(0,1,.7),scene);
eye.minZ=.03;eye.maxZ=80;eye.lowerRadiusLimit=.22;eye.upperRadiusLimit=12;eye.wheelDeltaPercentage=.015;eye.attachControl(canvas,false);eye.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
function reset(){eye.setTarget(new Vector3(0,1,.7));eye.setPosition(new Vector3(.15,1.6,-2.7));eye.inertialAlphaOffset=eye.inertialBetaOffset=eye.inertialRadiusOffset=0}reset();
const keys=new Set(),suffix=new Set('WASDQEFCR');canvas.onkeydown=e=>{if(e.ctrlKey||e.metaKey||e.altKey||!e.code.startsWith('Key')||!suffix.has(e.code.slice(3)))return;e.preventDefault();if(e.code==='KeyR')reset();else keys.add(e.code)};
canvas.onkeyup=e=>keys.delete(e.code);canvas.onblur=()=>keys.clear();window.addEventListener('blur',()=>keys.clear());
function keyboard(dt){if(!keys.size)return;const axis=(p,n)=>Number(keys.has('Key'+p))-Number(keys.has('Key'+n));const pos=eye.position.clone(),dir=eye.target.subtract(pos),a=axis('Q','E')*dt*1.45,c=Math.cos(a),s=Math.sin(a);
  const z=dir.z;dir.z=z*c-dir.x*s;dir.x=dir.x*c+z*s;const forward=new Vector3(dir.x,0,dir.z).normalize(),right=new Vector3(forward.z,0,-forward.x);
  const move=forward.scale(axis('W','S')).addInPlace(right.scale(axis('D','A')));move.y=axis('F','C');move.normalize().scaleInPlace(dt*2.4);pos.addInPlace(move);eye.setTarget(pos.add(dir));eye.setPosition(pos);}

let files=[],rig=null,xr=null,busy=false,placing=false,last=null,report=null,activeSession=null;
function controls(){for(const id of ['files','folder','demo','trial','pmx','vmd','physics'])$(id).disabled=busy||!!activeSession;
  $('load').disabled=busy||!!activeSession||!$('pmx').value;$('xr').disabled=busy||!xr||!!activeSession;
  $('garment').disabled=busy||!!activeSession||!$('pmx').value||!$('vmd').value;
  $('play').disabled=busy||!rig?.hasMotion;$('place').disabled=busy||!rig;$('save').disabled=!report?.frames||!!activeSession;
  $('play').textContent=rig?.playing?'暂停':'播放';$('place').textContent=placing?'取消摆放':'点击地面摆放';}
async function task(fn){if(busy)return;busy=true;controls();try{await fn()}catch(e){say('未完成：'+(e.message??e));console.error(e)}finally{busy=false;controls()}}
function pathOf(f){return f.webkitRelativePath||f.name}
async function selectFiles(input){const add=await expandAssetFiles([...input.files]);const table=new Map(files.map(f=>[pathOf(f),f]));for(const f of add)table.set(pathOf(f),f.webkitRelativePath?f:withAssetPath(f,f.name));files=[...table.values()];
  for(const [id,re] of [['pmx',/\.pmx$/i],['vmd',/\.vmd$/i]]){const el=$(id),prev=el.value;el.replaceChildren();if(id==='vmd')el.add(new Option('无动作',''));files.forEach((f,i)=>{if(re.test(f.name))el.add(new Option(pathOf(f),String(i)))});if([...el.options].some(o=>o.value===prev)&&prev)el.value=prev;else if(id==='vmd'&&el.options.length===2)el.selectedIndex=1;}
  say('已读取文件，选好角色和动作后点「放入角色」。');}
for(const id of ['files','folder'])$(id).onchange=()=>task(()=>selectFiles($(id)));
for(const id of ['pmx','vmd'])$(id).onchange=controls;
async function load(f,refs,motion,scale){say('正在读取本地角色和材质…');const next=await loadContactRig(scene,f,refs,motion,{scale,physics:$('physics').checked});rig?.dispose();rig=next;placing=false;
  say((!rig.canContact&&$('physics').checked?'角色已放入；该模型没有可用的动态接触组。':'已放入。播放动作或进 VR；右 A 暂停。')+(rig.missingTextures?` 缺 ${rig.missingTextures} 个本地贴图引用。`:''));}
$('load').onclick=()=>task(()=>load(files[+$('pmx').value],files,$('vmd').value?files[+$('vmd').value]:null));
$('demo').onclick=()=>task(async()=>{const {pmx,vmd}=clothSmokeFixture(true);await load(pmx,[pmx],vmd,1);rig.pos.set(0,0,.45)});
function move(x,z){if(!rig||!canStand(x,z))return false;rig.resetHands();rig.pos.x=x;rig.pos.z=z;return true;}
$('reset').onclick=reset;$('place').onclick=()=>{placing=!placing;controls()};
canvas.addEventListener('click',()=>{if(!placing||activeSession)return;const hit=scene.pick(scene.pointerX,scene.pointerY,n=>n===floor);if(hit?.pickedPoint&&move(hit.pickedPoint.x,hit.pickedPoint.z)){placing=false;controls();say('角色已移动。')}else say('这里不能摆放，请点教室内的空地。')});
async function toggle(){if(!rig?.hasMotion)return;if(rig.playing)rig.pause();else await rig.play();controls()}
$('play').onclick=()=>task(toggle);
$('trial').onclick=()=>task(async()=>{const tmp=new Scene(engine);try{const {clothTrial}=await import('./cloth-trial');const result=await clothTrial(tmp);$('results').textContent=JSON.stringify(result,null,2);say('暂停拨衣对照通过。')}finally{tmp.dispose()}});
$('garment').onclick=()=>task(async()=>{say('在独立场景重放两次，同一轨迹有／无触碰…');const tmp=new Scene(engine);try{const {garmentTrial}=await import('./garment-trial');const r=await garmentTrial(tmp,files[+$('pmx').value],files,files[+$('vmd').value]);$('results').textContent=JSON.stringify(r,null,2);say('实模裙摆对照完成。')}finally{tmp.dispose()}});
function marker(id,r,color){const m=MeshBuilder.CreateSphere(id,{diameter:r*2,segments:12},scene);const mat=new StandardMaterial(id,scene);mat.emissiveColor=Color3.FromHexString(color);mat.alpha=.32;m.material=mat;m.isPickable=false;m.setEnabled(false);return m;}
const palms={left:marker('left grip',.08,'#a6e9d1'),right:marker('right grip',.08,'#e5c191')};
const landing=marker('target',.07,'#8de9bb');landing.scaling.y=.14;
function groundRay(frame,src){const pose=frame.getPose(src.targetRaySpace,xr.sessionManager.referenceSpace);if(!pose)return null;const p=pose.transform.position,m=pose.transform.matrix;if(m[9]<=.025)return null;const t=p.y/m[9],x=p.x-t*m[8],z=-p.z+t*m[10];return t>0&&t<10&&canStand(x,z)?{x,z}:null;}
const buttonDown={a:false,b:false},tracked={left:null,right:null};
function xrInput(frame,dt){const sources=frame.session.inputSources,visible=frame.session.visibilityState==='visible';for(const hand of ['left','right']){
  const src=visible&&Array.from(sources).find(i=>!i.hand&&i.handedness===hand&&i.gripSpace);if(tracked[hand]!==src){rig?.contact(hand,null,0);tracked[hand]=src;}const pose=src&&frame.getPose(src.gripSpace,xr.sessionManager.referenceSpace),p=pose?.transform.position;
  const m=palms[hand];m.setEnabled(!!p);if(p)m.position.set(p.x,p.y,-p.z);rig?.contact(hand,p?m.position:null,dt);
  if(hand==='left'){const hit=src&&groundRay(frame,src);landing.setEnabled(!!hit&&!!rig);if(hit)landing.position.set(hit.x,.012,hit.z)}
  else for(const [n,i] of [['a',4],['b',5]]){const down=!!src?.gamepad?.buttons[i]?.pressed;if(down&&!buttonDown[n]){if(n==='a')void toggle().catch(e=>say(e.message));else void xr.exitXRAsync().catch(e=>say(e.message))}buttonDown[n]=down;}
}}

// Report the actual XR callback intervals and model work. Separate playing vs
// paused and include projection dimensions so different runs can be matched.
function summary(){const buckets={};for(const [mode,rows] of Object.entries(report.samples)){const vals=rows.map(r=>r[0]).sort((a,b)=>a-b),q=p=>vals[Math.floor((vals.length-1)*p)];if(vals.length)buckets[mode]={frames:vals.length,intervalMedianMs:q(.5),intervalP95Ms:q(.95),meanModelMs:rows.reduce((t,r)=>t+r[1],0)/rows.length}}return {...report,samples:undefined,buckets};}
$('save').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(summary(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='babylon-classroom-'+new Date().toISOString().replace(/:/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function finish(){activeSession=null;last=null;xr.sessionManager.currentFrame=null;keys.clear();rig?.resetHands();buttonDown.a=buttonDown.b=false;for(const m of [...Object.values(palms),landing])m.setEnabled(false);controls();say('已退出 VR，角色保留在原位。可导出记录或再次进入。');}
async function initXR(){try{if(!await navigator.xr?.isSessionSupported('immersive-vr'))return;xr=await WebXRExperienceHelper.CreateAsync(scene);xr.camera.compensateOnFirstFrame=false;xr.camera.minZ=.03;xr.camera.maxZ=80;
    // Start at the central aisle, not at the last desktop orbit position.
    xr.onInitialXRPoseSetObservable.add(camera=>{camera.position.setAll(0);camera.rotationQuaternion.set(0,0,0,1)});
    const manager=xr.sessionManager;manager.onXRSessionInit.add(session=>{activeSession=session;last=null;report={format:'babylon-classroom/1',frames:0,physics:!!rig?.rt.physics,hasActor:!!rig,refreshHz:session.frameRate??null,views:0,layer:null,samples:{playing:[],paused:[]}};rig?.resetHands();keys.clear();
      session.addEventListener('visibilitychange',()=>{last=null;rig?.resetHands()});session.addEventListener('selectend',e=>{if(e.inputSource.handedness!=='left'||session.visibilityState!=='visible')return;const hit=groundRay(e.frame,e.inputSource);if(hit)move(hit.x,hit.z)});session.addEventListener('end',finish,{once:true});});
  }catch(e){say('屏幕观看可用，VR 初始化未完成：'+e.message)}finally{controls()}}
$('xr').onclick=()=>task(async()=>{try{await xr.enterXRAsync('immersive-vr','local-floor');say('头显已进入。')}catch(e){if(activeSession)await activeSession.end().catch(()=>{});throw e}});
engine.runRenderLoop(()=>{const manager=xr?.sessionManager,frame=activeSession&&manager?.inXRFrameLoop&&manager.currentFrame?.session===activeSession&&manager.currentFrame,dt=Math.min(.05,Math.max(0,engine.getDeltaTime()/1000));
  if(frame){const current=manager.currentTimestamp;const interval=last===null?null:current-last;last=current;
    if(frame.session.visibilityState==='visible'&&frame.getViewerPose(manager.referenceSpace)){xrInput(frame,dt);const start=performance.now();rig?.step(dt);const work=performance.now()-start;
      if(!report.frames){const layer=frame.session.renderState.baseLayer;report.layer=layer?[layer.framebufferWidth,layer.framebufferHeight]:null;report.views=frame.getViewerPose(manager.referenceSpace).views.length;}
      report.frames++;const arr=report.samples[rig?.playing?'playing':'paused'];if(interval>0&&arr.length<18000)arr.push([interval,work]);
    }else{last=null;rig?.resetHands()}
  }else{keyboard(dt);rig?.step(dt)}scene.render();});
window.addEventListener('resize',()=>engine.resize());controls();say('教室就绪。可选角色包或直接试布片。');void initXR();

// Read-only instrumentation in probe mode; automation must still use normal
// UI and XR input to move, touch, pause and exit.
if(new URLSearchParams(location.search).has('probe'))window.classroomSample=()=>{
  const i=rig?.model.runtimeBones.findIndex(b=>b.name==='hem')??-1;
  const xyz=i>=0?rig.model.worldTransformMatrices.subarray(i*16+12,i*16+15):null;
  return {frame:rig?.frame,playing:rig?.playing,position:rig?.pos.asArray(),scale:rig?.scale,bones:rig?.model.runtimeBones.length,eye:eye.position.asArray(),target:eye.target.asArray(),hem:xyz?Array.from(xyz):null,report:report?summary():null};};
