// Browser-side smoke only. Read the submitted stereo cameras and the actual
// Bullet input slots; never read/write the motor foot or its origin transform.
import {_roots} from '@react-three/fiber';
import {Matrix4,Vector3} from 'three';
import {getMmdVrControllerColliderMatrices as grips} from '../../src/mmdVrShowcase/xr/contact/controllerSlots';
import {getMmdVrHandColliderMatrices as joints} from '../../src/mmdVrShowcase/xr/contact/handSlots';

const v=a=>new Vector3(...a),xyz=m=>new Vector3().setFromMatrixPosition(m),near=(a,b)=>{
  if(a.distanceTo(b)>.001)throw Error(`Expected ${b.toArray()}, got ${a.toArray()}`);
};
function rigid(p){const [x,y,z]=p;return {transform:{position:{x,y,z},orientation:{x:0,y:0,z:0,w:1},matrix:new Matrix4().makeTranslation(x,y,z).elements}};}
function eyes(){
  const gl=[..._roots.values()].map(r=>r.store.getState().gl).find(gl=>gl.xr.isPresenting);
  const [l,r]=gl.xr.getCamera().cameras.map(c=>xyz(c.matrixWorld));
  near(v([l.distanceTo(r),0,0]),v([.064,0,0]));
  return {mid:l.clone().lerp(r,.5),xAxis:r.sub(l).normalize()};
}
export function entry(){const {mid,xAxis}=eyes();near(mid,v([0,1.45,0]));near(xAxis,v([1,0,0]));return mid.toArray();}

// At 72 Hz, 24 full forward samples on the default floor cover 0.8 m. Turn
// about a real 14 cm tracked head offset, without swinging the displayed eyes.
export async function walk(){
  entry();const cfg=window.labFixture,x=.14,z=-.8,yaw=-Math.PI/6,c=Math.cos(yaw),s=Math.sin(yaw);
  const [left,right]=labSession.inputSources.map(src=>src.gamepad.axes);
  cfg.headX=x;let i=0,clock=performance.now(),timer;
  try{await new Promise((resolve,reject)=>{
    timer=setTimeout(()=>reject(Error('No submitted walking frame')),10000);
    cfg.take={inputs(){this.time=clock+=1000/72;left[3]=i>=2&&i<26?-1:0;right[2]=i>=28&&i<32?1:0;},afterDraw(){
      try{const {mid,xAxis}=eyes();near(mid,v([x,1.45,-Math.max(0,Math.min(24,i-1))/30]));
        near(xAxis,i<28?v([1,0,0]):v([c,0,-s]));if(++i===34)resolve();}catch(e){reject(e);}
    }};
  });}finally{cfg.take=null;clearTimeout(timer);left[3]=right[2]=0;}
  // Invert the *expected* rigid transform for instrument poses. Feeding the
  // implementation's own matrix back to its inputs would mask a bad origin.
  const world=new Matrix4().makeRotationY(yaw).setPosition(x-c*x,0,z+s*x),ref=world.clone().invert();
  const local=p=>v(p).applyMatrix4(ref).toArray();
  cfg.movement={local,
    joint(j,p){if(!p)return null;const [x,y,z]=p;
      return rigid([x+(j.name.startsWith('index')?-.025:j.name.startsWith('pinky')?.025:0),y,z+(j.name==='wrist'?.038:-.038)]);
    },
    view(tracks){
      const [a,b]=tracks.map(t=>v(local(t.spot))),eye=a.clone().lerp(b,.5);eye.y-=.025;eye.z=Math.max(a.z,b.z)+.66;
      const areas=[-.032,.032].map(dx=>[a,b].map(p=>{const d=eye.z-p.z;return [120+(p.x-eye.x-dx)*1.1/d*116,120-(p.y-eye.y)*1.1/d*115,Math.min(30,.095*1.1/d*116)];}));
      return {eyeX:eye.x,eyeY:eye.y,eyeZ:eye.z,areas};
    },
    verifyView(eye){const {mid,xAxis}=eyes();near(mid,v(eye).applyMatrix4(world));near(xAxis,v([c,0,-s]));},
    verifySlots(points){
      // Wrist -Z offset places the actual Bullet palm box on the same world
      // point as the GPU wrist/knuckles centroid. Right is a real gripSpace.
      for(const [i,m] of [joints()[0],grips()[1]].entries()){
        near(xyz(m),v(points[i]??[0,-1000,0]));
        if(points[i])near(new Vector3().setFromMatrixColumn(m,0),v([c,0,-s]));
      }
    },
    armRecovery(){
      const hand=[-.22,1.03,-.35],grip=[.25,1.09,-.42],right=labSession.inputSources.find(s=>s.handedness==='right');
      cfg.take={inputs(f){this.time=performance.now();f.getPose=space=>space===right.gripSpace?rigid(grip):null;
        f.getJointPose=j=>cfg.movement.joint(j,hand);},afterDraw(){}};
      this.recoverySlots=()=>this.verifySlots([hand,grip].map(p=>v(p).applyMatrix4(world).toArray()));
    },
    recovery(){this.recoverySlots();const {mid,xAxis}=eyes();near(mid,v([x,1.45,z]));near(xAxis,v([c,0,-s]));return mid.toArray();},
  };
  const {mid,xAxis}=eyes();return {walkMetres:-mid.z,verifiedFrames:i,eye:mid.toArray(),turnDegrees:Math.atan2(-xAxis.z,xAxis.x)*180/Math.PI};
}
export function parked(){return [...grips(),...joints()].every(m=>xyz(m).equals(v([0,-1000,0])));}
