// CPU-only, Node 26. Capture --before on the old brush, then run without the
// flag after editing. All comparison tiles use the same yaw, no measurements.
import {createRequire,registerHooks} from 'node:module';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const src=new URL('../../src/',import.meta.url),dir=new URL('../../local-review/art/observation-reference/maternal/',import.meta.url);
registerHooks({resolve(id,c,next){if(c.parentURL?.startsWith(src.href)&&id.startsWith('.')&&!id.endsWith('.ts'))id+='.ts';return next(id,c);}});
const {createCanvas,loadImage}=createRequire(import.meta.url)(process.argv.slice(2).find(x=>!x.startsWith('--'))??'@napi-rs/canvas');
globalThis.OffscreenCanvas=class {constructor(w,h){return createCanvas(w,h);}};
const {createReferenceArt}=await import(new URL('mmdVrShowcase/observation/reference/art.ts',src));
const {createOrganArt}=await import(new URL('mmdVrShowcase/pelvic/atlas/organArt.ts',src));
const {REFERENCE_TISSUE:tissue}=await import(new URL('mmdVrShowcase/bodyState/data.ts',src));
const before=process.argv.includes('--before'),angles=[0,38,90],ref=createReferenceArt(),daily=createOrganArt(),parts=['vulva','vagina','uterus'];
await mkdir(dir,{recursive:true});
const path=(part,degrees,kind)=>new URL(`${part}-${degrees}-${kind}.png`,dir);
async function plate(part,degrees,kind){
  // The former tract reference main picture was exactly the everyday brush.
  const atlas=kind==='daily'||kind==='before'&&part!=='uterus';
  const w=kind==='before'&&!atlas?400:344,h=w===400?260:282,tile=createCanvas(w,h),ctx=tile.getContext('2d');
  if(atlas)daily.draw(ctx,{x:0,y:0,width:w,height:h,focus:part,yaw:degrees*Math.PI/180,time:0,sample:null,lining:tissue.functionalDepth,tissue,shedding:0,pressure:0,fluid:0,fantasy:false,zh:false});
  else ref.draw(ctx,{width:w,height:h,degrees,part,section:false,labels:false,zh:false});
  await writeFile(path(part,degrees,kind),tile.toBuffer('image/png'));
}
try{
  for(const part of parts)for(const degrees of angles)for(const kind of before?['before']:['daily','reference'])await plate(part,degrees,kind);
  if(!before)for(const part of parts){
    const old=await access(path(part,0,'before')).then(()=>true,()=>false),kinds=old?['before','daily','reference']:['daily','reference'];
    for(const w of [156,344]){
      const h=Math.round(w*282/344),sheet=createCanvas(w*3,(h+21)*kinds.length),c=sheet.getContext('2d');c.fillStyle='#211722';c.fillRect(0,0,sheet.width,sheet.height);
      for(const [r,kind] of kinds.entries())for(const [col,a] of angles.entries()){
        const image=await loadImage(fileURLToPath(path(part,a,kind))),k=Math.min(w/image.width,h/image.height),x=col*w,y=r*(h+21);
        c.drawImage(image,x+(w-image.width*k)/2,y+(h-image.height*k)/2,image.width*k,image.height*k);
        c.fillStyle='#f1daca';c.font='13px sans-serif';c.fillText(`${kind}  ${a}°`,x+7,y+h+14);
      }
      await writeFile(new URL(`${part}-${w}-comparison.png`,dir),sheet.toBuffer('image/png'));
    }
  }
  if(!before){ // Retain the existing breast exterior/cutaway review sheet.
    const w=400,h=260,tile=createCanvas(w,h),sheet=createCanvas(3*w,3*(h+26)),c=sheet.getContext('2d');
    c.fillStyle='#211722';c.fillRect(0,0,sheet.width,sheet.height);
    for(const [r,[part,section]] of [['uterus',false],['breast',false],['breast',true]].entries())for(const [col,degrees] of angles.entries()){
      ref.draw(tile.getContext('2d'),{part,degrees,section,width:w,height:h,labels:false,zh:false});c.drawImage(tile,col*w,r*(h+26));
      c.fillStyle='#f1daca';c.font='16px sans-serif';c.fillText(`${part}${section?' section':''} reference / ${degrees}°`,col*w+12,r*(h+26)+h+18);
    }
    await writeFile(new URL('../three-angles.png',dir),sheet.toBuffer('image/png'));
  }
  console.log(fileURLToPath(dir));
}finally{ref.dispose();daily.dispose();}
