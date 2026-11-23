import {Box3,Ray,Vector3} from 'three';
import type {ReaderBox} from './surveyHardware';

export function surveyOccupancy(boxes:readonly ReaderBox[]){
  const solids=boxes.map(box=>({...box,inverse:box.rotation.clone().invert(),span:box.half.length()}));
  const at=new Vector3(),axis=new Vector3(),half=new Vector3(),p=new Vector3(),ray=new Ray(),bounds=new Box3();
  return (from:Vector3,unit:Vector3,len:number,r:number)=>{
    for(const b of solids){
      if(from.distanceToSquared(b.center)>(len+r+b.span)**2)continue;
      at.subVectors(from,b.center).applyQuaternion(b.inverse);axis.copy(unit).applyQuaternion(b.inverse);half.copy(b.half);
      if(r){ // A flat-ended body, radius in its own horizontal plane.
        half.x+=r*Math.sqrt(Math.max(0,1-axis.x**2));half.y+=r*Math.sqrt(Math.max(0,1-axis.y**2));half.z+=r*Math.sqrt(Math.max(0,1-axis.z**2));
      }
      bounds.min.copy(half).negate();bounds.max.copy(half);
      if(bounds.containsPoint(at)||len>0&&ray.set(at,axis).intersectBox(bounds,p)&&p.distanceToSquared(at)<=len*len)return true;
    }
    return false;
  };
}
