import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Box3,DoubleSide,Ray,Vector3,type Group,type Mesh,type BufferGeometry,type ShaderMaterial} from 'three';
import {useLanguageStore} from '../../../languageStore';
import {useBackpack} from '../../backpack';
import {PaintedParts,ball,box,ring,rod,turn} from '../../play/modelParts';
import {noPick,paintedSurface} from '../sceneryPaint';
import {useSceneAction} from '../input/useSceneAction';
import {TideCavern} from './TideCavern';
import {tideCentre,tideFloor,tideRadius,tideSolid} from './tideLayout';
import {createTideClock,ebbLevel,floodLevel,tideGauge as dial} from './tideClock';
import {reedCentre,reedRadius} from './reedBiosphere';
import {reedReflectionPrint} from './tideReedPrint';
import {tidePool,tideWaterVertex,tideWaterFragment} from './tideWater';
import {bindTide} from './tideSession';

const tilt=.56,yaw=-.95,seaBase=()=>tideCentre.y+tideRadius;
function dialPlate(zh:boolean){return paintedSurface(384,384,c=>{
  c.translate(192,192);c.fillStyle='#264340';c.fillRect(-192,-192,384,384);c.strokeStyle='#d3ba86';c.lineWidth=4;
  c.beginPath();c.arc(0,0,178,0,Math.PI*2);c.stroke();c.lineWidth=2;c.beginPath();c.arc(0,0,159,Math.PI*.89,2.11*Math.PI);c.stroke();
  for(let i=0;i<=16;i++){const a=Math.PI*(1.09+.82*i/16),s=Math.sin(a),k=Math.cos(a);c.beginPath();c.moveTo(k*154,s*154);c.lineTo(k*(i%4?144:131),s*(i%4?144:131));c.stroke();}
  c.textAlign='center';c.fillStyle='#eee2bf';c.font='600 36px system-ui,sans-serif';c.fillText(zh?'低':'L',-117,2);c.fillText(zh?'高':'H',117,2);
  c.font='600 48px system-ui,sans-serif';c.fillText(zh?'拨潮':'TURN TIDE',0,96,263);
});}
function gaugeBody(){const g=new PaintedParts();g.add(rod([0,-.98,0],[0,dial.top,0],.069,.065,12),'#716548');
  g.add(box(.069,-.14,0,.025,1.53,.097),'#d7c8a1');for(let i=0;i<15;i++)g.add(box(.085,-.83+i*.093,.010,.014,.011,i%3?.041:.071),'#31504d');
  const shell=turn([[0,-.135],[.153,-.11],[.218,-.045],[.25,-.02],[.25,.016],[.238,.024],[0,.012]],40);g.add(shell.rotateX(tilt).rotateY(yaw).translate(0,dial.top,0),'#a18c65');
  for(const [x,z] of [[-.11,-.13],[.11,.13]])g.add(rod([0,-.14,0],[x,-.86,z],.024,.020,6),'#456459');return g.finish();}

