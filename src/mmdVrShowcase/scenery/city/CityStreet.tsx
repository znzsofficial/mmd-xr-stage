import {useEffect,useLayoutEffect,useMemo} from 'react';
import {RepeatWrapping} from 'three';
import {campusPassageParts,schoolExterior} from '../CampusLayout';
import {ROOM} from '../ClassroomLayout';
import {arcadeParts,distantLido,LIDO_ENTRY,POOL,POOL_ORIGIN} from '../LidoLayout';
import {LidoPlates} from '../LidoPlates';
import {Batch} from '../SceneryBatch';
import {SchoolBrickWalk} from '../SchoolBrickWalk';
import {GardenEntrance} from '../clinic/GardenEntrance';
import {CLINIC_ORIGIN} from '../clinic/clinicApproach';
import {BlockFront,lidoTimingView} from '../routes/campusArcade/Street';
import {noPick} from '../sceneryPaint';
import {ParkTrees} from '../terminus/park/ParkTrees';
import {useBakedSurface} from '../useBakedSurface';
import lesson from '../class-lesson.webp';
import {CITY_ORIGINS} from './site';
import {StreetShops} from './StreetShops';
import {buildStreetGround,inReturnView,venueOnStreet,type StreetRoom} from './streetGround';
import {cityStreetTrees} from './streetFurniture';
import {SportsStreetLandmark} from './SportsStreetLandmark';

function SchoolFront({shadows}:{shadows:boolean}){
  const {x,z}=CITY_ORIGINS.classroom,parts=useMemo(()=>schoolExterior('classroom').concat(campusPassageParts('classroom')),[]);
  const board=useBakedSurface(lesson);
  useLayoutEffect(()=>{if(board){board.offset.set(.001,.502);board.repeat.set(.998,.496);}},[board]);
  return <group name="city:school-front" position={[x,0,z]}>
    <Batch name="city:school-porch-and-lesson-room" parts={parts} casts={shadows}/>
    <SchoolBrickWalk shadows={shadows}/>
    {board&&<mesh position={[-.70,1.97,-ROOM.d/2+.181]} raycast={noPick}>
      <planeGeometry args={[5.8,1.394]}/><meshStandardMaterial map={board} roughness={.94}/></mesh>}
  </group>;
}

function LidoFront({shadows}:{shadows:boolean}){
  const {x,z}=CITY_ORIGINS.pool;
  const parts=useMemo(()=>{
    const finish=arcadeParts('pool').concat(lidoTimingView());
    for(const q of distantLido())finish.push({...q,p:[q.p[0]-POOL_ORIGIN.x,q.p[1],q.p[2]-POOL_ORIGIN.z]});
    // The original entry slab joins the deck; expose only the portion past
    // the shared deck edge. Its tile and gate prints continue across the seam.
    const end=LIDO_ENTRY.z+LIDO_ENTRY.d/2,start=POOL.deck.z+POOL.deck.d/2;
    finish.push({p:[LIDO_ENTRY.x,-.114,(start+end)/2],s:[LIDO_ENTRY.w,.25,end-start],color:'#e4d7bf'});
    return finish;
  },[]);
  return <group name="city:lido-front" position={[x,0,z]}>
    <Batch name="city:lido-ticket-pier-and-finish" parts={parts} casts={shadows}/><LidoPlates pool city/>
  </group>;
}

function StreetSurface({room}:{room:StreetRoom}){
  const geometry=useMemo(()=>buildStreetGround(room),[room]),map=useBakedSurface('/scenery/terminus/park-paving.webp');
  useEffect(()=>()=>{geometry.earth.dispose();geometry.paving.dispose();},[geometry]);
  useLayoutEffect(()=>{if(map){map.wrapS=map.wrapT=RepeatWrapping;map.needsUpdate=true;}},[map]);
  return <group name="city:ground" userData={{parkLeafShadeReceiver:true,playerCollision:false}}>
    <mesh name="city:reclaimed-blocks" geometry={geometry.earth} raycast={noPick} receiveShadow>
      <meshStandardMaterial vertexColors roughness={.96}/></mesh>
    <mesh name="city:joined-pavements" geometry={geometry.paving} raycast={noPick} receiveShadow>
      <meshStandardMaterial key={map?'granite':'plain'} map={map} vertexColors roughness={.87} color={map?'white':'#d7cfbc'}/></mesh>
  </group>;
}

/** Station city coordinates outside; the same threshold, signs and opposite
 * shop windows in room-local metres inside. No borrowed room runtime. */
export function CityStreet({shadows,room='seasideTerminus'}:{shadows:boolean;room?:StreetRoom}){
  const outdoors=room==='seasideTerminus',origin=outdoors?{x:0,z:0}:CITY_ORIGINS[room];
  const trees=useMemo(()=>cityStreetTrees.filter(t=>inReturnView(room,t.x,t.z)),[room]);
  const needsFront=(venue:keyof typeof CITY_ORIGINS)=>room!==venue&&venueOnStreet(room,venue);
  const clinic=CITY_ORIGINS.clinic;
  return <group name="city:street" position={[-origin.x,0,-origin.z]} pointerEvents="none">
    <StreetSurface room={room}/><StreetShops room={room} shadows={shadows}/>
    {needsFront('clinic')&&<group name="city:clinic-front" position={[clinic.x,0,clinic.z]}>
      <group position={[-CLINIC_ORIGIN.x,0,-CLINIC_ORIGIN.z]}><GardenEntrance lawn city shadows={shadows}/></group></group>}
    {needsFront('classroom')&&<SchoolFront shadows={shadows}/>}
    {needsFront('pool')&&<LidoFront shadows={shadows}/>}
    {needsFront('arcadeHall')&&<BlockFront name="city:arcade-front" origin={CITY_ORIGINS.arcadeHall} shadows={shadows}/>}
    <SportsStreetLandmark room={room} shadows={shadows}/>
    {trees.length>0&&<ParkTrees trees={trees} shadows={shadows}/>}
  </group>;
}
