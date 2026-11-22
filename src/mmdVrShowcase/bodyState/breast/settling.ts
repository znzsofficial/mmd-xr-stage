/** A tiny display-only lag of the free lower pole after a manual adjustment.
 * Positive = still lifted relative to the newly fuller resting outline. The
 * analytic, critically damped response decays to rest without oscillation. */
export function lowerPoleLag(){
  let offset=0,velocity=0;
  return {get value(){return offset;},
    adjust(delta:number){offset=Math.min(1,Math.max(-1,offset+delta));},
    step(dt:number){
      if(!offset&&!velocity)return;
      const rate=11,s=velocity+rate*offset,decay=Math.exp(-rate*dt);
      offset=(offset+s*dt)*decay;velocity=(velocity-rate*s*dt)*decay;
      if(Math.abs(offset)<.004&&Math.abs(velocity)<.04)offset=velocity=0;
    },reset(){offset=velocity=0;}};
}
