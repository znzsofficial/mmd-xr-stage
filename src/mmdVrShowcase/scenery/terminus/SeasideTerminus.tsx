import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Box3,Ray,Vector3,type Group} from 'three';
import {Batch} from '../SceneryBatch';
import {noPick,paintedSurface} from '../sceneryPaint';
import {useSceneAction} from '../input/useSceneAction';
import {useBackpack} from '../../backpack/store';
import {createTideClock,ebbLevel,floodLevel} from './tideClock';
import {stationParts} from './stationParts';
import {gauge,shoreSight,sign} from './shoreLayout';
import {HarbourWater} from './HarbourWater';
import {PlatformFinish,StationClock,TicketOfficePrint} from './platformFinish';
import {Headlands} from './coastline';
import {WaitingBay} from './WaitingBay';

function stationPrint(){return paintedSurface(1024,380,c=>{
  c.fillStyle='#eeefe9';c.fillRect(0,0,1024,380);c.fillStyle='#235653';c.fillRect(10,10,1004,5);c.fillRect(10,365,1004,5);
  c.fillStyle='#356459';c.fillRect(0,248,1024,112);c.fillStyle='#efe9d5';c.font='500 39px system-ui';c.fillText('←　海 岬',68,320);c.textAlign='right';c.fillText('终 点　•',958,320);
  c.textAlign='center';c.fillStyle='#253f3c';c.font='bold 105px SimSun,serif';c.fillText('海 边 终 点 站',512,151);c.font='500 35px system-ui';c.fillText('S E A S I D E   T E R M I N U S',512,216);
});}
function timetable(){return paintedSurface(480,600,c=>{c.fillStyle='#eadfc5';c.fillRect(0,0,480,600);c.fillStyle='#315952';c.fillRect(11,12,458,92);c.fillStyle='#f5eedb';c.textAlign='center';c.font='bold 42px serif';c.fillText('海 岸 线',240,72);c.fillStyle='#34534a';c.font='bold 30px system-ui';c.fillText('DEPARTURES',240,160);
  const times=['06:18','08:42','11:16','13:40','16:12','18:28'];for(let i=0;i<6;i++){const y=215+53*i;c.fillStyle='#c3baa1';c.fillRect(34,y+15,412,2);c.fillStyle='#394d45';c.textAlign='left';c.font='28px monospace';c.fillText(times[i],48,y);c.font='22px serif';c.fillText(i%2?'各站停靠':'往海岬',225,y);}
  c.fillStyle='#b26949';c.fillRect(36,545,408,5);
});}
function dialPrint(){return paintedSurface(384,268,c=>{c.fillStyle='#eae0c3';c.fillRect(0,0,384,268);c.strokeStyle='#335954';c.lineWidth=5;c.strokeRect(7,7,370,254);
  for(let i=0;i<=12;i++){const a=Math.PI*(1.1+.8*i/12);c.beginPath();c.moveTo(192+136*Math.cos(a),164+130*Math.sin(a));c.lineTo(192+(i%3?125:115)*Math.cos(a),164+(i%3?120:107)*Math.sin(a));c.stroke();}
  c.fillStyle='#374e45';c.font='bold 23px system-ui';c.fillText('LOW',28,159);c.fillText('HIGH',286,159);c.textAlign='center';c.font='bold 30px system-ui';c.fillText('拨潮  /  TIDE',192,224);
});}
function Signage(){const board=useMemo(stationPrint,[]),print=useMemo(timetable,[]);useEffect(()=>()=>{board.dispose();print.dispose();},[board,print]);return <>
  {[-1,1].map(s=><mesh key={s} position={[sign.x,1.85,sign.z+s*.06]} rotation-y={s<0?Math.PI:0} raycast={noPick}><planeGeometry args={[2.09,.774]}/><meshStandardMaterial map={board} roughness={.38}/></mesh>)}
  <mesh position={[1.84,1.39,-.919]} rotation-y={Math.PI} raycast={noPick}><planeGeometry args={[.77,.96]}/><meshStandardMaterial map={print} roughness={.75}/></mesh></>;}
function Sounder({clock}:{clock:ReturnType<typeof createTideClock>}){
  const print=useMemo(dialPrint,[]),needle=useRef<Group>(null),tmp=useMemo(()=>({ray:new Ray(),box:new Box3(),a:new Vector3(),b:new Vector3()}),[]);
  useEffect(()=>()=>print.dispose(),[print]);const {bindings,hovered}=useSceneAction('seasideTerminus',(a,b)=>{
    const d=a.distanceTo(b);if(d>4||a.z<gauge.z+.076||!shoreSight(a,b.x,b.y,b.z,true))return false;
    tmp.ray.set(a,tmp.a.subVectors(b,a).normalize());for(const live of Object.values(useBackpack.getState().live))if(live.visible&&live.bounds){tmp.box.setFromCenterAndSize(tmp.a.fromArray(live.bounds.center),tmp.b.fromArray(live.bounds.size));if(tmp.box.containsPoint(a)||(tmp.ray.intersectBox(tmp.box,tmp.a)&&tmp.a.distanceTo(a)<d-.015))return false;}return true;
  },()=>clock.turn());useFrame(()=>{if(needle.current)needle.current.rotation.z=Math.PI*(.89-.78*(clock.level-ebbLevel)/(floodLevel-ebbLevel));});
  return <group position={[gauge.x,1.02,gauge.z+.079]}><mesh name="terminus:tide-dial" {...bindings}><planeGeometry args={[.414,.29]}/><meshBasicMaterial map={print} color={hovered?'white':'#eee9d9'} toneMapped={false}/></mesh>
    <group ref={needle} position={[0,-.034,.003]} pointerEvents="none"><mesh position-x={.065} raycast={noPick}><boxGeometry args={[.13,.009,.005]}/><meshBasicMaterial color="#b45737"/></mesh></group></group>;
}
export function SeasideTerminus({shadows}:{shadows:boolean}){const p=useMemo(stationParts,[]),clock=useMemo(createTideClock,[]);
  return <group name="scenery:seaside-terminus"><group pointerEvents="none">
    <Batch name="terminus:enamelled-ironwork" parts={p.enamel} roughness={.39} casts={shadows}/><Batch name="terminus:track-and-joinery" parts={p.trim} casts={shadows}/>
    <Batch name="terminus:tubular-iron" parts={p.tubes} round roughness={.39}/><Batch name="terminus:lamp-glass" parts={p.glow} lit/>
    <Batch name="terminus:breakwater-and-headland" parts={p.land} foliage/><Batch name="terminus:windbreak" parts={p.pines} foliage/>
    <PlatformFinish shadows={shadows}/><WaitingBay shadows={shadows}/><StationClock/><TicketOfficePrint/><Headlands/><Signage/><HarbourWater clock={clock}/></group><Sounder clock={clock}/></group>;
}
