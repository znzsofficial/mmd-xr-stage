import { REVISION, Vector3 } from 'three/webgpu';
import { Fn, If, attribute, attributeArray, instanceIndex, positionLocal, storage, uint, uniform, vec3, vec4 } from 'three/tsl';

// r187 has no public native handle accessor. The compute pass has already
// allocated this fixed-size, non-interleaved StorageBufferAttribute. has()
// first: even backend.get() would insert a record on a miss. Never install a
// foreign buffer here; Three owns allocation, bindings and destruction.
function borrowNativeBuffer(renderer, attribute) {
  const backend = renderer.backend;
  const buffer = backend.has(attribute) && backend.get(attribute).buffer;
  if (!buffer || buffer.size !== attribute.count * 16 || !(buffer.usage & GPUBufferUsage.STORAGE)) {
    throw Error('Expected an allocated r187 vec4 storage buffer');
  }
  return buffer;
}

function clothPosition(points, goals, lookup, scale, strength) {
  const indices = attribute('skinIndex', 'uvec4'), weights = attribute('skinWeight', 'vec4');
  return Fn(() => {
    const offset = vec3(0).toVar();
    for (const lane of 'xyzw') {
      const bone = indices[lane], weight = weights[lane];
      If(weight.greaterThan(0), () => {
        // fitRig uses zero for an unrelated bone, i + 1 for particle i.
        const entry = lookup.element(bone).toConst();
        If(entry.notEqual(uint(0)), () => {
          const i = entry.sub(uint(1));
          offset.addAssign(points.element(i).xyz.sub(goals.element(i).xyz).mul(weight));
        });
      });
    }
    // setupPosition applies morph/skinning before positionNode. setupVertex
    // puts that stack in context.position even for the fork's custom outline
    // vertexNode, which then reads positionLocal to expand in clip space.
    // Placement is applied later by the same model-view matrix in both draws.
    return positionLocal.add(offset.mul(strength).div(scale));
  })();
}

/**
 * Call once after pipeline.attach, on an initialized native WebGPURenderer.
 * All dispatches submit synchronously on its queue. points/goals are borrowed
 * array<vec4f> GPU buffers in actor-rig metres, valid up to dispose/device loss.
 * Stop the solver before dispose(), then detach the model and release the
 * renderer. A new actor/device needs its own surface and native bind groups.
 */
export function createClothSurface(renderer, mesh, rig) {
  if (REVISION !== '187' || !renderer.initialized || !renderer.backend.isWebGPUBackend) {
    throw Error('Cloth surface requires an initialized native Three r187 WebGPURenderer');
  }
  const count = rig.nodes.length;
  if (!count || !(rig.scale > 0) || !Number.isFinite(rig.scale) || !(rig.lookup instanceof Uint32Array) ||
      !mesh.isSkinnedMesh || rig.lookup.length !== mesh.skeleton.bones.length ||
      mesh.geometry.getAttribute('skinIndex')?.itemSize !== 4 || mesh.geometry.getAttribute('skinWeight')?.itemSize !== 4) {
    throw Error('Cloth surface requires a fitted PMX skin and bone lookup');
  }
  const originals = new Map(), materials=[mesh.material].flat();
  const g=mesh.geometry, ids=g.attributes.skinIndex, weights=g.attributes.skinWeight, affected=new Uint8Array(ids.count);
  for(let i=0;i<ids.count;i++)for(let j=0;j<4;j++)if(weights.getComponent(i,j)>0 && rig.lookup[ids.getComponent(i,j)]){affected[i]=1;break;}
  // Don't add cloth storage bindings or vertex work to eyes, skin and other
  // unrelated slots. The appended edge group covers its original index range.
  for (const group of g.groups) {
    const material=materials[group.materialIndex??0];if(originals.has(material))continue;
    let used=false;for(let j=group.start;j<group.start+group.count;j++)if(affected[g.index?g.index.getX(j):j]){used=true;break;}
    if(!used)continue;
    if (!material.isNodeMaterial || (material.positionNode !== positionLocal && material.positionNode !== null)) {
      throw Error('Expected the original attached MMD TSL position node');
    }
    originals.set(material, material.positionNode);
  }
  if (!originals.size) throw Error('No drawn PMX group is weighted to this skirt rig');

  const points = attributeArray(count, 'vec4');
  const goals = attributeArray(count, 'vec4').toReadOnly();
  if (rig.rest) goals.value.array.set(rig.rest); // includes the solver's pinned/free w
  const lookup = attributeArray(rig.lookup, 'uint').toReadOnly();
  const strength = uniform(1);
  const position = clothPosition(storage(points.value, 'vec4', count).toReadOnly(), goals, lookup, rig.scale, strength);
  const selected = uniform(count, 'uint'), delta = uniform(new Vector3());
  const probe = Fn(() => {
    const goal = goals.element(instanceIndex);
    const move = instanceIndex.equal(selected).select(delta, vec3(0));
    points.element(instanceIndex).assign(vec4(goal.xyz.add(move), goal.w));
  })().compute(count);

  let disposed = false;
  function dispatch() {
    if (disposed) throw Error('Cloth surface disposed');
    renderer.compute(probe);
  }
  function reset() {
    selected.value = count; // no matching invocation: every point follows its current goal
    dispatch();
  }
  function displace(node, meters) {
    const x = meters?.x ?? meters?.[0], y = meters?.y ?? meters?.[1], z = meters?.z ?? meters?.[2];
    if (!Number.isInteger(node) || node < 0 || node >= count) throw RangeError('Invalid cloth node index');
    if (![x, y, z].every(Number.isFinite)) throw TypeError('Expected a finite actor-rig displacement');
    selected.value = node;
    delta.value.set(x, y, z);
    dispatch();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const [material, original] of originals) {
      if (material.positionNode !== position) continue;
      material.positionNode = original;
      material.needsUpdate = true;
    }
    originals.clear();
    probe.dispose();
    for (const node of [points, goals, lookup]) node.value.dispose();
  }

  try {
    reset();
    const result = { points: borrowNativeBuffer(renderer, points.value), goals: borrowNativeBuffer(renderer, goals.value),
      setEnabled(on) { strength.value = on ? 1 : 0; }, displace, reset, dispose };
    for (const material of originals.keys()) {
      material.positionNode = position;
      material.needsUpdate = true;
    }
    return result;
  } catch (error) {
    dispose();
    throw error;
  }
}
