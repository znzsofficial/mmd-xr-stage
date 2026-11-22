import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Shape, ShapeGeometry } from 'three';
import { createPanelTexture } from '../../shared/panelTexture';
import { PRIVATE_COLORS as c, PRIVATE_TITLE_FACE, buttonInks, type ButtonVariant } from './palette';
import { useHudKeyTexture, type KeyPainter } from '../components/useHudKeyTexture';

type Point = [number, number, number];
type Size = [number, number];
const material = { transparent: true, toneMapped: false, fog: false, depthTest: false, depthWrite: false } as const;
const noRay = () => null;
const density = 600;

// Paint and ray geometry share this silhouette. No invisible rectangular button
// in the bevel or oversized hit mesh drifting over an adjacent angle selector.
function corners(w:number, h:number, cut:number, all=false) {
  const r = Math.min(cut, w/4, h/4);
  return [[r,0], [w-(all?r:0),0], [w,all?r:0], [w,h-r], [w-r,h], [all?r:0,h], [0,h-(all?r:0)], [0,r]];
}
function path(ctx:CanvasRenderingContext2D, w:number, h:number, cut:number, all=false, inset=0) {
  ctx.beginPath();
  corners(w-inset*2,h-inset*2,cut,all).forEach(([x,y],i)=>{
    if(i===0)ctx.moveTo(x+inset,y+inset);else ctx.lineTo(x+inset,y+inset);
  });
  ctx.closePath();
}
function cutGeometry(w:number,h:number,cut:number,all=false) {
  const shape=new Shape();
  corners(w,h,cut,all).forEach(([x,y],i)=>{if(i===0)shape.moveTo(x-w/2,h/2-y);else shape.lineTo(x-w/2,h/2-y);});
  shape.closePath();
  const g=new ShapeGeometry(shape),pos=g.getAttribute('position'),uv=g.getAttribute('uv');
  for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/w+.5,pos.getY(i)/h+.5);
  return g;
}
function labelText(ctx:CanvasRenderingContext2D,label:string,x:number,y:number,width:number,font:number,weight:number) {
  ctx.font=`${weight} ${font}px system-ui,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  if(ctx.measureText(label).width<=width){ctx.fillText(label,x,y);return;}
  const parts=label.includes(' ')?label.split(/\s+/):Array.from(label),joint=label.includes(' ')?' ':'';
  let split=0,best=Infinity;
  for(let i=1;i<parts.length;i++) {
    const widest=Math.max(ctx.measureText(parts.slice(0,i).join(joint)).width,ctx.measureText(parts.slice(i).join(joint)).width);
    if(widest<best){split=i;best=widest;}
  }
  if(!split){ctx.fillText(label,x,y,width);return;}
  ctx.font=`${weight} ${font*.88}px system-ui,sans-serif`;
  ctx.fillText(parts.slice(0,split).join(joint),x,y-font*.50,width);
  ctx.fillText(parts.slice(split).join(joint),x,y+font*.50,width);
}

export function PrivateButton({position,size=[.36,.135],label,onPress,active=false,disabled=false,danger=false,variant='button'}:{
  position:Point;size?:Size;label:string;onPress:()=>void;active?:boolean;disabled?:boolean;danger?:boolean;variant?:ButtonVariant;
}) {
  const [w,h]=size,stop=variant==='stop';
  const [hover,setHover]=useState(false),[pressed,setPressed]=useState(false);
  const pointer=useRef<number|null>(null), handled=useRef(new Set<number>()), lastUp=useRef<number|null>(null);
  const geom=useMemo(()=>cutGeometry(w,h,.014,stop),[w,h,stop]);
  const px=Math.round(w*density),py=Math.round(h*density);
  const texture=useHudKeyTexture(px,py,useCallback<KeyPainter>(({ctx,width,height})=>{
    const {face:fill,letters:ink,edge}=buttonInks({variant,active,disabled,danger,hovered:hover});
    path(ctx,width,height,.014*density,stop,1);
    ctx.fillStyle=fill;ctx.fill();ctx.lineWidth=2;
    ctx.strokeStyle=edge;
    if(disabled)ctx.setLineDash([6,4]);ctx.stroke();ctx.setLineDash([]);
    if(active&&!disabled){ctx.fillStyle=ink;ctx.fillRect(width*.28,height-6,width*.44,3);}
    const icon=stop||variant==='quiet',iconSize=Math.min(13,width*.095),inset=icon?iconSize+12:0;
    if(icon){
      ctx.fillStyle=ink;ctx.strokeStyle=ink;ctx.lineWidth=2.6;
      const x=9+iconSize/2,y=height/2;
      if(stop)ctx.fillRect(x-iconSize/2,y-iconSize/2,iconSize,iconSize);
      else{ctx.beginPath();ctx.moveTo(x+iconSize/3,y-iconSize/2);ctx.lineTo(x-iconSize/4,y);ctx.lineTo(x+iconSize/3,y+iconSize/2);ctx.stroke();}
    }
    ctx.fillStyle=ink;labelText(ctx,label,(width+inset)/2,height/2,Math.max(1,width-inset-13),Math.min(28,height*.35),active||stop?650:550);
  },[label,active,disabled,danger,hover,stop,variant]));
  useEffect(()=>()=>geom.dispose(),[geom]);
  function cancel(id:number|null){if(id!==null&&id===pointer.current){handled.current.add(id);lastUp.current=id;pointer.current=null;setPressed(false);}}
  useLayoutEffect(()=>{if(disabled){cancel(pointer.current);setHover(false);}},[disabled]);
  return <mesh name={`hud:${label}`} position={position} renderOrder={30} scale={pressed && !disabled ? .985 : 1}
    onPointerEnter={e=>{e.stopPropagation();if(!disabled)setHover(true);}}
    onPointerLeave={e=>{e.stopPropagation();setHover(false);cancel(e.pointerId);}}
    onPointerCancel={e=>{e.stopPropagation();cancel(e.pointerId);}}
    onPointerDown={e=>{e.stopPropagation();if(disabled||pointer.current!==null){handled.current.add(e.pointerId);return;}
      handled.current.delete(e.pointerId);pointer.current=e.pointerId;setPressed(true);}}
    onPointerUp={e=>{e.stopPropagation();if(pointer.current!==e.pointerId)return;cancel(e.pointerId);if(!disabled)onPress();}}
    onClick={e=>{e.stopPropagation();const id='pointerId' in e&&typeof e.pointerId==='number'?e.pointerId:lastUp.current;
      if(id!==null&&handled.current.delete(id))return;if(pointer.current===null&&!disabled)onPress();}}>
    <primitive attach="geometry" object={geom}/><meshBasicMaterial map={texture} {...material}/>
  </mesh>;
}

export function PrivateSheet({size}:{size:Size}) {
  const [w,h]=size;
  const geom=useMemo(()=>cutGeometry(w,h,14/400),[w,h]);
  useEffect(()=>()=>geom.dispose(),[geom]);
  // The resizable sheet is two flat colours. Never upload a full-page canvas
  // to the headset just because a note wrapped or the chart opened.
  return <group position-z={-.018}>
    <mesh geometry={geom} renderOrder={10} onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
      <meshBasicMaterial color={c.rule} {...material}/></mesh>
    <mesh geometry={geom} scale={[(w-.008)/w,(h-.008)/h,1]} renderOrder={11} pointerEvents="none" raycast={noRay}>
      <meshBasicMaterial color={c.paper} {...material}/></mesh>
  </group>;
}

export function PrivateLine({position,width,text,value,title=false}:{position:Point;width:number;text:string;value?:string;title?:boolean}) {
  const px=Math.round(width*density),py=64;
  const texture=useMemo(()=>createPanelTexture(px,py,({ctx})=>{
    ctx.textBaseline='middle';ctx.fillStyle=title?c.ink:c.muted;
    let right=px-3;
    if(value){ctx.font='650 28px system-ui,sans-serif';ctx.fillStyle=c.gold;ctx.textAlign='right';ctx.fillText(value,right,py/2);
      right-=ctx.measureText(value).width+12;ctx.textAlign='left';ctx.fillStyle=c.muted;}
    ctx.font=title?`600 40px ${PRIVATE_TITLE_FACE}`:'500 27px system-ui,sans-serif';
    ctx.fillText(text,2,py/2,Math.max(1,right-2));
  },'en'),[px,text,value,title]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh name={`hud-label:${text}`} position={position} renderOrder={30} pointerEvents="none" raycast={noRay}>
    <planeGeometry args={[width,py/density]}/><meshBasicMaterial map={texture} {...material}/></mesh>;
}

export function PrivateSlider({position,width,value,disabled,onChange}:{position:Point;width:number;value:number;disabled:boolean;onChange:(value:number)=>void}) {
  const active=useRef<{id:number;target:Element}|null>(null);
  function finish(id?:number){
    const owner=active.current;if(!owner||(id!==undefined&&id!==owner.id))return;
    active.current=null;try{owner.target.releasePointerCapture?.(owner.id);}catch{/* Optional in XR. */}
  }
  useLayoutEffect(()=>{if(disabled)finish();return ()=>finish();},[disabled]);
  const ratio=Math.min(1,Math.max(0,value)),end=(e:ThreeEvent<PointerEvent>)=>{e.stopPropagation();finish(e.pointerId);};
  // A small end inset lets the full thumb sit within the actual hit surface.
  // Unlike mapping hit-plane UV directly, touching the rendered tip yields 0 / 1.
  const travel=width-.06,update=(e:ThreeEvent<PointerEvent>)=>{
    if(e.uv)onChange(Math.max(0,Math.min(1,((e.uv.x-.5)*width)/travel+.5)));
  };
  return <group position={position}>
    <mesh renderOrder={30} pointerEvents="none" raycast={noRay}><planeGeometry args={[travel,.009]}/><meshBasicMaterial color={c.rule} {...material}/></mesh>
    {ratio>0&&<mesh renderOrder={31} position-x={travel*(ratio-1)/2} pointerEvents="none" raycast={noRay}><planeGeometry args={[travel*ratio,.012]}/><meshBasicMaterial color={disabled?c.disabled:c.rouge} {...material}/></mesh>}
    <mesh renderOrder={32} position-x={travel*(ratio-.5)} rotation-z={Math.PI/4} pointerEvents="none" raycast={noRay}><planeGeometry args={[.042,.042]}/><meshBasicMaterial color={disabled?c.disabled:c.gold} {...material}/></mesh>
    <mesh name="pelvic:slider-hit" position-z={.01} renderOrder={33}
      onPointerDown={e=>{e.stopPropagation();if(disabled||active.current)return;active.current={id:e.pointerId,target:e.target as Element};
        try{active.current.target.setPointerCapture?.(e.pointerId);}catch{/* Optional in XR. */}update(e);}}
      onPointerMove={e=>{if(active.current?.id===e.pointerId){e.stopPropagation();if(!disabled)update(e);}}}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onClick={e=>e.stopPropagation()}>
      <planeGeometry args={[width,.15]}/><meshBasicMaterial opacity={0} {...material}/></mesh>
  </group>;
}
