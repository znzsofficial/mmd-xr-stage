import {useEffect,useMemo} from 'react';
import {BoxGeometry, Color, CylinderGeometry, Float32BufferAttribute, Object3D, SphereGeometry, type MeshStandardMaterial} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {useMmdVrStore} from '../../mmdVrStore';
import {ClinicParts,padGeometry} from './clinicParts';
import {FIXTURES} from './clinicLayout';
import {seatedNurse} from './clinicTeaching';

// Bake just the original nurse's instance transforms/colours into one opaque
// mesh, leaving the desk, chair and architecture in their existing batches.
function nurseGeometry(){
  const p=new ClinicParts();seatedNurse(p);
  const pose=new Object3D(),tint=new Color(),seat=FIXTURES.deskSeat;
  const batches=[[p.blocks,new BoxGeometry()], [p.soft,padGeometry()],
    [p.poles,new CylinderGeometry(.5,.5,1,16)], [p.ovals,new SphereGeometry(.5,12,8)]] as const;
  const pieces=batches.flatMap(([parts,base])=>parts.map(part=>{
    const g=base.clone();g.deleteAttribute('uv');
    pose.position.set(part.p[0]-seat.x,part.p[1],part.p[2]-seat.z);
    pose.rotation.set(part.rx??0,part.ry??0,part.rz??0);pose.scale.set(...part.s);pose.updateMatrix();
    g.applyMatrix4(pose.matrix);tint.set(part.color);
    const rgb=new Float32BufferAttribute(new Float32Array(g.attributes.position.count*3),3);
    for(let i=0;i<rgb.count;i++)rgb.setXYZ(i,tint.r,tint.g,tint.b);
    return g.setAttribute('color',rgb);
  }));
  const geometry=mergeGeometries(pieces);
  for(const g of pieces)g.dispose();for(const [,g] of batches)g.dispose();
  return geometry;
}

type Props={shadows:boolean;shade:MeshStandardMaterial['onBeforeCompile']};
function NurseMesh({shadows,shade}:Props){
  const geometry=useMemo(nurseGeometry,[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="scenery:clinic-nurse" position={[FIXTURES.deskSeat.x,0,FIXTURES.deskSeat.z]} raycast={()=>null}
    pointerEvents="none" castShadow={shadows} receiveShadow={shadows}>
    <primitive object={geometry} attach="geometry"/><meshStandardMaterial vertexColors roughness={.88} onBeforeCompile={shade}/>
  </mesh>;
}

export function ClinicNurse(props:Props){
  return useMmdVrStore(s=>s.prefs.showSceneryPeople)?<NurseMesh {...props}/>:null;
}
