/** Wall clock deltas for ONE fresh character placement. No resource identifiers. */
export interface PlacementWork {
  loaderWallMs: number;
  textureCount: number;
  initTextureCpuMs: number;
  maxInitTextureCpuMs: number;
  yieldWallMs: number;
  compileAsyncWallMs: number | null;
}
export const createPlacementWork = (): PlacementWork => ({loaderWallMs:0, textureCount:0, initTextureCpuMs:0, maxInitTextureCpuMs:0, yieldWallMs:0, compileAsyncWallMs:null});
