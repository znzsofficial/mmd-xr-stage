import {Masonry,type V} from './masonry';
import {WHEEL,BOARD} from './chamberLayout';

/** Painted historical stage silhouettes. Wheel and stocks are single fixed
 * exhibits with filled faces, rounded edges and no working hardware. */
export function galleryModels(m:Masonry){
  const w=WHEEL,cy=1.14,cx=w.x+.07,cz=w.z,oak='#997155',copper='#c79a6a',mid='#604c51';
  m.box('toolstone',w.x,.10,cz,w.w,.20,w.d,'#8a8494');m.box('oak',w.x,.41,cz,.24,.52,.57,mid);
  function wheelPoint(t:number,r:number,x:number):V{return [x,cy+Math.cos(t)*r,cz+Math.sin(t)*r];}
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12,b=(i+1)*Math.PI/12;
    for(const [inner,outer,col] of [[.58,.715,oak],[.715,.747,mid],[.64,.66,copper]] as const){
      const front=cx+(col===copper?.116:.11);m.quad('pigment',[wheelPoint(a,inner,front),wheelPoint(b,inner,front),wheelPoint(b,outer,front),wheelPoint(a,outer,front)],col);
      m.quad('pigment',[wheelPoint(a,outer,cx+.11),wheelPoint(b,outer,cx+.11),wheelPoint(b,outer,cx-.10),wheelPoint(a,outer,cx-.10)],col);
      m.quad('pigment',[wheelPoint(a,inner,cx-.10),wheelPoint(b,inner,cx-.10),wheelPoint(b,outer,cx-.10),wheelPoint(a,outer,cx-.10)],col);
    }
    if(i%3===0)m.quad('pigment',[wheelPoint(a-.29,.12,cx+.07),wheelPoint(a-.10,.60,cx+.07),wheelPoint(a+.10,.60,cx+.07),wheelPoint(a+.29,.12,cx+.07)],copper);
    m.quad('pigment',[[cx+.127,cy,cz],wheelPoint(a,.143,cx+.123),wheelPoint(b,.143,cx+.123),[cx+.127,cy,cz]],mid);
  }
  // The stocks' shadow shapes are painted into a closed carving.
  const b=BOARD,front=b.x+.19;
  m.box('toolstone',b.x,.084,b.z,b.w,.168,b.d,'#89818c');
  for(const side of [-1,1]){m.box('oak',b.x,.77,b.z+side*.64,.18,1.29,.18,oak);m.spindle('pigment',b.x,b.z+side*.64,[[1.37,.11],[1.48,.13],[1.59,0]],copper,8);}
  m.box('oak',b.x+.07,1.19,b.z,.23,.46,1.49,'#987256');m.box('iron',front,1.014,b.z,.026,.043,1.44,mid);
  for(const [z,r] of [[-.45,.082],[0,.153],[.45,.082]])for(let i=0;i<18;i++){
    const pt=(k:number,rr:number,xx:number):V=>[xx,1.21+rr*Math.cos(k*Math.PI/9),b.z+z+rr*Math.sin(k*Math.PI/9)];
    m.quad('pigment',[pt(i,r+.013,front+.005),pt(i+1,r+.013,front+.005),pt(i+1,r,front+.012),pt(i,r,front+.012)],copper);
    m.quad('pigment',[[front+.010,1.21,b.z+z],pt(i,r,front+.010),pt(i+1,r,front+.010),[front+.010,1.21,b.z+z]],'#433d4a');
  }
}
