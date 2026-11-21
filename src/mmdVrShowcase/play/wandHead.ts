import { Matrix3, Matrix4, Vector3, type BufferGeometry, type Object3D, type Scene } from 'three';
import {crownFlex,siliconeCrown} from './siliconeProfile';

export type ContactToy='wand'|'dildo';
type Triple=readonly [number,number,number];
function ellipsoid(center:Triple,radii:Triple,pitch=0){
  const [x,y,z]=center,[rx,ry,rz]=radii;
  const toUnit=new Matrix4().makeScale(1/rx,1/ry,1/rz).multiply(new Matrix4().makeRotationX(-pitch))
    .multiply(new Matrix4().makeTranslation(-x,-y,-z));
  return {center:new Vector3(x,y,z),radius:Math.max(rx,ry,rz),sideRadius:rx,toUnit,normalToPart:new Matrix3().setFromMatrix4(toUnit).transpose()};
}

// Conservative inner surface of the manufactured cap (makeWandHead), in the
// flex joint's coordinates. It excludes the bellows, neck, seam and grip.
export const capY=.0464, capR=.0258, capHalfHeight=.0273;
export const wandCap=ellipsoid([0,capY,0],[capR,capHalfHeight,capR]);
export const siliconeCap=ellipsoid(siliconeCrown.center,siliconeCrown.radii,siliconeCrown.pitch);
export type ContactCap=typeof wandCap;
const clamp=(x:number)=>Math.min(1,Math.max(0,x));

/** A small patch of the soft cap flattens against the contact plane. The
 * collision shape stays in its manufactured pose (no dimple feedback loop). */
function createSoftHead(toy:ContactToy,pivot:Object3D,geometry:BufferGeometry,cap:ContactCap,
  maxTravel:number,start:number,span:number,flex:(x:number,y:number,z:number)=>number){
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
  const pos=new Float32Array(p.array),norm=new Float32Array(n.array),v=new Vector3(),normal=new Vector3();
  const movable:number[]=[],weights:number[]=[];
  for(let i=0;i<p.count;i++){
    const w=flex(p.getX(i),p.getY(i),p.getZ(i));if(w>0){movable.push(i);weights.push(w);}
  }
  let dirty=false;
  function release(){if(!dirty)return;dirty=false;p.array.set(pos);n.array.set(norm);p.needsUpdate=n.needsUpdate=true;}
  function press(axis:Vector3,depth:number){
    const amount=Math.min(maxTravel,depth*cap.sideRadius*.8);if(!(amount>0)){release();return;}
    const plane=cap.center.dot(axis)+start;
    for(let j=0;j<movable.length;j++){
      const i=movable[j];
      v.fromArray(pos,3*i);normal.fromArray(norm,3*i);
      // Restrict both movement and normal rotation to the facing contact patch.
      const t=clamp((v.dot(axis)-plane)/span),w=t*t*weights[j];
      if(w>0){v.addScaledVector(axis,-amount*w);normal.lerp(axis,Math.min(.6,amount*110)*w).normalize();}
      p.setXYZ(i,v.x,v.y,v.z);n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    dirty=true;p.needsUpdate=n.needsUpdate=true;
  }
  return {toy,pivot,cap,press,release};
}
export function createWandHead(pivot:Object3D,geometry:BufferGeometry){
  return createSoftHead('wand',pivot,geometry,wandCap,.005,.009,.017,(_,y)=>clamp((y-.022)/.008));
}
export function createSiliconeHead(pivot:Object3D,geometry:BufferGeometry){
  return createSoftHead('dildo',pivot,geometry,siliconeCap,.0035,.004,.014,crownFlex);
}
export type WandHead=ReturnType<typeof createWandHead>;
const mounted = new Set<WandHead>();
export function mountWandHead(head:WandHead){mounted.add(head);return ()=>{head.release();mounted.delete(head);};}

/** Resolve ownership and visibility again after this frame's evaluated wrist
 * and controller pose. A tracking gap cannot leave a usable old pose behind. */
export function findWandInput(scene:Scene,wrist:Object3D|null,toy:ContactToy,held:boolean,frame?:XRFrame){
  if(frame&&frame.session.visibilityState!=='visible')return null;
  for(const head of mounted){
    if(head.toy!==toy)continue;
    let usable=false,gamepad:Gamepad|null=null;
    for(let node:Object3D|null=head.pivot;node;node=node.parent){
      if(!node.visible)break;
      if(node===wrist&&!held)usable=true;
      if(held&&frame&&node.userData.heldToy===toy&&
        node.userData.propUsable&&node.userData.propFrame===frame){usable=true;gamepad=node.userData.gamepad??null;}
      if(node===scene&&usable)return {head,gamepad};
    }
  }return null;
}
