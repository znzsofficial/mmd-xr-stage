// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {BoxGeometry,Group,Mesh,MeshBasicMaterial,Scene,Vector3} from 'three';
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
