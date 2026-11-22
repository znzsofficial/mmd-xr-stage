// Node 26 CPU / actual worker brush. Optional argument: directory containing
// @napi-rs/canvas. No WebGL, browser, stage, model files or I/O outside local-review.
import {createRequire,registerHooks} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Matrix4} from 'three';
const own=new URL('../../src/',import.meta.url),out=new URL('../../local-review/art/canal/cpu/',import.meta.url);
registerHooks({resolve(id,context,next){if(context.parentURL?.startsWith(own.href)&&id.startsWith('.')&&!id.endsWith('.ts'))id+='.ts';return next(id,context);}});
const {createCanvas}=createRequire(import.meta.url)(process.argv[2]??'@napi-rs/canvas');
globalThis.OffscreenCanvas=class {constructor(w,h){return createCanvas(w,h);}};
const {createOrganArt}=await import(new URL('mmdVrShowcase/pelvic/atlas/organArt.ts',own));
const {createPelvicSolver,pelvicRailMatrix}=await import(new URL('mmdVrShowcase/pelvic/geometry.ts',own));
const f={world:new Matrix4(),inverse:new Matrix4(),scale:1,lengthM:.092,radiusM:.024},solver=createPelvicSolver();
function measure(mm){const m=pelvicRailMatrix(f,mm/1000);m.elements[12]+=.0018;
  const c=solver.step(f,m,{dt:1/72});return {tip:c.outletLocal.toArray(),tail:c.shaftLocal[0].toArray(),shaft:c.shaftLocal.map(p=>p.toArray()),
    depth:c.depthM,outletInside:c.outletInside,outletVisible:c.outletVisible,aligned:c.inside,atCervix:c.atCervix,angleDeg:0,radiusM:f.radiusM,lengthM:f.lengthM};}
let s;for(let d=-22;d<=24;d+=1)s=measure(d);const entering=s;
for(let d=25;d<=55;d+=1)s=measure(d);const held=measure(55);
for(let d=54;d>=14;d-=1)s=measure(d);const withdrawing=s;
for(let d=13;d>=-10;d-=1)s=measure(d);
const poses=[['rest',null],['advance',entering],['hold',held],['withdraw',withdrawing],['out',s]];
await mkdir(out,{recursive:true});const art=createOrganArt(),comparison=createCanvas(344*poses.length,312*3),g=comparison.getContext('2d');
g.fillStyle='#211722';g.fillRect(0,0,comparison.width,comparison.height);
const ms=[],heldMs=[];
for(const [ri,angle] of [38,0,90].entries())for(const [ci,[name,sample]] of poses.entries()){
  const canvas=createCanvas(688,564),ctx=canvas.getContext('2d');ctx.scale(2,2);const begin=performance.now();
  const o={x:0,y:0,width:344,height:282,focus:'vagina',yaw:angle*Math.PI/180,time:0,pressure:0,lining:0,shedding:0,
    fantasy:false,fluid:0,vaginalFluid:0,sample,zh:true};art.draw(ctx,o);ms.push(+(performance.now()-begin).toFixed(2));
  if(name==='hold'){const start=performance.now();art.draw(ctx,{...o,sample:structuredClone(sample),time:1});heldMs.push(+(performance.now()-start).toFixed(2));}
  await writeFile(new URL(`${angle}-${name}.png`,out),canvas.toBuffer('image/png'));
  g.drawImage(canvas,ci*344,ri*312,344,282);g.fillStyle='#eee1d5';g.font='16px sans-serif';
  g.fillText(`${angle}°  ${name}   ${sample?.outletInside?(sample.depth*1000).toFixed(1)+' mm':'outside / rest'}`,ci*344+14,ri*312+302);
}
art.dispose();await writeFile(new URL('contact-sheet.png',out),comparison.toBuffer('image/png'));
console.log(fileURLToPath(out),'\nCPU draw milliseconds (local machine only):',ms.join(', '),'\nRepeat held pose:',heldMs.join(', '));
