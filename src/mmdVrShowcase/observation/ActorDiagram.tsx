import {useLayoutEffect,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import type {Mesh,MeshBasicMaterial,Object3D} from 'three';
import {createPanelTexture} from '../../shared/panelTexture';
import {recordFigureTick} from '../diagnostics/diagramTiming';
import {useActorHudDrag} from '../hud/actorHudDrag';

export type DiagramActor={assetId:string;runtimeId:string};
export type DiagramDriver={tick(now:number):boolean;suspend():void;dispose():void};
export type DiagramSpec={id:string;meshName:string;classes:string;width:number;height:number;
  angle(id:string):number;turn(id:string,degrees:number):void;
  open(canvas:HTMLCanvasElement,owner:DiagramActor,wake:()=>void,upload:()=>void):DiagramDriver};
type Props=DiagramActor&{spec:DiagramSpec};
export function ActorScreenDiagram({assetId,runtimeId,spec}:Props){
  const ref=useRef<HTMLCanvasElement>(null),drag=useRef<{id:number;x:number;y:number;degrees:number;axis:'pending'|'scroll'|'turn'}|null>(null);
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
       drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,degrees:spec.angle(assetId),axis:'pending'};}}
    onPointerMove={e=>{const d=drag.current;if(d?.id!==e.pointerId)return;
      const dx=e.clientX-d.x,dy=e.clientY-d.y,w=Math.max(1,e.currentTarget.clientWidth);
      if(d.axis==='pending'&&Math.max(Math.abs(dx),Math.abs(dy))>=4)d.axis=Math.abs(dx)>=Math.abs(dy)?'turn':'scroll';
      if(d.axis!=='turn')return;
      d.degrees=Math.max(-90,Math.min(90,d.degrees+dx*180/w));d.x=e.clientX;spec.turn(assetId,d.degrees);}}
    onPointerCancel={e=>{if(drag.current?.id===e.pointerId)drag.current=null;}}
    onLostPointerCapture={e=>{if(drag.current?.id===e.pointerId)drag.current=null;}}
    onPointerUp={e=>{if(drag.current?.id===e.pointerId){drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}}/>;
}

function HudOrbit({width,height,assetId,spec}:{width:number;height:number;assetId:string;spec:DiagramSpec}){
  const drag=useActorHudDrag((_root,start)=>{let x=start.x,angle=spec.angle(assetId),turning=false;
    return p=>{const dx=p.x-x;if(!turning&&Math.abs(dx)<width*.009)return;turning=true;
      angle=Math.min(90,Math.max(-90,angle+dx*180/width));x=p.x;spec.turn(assetId,angle);};});
  return <mesh name="actor:turn-figure" position-z={.004} {...drag}><planeGeometry args={[width,height]}/>
    <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false}/></mesh>;
}

export function ActorHudDiagram({assetId,runtimeId,spec,widthM,interactive=false,zoom=1}:Props&{widthM:number;interactive?:boolean;zoom?:number}){
  const mesh=useRef<Mesh>(null),material=useRef<MeshBasicMaterial>(null),driver=useRef<DiagramDriver|null>(null);
  useLayoutEffect(()=>{
    const mat=material.current;if(!mat)return;
    // Each committed owner, including StrictMode's second setup, gets a clean canvas.
    const texture=createPanelTexture(spec.width*2,spec.height*2,()=>{},'en');mat.map=texture;mat.needsUpdate=true;
    const p=spec.open(texture.image as HTMLCanvasElement,{assetId,runtimeId},()=>{},()=>{texture.needsUpdate=true;});
    driver.current=p;return ()=>{driver.current=null;p.dispose();mat.map=null;texture.dispose();};
  },[assetId,runtimeId,spec]);
  useLayoutEffect(()=>{const map=material.current?.map;if(!map)return;
    const uv=1/zoom;map.repeat.set(uv,uv);map.offset.setScalar((1-uv)/2);
  },[zoom,assetId,runtimeId,spec]);
  useFrame(({gl},_,frame)=>{
    const p=driver.current;if(!p)return;
    if(document.hidden||(gl.xr.isPresenting&&frame?.session.visibilityState!=='visible')){p.suspend();return;}
    for(let node:Object3D|null=mesh.current;node;node=node.parent)if(!node.visible){p.suspend();return;}
    const now=performance.now(),map=material.current?.map,version=map?.version;
    p.tick(now);
    if(frame&&gl.xr.isPresenting)recordFigureTick(frame.session,performance.now()-now,map?.version!==version);
  });
  const height=widthM*spec.height/spec.width;
  return <><mesh ref={mesh} name={spec.meshName} pointerEvents="none" raycast={()=>null} renderOrder={30}>
    <planeGeometry args={[widthM,height]}/><meshBasicMaterial ref={material} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false}/></mesh>
    {interactive&&<HudOrbit key={JSON.stringify([assetId,runtimeId,spec.id])} width={widthM} height={height} assetId={assetId} spec={spec}/>}</>;
}
