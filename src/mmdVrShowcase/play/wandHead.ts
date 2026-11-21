import { Matrix4, Vector3, type BufferGeometry, type Object3D, type Scene } from 'three';

// Conservative inner surface of the manufactured cap (makeWandHead), in the
// flex joint's coordinates. It excludes the bellows, neck, seam and grip.
export const capY=.0464, capR=.0258, capHalfHeight=.0273;
export const capToUnit=new Matrix4().makeScale(1/capR,1/capHalfHeight,1/capR)
  .multiply(new Matrix4().makeTranslation(0,-capY,0));

/** A small patch of the soft cap flattens against the contact plane. The
 * collision shape stays in its manufactured pose (no dimple feedback loop). */
export function createWandHead(pivot:Object3D,geometry:BufferGeometry){
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
  const pos=new Float32Array(p.array),norm=new Float32Array(n.array),v=new Vector3(),normal=new Vector3();
  let dirty=false;
  function release(){if(!dirty)return;dirty=false;p.array.set(pos);n.array.set(norm);p.needsUpdate=n.needsUpdate=true;}
  function press(axis:Vector3,depth:number){
    const amount=Math.min(.005,depth*capR*.8);if(!(amount>0)){release();return;}
    for(let i=0;i<p.count;i++){
      v.fromArray(pos,3*i);normal.fromArray(norm,3*i);
      // Restrict both movement and normal rotation to the facing contact patch.
      const t=Math.min(1,Math.max(0,(v.dot(axis)-capY*axis.y-.009)/.017));
      const neck=Math.min(1,Math.max(0,(v.y-.022)/.008));
      if(t>0&&neck>0){v.addScaledVector(axis,-amount*t*t*neck);normal.lerp(axis,Math.min(.6,amount*110)*t*t*neck).normalize();}
      p.setXYZ(i,v.x,v.y,v.z);n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    dirty=true;p.needsUpdate=n.needsUpdate=true;
  }
  return {pivot,press,release};
}
export type WandHead=ReturnType<typeof createWandHead>;
const mounted = new Set<WandHead>();
export function mountWandHead(head:WandHead){mounted.add(head);return ()=>{head.release();mounted.delete(head);};}

/** Resolve ownership and visibility again after this frame's evaluated wrist
 * and controller pose. A tracking gap cannot leave a usable old pose behind. */
export function findWandInput(scene:Scene,wrist:Object3D|null,held:boolean,frame?:XRFrame){
  for(const head of mounted){
    let usable=false,gamepad:Gamepad|null=null;
    for(let node:Object3D|null=head.pivot;node;node=node.parent){
      if(!node.visible)break;
      if(node===wrist&&!held)usable=true;
      if(held&&frame&&frame.session.visibilityState==='visible'&&node.userData.heldToy==='wand'&&
        node.userData.propUsable&&node.userData.propFrame===frame){usable=true;gamepad=node.userData.gamepad??null;}
      if(node===scene&&usable)return {head,gamepad};
    }
  }return null;
}
