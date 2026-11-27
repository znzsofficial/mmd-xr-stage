import { Matrix4, Quaternion, Vector3, type BufferAttribute, type InterleavedBufferAttribute, type SkinnedMesh } from 'three';

type Attribute = BufferAttribute | InterleavedBufferAttribute;
/** Sparse TSL actors keep their authored deltas off the rendered geometry. */
export type PositionDeltas = Pick<Attribute,'count'|'getX'|'getY'|'getZ'> & {vertices?:Uint32Array};
export type PositionMorphs = readonly (PositionDeltas | undefined)[];
type PaletteEntry = {frame:number; matrix:Matrix4; world:Matrix4; rotation:Quaternion; dual:Quaternion; scale:number};
const v = () => new Vector3();

/** Query the same displayed position as the PMX vertex shader, including the
 * loader's split influence map and SDEF/QDEF. Never use bind-pose raycasts. */
export function createWandPose(mesh:SkinnedMesh,source:SkinnedMesh,attrs:PositionMorphs=mesh.geometry.morphAttributes.position??[],position=mesh.geometry.attributes.position){
  const g=mesh.geometry,{skinWeight:w,skinIndex:ix,matricesSdefEnabled:sdef,matricesQdefEnabled:qdef}=g.attributes;
  const remap=mesh.userData.mmdMorphSplitBody?.morphTargetIndices;
  const active:{attr:PositionDeltas;weight:number}[]=[], weights=attrs.map(attr=>attr&&({attr,weight:0}));
  const palette:PaletteEntry[]=[], outer=new Matrix4(),toRig=new Matrix4(),rigToWorld=new Matrix4(),invBind=mesh.bindMatrix.clone().invert(),p=v(), temp=v(), base=v(), t=v();
  const q=new Quaternion(), dual=new Quaternion(), posQ=new Quaternion();
  const stamps=new Uint32Array(position.count), points=new Float32Array(position.count*3);
  let epoch=0, skin=false;
  function bone(i:number){
    const b=palette[i]??=( {frame:-1,matrix:new Matrix4(),world:new Matrix4(),rotation:new Quaternion(),dual:new Quaternion(),scale:1} );
    if(b.frame!==epoch){
      b.frame=epoch;b.matrix.multiplyMatrices(mesh.skeleton.bones[i].matrixWorld,mesh.skeleton.boneInverses[i]);
      b.world.multiplyMatrices(outer,b.matrix).multiply(mesh.bindMatrix);
      // Largest row norm bounds each axis of a transformed sphere's AABB.
      const e=b.world.elements;b.scale=Math.sqrt(Math.max(e[0]**2+e[4]**2+e[8]**2,e[1]**2+e[5]**2+e[9]**2,e[2]**2+e[6]**2+e[10]**2));
      if(sdef||qdef){b.matrix.premultiply(toRig);b.rotation.setFromRotationMatrix(b.matrix);}
      if(qdef){const m=b.matrix.elements;posQ.set(m[12]/2,m[13]/2,m[14]/2,0);b.dual.multiplyQuaternions(posQ,b.rotation);}
    }return b;
  }
  function begin(){
    epoch++;active.length=0;outer.multiplyMatrices(mesh.matrixWorld,mesh.bindMatrixInverse);
    if(sdef||qdef){toRig.multiplyMatrices(mesh.bindMatrix,mesh.bindMatrixInverse);rigToWorld.multiplyMatrices(mesh.matrixWorld,invBind);}
    skin=!!(w&&ix&&mesh.skeleton?.bones.length);
    for(let i=0;i<attrs.length;i++){
      const f=source.morphTargetInfluences?.[remap?.[i]??i]??0;
      const slot=weights[i];if(slot&&f&&Number.isFinite(f)){slot.weight=f;active.push(slot);}
    }
  }
  function vertex(i:number,out:Vector3){
    if(stamps[i]===epoch)return out.fromArray(points,i*3);
    p.fromBufferAttribute(position,i);base.copy(p);
    for(const {attr,weight} of active){temp.set(attr.getX(i),attr.getY(i),attr.getZ(i));if(!g.morphTargetsRelative)temp.sub(base);p.addScaledVector(temp,weight);}
    if(!skin)out.copy(p).applyMatrix4(mesh.matrixWorld);
    else if(qdef?.getX(i)>=.5){
      let highest=0;for(let j=1;j<4;j++)if(w.getComponent(i,j)>w.getComponent(i,highest))highest=j;
      const ref=bone(ix.getComponent(i,highest)).rotation;
      q.set(0,0,0,0);dual.set(0,0,0,0);
      for(let j=0;j<4;j++){
        let f=w.getComponent(i,j);if(!f)continue;const b=bone(ix.getComponent(i,j)),r=b.rotation,d=b.dual;
        if(ref.dot(r)<0)f=-f;
        q.set(q.x+f*r.x,q.y+f*r.y,q.z+f*r.z,q.w+f*r.w);
        dual.set(dual.x+f*d.x,dual.y+f*d.y,dual.z+f*d.z,dual.w+f*d.w);
      }
      const len=Math.max(1e-6,q.length());q.set(q.x/len,q.y/len,q.z/len,q.w/len);
      out.copy(p).applyMatrix4(mesh.bindMatrix).applyQuaternion(q);
      dual.multiply(q.conjugate());out.add(t.set(dual.x,dual.y,dual.z).multiplyScalar(2/len)).applyMatrix4(rigToWorld);
    }else if(sdef?.getX(i)>=.5){
      const b0=bone(ix.getX(i)),b1=bone(ix.getY(i)),mix=w.getY(i),r0=b0.rotation,r1=b1.rotation;
      // Match the shader's sign and near-coincident branch, in rig space.
      const dot=r0.dot(r1),c=Math.abs(dot),sign=dot<0?-1:1;
      const theta=c>.999999?0:Math.acos(c),s=Math.sin(theta);
      const f0=theta?Math.sin((1-mix)*theta)/s:1-mix, f1=sign*(theta?Math.sin(mix*theta)/s:mix);
      q.set(f0*r0.x+f1*r1.x,f0*r0.y+f1*r1.y,f0*r0.z+f1*r1.z,f0*r0.w+f1*r1.w);if(!theta)q.normalize();
      out.copy(p).applyMatrix4(mesh.bindMatrix).sub(t.fromBufferAttribute(g.attributes.matricesSdefC,i)).applyQuaternion(q)
        .addScaledVector(t.fromBufferAttribute(g.attributes.matricesSdefRW0,i).applyMatrix4(b0.matrix),w.getX(i))
        .addScaledVector(t.fromBufferAttribute(g.attributes.matricesSdefRW1,i).applyMatrix4(b1.matrix),mix).applyMatrix4(rigToWorld);
    }else{
      out.set(0,0,0);
      for(let j=0;j<4;j++){const f=w.getComponent(i,j);if(f)out.addScaledVector(t.copy(p).applyMatrix4(bone(ix.getComponent(i,j)).world),f);}
    }
    stamps[i]=epoch;out.toArray(points,i*3);return out;
  }
  return {begin,bone,vertex,active,outer:(sdef||qdef)?rigToWorld:outer};
}
