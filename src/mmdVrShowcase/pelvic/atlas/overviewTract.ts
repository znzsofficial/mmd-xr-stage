import type {CanalContact} from './canalContact';
import {canalBands,canalStation} from './canalGeometry';
import {canalY,clamp,ENTRY,grid,smooth,STOP,stride,type Mesh,type V} from './model';

// One small C-section below the corpus, not a second instance of the enlarged
// vaginal dissection. Both exposed cut edges turn back into the posterior bed.
// Rows coincide with every other measured station. The last rows wrap the neck
// above the end of the measured path and are never fitted to the shaft.
const step=2,bands=canalBands/step,span=STOP-ENTRY,TAU=2*Math.PI;
const {abs,cos,sin,sqrt}=Math;
function normals(m:Mesh,a:Float32Array,rows:number){
  const pitch=m.cols*stride;
  for(let r=0,i=0;r<rows;r++)for(let c=0;c<m.cols;c++,i+=stride){
    const l=c?i-stride:i,h=c+1<m.cols?i+stride:i,b=r?i-pitch:i,t=r+1<m.rows?i+pitch:i;
    const dx=a[h]-a[l],dy=a[h+1]-a[l+1],dz=a[h+2]-a[l+2],ex=a[t]-a[b],ey=a[t+1]-a[b+1],ez=a[t+2]-a[b+2];
    const x=dy*ez-dz*ey,y=dz*ex-dx*ez,z=dx*ey-dy*ex,k=1/(Math.hypot(x,y,z)||1);
    a[i+3]=x*k;a[i+4]=y*k;a[i+5]=z*k;
  }
}
export function createOverviewTract(){
  // Each cross section runs from left cut, across the mucosa, around the
  // right cut, then back on the external coat. The narrow, folded lumen opens
  // *within* the wall; its much less compliant outer coat retains thickness.
  const mesh=grid(56,bands,false,0,(u,v)=>{
    const t=canalStation(Math.round(v*bands)*step),vault=smooth(.81,1.24,t);
    const inner=u<=.43,outer=u>=.5&&u<=.93;
    const k=inner?u/.43:outer?1-(u-.5)/.43:u<.5?1:0;
    const layer=inner?0:outer?1:u<.5?(u-.43)/.07:(1-u)/.07;
    const mouth=.84+.10*sin(t*5.7)+.35*vault;
    const angle=mouth+(TAU-2*mouth)*k+.058*sin(8*t+.7)*cos(k*Math.PI);
    const ridge=(.5+.5*cos(t*39+1.8*cos(2*angle)+.88*sin(t*7+angle)))**3*(1-vault);
    const rim=sin(layer*Math.PI),light=inner?ridge*24:outer?4*cos(angle*5+t*5):14*rim+7*ridge;
    const pigment:V=inner?[157,75,92]:outer?[178,111,125]:[221,146,137];
    const z=ENTRY+t*span+.10*(1-smooth(0,.12,t))*(.3+.8*sin(angle)**2+.42*layer)-.29*smooth(1,1.29,t)*(.5+.5*cos(angle));
    // Temporarily store the material coordinates; prepare() replaces positions
    // in its own scratch. Slot 11 is the wetness used by the common lighting.
    return {p:[angle,layer,z],center:ridge,c: [pigment[0]+light,pigment[1]+light*.76,pigment[2]+light*.70],lumen:inner?.72:outer?.15:.31};
  });
  const rest=mesh.a.slice(),live=rest.slice(),rings=new Float32Array(mesh.rows*5);
  // Rest coordinate data for radial fits: world radial direction and radius
  // at the undisturbed inner surface. No depth/pressure slider in this path.
  const bed=new Float32Array(mesh.rows*mesh.cols*3);
  let lastCut=NaN,tipZ=ENTRY;
  return {mesh,get tipZ(){return tipZ;},prepare(cut:number,contact:CanalContact){
    if(cut!==lastCut){lastCut=cut;
      for(let r=0,i=0,j=0;r<mesh.rows;r++){
        const t=canalStation(r*step),vault=smooth(.81,1.24,t),c=canalY(t),rolled=1-smooth(.015,.14,t);
        for(let col=0;col<mesh.cols;col++,i+=stride,j+=3){
          const angle=mesh.a[i]+cut,nx=sin(angle),ny=cos(angle),layer=mesh.a[i+1],ridge=mesh.a[i+9];
          const rx=.39+.065*rolled+.64*vault,ry=.14+.038*rolled+.59*vault;
          const inner=1/Math.hypot(nx/(rx-.074*ridge),ny/(ry-.050*ridge));
          const coat=(.39+.14*nx*nx+.08*sin(Math.min(t,1)*Math.PI)+.055*rolled)*(1-.49*vault);
          const outer=1/Math.hypot(nx/rx,ny/ry)+coat-.13*smooth(1.14,1.29,t);
          const radius=inner+(outer-inner)*layer+.032*sin(layer*Math.PI);
          bed[j]=nx;bed[j+1]=ny;bed[j+2]=inner;
          rest[i]=radius*nx;rest[i+1]=c+radius*ny;
        }
      }normals(mesh,rest,mesh.rows);
    }
    if(!contact.active){tipZ=ENTRY;return rest;}
    let lastRow=-1;const count=contact.rings((row,z,x,y,rx,ry,shear)=>{
      tipZ=z;
      const station=canalStation(row);
      if(row%step||abs(z-(ENTRY+span*station))>1e-5)return; // skip the off-grid nozzle
      const r=row/step,i=r*5;rings[i]=x;rings[i+1]=y-canalY(station);rings[i+2]=rx;rings[i+3]=ry;rings[i+4]=shear;lastRow=r;
    });
    if(count===0)return rest;
    live.set(rest);
    for(let r=0,i=0,j=0;r<=lastRow;r++){
      const k=r*5,rx=rings[k+2],ry=rings[k+3],shear=rings[k+4],ox=rings[k]/rx,oy=(rings[k+1]-shear*rings[k])/ry;
      for(let col=0;col<mesh.cols;col++,i+=stride,j+=3){
        const nx=bed[j],ny=bed[j+1],dx=nx/rx,dy=(ny-shear*nx)/ry,a=dx*dx+dy*dy,b=dx*ox+dy*oy;
        // Intersect this tissue ray with the actual translated, sheared mould
        // ellipse. Missed rays and vacated rows keep their original folds.
        const disc=b*b-a*(ox*ox+oy*oy-1);if(disc<=0)continue;
        const push=(b+sqrt(disc))/a-bed[j+2];if(push<=0)continue;
        const weight=1-.34*mesh.a[i+1],d=weight*push;
        live[i]+=d*nx;live[i+1]+=d*ny;
        const stretch=clamp(push*2.4)*weight;live[i+6]+=stretch*12;live[i+7]+=stretch*13;live[i+8]+=stretch*9;
      }
    }normals(mesh,live,Math.min(mesh.rows,lastRow+2));return live;
  }};
}
