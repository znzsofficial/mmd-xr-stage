import { useEffect, useImperativeHandle, useMemo } from 'react';
import { Color, CylinderGeometry, Group, InstancedMesh, MeshBasicMaterial, Object3D, OctahedronGeometry, Vector3 } from 'three';
import { PaintedParts } from '../modelParts';
import type { FrameEffectProps, GripFrame, PropView } from '../propView';
import { constellationOutlet, makeStarProjector } from './drawingToyModels';

const PLATES=4, RANGE=.68, PHOTO_SECONDS=6, FADE_SECONDS=1.25;

function mapStar() {
  const p=new PaintedParts();
  // Three crossed biconical gems have a silhouette even edge-on in stereo.
  p.add(new OctahedronGeometry(1).scale(.19,1,.21),'#fff0c8');
  p.add(new OctahedronGeometry(1).scale(.82,.18,.19),'#d1edef');
  p.add(new OctahedronGeometry(1).scale(.23,.19,.66),'#ded6f3');
  return p.finish();
}

/** World-root object used by both grips. A plate owns three fixed positions;
 * only its material fades. No hand transform is retained by a completed map. */
export function createConstellationInk() {
  const group=new Group(); group.name='constellation:maps';
  const crystal=mapStar(), filament=new CylinderGeometry(1,1,1,7,1,true);
  const tint=[new Color('#ffebcf'),new Color('#c1e6df'),new Color('#e1d2ef')];
  const plates=Array.from({length:PLATES},(_,i)=>{
    const starMat=new MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false});
    const linkMat=new MeshBasicMaterial({color:i%2?'#d3a9b5':'#99bfc8',transparent:true,depthWrite:false});
    const stars=new InstancedMesh(crystal,starMat,3),links=new InstancedMesh(filament,linkMat,3);
    stars.name=`constellation:stars:${i}`; links.name=`constellation:links:${i}`;
    stars.count=links.count=0; stars.visible=links.visible=false; stars.frustumCulled=links.frustumCulled=false;
    group.add(links,stars);
    return {stars,links,points:[new Vector3(),new Vector3(),new Vector3()],age:0};
  });
  const pin=new Object3D(),delta=new Vector3(),aim=new Vector3(),right=new Vector3(),plateUp=new Vector3(),up=new Vector3(0,1,0);
  let active=-1,next=0;

  function step({at,dir,usable,action,dt}:GripFrame) {
    for(const p of plates) if(p.stars.count===3) {
      p.age+=dt;
      const fade=Math.min(1,Math.max(0,1-(p.age-PHOTO_SECONDS)/FADE_SECONDS));
      p.stars.material.opacity=.98*fade; p.links.material.opacity=.83*fade;
      if(!fade){p.stars.count=p.links.count=0; p.stars.visible=p.links.visible=false;}
    }
    if(!usable||action!=='start')return;
    if(active===-1){
      active=next; next=(next+1)%PLATES;
      const p=plates[active]; p.stars.count=p.links.count=0; p.age=0;
      p.stars.material.opacity=.98;p.links.material.opacity=.83;p.links.visible=false;
    }
    const p=plates[active], n=p.stars.count, point=p.points[n];
    aim.copy(dir).normalize();point.copy(at).addScaledVector(aim,RANGE);
    // Preserve the aimed point unless it would literally land on an existing
    // pin. On a motionless wrist the map reader indexes two adjacent plates.
    if(p.points.some((prev,i)=>i<n && prev.distanceToSquared(point)<.018**2)) {
      right.crossVectors(aim,up);
      if(right.lengthSq()<.02)right.set(1,0,0).addScaledVector(aim,-aim.x);
      right.normalize();plateUp.crossVectors(right,aim);
      point.addScaledVector(right,(active%2?-1:1)*(n===1?.22:-.14)).addScaledVector(plateUp,n===1?.14:.27);
    }
    pin.position.copy(point);pin.rotation.set(.23,.38,.13+.24*n);
    pin.scale.setScalar(n===0?.039:.032);pin.updateMatrix();
    p.stars.setMatrixAt(n,pin.matrix);p.stars.setColorAt(n,tint[n]);
    p.stars.instanceMatrix.needsUpdate=true;p.stars.instanceColor!.needsUpdate=true;
    p.stars.count=n+1; p.stars.visible=true;
    const addLink=(a:Vector3,b:Vector3)=>{
      delta.subVectors(b,a);const length=delta.length(); if(length<.00001)return;
      pin.position.copy(a).lerp(b,.5);pin.quaternion.setFromUnitVectors(up,delta.multiplyScalar(1/length));
      pin.scale.set(.0045,length,.0045);pin.updateMatrix();p.links.setMatrixAt(p.links.count++,pin.matrix);
      p.links.instanceMatrix.needsUpdate=true;p.links.visible=true;
    };
    if(n>0)addLink(p.points[n-1],point);
    if(n===2){addLink(point,p.points[0]);active=-1;}
  }
  function dispose(){
    for(const {stars,links} of plates){stars.dispose();links.dispose();stars.material.dispose();links.material.dispose();}
    crystal.dispose();filament.dispose();
  }
  return {group,step,dispose};
}

function StarProjector() {
  const geometry=useMemo(makeStarProjector,[]);useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="play:piece:constellation" geometry={geometry}><meshStandardMaterial vertexColors metalness={.24} roughness={.46}/></mesh>;
}
function ConstellationEffect({ref}:FrameEffectProps) {
  const ink=useMemo(createConstellationInk,[]); useEffect(()=>ink.dispose,[ink]);
  useImperativeHandle(ref,()=>ink.step,[ink]);return <primitive object={ink.group} pointerEvents="none"/>;
}
export const constellation:PropView={Piece:StarProjector, HeldEffect:ConstellationEffect, outlet:constellationOutlet};
