import {useLanguageStore} from '../../../languageStore';
import {eggsFor,useConception} from '../../bodyState/reproduction/store';
import {REFERENCE_TISSUE as tissue} from '../../bodyState/data';
import {createPictureClock,PICTURE_END,RESULT_REVEAL_SECONDS} from '../../bodyState/reproduction/pictureClock';
import type {EggReplay} from '../../bodyState/reproduction/eggReplay';
import {semenColor} from '../../play/semenAppearance';
import {usePelvic,type PelvicSample} from '../store';
import {drawPelvicSection,sectionLayout,SECTION_W as W,SECTION_H as H} from '../sectionPaint';
import {outletLabel,outletObservation} from '../sectionProjection';
import {organOutput} from './organOutput';
import {entryLettering} from './entryLettering';
import {readAtlasView,useAtlasSettings} from './view';
import {visibleRim} from '../vulvaForm';
import {exteriorViewport} from './exteriorViewport';

export type AtlasActor={assetId:string;runtimeId:string};
export type ObservationAtlasPart='vulva'|'vagina'|'uterus'|'egg';
export type AtlasScope='pelvic'|'body'|ObservationAtlasPart;

type SocketState=ReturnType<typeof usePelvic.getState>;
export function actorBinding(s:SocketState,assetId:string,runtimeId:string){
  const a=s.active;return a?.assetId===assetId&&a.runtimeId===runtimeId?a:null;
}
export function actorRodSample(s:SocketState,assetId:string,runtimeId:string){
  const a=actorBinding(s,assetId,runtimeId);return a?(a.running?s.sample:s.parkedSample):null;
}

// The focused canal now animates the measured impression, not a periodic
// wave. Stationary sampling still refreshes the store at 10 Hz; it must not
// cause a worker raster or a headset texture upload by itself.
function sameCanalPose(a:PelvicSample,b:PelvicSample,exterior=false){
  if(a.lengthM!==b.lengthM||a.radiusM!==b.radiusM||a.outletInside!==b.outletInside||outletObservation(a)!==outletObservation(b))return false;
  const same=(v:PelvicSample['tip'],w:PelvicSample['tip'])=>Math.abs(v[0]-w[0])<=1e-7&&Math.abs(v[1]-w[1])<=1e-7&&Math.abs(v[2]-w[2])<=1e-7;
  if(!same(a.tip,b.tip))return false;
  const x=a.shaft,y=b.shaft;return !exterior&&!a.outletInside||x===y||!!x&&!!y&&x.length===y.length&&x.every((v,i)=>same(v,y[i]));
}

/** One painter for the DOM surface or one reusable XR canvas texture. Discrete
 * input/sample changes wake it; only the diagram's pulse and camera ease need
 * a clock. The UI never writes a simulation sample, even during an orbit. */
