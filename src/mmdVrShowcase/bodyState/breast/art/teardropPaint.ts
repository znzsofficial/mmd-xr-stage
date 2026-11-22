import { chest, torsoWidth } from './figure';
import { pigment,type AreolaStyle } from './areola';
import { camera,type Camera,type Ink } from './geometry';
import { clamp,smooth } from './mesh';
import { portraitX,portraitY,RASTER_WIDTH as W,RASTER_HEIGHT as H,RASTER_SCALE as S } from './raster';
import { R as tileR,Y as tileY } from './section';
import { bounds,field,frontBound,slice,tissueWeight,type Slice } from './teardrop';
import { cutSlope,type Cut } from './teardropCut';

const px=portraitX(camera(0),1,0)-portraitX(camera(0),0,0),y0=portraitY(0,0),sq=(x:number)=>x*x;
export type Face={cut:Cut;tile:ImageData};
export type Faces=readonly [Face,Face]; // left (+x), right (-x)

// The pigment, lighting, lower fold and painted marks of approved study 02.
// Use the local lobe coordinates at this hit, not the screen-side fill.
function shade(rgb:Uint8ClampedArray,k:number,weight:number,e:Slice['l'],x:number,z:number,ny:number,lateral:number,eye:number){
  const light=-.42*lateral+.62*ny+.52*eye;
  const shade=1-smooth((light+.12)/.57),dark=1-smooth((light+.64)/.55),cream=smooth((light-.42)/.51);
  const contact=4*weight*(1-weight)*smooth((-.21-e.h)/.57),lift=smooth((-ny-.65)/.32)*weight;
  const fold=Math.exp(-sq((weight-.646)/.059))*smooth((-.60-e.h)/.33)*smooth((.15-ny)/.58);
  let R=249-21*shade-15*dark+4*cream-9*contact+5*lift-19*fold;
  let G=211-43*shade-17*dark+11*cream-18*contact+7*lift-24*fold;
  let B=190-24*shade-11*dark+13*cream-12*contact+8*lift-18*fold;
  const hi=Math.exp(-sq((lateral+.23)/.12)-sq((ny-.32)/.18))*weight;
  const stroke=(1-smooth((Math.hypot((lateral+.28+.12*ny)/.024,(ny-.35)/.085)-.44)/.67))*weight;
  R+=3*hi+7*stroke;G+=10*hi+12*stroke;B+=13*hi+14*stroke;
  const mix=rgb[k+3]?smooth((weight-.004)/.24):1;
  rgb[k]+=(R-rgb[k])*mix;rgb[k+1]+=(G-rgb[k+1])*mix;rgb[k+2]+=(B-rgb[k+2])*mix;
  if(e.band&&z>e.z)pigment(rgb,k,e.band,Math.abs(x),ny,lateral,eye,weight*mix);
}
function sectionColour(face:Face,rgb:Uint8ClampedArray,k:number,y:number,z:number){
  const [s,h]=face.cut.uv(y,z),tile=face.tile;
  const ix=Math.round(s*(tile.width-1)),iy=Math.round(clamp((tileY-h*tileR)/(tile.height-1))*(tile.height-1)),p=(iy*tile.width+ix)*4;
  if(tile.data[p+3]>100){rgb[k]=tile.data[p];rgb[k+1]=tile.data[p+1];rgb[k+2]=tile.data[p+2];}
  else{rgb[k]=249;rgb[k+1]=204;rgb[k+2]=177;}
}