function TideSounder({clock}:{clock:ReturnType<typeof createTideClock>}){
  const zh=useLanguageStore(s=>s.language==='zh'),print=useMemo(()=>dialPlate(zh),[zh]),body=useMemo(gaugeBody,[]);
  const float=useRef<Group>(null),needle=useRef<Group>(null),base=seaBase(),scratch=useMemo(()=>({p:new Vector3(),d:new Vector3(),box:new Box3(),ray:new Ray()}),[]);
  const {hovered,bindings}=useSceneAction('glassPlanet',(from,to)=>{
    const {p,d,box,ray}=scratch,len=from.distanceTo(to);if(!Number.isFinite(len)||len>8)return false;
    d.subVectors(to,from).normalize();ray.set(from,d);
    for(const entry of Object.values(useBackpack.getState().live))if(entry.visible&&entry.bounds){
      box.setFromCenterAndSize(p.fromArray(entry.bounds.center),p.clone().fromArray(entry.bounds.size));
      if(box.containsPoint(from)||ray.intersectBox(box,p)&&p.distanceTo(from)<len-.01)return false;}
    for(let k=0;k<len-.04;k+=.055){p.copy(from).addScaledVector(d,k);
      // The face sits on its own pedestal. Skip only the last few cm around
      // its top, not intervening rock or the approach from under the dock.
      if(k>len-.34&&p.y>base+dial.top-.14&&Math.hypot(p.x-tideCentre.x-dial.x,p.z-tideCentre.z-dial.z)<.29)continue;
      if(tideSolid(p,0,.005)||p.y<base+tideFloor(p.x-tideCentre.x,p.z-tideCentre.z)-.008)return false;}
    return true;
  },()=>clock.turn());
  useFrame(()=>{if(float.current)float.current.position.y=clock.level;if(needle.current)needle.current.rotation.z=Math.PI*(.91-.82*(clock.level-ebbLevel)/(floodLevel-ebbLevel));});
  useEffect(()=>()=>print.dispose(),[print]);useEffect(()=>()=>body.dispose(),[body]);
  const hardware=useMemo(()=>{const p=new PaintedParts();p.add(ball(0,0,0,.116,.072,.116,12),'#d19967');p.add(ring(.10,.014,20).rotateX(Math.PI/2),'#fff0b5');return p.finish();},[]);
  useEffect(()=>()=>hardware.dispose(),[hardware]);
  return <group position={[dial.x,0,dial.z]} name="tide:sounder">
    <mesh geometry={body} raycast={noPick}><meshStandardMaterial vertexColors roughness={.56} metalness={.18}/></mesh>
    <group ref={float} position-y={ebbLevel}><mesh geometry={hardware} raycast={noPick}><meshStandardMaterial vertexColors roughness={.50}/></mesh></group>
    <group position-y={dial.top} rotation={[tilt,yaw,0,'YXZ']}><group position-y={.028} rotation-x={-Math.PI/2}>
      <mesh name="tide:turn-dial" {...bindings}><circleGeometry args={[.241,40]}/><meshBasicMaterial map={print} color={hovered?'#fffdf1':'#ebe5cd'} toneMapped={false} side={DoubleSide}/></mesh>
      <group ref={needle} position-z={.004} pointerEvents="none"><mesh position-x={.081} raycast={noPick}><boxGeometry args={[.162,.010,.007]}/><meshBasicMaterial color="#faaf68"/></mesh></group>
    </group></group>
  </group>;
}

export function TidalMoon(){
  const pool=useMemo(tidePool,[]),map=useMemo(reedReflectionPrint,[]),clock=useMemo(createTideClock,[]),water=useRef<Mesh<BufferGeometry,ShaderMaterial>>(null),shore=useRef<Group>(null);
  const scene=useThree(s=>s.scene);useLayoutEffect(()=>bindTide(scene,clock),[scene,clock]);
  const u=useMemo(()=>({moon:{value:reedCentre},sun:{value:new Vector3(-5,3.2,3.8).normalize()},radius:{value:reedRadius},water:{value:ebbLevel},clock:{value:0},reedPrint:{value:map}}),[map]);
  const eye=useMemo(()=>new Vector3(),[]);useFrame(({camera,gl},dt)=>{
    (gl.xr.isPresenting?gl.xr.getCamera():camera).getWorldPosition(eye);
    if(!water.current||!shore.current)return;
    shore.current.visible=eye.distanceToSquared(tideCentre)<28*28;if(!shore.current.visible)return;
    const level=clock.step(dt),uniforms=water.current.material.uniforms;water.current.position.y=level;
    // R3F preserves the material's own uniform cells. Updating the initial
    // props object moves the mesh but leaves the discard shoreline at ebb.
    uniforms.water.value=level;uniforms.clock.value+=Math.min(dt,.10);
  });
  useEffect(()=>()=>{pool.dispose();map.dispose();},[pool,map]);
  return <group name="tide:moon"><TideCavern clock={clock}/><group ref={shore} position={[tideCentre.x,seaBase(),tideCentre.z]} userData={{playerCollision:false}}>
    <mesh ref={water} position-y={ebbLevel} name="tide:pool" geometry={pool} renderOrder={1} raycast={noPick} pointerEvents="none">
      <shaderMaterial vertexShader={tideWaterVertex} fragmentShader={tideWaterFragment} uniforms={u} transparent depthWrite={false} side={DoubleSide} forceSinglePass/>
    </mesh><TideSounder clock={clock}/>
  </group></group>;
}
