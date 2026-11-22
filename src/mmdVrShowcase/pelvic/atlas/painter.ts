import {useLanguageStore} from '../../../languageStore';
import {useBodyState} from '../../bodyState/store';
import {BODY_DAY_SECONDS,sampleBody} from '../../bodyState/data';
import {usePelvic} from '../store';
import {drawPelvicSection,sectionLayout,SECTION_W as W,SECTION_H as H} from '../sectionPaint';
import {organOutput} from './organOutput';
import {readAtlasView,useAtlasSettings} from './view';

export type AtlasActor={assetId:string;runtimeId:string};
export type AtlasScope='pelvic'|'body';

/** One painter for the DOM surface or one reusable XR canvas texture. Discrete
 * input/sample changes wake it; only the diagram's pulse and camera ease need
 * a clock. The UI never writes a simulation sample, even during an orbit. */
export function atlasPainter(canvas:HTMLCanvasElement,{assetId,runtimeId}:AtlasActor,scope:AtlasScope,wake:()=>void,upload:()=>void){
  const ctx=canvas.getContext('2d');
  let art:ReturnType<typeof organOutput>|undefined,geometry:ReturnType<typeof sectionLayout>|undefined;
  let lastL=0,lastR=0,lastYaw=NaN,dirty=true,heading=readAtlasView(assetId).degrees,lastHeading=NaN;
  let lastTime:number|null=null,lastPaint=-Infinity,time=0;
  const changed=()=>{dirty=true;wake();};
  function currentBody(){const s=useBodyState.getState();return s.draft?.assetId===assetId?s.draft.value:s.byAsset[assetId];}
  const off=[useAtlasSettings.subscribe((s,p)=>{if(s.actors[assetId]!==p.actors[assetId])changed();}),
    useLanguageStore.subscribe((s,p)=>{if(s.language!==p.language)changed();}),
    useBodyState.subscribe((s,p)=>{if(s.byAsset[assetId]!==p.byAsset[assetId]||s.draft!==p.draft&&(s.draft?.assetId===assetId||p.draft?.assetId===assetId))changed();})];
  if(scope==='pelvic')off.push(usePelvic.subscribe((s,p)=>{if(s.byAsset[assetId]!==p.byAsset[assetId]||
    (s.active?.runtimeId===runtimeId||p.active?.runtimeId===runtimeId)&&(s.sample!==p.sample||s.active?.token!==p.active?.token))changed();}));

  function tick(now:number){
    if(!ctx)return false;
    const v=readAtlasView(assetId),mode=scope==='body'?'organ':v.mode;
    const body=currentBody(),pelvis=usePelvic.getState(),profile=scope==='pelvic'?pelvis.byAsset[assetId]:undefined;
    if(scope==='pelvic'?!profile:!body)return false;
    const anim=mode==='organ'&&v.motion,dt=lastTime===null?0:Math.min(.10,Math.max(0,(now-lastTime)/1000));lastTime=now;
    const remaining=v.degrees-heading;
    heading=!v.motion||Math.abs(remaining)<.15?v.degrees:heading+remaining*(-Math.expm1(-23*dt));
    const turning=heading!==v.degrees;
    if(anim)time+=dt;
    if(!dirty&&(lastHeading===heading?(!anim||now-lastPaint<80):(turning&&now-lastPaint<32)))return anim||turning;
    const sample=profile&&pelvis.active?.assetId===assetId&&pelvis.active.runtimeId===runtimeId?pelvis.sample:null;
    const zh=useLanguageStore.getState().language==='zh', yaw=heading*Math.PI/180;
    const displayedHeading=heading;
    function publish(alt:string){const angle=`${Math.round(displayedHeading)}°`,caption=`${mode==='organ'?(zh?'子宫动态示意':'Uterus in motion'):(zh?'骨盆测量剖面':'Pelvic measurement')} · ${angle} · ${alt}`;
      if(canvas.getAttribute('aria-label')!==caption)canvas.setAttribute('aria-label',caption);
      canvas.dataset.view=mode;canvas.dataset.angle=String(Math.round(displayedHeading));upload();}
    if(mode==='measure'&&profile){
      const l=sample?.lengthM??profile.calibration.lengthM,r=sample?.radiusM??profile.calibration.radiusM;
      if(!geometry||l!==lastL||r!==lastR||yaw!==lastYaw){geometry=sectionLayout(l,r,yaw);lastL=l;lastR=r;lastYaw=yaw;}
      publish(drawPelvicSection(ctx,geometry,profile,sample,zh));
    }else{
      const daily=body?sampleBody(body):null,fantasy=profile?.container==='fantasyUterine';
      const volume=profile?.fluid[profile.container]??0,capacity=profile?.capacity[profile.container]??1;
      const state=!sample?(zh?'结构示意':'Anatomy'):sample.outletInside?(zh?'喷口在内':'Outlet inside'):sample.outletVisible?(zh?'喷口在外':'Outlet outside'):
        sample.atCervix?(zh?'越限 · 不释放':'Past stop · no dose'):(zh?'未确认 · 不释放':'Unverified · no dose');
      const depth=sample?`${(sample.depth*100).toFixed(1)} cm`:'—';
      // A shared normalized art region leaves space for an honest live caption.
      // With body state disabled the neutral illustration is not a measured lining.
      art??=organOutput();
      art.submit({scale:canvas.width/W,options:{x:0,y:0,width:W,height:H-32,yaw,time,lining:daily?.lining??.44,shedding:daily?.shedding??0,
        fluid:volume/capacity,fantasy,vaginalFluid:profile?profile.fluid.vaginal/profile.capacity.vaginal:0,
        pressure:sample?.outletInside?Math.min(1,sample.depth/Math.max(.0001,sample.lengthM)):0,sample,zh},paint:draw=>{
        // Never let an older asynchronous picture replace a new mode, a stop,
        // or a change in which side of the opening this sample was on.
        const current=usePelvic.getState(),newView=readAtlasView(assetId);
        if((scope==='pelvic'&&newView.mode!==mode)||newView.motion!==v.motion||currentBody()!==body||
          (profile&&(current.byAsset[assetId]!==profile||current.active?.token!==pelvis.active?.token||
            current.sample?.outletInside!==pelvis.sample?.outletInside||current.sample?.outletVisible!==pelvis.sample?.outletVisible)))return;
        ctx.save();ctx.scale(canvas.width/W,canvas.height/H);ctx.fillStyle='#211722';ctx.fillRect(0,0,W,H);draw(ctx);
        ctx.font='550 14px system-ui,sans-serif';ctx.fillStyle='#fbe2d8';ctx.textAlign='left';ctx.textBaseline='middle';
        const text=profile?`${state}   ·   ${zh?'深度':'Depth'} ${depth}`:body?`${zh?'周期第 ':'Cycle day '}${+(body.day+body.daySeconds/BODY_DAY_SECONDS).toFixed(1)}${zh?' 天':''}   ·   ${zh?'内膜':'Lining'} ${Math.round(100*(daily?.lining??0))}%`:state;
        ctx.strokeStyle='#674450';ctx.beginPath();ctx.moveTo(9,H-31.5);ctx.lineTo(W-9,H-31.5);ctx.stroke();ctx.fillText(text,10,H-15,profile?W*.60:W-20);
        let right='';if(profile){right=`${fantasy?(zh?'虚构宫腔':'Fantasy'):(zh?'阴道':'Vaginal')} ${volume} / ${capacity}`;ctx.textAlign='right';ctx.fillStyle='#a0e0d0';ctx.fillText(right,W-10,H-15,W*.36);}
        ctx.restore();publish(`${text}${right?' · '+right:''}`);
      }});
    }
    dirty=false;lastHeading=heading;lastPaint=now;
    return anim||turning;
  }
  return {tick, suspend(){lastTime=null;}, dispose(){off.forEach(f=>f());art?.dispose?.();}};
}