export function paintTeardrop(rgb:Uint8ClampedArray,d:Float32Array,cam:Camera,lf:number,rf:number,ls:number,rs:number,faces:Faces|null,style:AreolaStyle){
  const {s,c}=cam,offset=portraitX(cam,0,0),eps=.0008;
  for(let iy=0;iy<H;iy++){
    const y=(y0-iy/S)/px;if(y>.78||y<-.68)continue;
    const sl=slice(y,lf,rf,ls,rs,style),up=slice(y+eps,lf,rf,ls,rs,style),dn=slice(y-eps,lf,rf,ls,rs,style),row=bounds(sl,cam);
    // At a grazing angle the end of the crown may be thinner along a ray
    // than the normal march step. Supersample only its projected interval.
    const interval=(e:Slice['l'],side:number)=>{
      if(!e.band||Math.abs(s)<.5)return null;
      const z=e.z+e.rz*Math.sqrt(1-e.h*e.h),h=side*e.band.cx*c-z*s;
      return {h,r:e.band.width*c+(.08+e.band.extra)*Math.abs(s)};
    };
    const li=interval(sl.l,1),ri=interval(sl.r,-1);
    for(let ix=0;ix<W;ix++){
      const h=(ix/S-offset)/px;if(Math.abs(h)>1.35)continue;
      const bound=frontBound(row,h);if(bound<-.74)continue;
      const X=h*c,Z=-h*s,ind=iy*W+ix,k=ind*4;
      let near=1.42,far=-.74,face:Face|null=null;
      if(faces){
        // Intersect this very ray with the retained medial half-spaces before
        // finding skin. If the entrance to the retained solid lies on a cut,
        // that hit is tissue; a turn simply changes which surface is nearer.
        for(const f of faces){const side=f.cut.side,A=side*s+cutSlope*c,B=f.cut.k-side*X-cutSlope*Z;
          if(Math.abs(A)<1e-9){if(B<0)far=Infinity;continue;}
          const v=B/A;if(A>0&&v<near){near=v;face=f;}else if(A<0)far=Math.max(far,v);
        }
        if(near<far)continue;
      }
      const detail=(li&&Math.abs(h-li.h)<li.r)||(ri&&Math.abs(h-ri.h)<ri.r);
      const step=detail ? .008 : .031;
      let v=Math.min(near,1.42-Math.max(0,Math.floor((1.42-bound)/step))*step);
      if(v<far)continue;
      const clipped=face!==null&&v===near&&field(sl,X+v*s,Z+v*c)>=0;
      if(!clipped){
        let outside=v,hit=false;
        for(;v>=far;v-=step){if(field(sl,X+v*s,Z+v*c)>=0){hit=true;break;}outside=v;}
        // A thin strip seen from the reverse side can terminate at the far
        // clipping plane between two samples. Retain the uncut entrance.
        if(!hit){if(!faces||field(sl,X+far*s,Z+far*c)<0)continue;v=far;}
        for(let j=0;j<11;j++){const m=(v+outside)/2;if(field(sl,X+m*s,Z+m*c)>=0)v=m;else outside=m;}
        v=(v+outside)/2;
      }
      const x=X+v*s,z=Z+v*c,depth=v+.057*(y+.057*v),weight=tissueWeight(sl,x,z);
      if(weight<.006||faces&&depth<d[ind]-.002)continue;
      if(clipped&&face){
        // The independently depth-tested chest wall is the back of the cut;
        // the atlas cannot paint through it onto the arm or rib cage.
        if(z<face.cut.back||weight<.08)continue;
        sectionColour(face,rgb,k,y,z);
      }else{
        const gx=field(sl,x-eps,z)-field(sl,x+eps,z),gy=field(dn,x,z)-field(up,x,z),gz=field(sl,x,z-eps)-field(sl,x,z+eps);
        const len=Math.hypot(gx,gy,gz)||1;
        shade(rgb,k,weight,x>=0?sl.l:sl.r,x,z,gy/len,(gx*c-gz*s)/len,(gx*s+gz*c)/len);
      }
      rgb[k+3]=255;d[ind]=Math.max(d[ind],depth);
    }
  }
}

export function collarInk(ctx:Ink,cam:Camera,d:Float32Array){
  for(const side of [-1,1]){
    let last:[number,number]|undefined;
    for(let i=0;i<=80;i++){
      const t=i/80,a=.066+.93*t,[x,y,z]=chest(side*a,.701+.073*Math.sin(torsoWidth(.70)*Math.sin(a)*4.6)),depth=x*cam.s+z*cam.c;
      const xx=portraitX(cam,x,z)*S,yy=portraitY(y,0)*S,p=Math.round(yy)*W+Math.round(xx);
      if(Math.abs(d[p]-(depth+.057*(y+.057*depth)))>.022){last=undefined;continue;}
      if(last){ctx.strokeStyle='#ba807d';ctx.lineWidth=.95*S*Math.sin(t*Math.PI)**.65+.09;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...last);ctx.lineTo(xx,yy);ctx.stroke();}last=[xx,yy];
    }
  }
}
