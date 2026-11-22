import {Vector3} from 'three';
import type {PelvicSample} from '../stateTypes';
import {pelvicCenterline,projectDepth,rod,rodRadii,tangent} from '../path';
import {canalBands,canalStation,vaultEnd,type WallSide} from './canalGeometry';
import {canalY,clamp,ENTRY,STOP,stride,type Mesh} from './model';

// Horizontal and anterior magnifications are the same as the actual outlet
// marker. Never substitute the displayed depth, the target, or a pressure %.
export const canalAspectX=.83,canalAspectY=.55;
const spacing=vaultEnd/canalBands,span=STOP-ENTRY;
const segmentLengths=rod.slice(1).map((p,i)=>p.distanceTo(rod[i]));
const stations=Array.from({length:canalBands+1},(_,i)=>{
  const t=canalStation(i),c=pelvicCenterline({lengthM:1},t),d=tangent({lengthM:1},t,new Vector3());
  return {t,y:c.y,z:c.z,dy:d.y,dz:d.z};
});
// Row records: actor-local material X,Y; width radius; perpendicular height
// radius; shear of the projected oblique shaft section. One outward→inward
// pass through the actual mould, amortised O(rows + shaft points).
const channels=5;
export function createCanalContact(){
  const rows=new Float32Array(stations.length*channels),next=rows.slice(),tip=new Vector3(),point=new Vector3(),normal=new Vector3();let end=-1,last=-1;
  const terminal=rows.length-channels; // above the stop; reserved for the exact nozzle section
  function update(s:PelvicSample|null|undefined,parked=false){
    if(last<0&&(parked||!s?.outletInside))return false;
    let tipT=-1,count=-1;next.fill(0);
    const ps=s?.shaft;
    if(!parked&&s?.outletInside&&Number.isFinite(s.lengthM)&&s.lengthM>0&&Number.isFinite(s.radiusM)&&s.radiusM>0&&
      ps?.length===rod.length&&ps.every(p=>p.every(Number.isFinite))&&s.tip.every(Number.isFinite)){
      tip.fromArray(s.tip);const depth=projectDepth(s,tip);
      if(depth>0&&depth<=s.lengthM+1e-6&&tip.distanceToSquared(point.fromArray(ps.at(-1)!))<1e-10){
        tipT=clamp(depth/s.lengthM);let j=1;
        for(let i=0;i<stations.length;i++){
          const {t,y,z,dy,dz}=stations[i];if(t>tipT)break;
          const cy=y*s.lengthM,cz=z*s.lengthM;
          while(j<ps.length&&((ps[j][1]-cy)*dy+(ps[j][2]-cz)*dz)<-1e-9)j++;
          if(j===ps.length)break;
          const a=ps[j-1],b=ps[j],dx=b[0]-a[0],ey=b[1]-a[1],ez=b[2]-a[2],axial=ey*dy+ez*dz;
          const start=(a[1]-cy)*dy+(a[2]-cz)*dz;
          if(start>1e-7||axial<=1e-8){count=-1;break;}
          const k=clamp(-start/axial),scale=Math.hypot(dx,ey,ez)/segmentLengths[j-1];
          const r=(rodRadii[j-1]+k*(rodRadii[j]-rodRadii[j-1]))*scale/s.radiusM;
          const sx=dx/axial,sy=(-dz*ey+dy*ez)/axial,xx=1+sx*sx,idx=i*channels;
          next[idx]=canalAspectX*(a[0]+k*dx)/s.radiusM;
          next[idx+1]=canalY(t)+canalAspectY*(-dz*(a[1]+k*ey-cy)+dy*(a[2]+k*ez-cz))/s.radiusM;
          next[idx+2]=r*canalAspectX*Math.sqrt(xx);
          next[idx+3]=r*canalAspectY*Math.sqrt(1+sy*sy/xx);
          next[idx+4]=canalAspectY/canalAspectX*sx*sy/xx;count=i;
        }
        if(count>=0){
          const r=rodRadii.at(-1)!*point.fromArray(ps.at(-2)!).distanceTo(tip)/segmentLengths.at(-1)!/s.radiusM;
          pelvicCenterline(s,depth,point);tangent(s,depth,normal);
          next[terminal]=canalAspectX*tip.x/s.radiusM;
          next[terminal+1]=canalY(tipT)+canalAspectY*(-normal.z*(tip.y-point.y)+normal.y*(tip.z-point.z))/s.radiusM;
          next[terminal+2]=canalAspectX*r;next[terminal+3]=canalAspectY*r;
        }
      }
    }
    tipT=count===-1?-1:tipT;
    let changed=last!==count||Math.abs(end-tipT)>1e-7;
    for(let i=0;!changed&&i<rows.length;i++)changed=Math.abs(next[i]-rows[i])>1e-6;
    if(changed){rows.set(next);end=tipT;last=count;}return changed;
  }
  function offset(x:number,inner:number,z:number,side:WallSide){
    const t=Math.max(0,(z-ENTRY)/span);
    if(t>end||last<0)return 0;
    const f=t/spacing,i=Math.min(last,Math.floor(f)),k=i*channels;
    if(!rows[k+2])return 0;
    // Interpolate between actual cuts. On the final partial interval taper
    // to the physical nozzle rather than extending a ring past its station.
    const j=i===last?terminal:k+channels,u=i===last?clamp((t-i*spacing)/Math.max(1e-8,end-i*spacing)):f-i;
    const cx=rows[k]+u*(rows[j]-rows[k]),cy=rows[k+1]+u*(rows[j+1]-rows[k+1]);
    const rx=rows[k+2]+u*(rows[j+2]-rows[k+2]),du=(x-cx)/rx;
    const edge=Math.abs(du);if(edge>=1.26)return 0;
    const ry=rows[k+3]+u*(rows[j+3]-rows[k+3]),tilt=rows[k+4]+u*(rows[j+4]-rows[k+4]);
    // Soft cuff around the tangent of the cylinder rather than a vertical
    // crease at its side. Support vanishes within one quarter of a radius.
    const kSide=clamp((1.26-edge)/.46),soft=kSide*kSide*(3-2*kSide);
    const touching=side*(cy+tilt*(x-cx)-inner)*soft+ry*Math.max(.58*soft,Math.sqrt(Math.max(0,1-du*du)));
    return side*Math.max(0,touching);
  }
  return {update,offset,get active(){return last>=0;},rings(fn:(i:number,z:number,x:number,y:number,rx:number,ry:number,shear:number)=>void){
    if(last<0)return 0;
    for(let i=0;i<=last+1;i++){const k=i>last?terminal:i*channels;
      fn(i,ENTRY+span*(i>last?end:i*spacing),rows[k],rows[k+1],rows[k+2],rows[k+3],rows[k+4]);}
    return last+2;
  }};
}
export type CanalContact=ReturnType<typeof createCanalContact>;
/** Immutable baked rest pose; live scratch is owned by just this painter. A
 * withdrawal starts at rest again and only the remaining shaft is impressed. */
