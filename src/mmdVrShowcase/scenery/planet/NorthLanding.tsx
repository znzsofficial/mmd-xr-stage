import {useEffect,useMemo} from 'react';
import {type Texture} from 'three';
import {useBakedSurface} from '../useBakedSurface';
import {paintedSurface} from '../sceneryPaint';
import roseUrl from './landing-rose.webp';
import {dialRadius,engraveNorthDial,northBezel} from './departureDial';
import {opalGrain} from './surfaceGrain';

export function NorthLanding({grain}:{grain:Texture|null}){
  const rose=useBakedSurface(roseUrl),bezel=useMemo(northBezel,[]),finish=useMemo(()=>opalGrain(grain,.38),[grain]);
  const dial=useMemo(()=>{const image=rose?.image;return image instanceof HTMLImageElement?paintedSurface(1024,1024,c=>engraveNorthDial(c,1024,image)):null;},[rose]);
  useEffect(()=>()=>bezel.dispose(),[bezel]);useEffect(()=>()=>dial?.dispose(),[dial]);
  return <group name="planet:north-landing" userData={{playerCollision:false}}>
    <mesh name="planet:compass-bezel" geometry={bezel}><meshStandardMaterial vertexColors roughness={.54} metalness={.27}/></mesh>
    <mesh name="planet:departure-compass" rotation-x={-Math.PI/2}><circleGeometry args={[dialRadius,144]}/>
      <meshStandardMaterial key={grain?.uuid} onBeforeCompile={finish} map={dial} color={dial?'#ffffff':'#495e67'} roughness={.72}/></mesh>
  </group>;
}
