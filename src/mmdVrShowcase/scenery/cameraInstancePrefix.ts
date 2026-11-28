import { Box3, Frustum, Matrix4, type ArrayCamera, type Camera, type InstancedMesh } from 'three';

/** Trim an invisible suffix of contiguous instance groups, then restore the
 * full count for room queries. A stereo margin opts into one retained range
 * for both eyes and keeps shadow draws independent of that viewer history. */
export function cameraInstancePrefix(mesh: InstancedMesh, ends: readonly number[], stereoRetainMargin?: number) {
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
  const retained = stereoRetainMargin ? groups.map(bounds => bounds.clone().expandByScalar(stereoRetainMargin)) : groups;
  let previous = -1;
  function lastVisible(camera: Camera, alreadyVisible: number) {
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
    frustum.setFromProjectionMatrix(matrix, camera.coordinateSystem, camera.reversedDepth);
    let last = groups.length - 1;
    while (last > alreadyVisible && !frustum.intersectsBox(last <= previous ? retained[last] : groups[last])) last--;
    return last;
  }
  const before = mesh.onBeforeRender, after = mesh.onAfterRender;
  if (stereoRetainMargin === undefined) {
    mesh.onBeforeRender = (_renderer, _scene, camera) => { mesh.count = ends[lastVisible(camera, -1)] ?? 0; };
    mesh.onAfterRender = () => { mesh.count = count; };
  } else {
    const enclosingCounts: number[] = [];
    mesh.onBeforeRender = (renderer, scene, camera) => {
      // The first WebGPU receiver may render a nested shadow pass before its
      // own draw. Give the light all casters, then restore the enclosing eye count.
      enclosingCounts.push(mesh.count);
      if (scene.overrideMaterial) { mesh.count = count; return; }
      const rig = renderer.xr?.isPresenting ? renderer.xr.getCamera() : null;
      const eyes = rig && (camera === rig || rig.cameras.some(eye => eye === camera)) ? rig.cameras : (camera as ArrayCamera).cameras;
      let last = -1;
      if (eyes?.length) for (const eye of eyes) last = lastVisible(eye, last);
      else last = lastVisible(camera, -1);
      previous = last;
      mesh.count = ends[last] ?? 0;
    };
    mesh.onAfterRender = () => { mesh.count = enclosingCounts.pop() ?? count; };
  }
  return () => { mesh.count = count; mesh.onBeforeRender = before; mesh.onAfterRender = after; };
}
