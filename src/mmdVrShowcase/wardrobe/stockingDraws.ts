import { Box3, Ray, Triangle, Vector3, type Material, type Mesh, type Object3D, type SkinnedMesh } from 'three';
import { modelDrawRange } from '../mmdRuntime/modelDrawRange';
import { materialSlotKeys, sourceMaterialSlot } from '../mmdRuntime/materialSlotKey';
import { authoredSurface } from '../play/authoredSurface';
import { visibleTexel } from '../play/wandOpacity';
import { createWandPose } from '../play/wandPose';
import type { WandModel } from '../play/wandSurface';

export function shownObject(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

export function shownMaterial(m: Material) {
  return m.visible && m.colorWrite && m.opacity > 0 && m.opacity >= m.alphaTest;
}

/** Address the colour triangles actually submitted, not the hidden logical
 * source, shadow proxy, outline hull, or another split's vertex indices. */
export function stockingDraws(model: WandModel) {
  const original = model.mesh;
  const slots = [original.material].flat(), keys = materialSlotKeys(slots);
  const splits: SkinnedMesh[] = original.userData.mmdMorphSplitBodyMeshes ?? [];
  return (splits.length ? splits : [original]).flatMap(body => {
    const g = body.geometry, source = authoredSurface.get(body);
    const position = source?.position ?? g.attributes.position, uv = source?.uv ?? g.attributes.uv;
    const total = g.index?.count ?? position?.count ?? 0;
    let sampler: ReturnType<typeof createWandPose> | undefined, lastFrame = -1;
    function posed(frame: number) {
      sampler ??= createWandPose(body, original, source?.morphs, position);
      if (frame !== lastFrame) { sampler.begin(); lastFrame = frame; }
      return sampler;
    }
    const ranges = (owner: Mesh) => {
      const range = modelDrawRange(owner), mats = [owner.material].flat();
      const groups = Array.isArray(owner.material) ? owner.geometry.groups : [{ start: 0, count: total, materialIndex: 0 }];
      return groups.flatMap(group => {
        const local = group.materialIndex ?? 0, mat = mats[local];
        const start = Math.max(0, group.start, range.start), end = Math.min(total, group.start + group.count, range.start + range.count);
        if (!mat || end <= start || mat.userData.mmdTslOutlineMaterial || mat.userData.mmdOutlineMaterial || mat.userData.mmdShadowOnlyRenderProxy || !mat.colorWrite) return [];
        const index = sourceMaterialSlot(owner, slots, mat, local);
        const material = () => Array.isArray(owner.material) ? owner.material[local] : owner.material;
        return [{ body, owner, position, uv, source, material, author: slots[index] ?? mat, key: keys[index], start, end, posed }];
      });
    };
    return body === original && modelDrawRange(body).count === 0 ? model.renderOrderMeshes.flatMap(ranges) : ranges(body);
  });
}

export type StockingDraw = ReturnType<typeof stockingDraws>[number];

/** Only acquired rays do this work. The nearby rays used to fit the drag
 * tangents share both the displayed vertex cache and the posed chunk bounds. */
export function stockingBlockers(draws: StockingDraw[]) {
  if (draws.some(d=>d.position.count>450_000) || draws.reduce((n,d)=>n+d.end-d.start,0)>2_400_000) return ()=>true;
  const blocks = draws.flatMap(draw => {
    const chunks = [];
    for (let start = draw.start; start < draw.end; start += 288) {
      chunks.push({ draw, start, end: Math.min(start + 288, draw.end), box: new Box3(), frame: -1, unknown: false });
    }
    return chunks;
  });
  const p = new Vector3(), tri = new Triangle(), ids: number[] = [];
  return (frame: number, ray: Ray, distance: number) => {
    const limit = distance * distance;
    for (const chunk of blocks) {
      const { draw, start, end } = chunk, m = draw.material();
      if (!shownObject(draw.owner) || !shownMaterial(m)) continue;
      const pose = draw.posed(frame), g = draw.body.geometry, ix = g.index;
      if (chunk.frame !== frame) {
        chunk.frame = frame; chunk.box.makeEmpty(); ids.length = 0;
        for (let j = start; j < end; j++) {
          const i = ix?.getX(j) ?? j;
          chunk.box.expandByPoint(pose.vertex(i, p));
          if (draw.source) ids.push(i);
        }
        chunk.unknown = !!draw.source && !draw.source.sampleable(ids, m);
      }
      // A GPU-only moving cloth has no synchronous CPU position. Do not
      // authorize a grab through such a visible draw using its old rest pose.
      if (chunk.unknown) return true;
      if (!ray.intersectBox(chunk.box, p) || (!chunk.box.containsPoint(ray.origin) && p.distanceToSquared(ray.origin) >= limit)) continue;
      for (let j = start; j + 2 < end; j += 3) {
        pose.vertex(ix?.getX(j) ?? j, tri.a);
        pose.vertex(ix?.getX(j + 1) ?? j + 1, tri.b);
        pose.vertex(ix?.getX(j + 2) ?? j + 2, tri.c);
        if (ray.intersectTriangle(tri.a, tri.b, tri.c, false, p) && p.distanceToSquared(ray.origin) < limit &&
          visibleTexel(m, g, j, tri, p, draw.uv, true)) return true;
      }
    }
    return false;
  };
}
