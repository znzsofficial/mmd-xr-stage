import {ArrayCamera,BufferGeometry,Euler,Group,Matrix4,MeshBasicMaterial,PerspectiveCamera,Quaternion,Scene,Vector3,type WebGLRenderer} from 'three';
import {expect,it,vi} from 'vitest';
import {observeStance,samplePlayerStance,stanceProbe} from './stanceDiagnostics';

it('compares the matrices of the drawn eyes to their tracking, not to the intended origin; ignores a retired XR frame',()=>{
  const probe=stanceProbe(),stop=observeStance(probe),up=new Vector3(0,1,0),slope=new Quaternion().setFromEuler(new Euler(.5,0,-.12)),head=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.2);
  probe.foot.set(2,3,4);probe.up.copy(up).applyQuaternion(slope);probe.navUp.copy(probe.up);probe.grounded=true;
  const pose={transform:{position:{y:1.6}},views:[{transform:{orientation:head}},{transform:{orientation:head}}]} as unknown as XRViewerPose;
  const frame=probe.frame={} as XRFrame;let now=frame;
  const cameras=[new PerspectiveCamera(),new PerspectiveCamera()],stereo=new ArrayCamera(cameras),gl={xr:{getCamera:()=>stereo,getFrame:()=>now}} as unknown as WebGLRenderer;
  const scene=new Scene(),prior=scene.onAfterRender=vi.fn(),g=new BufferGeometry(),m=new MeshBasicMaterial();
  const group=new Group(),draw=(renderer=gl,camera:PerspectiveCamera=stereo)=>scene.onAfterRender(renderer,scene,camera,g,m,group);
  const sample=(trackedFrame=frame)=>samplePlayerStance(trackedFrame,pose,gl,scene);
  try{const s=sample()!;expect(s).toMatchObject({trackedEyeM:1.6,navTiltDeg:0,drawn:null});
    const bank=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-.3),shown=slope.clone().multiply(bank).multiply(head);
    for(const [i,c] of cameras.entries())c.matrixWorld.makeRotationFromQuaternion(shown).setPosition(probe.foot.clone().addScaledVector(probe.up,1.25).add(new Vector3(i?.032:-.032,0,0)));
    draw({} as WebGLRenderer);draw(gl,cameras[0]);expect(s.drawn).toBeNull();draw();expect(prior).toHaveBeenCalledTimes(3);
    expect(s.drawn).toMatchObject({eyes:2,eyeAboveFootM:1.25,rigTiltDeg:17.19,trackedRollDeg:11.46,viewRollDeg:-5.73});
    // A distant tracking footprint may have a different local radial from
    // the motor sole. Compare the lens horizon at the eye, not the nav foot.
    probe.centre=probe.foot.clone().sub(probe.up.clone().multiplyScalar(12));
    const lateral=new Matrix4().makeTranslation(new Vector3(.95,0,0).applyQuaternion(slope));for(const c of cameras)c.matrixWorld.premultiply(lateral);
    const shifted=sample()!;draw();expect(shifted.navTiltDeg).toBe(0);expect(Math.abs(shifted.drawn!.rigTiltDeg-s.drawn!.rigTiltDeg)).toBeGreaterThan(3.5);
    const missed=sample()!;now={} as XRFrame;draw();expect(missed.drawn).toBeNull();expect(sample(now)).toBeUndefined();
    now=frame;sample();expect(scene.onAfterRender).not.toBe(prior);
  }finally{stop();g.dispose();m.dispose();}expect(scene.onAfterRender).toBe(prior);expect(sample()).toBeUndefined();
});
