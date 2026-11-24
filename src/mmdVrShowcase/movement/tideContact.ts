import {Vector3} from 'three';
import {tideCentre,tideChart,tideSolid} from '../scenery/planet/tideLayout';

const sample=new Vector3(),eye=new Vector3();
/** World-vertical rock columns, but the player stands along the local lunar
 * vertical. Cover the actual tracked sole–eye segment, including a lateral
 * room-scale offset. The motor sole itself remains a separate probe. */
export function tideBodyBlocked(foot:Vector3,up:Vector3,offset:Vector3,h=offset.dot(up)){
  const dx=offset.x-h*up.x,dz=offset.z-h*up.z,dy=offset.y-h*up.y;
  const x=foot.x-tideCentre.x,z=foot.z-tideCentre.z;
  const reachX=.70+Math.abs(dx)+Math.abs(up.x*h),reachZ=.70+Math.abs(dz)+Math.abs(up.z*h);
  if(x<tideChart.minX-reachX||x>tideChart.maxX+reachX||z<tideChart.minZ-reachZ||z>tideChart.maxZ+reachZ)return false;
  if(tideSolid(foot,.18,.02))return true;
  // Each small slice is enclosed by a +Y cylinder, even with tilted or
  // inverted up. Include the rounded top of the head in its last slice.
  const height=Math.max(.16,h),count=Math.max(1,Math.ceil(height*Math.hypot(up.x,up.z)/.09));
  const step=height/count,r=.16+.5*step*Math.hypot(up.x,up.z);
  for(let i=0;i<count;i++){
    const t=(i+.5)*step;
    sample.set(foot.x+dx+t*up.x,foot.y+dy+t*up.y-.5*Math.abs(step*up.y),foot.z+dz+t*up.z);
    if(tideSolid(sample,r,Math.abs(step*up.y)))return true;
  }
  sample.copy(foot).add(offset);sample.y-=.115;
  return tideSolid(sample,.115,.23);
}

/** Limit only a requested artificial eye lift. A tracked head is not moved
 * back when the visitor physically leans into the rock. */
export function tideEyeLift(foot:Vector3,up:Vector3,tracked:Vector3,requested:number){
  if(requested<=0)return requested;
  const n=Math.max(1,Math.ceil(requested/.05));
  for(let i=0;i<=n;i++){
    eye.copy(foot).add(tracked).addScaledVector(up,requested*i/n);eye.y-=.115;
    if(tideSolid(eye,.115,.23))return requested*Math.max(0,i-1)/n;
  }
  return requested;
}
