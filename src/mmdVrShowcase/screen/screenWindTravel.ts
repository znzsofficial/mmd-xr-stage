import {Vector3} from 'three';
import {departureAt,moons,rideStep,startRide,type Ride} from '../scenery/planet/windAtlas';

// The screen keeps its usual orbit/inspection controls. Only G at a marked
// collar owns camera translation until touchdown; selecting a shot cancels it.
export function screenWindTravel(look:(direction:Vector3,weight:number)=>void){
  let ride:Ride|null=null;
  const foot=new Vector3(),up=new Vector3(),direction=new Vector3(),height=1.65;
  return {
    pass(eye:Vector3,_delta:Vector3){
      if(ride)return false;foot.copy(eye);foot.y-=height;
      const world=moons.find(m=>foot.distanceToSquared(m.centre)<(m.radius+1.4)**2)??null;
      const lane=departureAt(foot,world);if(lane)ride=startRide(lane,!!world,foot);
      return false; // no instantaneous G-key translation
    },
    walk(eye:Vector3,delta:Vector3,dt:number){
      if(!ride)return;
      const done=rideStep(ride,dt,foot,up);delta.copy(foot);delta.y+=height;
      // The last part of this screen-only travelling shot reveals the local
      // instrument and horizon. Never steer the tracked headset on arrival.
      const blend=Math.min(1,Math.max(0,(ride.time/ride.lane.duration-.55)*3.6));
      if(blend){const station=ride.lane.moon.station;
        if(ride.returning)direction.set(0,.47,.22);else direction.copy(station.base).addScaledVector(station.up,.73);
        look(direction.sub(delta).normalize(),1-Math.exp(-3.0*dt*blend));}
      delta.sub(eye);if(done)ride=null;
    },
    dispose(){ride=null;},
  };
}
