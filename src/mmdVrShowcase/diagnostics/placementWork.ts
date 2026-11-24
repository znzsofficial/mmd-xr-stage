/** Wall clock deltas for ONE fresh character placement. No resource identifiers. */
export interface PlacementWork {
  loaderWallMs: number;
  loaderStagesMs?: Partial<Record<typeof phases[number],number>>;
  textureCount: number;
  initTextureCpuMs: number;
  maxInitTextureCpuMs: number;
  yieldWallMs: number;
  compileAsyncWallMs: number | null;
}
const phases = ['read-bytes','init-core','parse-only','create-mesh','load-textures','material-metadata','assemble-model'] as const;
export function placementLoaderProfile(work:PlacementWork) {
  return {enabled:false, onMeasure:({name,durationMs}:{name:string;durationMs:number})=>{
    const phase=phases.find(p=>p===name);
    if(phase && Number.isFinite(durationMs) && durationMs>=0)(work.loaderStagesMs??={})[phase]=durationMs;
  }};
}
export const createPlacementWork = (): PlacementWork => ({loaderWallMs:0, textureCount:0, initTextureCpuMs:0, maxInitTextureCpuMs:0, yieldWallMs:0, compileAsyncWallMs:null});
