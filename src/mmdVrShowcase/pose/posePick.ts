import { type Group, type Intersection, type Mesh, type Object3D, type Ray, type Raycaster, Vector3 } from 'three';
import type { PoseKey } from './poseSession';

export type PoseHit = { key: PoseKey; ring: boolean };

/** selectstart can arrive between pointer traversals. Confirm the exact mesh
 * with the event frame before adopting either its key or its grab point. */
export function confirmPosePress(caster:Raycaster, root:Group, ray:Ray, eventTarget:Object3D) {
  caster.ray.copy(ray);
  const hit=caster.intersectObject(root,false)[0];
  return hit?.object===eventTarget ? hit : null;
}

/** Return the real mesh and surface point to both native and XR pointer capture.
 * The current point wins a stack; any point beats a dial. Among other points
 * aim accuracy (in handle radii) matters more than which wrist is nearer. */
export function posePicker() {
  const local = new Vector3(), hits: Intersection[] = [];
  return (caster: Raycaster, joints: Map<PoseKey,Group>, selected: PoseKey, out: Intersection[]) => {
    let best: Intersection | undefined, rank = -1, miss = Infinity;
    for (const [key,joint] of joints) {
      if (!joint.visible) continue;
      joint.updateWorldMatrix(true,true);
      for (const mesh of joint.children) {
        const hit: PoseHit | undefined = mesh.userData.poseHit; if (!hit) continue;
        hits.length = 0; (mesh as Mesh).raycast(caster,hits);
        const h = hits[0]; if (!h) continue;
        const tier = hit.ring ? 0 : key === selected ? 2 : 1;
        const r = joint.worldToLocal(local.copy(h.point)).lengthSq();
        if (tier > rank || tier === rank && (r < miss-1e-5 || Math.abs(miss-r) < 1e-5 && h.distance < best!.distance)) {
          best=h; rank=tier; miss=r;
        }
      }
    }
    if (best) out.push(best);
  };
}
