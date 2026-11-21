import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Box3,Ray,Vector3,type Group} from 'three';
import {useLanguageStore} from '../../../languageStore';
import {useBackpack} from '../../backpack';
import {PaintedParts,box,rod,turn} from '../../play/modelParts';
import {useSceneAction} from '../input/useSceneAction';
import {noPick,paintedSurface} from '../sceneryPaint';
import {cutStep,sampleBit,sampleInk,surveySight,surveySites,type SurveyPlace,type SurveyState} from './opalSurvey';

const noPlayer={playerCollision:false};
const stops=['dial','aqua','coral'] as const;
const width=1.12,height=.50,chipX=-.353,chipY=-.018;
const uiFont='"Microsoft YaHei",system-ui,sans-serif';
function legend(place:SurveyPlace,s:SurveyState,zh:boolean){
  const n=(s.samples&1)+(s.samples>>1),got=place!=='dial'&&Boolean(s.samples&sampleBit[place]);
  if(place==='dial'){
    if(s.held)return zh?[`插回晶片 · 亮 ${n} 柱`,n?'也可继续沿脊采色':'沿白脊到矿簇转片']: [`Dock chip · ${n} lit`,n?'Or follow the seam for more':'Turn chip at a seam reader'];
    if(n)return zh?['取片并清空','测星柱正显示所采颜色']:['Lift chip to clear','Samples light the twin columns'];
    return zh?['点按取测晶片','沿白脊采色，再插回此处']:['Take survey chip','Follow white seam; bring chip back'];
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
    const x=560+chipX*1000,y=250-chipY*1000;
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
      c.font=`600 30px ${uiFont}`;c.fillText(badges[i],480+i*270,432);
    }
  });
}

function cradle(place:SurveyPlace){
  const parts=new PaintedParts(),s=surveySites[place];
  if(place==='dial'){
    parts.add(turn([[0,-.25],[.26,-.25],[.27,.035],[.20,.096],[.14,.20],[.13,.27],[0,.27]],12),'#617470');
  }else{
    // Brackets bolted into the existing mineral foot, not spindly freestanding signs.
    for(const side of [-1,1]){
      parts.add(rod([side*.18,.14,s.r-.32],[side*.36,s.height-.07,s.r-.07],.043,.030,8),'#82775f');
    }
  }
  parts.add(box(0,0,-.027,width+.024,height+.026,.053).rotateX(s.tilt).translate(0,s.height,s.r),'#897d64');
  return parts.finish();
}
function Reader({place,state,activate}:{place:SurveyPlace;state:SurveyState;activate:(p:SurveyPlace)=>void}){
  const zh=useLanguageStore(s=>s.language==='zh'),s=surveySites[place],dial=place==='dial';
  const scratch=useMemo(()=>({ray:new Ray(),bounds:new Box3(),size:new Vector3(),p:new Vector3()}),[]);
  const sight=(from:Vector3,hit:Vector3)=>{
    if(!surveySight(from,hit))return false;
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
  const print=useMemo(()=>facePrint(place,state,zh),[place,state,zh]),body=useMemo(()=>cradle(place),[place]);
  useEffect(()=>()=>print.dispose(),[print]);useEffect(()=>()=>body.dispose(),[body]);
  const lens=useRef<Group>(null),eye=useMemo(()=>new Vector3(),[]);
  useFrame(({camera,gl})=>{
    if(!lens.current)return;
    (gl.xr.isPresenting?gl.xr.getCamera():camera).getWorldPosition(eye);
    lens.current.visible=dial?!state.held:state.held&&eye.distanceToSquared(s.lens)<4.45**2;
  });
  const stripe=dial?(state.samples&1?sampleInk.aqua:state.samples&2?sampleInk.coral:'#555e5c'):state.samples&sampleBit[place]?sampleInk[place]:'#505e5c';
  return <group name={`survey:site-${place}`} position={s.base} quaternion={s.q}>
    <mesh geometry={body} userData={noPlayer} raycast={noPick} pointerEvents="none"><meshStandardMaterial vertexColors roughness={.65} metalness={.26}/></mesh>
    <group position={[0,s.height,s.r]} rotation-x={s.tilt}>
      <mesh name={`survey:read-${place}`} userData={noPlayer} {...bindings}>
        <planeGeometry args={[width,height]}/><meshBasicMaterial map={print} color={hovered?'#ffffff':'#ebefe9'} toneMapped={false}/>
      </mesh>
      <group ref={lens} name={`survey:chip-${place}`} position={[chipX,chipY,.008]} rotation-z={(dial?0:state.step)*Math.PI/6} pointerEvents="none">
        <mesh rotation-x={Math.PI/2} userData={noPlayer} raycast={noPick}><cylinderGeometry args={[.098,.107,.022,8]}/><meshStandardMaterial color="#d5ddc8" roughness={.33} metalness={.17}/></mesh>
        <mesh position-z={.012} userData={noPlayer} raycast={noPick}><boxGeometry args={[.192,.012,.002]}/><meshBasicMaterial color={stripe} toneMapped={false}/></mesh>
        {dial&&state.samples===3&&<mesh position={[0,.021,.012]} userData={noPlayer} raycast={noPick}><boxGeometry args={[.16,.010,.002]}/><meshBasicMaterial color={sampleInk.coral} toneMapped={false}/></mesh>}
      </group>
    </group>
  </group>;
}
export function OpalSampler({state,activate}:{state:SurveyState;activate:(p:SurveyPlace)=>void}){
  return <>{stops.map(p=><Reader key={p} place={p} state={state} activate={activate}/>)}</>;
}
