export type PhysicsPoseWork = { evaluations:number; animationIkMs:number; prepareMs:number; backendMs:number; writeBackMs:number };
export type BulletStepWork = { steps:number; seedOnly:number; feedMs:number; worldStepMs:number; outputsMs:number };

export function createRuntimeTiming() {
  let samples = 0;
  let sum = 0;
  let max = 0;
  let poses=0, animation=0, prepare=0, backend=0, write=0;
  let steps=0, seeds=0, feed=0, world=0, outputs=0;
  return {
    recordBullet(feedMs:number,worldMs:number,outputsMs:number,seedOnly:boolean){
      if(!(Number.isFinite(feedMs+worldMs+outputsMs)&&Math.min(feedMs,worldMs,outputsMs)>=0))return;
      steps++;if(seedOnly)seeds++;feed+=feedMs;world+=worldMs;outputs+=outputsMs;
    },
    recordPose(a:number,p:number,b:number,w:number) {
      if (!(Number.isFinite(a+p+b+w) && Math.min(a,p,b,w)>=0)) return;
      poses++; animation+=a; prepare+=p; backend+=b; write+=w;
    },
    record(ms: number) {
      if (!Number.isFinite(ms) || ms < 0) return;
      samples += 1; sum += ms; max = Math.max(max, ms);
    },
    readAndReset() {
      const physicsPoseWork:PhysicsPoseWork|undefined=poses ? {evaluations:poses,animationIkMs:animation/poses,prepareMs:prepare/poses,backendMs:backend/poses,writeBackMs:write/poses} : undefined;
      const bulletStepWork:BulletStepWork|undefined=steps?{steps,seedOnly:seeds,feedMs:feed/steps,worldStepMs:world/steps,outputsMs:outputs/steps}:undefined;
      const value = samples ? { mean: sum / samples, max, ...(physicsPoseWork && {physicsPoseWork}), ...(bulletStepWork && {bulletStepWork}) } : null;
      steps=seeds=feed=world=outputs=0;
      poses=animation=prepare=backend=write=0;
      samples = 0; sum = 0; max = 0;
      return value;
    },
  };
}

export const runtimeTiming = createRuntimeTiming();
