// Node 26. Optional argument: path to an existing @napi-rs/canvas install.
// Exercises the shipped CPU illustrator, without opening WebGL or importing PMX.
import {createRequire,registerHooks} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const src=new URL('../../src/',import.meta.url),out=new URL('../../local-review/art/observation-reference/',import.meta.url);
registerHooks({resolve(id,c,next){if(c.parentURL?.startsWith(src.href)&&id.startsWith('.')&&!id.endsWith('.ts'))id+='.ts';return next(id,c);}});
const {createCanvas}=createRequire(import.meta.url)(process.argv[2]??'@napi-rs/canvas');
globalThis.OffscreenCanvas=class {constructor(w,h){return createCanvas(w,h);}};
const {createReferenceArt}=await import(new URL('mmdVrShowcase/observation/reference/art.ts',src));
const art=createReferenceArt(),w=400,h=260,tile=createCanvas(w,h),ctx=tile.getContext('2d');
const rows=[['uterus',false],['breast',false],['breast',true]],sheet=createCanvas(w*3,(h+26)*rows.length),c=sheet.getContext('2d');
c.fillStyle='#211722';c.fillRect(0,0,sheet.width,sheet.height);
try{for(const [row,[part,section]] of rows.entries()){
  for(const [col,degrees] of [0,38,90].entries()){
    art.draw(ctx,{width:w,height:h,degrees,part,section,labels:false,zh:false});c.drawImage(tile,col*w,row*(h+26));
    c.fillStyle='#f4d5bb';c.font='16px sans-serif';c.fillText(`${part}${section?' section':''} reference / ${degrees}°`,col*w+12,row*(h+26)+h+18);
  }
}await mkdir(out,{recursive:true});await writeFile(new URL('three-angles.png',out),sheet.toBuffer('image/png'));}finally{art.dispose();}
