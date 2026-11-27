import type { Intersection, Material, Mesh, Object3D, Raycaster, Scene } from 'three';

/** Only real room and prop draws can stand between the input and the garment.
 * The caller checks posed actors and sets far to the selected stocking hit. */
export function stockingWorldBlocks(scene: Scene, caster: Raycaster) {
  const hits: Intersection[] = [];
  function blocks(node: Object3D, inSolid: boolean): boolean {
    if (!node.visible) return false;
    const solid = inSolid || node.name === 'player:room-solids' || node.userData.stagePropSolid === true || node.name.startsWith('play:piece:');
    const mesh = node as Mesh;
    function drawn(material: Material | undefined) {
      // Projected skies and the sea horizon use a unit sphere as vertex input;
      // that sphere isn't located in the room. Keep actual translucent props.
      return material?.visible && material.colorWrite && material.opacity > 0 && material.opacity >= material.alphaTest
        && !(mesh.renderOrder < 0 && !mesh.frustumCulled && !material.depthWrite);
    }
    if (solid && mesh.isMesh && !mesh.userData.mmdModelId && mesh.layers.test(caster.layers)
      && (Array.isArray(mesh.material) ? mesh.material.some(drawn) : drawn(mesh.material))) {
      hits.length = 0;
      // Scenery disables ordinary pointer handling with a per-object no-op.
      // The intrinsic implementation still knows how to hit instances, bones,
      // and batches; this visibility check is not a dispatched scene event.
      const prototype: Mesh = Object.getPrototypeOf(mesh);
      prototype.raycast.call(mesh, caster, hits);
      for (const hit of hits) {
        const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
        if (hit.distance < caster.far && drawn(material)) return true;
      }
    }
    return node.children.some(child => blocks(child, solid));
  }
  return blocks(scene, false);
}
