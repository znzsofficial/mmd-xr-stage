/** Wall time inside a single switch, accumulated over its models. Native
 * seeding on the following XR frame is outside the busy transaction. */
export type PhysicsSwitchWork=Partial<Record<'waitForSlotMs'|'bulletModuleMs'|'createBackendMs'|'readModelMs'|'evaluatorMs'|'bindAndSwapMs'|'publishUiMs'|'rollbackMs',number>>;
export function elapsed(work:PhysicsSwitchWork|undefined,key:keyof PhysicsSwitchWork,start:number){
  if(work)work[key]=(work[key]??0)+performance.now()-start;
}
