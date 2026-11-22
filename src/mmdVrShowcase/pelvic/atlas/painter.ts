import {useLanguageStore} from '../../../languageStore';
import {useBodyState} from '../../bodyState/store';
import {BODY_DAY_SECONDS,DEFAULT_BODY_PROFILE,sampleBody,type BodyProfile} from '../../bodyState/data';
import {semenColor} from '../../play/semenAppearance';
import {usePelvic} from '../store';
import {drawPelvicSection,sectionLayout,SECTION_W as W,SECTION_H as H} from '../sectionPaint';
import {outletLabel,outletObservation} from '../sectionProjection';
import {organOutput} from './organOutput';
import {entryLettering} from './entryLettering';
import {readAtlasView,useAtlasSettings} from './view';

export type AtlasActor={assetId:string;runtimeId:string};
export type ObservationAtlasPart='vulva'|'vagina'|'uterus';
export type AtlasScope='pelvic'|'body'|ObservationAtlasPart;

type SocketState=ReturnType<typeof usePelvic.getState>;
export function actorBinding(s:SocketState,assetId:string,runtimeId:string){
  const a=s.active;return a?.assetId===assetId&&a.runtimeId===runtimeId?a:null;
}
export function actorRodSample(s:SocketState,assetId:string,runtimeId:string){
  const a=actorBinding(s,assetId,runtimeId);return a?(a.running?s.sample:s.parkedSample):null;
}

// Only inputs to the lining, shedding and cycle-day readout. Breast refill
// also replaces BodyProfile every 250 ms, even on a locked day.
function sameCycle(a:BodyProfile|undefined,b:BodyProfile|undefined){
  return a===b||!!a&&!!b&&a.day===b.day&&a.bleedDays===b.bleedDays&&a.length===b.length&&
    a.ovulation===b.ovulation&&a.peakDays===b.peakDays&&a.lutealDays===b.lutealDays&&a.liningGain===b.liningGain&&a.liningOverride===b.liningOverride;
}

/** One painter for the DOM surface or one reusable XR canvas texture. Discrete
 * input/sample changes wake it; only the diagram's pulse and camera ease need
 * a clock. The UI never writes a simulation sample, even during an orbit. */
