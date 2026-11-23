import {useEffect,useMemo} from 'react';
import {Float32BufferAttribute,Vector3} from 'three';
import {noPick} from '../sceneryPaint';
import {useBakedSurface} from '../useBakedSurface';
import {moonShell} from './moonSurface';
import {amberMoon,sunDirection} from './windAtlas';
import inclusions from './amber-inclusions.webp';

/** A single opaque shell; fine fossil veins are a filtered surface print,
 * rather than transparent shells competing for depth in stereo. */
export function AmberIslet(){
  const map=useBakedSurface(inclusions),g=useMemo(()=>{
    const geometry=moonShell(amberMoon),n=geometry.attributes.normal,colors=new Float32Array(n.count*3),v=new Vector3();
    for(let i=0;i<n.count;i++){
      const day=v.fromBufferAttribute(n,i).dot(sunDirection),light=.27+.68*Math.max(0,day)+.08*day;
      colors[3*i]=light;colors[3*i+1]=light*(.95+.05*day);colors[3*i+2]=light*(.91+.09*day);
    }
    geometry.setAttribute('color',new Float32BufferAttribute(colors,3));return geometry;
  },[]);useEffect(()=>()=>g.dispose(),[g]);
  return <mesh name="planet:moon-amber" position={amberMoon.centre} geometry={g} raycast={noPick} userData={{playerCollision:false}}>
    <meshBasicMaterial vertexColors color={map?'white':'#d99052'} map={map} fog={false}/>
  </mesh>;
}