export function fitWall(mesh:Mesh,side:WallSide,contact:CanalContact,out:Float32Array){
  const a=mesh.a;out.set(a);
  let first=mesh.rows,last=-1;
  for(let row=0,i=0;row<mesh.rows;row++)for(let c=0;c<mesh.cols;c++,i+=stride){
    const dy=contact.offset(a[i],a[i+9],a[i+2],side)*a[i+10];if(!dy)continue;
    out[i+1]+=dy;
    // The stretched mucosa and cut edge catch a little light, locally. This
    // weight comes from displaced tissue, not a second artist pressure knob.
    const stretch=clamp(Math.abs(dy)*2.6)*a[i+11];out[i+6]+=9*stretch;out[i+7]+=12*stretch;out[i+8]+=6*stretch;
    first=Math.min(row,first);last=Math.max(row,last);
  }
  // Re-light the displaced crest, not just the old pigment at a translated
  // position. Normals outside the touched strip come from the baked mesh.
  for(let row=Math.max(0,first-1);row<=Math.min(mesh.rows-1,last+1);row++)for(let c=0;c<mesh.cols;c++){
    const i=(row*mesh.cols+c)*stride,l=i-(c?stride:0),r=i+(c+1<mesh.cols?stride:0),d=i-(row?mesh.cols*stride:0),h=i+(row+1<mesh.rows?mesh.cols*stride:0);
    const dx=out[r]-out[l],dy=out[r+1]-out[l+1],dz=out[r+2]-out[l+2],ex=out[h]-out[d],ey=out[h+1]-out[d+1],ez=out[h+2]-out[d+2];
    const nx=dy*ez-dz*ey,ny=dz*ex-dx*ez,nz=dx*ey-dy*ex,k=1/(Math.hypot(nx,ny,nz)||1);
    out[i+3]=nx*k;out[i+4]=ny*k;out[i+5]=nz*k;
  }
  return out;
}
