// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {BoxGeometry,Euler,Group,Mesh,MeshBasicMaterial,Quaternion,Scene,Vector3} from 'three';
import {expect,it,vi} from 'vitest';
import {useMmdVrStore} from '../mmdVrStore';
import {usePlayerMovement} from './usePlayerMovement';

const h=vi.hoisted(()=>({frame:null as Function|null}));
vi.mock('@react-three/fiber',()=>({useFrame:(cb:Function)=>{h.frame=cb;}}));
vi.mock('@react-three/xr',()=>({useXRInputSourceState:()=>undefined}));

it('follows a real lean through a wall, but advances the stick only from a reachable foot',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const old=useMmdVrStore.getState();useMmdVrStore.setState({prefs:{...old.prefs,scenery:'floor',movementMode:'normal',normalEyeOffset:0,walkSpeedPref:'normal'}});
  const root=createRoot(document.createElement('div')),origin=new Group(),scene=new Scene();
  const wall=new Mesh(new BoxGeometry(.04,3,4),new MeshBasicMaterial());wall.name='player:room-solids';wall.position.set(.55,1.5,0);scene.add(wall);
  const p=new Vector3(.1,1.6,-.2),pose={transform:{position:p,orientation:{x:0,y:0,z:0,w:1}}};
  const axes=[0,0,0,0],source={handedness:'left',targetRayMode:'tracked-pointer',gamepad:{mapping:'xr-standard',axes,buttons:[]}};
  const tick=(n=1)=>{for(let i=0;i<n;i++)h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},1/90,{session:{inputSources:[source]},getViewerPose:()=>pose});};
  const eye=()=>p.clone().applyMatrix4(origin.matrixWorld);
  function Motor(){usePlayerMovement({current:origin},false);return null;}
  try{
    await act(async()=>root.render(<Motor/>));tick();const initial=origin.position.clone();
    for(const x of [.55,.85]){ // Inside the wall, then on its far side
      p.x=.1+x;tick();expect(eye().x).toBeCloseTo(x);expect(origin.position.distanceTo(initial)).toBeLessThan(1e-8);
    }
    axes[2]=1;tick(20);expect(origin.position.distanceTo(initial)).toBeLessThan(1e-8);
    p.x=.1;tick(90); // Back on the entry side: the same stick now walks up to the wall.
    expect(eye().x).toBeGreaterThan(.32);expect(eye().x).toBeLessThan(.38);
  }finally{await act(async()=>root.unmount());useMmdVrStore.setState(old);wall.geometry.dispose();wall.material.dispose();vi.unstubAllGlobals();}
});

it('seats 0 cm at the actual floor and raised support after free flight without subtracting or inventing tracked height',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState();
  const prefs=(movementMode:'normal'|'free')=>useMmdVrStore.setState({prefs:{...old.prefs,scenery:'floor',movementMode,normalEyeOffset:0,walkSpeedPref:'normal'}});
  prefs('free');const scene=new Scene(),origin=new Group(),root=createRoot(document.createElement('div'));
  const head=new Group();origin.add(head);head.position.set(1.4,1.63,-.8);head.rotation.set(.27,.6,-.18,'YXZ');
  const tracked=head.quaternion.clone(),axes=[0,0,0,0],source={handedness:'right',targetRayMode:'tracked-pointer',gamepad:{mapping:'xr-standard',axes,buttons:[]}};
  const tick=(n=1)=>{for(let i=0;i<n;i++)h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},1/90,{session:{inputSources:[source]},getViewerPose:()=>({transform:{position:head.position,orientation:head.quaternion}})});};
  const eye=()=>head.getWorldPosition(new Vector3());function Motor(){usePlayerMovement({current:origin},false);return null;}
  const landing=new Mesh(new BoxGeometry(1,.18,1),new MeshBasicMaterial());landing.name='player:room-solids';landing.position.set(0,.09,-1.8);
  try{
    await act(async()=>root.render(<Motor/>));tick();axes[3]=1;tick(70);expect(eye().y).toBeLessThan(0);
    axes[3]=0;head.position.x+=.45;prefs('normal');tick();expect(eye().toArray()).toEqual([0,1.63,0]);
    expect(head.getWorldQuaternion(new Quaternion()).angleTo(tracked)).toBeLessThan(1e-6);
    scene.add(landing);head.position.z-=1.8;tick();expect(eye().y).toBeCloseTo(1.81,7);
    prefs('free');axes[3]=-1;tick(70);expect(eye().y).toBeGreaterThan(3.5);
    head.position.set(.3,.79,.5);axes[3]=0;prefs('normal');tick();expect(eye().y).toBeCloseTo(.18+.79,7);expect(eye().z).toBeCloseTo(-1.8);
    head.position.y=1.71;tick();expect(eye().y).toBeCloseTo(.18+1.71,7);expect(useMmdVrStore.getState().prefs.normalEyeOffset).toBe(0);
  }finally{await act(async()=>root.unmount());useMmdVrStore.setState(old);landing.geometry.dispose();landing.material.dispose();vi.unstubAllGlobals();}
});

it('a physical head rise under a low beam is still 1:1 after a permitted positive adjustment',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const old=useMmdVrStore.getState();
  useMmdVrStore.setState({prefs:{...old.prefs,scenery:'floor',movementMode:'normal',normalEyeOffset:.2}});
  const scene=new Scene(),origin=new Group(),root=createRoot(document.createElement('div')),head=new Vector3(0,1.5,0);
  const beam=new Mesh(new BoxGeometry(1,.06,1),new MeshBasicMaterial());beam.position.y=1.83;beam.name='player:room-solids';scene.add(beam);
  const tick=()=>h.frame!({gl:{xr:{getReferenceSpace:()=>({})}},scene},1/90,{session:{inputSources:[]},getViewerPose:()=>({transform:{position:head,orientation:new Quaternion().setFromEuler(new Euler(0,.4,.16))}})});
  function Motor(){usePlayerMovement({current:origin},false);return null;}
  try{await act(async()=>root.render(<Motor/>));tick();const start=head.clone().applyMatrix4(origin.matrixWorld);expect(start.y).toBeCloseTo(1.70);
    head.y+=.08;tick();expect(head.clone().applyMatrix4(origin.matrixWorld).y-start.y).toBeCloseTo(.08,7);
  }finally{await act(async()=>root.unmount());useMmdVrStore.setState(old);beam.geometry.dispose();beam.material.dispose();vi.unstubAllGlobals();}
});
