import {useLanguageStore} from '../../../languageStore';
import {createStore} from 'zustand/vanilla';
import {breastViews,readBreastView,setBreastView} from '../../bodyState/breast/view';
import type {DiagramSpec} from '../../components/ActorDiagram';
import {diagramOutput} from '../../components/diagramOutput';
import {readAtlasView,setAtlasView,useAtlasSettings} from '../../pelvic/atlas/view';
import {createReferenceArt,type ReferenceFrame} from './art';

const sheetSettings=()=>createStore(()=>({section:false,breastLabels:false,uterusLabels:false}));
function spec(part:'breast'|'uterus',settings:ReturnType<typeof sheetSettings>):DiagramSpec{
  const breast=part==='breast',id=`reference-${part}`,angle=(a:string)=>(breast?readBreastView(a):readAtlasView(a)).degrees;
  return {id,meshName:`observation:${id}`,classes:'reference-artboard',width:400,height:260,angle,
    turn:(a,degrees)=>(breast?setBreastView:setAtlasView)(a,{degrees}),open(canvas,{assetId},wake,upload){
      const ctx=canvas.getContext('2d');let dirty=true,live=true;
      const output=diagramOutput<ReferenceFrame>(()=>new Worker(new URL('./reference.worker.ts',import.meta.url),{type:'module'}),createReferenceArt,
        reason=>{if(reason==='retry')dirty=true;wake();});
      function frame():ReferenceFrame{
        const v=settings.getState(),section=breast&&v.section;
        return {part,width:400,height:260,degrees:angle(assetId),section,labels:breast?section&&v.breastLabels:v.uterusLabels,zh:useLanguageStore.getState().language==='zh'};
      }
      let next=frame();
      function changed(){const f=frame();if(f.degrees===next.degrees&&f.section===next.section&&f.labels===next.labels&&f.zh===next.zh)return;
        if(f.section!==next.section||f.labels!==next.labels||f.zh!==next.zh)output.discard();next=f;dirty=true;wake();}
      const off=[settings.subscribe(changed),(breast?breastViews:useAtlasSettings).subscribe(changed),useLanguageStore.subscribe(changed)];
      return {tick(){if(!live||!ctx)return false;output.flush();if(!dirty||output.inFlight)return false;
        const f=next,scale=canvas.width/f.width;dirty=false;
        output.submit({options:f,scale,paint:draw=>{ctx.save();ctx.scale(scale,scale);try{draw(ctx);}finally{ctx.restore();}
          const name=breast?(f.section?(f.zh?'乳房剖面':'Breast section'):(f.zh?'乳房外观':'Breast exterior')):(f.zh?'子宫与胎体':'Uterus and fetus');
          canvas.setAttribute('aria-label',`${f.zh?'孕态参考':'Pregnancy reference'} · ${name} · ${f.degrees}°`);
          canvas.dataset.view=id;canvas.dataset.angle=String(f.degrees);canvas.dataset.section=String(f.section);upload();}});return false;
      },suspend(){output.discard();dirty=true;},dispose(){live=false;off.forEach(f=>f());output.dispose();}};
    }};
}
/** Section and lettering belong to this open reference book, not to the
 * actor's normal breast art or the atlas shared by the insertion monitor. */
export function createReferenceBook(){const settings=sheetSettings();return {settings,breast:spec('breast',settings),uterus:spec('uterus',settings)};}
