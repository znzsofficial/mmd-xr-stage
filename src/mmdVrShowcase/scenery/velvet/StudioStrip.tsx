import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {Color,Object3D,Vector3} from 'three';
import {createPanelTexture} from '../../../shared/panelTexture';
import {useLanguageStore} from '../../../languageStore';
import {useSceneAction} from '../input/useSceneAction';
import {velvetDeskSight,velvetPlan} from './velvetLayout';
import {advanceVelvetLight,getVelvetLight,stripAim,stripX,stripY,stripZ,subscribeVelvetLight,type StripControl,type VelvetLightState} from './velvetLight';

const noPlayer={playerCollision:false};
function Strip({state}:{state:VelvetLightState}){
  const x=stripX(state),orientation=useMemo(()=>{
    const obj=new Object3D();obj.position.set(x,stripY,stripZ);obj.lookAt(new Vector3(...stripAim));return obj.quaternion;
  },[x]);
  return <group name="velvet:rail-carriage" position={[x,0,stripZ]} pointerEvents="none">
    <mesh position-y={3.47}><boxGeometry args={[.26,.095,.22]}/><meshStandardMaterial color="#71636a" metalness={.38} roughness={.42}/></mesh>
    <mesh position-y={3.104}><cylinderGeometry args={[.034,.034,.70,12]}/><meshStandardMaterial color="#927a75" metalness={.48} roughness={.36}/></mesh>
    <group position-y={stripY} quaternion={orientation} name="velvet:strip-head">
      <mesh><boxGeometry args={[.35,.91,.22]}/><meshStandardMaterial color="#3d3944" roughness={.54}/></mesh>
      <mesh position-z={.116} userData={noPlayer}><boxGeometry args={[.304,.862,.014]}/><meshBasicMaterial color={new Color(['#bdaca2','#ffdebd','#fff5e7'][state.power])} toneMapped={false}/></mesh>
      {[-1,1].map(k=><mesh key={k} position={[k*.199,0,.138]} rotation-y={k*.62} userData={noPlayer}><boxGeometry args={[.107,.91,.016]}/><meshStandardMaterial color="#625962" metalness={.22} roughness={.47}/></mesh>)}
      {[-.27,-.19,.19,.27].map(y=><mesh key={y} position={[0,y,-.115]} userData={noPlayer}><boxGeometry args={[.226,.014,.012]}/><meshStandardMaterial color="#95837f" metalness={.42}/></mesh>)}
    </group>
  </group>;
}
function Control({kind,value}:{kind:StripControl;value:number}){
  const language=useLanguageStore(s=>s.language),zh=language==='zh';
  const {hovered:hover,bindings}=useSceneAction('velvetStudio',velvetDeskSight,()=>advanceVelvetLight(kind));
  const map=useMemo(()=>createPanelTexture(400,170,({ctx:c})=>{
    c.fillStyle=hover?'#61494d':'#41363e';c.fillRect(0,0,400,170);
    c.strokeStyle='#b4967c';c.lineWidth=3;c.strokeRect(6,6,388,158);
    c.fillStyle='#e0c6a9';c.font='600 35px system-ui,sans-serif';c.fillText(kind==='rail'?(zh?'灯轨位置':'SLIDE RAIL'):(zh?'灯光强度':'OUTPUT'),24,54);
    const values=kind==='rail'?(zh?['左','中','右']:['Left','Center','Right']):(zh?['柔','标准','强']:['Low','Normal','High']);
    c.fillStyle='#fff0d6';c.font='500 48px system-ui,sans-serif';c.fillText(values[value],24,124);
    for(let i=0;i<3;i++){c.fillStyle=i===value?'#f3cea2':'#877274';c.fillRect(256+i*38,103,26,9);}
  },language),[language,zh,kind,value,hover]);
  useEffect(()=>()=>map.dispose(),[map]);
  return <mesh name={`velvet:control:${kind}`} position={[kind==='rail'?-.221:.221,0,0]} userData={noPlayer} {...bindings}>
    <planeGeometry args={[.422,.199]}/><meshBasicMaterial map={map} toneMapped={false}/>
  </mesh>;
}
export function StudioStrip(){
  const state=useSyncExternalStore(subscribeVelvetLight,getVelvetLight);
  const {x,z}=velvetPlan.console;
  // A carriage change invalidates the player-column cache via child events;
  // a dimmer step retains the same jump/head-clearance geometry.
  return <><Strip key={state.rail} state={state}/><group name="velvet:strip-desk" position={[x,1.213,z+.154]} rotation-x={-.19}>
    <Control kind="rail" value={state.rail}/><Control kind="power" value={state.power}/>
  </group></>;
}
