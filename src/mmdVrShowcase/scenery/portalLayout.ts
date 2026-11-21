import {portalRooms} from './catalog';
import {COURT_PIERS} from './ObservatoryLayout';

// Two wings around the landing rose, with a clear aisle under the old orrery.
// Atlas cells follow the same destination order as the doorway geometry.
export const courtPortals=portalRooms.map((room,cell)=>{
  const a=[-18,18,-43,43,-68,68][cell]*Math.PI/180;
  const x=4.42*Math.sin(a),z=-4.42*Math.cos(a);
  return {room,cell,x,z,yaw:Math.atan2(-x,2.4-z),w:1.44,d:.38,top:2.45};
});
type Point={x:number;y:number;z:number};
type Obstacle={x:number;z:number;yaw:number;w:number;d:number;top:number};
const piers=COURT_PIERS.map((p,i)=>({...p,yaw:0,top:[2.55,2.55,1.9,2.42,1.74,2.1][i]}));
function crosses(from:Point,to:Point,b:Obstacle){
  const c=Math.cos(b.yaw),s=Math.sin(b.yaw),dx=from.x-b.x,dz=from.z-b.z,vx=to.x-from.x,vz=to.z-from.z;
  let lo=0,hi=1;
  function axis(p:number,v:number,l:number,r:number){
    if(Math.abs(v)<1e-8)return p>=l&&p<=r;
    const a=(l-p)/v,h=(r-p)/v;lo=Math.max(lo,Math.min(a,h));hi=Math.min(hi,Math.max(a,h));return lo<=hi;
  }
  return axis(c*dx-s*dz,c*vx-s*vz,-b.w/2,b.w/2)&&axis(s*dx+c*dz,s*vx+c*vz,-b.d/2,b.d/2)&&axis(from.y,to.y-from.y,0,b.top);
}
export const portalPlacementSight=(from:Point,x:number,y:number,z:number)=>!courtPortals.some(p=>crosses(from,{x,y,z},p));
export function canReadPortal(p:typeof courtPortals[number],from:Point,hit:Point){
  // Only the inscribed face in the landing court opens; the back is stone.
  const dx=from.x-p.x,dz=from.z-p.z;
  return from.y>.02 && Math.hypot(from.x,from.z)<7 && dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw)>.12 &&
    !piers.some(b=>crosses(from,hit,b))&&!courtPortals.some(other=>other!==p&&crosses(from,hit,other));
}
