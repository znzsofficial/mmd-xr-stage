import {useLayoutEffect,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import type {Mesh,MeshBasicMaterial,Object3D} from 'three';
import {createPanelTexture} from '../../../shared/panelTexture';
import {SECTION_W,SECTION_H} from '../sectionPaint';
import {atlasPainter,type AtlasActor,type AtlasScope} from './painter';
import {readAtlasView,setAtlasView} from './view';

export const atlasAspect=SECTION_H/SECTION_W;
type GraphicProps=AtlasActor&{scope:AtlasScope};
const w=SECTION_W*2,h=SECTION_H*2;

export function AtlasScreenGraphic({assetId,runtimeId,scope}:GraphicProps){
  const ref=useRef<HTMLCanvasElement>(null),drag=useRef<{pointer:number;x:number;degrees:number}|null>(null);
  useLayoutEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    let raf=0,onScreen=true,live=true;
    function wake(){if(live&&onScreen&&!document.hidden&&!raf)raf=requestAnimationFrame(render);}
    function render(t:number){raf=0;if(live&&onScreen&&!document.hidden&&painter.tick(t))wake();}
    const painter=atlasPainter(canvas,{assetId,runtimeId},scope,wake,()=>{});
    const changed=()=>{if(document.hidden||!onScreen){cancelAnimationFrame(raf);raf=0;painter.suspend();}else wake();};
    const io=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(([e])=>{onScreen=e.isIntersecting;changed();}):null;
    io?.observe(canvas);document.addEventListener('visibilitychange',changed);wake();
    return ()=>{live=false;drag.current=null;io?.disconnect();document.removeEventListener('visibilitychange',changed);cancelAnimationFrame(raf);painter.dispose();};
  },[assetId,runtimeId,scope]);
  return <canvas key={JSON.stringify([assetId,runtimeId,scope])} ref={ref} className="pelvic-section atlas-artboard" width={w} height={h} role="img"
    onPointerDown={e=>{if(drag.current||e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);
      drag.current={pointer:e.pointerId,x:e.clientX,degrees:readAtlasView(assetId).degrees};}}
    onPointerMove={e=>{const d=drag.current;if(d&&d.pointer===e.pointerId)setAtlasView(assetId,{degrees:d.degrees+(e.clientX-d.x)*180/Math.max(1,e.currentTarget.clientWidth)});}}
    onPointerCancel={e=>{if(drag.current?.pointer===e.pointerId)drag.current=null;}}
    onLostPointerCapture={e=>{if(drag.current?.pointer===e.pointerId)drag.current=null;}}
    onPointerUp={e=>{if(drag.current?.pointer===e.pointerId){drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}}/>;
}

export function AtlasHudGraphic({assetId,runtimeId,scope,widthM}:GraphicProps&{widthM:number}){
  const mesh=useRef<Mesh>(null),material=useRef<MeshBasicMaterial>(null);
  const driver=useRef<ReturnType<typeof atlasPainter>|null>(null);
  useLayoutEffect(()=>{
    const mat=material.current;if(!mat)return;
    // The canvas carries actor pixels as well as metadata. Allocate it for
    // this committed owner, including StrictMode's cleanup/setup replay.
    const texture=createPanelTexture(w,h,()=>{},'en');mat.map=texture;mat.needsUpdate=true;
    const p=atlasPainter(texture.image as HTMLCanvasElement,{assetId,runtimeId},scope,()=>{},()=>{texture.needsUpdate=true;});
    driver.current=p;return ()=>{driver.current=null;p.dispose();mat.map=null;texture.dispose();};
  },[assetId,runtimeId,scope]);
  // XR's own frame, not window.requestAnimationFrame. When hidden the last
  // illustration stays still and a new session never catches up elapsed time.
  useFrame(({gl},_,frame)=>{
    const p=driver.current;if(!p)return;
    if(document.hidden||(gl.xr.isPresenting&&frame?.session.visibilityState!=='visible')){p.suspend();return;}
    for(let node:Object3D|null=mesh.current;node;node=node.parent)if(!node.visible){p.suspend();return;}
    p.tick(performance.now());
  });
  return <mesh ref={mesh} name="pelvic:sagittal-section" pointerEvents="none" raycast={()=>null} renderOrder={30}>
    <planeGeometry args={[widthM,widthM*atlasAspect]}/><meshBasicMaterial ref={material} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false}/></mesh>;
}
