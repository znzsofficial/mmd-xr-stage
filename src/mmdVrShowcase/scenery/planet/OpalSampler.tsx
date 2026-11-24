import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Box3,Mesh,Ray,Vector3,type Group} from 'three';
import {useLanguageStore} from '../../../languageStore';
import {useBackpack} from '../../backpack/store';
import {useSceneAction} from '../input/useSceneAction';
import {noPick,paintedSurface} from '../sceneryPaint';
import {cutStep,sampleBit,sampleInk,surveySight,surveySites,type SurveyPlace,type SurveyState} from './opalSurvey';
import {chipSeat,readerFace} from './surveyHardware';
import {readerHardware,surveyChip} from './surveyReaderModel';
import {windTerminalOccludes} from './windTerminalLayout';

const noPlayer={playerCollision:false};
const stops=['dial','aqua','coral'] as const;
const {width,height}=readerFace;
const uiFont='"Microsoft YaHei",system-ui,sans-serif';
// Three's CPU raycast can visit invisible descendants. The physical chip is
// a child of the action face, so tapping its top or side releases the same action.
const pickChip:Mesh['raycast']=function(this:Mesh,ray,hits){if(this.parent?.visible)Mesh.prototype.raycast.call(this,ray,hits);};
function legend(place:SurveyPlace,s:SurveyState,zh:boolean){
  const n=(s.samples&1)+(s.samples>>1),got=place!=='dial'&&Boolean(s.samples&sampleBit[place]);
  if(place==='dial'){
    if(s.held)return zh?['插回晶片',n?`已采 ${n} 色 · 回插亮柱`:'白脊旁有两处矿簇']:['Dock chip',n?`${n} sampled · dock to light`:'Find both seams on the ridge'];
    if(n)return zh?['取片并清空','测星柱已亮']:['Lift chip to clear','Survey columns lit'];
    return zh?['取测晶片','沿白脊前往青晶矿簇']:['Take survey chip','Follow white ridge to aqua'];
  }
  if(!s.held)return zh?['先到罗盘取片','沿白脊回北台罗盘']:['Get the compass chip','Follow white seam to north deck'];
  if(got)return zh?[place==='aqua'?'青谱已收':'珊瑚谱已收',n===2?'沿白脊回罗盘插片':'可采另一色，或回罗盘']:['Sample recorded',n===2?'Return chip to the compass':'Try other reader or return chip'];
  return zh?['点按转片 30°','对齐外圈两道亮刻线']:['Turn chip 30°','Match the two outer notches'];
}
function facePrint(place:SurveyPlace,state:SurveyState,zh:boolean){
  const dial=place==='dial',index=dial?'00':place==='aqua'?'01':'02',ink=dial?'#e5d3a3':sampleInk[place];
  const titles=zh?{dial:'北台罗盘',aqua:'青晶矿簇',coral:'珊瑚矿簇'}:{dial:'North compass',aqua:'Aqua quartz',coral:'Coral quartz'};
  const [verb,hint]=legend(place,state,zh);
  return paintedSurface(1120,500,c=>{
    c.fillStyle='#243737';c.fillRect(0,0,1120,500);c.fillStyle='#172a2d';c.fillRect(0,0,392,500);
    c.strokeStyle='#788881';c.lineWidth=3;c.strokeRect(10,10,1100,480);
    for(const x of [26,1094])for(const y of [27,473]){c.fillStyle='#bdab87';c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();}
    c.fillStyle='#acc2bb';c.font=`500 29px ${uiFont}`;c.fillText(`OPAL   /   ${index}`,61,71);
    const x=(width/2+chipSeat.x)/width*1120,y=(height/2-chipSeat.y)/height*500;
    c.fillStyle='#132326';c.beginPath();c.arc(x,y,137,0,Math.PI*2);c.fill();
    for(let i=0;i<12;i++){
      const a=Math.PI*i/6,match=i%6===(dial?0:cutStep[place]);
      c.strokeStyle=match?ink:'#81928e';c.lineWidth=match?12:3;
      c.beginPath();c.moveTo(x+Math.cos(a)*104,y-Math.sin(a)*104);c.lineTo(x+Math.cos(a)*(match?155:129),y-Math.sin(a)*(match?155:129));c.stroke();
    }
    c.fillStyle=ink;c.font=`600 42px ${uiFont}`;c.fillText(titles[place],430,102,640);
    c.fillStyle='#f5f2df';c.font=`600 60px ${uiFont}`;c.fillText(verb,426,232,648);
    c.fillStyle='#d3ddd4';c.font=`500 40px ${uiFont}`;c.fillText(hint,428,324,650);
    c.fillStyle='#788b80';c.fillRect(429,370,629,2);
    const badges=zh?['青谱','珊瑚谱']:['AQUA','CORAL'];
    for(const [i,k] of (['aqua','coral'] as const).entries()){
      c.fillStyle=state.samples&sampleBit[k]?sampleInk[k]:'#63736e';c.fillRect(430+i*270,415,32,12);
      c.fillStyle=state.samples&sampleBit[k]?sampleInk[k]:'#b2c0b6';c.font=`600 32px ${uiFont}`;c.fillText(badges[i],480+i*270,432);
    }
  });
}

