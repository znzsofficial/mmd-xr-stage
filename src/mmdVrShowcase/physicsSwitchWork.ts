/** Wall time inside a single switch, accumulated over its models. Native
 * seeding on the following XR frame is outside the busy transaction. */
type Phase='waitForSlotMs'|'bulletModuleMs'|'createBackendMs'|'readModelMs'|'evaluatorMs'|'bindAndSwapMs'|'publishUiMs'|'rollbackMs';
export type PhysicsSwitchWork=Partial<Record<Phase,number>> & {
  moduleAtFirstRequest?: 'cold' | 'warming' | 'warmed' | 'warm-failed' | 'demand-reuse';
};
export function elapsed(work:PhysicsSwitchWork|undefined,key:Phase,start:number){
  if(work)work[key]=(work[key]??0)+performance.now()-start;
}
