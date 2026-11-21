import {Vector3} from 'three';
import {moons,type Moon} from '../scenery/planet/windAtlas';
import {moonRadius} from '../scenery/planet/moonSurface';

const north=new Vector3(0,1,0),step=1/120;
export const TWIN_PAD_RADIUS=.68;

/** Equatorial pad centre, in world coordinates, on the same relief as the mesh. */
export function twinPad(m:Moon){
  if(m.id!=='salt'&&m.id!=='glaze')return null;
  const up=new Vector3(m.id==='salt'?1:-1,0,0);
  return {up,foot:m.centre.clone().addScaledVector(up,moonRadius(m,up.x,0,0))};
}

function shellHeight(m:Moon,p:Vector3,n:Vector3){
  n.subVectors(p,m.centre);const r=n.length();n.divideScalar(r);
  return r-moonRadius(m,n.x,n.y,n.z);
}

// A single active well. The near-surface bisector is the acquisition boundary,
// not a blend (which would cancel the two wells in the middle of the gap).
function acquired(from:Moon,to:Moon,p:Vector3){
  return p.distanceTo(from.centre)-from.radius>=p.distanceTo(to.centre)-to.radius;
}

// Inverse-square radial pull, calibrated in m/s² at each nominal surface.
// The launch assist additionally contributes a weak, constant -Y acceleration:
// a +Y take-off impulse describes an arch above the line of centres. No rail,
// waypoint interpolation or scripted timing controls the downrange velocity.
const assistDown=1.05,seamSpeed=1.7;
function integrate(well:Moon,p:Vector3,v:Vector3,a:Vector3){
  a.subVectors(well.centre,p);const r2=a.lengthSq();
  a.multiplyScalar(well.surfaceGravity*well.radius**2/(r2*Math.sqrt(r2)));a.y-=assistDown;
  p.addScaledVector(v,step).addScaledVector(a,step*step/2);v.addScaledVector(a,step);
}

/** Only the initial impulse is aimed. Predict where this velocity intersects
 * the far pad's tangent plane; correct its lateral components before launch.
 * The live flight ends on terrain contact, not when this estimate expires. */
function aim(from:Moon,to:Moon,start:Vector3,target:Vector3,axis:number){
  const gap=(target.x-start.x)*axis,r=start.distanceTo(from.centre);
  const exitEnergy=from.surfaceGravity*from.radius**2*(1/r-1/(r+gap/2));
  const speed=Math.sqrt(seamSpeed**2+2*exitEnergy);
  let eta=gap/((speed+seamSpeed)/2);
  const launch=new Vector3(axis*speed,(target.y-start.y)/eta+assistDown*eta/2,(target.z-start.z)/eta);
  const p=new Vector3(),v=new Vector3(),a=new Vector3(),prev=new Vector3();
  for(let shot=0;shot<6;shot++){
    p.copy(start);v.copy(launch);let owner=from;
    for(let i=0;i<8/step;i++){
      prev.copy(p);integrate(owner,p,v,a);
      if(owner===from&&acquired(from,to,p))owner=to;
      if((p.x-target.x)*axis<0)continue;
      const f=(target.x-prev.x)/(p.x-prev.x);eta=(i+f)*step;prev.lerp(p,f);
      const dy=target.y-prev.y,dz=target.z-prev.z;
      if(Math.hypot(dy,dz)<.003||shot===5)return {launch,eta};
      launch.y+=dy/eta;launch.z+=dz/eta;break;
    }
  }
  return null;
}

/** Returns null outside a pad, including while substantially above its shell.
 * XR may pass its current up so rebasing a room-scale offset doesn't tilt the
 * headset on the launching frame. The screen can use the local radial up. */
export function startTwinLeap(from:Moon,actualFoot:Vector3,initialUp?:Vector3){
  const pad=twinPad(from);if(!pad||actualFoot.distanceToSquared(pad.foot)>TWIN_PAD_RADIUS**2)return null;
  const to=moons.find(m=>m.id===(from.id==='salt'?'glaze':'salt'));if(!to)return null;
  const target=twinPad(to)!,n=new Vector3(),height=shellHeight(from,actualFoot,n);
  if(Math.abs(height)>.16)return null;
  const start=actualFoot.clone().addScaledVector(n,Math.max(0,-height));
  const impulse=aim(from,to,start,target.foot,pad.up.x);if(!impulse)return null;
  return {from,to,owner:from,time:0,startUp:(initialUp??n).clone(),eta:impulse.eta,
    // Two fixed-step endpoints. Sample between them without committing a
    // display-frame-sized integration step (also when tracking resumes).
    previous:start.clone(),position:start,velocity:impulse.launch,well:from,
    t0:0,t1:0,contact:false,normal:n,accel:new Vector3(),probe:new Vector3()};
}
export type TwinLeap=NonNullable<ReturnType<typeof startTwinLeap>>;

function advance(l:TwinLeap){
  l.previous.copy(l.position);l.t0=l.t1;l.t1+=step;
  integrate(l.well,l.position,l.velocity,l.accel);
  if(l.well===l.from&&acquired(l.from,l.to,l.position))l.well=l.to;
  if(l.well!==l.to||shellHeight(l.to,l.position,l.normal)>0)return;
  // Intersect the final short step with the actual relief. Pixel/display Hz
  // cannot change the touchdown location or produce a frame under the mesh.
  let lo=0,hi=1;
  for(let i=0;i<18;i++){
    const f=(lo+hi)/2;l.probe.lerpVectors(l.previous,l.position,f);
    if(shellHeight(l.to,l.probe,l.normal)>0)lo=f;else hi=f;
  }
  l.position.lerpVectors(l.previous,l.position,lo);l.t1=l.t0+lo*step;l.contact=true;
}

// Each leg is at most about a right angle. Spherical interpolation keeps
// the roll speed even through the two quarter-turns at the top of the arc.
function turn(a:Vector3,b:Vector3,t:number,out:Vector3){
  const angle=a.angleTo(b),den=Math.sin(angle);
  if(den<1e-7)return out.lerpVectors(a,b,t).normalize();
  return out.copy(a).multiplyScalar(Math.sin(angle*(1-t))/den).addScaledVector(b,Math.sin(angle*t)/den);
}

/** Same physical sampler for screen and XR. `owner` switches at capture, while
 * the presentation up independently rolls over world +Y, never antipodally.
 * The caller parallel-transports its existing heading between these normals. */
export function stepTwinLeap(l:TwinLeap,dt:number,footOut:Vector3,upOut:Vector3){
  const requested=l.time+Math.max(0,dt);
  while(!l.contact&&l.t1<requested)advance(l);
  l.time=Math.min(requested,l.t1);
  const f=l.t1===l.t0?0:(l.time-l.t0)/(l.t1-l.t0);
  footOut.lerpVectors(l.previous,l.position,f);
  if(l.owner===l.from&&acquired(l.from,l.to,footOut))l.owner=l.to;
  const done=l.contact&&l.time===l.t1;
  const t=done?1:Math.min(1,l.time/(.97*l.eta)),ramp=.22;
  // Ease only the ends: the middle has finite, nearly constant angular speed.
  const k=(t<ramp?t*t/(2*ramp):t>1-ramp?1-ramp-(1-t)**2/(2*ramp):t-ramp/2)/(1-ramp);
  l.normal.subVectors(footOut,l.to.centre).normalize();
  if(k<.5)turn(l.startUp,north,k*2,upOut);
  else turn(north,l.normal,k*2-1,upOut);
  return done;
}
