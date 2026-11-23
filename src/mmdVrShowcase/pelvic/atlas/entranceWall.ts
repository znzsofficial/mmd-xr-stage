import {rod,rodRadii} from '../path';
import type {PelvicSample} from '../stateTypes';
import {restingCut,rimSamples,slitHalfLength,slitHalfWidth,type CutBasis} from '../vulvaForm';

const clamp=(x:number)=>Math.max(0,Math.min(1,x)),bell=(x:number)=>Math.exp(-x*x);
const bands=24,around=rimSamples,vertices=(bands+1)*around;
const lengths=rod.slice(1).map((p,i)=>p.distanceTo(rod[i]));
export type EntranceLoad={reach:number;dx:number;dy:number;girth:number};
export const unloadedWall:EntranceLoad={reach:0,dx:0,dy:0,girth:0};
export const sameEntranceCut=(a:CutBasis,b:CutBasis)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.xx-b.xx)+Math.abs(a.xy-b.xy)+Math.abs(a.yx-b.yx)+Math.abs(a.yy-b.yy)<=1e-6;
export const sameEntranceLoad=(a:EntranceLoad,b:EntranceLoad)=>Math.abs(a.reach-b.reach)+Math.abs(a.dx-b.dx)+Math.abs(a.dy-b.dy)+Math.abs(a.girth-b.girth)<=1e-6;

// Sample the mould just behind the measured lip (or at the actual tip on a
// shallow pass). The short sectional study only needs this one extra station.
export function entranceLoad(s:PelvicSample|null|undefined,cut:CutBasis):EntranceLoad{
  const shaft=s?.shaft;if(cut===restingCut||!s?.outletInside||shaft?.length!==rod.length||!(s.radiusM>0))return unloadedWall;
  const r=s.radiusM,depth=Math.min(.86*r,-s.tip[2]);if(!(depth>0))return unloadedWall;
  for(let i=1;i<shaft.length;i++){
    const a=shaft[i-1],b=shaft[i],dz=a[2]-b[2];if(a[2]<-depth||b[2]>-depth+1e-8||dz<=1e-9)continue;
    const t=clamp((a[2]+depth)/dz),dx=b[0]-a[0],dy=b[1]-a[1];
    return {reach:depth/(.86*r),dx:(a[0]+dx*t)/r-cut.x,dy:(a[1]+dy*t)/r-cut.y,
      girth:(rodRadii[i-1]+(rodRadii[i]-rodRadii[i-1])*t)*Math.hypot(dx,dy,dz)/(lengths[i-1]*r)};
  }
  return unloadedWall;
}

// Transverse shelves curl toward each other from the posterior and anterior
// beds. Each has its own arc and dies out on its flanks: no concentric ribs.
// Bake the material chart once; no trig, exponentials or ray marching per pixel.
const shelves=[ // direction, station, arch, bevel width, relief, lateral skew
  [-1,.20,.13,.066,.18,-.080],[-1,.49,.12,.090,.205,.070],[-1,.76,.13,.077,.113,-.045],
  [1,.35,-.13,.082,.15,.105],[1,.64,-.12,.085,.143,-.069],
];
function materialChart(){return Array.from({length:vertices},(_,i)=>{
  const a=i%around*2*Math.PI/around,t=Math.floor(i/around)/bands,c=Math.cos(a),s=Math.sin(a),gate=clamp(t*11)*clamp((1-t)*8);
  let hill=0,shade=0,gloss=0;
  for(const [side,at,bow,breadth,height,skew] of shelves){
    const fork=c+.23-.18*Math.sin(at*9),arc=at+bow*(c*c-.35)+skew*c+.058*Math.sin(4*c+at*7)-.083*bell(fork/.29);
    const d=(t-arc)/breadth,fan=clamp((.25+side*s)*1.18)*(.66+.34*Math.cos(3.4*c+9*at));
    const spur=bell((fork+.31)/.27)*bell((d+1.10+1.2*fork)/.82);
    const crest=bell(d*(d<0?.88:1.26))+.54*spur;hill+=height*fan*crest;
    shade+=fan*bell((d-.98)*1.36);gloss+=fan*(bell((d+.23)*1.65)*bell((c+.37-.38*Math.sin(at*9))/.55)+.36*spur);
  }
  // A pair of short, staggered longitudinal returns between the fans. Each
  // side gets a rolled face and a shaded root visible on an oblique turn.
  const left=c<0,axis=s-(left?.02:-.18)-(left?.72:-.83)*(t-.38)-.17*Math.sin(7*t+(left?.7:-.8));
  const stem=bell((t-(left?.49:.36))/(left?.30:.24)),branch=bell(axis/.32)*stem;
  hill+=.21*branch;shade+=.78*stem*bell((axis-.30)/.20);
  gloss+=.75*stem*bell((axis+.055)/.20);
  return {c,s,t,hill:hill*gate,shade:shade*gate,gloss:gloss*gate};
});}
let chart:ReturnType<typeof materialChart>|undefined;

