import {useEffect,useMemo} from 'react';
import {Color,Float32BufferAttribute,Vector3,type Texture} from 'three';
import {noPick} from '../sceneryPaint';
import {micaStrata,moonShell,sulfurLobes} from './moonSurface';
import {steppingMoons,sunDirection,type SteppingMoon} from './windAtlas';
import {stoneFinish} from './steppingMinerals';

// Two small field samples: silvery split sheets with ink-dark partings,
// and soft yellow concretions in an ochre matrix. One static draw per body;
// the broad structures underneath the deposit colour are also walkable.
type MineralIslet=Extract<SteppingMoon,{id:'mica'|'sulfur'}>;
function stone(m:MineralIslet){
  const g=moonShell(m),p=g.attributes.position,n=g.attributes.normal,colors=new Float32Array(3*p.count);
  const up=new Vector3(),normal=new Vector3(),c=new Color(),mica=m.id==='mica';
  const dark=new Color(mica?'#3a5563':'#93613d'),mid=new Color(mica?'#7aabac':'#dcc168'),light=new Color(mica?'#d8e6da':'#faf0a1');
  for(let i=0;i<p.count;i++){
    const {x,y,z}=up.fromBufferAttribute(p,i).normalize();
    if(mica){
      const bed=micaStrata(x,y,z),seam=Math.cos(bed*Math.PI*2+.14*Math.sin(12*z));
      c.copy(mid).lerp(light,.64*Math.max(0,seam)**2).lerp(dark,.88*Math.max(0,-seam)**1.2);
    }else{
      const lode=sulfurLobes(x,y,z),pore=Math.sin(24*x-8*y)*Math.cos(17*z+6*x);
      c.copy(mid).lerp(dark,Math.min(1,Math.max(0,-lode+.17*pore))).lerp(light,.78*Math.min(1,Math.max(0,lode+.15*pore)));
    }
    const day=normal.fromBufferAttribute(n,i).dot(sunDirection);
    c.multiplyScalar(.18+.89*Math.max(0,day)+.09*(day+1)).toArray(colors,3*i);
  }
  g.setAttribute('color',new Float32BufferAttribute(colors,3));return g;
}
const micaDefines={MICA_CLEAVAGE:1};
function Stone({moon,grain}:{moon:MineralIslet;grain:Texture|null}){
  const g=useMemo(()=>stone(moon),[moon]),detail=useMemo(()=>stoneFinish(grain,moon.id==='mica'?1.2:.84),[grain,moon]);useEffect(()=>()=>g.dispose(),[g]);
  return <mesh name={'planet:moon-'+moon.id} position={moon.centre} geometry={g} raycast={noPick}><meshBasicMaterial key={grain?.uuid} defines={moon.id==='mica'?micaDefines:undefined} vertexColors fog={false} onBeforeCompile={detail}/></mesh>;
}
export function SteppingMoons({grain=null}:{grain?:Texture|null}){return <group name="planet:stepping-moons" pointerEvents="none" userData={{playerCollision:false}}>{steppingMoons.map(m=>m.id==='amber'?null:<Stone key={m.id} moon={m} grain={grain}/>)}</group>;}
