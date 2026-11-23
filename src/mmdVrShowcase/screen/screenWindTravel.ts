import {Vector3,type Quaternion} from 'three';
import {departureAt,allMoons,moons,rideStep,startRide,type WalkMoon,type Ride} from '../scenery/planet/windAtlas';
import {shellRadius} from '../movement/orbitalSurfaces';
import {createTraveller,north} from '../movement/planetTravel';
import {moonWalk} from '../movement/moonWalk';
import {startTwinLeap,stepTwinLeap,type TwinLeap} from '../movement/twinLeap';
import {tideChart,tideDatum,tideFloor} from '../scenery/planet/tideLayout';
import {tideWalkFactor} from '../scenery/planet/tideSession';

// Inspection camera stays level. During a jump its eye follows the same foot
// and local vertical as XR; mouse orbit, wheel or a new shot releases it.
export function screenWindTravel(look:(direction:Vector3,weight:number,range:number)=>void,turn:(arc:Quaternion,up:Vector3)=>void,scene?:object){
  let ride:Ride|null=null,leap:TwinLeap|null=null,hopping:WalkMoon|null=null,launch=false;
  let standing:WalkMoon|null=null,height=1.65;
  const traveller=createTraveller(),lastEye=new Vector3(),still=new Vector3(),foot=new Vector3(),up=new Vector3(),direction=new Vector3(),eyeOffset=new Vector3(),eyeAxis=north.clone();
  function stand(m:WalkMoon,p:Vector3,n:Vector3,axis=n){
    standing=m;traveller.foot.copy(p);traveller.up.copy(n);traveller.basis.setFromUnitVectors(north,n);
    traveller.velocity.set(0,0,0);traveller.grounded=true;eyeAxis.copy(axis);lastEye.copy(p).addScaledVector(eyeAxis,height);
  }
  function current(eye:Vector3){if(eye.distanceToSquared(lastEye)>.000001)standing=null;return standing;}
  function survey(eye:Vector3,localPortrait=false){
    standing=null;height=1.65;
    for(const m of allMoons){
      // The grotto portraits stand vertically above a charted floor. Looking
      // down the radius from the lens can hit a different step or the pool.
      if(m.id==='tide'&&localPortrait){
        const x=eye.x-m.centre.x,z=eye.z-m.centre.z;
        if(x>=tideChart.minX&&x<=tideChart.maxX&&z>=tideChart.minZ&&z<=tideChart.maxZ){
          foot.set(eye.x,tideDatum+tideFloor(x,z),eye.z);const h=eye.y-foot.y;
          if(h>=.90&&h<=1.90){height=h;stand(m,foot,up.subVectors(foot,m.centre).normalize(),north);break;}
        }
      }
      up.subVectors(eye,m.centre);const r=up.length();if(r<m.radius-.2||r>m.radius+3.4)continue;up.divideScalar(r);
      const ground=shellRadius(m,up.x,up.y,up.z),h=r-ground;
      if(localPortrait?h<.90||h>1.90:Math.abs(h-height)>.14)continue;
      height=h;stand(m,foot.copy(m.centre).addScaledVector(up,ground),up);break;
    }
  }
  return {
    survey,
    floorUp(eye:Vector3){return current(eye)?traveller.up:null;},
    jump(eye:Vector3){
      if(ride||leap||hopping)return;
      if(!current(eye))survey(eye);
      if(!standing)return;
      leap=startTwinLeap(standing,traveller.foot);
      if(!leap){hopping=standing;launch=true;}
      standing=null;
    },
    pass(eye:Vector3,_delta:Vector3){
      if(ride||leap||hopping)return false;
      let world=current(eye);
      if(world)foot.copy(traveller.foot);
      else {foot.copy(eye);foot.y-=1.65;world=moons.find(m=>foot.distanceToSquared(m.centre)<(m.radius+1.4)**2)??null;}
      const lane=departureAt(foot,world);if(lane){ride=startRide(lane,!!world,foot);standing=null;height=1.65;}
      return false; // no instantaneous G-key translation
    },
    walk(eye:Vector3,delta:Vector3,dt:number,rising=false){
      if(leap||hopping){
        if(eye.distanceToSquared(lastEye)>.0004){leap=null;hopping=null;return;}
        if(leap){
          const done=stepTwinLeap(leap,Math.min(.05,dt),foot,up);
          // A level screen travelling shot pans through open space; otherwise
          // the final view would stare into the rock directly under the feet.
          const f=Math.min(1,leap.time/leap.eta),yaw=1.35*Math.cos(Math.PI*f);
          direction.copy(leap.route.pad.up).multiplyScalar(Math.sin(yaw)).addScaledVector(leap.route.sight,Math.cos(yaw)).addScaledVector(north,.03).normalize();look(direction,1-Math.exp(-5*dt),5);
          eyeAxis.copy(up);if(done){stand(leap.to,foot,up);leap=null;}
        }
        else if(hopping){moonWalk(hopping,traveller,still,0,Math.min(.05,dt),launch,shellRadius,eyeOffset.copy(eyeAxis).multiplyScalar(height),eyeAxis);launch=false;
          foot.copy(traveller.foot);up.copy(traveller.up);if(traveller.grounded){stand(hopping,foot,up,eyeAxis);hopping=null;}}
        lastEye.copy(foot).addScaledVector(eyeAxis,height);delta.subVectors(lastEye,eye);return;
      }
      if(!ride){
        if(rising){standing=null;return;}
        const ground=current(eye),step=delta.length();if(!ground||!step||dt<=0)return;
        const wade=ground.id==='tide'&&traveller.grounded&&scene?tideWalkFactor(scene,traveller.foot):1;
        direction.copy(delta).projectOnPlane(traveller.up).normalize();moonWalk(ground,traveller,direction,step/dt*wade,dt,false,shellRadius,eyeOffset.copy(eyeAxis).multiplyScalar(height),eyeAxis);
        eyeAxis.applyQuaternion(traveller.arc);turn(traveller.arc,eyeAxis);lastEye.copy(traveller.foot).addScaledVector(eyeAxis,height);delta.subVectors(lastEye,eye);return;
      }
      const done=rideStep(ride,dt,foot,up);delta.copy(foot);delta.y+=height;
      // The last part of this screen-only travelling shot reveals the local
      // instrument and horizon. Never steer the tracked headset on arrival.
      const blend=Math.min(1,Math.max(0,(ride.time/ride.lane.duration-.55)*3.6));
      if(blend){const station=ride.lane.moon.station;
        if(ride.returning)direction.set(0,.47,.22);else direction.copy(station.base).addScaledVector(station.up,.73);
        direction.sub(delta);const range=direction.length();look(direction.normalize(),1-Math.exp(-3.0*dt*blend),range);}
      delta.sub(eye);if(done){if(!ride.returning)stand(ride.lane.moon,foot,up);ride=null;}
    },
    dispose(){ride=null;leap=null;hopping=null;standing=null;height=1.65;},
  };
}
