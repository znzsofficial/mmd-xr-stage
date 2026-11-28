import {useEffect,useMemo} from 'react';
import {PlaneGeometry} from 'three';
import {BenchReel} from '../../play/kite/KiteStation';
import {addGardenBench,GardenBenchGrain} from '../GardenBench';
import {Batch,type Part} from '../SceneryBatch';
import {noPick} from '../sceneryPaint';
import {useBakedSurface} from '../useBakedSurface';
import {cityGreenDeck,CITY_KITE_SEAT} from './green';

export function CityGreen({shadows=true}:{shadows?:boolean}){
  const {x,z,w,d,y}=cityGreenDeck;
  const grass=useBakedSurface('/scenery/terminus/park-shops.webp');
  const ground=useMemo(()=>{
    // Use the coastal park's cut grass and clover, without its shop signs in
    // adjacent atlas cells. The patch meets street paving at its own edges.
    const geometry=new PlaneGeometry(w,d),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(2.02+.96*uv.getX(i))/3,(.02+.96*uv.getY(i))/4);
    return geometry.rotateX(-Math.PI/2);
  },[w,d]);
  useEffect(()=>()=>ground.dispose(),[ground]);
  const bench=useMemo(()=>{
    const boards:Part[]=[],rails:Part[]=[];
    addGardenBench(CITY_KITE_SEAT,boards,rails);
    return {boards,rails};
  },[]);
  return <group name="city:kite-green" pointerEvents="none">
    <mesh name="city:green-turf" position={[x,y,z]} geometry={ground} raycast={noPick} receiveShadow userData={{playerCollision:false}}>
      <meshStandardMaterial key={grass?'printed':'plain'} map={grass} color={grass?'white':'#92a477'} roughness={.97}/>
    </mesh>
    <Batch name="city:kite-bench" parts={bench.boards} casts={shadows}/>
    <Batch name="city:kite-bench-arms" parts={bench.rails} round casts={shadows}/>
    <GardenBenchGrain seat={CITY_KITE_SEAT}/>
    <BenchReel seat={CITY_KITE_SEAT} height={.576} showIdle/>
  </group>;
}
