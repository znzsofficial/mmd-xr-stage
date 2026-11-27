// @vitest-environment jsdom
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Plane, Ray, Raycaster, Scene, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { expect, it, vi } from 'vitest';
import { bindStockingPointer } from './stockingPointer';
import { stockingPull, type StockingHit } from './stockingPull';
import { stockingWorldBlocks } from './stockingSight';

it('grabs the wrap seam once; lateral and upward pulls past the silhouette retain start, side and signed local direction', () => {
  const origin = new Vector3(0,0,2), plane = new Plane(new Vector3(0,0,1),0);
  const aim = (x:number,y:number) => new Ray(origin, new Vector3(x,y,0).sub(origin).normalize());
  const pick = vi.fn((ray:Ray):StockingHit|null => {
    const p = ray.intersectPlane(plane,new Vector3())!;
    return Math.abs(p.x) < .025 ? { side:'left', u:(.999+p.x+1)%1, v:.42+p.y, point:p, distance:p.distanceTo(origin) } : null;
  });
  const start=aim(0,0), pull=stockingPull(start,pick(start)!,1.6,pick), count=pick.mock.calls.length;
  expect(pull(aim(.001,.002))).toBeNull(); expect(pull(start)).toBeNull();
  expect(pull(aim(.09,.06))).toMatchObject({side:'left',u:expect.closeTo(.999),v:.42,du:expect.closeTo(.09),dv:expect.closeTo(.06)});
  expect(pull(aim(-.094,0))!.du).toBeCloseTo(-.094);
  expect(pick.mock.calls).toHaveLength(count); // reposing the actor under a stationary press is not input
});

it('rejects a nearer room wall, placed instance or held prop with noPick; ignores projected sky, UI and hidden draws', () => {
  const scene=new Scene(), ray=new Raycaster(new Vector3(0,0,3),new Vector3(0,0,-1),0,3), blocked=()=>stockingWorldBlocks(scene,ray);
  const shape=new BoxGeometry(1,1,.2), mat=new MeshBasicMaterial(), actor=new Group(), wall=new Mesh(shape,mat), room=new Group();
  const prop=new InstancedMesh(shape,mat,1);prop.setMatrixAt(0,new Matrix4().makeTranslation(0,0,1)); prop.userData.stagePropSolid=true;
  actor.userData.mmdModelId='chosen';actor.add(new Mesh(shape,mat)); room.name='player:room-solids';wall.raycast=()=>{};room.add(wall);scene.add(room,actor,prop);
  scene.updateMatrixWorld(true);expect(blocked()).toBe(true);
  prop.visible=false;expect(blocked()).toBe(true);room.visible=false;expect(blocked()).toBe(false);
  const held=new Group();held.name='play:piece:wand';held.add(new Mesh(shape,mat));scene.add(held);expect(blocked()).toBe(true);
  mat.visible=false;expect(blocked()).toBe(false);mat.visible=true;held.visible=false;
  const projected=mat.clone();projected.depthWrite=false;const sky=new Mesh(shape,projected);
  sky.renderOrder=-90;sky.frustumCulled=false;room.add(sky);room.visible=true;wall.visible=false;scene.add(new Mesh(shape,mat));
  expect(blocked()).toBe(false);sky.renderOrder=0;expect(blocked()).toBe(true);
  mat.dispose();projected.dispose();shape.dispose();prop.dispose();
});

it('swallows the owning drag, wheel, synthetic click and second touch before OrbitControls and actor picking; releases once', () => {
  const canvas=document.createElement('canvas'), wrapper=document.createElement('div');wrapper.append(canvas);document.body.append(wrapper);
  Object.defineProperty(canvas,'clientWidth',{value:400});Object.defineProperty(canvas,'clientHeight',{value:400});
  canvas.getBoundingClientRect=()=>new DOMRect(0,0,400,400);canvas.setPointerCapture=vi.fn();canvas.releasePointerCapture=vi.fn();
  const camera=new PerspectiveCamera(50,1,.02,100);camera.position.z=2;camera.updateMatrixWorld();const orbit=new OrbitControls(camera,canvas);
  const eye=camera.position.clone(), click=vi.fn(), pulls: number[]=[];wrapper.addEventListener('click',click);
  let owner:number|null=null;
  const off=bindStockingPointer(canvas,camera,{enabled:()=>true,
    begin:(_,e)=>{owner??=e.pointerId;}, release:(_,e)=>{if(owner===e.pointerId){pulls.push(owner);owner=null;}}, cancel:id=>{if(id===owner)owner=null;}});
  const pointer=(event:string,id:number,x:number,buttons:number)=>canvas.dispatchEvent(new PointerEvent(event,{pointerId:id,pointerType:'touch',isPrimary:id===1,button:0,buttons,clientX:x,clientY:200,bubbles:true,cancelable:true}));
  try {
    pointer('pointerdown',1,160,1);pointer('pointerdown',2,200,1);pointer('pointerup',2,300,0);pointer('lostpointercapture',2,300,0);
    pointer('pointermove',1,240,1);canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-80,bubbles:true,cancelable:true}));
    pointer('pointerup',1,240,0);canvas.click();pointer('pointerup',1,240,0);
    expect(pulls).toEqual([1]);expect(camera.position.equals(eye)).toBe(true);expect(click).not.toHaveBeenCalled();
    pointer('pointerdown',1,220,1);pointer('pointercancel',1,240,0);pointer('pointerup',1,240,0);expect(pulls).toEqual([1]);
  } finally {off();orbit.dispose();wrapper.remove();}
});