/** Short sectional relief viewed through the measured cut. The opposite
 * walls turn towards each other along a swept, apposed seam, not a
 * flat cap. Nothing here can be installed on an actor or infer contact. */
export function createEntranceWall(){
  const sites=chart??=materialChart(),xyz=new Float32Array(vertices*3),rgb=new Float32Array(vertices*3),norm=new Float32Array(vertices*3);
  const previous={...restingCut,x:NaN},lastLoad={...unloadedWall};
  function fit(cut:CutBasis,load:EntranceLoad){
    if(sameEntranceCut(cut,previous)&&sameEntranceLoad(load,lastLoad))return;
    Object.assign(previous,cut);Object.assign(lastLoad,load);
    const a=slitHalfWidth+cut.xx,b=cut.yx,c=cut.xy,d=slitHalfLength+cut.yy;
    const spread=clamp((Math.hypot(a,c)-slitHalfWidth)/.65),reach=load.reach,distension=clamp(load.girth)*reach;
    const length=.29+.42*spread+.48*reach;
    for(let i=0;i<vertices;i++){
      const {t,c:u,s:v,hill,shade,gloss}=sites[i],k=3*i,arch=t*(1-t),lift=hill*(1-.20*distension);
      // A small lateral turn and a rising posterior bed show a far wall in
      // front view. The posterior groups are broader; the anterior ones roll
      // under sooner. A wider sampled shaft stretches the nearer return.
      const U=u*(1-.69*t+.46*arch*distension-.51*lift)-.14*t+.048*arch*v;
      const V=v*((1-t)*(1-.19*t)+.54*arch*distension-lift)+t*(.24+.14*u-.11*u*u)+.07*arch*u;
      xyz[k]=cut.x*(1-.26*t*(1-reach))+a*U+b*V+t*load.dx;
      xyz[k+1]=cut.y*(1-.26*t*(1-reach))+c*U+d*V+t*load.dy;
      xyz[k+2]=-length*(t+.056*arch*u-.17*lift);
      const recess=t*t*(.83+.17*u)*(.42+.58*spread),crest=lift*spread,groove=shade*spread,pearl=gloss*spread;
      rgb[k]=229-74*recess+94*crest-22*groove+10*pearl;
      rgb[k+1]=126-74*recess+185*crest-24*groove+24*pearl;
      rgb[k+2]=118-62*recess+177*crest-19*groove+24*pearl;
    }
    for(let i=0;i<vertices;i++){
      const k=3*i,col=i%around,l=col?k-3:k+3*(around-1),r=col+1<around?k+3:k-3*(around-1);
      const lo=i<around?k:k-around*3,hi=i>=bands*around?k:k+around*3;
      const x=xyz[r]-xyz[l],y=xyz[r+1]-xyz[l+1],z=xyz[r+2]-xyz[l+2],X=xyz[hi]-xyz[lo],Y=xyz[hi+1]-xyz[lo+1],Z=xyz[hi+2]-xyz[lo+2];
      const nx=y*Z-z*Y,ny=z*X-x*Z,nz=x*Y-y*X,n=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);
      norm[k]=nx*n;norm[k+1]=ny*n;norm[k+2]=nz*n;
    }
  }
  return {fit,xyz,norm,rgb,sites};
}

