import {useMemo,useEffect} from 'react';
import {PlaneGeometry} from 'three';
import {CAMPUS_OFFSET} from './CampusLayout';
import {POOL_ORIGIN} from './LidoLayout';
import {LAWN_SIZE} from './meadowLandmarks';
import ground from './meadow-walk.webp';
import {useBakedSurface} from './useBakedSurface';
import {noPick} from './sceneryPaint';

// Crop in meadow coordinates; keep the real path in place before and after a
// crossing. The school quadrangle and the pool basin are below this garden.
export function BorrowedMeadow({room}:{room:'classroom'|'pool'}){
  const map=useBakedSurface(ground),g=useMemo(()=>{
    const offset=room==='pool'?POOL_ORIGIN:CAMPUS_OFFSET;
    const [x0,x1,z0,z1]=room==='pool'?[-28,22,POOL_ORIGIN.z+7.75,24]:[-20,27,CAMPUS_OFFSET.z+5.65,24];
    const geo=new PlaneGeometry(x1-x0,z1-z0);geo.rotateX(-Math.PI/2);geo.translate((x0+x1)/2-offset.x,-.009,(z0+z1)/2-offset.z);
    const uv=geo.attributes.uv,p=geo.attributes.position;for(let i=0;i<p.count;i++)uv.setXY(i,.5+(p.getX(i)+offset.x)/LAWN_SIZE,.5-(p.getZ(i)+offset.z)/LAWN_SIZE);
    return geo;
  },[room]);useEffect(()=>()=>g.dispose(),[g]);
  return <mesh name="campus:borrowed-flower-walk" raycast={noPick} geometry={g}><meshStandardMaterial key={map?'print':'turf'} map={map} roughness={1} color={map?'white':'#98ab75'}/></mesh>;
}
