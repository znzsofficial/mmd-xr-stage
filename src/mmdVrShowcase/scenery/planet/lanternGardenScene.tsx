import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Color,DoubleSide,DynamicDrawUsage,Float32BufferAttribute,InstancedMesh,Mesh,Object3D,Quaternion,Vector3} from 'three';
import {noPick} from '../sceneryPaint';
import {useBakedSurface} from '../useBakedSurface';
import {moonShell} from './moonSurface';
import {lanternCentre,lanternCup,lanternFlushes,lanternLocal,lanternPathDistance,lanternRadius,lanternSeedPosition,lanternStation,lanternTrees,lanternWestDistance} from './lanternBiosphere';
import {lanternBotany,lanternGrazerMesh,lanternSeedMesh} from './lanternBotany';
import loam from './lantern-loam.webp';

function floor(){
  const g=moonShell({radius:lanternRadius,relief:'lantern'}),pos=g.attributes.position;
  const rgb=new Float32Array(pos.count*3),p=new Vector3(),n=new Vector3(),c=new Color();
  const dark=new Color('#8994ad'),moss=new Color('#a6b8b4'),path=new Color('#f7d4a7');
  const duff=new Color('#d4a685'),lichen=new Color('#bed3b0');
  const shadows=lanternTrees.map(s=>({p:s.base.clone().add(new Vector3(.42,0,-.31)).normalize().multiplyScalar(s.base.length()),inv:1/(s.r*s.r)}));
  for(let i=0;i<pos.count;i++){
    p.fromBufferAttribute(pos,i);n.copy(p).normalize();const tuft=.50+.5*Math.sin(5*n.x+3*n.z)*Math.cos(5*n.y-3*n.z);
    c.copy(dark).lerp(moss,tuft);
    // A fruiting island has an irregular warm duff centre and sage growth
    // just outside it. Only colour the existing support mesh, never a decal
    // floating through a slope, a foot or an already-placed performer.
    let fruit=0;for(const f of lanternFlushes){const d2=p.distanceToSquared(f.centre);if(d2<5.8)fruit=Math.max(fruit,Math.exp(-.83*d2));}
    if(fruit>.03){const patch=fruit*(.86+.14*Math.cos(3.8*p.x+2.6*p.z+Math.sin(3*p.y)));
      c.lerp(lichen,Math.min(.85,3*patch)).lerp(duff,Math.min(1,2.1*patch));}
    const d=Math.min(n.y>.38?lanternPathDistance(p.x,p.z):Infinity,lanternWestDistance(n.x,n.y,n.z));
    c.lerp(path,.93*Math.exp(-1.32*d*d));
    let shade=0;for(const s of shadows){const d2=p.distanceToSquared(s.p)*s.inv;if(d2<5)shade=Math.max(shade,.35*Math.exp(-1.45*d2));}
    c.multiplyScalar(1-shade).toArray(rgb,3*i);
  }
  g.setAttribute('color',new Float32BufferAttribute(rgb,3));return g;
}

const axis=new Vector3(0,1,0),seedCount=8;
function SeedRain(){
  const g=useMemo(lanternSeedMesh,[]),animal=useMemo(lanternGrazerMesh,[]),mesh=useRef<InstancedMesh>(null),grazer=useRef<Mesh>(null);
  const scratch=useMemo(()=>({eye:new Vector3(),world:lanternCup.clone().add(lanternCentre),m:new Object3D(),
    frame:new Quaternion().setFromUnitVectors(axis,lanternStation),root:lanternLocal(lanternStation),time:0,graze:1.48}),[]);
  useEffect(()=>()=>{g.dispose();animal.dispose();},[g,animal]);
  useFrame(({camera,gl},dt)=>{const batch=mesh.current;if(!batch)return;
    (gl.xr.isPresenting?gl.xr.getCamera():camera).getWorldPosition(scratch.eye);
    const range=scratch.eye.distanceToSquared(scratch.world);batch.visible=range<23**2;
    if(grazer.current){const snail=grazer.current;snail.visible=range<12**2;
      if(snail.visible){const a=scratch.graze=(scratch.graze+.055*Math.min(.1,dt))%(2*Math.PI),r=.405*(1+.05*Math.cos(5*a+.21)+.028*Math.cos(2*a));
        snail.position.set(r*Math.cos(a),.793+.107*Math.cos(5*a+.21),r*Math.sin(a)).applyQuaternion(scratch.frame).add(scratch.root);
        snail.quaternion.copy(scratch.frame);snail.rotateY(-a);snail.rotateX(Math.atan2(.535*Math.sin(5*a+.21),r));}}
    if(!batch.visible)return;
    scratch.time=(scratch.time+Math.min(.1,dt)/7.4)%1;
    const obj=scratch.m;
    for(let i=0;i<seedCount;i++){
      const t=(scratch.time+(i+.22*Math.sin(i*2.9))/seedCount)%1;
      lanternSeedPosition(t,i,obj.position);obj.quaternion.copy(scratch.frame);obj.rotateY(i*2.4+8*Math.PI*t);
      obj.rotateZ(.55+.30*Math.sin(t*13+i));obj.scale.setScalar((.78+.12*(i%3))*Math.min(1,t*24,(1-t)*20));
      obj.updateMatrix();batch.setMatrixAt(i,obj.matrix);
    }
    batch.instanceMatrix.needsUpdate=true;
  });
  return <><mesh ref={grazer} name="lantern:cup-grazer" geometry={animal} raycast={noPick}><meshStandardMaterial vertexColors side={DoubleSide} roughness={.66} fog={false}/></mesh>
    <instancedMesh ref={mesh} name="lantern:falling-winged-seeds" args={[g,undefined,seedCount]} frustumCulled={false} raycast={noPick}
    onUpdate={m=>m.instanceMatrix.setUsage(DynamicDrawUsage)}>
    <meshBasicMaterial vertexColors side={DoubleSide} fog={false}/>
  </instancedMesh></>;
}

export function LanternBiosphere(){
  const shell=useMemo(floor,[]),flora=useMemo(lanternBotany,[]),map=useBakedSurface(loam);
  useEffect(()=>()=>{shell.dispose();flora.matter.dispose();flora.light.dispose();flora.veil.dispose();},[shell,flora]);
  return <group name="planet:lantern-garden" position={lanternCentre} userData={{playerCollision:false}}>
    <mesh name="planet:moon-lantern" geometry={shell} raycast={noPick}><meshStandardMaterial map={map} vertexColors roughness={.98} fog={false}/></mesh>
    <mesh name="lantern:stems-crowns-croziers" geometry={flora.matter} raycast={noPick}><meshStandardMaterial vertexColors side={DoubleSide} roughness={.85} fog={false}/></mesh>
    <mesh name="lantern:lucent-gills" geometry={flora.light} raycast={noPick}><meshBasicMaterial vertexColors side={DoubleSide} fog={false}/></mesh>
    <mesh name="lantern:thin-scalloped-veils" geometry={flora.veil} raycast={noPick} renderOrder={1}>
      <meshStandardMaterial vertexColors transparent opacity={.62} depthWrite={false} side={DoubleSide} forceSinglePass roughness={.66} fog={false}/>
    </mesh>
    <SeedRain/>
  </group>;
}
