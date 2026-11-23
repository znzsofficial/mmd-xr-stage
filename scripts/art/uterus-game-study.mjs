// CPU only; see canal-contact-study.mjs for the same Node Canvas adapter.
import {createRequire,registerHooks} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const src=new URL('../../src/',import.meta.url),out=new URL('../../local-review/art/uterus/event-02/',import.meta.url);
registerHooks({resolve(id,context,next){if(context.parentURL?.startsWith(src.href)&&id.startsWith('.')&&!id.endsWith('.ts'))id+='.ts';return next(id,context);}});
const {createCanvas}=createRequire(import.meta.url)(process.argv[2]??'@napi-rs/canvas');
globalThis.OffscreenCanvas=class {constructor(w,h){return createCanvas(w,h);}};
const {createOrganArt}=await import(new URL('mmdVrShowcase/pelvic/atlas/organArt.ts',src));
const {startGame,progressDays,receiveDose,reproductiveSample,nextMilestone}=await import(new URL('mmdVrShowcase/bodyState/reproduction/game.ts',src));
const {DEFAULT_BODY_PROFILE:p,sampleBody}=await import(new URL('mmdVrShowcase/bodyState/data.ts',src));
const first=startGame('asset-1',p),egg=progressDays(first,nextMilestone(first).days,p),zygote=receiveDose(egg);
const failed=receiveDose(startGame('asset-2',{...p,day:15})),lost=receiveDose(startGame('asset-5',{...p,day:15}));
const states=[[egg,12,'卵子静待'],[zygote,4.5,'围拢'],[zygote,7.4,'一枚融入'],[zygote,11.5,'其余已离开'],
  ...[1,2,3,4].map((d,i)=>[progressDays(zygote,d,p),12,['两细胞','四细胞','八细胞','游离囊胚'][i]]),
  [progressDays(zygote,6,p),1.2,'着床初始'],[progressDays(zygote,6,p),6.8,'进入内膜'],[progressDays(zygote,34,p),12,'孕日 35'],[progressDays(zygote,90,p),12,'孕日 91']];
const daily=sampleBody({...p,day:15}),art=createOrganArt();
await mkdir(out,{recursive:true});
function frame(state,age,angle){
  const canvas=createCanvas(688,564),ctx=canvas.getContext('2d');ctx.scale(2,2);
  art.draw(ctx,{x:0,y:0,width:344,height:282,yaw:angle*Math.PI/180,time:age,focus:'uterus',labels:false,lining:daily.lining,shedding:daily.shedding,tissue:daily.tissue,
    pressure:0,fluid:0,fantasy:false,reproduction:reproductiveSample(state),reproductionSeconds:age,zh:true});return canvas;
}
function caption(g,name,x,y){g.fillStyle='#f5dfbf';g.font='16px "Microsoft YaHei", sans-serif';g.fillText(name,x+12,y+303);}
for(const angle of [0,38,90]){
  const sheet=createCanvas(4*344,3*312),g=sheet.getContext('2d');g.fillStyle='#211722';g.fillRect(0,0,sheet.width,sheet.height);
  for(const [i,[s,age,name]] of states.entries()){
    const x=i%4*344,y=Math.floor(i/4)*312;g.drawImage(frame(s,age,angle),x,y,344,282);caption(g,`${name} · 生育日 ${s.day}`,x,y);
  }
  const path=new URL(`reproduction-${angle}.png`,out);await writeFile(path,sheet.toBuffer('image/png'));console.log(fileURLToPath(path));
}
const beats=[[zygote,4.5],[zygote,6.8],[zygote,7.92],[zygote,10.8]],sequence=createCanvas(4*344,282),seq=sequence.getContext('2d');
for(const [i,[s,t]] of beats.entries())seq.drawImage(frame(s,t,38),i*344,0,344,282);
await writeFile(new URL('event-beats-38.png',out),sequence.toBuffer('image/png'));
const small=createCanvas(3*156,2*128),sc=small.getContext('2d');for(const [i,[s,t]] of [[egg,12],...beats,[failed,10.8]].entries())sc.drawImage(frame(s,t,38),(i%3)*156,Math.floor(i/3)*128,156,128);
await writeFile(new URL('phone-lens-156px.png',out),small.toBuffer('image/png'));
const neg=createCanvas(4*344,312),ng=neg.getContext('2d');ng.fillStyle='#211722';ng.fillRect(0,0,neg.width,neg.height);
for(const [i,[s,t,name]] of [[first,12,'无排卵：无观察镜'],[failed,4,'遇卵但不融合'],[failed,12,'未受精、已离开'],[progressDays(lost,6,p),12,'未着床，未进入内膜']].entries()){
  ng.drawImage(frame(s,t,38),i*344,0,344,282);caption(ng,name,i*344,0);
}await writeFile(new URL('reproduction-negatives-38.png',out),neg.toBuffer('image/png'));
const double=startGame('asset-18',{...p,day:15}),one=receiveDose(double);
const pair=createCanvas(3*344,312),pg=pair.getContext('2d');pg.fillStyle='#211722';pg.fillRect(0,0,pair.width,pair.height);
for(const [i,[s,t,name]] of [[double,12,'两侧各一枚 · 放大其中一枚'],[one,7,'单侧融合 · 对侧空心标记'],[progressDays(one,2,p),12,'仅一个四细胞胚胎']].entries()){
  pg.drawImage(frame(s,t,38),i*344,0,344,282);caption(pg,name,i*344,0);
}await writeFile(new URL('two-ova-one-embryo.png',out),pair.toBuffer('image/png'));
if(process.argv.includes('--frames')){
  const dir=new URL('encounter-frames/',out);await mkdir(dir,{recursive:true});
  for(let i=0;i<=120;i++){const c=createCanvas(344,282);c.getContext('2d').drawImage(frame(zygote,i/10,38),0,0,344,282);
    await writeFile(new URL(`${String(i).padStart(3,'0')}.png`,dir),c.toBuffer('image/png'));}
}
art.dispose();
