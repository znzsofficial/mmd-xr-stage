import {useLanguageStore} from '../../../languageStore';
import type {DiagramActor,DiagramDriver} from '../../components/ActorDiagram';
import {diagramOutput} from '../../components/diagramOutput';
import {DEFAULT_BODY_PROFILE} from '../data';
import {fromMilkRefill,fromMilkInteraction,useBodyState} from '../store';
import {createBreastArt,type BreastArtFrame} from './art';
import {areolaNames} from './art/areola';
import {MILK_FULLNESS_GAIN} from './art/teardrop';
import {breastViews,readBreastView,resolveBreastView} from './view';
import {lowerPoleLag} from './settling';

export const BREAST_WIDTH=400,BREAST_HEIGHT=260;
type State=ReturnType<typeof useBodyState.getState>;
const profile=(s:State,id:string)=>s.draft?.assetId===id?s.draft.value:s.byAsset[id]??DEFAULT_BODY_PROFILE;
function parameters(s:State,id:string){
  const p=profile(s,id);
  return {fullness:p.fullness,lactating:p.lactating,left:p.lactating?p.left:0,right:p.lactating?p.right:0};
}
const same=(a:ReturnType<typeof parameters>,b:ReturnType<typeof parameters>)=>a.fullness===b.fullness&&a.lactating===b.lactating&&a.left===b.left&&a.right===b.right;

export function breastPainter(canvas:HTMLCanvasElement,{assetId}:DiagramActor,wake:()=>void,upload:()=>void):DiagramDriver{
  const ctx=canvas.getContext('2d');let dirty=true,dead=false,time=0,last:number|null=null,painted=-Infinity;
  const lag=lowerPoleLag(),leftLag=lowerPoleLag(),rightLag=lowerPoleLag();
  const reset=()=>{lag.reset();leftLag.reset();rightLag.reset();};
  const output=diagramOutput<BreastArtFrame>(()=>new Worker(new URL('./breast.worker.ts',import.meta.url),{type:'module'}),createBreastArt,
    reason=>{if(reason==='retry')dirty=true;wake();});
  let sample=parameters(useBodyState.getState(),assetId);
  function changed(discard=true){dirty=true;if(discard)output.discard();wake();}
  const off=[breastViews.subscribe((s,p)=>{const a=resolveBreastView(s,assetId),b=resolveBreastView(p,assetId);if(a!==b){
    const transport=a.motion!==b.motion;if(transport)last=null;
    if(a.section!==b.section)reset();
    // During a continuous orbit, show completed angles in order. Dropping a
    // bitmap on every pointermove can keep the figure blank for a whole drag.
    changed(transport||a.section!==b.section||a.labels!==b.labels||a.areolaStyle!==b.areolaStyle);
  }}),
    useLanguageStore.subscribe((s,p)=>{if(s.language!==p.language)changed();}),
    useBodyState.subscribe((s,p)=>{
      if(profile(s,assetId)===profile(p,assetId)&&(s.draft?.assetId===assetId)===(p.draft?.assetId===assetId))return;
      const value=profile(s,assetId),next=parameters(s,assetId),draft=s.draft?.assetId===assetId,sameOwner=draft===(p.draft?.assetId===assetId);
      if(!same(next,sample)||!sameOwner){
        const scrubbing=draft&&sameOwner&&value.fullness!==profile(p,assetId).fullness&&next.lactating===sample.lactating;
        const view=readBreastView(assetId);
        const debit=sameOwner&&sample.lactating&&next.lactating&&(draft||fromMilkInteraction(value))&&
          !fromMilkRefill(value)&&(next.left<sample.left||next.right<sample.right);
        if(!sameOwner||!view.motion||view.section||next.lactating!==sample.lactating)reset();
        else if(scrubbing)lag.adjust(next.fullness-sample.fullness);
         else if(debit){leftLag.adjust(MILK_FULLNESS_GAIN*Math.min(0,next.left-sample.left));rightLag.adjust(MILK_FULLNESS_GAIN*Math.min(0,next.right-sample.right));}
         else if(!fromMilkRefill(value))reset();
         sample=next;changed(!sameOwner||!(scrubbing||fromMilkRefill(value)||fromMilkInteraction(value)));
      }
    })];
  return {tick(now){
    if(!ctx||dead)return false;
    output.flush();const v=readBreastView(assetId),dt=last===null?0:Math.min(.10,Math.max(0,(now-last)/1000));last=now;
    if(v.motion){time+=dt;lag.step(dt);leftLag.step(dt);rightLag.step(dt);}
    if(output.inFlight)return false; // Reply wakes the painter; no idle DOM RAF while the worker is busy.
    if(!dirty&&(!v.motion||now-painted<(lag.value||leftLag.value||rightLag.value?42:100))||dirty&&now-painted<32)return v.motion||dirty;
    const zh=useLanguageStore.getState().language==='zh',options:BreastArtFrame&{settle:number}={width:BREAST_WIDTH,height:BREAST_HEIGHT,degrees:v.degrees,
      section:v.section,labels:v.section&&v.labels,areolaStyle:v.areolaStyle,settle:lag.value,leftSettle:leftLag.value,rightSettle:rightLag.value,time,zh,...sample};
    const scale=canvas.width/BREAST_WIDTH;
    output.submit({options,scale,paint:draw=>{
      ctx.save();ctx.scale(scale,scale);try{draw(ctx);}finally{ctx.restore();}
      const view=options.section?(zh?'乳房剖面':'Breast cutaway'):(zh?'乳房外观':'Breast appearance');
      const state=`${view} · ${zh?'饱满度':'Fullness'} ${Math.round(options.fullness*100)}%`;
       const style=v.areolaStyle;
        const stock=options.lactating?` · ${zh?'乳量（左／右）':'Milk (L/R)'} ${Math.round(options.left*100)}% / ${Math.round(options.right*100)}%`:'';
        canvas.setAttribute('aria-label',`${state} · ${options.degrees}°${options.section?'':` · ${areolaNames[zh?'zh':'en'][style]}`}${stock}`);
       canvas.dataset.view='breast';canvas.dataset.angle=String(options.degrees);canvas.dataset.areolaStyle=style;upload();
    }});painted=now;dirty=false;return v.motion;
  },suspend(){if(last!==null){last=null;reset();dirty=true;painted=-Infinity;output.discard();}},dispose(){dead=true;off.forEach(f=>f());output.dispose();}};
}
