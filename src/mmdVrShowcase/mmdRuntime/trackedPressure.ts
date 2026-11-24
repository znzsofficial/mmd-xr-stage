import {Matrix4,Vector3} from 'three';
import {handContactShape} from '../xr/contact/handContactProfile';

export const FINGERTIP_MASK = 0xfbe; // all twelve slots except the two wrists

/** Signed sphere/hand overlap in displayed world metres. Uses the same centred
 * palm boxes and Y-axis finger capsules as Bullet, after tracking recovery. */
export class TrackedPressure {
  private inverse=Array.from({length:12},()=>new Matrix4());
  private shapes=Array.from({length:12},(_,i)=>handContactShape(i,.033));
  private refRadius=.033;
  private local=new Vector3();
  private delta=new Vector3();
  private poses:readonly Matrix4[]=[];
  mask=0;
  prepare(poses:readonly Matrix4[],mask:number,radius:number){
    this.poses=poses;this.mask=mask&((1<<Math.min(12,poses.length))-1);
    if(radius!==this.refRadius){this.refRadius=radius;this.shapes=this.shapes.map((_,i)=>handContactShape(i,radius));}
    for(let i=0;i<12;i++)if(this.mask&(1<<i)) this.inverse[i].copy(poses[i]).invert();
  }
  readFinger(slot:number,start:Vector3,end:Vector3){
    if(!(this.mask & FINGERTIP_MASK & (1<<slot)))return 0;
    const {size:[radius,length]}=this.shapes[slot],pose=this.poses[slot];
    start.set(0,-length/2,0).applyMatrix4(pose);end.set(0,length/2,0).applyMatrix4(pose);
    return radius;
  }
  overlap(center:Vector3,radius:number,dir:Vector3,tipBroadGain?:ArrayLike<number>){
    let best=0;
    for(let i=0;i<12;i++)if(this.mask&(1<<i)){
      const q=this.local.copy(center).applyMatrix4(this.inverse[i]),{type,size:[x,y,z]}=this.shapes[i],d=this.delta.copy(q);
      let margin=0;
      if(type==='box')d.set(q.x-Math.max(-x,Math.min(x,q.x)),q.y-Math.max(-y,Math.min(y,q.y)),q.z-Math.max(-z,Math.min(z,q.z)));
      else {d.y-=Math.max(-y/2,Math.min(y/2,q.y));margin=x;}
      let depth=radius+margin-d.length();
      // Only a tip on a supported surface yields to the local pass. Deep
      // presses, palms and unsupported regions keep the broad response.
      if(tipBroadGain && margin && depth>0) depth*=tipBroadGain[i];
      if(depth>best){best=depth;dir.copy(d).transformDirection(this.poses[i]);}
    }
    return best;
  }
}
