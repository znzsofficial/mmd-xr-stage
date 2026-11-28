import type { ThreeMmdModel } from '@yohawing/three-mmd-loader';
import { Mesh, MeshToonMaterial, Texture } from 'three';
import { expect, it, vi } from 'vitest';
import { createModelTextureUploads } from './modelTextureUploads';

function fixture() {
  const map = new Texture({ width: 8, height: 8 });
  const toon = new Texture({ width: 8, height: 8 });
  const material = new MeshToonMaterial({ map, gradientMap: toon });
  material.userData.mmdSphereTexture = map;
  const model = { mesh: new Mesh(undefined, [material, material]) } as unknown as ThreeMmdModel;
  return { model, map, toon };
}

it('uploads each referenced texture once over tracked frames before releasing placement', async () => {
  const init = vi.fn(), queue = createModelTextureUploads(init);
  const { model, map, toon } = fixture();
  const placed = vi.fn();
  const ready = queue.prepare(model, () => false).then(placed);
  expect(init).not.toHaveBeenCalled();
  queue.advance();
  await Promise.resolve();
  expect(init.mock.calls).toEqual([[map]]);
  expect(placed).not.toHaveBeenCalled();
  queue.advance();
  await ready;
  expect(init.mock.calls).toEqual([[map], [toon]]);
  expect(placed).toHaveBeenCalledOnce();
});

it('skips the rest of a retired room and settles pending work on XR exit', async () => {
  const init = vi.fn(), queue = createModelTextureUploads(init);
  const original = fixture(), next = fixture();
  let stale = false;
  const abandoned = queue.prepare(original.model, () => stale);
  const ready = queue.prepare(next.model, () => false);
  queue.advance();
  stale = true;
  queue.advance();
  await abandoned;
  expect(init.mock.calls).toEqual([[original.map], [next.map]]);
  const finished = expect(ready).rejects.toMatchObject({ name: 'AbortError' });
  queue.dispose();
  await finished;
  queue.advance();
  expect(init).toHaveBeenCalledTimes(2);
});
