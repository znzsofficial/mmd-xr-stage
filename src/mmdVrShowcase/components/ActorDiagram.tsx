import {useLayoutEffect,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import type {Mesh,MeshBasicMaterial,Object3D} from 'three';
import {createPanelTexture} from '../../shared/panelTexture';

export type DiagramActor={assetId:string;runtimeId:string};
export type DiagramDriver={tick(now:number):boolean;suspend():void;dispose():void};
export type DiagramSpec={id:string;meshName:string;classes:string;width:number;height:number;
  angle(id:string):number;turn(id:string,degrees:number):void;
  open(canvas:HTMLCanvasElement,owner:DiagramActor,wake:()=>void,upload:()=>void):DiagramDriver};
type Props=DiagramActor&{spec:DiagramSpec};
export function ActorScreenDiagram({assetId,runtimeId,spec}:Props){
  const ref=useRef<HTMLCanvasElement>(null),drag=useRef<{id:number;x:number;degrees:number}|null>(null);
  useLayoutEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    let raf=0,onScreen=true,live=true;
    function wake(){if(live&&onScreen&&!document.hidden&&!raf)raf=requestAnimationFrame(render);}
    function render(t:number){raf=0;if(live&&onScreen&&!document.hidden&&painter.tick(t))wake();}
    const painter=spec.open(canvas,{assetId,runtimeId},wake,()=>{});
    const changed=()=>{if(document.hidden||!onScreen){cancelAnimationFrame(raf);raf=0;painter.suspend();}else wake();};
    const io=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(([e])=>{onScreen=e.isIntersecting;changed();}):null;
    io?.observe(canvas);document.addEventListener('visibilitychange',changed);wake();
    return ()=>{live=false;drag.current=null;io?.disconnect();document.removeEventListener('visibilitychange',changed);cancelAnimationFrame(raf);painter.dispose();};
  },[assetId,runtimeId,spec]);
  return <canvas key={JSON.stringify([assetId,runtimeId,spec.id])} ref={ref} className={spec.classes} width={spec.width*2} height={spec.height*2} role="img"
    onPointerDown={e=>{if(drag.current||e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);
      drag.current={id:e.pointerId,x:e.clientX,degrees:spec.angle(assetId)};}}
    onPointerMove={e=>{const d=drag.current;if(d?.id===e.pointerId)spec.turn(assetId,d.degrees+(e.clientX-d.x)*180/Math.max(1,e.currentTarget.clientWidth));}}
    onPointerCancel={e=>{if(drag.current?.id===e.pointerId)drag.current=null;}}
    onLostPointerCapture={e=>{if(drag.current?.id===e.pointerId)drag.current=null;}}
    onPointerUp={e=>{if(drag.current?.id===e.pointerId){drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}}/>;
}

export function ActorHudDiagram({assetId,runtimeId,spec,widthM}:Props&{widthM:number}){
  const mesh=useRef<Mesh>(null),material=useRef<MeshBasicMaterial>(null),driver=useRef<DiagramDriver|null>(null);
  useLayoutEffect(()=>{
    const mat=material.current;if(!mat)return;
    // Each committed owner, including StrictMode's second setup, gets a clean canvas.
    const texture=createPanelTexture(spec.width*2,spec.height*2,()=>{},'en');mat.map=texture;mat.needsUpdate=true;
    const p=spec.open(texture.image as HTMLCanvasElement,{assetId,runtimeId},()=>{},()=>{texture.needsUpdate=true;});
    driver.current=p;return ()=>{driver.current=null;p.dispose();mat.map=null;texture.dispose();};
  },[assetId,runtimeId,spec]);
  useFrame(({gl},_,frame)=>{
    const p=driver.current;if(!p)return;
    if(document.hidden||(gl.xr.isPresenting&&frame?.session.visibilityState!=='visible')){p.suspend();return;}
    for(let node:Object3D|null=mesh.current;node;node=node.parent)if(!node.visible){p.suspend();return;}
    p.tick(performance.now());
  });
  return <mesh ref={mesh} name={spec.meshName} pointerEvents="none" raycast={()=>null} renderOrder={30}>
    <planeGeometry args={[widthM,widthM*spec.height/spec.width]}/><meshBasicMaterial ref={material} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false}/></mesh>;
}
