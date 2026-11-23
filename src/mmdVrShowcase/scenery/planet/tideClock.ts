/** Stage metres above the north landing. Low and high stands give the visitor
 * time to walk both routes; the dial changes the same tide, never the floor. */
export const ebbLevel=-.68,floodLevel=-.06;
export const tideGauge={x:1.42,z:-1.02,top:.63,r:.16} as const;
const stand=25,run=20,half=stand+run,period=2*half;
const smooth=(t:number)=>t*t*(3-2*t);
export function createTideClock(){
  let phase=0,level=ebbLevel,target=0,from=0,travel=0,duration=0;
  return {
    get level(){return level;},
    turn(){
      const next=duration?1-target:Number(level<(ebbLevel+floodLevel)/2);
      target=next;from=level;travel=0;duration=Math.max(.18,4.6*Math.abs((next?floodLevel:ebbLevel)-level)/(floodLevel-ebbLevel));
    },
    step(dt:number){
      if(!Number.isFinite(dt)||dt<=0)return level;
      const step=Math.min(.10,dt);
      if(duration){travel=Math.min(duration,travel+step);level=from+((target?floodLevel:ebbLevel)-from)*smooth(travel/duration);
        if(travel===duration){phase=target?half:0;duration=0;}return level;}
      phase=(phase+step)%period;const inward=phase<half,t=Math.min(1,Math.max(0,((phase%half)-stand)/run));
      level=ebbLevel+(floodLevel-ebbLevel)*(inward?smooth(t):1-smooth(t));return level;
    },
  };
}