/** Gouraud-only triangles share the shell's Z buffer. The projected mouth
 * acts as a portal: even at grazing incidence no buried lining is visible
 * past the silhouette. Raster cost is bounded by the very small aperture. */
export function entranceBrush(w:number,h:number,ox:number,oy:number,unit:number){
  const wall=createEntranceWall(),{xyz,norm,rgb,sites}=wall,screen=new Float32Array(vertices*6),left=new Int32Array(h),right=new Int32Array(h);
  function paint(co:number,si:number,cut:CutBasis,load:EntranceLoad,depth:Float32Array,rgba:Uint8ClampedArray){
    if(co<1e-5)return;
    wall.fit(cut,load);
    for(let i=0;i<vertices;i++){
      const k=i*6,j=i*3,x=xyz[j],z=xyz[j+2],nx=co*norm[j]+si*norm[j+2],ny=norm[j+1],nz=co*norm[j+2]-si*norm[j];
      screen[k]=ox+unit*(co*x+si*z);screen[k+1]=oy-unit*xyz[j+1];screen[k+2]=co*z-si*x;
      const diffuse=.88+.14*clamp((-.46*nx+.36*ny+.81*nz+.37)/1.37),h=clamp(-.24*nx+.23*ny+.94*nz);
      const h2=h*h,h4=h2*h2,glint=sites[i].gloss*h4*h4*h;
      screen[k+3]=rgb[j]*diffuse+glint*16;screen[k+4]=rgb[j+1]*diffuse+glint*27;screen[k+5]=rgb[j+2]*diffuse+glint*24;
    }
    left.fill(w);right.fill(-1);
    for(let i=0;i<around;i++){
      const p=i*6,q=((i+1)%around)*6,x=screen[p],y=screen[p+1],dy=screen[q+1]-y;if(Math.abs(dy)<1e-7)continue;
      const sx=(screen[q]-x)/dy,lo=Math.max(0,Math.ceil(Math.min(y,screen[q+1])-.5)),hi=Math.min(h,Math.ceil(Math.max(y,screen[q+1])-.5));
      for(let py=lo;py<hi;py++){
        const edge=x+(py+.5-y)*sx-.5;
        left[py]=Math.min(left[py],Math.ceil(edge));right[py]=Math.max(right[py],Math.floor(edge));
      }
    }
    function face(p:number,q:number,s:number){
      const x=screen[p],y=screen[p+1],ux=screen[q]-x,uy=screen[q+1]-y,vx=screen[s]-x,vy=screen[s+1]-y,det=ux*vy-uy*vx;
      if(det>=-1e-7)return;
      const x0=Math.max(0,Math.ceil(x+Math.min(0,ux,vx)-.5)),x1=Math.min(w-1,Math.floor(x+Math.max(0,ux,vx)-.5));
      const y0=Math.max(0,Math.ceil(y+Math.min(0,uy,vy)-.5)),y1=Math.min(h-1,Math.floor(y+Math.max(0,uy,vy)-.5));
      for(let py=y0;py<=y1;py++)for(let px=Math.max(x0,left[py]),end=Math.min(x1,right[py]);px<=end;px++){
        const dx=px+.5-x,dy=py+.5-y,t=(dx*vy-dy*vx)/det,l=(ux*dy-uy*dx)/det,n=1-t-l;if(n<0||t<0||l<0)continue;
        const i=py*w+px,z=n*screen[p+2]+t*screen[q+2]+l*screen[s+2];if(z<depth[i])continue;
        depth[i]=z;const j=4*i;
        rgba[j]=n*screen[p+3]+t*screen[q+3]+l*screen[s+3];rgba[j+1]=n*screen[p+4]+t*screen[q+4]+l*screen[s+4];
        rgba[j+2]=n*screen[p+5]+t*screen[q+5]+l*screen[s+5];rgba[j+3]=255;
      }
    }
    for(let row=0;row<bands;row++)for(let j=0;j<around;j++){
      const p=(row*around+j)*6,q=(row*around+(j+1)%around)*6,c=p+6*around,d=q+6*around;
      face(p,q,c);face(q,d,c);
    }
  }
  return paint;
}
