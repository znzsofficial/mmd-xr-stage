// Horizontal octagonal sections of one fixed, solid scenic cabinet, in metres.
// Each ring joins the next: even the stone-to-iron transition has no stacked lids.
import type {V} from './masonry';

export const CABINET={x:2.72,z:-6.39,yaw:-.82};
export const rings=[
  [0,.50],[.09,.50],[.145,.455],[.19,.455],[.235,.415], // cut-stone socle
  [.29,.415],[.34,.382],[1.59,.382],[1.64,.42],[1.70,.42], // enamel and cornice
  [1.755,.39],[2.045,.195],[2.085,.17], // hipped pavilion roof, level crown
] as const;
export const outline=[[-.64,1],[.64,1],[1,.54],[1,-.54],[.64,-1],[-.64,-1],[-1,-.54],[-1,.54]] as const;
const depth=.76,c=Math.cos(CABINET.yaw),s=Math.sin(CABINET.yaw);
export const cabinetPoint=(u:number,y:number,v:number):V=>[CABINET.x+c*u+s*v,y,CABINET.z-s*u+c*v];
export function corner(row:number,i:number){const [y,r]=rings[row],[u,v]=outline[i%outline.length];return cabinetPoint(u*r,y,v*r*depth);}
const planes=outline.map(([a,b],i)=>{const [x,z]=outline[(i+1)%outline.length],u=b-z,v=(x-a)/depth;return {u,v,k:u*a+v*b*depth};});
function local(x:number,z:number){x-=CABINET.x;z-=CABINET.z;return [c*x-s*z,s*x+c*z] as const;}
const plinth=outline.map((_,i)=>corner(0,i));
const extentX=Math.max(...plinth.map(p=>Math.abs(p[0]-CABINET.x))),extentZ=Math.max(...plinth.map(p=>Math.abs(p[2]-CABINET.z)));
export function nearCabinet(x:number,z:number,pad:number,standingColumn:boolean){
  if(Math.abs(x-CABINET.x)>extentX+pad||Math.abs(z-CABINET.z)>extentZ+pad)return false;
  // The player's triangle sampler uses an axis-aligned square in world XZ.
  // A circular margin can let its corner step onto the low stone bevel.
  const [a,b]=local(x,z);return planes.every(({u,v,k})=>{
    const support=standingColumn?Math.abs(c*u+s*v)+Math.abs(c*v-s*u):Math.hypot(u,v);
    return u*a+v*b<=k*rings[0][1]+pad*support;
  });
}
export function cabinetOccludes(from:{x:number;y:number;z:number},x:number,y:number,z:number){
  if(Math.min(from.x,x)>CABINET.x+.64||Math.max(from.x,x)<CABINET.x-.64||Math.min(from.z,z)>CABINET.z+.64||Math.max(from.z,z)<CABINET.z-.64)return false;
  const [x0,z0]=local(from.x,from.z),[x1,z1]=local(x,z);
  for(let j=1;j<rings.length;j++){
    const [lo,r]=rings[j-1],[hi,R]=rings[j];if(Math.min(from.y,y)>hi||Math.max(from.y,y)<lo)continue;
    let a=0,b=1;
    function clip(h:number,k:number){if(h>0&&k>0)return false;if(h>0)a=Math.max(a,h/(h-k));if(k>0)b=Math.min(b,h/(h-k));return a<=b;}
    if(!clip(lo-from.y,lo-y)||!clip(from.y-hi,y-hi))continue;
    const slope=(R-r)/(hi-lo),r0=r+(from.y-lo)*slope,r1=r+(y-lo)*slope;
    if(planes.every(({u,v,k})=>clip(u*x0+v*z0-k*r0,u*x1+v*z1-k*r1)))return true;
  }
  return false;
}
