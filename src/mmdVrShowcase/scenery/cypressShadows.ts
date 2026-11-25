import {Box3, Frustum, Matrix4, type InstancedMesh} from 'three';

/** One instanced draw spans the nave and the far end of the garden. In the
 * light pass omit a suffix of whole trees outside the actual light frustum.
 * A prefix (rather than sorting/compacting) keeps the same instance buffers,
 * order, and VAO; it can submit an extra tree, never drop an intersecting one. */
export function cypressShadowPrefix(mesh:InstancedMesh, crowns:readonly number[]) {
  const m=new Matrix4(),box=new Box3(),frustum=new Frustum(),geometry=mesh.geometry;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  const bounds:Box3[]=[];
  let count=0;
  for(const end of crowns){
    const tree=new Box3();
    for(;count<end;count++){
      mesh.getMatrixAt(count,m);
      tree.union(box.copy(geometry.boundingBox!).applyMatrix4(m));
    }
    bounds.push(tree);
  }
  const before=mesh.onBeforeShadow,after=mesh.onAfterShadow;
  mesh.onBeforeShadow=(_renderer,_object,_eye,light)=>{
    m.multiplyMatrices(light.projectionMatrix,light.matrixWorldInverse).multiply(mesh.matrixWorld);
    frustum.setFromProjectionMatrix(m,light.coordinateSystem,light.reversedDepth);
    let i=bounds.length-1;
    while(i>=0 && !frustum.intersectsBox(bounds[i]))i--;
    mesh.count=i<0?0:crowns[i];
  };
  mesh.onAfterShadow=()=>{mesh.count=count;};
  return ()=>{mesh.count=count;mesh.onBeforeShadow=before;mesh.onAfterShadow=after;};
}
