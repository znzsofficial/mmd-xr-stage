// Run the production organ brush on a local CPU canvas, without a model import.
// Optional first argument: @napi-rs/canvas installation. No review art is bundled.
import {createRequire,registerHooks} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const src=new URL('../../src/',import.meta.url),out=new URL('../../local-review/art/conception/',import.meta.url);
registerHooks({resolve(id,c,next){if(c.parentURL?.startsWith(src.href)&&id.startsWith('.')&&!id.endsWith('.ts'))id+='.ts';return next(id,c);}});
const {createCanvas}=createRequire(import.meta.url)(process.argv[2]??'@napi-rs/canvas');globalThis.OffscreenCanvas=class{constructor(w,h){return createCanvas(w,h);}};
const {createOrganArt}=await import(new URL('mmdVrShowcase/pelvic/atlas/organArt.ts',src));
const w=344,h=282,brush=createOrganArt(),stages=[1.5,4.5,7.4,9.1,12],modes=[false,true];
function frame(success,age,deg=38,close=true){const canvas=createCanvas(w*2,h*2),ctx=canvas.getContext('2d');ctx.scale(2,2);
  const event=success==null?undefined:{id:1,chance:success?100:0,success,at:0,side:1,target:'vaginal'};
  brush.draw(ctx,{x:0,y:0,width:w,height:h,focus:'uterus',encounterFocus:close,event,encounterSeconds:age,yaw:deg*Math.PI/180,time:age,zh:true,lining:.44,shedding:0,fluid:0,pressure:0,fantasy:false});return canvas;}
await mkdir(out,{recursive:true});const sheet=createCanvas(w*stages.length,(h+26)*2),c=sheet.getContext('2d');c.fillStyle='#211722';c.fillRect(0,0,sheet.width,sheet.height);
for(const [j,success] of modes.entries())for(const [i,t] of stages.entries()){const x=i*w,y=j*(h+26);c.drawImage(frame(success,t),x,y,w,h);c.fillStyle='#f4d5bb';c.font='16px sans-serif';c.fillText(`${success?100:0}%  /  ${t} s`,x+12,y+h+17);}
await writeFile(new URL('encounter-branches.png',out),sheet.toBuffer('image/png'));
const views=createCanvas(w*3,h*2),v=views.getContext('2d');for(const [i,deg] of [0,38,90].entries()){v.drawImage(frame(true,7.4,deg),i*w,0,w,h);v.drawImage(frame(true,7.4,deg,false),i*w,h,w,h);}
await writeFile(new URL('same-event-three-angles.png',out),views.toBuffer('image/png'));
if(process.argv.includes('--frames')){const dir=new URL('frames/',out);await mkdir(dir,{recursive:true});for(let i=0;i<=100;i++){const a=createCanvas(344,282);a.getContext('2d').drawImage(frame(true,i*.12),0,0,344,282);await writeFile(new URL(String(i).padStart(3,'0')+'.png',dir),a.toBuffer('image/png'));}}
brush.dispose();
