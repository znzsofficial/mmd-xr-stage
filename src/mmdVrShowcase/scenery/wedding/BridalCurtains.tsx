import {useFrame,type ThreeEvent} from '@react-three/fiber';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {CanvasTexture,DoubleSide,Mesh,SRGBColorSpace,Vector3,type Group,type Texture} from 'three';
import {useLanguageStore} from '../../../languageStore';
import {sceneActionRays,useSceneAction,useSceneActionsEnabled} from '../input/useSceneAction';
import {noPick} from '../sceneryPaint';
import {BED,FRONT,bindDrapes,curtainTrack,layers,selvage,sheetBottom,sheetTop,sheetWidth,type Draw,type Layer} from './bridalLayout';
import {Surface,tau,white,type V} from './furnishingsMesh';
import {weddingSightline} from './weddingLayout';

const intercept=(e:ThreeEvent<Event>)=>e.stopPropagation();
function makePanel(k:Layer){
  const s=new Surface(),silk=k==='silk';
  const at=(u:number,v:number):V=>[u,sheetBottom+(sheetTop-sheetBottom)*v+(1-v)**4*.009*(1-Math.cos(7*tau*u)),
    (silk?.031:.023)*Math.cos(tau*(u*7+.095*Math.sin(Math.PI*v)))];
  s.grid(56,8,at,silk?white:'#df827c',silk?'lotus':'solid');
  function trim(u:number,v:number):V{const [x,y,z]=at(u,v);return [x,y,z+.0018];}
  for(const v of [.028,.048,.942,.963])s.grid(56,1,(u,t)=>trim(u,v+t*(silk?.009:.004)),silk?'#d6ad72':'#f6c3a9');
  s.grid(2,8,(t,v)=>trim(.984+.012*t,v),silk?'#d6ad72':'#f2b19c');
  return s.finish();
}

function tagPrint(text:string,lit:boolean){
  const c=document.createElement('canvas');c.width=512;c.height=156;const ctx=c.getContext('2d')!;
  ctx.fillStyle=lit?'#843c30':'#542b26';ctx.fillRect(0,0,512,156);
  ctx.strokeStyle='#e2bd7a';ctx.lineWidth=5;ctx.strokeRect(10,10,492,136);
  ctx.fillStyle='#fff0cc';ctx.font='600 57px "Microsoft YaHei",system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,77,462);
  const t=new CanvasTexture(c);t.colorSpace=SRGBColorSpace;return t;
}
const keys={silk:['weddingSilkClose','weddingSilkOpen'],gauze:['weddingGauzeClose','weddingGauzeOpen']} as const;

function Pull({kind,closed,onPull}:{kind:Layer;closed:boolean;onPull:()=>void}){
  const t=useLanguageStore(s=>s.t);
  const {enabled,hovered,bindings}=useSceneAction('weddingCourt',weddingSightline,onPull);
  const text=t(keys[kind][Number(closed)]),print=useMemo(()=>tagPrint(text,hovered),[text,hovered]);
  useEffect(()=>()=>print.dispose(),[print]);
  const x=BED.x+(kind==='silk'?-1:1)*1.61,z=BED.z+FRONT+.11;
  return <group position={[x,1.44,z]}>
    <mesh raycast={noPick} pointerEvents="none" userData={{playerCollision:false}}><boxGeometry args={[.46,.143,.032]}/><meshStandardMaterial color="#6f342a" roughness={.62}/></mesh>
    {[-1,1].map(s=><mesh key={s} raycast={noPick} pointerEvents="none" userData={{playerCollision:false}} position-z={s*.017} rotation-y={s===1?0:Math.PI}>
      <planeGeometry args={[.452,.137]}/><meshBasicMaterial map={print} toneMapped={false}/>
    </mesh>)}
    {enabled&&<mesh name={`wedding:pull-${kind}`} position-y={-.068} userData={{playerCollision:false}} {...bindings}>
      <boxGeometry args={[.49,.35,.060]}/><meshBasicMaterial visible={false}/>
    </mesh>}
  </group>;
}

export function BridalCurtains({print}:{print:Texture}){
  const root=useRef<Group>(null),[draw]=useState<Draw>(()=>({silk:0,gauze:0}));
  const [closed,setClosed]=useState({silk:false,gauze:false});
  const geometry=useMemo(()=>({silk:makePanel('silk'),gauze:makePanel('gauze')}),[]);
  const eye=useMemo(()=>new Vector3(),[]);
  const enabled=useSceneActionsEnabled('weddingCourt');
  useLayoutEffect(()=>bindDrapes(draw),[draw]);
  useEffect(()=>()=>{for(const g of Object.values(geometry))g.dispose();},[geometry]);
  useFrame(({gl},dt)=>{
    if(!root.current||(draw.silk===Number(closed.silk)&&draw.gauze===Number(closed.gauze)))return;
    for(const [i,k] of layers.entries()){
      const target=Number(closed[k]),old=draw[k];if(target===old)continue;
      const next=old+Math.sign(target-old)*Math.min(Math.abs(target-old),2*Math.min(.1,dt));
      if(next>old&&gl.xr.isPresenting){
        gl.xr.getCamera().getWorldPosition(eye);
        // Ease back rather than trapping a visitor who's standing in the track.
        if(Math.abs(eye.z-curtainTrack(k))<.28&&Math.abs(eye.x-BED.x)<1.64&&Math.abs(eye.x-BED.x)>1.42-sheetWidth(next)-.24){setClosed(c=>({...c,[k]:false}));continue;}
      }
      draw[k]=next;
      root.current.children[i*2].scale.x=sheetWidth(next);root.current.children[i*2+1].scale.x=-sheetWidth(next);
    }
  });
  return <><group ref={root} name="wedding:curtains" pointerEvents={enabled?'auto':'none'}>
    {layers.flatMap(k=>[-1,1].map(side=><mesh key={`${k}:${side}`} name={`wedding:${k}:${side}`} geometry={geometry[k]} position={[selvage(side),0,curtainTrack(k)]}
      scale={[-side*sheetWidth(draw[k]),1,1]} userData={{playerCollision:false}} receiveShadow
      raycast={enabled?Mesh.prototype.raycast:noPick} pointerEventsType={sceneActionRays} pointerEventsOrder={-1}
      onClick={intercept} onPointerDown={intercept} onPointerUp={intercept}>
      {k==='silk'?<meshStandardMaterial vertexColors map={print} side={DoubleSide} roughness={.81}/>:
        <meshStandardMaterial vertexColors transparent opacity={.39} depthWrite={false} side={DoubleSide} forceSinglePass roughness={.97}/>}
    </mesh>))}
  </group>{layers.map(k=><Pull key={k} kind={k} closed={closed[k]} onPull={()=>setClosed(c=>({...c,[k]:!c[k]}))}/>)}</>;
}
