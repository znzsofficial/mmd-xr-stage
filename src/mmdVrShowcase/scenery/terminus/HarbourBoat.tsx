import {useEffect,useMemo} from 'react';
import {BufferGeometry,DoubleSide,Float32BufferAttribute} from 'three';
import {PaintedParts,ball,box,ring,rod} from '../../play/modelParts';
import {noPick} from '../sceneryPaint';
import {fishingBoat} from './harbourFixtures';

type XYZ=[number,number,number];
// Sections of an inshore launch, bow to transom: z, half beam, gunwale height.
const sections=[[-1.91,.012,.32],[-1.69,.25,.27],[-1.38,.47,.21],[-.93,.625,.17],[-.42,.71,.14],[.23,.735,.125],[.83,.70,.13],[1.28,.646,.157],[1.57,.55,.18]];
function launch(){
  const parts=new PaintedParts();
  const rib=([z,w,y]:number[],f:number,rise:number,side:number):XYZ=>[side*w*f,y+rise,z];
  function panel(points:XYZ[],color:string){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(points.flat(),3));g.setIndex(points.slice(2).flatMap((_,i)=>[0,i+1,i+2]));g.computeVertexNormals();parts.add(g,color);}
  function strake(top:number,height:number,ft:number,fb:number,paint:string){
    for(const side of [-1,1])for(let i=1;i<sections.length;i++){
      const l=sections[i-1],r=sections[i];const quad=[rib(l,ft,top,side),rib(r,ft,top,side),rib(r,fb,top-height,side),rib(l,fb,top-height,side)];
      panel(side<0?quad:quad.reverse(),paint);
    }
  }
  strake(0,.049,1.02,1.005,'#925e42');strake(-.049,.041,1.005,1,'#eee1bd');
  strake(-.09,.075,1,.98,'#598379');strake(-.165,.17,.98,.88,'#2c5a59');
  strake(-.335,.049,.88,.83,'#b67f58');strake(-.384,.21,.83,.06,'#5b4a3f');
  const transom=sections.at(-1)!;panel([rib(transom,1,0,-1),rib(transom,1,0,1),rib(transom,.83,-.384,1),rib(transom,.06,-.59,1),rib(transom,.06,-.59,-1),rib(transom,.83,-.384,-1)],'#49716a');
  for(let i=1;i<sections.length;i++){
    const a=sections[i-1],b=sections[i];panel([rib(a,.985,-.019,-1),rib(b,.985,-.019,-1),rib(b,.985,-.019,1),rib(a,.985,-.019,1)],i%3?'#ad9370':'#b09673');
    for(const side of [-1,1])parts.add(rod(rib(a,1.018,.004,side),rib(b,1.018,.004,side),.014,.014,8),'#a36e48');
  }
  const c=fishingBoat.cabin,r=fishingBoat.roof;
  parts.add(box(0,c.y-.035,c.z,c.w,c.h-.07,c.d),'#d9d1af');parts.add(box(0,c.y+.165,c.z,.88,.19,.83),'#58736e');
  for(const side of [-1,1]){
    for(const z of [-.39,-.16,.13,.39])parts.add(box(side*.444,c.y+.16,c.z+z,.025,.205,.028),'#cec5aa');
    for(const x of [-.415,-.14,.14,.415])parts.add(box(x,c.y+.16,c.z+side*.420,.035,.205,.026),'#e0d9bd');
  }
  parts.add(box(0,r.y+.015,r.z,r.w,.05,r.d),'#984f38');parts.add(box(0,r.y-.019,r.z,r.w+.018,.027,r.d+.025),'#eed9aa');
  parts.add(box(-.20,r.y+.09,.79,.16,.12,.15),'#647573');parts.add(rod([-.20,r.y+.11,.79],[-.20,r.y+.31,.82],.041,.036,8),'#484f49');
  for(const side of [-1,1]){
    const rail=sections.slice(0,4).map(s=>rib(s,.91,.25,side));
    for(let i=1;i<rail.length;i++){parts.add(rod(rail[i-1],rail[i],.011,.011,6),'#bab6a3');parts.add(rod(rib(sections[i],.91,.012,side),rail[i],.013,.013,6),'#9a9f8f');}
    parts.add(rod([side*.59,.164,-.51],[0,1.53,-.39],.008,.007,5),'#8b8271');
    for(const z of [.05,.95]){const x=side*(z>.5?.68:.735);parts.add(rod([x,.156,z],[x+side*.033,-.024,z],.011,.009,5),'#ad9873');
      parts.add(ring(.093,.027,14).rotateY(Math.PI/2).translate(x+side*.032,-.094,z),'#3d4540');}
  }
  parts.add(rod([0,.12,-.41],[0,1.84,-.38],.034,.018,10),'#91755a');parts.add(rod([-.53,1.44,-.384],[.49,1.44,-.384],.021,.016,8),'#8a765b');
  parts.add(rod([-.50,1.44,-.384],[0,1.72,-.38],.006,.006,5),'#867959');parts.add(ball(0,1.87,-.38,.035,.051,.035,8),'#e8d7ab');
  panel([[.024,1.78,-.38],[.32,1.65,-.34],[.024,1.62,-.38]],'#b96d42');
  parts.add(box(0,.205,-.78,.51,.16,.40),'#7a7662');parts.add(box(0,.3,-.78,.55,.035,.44),'#b09672');
  for(const x of [-.3,.08,.35])parts.add(ball(x,.23,1.26,.105,.12,.10,10),x<0?'#d29952':'#c3b187');
  return parts.finish();
}
export function HarbourBoat(){const geometry=useMemo(launch,[]);useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} name="terminus:coastal-launch" raycast={noPick} userData={{playerCollision:false}}>
    <meshStandardMaterial vertexColors side={DoubleSide} roughness={.61}/></mesh>;
}
