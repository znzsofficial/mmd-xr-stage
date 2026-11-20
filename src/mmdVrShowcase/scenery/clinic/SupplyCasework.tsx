import {useEffect,useMemo} from 'react';
import {Vector2} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FIXTURES} from './clinicLayout';
import {useBakedSurface} from '../useBakedSurface';
import {noPick} from '../sceneryPaint';
import colorUrl from './casework-color.webp';
import normalUrl from './casework-normal.webp';
import roughUrl from './casework-rough.webp';

const normalStrength=new Vector2(.7,.7);
function caseworkGeometry(){
  const {w,d}=FIXTURES.supplyShelf,side=.034,reveal=.002,back=.022;
  const inside=w-2*(side+reveal),front=-d/2+.006,backFace=d/2-back-.008;
  const parts:RoundedBoxGeometry[]=[];
  // The side panels alone own the two outside faces. Recess every shelf and
  // back edge between them instead of hiding coplanar faces with depth bias.
  function board(x:number,y:number,z:number,width:number,height:number,depth:number,kind:'side'|'shelf'|'back'){
    const g=new RoundedBoxGeometry(width,height,depth,1,.0025),uv=g.attributes.uv,n=g.attributes.normal,p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i),ax=Math.abs(nx),ay=Math.abs(ny),az=Math.abs(nz);
      const xx=p.getX(i)/width,yy=p.getY(i)/height,zz=p.getZ(i)/depth;
      let u:number,v:number;
      if(ay>=ax&&ay>=az){u=.5+xx;v=.5-Math.sign(ny)*zz;}
      else if(ax>=az){u=.5-Math.sign(nx)*zz;v=.5+yy;}
      else {u=.5+Math.sign(nz)*xx;v=.5+yy;}
      const slot=kind==='shelf'?(ay>=ax&&ay>=az?0:1):kind==='back'?3:2;
      uv.setXY(i,((slot%2)*256+4.5+u*247)/512,1-(Math.floor(slot/2)*256+4.5+(1-v)*247)/512);
    }
    g.translate(x,y,z);parts.push(g);
  }
  for(const s of [-1,1])board(s*(w-side)/2,.79,0,side,1.36,d,'side');
  board(0,.79,backFace+back/2,inside,1.36,back,'back');
  for(const y of [.21,.63,1.02,1.46])board(0,y,(front+backFace-reveal)/2,inside,.04,backFace-reveal-front,'shelf');
  const geo=mergeGeometries(parts,false);for(const p of parts)p.dispose();return geo;
}

export function SupplyCasework({shadows}:{shadows:boolean}){
  const {x,z}=FIXTURES.supplyShelf,g=useMemo(caseworkGeometry,[]);
  const map=useBakedSurface(colorUrl),normal=useBakedSurface(normalUrl,'data'),rough=useBakedSurface(roughUrl,'data');
  useEffect(()=>()=>g.dispose(),[g]);
  const ready=!!(map&&normal&&rough);
  return <mesh name="clinic:supply-casework" position={[x,0,z]} geometry={g} castShadow={shadows} receiveShadow={shadows} raycast={noPick}>
    <meshStandardMaterial key={ready?'finish':'primer'} color={ready?'white':'#bcc3b9'} map={ready?map:null} normalMap={ready?normal:null} normalScale={normalStrength} roughnessMap={ready?rough:null} roughness={ready?1:.76}/>
  </mesh>;
}
