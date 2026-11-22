import { camera, ellipse, line, unit, type Ink, type P } from './geometry';
import { defaultAreolaStyle,type AreolaStyle } from './areola';
import type { Marks } from './teardropCut';
import { createPortraitRenderer, type Bitmap } from './exterior';

export interface BreastArtFrame {
  width:number; height:number;
  /** Front is 0; +90 is the subject's left profile. */
  degrees:number;
  /** Illustration seconds. No clock or PMX measurement inside the art. */
  time:number;
  fullness:number; lactating:boolean; left:number; right:number; zh:boolean;
  section:boolean; labels:boolean;
  areolaStyle?:AreolaStyle;
  /** Signed transient excursion of free lower tissue; neutral at rest. */
  settle?:number;
  /** Local excursions after a one-side debit; not part of stored fullness. */
  leftSettle?:number;rightSettle?:number;
}

const PLUM='#211722';
// The figure faces the viewer: actor-right is on the left of a frontal
// portrait. At profile both readings remain labelled, even for the far side.
function milkKey(ctx:Ink,zh:boolean,right:number,left:number){
  ctx.font='600 13px system-ui, sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
  for(const [x,title,value] of [[4,zh?'右乳':'R milk',right],[304,zh?'左乳':'L milk',left]] as const){
    ctx.fillStyle=PLUM;ctx.fillRect(x,237,92,23);
    ctx.fillStyle='#fff1df';ctx.fillText(`${title} ${Math.round(unit(value)*100)}%`,x+5,246);
    ctx.fillStyle='#634352';ctx.fillRect(x+5,256,80,3);ctx.fillStyle='#edb5c2';ctx.fillRect(x+5,256,80*unit(value),3);
  }
}
function buffer(w:number,h:number,owner:Ink):Bitmap|null {
  if(typeof OffscreenCanvas!=='undefined'){
    const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d');if(ctx)return {canvas,ctx};
  }
  // Only reached on a DOM canvas without OffscreenCanvas. No document or
  // window global is needed in a worker.
  if(!('ownerDocument' in owner.canvas))return null;
  const canvas=owner.canvas.ownerDocument.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');return ctx?{canvas,ctx}:null;
}
function annotate(ctx:Ink,m:Marks,zh:boolean,breath:number) {
  const leader=([x,py]:P,text:string,right:boolean,y:number,col:string)=>{
    const ay=218+(py-218)*breath,tx=right?392:8;
    ctx.textAlign=right?'right':'left';
    const edge=tx+(right?-1:1)*(ctx.measureText(text).width+4),end=edge+(right?-5:5);
    line(ctx,[[edge,y],[end,y],[x,ay]]);ctx.lineWidth=1.64;ctx.strokeStyle='rgba(65,37,54,.82)';ctx.stroke();
    ctx.lineWidth=.71;ctx.strokeStyle='#edd0bb';ctx.stroke();ellipse(ctx,x,ay,2.15,2.15,0);ctx.fillStyle=col;ctx.fill();
    ctx.lineWidth=.72;ctx.strokeStyle='#764e56';ctx.stroke();ctx.lineWidth=3.65;ctx.strokeStyle=PLUM;ctx.strokeText(text,tx,y);
    ctx.fillStyle='#ffe7d4';ctx.fillText(text,tx,y);
  };
  ctx.font='600 13px system-ui, sans-serif';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineCap='round';
  const right=m.gland[0]>200;
  leader(m.muscle,zh?'胸大肌':'Pectoralis major',!right,46,'#e5a399');leader(m.wall,zh?'胸壁':'Chest wall',!right,221,'#e9bf9c');
  leader(m.gland,zh?'腺叶':'Glandular lobe',right,80,'#e6b0a6');leader(m.duct,zh?'乳管':'Milk duct',right,159,'#f9e3bf');
  leader(m.fat,zh?'脂肪':'Fat',right,227,'#e9bf8c');
}

/** One local depth-rendered portrait, its cut tissues, and one cached plate
 * per owner. A visible, held angle only blits through the breathing transform. */
export function createBreastArt() {
  let plate:Bitmap|null=null,model:ReturnType<typeof createPortraitRenderer>=null,lastKey='',marks:Marks|null=null;
  return {draw(ctx:Ink,f:BreastArtFrame){
    if(!(f.width>0&&f.height>0&&Number.isFinite(f.width+f.height)))return;
    const degrees=Math.max(-90,Math.min(90,Number.isFinite(f.degrees)?f.degrees:0)),fullness=unit(f.fullness),
      left=f.lactating?Math.round(unit(f.left)*128)/128:0,right=f.lactating?Math.round(unit(f.right)*128)/128:0;
    const excursion=(side:number|undefined)=>{const n=(f.settle??0)+(side??0);return f.section||!Number.isFinite(n)?0:Math.round(24*Math.max(-1,Math.min(1,n)))/24;};
    const leftSettle=excursion(f.leftSettle),rightSettle=excursion(f.rightSettle);
    const areolaStyle=f.areolaStyle??defaultAreolaStyle;
    const key=`${degrees}/${fullness}/${+f.lactating}/${left}/${right}/${+f.section}/${leftSettle}/${rightSettle}/${areolaStyle}`;
    const scale=Math.min(f.width/400,f.height/260),m=ctx.getTransform(),dpr=Math.min(2,Math.max(.5,scale*Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d))));
    const w=Math.ceil(400*dpr),h=Math.ceil(260*dpr);
    if(!plate||plate.canvas.width!==w||plate.canvas.height!==h){plate=buffer(w,h,ctx);lastKey='';}
    const draw=(out:Ink)=>{
      model??=createPortraitRenderer((w,h)=>buffer(w,h,ctx));
      marks=model?.draw(out,{camera:camera(degrees),fullness,leftFill:left,rightFill:right,section:f.section,lactating:f.lactating,leftSettle,rightSettle,areolaStyle})??null;
    };
    if(plate&&lastKey!==key){const c=plate.ctx;c.setTransform(w/400,0,0,h/260,0,0);c.clearRect(0,0,400,260);draw(c);lastKey=key;}
    ctx.save();ctx.fillStyle=PLUM;ctx.fillRect(0,0,f.width,f.height);ctx.beginPath();ctx.rect(0,0,f.width,f.height);ctx.clip();
    ctx.translate((f.width-400*scale)/2,(f.height-260*scale)/2);ctx.scale(scale,scale);
    const breath=1+.006*Math.sin((Number.isFinite(f.time)?f.time:0)*1.40);
    ctx.save();ctx.translate(0,218*(1-breath));ctx.scale(1,breath);
    if(plate)ctx.drawImage(plate.canvas,0,0,400,260);else draw(ctx);
    ctx.restore();if(f.section&&f.labels&&marks)annotate(ctx,marks,f.zh,breath);
    if(f.lactating)milkKey(ctx,f.zh,f.right,f.left);ctx.restore();
  },dispose(){plate=null;model=null;lastKey='';marks=null;}};
}