export function atlasPainter(canvas:HTMLCanvasElement,{assetId,runtimeId}:AtlasActor,scope:AtlasScope,wake:()=>void,upload:()=>void){
  const ctx=canvas.getContext('2d');
  let art:ReturnType<typeof organOutput>|undefined,geometry:ReturnType<typeof sectionLayout>|undefined;
  let view=readAtlasView(assetId),lastL=0,lastR=0,lastYaw=NaN,dirty=true,heading=view.degrees,lastHeading=NaN;
  let lastTime:number|null=null,lastPaint=-Infinity,time=0,dead=false;
  const changed=(invalidate=true)=>{dirty=true;if(invalidate)art?.discard();wake();};
  const lettering=entryLettering(()=>changed(false));
  function currentBody(s=useBodyState.getState()){
    return s.draft?.assetId===assetId?s.draft.value:s.byAsset[assetId]??(scope==='body'?DEFAULT_BODY_PROFILE:undefined);
  }
  const observation=scope!=='body'&&scope!=='pelvic';
  const binding=(s:SocketState)=>actorBinding(s,assetId,runtimeId);
  const observed=(s:SocketState)=>actorRodSample(s,assetId,runtimeId);
  const off=[useAtlasSettings.subscribe((s,p)=>{
    if(s.actors[assetId]===p.actors[assetId])return;
    const prev=view;view=readAtlasView(assetId);
    if(scope==='pelvic'&&view.mode!==prev.mode){
      if(view.mode!=='organ'){art?.dispose();art=undefined;}
      if(prev.mode==='entry')lettering.dispose();
      changed();
    }else if(view.motion!==prev.motion||view.labels!==prev.labels||!view.motion&&view.degrees!==prev.degrees)changed();
    else if(view.degrees!==prev.degrees)wake(); // a continuous orbit still honours the turn rate limit
  }),
    useLanguageStore.subscribe((s,p)=>{if(s.language!==p.language)changed();}),
    useBodyState.subscribe((s,p)=>{
      if(scope==='vagina'||scope==='vulva'||scope==='pelvic'&&readAtlasView(assetId).mode!=='organ')return;
      const a=currentBody(s),b=currentBody(p);
      if(!sameCycle(a,b))changed();
      else if(a&&b&&a.daySeconds!==b.daySeconds){
        // Continuous clock samples may lag one raster, but never publish a
        // different displayed tenth of a day after a scrub or rollover.
        changed(Math.round(a.daySeconds*10/BODY_DAY_SECONDS)!==Math.round(b.daySeconds*10/BODY_DAY_SECONDS));
      }
    })];
  if(scope!=='body')off.push(usePelvic.subscribe((s,p)=>{
    const a=binding(s),b=binding(p);
    if(s.byAsset[assetId]!==p.byAsset[assetId]||a?.token!==b?.token){changed();return;}
    if(a){const x=observed(s),y=observed(p);
      if(x!==y||a.running!==b?.running)changed(!x||!y||a.running!==b?.running||outletObservation(x)!==outletObservation(y));}
  }));

  function tick(now:number){
    if(!ctx||dead)return false;
    const v=readAtlasView(assetId),mode=scope==='pelvic'?v.mode:'organ';
    const body=currentBody(),pelvis=usePelvic.getState(),profile=scope==='body'?undefined:pelvis.byAsset[assetId];
    if(scope==='pelvic'&&!profile)return false;
    art?.flush();
    const anim=mode==='organ'&&v.motion,dt=lastTime===null?0:Math.min(.10,Math.max(0,(now-lastTime)/1000));lastTime=now;
    const remaining=v.degrees-heading;
    heading=!v.motion||Math.abs(remaining)<.15?v.degrees:heading+remaining*(-Math.expm1(-23*dt));
    const turning=heading!==v.degrees;
    if(anim)time+=dt;
    if(art?.inFlight||!dirty&&(lastHeading===heading?(!anim||now-lastPaint<80):(turning&&now-lastPaint<32)))return anim||turning;
    const sample=profile?observed(pelvis):null,parked=!!sample&&!binding(pelvis)?.running;
    const zh=useLanguageStore.getState().language==='zh', yaw=heading*Math.PI/180;
    const displayedHeading=heading;
    function publish(alt:string){const angle=`${Math.round(displayedHeading)}°`,name=scope==='vulva'?(zh?'外阴示意':'Vulva study'):scope==='vagina'?(zh?'阴道剖面':'Vaginal cutaway'):mode==='organ'?(zh?'子宫动态示意':'Uterine study'):mode==='entry'?(zh?'入口对位':'Entry alignment'):(zh?'骨盆测量剖面':'Pelvic measurement'),caption=`${name} · ${angle}${alt?' · '+alt:''}`;
      if(canvas.getAttribute('aria-label')!==caption)canvas.setAttribute('aria-label',caption);
      canvas.dataset.view=observation?scope:mode;canvas.dataset.angle=String(Math.round(displayedHeading));upload();}
    if(mode!=='organ'&&profile){
      const l=sample?.lengthM??profile.calibration.lengthM,r=sample?.radiusM??profile.calibration.radiusM;
      if(!geometry||l!==lastL||r!==lastR||yaw!==lastYaw||geometry.entryFocus!==(mode==='entry')){geometry=sectionLayout(l,r,yaw,mode==='entry');lastL=l;lastR=r;lastYaw=yaw;}
      publish(drawPelvicSection(ctx,geometry,profile,sample,zh,parked,mode==='entry'?lettering.get(zh):undefined));
    }else{
      const daily=body?sampleBody(body):null,fantasy=profile?.container==='fantasyUterine';
      const volume=profile?.fluid[profile.container]??0,capacity=profile?.capacity[profile.container]??1;
      const state=outletLabel(sample,zh,parked);
      const depth=!parked&&sample?.outletInside?`${(sample.depth*100).toFixed(1)} cm`:'—';
      // A shared normalized art region leaves space for an honest live caption.
      // With body state disabled the neutral illustration is not a measured lining.
      art??=organOutput(result=>{if(result==='retry')dirty=true;wake();});
       art.submit({scale:canvas.width/W,options:{x:0,y:0,width:W,height:observation?H:H-32,focus:observation?scope:undefined,yaw,time,lining:daily?.lining??.44,shedding:daily?.shedding??0,tissue:daily?.tissue,labels:v.labels,
         fluid:volume/capacity,fantasy,vaginalFluid:profile?profile.fluid.vaginal/profile.capacity.vaginal:0,
         uterineFluid:scope==='uterus'&&profile?profile.fluid.fantasyUterine/profile.capacity.fantasyUterine:undefined,
         pressure:!parked&&sample?.outletInside?Math.min(1,sample.depth/Math.max(.0001,sample.lengthM)):0,sample,parked,zh},paint:draw=>{
        ctx.save();ctx.scale(canvas.width/W,canvas.height/H);ctx.fillStyle='#211722';ctx.fillRect(0,0,W,H);draw(ctx);
        // The observation sheet sets its live readings in native-size type outside the plate.
        if(observation){ctx.restore();publish(sample?state:'');return;}
        ctx.font='550 14px system-ui,sans-serif';ctx.fillStyle='#fbe2d8';ctx.textAlign='left';ctx.textBaseline='middle';
        const text=profile?`${state}   ·   ${zh?'深度':'Depth'} ${depth}`:body?`${zh?'周期第 ':'Cycle day '}${+(body.day+body.daySeconds/BODY_DAY_SECONDS).toFixed(1)}${zh?' 天':''}   ·   ${zh?'内膜':'Lining'} ${Math.round(100*(daily?.lining??0))}%`:state;
        ctx.strokeStyle='#674450';ctx.beginPath();ctx.moveTo(9,H-31.5);ctx.lineTo(W-9,H-31.5);ctx.stroke();ctx.fillText(text,10,H-15,profile?W*.60:W-20);
        let right='';if(profile){right=`${fantasy?(zh?'宫腔精液':'Uterine semen'):(zh?'阴道精液':'Vaginal semen')} ${volume} / ${capacity}`;ctx.textAlign='right';ctx.fillStyle=semenColor;ctx.fillText(right,W-10,H-15,W*.38);}
        ctx.restore();publish(`${text}${right?' · '+right:''}`);
      }});
    }
    dirty=false;lastHeading=heading;lastPaint=now;
    return anim||turning;
  }
  return {tick, suspend(){if(lastTime!==null){lastTime=null;dirty=true;art?.discard();}},
    dispose(){dead=true;off.forEach(f=>f());art?.dispose();lettering.dispose();}};
}
