import {Vector3} from 'three';
import {departureAt,moons,rideStep,startRide,type Moon,type Ride} from '../scenery/planet/windAtlas';
import {moonRadius} from '../scenery/planet/moonSurface';
import {createTraveller,north} from '../movement/planetTravel';
import {moonWalk} from '../movement/moonWalk';
import {startTwinLeap,stepTwinLeap,type TwinLeap} from '../movement/twinLeap';

// Inspection camera stays level. During a jump its eye follows the same foot
// and local vertical as XR; mouse orbit, wheel or a new shot releases it.
export function screenWindTravel(look:(direction:Vector3,weight:number)=>void){
  let ride:Ride|null=null,leap:TwinLeap|null=null,hopping:Moon|null=null,launch=false;
  const traveller=createTraveller(),lastEye=new Vector3(),still=new Vector3(),foot=new Vector3(),up=new Vector3(),direction=new Vector3(),height=1.65;
  return {
    jump(eye:Vector3){
      if(ride||leap||hopping)return;
      // The nearest *surface*, not the nearest centre: either wall of the
      // strait may host the eye, even when the moons have different radii.
      for(const m of moons){
        up.subVectors(eye,m.centre);const r=up.length();if(r<.01)continue;up.divideScalar(r);
        const ground=moonRadius(m,up.x,up.y,up.z);
        if(Math.abs(r-height-ground)>.14)continue;
        foot.copy(eye).addScaledVector(up,-height);
        leap=startTwinLeap(m,foot);lastEye.copy(eye);
        if(!leap){hopping=m;launch=true;traveller.foot.copy(foot);traveller.up.copy(up);
          traveller.basis.setFromUnitVectors(north,up);traveller.velocity.set(0,0,0);traveller.grounded=true;}
        return;
      }
    },
    pass(eye:Vector3,_delta:Vector3){
      if(ride||leap||hopping)return false;foot.copy(eye);foot.y-=height;
      const world=moons.find(m=>foot.distanceToSquared(m.centre)<(m.radius+1.4)**2)??null;
      const lane=departureAt(foot,world);if(lane)ride=startRide(lane,!!world,foot);
      return false; // no instantaneous G-key translation
    },
    walk(eye:Vector3,delta:Vector3,dt:number){
      if(leap||hopping){
        if(eye.distanceToSquared(lastEye)>.0004){leap=null;hopping=null;return;}
        if(leap){
          const done=stepTwinLeap(leap,Math.min(.05,dt),foot,up);
          // A level screen travelling shot pans through open space; otherwise
          // the final view would stare into the rock directly under the feet.
          const f=Math.min(1,leap.time/leap.eta),yaw=(leap.from.id==='salt'?1:-1)*1.35*Math.cos(Math.PI*f);
          direction.set(Math.sin(yaw),.03,-Math.cos(yaw));look(direction,1-Math.exp(-5*dt));
          if(done)leap=null;
        }
        else if(hopping){moonWalk(hopping,traveller,still,0,Math.min(.05,dt),launch);launch=false;
          foot.copy(traveller.foot);up.copy(traveller.up);if(traveller.grounded)hopping=null;}
        lastEye.copy(foot).addScaledVector(up,height);delta.subVectors(lastEye,eye);return;
      }
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
    dispose(){ride=null;leap=null;hopping=null;},
  };
}
