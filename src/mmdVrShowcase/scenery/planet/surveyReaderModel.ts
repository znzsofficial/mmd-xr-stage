import {BufferGeometry,CylinderGeometry,Float32BufferAttribute} from 'three';
import {PaintedParts,box,turn} from '../../play/modelParts';
import {armBoxes,chipSeat,dockFoot,readerFace,type ReaderMount} from './surveyHardware';

type P=[number,number,number];
function quad(a:P,b:P,c:P,d:P){
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([...a,...b,...c,...d],3));
  g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return g;
}
function rim(edge:number,z:number):P[]{
  const w=readerFace.width/2+edge,h=readerFace.height/2+edge;
  return [[-w,-h,z],[w,-h,z],[w,h,z],[-w,h,z]];
}
/** The marked plane is the front cap, NOT a decal on a second front cap.
 * All metal bands meet edge-to-edge. The enclosed rear is 82 mm behind it. */
export function readerCasting(s:ReaderMount){
  const p=new PaintedParts(),{depth,lip}=readerFace;
  let back=rim(-.008,-depth);
  p.add(quad(back[3],back[2],back[1],back[0]),'#47625f');
  for(const [edge,z,color] of [[lip,-.061,'#53696c'],[lip,-.023,'#226267'],[.010,-.010,'#b98c60'],[0,0,'#cba676']] as const){
    const front=rim(edge,z);
    for(let i=0;i<4;i++){const j=(i+1)%4;p.add(quad(back[i],back[j],front[j],front[i]),color);}
    back=front;
  }
  return p.finish().rotateX(s.tilt).translate(0,s.height,s.r);
}
export function readerHardware(s:ReaderMount){
  const p=new PaintedParts();p.add(readerCasting(s));
  if(!s.mineralRadius){const r=dockFoot.radius;
    p.add(turn([[0,dockFoot.bottom],[r*.91,dockFoot.bottom],[r,.018],[r*.88,.061]],12),'#596c75');
    p.add(turn([[r*.88,.061],[r*.87,.088],[r*.77,.106]],12),'#b39069');
    p.add(turn([[r*.77,.106],[r*.75,dockFoot.top],[0,dockFoot.top]],12),'#38696a');
  }
  for(const b of armBoxes(s))p.add(box(0,0,0,2*b.half.x,2*b.half.y,2*b.half.z).applyQuaternion(b.rotation).translate(...b.center.toArray()),'#917b63');
  return p.finish();
}

/** Slice the octagonal upper facet itself into inlaid bands. There is no
 * separate stripe, overlay, or duplicated cap, even when both colours are lit. */
export function surveyChip(stripe:string,second?:string){
  const p=new PaintedParts(),{radius,rise}=chipSeat,top=.096,corner=top/Math.sqrt(2);
  p.add(new CylinderGeometry(top,radius,rise,8,1,true).rotateX(Math.PI/2).translate(0,0,rise/2),'#acbaa8');
  const at=(y:number)=>Math.abs(y)<=corner?top-(top-corner)*Math.abs(y)/corner:corner*(top-Math.abs(y))/(top-corner);
  const marks=[-top,-corner,-.007,.007,...(second?[.018,.029]:[]),corner,top];
  for(let i=1;i<marks.length;i++){
    const lo=marks[i-1],hi=marks[i],a=at(lo),b=at(hi);
    p.add(quad([-a,lo,rise],[a,lo,rise],[b,hi,rise],[-b,hi,rise]),lo===-.007?stripe:lo===.018&&second?second:'#e9ebd5');
  }
  return p.finish();
}
