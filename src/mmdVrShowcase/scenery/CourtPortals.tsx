import {useEffect,useMemo} from 'react';
import {BufferGeometry, Color, DoubleSide, Float32BufferAttribute, type Texture} from 'three';
import {useLanguageStore} from '../../languageStore';
import {useMmdVrStore} from '../mmdVrStore';
import {SCENERY,portalHall} from './catalog';
import {courtPortals,canReadPortal} from './portalLayout';
import {useSceneAction} from './input/useSceneAction';
import {paintedSurface,noPick} from './sceneryPaint';
import {useBakedSurface} from './useBakedSurface';
import views from './portal-views.webp';

// Each gate is a bevelled bronze door clipped to its arched opening. The six
// views are crops of the real empty sets, not six more mounted WebGL rooms.
function outline(r:number,bottom:number){
  const edge=[[r,bottom]];
  for(let i=0;i<=20;i++){const a=Math.PI*i/20;edge.push([r*Math.cos(a),1.60+1.10*r*Math.sin(a)]);}
  edge.push([-r,bottom]);return edge;
}
function surround(){
  const pts:number[]=[],colors:number[]=[],ink=new Color();
  const bands=[{r:.55,y:.31,z:-.15,color:'#253d4a'},{r:.71,y:.07,z:-.15,color:'#60757d'},
    {r:.71,y:.07,z:.09,color:'#a69d87'},{r:.684,y:.10,z:.146,color:'#ccad75'},{r:.64,y:.145,z:.148,color:'#665452'},
    {r:.622,y:.167,z:.128,color:'#719e9b'},{r:.586,y:.21,z:.128,color:'#d7b67f'},{r:.55,y:.26,z:.087,color:'#443e47'}];
  for(let j=0;j<bands.length;j++){
    const a=bands[j],b=bands[(j+1)%bands.length],A=outline(a.r,a.y),B=outline(b.r,b.y);ink.set(a.color);
    for(let i=0;i<A.length;i++) {const n=(i+1)%A.length;for(const [xy,z] of [[A[i],a.z],[A[n],a.z],[B[n],b.z],[A[i],a.z],[B[n],b.z],[B[i],b.z]] as const){pts.push(xy[0],xy[1],z);colors.push(ink.r,ink.g,ink.b);}}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pts,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function pane(cell:number){
  const p:number[]=[],uv:number[]=[],shape=outline(.555,.255);
  for(let i=0;i<shape.length;i++)for(const [x,y] of [[0,1.13],shape[i],shape[(i+1)%shape.length]]){
    p.push(x,y,.083);uv.push((cell%3+.007+.986*(x/1.11+.5))/3,(1-Math.floor(cell/3)+.007+.986*((y-.255)/1.956))/2);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
function Door({gate,map,frame}:{gate:typeof courtPortals[number];map:Texture|null;frame:BufferGeometry}){
  const t=useLanguageStore(s=>s.t),name=gate.room==='liveHouse'?'Live House':t(gate.room==='floor'?'portalPost':SCENERY[gate.room].label);
  const plate=useMemo(()=>paintedSurface(512,98,g=>{
    g.fillStyle='#1b333c';g.fillRect(0,0,512,98);g.strokeStyle='#d2b78a';g.lineWidth=3;g.strokeRect(5,5,502,88);
    g.fillStyle='#fbefd8';g.textAlign='center';g.textBaseline='middle';g.font='600 66px system-ui,sans-serif';g.fillText(name,256,48,476);
  }),[name]);
  const face=useMemo(()=>pane(gate.cell),[gate]);
  useEffect(()=>()=>plate.dispose(),[plate]);useEffect(()=>()=>face.dispose(),[face]);
  const {bindings,hovered}=useSceneAction(portalHall,(from,hit)=>canReadPortal(gate,from,hit),()=>useMmdVrStore.getState().setPrefs({scenery:gate.room}));
  return <group position={[gate.x,0,gate.z]} rotation-y={gate.yaw}>
    <mesh geometry={frame} raycast={noPick}><meshStandardMaterial vertexColors side={DoubleSide} metalness={.25} roughness={.46}/></mesh>
    <mesh position-y={.10} raycast={noPick}><boxGeometry args={[gate.w,.20,gate.d]}/><meshStandardMaterial color="#556574"/></mesh>
    <mesh name={'portal:'+gate.room} geometry={face} {...bindings}>
      <meshBasicMaterial key={map?.uuid} map={map} color={hovered?'#ffffff':'#e7e3da'} toneMapped={false}/>
      <mesh position={[0,.55,.096]}><planeGeometry args={[1.08,.207]}/><meshBasicMaterial map={plate} toneMapped={false}/></mesh>
    </mesh>
    <mesh position={[0,0,-.065]} geometry={face} rotation-y={Math.PI} raycast={noPick}><meshStandardMaterial color="#4d656d" roughness={.75}/></mesh>
    <mesh position={[0,2.32,0]} scale={[.088,.13,.074]} raycast={noPick}><octahedronGeometry/><meshStandardMaterial color={hovered?'#ffe69d':'#95d6cb'}/></mesh>
  </group>;
}
export function CourtPortals(){
  const frame=useMemo(surround,[]),map=useBakedSurface(views);
  useEffect(()=>()=>frame.dispose(),[frame]);
  return <group name="court:portal-hall">{courtPortals.map(gate=><Door key={gate.room} gate={gate} frame={frame} map={map}/>)}</group>;
}
