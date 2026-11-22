// Offline art study 02. One implicit torso for every angle; no live stage imports this file.
import { chest, figure, torsoWidth } from '../../src/mmdVrShowcase/bodyState/breast/art/figure';
import { smooth, VERTEX_STRIDE } from '../../src/mmdVrShowcase/bodyState/breast/art/mesh';
import { camera } from '../../src/mmdVrShowcase/bodyState/breast/art/geometry';
import { meshRenderer, inkContours, RASTER_WIDTH as W, RASTER_HEIGHT as H, RASTER_SCALE as S, portraitX, portraitY } from '../../src/mmdVrShowcase/bodyState/breast/art/raster';

const px=portraitX(camera(0),1,0)-portraitX(camera(0),0,0), y0=portraitY(0,0);
const sq=(x:number)=>x*x;
type Mode='colour'|'clay'|'silhouette';
const height=(f:number)=>.559+.031*f, middle=(f:number)=>.116-.021*f;

/** A horizontal slice of an ovate volume is an ellipse. Its axes narrow
 * smoothly upwards; the centre line leans back into the chest towards the
 * clavicle. At either pole the radius vanishes as sqrt(distance) – a point
 * with a horizontal tangent and finite curvature, never a horizontal cap. */
function section(y:number,f:number){
  const h=(y-middle(f))/height(f);
  const lower=Math.max(0,-h)**4;
  // Allow the belly to grow below the midpoint, then wind around a tighter
  // radius near the lowest point. Without this last term the belly's width
  // persists to the pole and the bottom reads like a nearly flat shelf.
  const rx=(.376+.031*f)*Math.exp(-.41*h-.16*lower),rz=(.437+.064*f)*Math.exp(-.30*h-.15*lower);
  return {h,rx,rz,x:.443-.039*h,z:.263+.018*f-.115*h-.019*h*h,
    w:torsoWidth(y),b:chest(0,y)[2],blend:15+13*(.5+.5*Math.tanh((h+.54)*4))};
}
type Slice=ReturnType<typeof section>;
// The joined surface is the zero set of a smooth minimum. Unlike a union of
// drawn skins this also makes a single, differentiable surface at the return.
function fields(s:Slice,x:number,z:number){
  const q0=.42*(Math.sqrt(sq(x/s.w)+sq(z/s.b))-1);
  const h2=s.h*s.h+sq((z-s.z)/s.rz);
  const ql=.416*(Math.sqrt(h2+sq((x-s.x)/s.rx))-1),qr=.416*(Math.sqrt(h2+sq((x+s.x)/s.rx))-1);
  const a=Math.exp(-s.blend*q0),l=Math.exp(-s.blend*ql),r=Math.exp(-s.blend*qr);
  return [a,l,r];
}
function value(s:Slice,x:number,z:number){
  const h=s.h*s.h+sq((z-s.z)/s.rz);
  return Math.exp(-s.blend*.42*(Math.sqrt(sq(x/s.w)+sq(z/s.b))-1))+
    Math.exp(-s.blend*.416*(Math.sqrt(h+sq((x-s.x)/s.rx))-1))+
    Math.exp(-s.blend*.416*(Math.sqrt(h+sq((x+s.x)/s.rx))-1))-1;
}

