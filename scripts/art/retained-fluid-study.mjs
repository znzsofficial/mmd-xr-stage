// Node 26, production worker's CPU brush, no browser or WebGL. Optional first
// argument: local @napi-rs/canvas installation. All figures and metrics stay
// under ignored local-review/. Keep the three columns unlabeled for blind review.
import {createRequire,registerHooks} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const src=new URL('../../src/',import.meta.url),out=new URL('../../local-review/art/retained-fluid/',import.meta.url);
registerHooks({resolve(id,c,next){if(c.parentURL?.startsWith(src.href)&&id.startsWith('.')&&!id.endsWith('.ts'))id+='.ts';return next(id,c);}});
const args=process.argv.slice(2),{createCanvas}=createRequire(import.meta.url)(args.find(s=>!s.startsWith('--'))??'@napi-rs/canvas');
globalThis.OffscreenCanvas=class {constructor(w,h){return createCanvas(w,h);}};
const {createOrganArt}=await import(new URL('mmdVrShowcase/pelvic/atlas/organArt.ts',src));
const {REFERENCE_TISSUE:tissue}=await import(new URL('mmdVrShowcase/bodyState/data.ts',src));
const w=344,h=282,brush=createOrganArt(),metrics=[];
function draw(part,angle,fraction){const c=createCanvas(w*2,h*2),ctx=c.getContext('2d');ctx.scale(2,2);
  brush.draw(ctx,{x:0,y:0,width:w,height:h,focus:part,yaw:angle*Math.PI/180,time:0,lining:tissue.functionalDepth,tissue,shedding:0,pressure:0,zh:false,
    vaginalFluid:part==='vagina'?fraction:0,uterineFluid:part==='uterus'?fraction:0});return c;}
await mkdir(out,{recursive:true});
for(const part of ['vagina','uterus']){
  const capacity=args.includes('--trace')?100:part==='vagina'?8:16;
  const amounts=[0,1/capacity,1-1/capacity],angles=args.includes('--reverse')?[0,-38,-90]:[0,38,90],images=angles.map(a=>amounts.map(f=>draw(part,a,f)));
  for(const width of [344,156]){
    const height=Math.round(width*h/w),c=createCanvas(width*3,height*3),ctx=c.getContext('2d');
    for(const [j,row] of images.entries()){
      let empty;
      for(const [k,img] of row.entries()){
        ctx.drawImage(img,k*width,j*height,width,height);const pixels=ctx.getImageData(k*width,j*height,width,height).data;
        if(!k){empty=pixels;continue;}
        let changed=0,white=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i+1]-empty[i+1]>22)changed++;if(pixels[i+1]-empty[i+1]>50)white++;}
        metrics.push({part,angle:angles[j],width,fraction:amounts[k],changed,white});
      }
    }
    await writeFile(new URL(`${part}-${width}${args.includes('--reverse')?'-reverse':''}${args.includes('--trace')?'-trace':''}.png`,out),c.toBuffer('image/png'));
  }
}
brush.dispose();await writeFile(new URL(`pixels${args.includes('--reverse')?'-reverse':''}${args.includes('--trace')?'-trace':''}.json`,out),JSON.stringify(metrics,null,2));console.table(metrics.filter(r=>r.width===156));console.log(fileURLToPath(out));
