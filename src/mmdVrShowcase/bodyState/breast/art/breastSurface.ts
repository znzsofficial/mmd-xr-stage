import { chest, torsoWidth } from './figure';
import { cutBounds, TAU, type Side, type V } from './geometry';
import { clamp, grid, smooth, VERTEX_STRIDE, type Mesh } from './mesh';
import { R, W, Y } from './section';

export interface BreastMesh extends Mesh {
  radii: readonly number[];
}

const ANGULAR_SEGMENTS=56;
const radii:readonly number[]=[.0004,.018,.030,.046,.057,.071,.088,.108,.132,.154,.18,.208,.235,.268,.30,.34,.38,.42,.46,.50,.54,.58,.62,.66,.70,.74,.78,.82,.86,.895,.93,.96,.984,.998,1];
export const settleWeight=(r:number,v:number)=>.034*smooth((.94-r)/.64)*(.42+.58*smooth((.45-v)/1.1));

export function mound(side:Side,full:number):BreastMesh {
  const rx=.449+.042*full, ry=.383+.064*full, projection=.423+.266*full;
  const cols=ANGULAR_SEGMENTS+1,angles:Array<[number,number,number]>=[];
  for(let i=0;i<cols;i++){const a=i/ANGULAR_SEGMENTS*TAU;angles.push([Math.cos(a),Math.sin(a),a]);}
  const mesh=grid(radii.length,cols,(t,j)=>{
    const [u,v]=angles[Math.round(t*ANGULAR_SEGMENTS)],r=radii[Math.round(j*(radii.length-1))],tail=Math.max(0,u*v),free=1-r*r;
    const baseY=.022+ry*r*v*(v>0?1.31:1),x0=.431+r*((u<0?Math.min(.422,rx):Math.min(rx,torsoWidth(baseY)-.442))*u+.012*tail);
    // Lateral tissue sweeps past its narrower insertion and returns under
    // the arm. Its broad lower pole is not the end of a hanging ellipsoid.
    const skirt=(.441+.121*full)*r*free**.69*Math.max(0,u)**1.12*(1+.13*Math.max(0,-v))*smooth((r-.16)/.43)*(1+.012*side);
    // A static weight-bearing lower pole, including at t=0. The root is
    // fixed; the upper skin descends into a shallower ramp than the lower fold.
    const load=(.137+.087*full+side*.009)*free**1.45;
    const y=baseY-load-.191*r*free*Math.max(0,-v)+.020*tail*r-.029*r*free*Math.max(-u,0)*Math.max(.27-v,0);
    const papilla=1-smooth((r-.027)/.078),dome=.009*Math.exp(-((r/.181)**2));
    const x=x0+free*(.036+.023*full)+skirt+.006*papilla,a=Math.asin(clamp(x0/torsoWidth(baseY)));
    const z=chest(a,baseY)[2]+.0016+projection*free**(.93+.34*v)*(1-.18*r*Math.max(0,v))+dome+.019*papilla;
    return [side*x,y-.004*papilla,z];
  },(t,j)=>{
    const r=radii[Math.round(j*(radii.length-1))],[u,v,a]=angles[Math.round(t*ANGULAR_SEGMENTS)];
    // Pigment feathers into the surrounding skin on the surface, never a
    // flat disc pasted onto a camera-facing billboard.
    const radius=r*(1+.058*u-.030*v+side*.018),edge=1-smooth((radius-.128)/.130),core=Math.exp(-((radius/.187)**2));
    const areola=.70*edge+.30*core,tip=1-smooth((radius-.029)/.049);
    const warmth=(1-r*r)*2.5,vary=.82*areola*(Math.sin(2.4*a+17*r+side)+.54*Math.cos(4*a-19*r));
    const blush=(1-r*r)*(.48+.32*v)*6;
    const glint=7*Math.exp(-(((u*r+.014*side)/.029)**2)-((v*r-.022)/.023)**2),foot=Math.exp(-(((radius-.07)/.025)**2))*(.56-.44*v);
    return [248+warmth-19*areola-5*tip+vary+glint,211+warmth-32*areola-10*tip+vary-blush+glint-3*foot,192+warmth-25*areola-8*tip+vary-blush*.6+glint-2*foot];
  });
  // Blend tangent normals onto the fixed rib cage at the insertion. A
  // continuous upper-pole highlight is more convincing than a hard oval
  // separating two differently lit meshes. Preserve the lower fold.
  const d=mesh.data;
  for(let j=0;j<radii.length;j++)for(let i=0;i<mesh.cols;i++){
    const k=(j*mesh.cols+i)*VERTEX_STRIDE,r=radii[j],v=angles[i][1],x=d[k],y=d[k+1],w=torsoWidth(y),a=Math.asin(Math.max(-1,Math.min(1,x/w)));
    // The inferior/posterior return tucks into the flank. Fade the normal at
    // this actual junction to prevent a rose shadow ending in a cut triangle.
    const seam=r>.68&&Math.abs(x)<w&&v<-.12?(1-smooth((d[k+2]-chest(a,y)[2]-.012)/.13))*smooth((-.12-v)/.51):0;
    const mix=Math.max(.91*seam,smooth((r-.68)/.32)*smooth((v+.83)/.97));
    if(mix===0)continue;
    const u=chest(a+.002,y),l=chest(a-.002,y),h=chest(a,y+.002),b=chest(a,y-.002);
    const dx=u[0]-l[0],dz=u[2]-l[2],dy=h[1]-b[1],nx=-dz*dy,ny=dz*(h[0]-b[0])-dx*(h[2]-b[2]),nz=dx*dy;
    const mag=Math.hypot(nx,ny,nz)||1;
    const sx=(1-mix)*d[k+3]-side*mix*nx/mag,sy=(1-mix)*d[k+4]-side*mix*ny/mag,sz=(1-mix)*d[k+5]-side*mix*nz/mag;
    const norm=Math.hypot(sx,sy,sz)||1;d[k+3]=sx/norm;d[k+4]=sy/norm;d[k+5]=sz/norm;
  }
  return {...mesh,radii};
}

