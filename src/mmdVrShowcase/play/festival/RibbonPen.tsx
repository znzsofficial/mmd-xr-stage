import { useEffect, useImperativeHandle, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import type { FrameEffectProps, GripFrame, PropView } from '../propView';
import { makeSilkSpool, ribbonPenOutlet } from './drawingToyModels';

const STROKES=4, ROWS=144, STEP=1/36, HOLD_SECONDS=4.8, FADE_SECONDS=1.2;
const ROW_INDICES=12; // Two adjoining quads with a crisp colour break at the fold.

function makeStrip(id:number) {
  // Duplicate the rows of the circular buffer. Even a very long continuous
  // flourish is a single indexed draw, without an edge from newest to oldest.
  const rows=ROWS*2, geometry=new BufferGeometry(), ix:number[]=[];
  const position=new BufferAttribute(new Float32Array(rows*4*3),3).setUsage(DynamicDrawUsage);
  const colors=new Float32Array(rows*4*3);
  const dyes=['#c96788','#f0a7b4','#b4dfc4','#62b4ac'].map(s=>new Color(s));
  for(let i=0;i<rows;i++) {
    for(let j=0;j<4;j++)dyes[j].toArray(colors,3*(4*i+j));
    if(i)for(const j of [0,2]){const k=4*i+j;ix.push(k-4,k-3,k,k-3,k+1,k);}
  }
  geometry.setAttribute('position',position);geometry.setAttribute('color',new BufferAttribute(colors,3));
  geometry.setIndex(ix);geometry.setDrawRange(0,0);
  const material=new MeshBasicMaterial({vertexColors:true,side:DoubleSide,transparent:true,depthWrite:false,opacity:.95});
  // The two sides of this thin textile have the same dyes; one pass suffices.
  material.forceSinglePass=true;
  const mesh=new Mesh(geometry,material);mesh.name=`ribbonPen:strip:${id}`;mesh.frustumCulled=false;mesh.visible=false;
  return {mesh,position,first:0,count:0,age:0};
}

/** Samples the *live* outlet in world space. Each sample is woven into the
 * fixed buffer immediately. The reel pays out a small self-curl at low wrist
 * speeds; fast strokes instead trace the sweeps of the holder's hand. */
export function createRibbonInk() {
  const group=new Group();group.name='ribbonPen:strokes';
  const strips=Array.from({length:STROKES},(_,i)=>makeStrip(i));
  for(const s of strips)group.add(s.mesh);
  const lastAt=new Vector3(),lastDir=new Vector3(),point=new Vector3(),aim=new Vector3(),lastPoint=new Vector3();
  const across=new Vector3(),rise=new Vector3(),tangent=new Vector3(),edge=new Vector3(),normal=new Vector3(),width=new Vector3();
  let next=0,active=-1,time=0,sample=0,twist=0,assist=1;

  // Parallel transport, including vertically oriented wrists. Don't flip the
  // fabric or the winding axis as the tracked hand passes through vertical.
  function perpendicular(v:Vector3,axis:Vector3) {
    v.addScaledVector(axis,-v.dot(axis));
    if(v.lengthSq()<.0001){v.set(Math.abs(axis.x)<.8?1:0,0,Math.abs(axis.x)<.8?0:1);v.addScaledVector(axis,-v.dot(axis));}
    v.normalize();
  }
  function putRow(t:number) {
    const s=strips[active];
    const dist=point.distanceTo(lastPoint);
    if(s.count && dist<.0008)return;
    if(s.count){tangent.subVectors(point,lastPoint).multiplyScalar(1/dist);twist=(twist+dist*14)%(Math.PI*2);}
    else {tangent.copy(aim);edge.copy(across);}
    perpendicular(edge,tangent);normal.crossVectors(tangent,edge);
    const w=.005+.014*Math.min(1,t*8);
    width.copy(edge).multiplyScalar(w*Math.cos(twist)).addScaledVector(normal,w*Math.sin(twist));
    normal.crossVectors(tangent,width).normalize().multiplyScalar(w*.22);
    const row=(s.first+s.count)%ROWS;
    if(s.count<ROWS)s.count++;else s.first=(s.first+1)%ROWS;
    // Duplicate centreline vertices carry the independent pink and mint dyes.
    for(let r=row;r<=row+ROWS;r+=ROWS){const k=r*4;
      s.position.setXYZ(k,point.x-width.x,point.y-width.y,point.z-width.z);
      s.position.setXYZ(k+1,point.x+normal.x,point.y+normal.y,point.z+normal.z);
      s.position.setXYZ(k+2,point.x+normal.x,point.y+normal.y,point.z+normal.z);
      s.position.setXYZ(k+3,point.x+width.x,point.y+width.y,point.z+width.z);
    }
    s.position.needsUpdate=true;s.mesh.geometry.setDrawRange(s.first*ROW_INDICES,(s.count-1)*ROW_INDICES);
    s.mesh.visible=s.count>1;lastPoint.copy(point);
  }
  function close() {
    if(active===-1)return;
    const s=strips[active];if(s.count<2)s.count=0; s.age=0;active=-1;
  }
  function step({at,dir,usable,action,dt}:GripFrame) {
    for(let i=0;i<STROKES;i++) {
      const s=strips[i];if(i===active||!s.count)continue;
      s.age+=dt;const fade=Math.max(0,Math.min(1,1-(s.age-HOLD_SECONDS)/FADE_SECONDS));
      s.mesh.material.opacity=.95*fade;
      if(!fade){s.count=0;s.mesh.visible=false;s.mesh.geometry.setDrawRange(0,0);}
    }
    if(!usable||action==='off'){close();return;}
    if(action==='start'){
      close();active=next;next=(next+1)%STROKES;
      const s=strips[active];s.first=s.count=s.age=0;s.mesh.material.opacity=.95;
      time=twist=0;sample=1;assist=1;lastAt.copy(at);lastDir.copy(dir).normalize();aim.copy(lastDir);
      across.set(1,0,0);perpendicular(across,aim);point.copy(at);putRow(0);return;
    }
    if(active===-1||dt<=0)return;
    if(lastAt.distanceToSquared(at)>.55**2){close();return;}
    const elapsed=Math.min(.08,dt),end=time+elapsed;
    const speed=(at.distanceTo(lastAt)+.20*dir.distanceTo(lastDir))/elapsed;
    const target=Math.max(.12,1-speed/.30);
    assist+=(target-assist)*(1-Math.exp(-elapsed*11));
    for(;sample*STEP<=end+1e-9;sample++) {
      const t=sample*STEP,f=Math.min(1,(t-time)/elapsed);
      point.lerpVectors(lastAt,at,f);aim.lerpVectors(lastDir,dir,f).normalize();
      perpendicular(across,aim);rise.crossVectors(across,aim);
      const paid=1-Math.exp(-1.8*t),curl=.090*(1-Math.exp(-6*t))*assist,angle=t*6.1;
      point.addScaledVector(aim,paid*(.018+.28*assist));
      point.addScaledVector(across,curl*Math.sin(angle)).addScaledVector(rise,curl*.82*Math.cos(angle));
      putRow(t);
    }
    lastAt.copy(at);lastDir.copy(dir).normalize();time=end;
  }
  function dispose(){for(const s of strips){s.mesh.geometry.dispose();s.mesh.material.dispose();}}
  return {group,step,dispose};
}

function RibbonSpool() {
  const geometry=useMemo(makeSilkSpool,[]);useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="play:piece:ribbonPen" geometry={geometry}><meshStandardMaterial vertexColors side={DoubleSide} metalness={.14} roughness={.47}/></mesh>;
}
function RibbonEffect({ref}:FrameEffectProps) {
  const ink=useMemo(createRibbonInk,[]);useEffect(()=>ink.dispose,[ink]);
  useImperativeHandle(ref,()=>ink.step,[ink]);return <primitive object={ink.group} pointerEvents="none"/>;
}
export const ribbonPen:PropView={Piece:RibbonSpool,HeldEffect:RibbonEffect,outlet:ribbonPenOutlet};
