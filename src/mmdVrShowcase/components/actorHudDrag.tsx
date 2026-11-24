import {useLayoutEffect,useRef} from 'react';
import type {ThreeEvent} from '@react-three/fiber';
import {Matrix4,Plane,Vector3,type Object3D} from 'three';
import {useLanguageStore} from '../../languageStore';
import {PrivateLine} from '../pelvic/HudPrivateControls';

type Hit=ThreeEvent<PointerEvent>;
type Capture={setPointerCapture(id:number):void;releasePointerCapture(id:number):void};
type Move=(local:Vector3)=>void;
// A second ray may operate the stand, but cannot carry the sheet while the
// first ray is rotating its contents. Capture uses the original plane even
// outside the geometry; captured UVs need not describe the current ray.
const owners=new WeakSet<Object3D>();
export function useActorHudDrag(begin:(root:Object3D,local:Vector3)=>Move){
  const active=useRef<{id:number;root:Object3D;target:Capture;plane:Plane;inverse:Matrix4;move:Move;point:Vector3}|null>(null);
  function finish(id?:number){
    const a=active.current;if(!a||(id!==undefined&&id!==a.id))return;
    active.current=null;owners.delete(a.root);try{a.target.releasePointerCapture(a.id);}catch{/* session ended */}
  }
  useLayoutEffect(()=>{const cancel=()=>finish();window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',cancel);
    return ()=>{window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',cancel);cancel();};},[]);
  const end=(e:Hit)=>{e.stopPropagation();finish(e.pointerId);};
  return {onPointerDown:(e:Hit)=>{
    e.stopPropagation();let root:Object3D|null=e.eventObject;while(root&&root.name!=='backpack-world-tools')root=root.parent;
    if(e.button!==0||!root||active.current||owners.has(root))return;
    const target=e.target as unknown as Capture;try{target.setPointerCapture(e.pointerId);}catch{return;}
    const m=e.eventObject.matrixWorld,inverse=m.clone().invert(),plane=new Plane(new Vector3(0,0,1),0).applyMatrix4(m);
    const point=e.point.clone().applyMatrix4(inverse),move=begin(root,point);
    owners.add(root);active.current={root,id:e.pointerId,target,plane,inverse,point,move};
  },onPointerMove:(e:Hit)=>{
    const a=active.current;if(a?.id!==e.pointerId)return;e.stopPropagation();
    if(e.ray.intersectPlane(a.plane,a.point))a.move(a.point.applyMatrix4(a.inverse));
  },onPointerUp:end,onPointerCancel:end,onLostPointerCapture:end,onClick:(e:Hit)=>e.stopPropagation()};
}

/** Actor tools are separate from the common B menu. Translate the selected
 * sheet in its own plane; leave the actor, camera and the other menu alone. */
export function ActorHudTitle({position,width,text}:{position:[number,number,number];width:number;text:string}){
  const hint=useLanguageStore(s=>s.language==='zh'?'拖动':'Drag');
  const drag=useActorHudDrag((root,start)=>{
    const x=start.x,y=start.y,from=root.position.clone(),delta=new Vector3();
    return p=>{delta.set(p.x-x,p.y-y,0).multiply(root.scale).applyQuaternion(root.quaternion);root.position.copy(from).add(delta);};
  });
  return <group position={position}>
    <PrivateLine position={[0,0,0]} width={width} text={text} value={hint} title/>
    <mesh name="actor:move-sheet" position-z={.006} {...drag}><planeGeometry args={[width,.14]}/>
      <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false}/></mesh>
  </group>;
}
