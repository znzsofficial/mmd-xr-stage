import {useLanguageStore} from '../../../languageStore';
import {createStore} from 'zustand/vanilla';
import {breastViews,readBreastView,setBreastView} from '../../bodyState/breast/view';
import type {DiagramSpec} from '../ActorDiagram';
import {diagramOutput} from '../diagramOutput';
import {readAtlasView,setAtlasView,useAtlasSettings} from '../../pelvic/atlas/view';
import {createReferenceArt,type ReferenceFrame,type ReferencePart} from './art';

const sheetSettings=()=>createStore(()=>({section:false,breastLabels:false,uterusLabels:false}));
function spec(part:ReferencePart,settings:ReturnType<typeof sheetSettings>):DiagramSpec{
  const breast=part==='breast',id=`reference-${part}`,angle=(a:string)=>(breast?readBreastView(a):readAtlasView(a)).degrees;
  const width=breast?400:344,height=breast?260:282;
  return {id,meshName:`observation:${id}`,classes:'reference-artboard',width,height,angle,
    turn:(a,degrees)=>(breast?setBreastView:setAtlasView)(a,{degrees}),open(canvas,{assetId},wake,upload){
      const ctx=canvas.getContext('2d');let dirty=true,live=true;
      const output=diagramOutput<ReferenceFrame>(()=>new Worker(new URL('./reference.worker.ts',import.meta.url),{type:'module'}),createReferenceArt,
        reason=>{if(reason==='retry')dirty=true;wake();});
      function frame():ReferenceFrame{
        const v=settings.getState(),section=breast&&v.section;
        return {part,width,height,degrees:angle(assetId),section,labels:breast?section&&v.breastLabels:part==='uterus'&&v.uterusLabels,zh:useLanguageStore.getState().language==='zh'};
      }
      let next=frame();
      function changed(){const f=frame();if(f.degrees===next.degrees&&f.section===next.section&&f.labels===next.labels&&f.zh===next.zh)return;
        if(f.section!==next.section||f.labels!==next.labels||f.zh!==next.zh)output.discard();next=f;dirty=true;wake();}
      const off=[settings.subscribe(changed),(breast?breastViews:useAtlasSettings).subscribe(changed),useLanguageStore.subscribe(changed)];
      return {tick(){if(!live||!ctx)return false;output.flush();if(!dirty||output.inFlight)return false;
        const f=next,scale=canvas.width/f.width;dirty=false;
        output.submit({options:f,scale,paint:draw=>{ctx.save();ctx.scale(scale,scale);try{draw(ctx);}finally{ctx.restore();}
          const name=breast?(f.section?(f.zh?'乳房剖面':'Breast section'):(f.zh?'乳房外观':'Breast exterior')):
            part==='vulva'?(f.zh?'外阴静息外观':'Resting vulva'):part==='vagina'?(f.zh?'阴道壁剖面':'Vaginal wall section'):(f.zh?'子宫剖面':'Uterine section');
          canvas.setAttribute('aria-label',`${f.zh?'孕态参考':'Pregnancy reference'} · ${name} · ${f.degrees}°`);
          canvas.dataset.view=id;canvas.dataset.angle=String(f.degrees);canvas.dataset.section=String(f.section);canvas.dataset.labels=String(f.labels);upload();}});return false;
      },suspend(){output.discard();dirty=true;},dispose(){live=false;off.forEach(f=>f());output.dispose();}};
    }};
}
/** Section and lettering belong to this open reference book, not to the
 * actor's normal breast art or the atlas shared by the insertion monitor. */
export function createReferenceBook(){const settings=sheetSettings();return {settings,breast:spec('breast',settings),uterus:spec('uterus',settings),vulva:spec('vulva',settings),vagina:spec('vagina',settings)};}
