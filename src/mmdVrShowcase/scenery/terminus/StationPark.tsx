import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {DoubleSide,type Mesh} from 'three';
import {noPick} from '../sceneryPaint';
import {useCoastalPrint} from './coastalPrints';
import {installParkStreetRange,parkArchitecture} from './parkArchitecture';
import {inlandEmbankment,parkPavement,parkPlanting,parkStreetFurniture,parkTreeGrates} from './parkGroundArt';
import {fountainCourt,parkTrees} from './parkLayout';
import {ParkFountain} from './park/ParkFountain';
import {ParkTrees} from './park/ParkTrees';

const shadeReceiver={parkLeafShadeReceiver:true};
const decorativeReceiver={playerCollision:false,parkLeafShadeReceiver:true};

export function StationPark({shadows}:{shadows:boolean}){
  const park=useMemo(()=>({architecture:parkArchitecture(),paving:parkPavement(),street:parkStreetFurniture(),
    garden:parkPlanting(),grates:parkTreeGrates(),foundation:inlandEmbankment()}),[]);
  const fronts=useRef<Mesh>(null),windows=useRef<Mesh>(null);
  useLayoutEffect(()=>{
    const clearFronts=installParkStreetRange(fronts.current!,park.architecture.solidRanges);
    const clearWindows=installParkStreetRange(windows.current!,park.architecture.printRanges);
    return ()=>{clearFronts();clearWindows();};
  },[park]);
  useEffect(()=>()=>{
    park.architecture.solid.dispose();park.architecture.prints.dispose();park.paving.dispose();park.foundation.dispose();
    park.street.oak.dispose();park.street.hardware.dispose();park.grates.dispose();park.garden.beds.dispose();park.garden.leaves.dispose();park.garden.turf.dispose();
  },[park]);
  const shops=useCoastalPrint('shops'),pavers=useCoastalPrint('paving'),oak=useCoastalPrint('timber');
  return <group name="terminus:station-park" pointerEvents="none">
    <mesh name="park:city-embankment" geometry={park.foundation} raycast={noPick} receiveShadow><meshStandardMaterial vertexColors roughness={.93}/></mesh>
    <mesh name="park:paving" geometry={park.paving} raycast={noPick} receiveShadow userData={decorativeReceiver}>
      <meshStandardMaterial key={pavers?'granite':'stone'} map={pavers} vertexColors roughness={.83} color={pavers?'white':'#d2c9b4'}/>
    </mesh>
    <mesh ref={fronts} name="park:shopfronts" geometry={park.architecture.solid} raycast={noPick} castShadow={shadows} receiveShadow><meshStandardMaterial vertexColors roughness={.73}/></mesh>
    <mesh ref={windows} name="park:shop-windows" geometry={park.architecture.prints} raycast={noPick} receiveShadow userData={{playerCollision:false}}>
      <meshStandardMaterial key={shops?'display':'glass'} map={shops} roughness={.60} vertexColors color={shops?'white':'#bfcec4'} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
    </mesh>
    <mesh name="park:street-furniture" geometry={park.street.hardware} raycast={noPick} castShadow={shadows} receiveShadow userData={shadeReceiver}><meshStandardMaterial vertexColors roughness={.53} metalness={.12}/></mesh>
    <mesh name="park:tree-grates" geometry={park.grates} raycast={noPick} castShadow={shadows} receiveShadow userData={decorativeReceiver}><meshStandardMaterial vertexColors roughness={.53} metalness={.12}/></mesh>
    <mesh name="park:oak-benches" geometry={park.street.oak} raycast={noPick} castShadow={shadows} receiveShadow userData={shadeReceiver}>
      <meshStandardMaterial key={oak?'wood':'plain'} map={oak} roughness={.56} color={oak?'white':'#a6825d'}/>
    </mesh>
    <mesh name="park:planted-borders" geometry={park.garden.beds} raycast={noPick} receiveShadow userData={shadeReceiver}><meshStandardMaterial vertexColors roughness={.9}/></mesh>
    <mesh name="park:lawns" geometry={park.garden.turf} raycast={noPick} receiveShadow userData={decorativeReceiver}><meshStandardMaterial key={shops?'turf':'grass'} map={shops} color={shops?'white':'#92a477'} roughness={.97}/></mesh>
    <mesh name="park:perennials" geometry={park.garden.leaves} raycast={noPick} receiveShadow userData={{playerCollision:false}}><meshStandardMaterial side={DoubleSide} vertexColors roughness={.89}/></mesh>
    <group position={[fountainCourt.x,0,fountainCourt.z]} pointerEvents="none"><ParkFountain shadows={shadows}/></group>
    <ParkTrees trees={parkTrees} shadows={shadows}/>
  </group>;
}
