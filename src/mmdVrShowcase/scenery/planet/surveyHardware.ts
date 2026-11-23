import {Matrix4,Quaternion,Vector3} from 'three';

/** Metres in the instrument frame: +Y is up, +Z points down the incoming path.
 * In the inclined head's own frame z=0 is the printed front of the casting. */
export const readerFace={width:1.12,height:.50,depth:.082,lip:.016};
export const chipSeat={x:-.353,y:-.018,radius:.103,rise:.024};
export const dockFoot={radius:.26,bottom:-.104,top:.14};
const right=new Vector3(1,0,0);
export interface ReaderMount {base:Vector3;q:Quaternion;tilt:number;height:number;r:number;mineralRadius:number}
export interface ReaderBox {center:Vector3;half:Vector3;rotation:Quaternion}
export function headPoint(s:ReaderMount,x:number,y:number,z:number){
  return new Vector3(x,y,z).applyAxisAngle(right,s.tilt).add(new Vector3(0,s.height,s.r));
}
export function headBox(s:ReaderMount):ReaderBox{
  const {width,height,depth,lip}=readerFace;
  return {center:headPoint(s,0,0,-depth/2),half:new Vector3(width/2+lip,height/2+lip,depth/2),rotation:new Quaternion().setFromAxisAngle(right,s.tilt)};
}
export function armBoxes(s:ReaderMount):ReaderBox[]{
  return [-1,1].map(side=>{
    // The sockets enter opposite facets of the nine-sided mineral foot. On
    // coral the left-hand quartz leans over the middle: keep both arms outboard.
    const r=s.mineralRadius,heel=r?new Vector3(side*(r>.65?.255:.205),.12,r*.72):new Vector3(side*.14,.094,0);
    const tip=headPoint(s,side*.316,-.047,-readerFace.depth+.014);
    const up=tip.clone().sub(heel).normalize(),x=right.clone().projectOnPlane(up).normalize();
    return {center:heel.clone().lerp(tip,.5),half:new Vector3(.044,heel.distanceTo(tip)/2,.044),
      rotation:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,up,new Vector3().crossVectors(x,up)))};
  });
}
export function readerWorldBoxes(s:ReaderMount):ReaderBox[]{
  const boxes=[headBox(s),...armBoxes(s)];
  if(!s.mineralRadius){const {radius,bottom,top}=dockFoot;
    boxes.push({center:new Vector3(0,(top+bottom)/2,0),half:new Vector3(radius,(top-bottom)/2,radius),rotation:new Quaternion()});}
  return boxes.map(b=>({center:b.center.applyQuaternion(s.q).add(s.base),half:b.half,rotation:s.q.clone().multiply(b.rotation)}));
}
