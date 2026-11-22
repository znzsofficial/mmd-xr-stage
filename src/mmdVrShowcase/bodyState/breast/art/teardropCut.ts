import { wallPoint } from './figure';
import { cutBounds, type Camera, type P, type Side, type V } from './geometry';
import { clamp } from './mesh';
import { portraitX,portraitY,RASTER_SCALE,RASTER_WIDTH,RASTER_HEIGHT } from './raster';
import { ductPoint,fatPoint,glandPoint } from './section';
import { egg,eggNorm,height,middle } from './teardrop';

/** Cross-section of the very same volume rendered by the exterior. The plane
 * is oblique to the sagittal plane so its tissue remains visible from the
 * front. The UV map and leaders both use its posterior-to-anterior axis. */
export const cutSlope=.43;
export const plane=(full:number)=>.78+.045*full;
export function cutMap(full:number,side:Side){
  const k=plane(full),back=.245,lower=middle(full)-height(full),upper=middle(full)+height(full);
  // Quadratic intersection of a slice ellipse with x = k - slope*z.
  let front=back,tipY=middle(full);
  for(let i=0;i<=180;i++){
    const y=lower+(upper-lower)*i/180,e=egg(y,full),a=e.ix**2*cutSlope**2+e.iz**2,
      b=e.ix**2*(k-e.x)*cutSlope+e.iz**2*e.z,c=e.ix**2*(k-e.x)**2+e.iz**2*e.z**2+e.h**2-1;
    const disc=b*b-a*c;if(disc<0)continue;
    const z=(b+Math.sqrt(disc))/a;if(z>front){front=z;tipY=y;}
  }
  const n=128,lo=new Float64Array(n+1),hi=new Float64Array(n+1);
  for(let i=0;i<=n;i++){
    const z=back+(front-back)*i/n,x=k-cutSlope*z;
    const inside=(y:number)=>eggNorm(egg(y,full),x,z)<=1;
    let seed=tipY;
    if(!inside(seed)){for(let j=1;j<90;j++){seed=lower+(upper-lower)*j/90;if(inside(seed))break;}}
    if(!inside(seed)){lo[i]=hi[i]=tipY;continue;}
    const end=(out:number)=>{let inn=seed;for(let j=0;j<18;j++){const m=(inn+out)/2;if(inside(m))inn=m;else out=m;}return inn;};
    lo[i]=end(lower);hi[i]=end(upper);
  }
  const at=(a:Float64Array,s:number)=>{const p=clamp(s)*n,i=Math.min(n-1,Math.floor(p));return a[i]+(p-i)*(a[i+1]-a[i]);};
  return {k,side,back,front,uv(y:number,z:number):P{
    const s=clamp((z-back)/(front-back)),bottom=at(lo,s),t=clamp((y-bottom)/Math.max(1e-8,at(hi,s)-bottom)),[a,b]=cutBounds(s);
    return [s,b+(a-b)*t];
  },point(s:number,h:number):V{
    const z=back+(front-back)*s,[a,b]=cutBounds(s),t=clamp((h-b)/Math.max(1e-8,a-b)),bottom=at(lo,s);
    return [side*(k-cutSlope*z),bottom+(at(hi,s)-bottom)*t,z];
  }};
}
export type Cut=ReturnType<typeof cutMap>;
export type Marks={muscle:P;wall:P;gland:P;duct:P;fat:P};
export function marks(cut:Cut,cam:Camera,depths:Float32Array):Marks{
  const project=([x,y,z]:V):P=>[portraitX(cam,x,z),portraitY(y,0)];
  const label=(v:readonly[number,number])=>project(cut.point(v[0],v[1]));
  const side=Math.abs(cam.s)<.4?(cut.side===1?-1:1):cut.side;
  const wall=(ty:number,tx:number)=>{
    let anchor=project(wallPoint(side,ty,tx)),best=Infinity;
    for(let j=0;j<17;j++)for(let i=0;i<8;i++){
      const t=.035+j*.059,u=(tx>.5?.64:.036)+i*.04,p=wallPoint(side,t,u),q=project(p),d=p[0]*cam.s+p[2]*cam.c;
      const x=Math.round(q[0]*RASTER_SCALE),y=Math.round(q[1]*RASTER_SCALE),dist=Math.abs(t-ty)+.5*Math.abs(u-tx);
      if(x>=0&&x<RASTER_WIDTH&&y>=0&&y<RASTER_HEIGHT&&Math.abs(depths[y*RASTER_WIDTH+x]-d-.057*(p[1]+.057*d))<.019&&dist<best){anchor=q;best=dist;}
    }return anchor;
  };
  return {gland:label(glandPoint),duct:label(ductPoint),fat:label(fatPoint),muscle:wall(.91,.29),wall:wall(.26,.83)};
}