export function atlasPainter(canvas:HTMLCanvasElement,{assetId,runtimeId}:AtlasActor,scope:AtlasScope,wake:()=>void,upload:()=>void,replay?:EggReplay){
  const ctx=canvas.getContext('2d');
  let art:ReturnType<typeof organOutput>|undefined,geometry:ReturnType<typeof sectionLayout>|undefined;
  let view=readAtlasView(assetId),lastL=0,lastR=0,lastYaw=NaN,dirty=true,heading=view.degrees,lastHeading=NaN;
  let lastTime:number|null=null,lastPaint=-Infinity,time=0,dead=false;
  const changed=(invalidate=true)=>{dirty=true;if(invalidate)art?.discard();wake();};
  const viewport=scope==='vulva'?exteriorViewport(canvas,W,H,changed):undefined;
  let lastWidth=canvas.width,lastHeight=canvas.height;
  const lettering=entryLettering(()=>changed(false));
  const observation=scope!=='body'&&scope!=='pelvic';
  const eggLens=scope==='egg',pictureSeconds=scope==='uterus'||eggLens?createPictureClock():undefined;
  const selectedEgg=(s=useConception.getState())=>eggsFor(assetId,s).find(e=>e.id===view.eggId);
  let lastAge=-1,settlingReplay=false;
  const binding=(s:SocketState)=>actorBinding(s,assetId,runtimeId);
  const observed=(s:SocketState)=>actorRodSample(s,assetId,runtimeId);
  const off=[useAtlasSettings.subscribe((s,p)=>{
    if(s.actors[assetId]===p.actors[assetId])return;
    const prev=view;view=readAtlasView(assetId);
    if(scope==='pelvic'&&view.mode!==prev.mode){
      if(prev.mode==='entry')lettering.dispose();
      changed();
    }else if(view.motion!==prev.motion||view.labels!==prev.labels||eggLens&&view.eggId!==prev.eggId||(scope==='vulva'||scope==='pelvic'&&view.mode==='entry')&&view.foldStyle!==prev.foldStyle||!view.motion&&view.degrees!==prev.degrees)changed();
    else if(view.degrees!==prev.degrees)wake(); // a continuous orbit still honours the turn rate limit
  }),
    useLanguageStore.subscribe((s,p)=>{if(s.language!==p.language)changed();})];
  if(eggLens&&replay)off.push(replay.state.subscribe(()=>{if(!settlingReplay)changed();}));
  if(pictureSeconds)off.push(useConception.subscribe((s,p)=>{
    if(eggLens?selectedEgg(s)!==selectedEgg(p):s.byAsset[assetId]?.event!==p.byAsset[assetId]?.event)changed();
  }));
  if(scope!=='body'&&!eggLens)off.push(usePelvic.subscribe((s,p)=>{
    const a=binding(s),b=binding(p);
    const profile=s.byAsset[assetId],old=p.byAsset[assetId];
    if(a?.token!==b?.token||profile!==old&&(scope!=='vulva'||!profile||!old||visibleRim(profile)!==visibleRim(old))){changed();return;}
    if(a){const x=observed(s),y=observed(p);
      const entry=scope==='pelvic'&&view.mode==='entry';
      if((scope==='vagina'||scope==='vulva'||scope==='uterus'||entry)&&x&&y&&a.running===b?.running&&sameCanalPose(x,y,scope!=='vagina')&&
        (scope!=='uterus'||x.depth===y.depth&&x.atCervix===y.atCervix)&&
        (!entry||x.depth===y.depth&&x.angleDeg===y.angleDeg&&x.outletVisible===y.outletVisible))return;
      if(x!==y||a.running!==b?.running)changed(!x||!y||a.running!==b?.running||outletObservation(x)!==outletObservation(y));}
  }));

  function tick(now:number){
    if(!ctx||dead)return false;
    const v=readAtlasView(assetId),mode=scope==='pelvic'?v.mode:'organ';
    const pelvis=usePelvic.getState(),profile=scope==='body'||eggLens?undefined:pelvis.byAsset[assetId];
    if(scope==='pelvic'&&!profile)return false;
    if(scope==='vulva'&&(canvas.width!==lastWidth||canvas.height!==lastHeight)){
      lastWidth=canvas.width;lastHeight=canvas.height;dirty=true;art?.discard();
    }
    art?.flush();
    const egg=eggLens?selectedEgg():undefined,event=scope==='uterus'?useConception.getState().byAsset[assetId]?.event:egg?.event;
    const liveAge=pictureSeconds?.(event,now,v.motion)??PICTURE_END;
    const replayAge=eggLens?replay?.sample(event,now,!art?.inFlight):undefined,age=replayAge??liveAge;
    const moving=replayAge!==undefined?!replay?.state.getState().paused:v.motion;
    // The overview moves with measured contact, not a looping corpus pulse.
    // No new pose/event/rotation means no bitmap request or texture upload.
    const timedEncounter=eggLens||scope==='uterus';
    const anim=mode==='organ'&&scope!=='vagina'&&scope!=='vulva'&&moving&&(!timedEncounter||!!event&&age<PICTURE_END);
    const dt=lastTime===null?0:Math.min(.10,Math.max(0,(now-lastTime)/1000));lastTime=now;
    const remaining=v.degrees-heading;
    heading=!v.motion||Math.abs(remaining)<.15?v.degrees:heading+remaining*(-Math.expm1(-23*dt));
    const turning=heading!==v.degrees;
    if(anim)time+=dt;
    const finalFrame=timedEncounter&&age===PICTURE_END&&lastAge!==age;
    if(art?.inFlight||!dirty&&!finalFrame&&(lastHeading===heading?(!anim||now-lastPaint<80):(turning&&now-lastPaint<32)))return anim||turning;
    const sample=profile?observed(pelvis):null,parked=!!sample&&!binding(pelvis)?.running;
    const zh=useLanguageStore.getState().language==='zh', yaw=heading*Math.PI/180;
    const displayedHeading=heading;
    function publish(alt:string){const angle=`${Math.round(displayedHeading)}°`,name=eggLens?(egg?`${zh?'卵子':'Egg'} ${egg.id}`:zh?'暂无卵子':'No eggs'):scope==='vulva'?(zh?'外阴示意':'Vulva study'):scope==='vagina'?(zh?'阴道剖面':'Vaginal cutaway'):mode==='organ'?(zh?'子宫动态示意':'Uterine study'):mode==='entry'?(zh?'入口对位':'Entry alignment'):(zh?'骨盆测量剖面':'Pelvic measurement'),caption=`${name} · ${angle}${alt?' · '+alt:''}`;
      if(canvas.getAttribute('aria-label')!==caption)canvas.setAttribute('aria-label',caption);
      canvas.dataset.view=observation?scope:mode;canvas.dataset.angle=String(Math.round(displayedHeading));upload();}
    dirty=false;lastHeading=heading;lastPaint=now;lastAge=age;
    if(mode!=='organ'&&profile){
      const l=sample?.lengthM??profile.calibration.lengthM,r=sample?.radiusM??profile.calibration.radiusM;
      if(!geometry||l!==lastL||r!==lastR||yaw!==lastYaw||geometry.entryFocus!==(mode==='entry')){geometry=sectionLayout(l,r,yaw,mode==='entry');lastL=l;lastR=r;lastYaw=yaw;}
      publish(drawPelvicSection(ctx,geometry,profile,sample,zh,parked,mode==='entry'?lettering.get(zh):undefined,v.foldStyle));
    }else{
       const fantasy=profile?.container==='fantasyUterine';
      const volume=profile?.fluid[profile.container]??0,capacity=profile?.capacity[profile.container]??1;
      const state=outletLabel(sample,zh,parked);
      const depth=!parked&&sample?.outletInside?`${(sample.depth*100).toFixed(1)} cm`:'—';
      // A shared normalized art region leaves space for an honest live caption.
      // With body state disabled the neutral illustration is not a measured lining.
      art??=organOutput(result=>{if(result==='retry')dirty=true;wake();});
          art.submit({scale:viewport?.scale??canvas.width/W,options:{x:0,y:0,width:W,height:observation?H:H-32,focus:observation?scope:undefined,exteriorDisplayScale:viewport?.scale,foldStyle:v.foldStyle,rim:visibleRim(profile),yaw,time,lining:tissue.functionalDepth,shedding:0,tissue,labels:v.labels,
           event:scope==='uterus'?event:undefined,egg,encounterSeconds:age,fluid:volume/capacity,fantasy,vaginalFluid:profile?profile.fluid.vaginal/profile.capacity.vaginal:0,
          uterineFluid:profile&&(scope==='uterus'||scope==='pelvic')?profile.fluid.fantasyUterine/profile.capacity.fantasyUterine:undefined,
         pressure:!parked&&sample?.outletInside?Math.min(1,sample.depth/Math.max(.0001,sample.lengthM)):0,sample,parked,zh},paint:draw=>{
        ctx.save();ctx.scale(canvas.width/W,canvas.height/H);ctx.fillStyle='#211722';ctx.fillRect(0,0,W,H);draw(ctx);
        // The observation sheet sets its live readings in native-size type outside the plate.
          if(observation){ctx.restore();const phase=!event?'':age<RESULT_REVEAL_SECONDS?(zh?'精卵相遇':'Encounter'):event.success?(zh?'已受精':'Fertilized'):(zh?'未受精':'Not fertilized');
             publish([sample?state:'',phase].filter(Boolean).join(' · '));
             // Release transport only when the terminal bitmap was displayed.
             // A frozen live frame may differ and still needs restoring.
             if(replayAge===PICTURE_END&&replay){settlingReplay=liveAge===age;replay.stop();settlingReplay=false;}
             return;}
        ctx.font='550 14px system-ui,sans-serif';ctx.fillStyle='#fbe2d8';ctx.textAlign='left';ctx.textBaseline='middle';
         const text=profile?`${state}   ·   ${zh?'深度':'Depth'} ${depth}`:(zh?'子宫结构':'Uterine anatomy');
        ctx.strokeStyle='#674450';ctx.beginPath();ctx.moveTo(9,H-31.5);ctx.lineTo(W-9,H-31.5);ctx.stroke();ctx.fillText(text,10,H-15,profile?W*.60:W-20);
        let right='';if(profile){right=`${fantasy?(zh?'宫腔精液':'Uterine semen'):(zh?'阴道精液':'Vaginal semen')} ${volume} / ${capacity}`;ctx.textAlign='right';ctx.fillStyle=semenColor;ctx.fillText(right,W-10,H-15,W*.38);}
        ctx.restore();publish(`${text}${right?' · '+right:''}`);
      }});
    }
    return anim||turning;
  }
  return {tick, suspend(){replay?.suspend();if(lastTime!==null){lastTime=null;dirty=true;art?.discard();}},
    dispose(){dead=true;off.forEach(f=>f());viewport?.dispose();art?.dispose();lettering.dispose();}};
}
