import {expect,it} from 'vitest';
import {ArrayCamera,BoxGeometry,Group,InstancedMesh,Matrix4,MeshBasicMaterial,PerspectiveCamera,Scene,type Camera,type WebGLRenderer} from 'three';
import {cameraInstancePrefix} from '../../cameraInstancePrefix';
import {parkTrees} from '../parkLayout';
import {SHORE_SUN} from '../shoreLayout';
import {growTree,habitCount} from './treeHabit';
import {sprayGeometry,treeBatches} from './treeSurfaces';

it('omits whole off-screen crowns from the same four atlas draws on the park route',()=>{
  const habits=Array.from({length:habitCount},(_,i)=>growTree(i,SHORE_SUN));
  const {sprays,crownEnds}=treeBatches(parkTrees,habits);
  const scene=new Scene(),material=new MeshBasicMaterial(),group=new Group();
  const eyes=[new PerspectiveCamera(84,1,.05,52),new PerspectiveCamera(84,1,.05,52)],rig=new ArrayCamera(eyes);
  const renderer={xr:{isPresenting:true,getCamera:()=>rig}} as unknown as WebGLRenderer;
  const meshes=sprays.map((instances,i)=>{
    const mesh=new InstancedMesh(sprayGeometry(i),material,instances.length);
    instances.forEach(({matrix},k)=>mesh.setMatrixAt(k,matrix));
    cameraInstancePrefix(mesh,crownEnds[i],.45);return mesh;
  });
  const total=sprays.reduce((n,items)=>n+items.length,0);
  expect(total).toBe(2880);
  for(const [eye,aim,maxCrowns] of [
    [[-.9,1.6,17],[4,1,24],4],
    [[4.8,1.65,29.4],[9.5,.3,30.4],3],
    [[16.65,1.57,32.6],[10.2,2.1,37.55],2],
  ] as const){
    for(const [i,camera] of eyes.entries()){
      camera.position.fromArray(eye);camera.lookAt(aim[0],aim[1],aim[2]);camera.translateX(i?.032:-.032);camera.updateMatrixWorld();
    }
    let submitted=0;
    for(const mesh of meshes){
      function count(camera:Camera){
        mesh.onBeforeRender(renderer,scene,camera,mesh.geometry,material,group);
        const n=mesh.count;mesh.onAfterRender(renderer,scene,camera,mesh.geometry,material,group);
        expect(mesh.count).toBe(mesh.instanceMatrix.count);return n;
      }
      const n=count(rig);expect(count(eyes[0])).toBe(n);expect(count(eyes[1])).toBe(n);submitted+=n;
    }
    expect(submitted).toBeGreaterThan(0);expect(submitted).toBeLessThanOrEqual(maxCrowns*480);
  }
  for(const mesh of meshes){mesh.geometry.dispose();mesh.dispose();}material.dispose();
});

it('keeps a crown seen by the right eye and retains its fringe across a full shadow draw',()=>{
  const material=new MeshBasicMaterial(),mesh=new InstancedMesh(new BoxGeometry(.01,.01,.01),material,2);
  mesh.setMatrixAt(0,new Matrix4().makeTranslation(0,0,-1));mesh.setMatrixAt(1,new Matrix4().makeTranslation(1.02,0,-1));
  const views=[new PerspectiveCamera(90,1,.1,8),new PerspectiveCamera(90,1,.1,8)],rig=new ArrayCamera(views);
  const renderer={xr:{isPresenting:true,getCamera:()=>rig}} as unknown as WebGLRenderer,scene=new Scene(),group=new Group();
  cameraInstancePrefix(mesh,[1,2],.45);
  function count(x:number,camera:Camera){
    for(const [i,view] of views.entries()){view.position.x=x+(i?.032:-.032);view.updateMatrixWorld();}
    mesh.onBeforeRender(renderer,scene,camera,mesh.geometry,material,group);const n=mesh.count;
    mesh.onAfterRender(renderer,scene,camera,mesh.geometry,material,group);return n;
  }
  expect(count(0,views[0])).toBe(2);expect(count(-.25,rig)).toBe(2);
  expect(count(-1,rig)).toBe(1);
  const args=[renderer,scene,rig,mesh.geometry,material,group] as const;
  mesh.onBeforeRender(...args);expect(mesh.count).toBe(1);
  scene.overrideMaterial=material;expect(count(-.25,views[1])).toBe(2);scene.overrideMaterial=null;
  expect(mesh.count).toBe(1);mesh.onAfterRender(...args);expect(mesh.count).toBe(2);
  expect(count(-.25,views[0])).toBe(1);expect(count(0,rig)).toBe(2);
  mesh.geometry.dispose();material.dispose();mesh.dispose();
});