export function breastPoint(mesh:BreastMesh,u:number,v:number):V{
  const {cols,radii,data}=mesh,segments=cols-1;
  const r=Math.min(.999,Math.hypot(u,v)),theta=(Math.atan2(v,u)/TAU+1)%1*segments,i=Math.min(segments-1,Math.floor(theta));
  let j=1;while(j<radii.length-1&&radii[j]<r)j++;
  const f=clamp((r-radii[j-1])/(radii[j]-radii[j-1])),g=theta-i,p=((j-1)*cols+i)*VERTEX_STRIDE,off=cols*VERTEX_STRIDE;
  const at=(k:number)=>((1-g)*data[p+k]+g*data[p+VERTEX_STRIDE+k])*(1-f)+((1-g)*data[p+off+k]+g*data[p+off+VERTEX_STRIDE+k])*f;
  return [at(0),at(1),at(2)];
}

const startAngle=(r:number)=>Math.acos(.04+.68*r);
export const cutAt=(mesh:BreastMesh,r:number,h:number):V=>{
  const a=startAngle(r),x=r*Math.cos(a),v=r*Math.sin(a),lo=breastPoint(mesh,x,-v),hi=breastPoint(mesh,x,v);
  return [lo[0]+h*(hi[0]-lo[0]),lo[1]+h*(hi[1]-lo[1]),lo[2]+h*(hi[2]-lo[2])];
};

export function cutMound(mesh:BreastMesh):{skin:BreastMesh;face:Mesh}{
  // Trim the lateral sector from the same rounded mesh, keeping its original
  // smooth skin normals. The exposed surface shares both actual cut edges.
  const {cols,radii}=mesh,segments=cols-1;
  const data=new Float32Array(mesh.data.length),source=mesh.data;
  for(let j=0;j<radii.length;j++){
    const r=radii[j],alpha=startAngle(r);
    for(let i=0;i<cols;i++){
      const t=(alpha+(TAU-2*alpha)*i/segments)*segments/TAU,k=Math.floor(t),q=t-k,d=(j*cols+i)*VERTEX_STRIDE,a=(j*cols+k)*VERTEX_STRIDE;
      for(let n=0;n<VERTEX_STRIDE;n++)data[d+n]=source[a+n]+(source[a+VERTEX_STRIDE+n]-source[a+n])*q;
    }
  }
  const face=grid(radii.length,5,(h,j)=>cutAt(mesh,radii[Math.round(j*(radii.length-1))],h),(h,j)=>{
    const r=radii[Math.round(j*(radii.length-1))],s=1-r**1.60,[hi,lo]=cutBounds(s);
    return [s*(W-1),Y-(lo+(hi-lo)*h)*R,1];
  });
  face.material='section';
  return {skin:{indices:mesh.indices,data,cols,radii},face};
}
