import { Box3, Matrix3, Matrix4, Quaternion, Vector3, type Bone, type SkinnedMesh } from 'three';

// Fit in the PMX mesh's bind frame (+Z forward, +Y up). The placement root
// and the current dance/Bullet pose must not influence these measurements.
export function fitChestContours(mesh:SkinnedMesh, candidates:readonly Bone[], shoulderWidth:number|undefined, isTorso:(b:Bone)=>boolean) {
  const {bones,boneInverses}=mesh.skeleton;
  const indices=new Map(bones.map((b,i)=>[b,i])), boxes=new Map<Bone,Box3>();
  const wanted=new Set(candidates.map(b=>indices.get(b)));
  const meshInverse=mesh.bindMatrix.clone().invert(), p=new Vector3();
  const bodies:SkinnedMesh[]=mesh.userData.mmdMorphSplitBodyMeshes??[mesh];
  if(wanted.size)for(const body of bodies){
    const {skinIndex,skinWeight,position}=body.geometry.attributes;
    if(body.skeleton!==mesh.skeleton || !position || skinIndex?.itemSize!==4 || skinWeight?.itemSize!==4 ||
      position.count!==skinIndex.count || position.count!==skinWeight.count)continue;
    const toModel=new Matrix4().multiplyMatrices(meshInverse,body.bindMatrix);
    for(let i=0;i<position.count;i++){
      let read=false;
      for(let j=0;j<4;j++){
        const k=skinIndex.getComponent(i,j);
        if(!wanted.has(k)||!(skinWeight.getComponent(i,j)>.01))continue;
        if(!read){p.fromBufferAttribute(position,i).applyMatrix4(toModel);read=true;}
        if(!Number.isFinite(p.lengthSq()))continue;
        const b=bones[k];let box=boxes.get(b);if(!box)boxes.set(b,box=new Box3());box.expandByPoint(p);
      }
    }
  }
  // Each connected weighted branch gets ONE envelope. Include the distal
  // weights when locating the hinge; never apply a second stretch to them.
  const branches=new Map<Bone,Box3>();
  for(const [b,box] of boxes){
    let root=b;for(let a=b.parent;a;a=a.parent)if(boxes.has(a as Bone))root=a as Bone;
    let combined=branches.get(root);if(!combined)branches.set(root,combined=new Box3());combined.union(box);
  }
  const pads=[];
  // A broad bone envelope also pulls on blended garment seams. Use a
  // conservative range for this procedural path; authored morphs keep 0–1.
  const envelopeTravel=.72;
  for(const [b,box] of branches){
    const inv=boneInverses[indices.get(b)!];if(!inv)continue;
    const toBone=inv.clone().multiply(mesh.bindMatrix),toModel=toBone.clone().invert();
    const determinant=toBone.determinant();if(!Number.isFinite(determinant)||determinant===0)continue;
    const origin=new Vector3().setFromMatrixPosition(toModel), span=box.getSize(new Vector3());
    const width=shoulderWidth?shoulderWidth/new Vector3().setFromMatrixColumn(mesh.bindMatrix,0).length():Math.max(span.x,span.y,span.z)*1.6;
    if(!(width>0&&Number.isFinite(width)))continue;
    let torso=b.parent;while(torso&&!isTorso(torso as Bone))torso=torso.parent;
    const torsoInv=torso&&boneInverses[indices.get(torso as Bone)!];
    const midX=torsoInv?new Vector3().setFromMatrixPosition(meshInverse.clone().multiply(torsoInv.clone().invert())).x:origin.x;
    const side=Math.sign(box.getCenter(new Vector3()).x-midX);
    // Upper/posterior hinge of this branch's supported envelope. Stray
    // accessory weights cannot move the hinge an arbitrary distance away.
    const clamp=(n:number)=>Math.max(-.4*width,Math.min(.4*width,n));
    const hinge=origin.clone().add(new Vector3(0,clamp(box.max.y-origin.y),clamp(box.min.z-origin.z))).applyMatrix4(toBone);
    const linear=new Matrix3().setFromMatrix4(toBone);
    const travel=new Vector3(side*.006,-.016,.038).multiplyScalar(width).applyMatrix3(linear);
    const settle=new Vector3(0,-.030*width,0).applyMatrix3(linear);
    // A bone exposes TRS, not a general shear. Project the anatomical
    // stretch tensor onto its three actual bind axes. Squared cosines vary
    // continuously for oblique rolls; no nearest-axis switch or XYZ guess.
    const gain=new Vector3(),axis=new Vector3();
    for(let i=0;i<3;i++){
      axis.setFromMatrixColumn(toModel,i).normalize();
      gain.setComponent(i,.09*axis.x**2+.08*axis.y**2+.235*axis.z**2);
    }
    // The pitch/splay step is a rotation, not a scale: transport it through
    // the bind frame, including reversed (reflected) local handedness.
    const swing=new Vector3(-.10,side*.035,0),angle=swing.length(),axisBeforeScale=new Vector3();
    swing.transformDirection(toBone).multiplyScalar(Math.sign(determinant));
    const pos=new Vector3(),scale=new Vector3(),rotation=new Quaternion(),q=new Quaternion(),offset=new Vector3(),tip=new Vector3();
    pads.push({
      apply(fullness:number){
        const t=fullness*envelopeTravel;
        pos.copy(b.position);scale.copy(b.scale);rotation.copy(b.quaternion);
        // TRS rotates before local scale. Transport the axial vector back
        // across that scale as well (some mirrored joints carry a minus).
        axisBeforeScale.copy(swing).multiply(scale).normalize().multiplyScalar(Math.sign(scale.x*scale.y*scale.z));
        q.setFromAxisAngle(axisBeforeScale,axisBeforeScale.lengthSq()?angle*t:0);
        b.scale.copy(gain).multiplyScalar(t).addScalar(1).multiply(scale);
        // T(hinge + travel) R S T(-hinge), composed onto the evaluated
        // transform. More settling near the top of the slider is deliberate.
        offset.copy(hinge).addScaledVector(travel,t).addScaledVector(settle,t*t).multiply(scale);
        tip.copy(hinge).multiply(b.scale).applyQuaternion(q);
        b.position.add(offset.sub(tip).applyQuaternion(rotation));b.quaternion.multiply(q);
        b.updateWorldMatrix(false,true);
      },
      restore(){b.position.copy(pos);b.scale.copy(scale);b.quaternion.copy(rotation);b.updateWorldMatrix(false,true);},
    });
  }
  return {pads,weighted:boxes};
}
