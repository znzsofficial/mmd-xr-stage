import {Masonry,type V} from './masonry';
import {WHEEL,BOARD} from './chamberLayout';

/** Painted historical stage silhouettes. Wheel and stocks are single fixed
 * exhibits with filled faces, rounded edges and no working hardware. */
export function galleryModels(m:Masonry){
  const w=WHEEL,cy=1.14,cx=w.x+.07,cz=w.z,oak='#997155',copper='#c79a6a',mid='#604c51';
  m.box('toolstone',w.x,.10,cz,w.w,.20,w.d,'#8a8494');m.box('oak',cx-.225,.67,cz,.15,.94,.23,mid);
  function wheelPoint(t:number,r:number,x:number):V{return [x,cy+Math.cos(t)*r,cz+Math.sin(t)*r];}
  // Build one continuous wheel section. Both visible sides have disjoint annuli;
  // the copper stripe replaces a strip of wood instead of printing over its back.
  for(let i=0;i<48;i++){
    const a=(i-.5)*Math.PI/24,b=(i+.5)*Math.PI/24;
    const band=(r:number,R:number,x:number,X:number,col:string)=>m.quad('pigment',[wheelPoint(a,r,cx+x),wheelPoint(b,r,cx+x),wheelPoint(b,R,cx+X),wheelPoint(a,R,cx+X)],col);
    for(const sign of [-1,1]){
      band(0,.12,.153*sign,.153*sign,mid);band(.12,.16,.153*sign,.1*sign,oak);
      band(.58,.635,.07*sign,.095*sign,oak);band(.635,.66,.095*sign,.095*sign,copper);
      band(.66,.715,.095*sign,.10*sign,oak);band(.715,.747,.10*sign,.083*sign,mid);
      if(i%6===0)band(.16,.58,.055*sign,.055*sign,copper);
    }
    band(.747,.747,-.083,.083,mid);
    if(i%6===0){
      for(const t of [a,b])m.quad('pigment',[wheelPoint(t,.16,cx-.055),wheelPoint(t,.58,cx-.055),wheelPoint(t,.58,cx+.055),wheelPoint(t,.16,cx+.055)],oak);
      for(const sign of [-1,1]){band(.16,.16,.055*sign,.1*sign,oak);band(.58,.58,.055*sign,.07*sign,mid);}
    }else{band(.16,.16,-.1,.1,oak);band(.58,.58,-.07,.07,mid);}
  }
  // The stocks' shadow shapes are painted into a closed carving.
  const b=BOARD,front=b.x+.19;
  m.box('toolstone',b.x,.084,b.z,b.w,.168,b.d,'#89818c');
  for(const side of [-1,1]){m.box('oak',b.x+.04,.564,b.z+side*.64,.16,.792,.18,oak);m.spindle('pigment',b.x+.04,b.z+side*.64,[[1.42,.088],[1.48,.12],[1.59,0]],copper,8);}
  m.box('oak',b.x+.07,1.19,b.z,.23,.46,1.49,'#987256');m.box('iron',front,1.014,b.z,.026,.043,1.44,mid);
  for(const [z,r] of [[-.45,.082],[0,.153],[.45,.082]])for(let i=0;i<18;i++){
    const pt=(k:number,rr:number,xx:number):V=>[xx,1.21+rr*Math.cos(k*Math.PI/9),b.z+z+rr*Math.sin(k*Math.PI/9)];
    m.quad('pigment',[pt(i,r+.013,front+.005),pt(i+1,r+.013,front+.005),pt(i+1,r,front+.012),pt(i,r,front+.012)],copper);
    m.quad('pigment',[[front+.010,1.21,b.z+z],pt(i,r,front+.010),pt(i+1,r,front+.010),[front+.010,1.21,b.z+z]],'#433d4a');
  }
}