export function teardrop(full:number,angle:number,mode:Mode='colour'){
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const ctx=c.getContext('2d')!,im=ctx.createImageData(W,H),rgb=im.data;
  const d=new Float32Array(W*H).fill(-1e4),cam=camera(angle),{s,c:co}=cam;
  const draw=meshRenderer(d,rgb);
  const outfit=figure();
  const piece=([m,sign]:(typeof outfit)[number])=>{
    const data=m.data.slice();
    for(let i=0;i<data.length;i+=VERTEX_STRIDE)data[i+1]+=.057*(data[i]*s+data[i+2]*co);
    draw({...m,data},cam,sign,0);
  };
  piece(outfit[0]);
  if(mode!=='colour') for(let i=0;i<rgb.length;i+=4){
    const g=mode==='silhouette'?193:155+(rgb[i]*.28+rgb[i+1]*.52+rgb[i+2]*.20-190)*.48;
    rgb[i]=rgb[i+1]=rgb[i+2]=g;
  }
  const offset=portraitX(cam,0,0),e=.0008;
  for(let iy=0;iy<H;iy++){
    const y=(y0-iy/S)/px;if(y>.78||y<-.68)continue;
    const sl=section(y,full),up=section(y+e,full),dn=section(y-e,full);
    for(let ix=0;ix<W;ix++){
      const h=(ix/S-offset)/px,ind=iy*W+ix,k=ind*4;
      // Trace from the eye. A bounded coarse sweep followed by bisection also
      // resolves a fold seen edge-on, without assuming a star-shaped section.
      if(Math.abs(h)>1.35)continue;
      const X=h*co,Z=-h*s;
      let outside=1.42, inside=outside;
      for(;inside>-.74;inside-=.031){
        if(value(sl,X+inside*s,Z+inside*co)>=0)break;
        outside=inside;
      }
      if(inside<=-.74)continue;
      for(let j=0;j<11;j++){
        const t=(inside+outside)/2;
        if(value(sl,X+t*s,Z+t*co)>=0)inside=t;else outside=t;
      }
      const v=(inside+outside)/2,x=X+v*s,z=Z+v*co,depth=v+.057*(y+.057*v);
      const [wt,l,r]=fields(sl,x,z),peg=l+r,weight=peg/(wt+peg);
      if(weight<.006)continue;
      const gx=value(sl,x-e,z)-value(sl,x+e,z),gy=value(dn,x,z)-value(up,x,z),gz=value(sl,x,z-e)-value(sl,x,z+e);
      const len=Math.hypot(gx,gy,gz)||1,nx=gx/len,ny=gy/len,nz=gz/len,lateral=nx*co-nz*s,eye=nx*s+nz*co;
      const light=-.42*lateral+.62*ny+.52*eye;
      const clay=mode==='clay',sil=mode==='silhouette';
      const shade=1-smooth((light+.12)/.57),dark=1-smooth((light+.64)/.55),cream=smooth((light-.42)/.51);
      const contact=4*weight*(1-weight)*smooth((-.21-sl.h)/.57);
      const lift=smooth((-ny-.65)/.32)*weight;
      // A narrow warm fold where the lower volume is actually turning into
      // the torso. Fade before the sides, leaving both outer arcs unoutlined.
      const fold=Math.exp(-sq((weight-.646)/.059))*smooth((-.60-sl.h)/.33)*smooth((.15-ny)/.58);
      let R=249-21*shade-15*dark+4*cream-9*contact+5*lift-19*fold;
      let G=211-43*shade-17*dark+11*cream-18*contact+7*lift-24*fold;
      let B=190-24*shade-11*dark+13*cream-12*contact+8*lift-18*fold;
      // Paint directly on the new surface; the clay and silhouette modes
      // discard every mark, all highlights and this palette entirely.
      const hmark=-.39,ax=Math.atan2((Math.abs(x)-sl.x)/sl.rx,(z-sl.z)/sl.rz);
      const radius=Math.hypot((ax-.17)/.170,(sl.h-hmark)/.106);
      const disk=(.52*Math.exp(-1.33*radius*radius)+.48*(1-smooth((radius-.43)/.68)))*weight;
      const dot=Math.exp(-sq((ax-.174)/.046)-sq((sl.h-hmark+.009)/.032))*weight;
      const flick=Math.exp(-sq((ax-.15)/.026)-sq((sl.h-hmark-.017)/.008))*weight;
      const hi=Math.exp(-sq((lateral+.23)/.12)-sq((ny-.32)/.18))*weight;
      const stroke=(1-smooth((Math.hypot((lateral+.28+.12*ny)/.024,(ny-.35)/.085)-.44)/.67))*weight;
      R+=3*hi+7*stroke-13*disk-9*dot+14*flick;G+=10*hi+12*stroke-34*disk-14*dot+19*flick;B+=13*hi+14*stroke-22*disk-9*dot+17*flick;
      if(clay)R=G=B=151+46*light;
      if(sil)R=G=B=193;
      const mix=rgb[k+3]?smooth((weight-.004)/.24):1;
      rgb[k]+=(R-rgb[k])*mix;rgb[k+1]+=(G-rgb[k+1])*mix;rgb[k+2]+=(B-rgb[k+2])*mix;
      rgb[k+3]=255;d[ind]=Math.max(d[ind],depth);
    }
  }
  const torsoDepth=mode==='colour'?null:d.slice();
  outfit.slice(1).forEach(piece);
  if(torsoDepth){for(let i=0;i<d.length;i++)if(d[i]!==torsoDepth[i]){
    const k=i*4,g=mode==='silhouette'?193:155+(rgb[k]*.28+rgb[k+1]*.52+rgb[k+2]*.20-190)*.48;rgb[k]=rgb[k+1]=rgb[k+2]=g;
  }}
  if(mode==='colour')inkContours(d,rgb);
  ctx.putImageData(im,0,0);
  if(mode==='colour'){
    // Clavicle ink belongs to the surrounding figure: keep it in both
    // studies, occluded by the same hair, far shoulder and collar.
    for(const side of [-1,1]){
      let last:[number,number]|undefined;
      for(let i=0;i<=80;i++){
        const t=i/80,a=.066+.93*t,[x,y,z]=chest(side*a,.701+.073*Math.sin(torsoWidth(.70)*Math.sin(a)*4.6)),depth=x*s+z*co;
        const xx=portraitX(cam,x,z)*S,yy=portraitY(y,0)*S,p=Math.round(yy)*W+Math.round(xx);
        if(Math.abs(d[p]-(depth+.057*(y+.057*depth)))>.022){last=undefined;continue;}
        if(last){ctx.strokeStyle='#ba807d';ctx.lineWidth=.95*S*Math.sin(t*Math.PI)**.65+.09;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...last);ctx.lineTo(xx,yy);ctx.stroke();}last=[xx,yy];
      }
    }
  }
  return c;
}

/** Project the *unlit* egg at a turn, before the rib cage hides its upper
 * attachment. This is the exact support function of its horizontal ellipses,
 * not an outline traced from a coloured picture. */
export function envelope(t:number,f:number,angle:number){
  const y=middle(f)+height(f)*Math.cos(t),sl=section(y,f),cam=camera(angle);
  const half=Math.hypot(sl.rx*cam.c,sl.rz*cam.s)*Math.sin(t);
  return [sl.x*cam.c-sl.z*cam.s+half,y];
}
