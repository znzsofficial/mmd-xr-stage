// Import on the existing local Vite screen stage, with a selected enabled
// test actor on Interact → Insertion and its motor stopped. Uses actual tab
// and angle buttons, real drainage, worker submission and the visible canvas.
// No separate renderer. In the release owner's existing Playwright fixture:
//   const sheets=await page.evaluate(async()=>
//     (await import('/scripts/art/retained-fluid-page.mjs')).captureRetainedFluid());
//   // Write sheets[*].png (base64) ONLY under local-review/art/retained-fluid/.
import {useBackpack} from '/src/mmdVrShowcase/backpack/store.ts';
import {drainPelvic,usePelvic} from '/src/mmdVrShowcase/pelvic/store.ts';
import {setAtlasView,useAtlasSettings} from '/src/mmdVrShowcase/pelvic/atlas/view.ts';

const angles=[0,38,90],parts=['vulva','vagina','uterus','egg'];
const panel=()=>document.querySelector('.live-pelvic-view'),partsBar=()=>panel()?.querySelectorAll('.live-pelvic-parts button');
const sleepFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
async function until(read,description){const deadline=performance.now()+12000;do{const value=read();if(value)return value;await sleepFrame();}while(performance.now()<deadline);throw Error(`Timeout: ${description}`);}
const changed=(a,b)=>{let count=0;for(let i=1;i<a.length;i+=4)if(Math.abs(a[i]-b[i])>22)count++;return count;};

export async function captureRetainedFluid(){
  const id=useBackpack.getState().selected,base=usePelvic.getState().byAsset[id],initialTab=panel()?.dataset.part;
  if(!base||!parts.includes(initialTab)||usePelvic.getState().active?.running||document.hidden)throw Error('Open Insertion for a selected, enabled test actor in a visible tab; stop the motor.');
  const initialView=useAtlasSettings.getState().actors[id],result=[];
  function setProfile(p){usePelvic.setState(s=>({byAsset:{...s.byAsset,[id]:p}}));}
  async function tab(name){partsBar()[parts.indexOf(name)].click();await until(()=>panel()?.dataset.part===name,`select ${name}`);}
  async function mounted(part,angle){return until(()=>panel()?.querySelector(`.observation-art[aria-busy="false"] canvas[data-view="${part}"][data-angle="${angle}"]`),`${part} ${angle}° first paint`);}
  function scaled(canvas){const {width,height}=canvas.getBoundingClientRect(),c=document.createElement('canvas');c.width=Math.round(width);c.height=Math.round(height);
    if(!c.width||!c.height)throw Error('The artwork is hidden');const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,c.width,c.height);return {c,pixels:ctx.getImageData(0,0,c.width,c.height).data};}
  async function nextFrame(canvas,before){return until(()=>{const next=scaled(canvas);return changed(before.pixels,next.pixels)>0&&next;},'drain changes the mounted section');}
  try{
    setAtlasView(id,{motion:false,labels:false});
    for(const part of ['vagina','uterus']){
      const key=part==='vagina'?'vaginal':'fantasyUterine',other=key==='vaginal'?'fantasyUterine':'vaginal',capacity={vaginal:8,fantasyUterine:16};
      let sheet;const pixels=[];
      for(const [row,angle] of angles.entries()){
        await tab('vulva');
        const fluid={vaginal:8,fantasyUterine:16,[key]:capacity[key]-1};setProfile({...base,container:other,capacity,fluid});
        await tab(part);panel().querySelectorAll('.live-pelvic-angles button')[row].click();
        const canvas=await mounted(part,angle),full=scaled(canvas);
        // The first shot already shows near full while the dose destination is
        // the OTHER compartment. Observe real drain, then drain the other one.
        setProfile({...usePelvic.getState().byAsset[id],container:key});
        if(!drainPelvic(id,capacity[key]-2))throw Error('First drain rejected');
        const low=await nextFrame(canvas,full);
        if(!drainPelvic(id,1))throw Error('Second drain rejected');const empty=await nextFrame(canvas,low);
        const current=usePelvic.getState().byAsset[id];if(current.fluid[key]!==0||current.fluid[other]!==capacity[other])throw Error('Drain crossed compartments');
        setProfile({...current,container:other});if(!drainPelvic(id,capacity[other]))throw Error('Control drain rejected');
        // Remount so equality cannot pass by comparing an obsolete bitmap.
        await tab('vulva');await tab(part);const isolated=scaled(await mounted(part,angle));
        const small=changed(low.pixels,empty.pixels),near=changed(full.pixels,empty.pixels),cross=changed(isolated.pixels,empty.pixels);
        if(small<4||near<2*small||cross!==0)throw Error(`${part}/${angle}° failed: small=${small} near=${near} cross=${cross}`);
        const {width:w,height:h}=full.c;if(!sheet){sheet=document.createElement('canvas');sheet.width=3*w;sheet.height=3*h;}
        [empty,low,full].forEach(({c},col)=>sheet.getContext('2d').drawImage(c,col*w,row*h));pixels.push({angle,w,h,small,near,cross});
      }
      result.push({part,pixels,png:sheet.toDataURL('image/png').split(',')[1]});
    }
    return result;
  }finally{setProfile(base);useAtlasSettings.setState(s=>{const actors={...s.actors};if(initialView)actors[id]=initialView;else delete actors[id];return {actors};});await tab(initialTab);}
}