function Reader({place,state,activate}:{place:SurveyPlace;state:SurveyState;activate:(p:SurveyPlace)=>void}){
  const zh=useLanguageStore(s=>s.language==='zh'),s=surveySites[place],dial=place==='dial';
  const scratch=useMemo(()=>({ray:new Ray(),bounds:new Box3(),size:new Vector3(),p:new Vector3()}),[]);
  const sight=(from:Vector3,hit:Vector3)=>{
    if(!surveySight(from,hit)||windTerminalOccludes(from,hit,'home'))return false;
    // Imported actors/props on the landing can hide the dock. Use the same
    // visible world extents as the room, including scale / repositioning.
    const {ray,bounds,size,p}=scratch,len=from.distanceTo(hit);
    ray.set(from,p.subVectors(hit,from).normalize());
    for(const item of Object.values(useBackpack.getState().live))if(item.visible&&item.bounds){
      bounds.setFromCenterAndSize(p.fromArray(item.bounds.center),size.fromArray(item.bounds.size));
      if(bounds.containsPoint(from)||(ray.intersectBox(bounds,p)&&from.distanceTo(p)<len-.01))return false;
    }
    return true;
  };
  const {hovered,bindings}=useSceneAction('glassPlanet',sight,()=>activate(place));
  const print=useMemo(()=>facePrint(place,state,zh),[place,state,zh]),body=useMemo(()=>readerHardware(s),[s]);
  useEffect(()=>()=>print.dispose(),[print]);useEffect(()=>()=>body.dispose(),[body]);
  const lens=useRef<Group>(null),eye=useMemo(()=>new Vector3(),[]);
  useFrame(({camera,gl})=>{
    if(!lens.current)return;
    (gl.xr.isPresenting?gl.xr.getCamera():camera).getWorldPosition(eye);
    lens.current.visible=dial?!state.held:state.held&&eye.distanceToSquared(s.lens)<4.45**2;
  });
  const stripe=dial?(state.samples&1?sampleInk.aqua:state.samples&2?sampleInk.coral:'#555e5c'):state.samples&sampleBit[place]?sampleInk[place]:'#505e5c';
  const second=dial&&state.samples===3?sampleInk.coral:undefined;
  const chip=useMemo(()=>surveyChip(stripe,second),[stripe,second]);useEffect(()=>()=>chip.dispose(),[chip]);
  return <group name={`survey:site-${place}`} position={s.base} quaternion={s.q}>
    <mesh name={`survey:hardware-${place}`} geometry={body} userData={noPlayer} raycast={noPick} pointerEvents="none"><meshStandardMaterial vertexColors roughness={.65} metalness={.20}/></mesh>
    <group position={[0,s.height,s.r]} rotation-x={s.tilt}>
      <mesh name={`survey:read-${place}`} userData={noPlayer} {...bindings}>
        <planeGeometry args={[width,height]}/><meshStandardMaterial map={print} emissiveMap={print} emissive="#ffffff" emissiveIntensity={hovered ? .55 : .40} roughness={.84} metalness={.04}/>
        <group ref={lens} name={`survey:chip-${place}`} position={[chipSeat.x,chipSeat.y,0]} rotation-z={(dial?0:state.step)*Math.PI/6}>
          <mesh geometry={chip} userData={noPlayer} raycast={pickChip}><meshStandardMaterial vertexColors roughness={.40} metalness={.13}/></mesh>
        </group>
      </mesh>
    </group>
  </group>;
}
export function OpalSampler({state,activate}:{state:SurveyState;activate:(p:SurveyPlace)=>void}){
  return <>{stops.map(p=><Reader key={p} place={p} state={state} activate={activate}/>)}</>;
}
