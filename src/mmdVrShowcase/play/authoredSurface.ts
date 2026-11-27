import type {BufferGeometry, Material, SkinnedMesh} from 'three';
import type {PositionMorphs} from './wandPose';

/** CPU inputs for draws whose position/UV attributes are GPU output buffers. */
export type AuthoredSurface = {
  position:BufferGeometry['attributes'][string];
  uv:BufferGeometry['attributes'][string];
  readonly morphs:PositionMorphs;
  readonly morphIndices?:ReadonlySet<number>;
  sampleable(indices:number[],material?:Material):boolean;
};

export const authoredSurface = new WeakMap<SkinnedMesh,AuthoredSurface>();
