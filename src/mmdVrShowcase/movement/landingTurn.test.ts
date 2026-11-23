import {Quaternion,Vector3} from 'three';
import {expect,it} from 'vitest';
import {leapRoutes} from '../scenery/planet/leapAtlas';
import {altitude} from './orbitalSurfaces';
import {startLandingTurn,stepLandingTurn,landingTurnRate} from './landingTurn';
import {north} from './planetTravel';

it.each(leapRoutes)('$pad.id → $target.id: auto-align about an opposed landing without sweeping feet, torso or eye through either island',({pad,target,crest})=>{
  const eye=new Vector3(.07,1.95,.09),q=new Quaternion().setFromUnitVectors(north,pad.up);
  const foot=target.foot.clone().addScaledVector(target.up,eye.y).addScaledVector(pad.up,-eye.y);
  const end=target.foot,arc=new Quaternion().setFromAxisAngle(crest,Math.PI),s=startLandingTurn(foot,q,end,arc);
  let done=false,max=0;const dt=1/36,prev=q.clone(),p=new Vector3();
  for(let i=0;i<360&&!done;i++){
    prev.copy(q);done=stepLandingTurn(s,dt,eye,foot,q);max=Math.max(max,q.angleTo(prev)/dt);
    for(const h of [0,.16,.6,1.1,1.65,eye.y])for(const m of [pad.moon,target.moon]){
      p.copy(eye).setY(h).applyQuaternion(q).add(foot);expect(altitude(m,p)).toBeGreaterThan(-.001);
    }
  }
  expect(done).toBe(true);expect(foot.distanceTo(end)).toBeLessThan(.0001);expect(max).toBeLessThanOrEqual(landingTurnRate+.00001);
  expect(north.clone().applyQuaternion(q).angleTo(target.up)).toBeLessThan(1e-6);
});

it('pauses synthetic motion for an obstructed turn, including with a long display delta; resumes when tracking clears',()=>{
  const {target,pad}=leapRoutes[0],foot=target.foot.clone().addScaledVector(target.up,.12),q=new Quaternion().setFromUnitVectors(north,pad.up);
  const eye=new Vector3(0,1.7,0),turn=startLandingTurn(foot,q,target.foot,new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI));
  // A virtual lean into the near equator makes an intermediate portion of
  // the rotating body intersect rock. A stationary blocked pose must not be
  // forcibly separated, and no part of the paused time is caught up.
  eye.x=2.8;eye.z=1.8;
  for(let i=0;i<200&&!turn.blocked;i++)stepLandingTurn(turn,.15,eye,foot,q);
  expect(turn.blocked).toBe(true);const frozen=q.clone(),at=foot.clone();
  stepLandingTurn(turn,.15,eye,foot,q);expect(q.angleTo(frozen)).toBeLessThan(1e-7);expect(foot.distanceTo(at)).toBeLessThan(1e-10);
  eye.set(0,1.7,0);let done=false;for(let i=0;i<800&&!done;i++)done=stepLandingTurn(turn,1/90,eye,foot,q);
  expect(done).toBe(true);
});
