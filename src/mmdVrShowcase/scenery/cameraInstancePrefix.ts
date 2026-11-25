import { Box3, Frustum, Matrix4, type InstancedMesh } from 'three';

/** For static opaque instances arranged in contiguous groups. Each drawing
 * eye omits only groups wholly outside its frustum. Leave the full count for
 * the next eye, shadow pass and room's solid-column queries. */
export function cameraInstancePrefix(mesh: InstancedMesh, ends: readonly number[]) {
  const count = mesh.count, matrix = new Matrix4(), scratch = new Box3(), frustum = new Frustum();
  const geometry = mesh.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  let i = 0;
  const groups = ends.map(end => {
    const bounds = new Box3();
    for (; i < end; i++) {
      mesh.getMatrixAt(i, matrix);
      bounds.union(scratch.copy(geometry.boundingBox!).applyMatrix4(matrix));
    }
    return bounds;
  });
  const before = mesh.onBeforeRender, after = mesh.onAfterRender;
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
    frustum.setFromProjectionMatrix(matrix, camera.coordinateSystem, camera.reversedDepth);
    let last = groups.length - 1;
    while (last >= 0 && !frustum.intersectsBox(groups[last])) last--;
    mesh.count = last < 0 ? 0 : ends[last];
  };
  mesh.onAfterRender = () => { mesh.count = count; };
  return () => { mesh.count = count; mesh.onBeforeRender = before; mesh.onAfterRender = after; };
}
