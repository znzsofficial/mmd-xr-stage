import { expect, it } from 'vitest';
import { Bone, BoxGeometry, Group, Matrix4, Mesh, Quaternion, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { disposeMmdModel, ThreeMmdLoader } from '@yohawing/three-mmd-loader';
import { poseFixture } from '../pose/poseFixture.testSupport';
import { centerZ, siliconeMount, siliconeOutlet, siliconeTilt, tipHeight } from '../play/siliconeProfile';
import { createPelvicSolver, defaultPelvicCalibration as defaults, pelvicCenterline, pelvicRailLimit, pelvicRailMatrix, pelvicSeal,
  pelvicSection, registerPelvicSocket, samplePelvicFrame, type PelvicFrame } from './geometry';

const dt = 1/72, one = new Vector3(1,1,1);
const close = (a:Vector3,b:Vector3) => expect(a.distanceTo(b)).toBeLessThan(2e-7);
const at = (m:Matrix4) => new Vector3().setFromMatrixPosition(m);
const frame = ():PelvicFrame => ({ world:new Matrix4(), inverse:new Matrix4(), scale:1, radiusM:.024,lengthM:.092 });
const shifted = (m:Matrix4, x:number,y:number,z:number) => m.clone().premultiply(new Matrix4().makeTranslation(x,y,z));
const outlet = (m: Matrix4) => new Vector3(...siliconeOutlet.position).applyMatrix4(m);

it.each([.1,1.5])('registers an already posed PMX at actual root scale %f; bind landmark follows the crouch and turn',async scale => {
  const model = await new ThreeMmdLoader().loadModel(poseFixture().pmx,{outline:false,materialRenderOrder:false});
  try {
    model.root.scale.setScalar(scale); model.root.position.set(-.8,.43,1.98); model.root.rotation.y=.91;
    const c = {...defaults,offsetM:[.013,-.006,.021] as const,pitchDeg:17,yawDeg:-15};
    const socket=registerPelvicSocket(model.root,c)!; expect(socket.kind).toBe('bones');
    const f = samplePelvicFrame(socket,c)!, anchor = socket.anchor;
    expect(f.scale).toBeCloseTo(1.2*scale,6); expect(f.radiusM).toBeCloseTo(.024*1.2*scale,6);
    expect(f.world.determinant()).toBeCloseTo(1);
    const localEntry=anchor.worldToLocal(at(f.world)), localEnd=anchor.worldToLocal(pelvicCenterline(f,f.lengthM).applyMatrix4(f.world));
    anchor.position.y-=.26;anchor.rotation.set(-.63,.28,.13);
    for(const side of ['Left','Right']){
      model.mesh.skeleton.getBoneByName(side+'Thigh')!.rotation.x=-.77;
      model.mesh.skeleton.getBoneByName(side+'Knee')!.rotation.x=1.12;
    }
    model.root.rotation.y+=1.84; model.root.position.x+=.6;
    const later=samplePelvicFrame(registerPelvicSocket(model.root,c),c,f)!;
    close(at(later.world),anchor.localToWorld(localEntry)); close(pelvicCenterline(f,f.lengthM).applyMatrix4(f.world),anchor.localToWorld(localEnd));
    const d=.4*f.lengthM, rail=pelvicRailMatrix(f,d);
    close(outlet(rail),pelvicCenterline(f,d).applyMatrix4(f.world)); expect(rail.determinant()).toBeCloseTo(1,9);
    expect(pelvicRailLimit(f)).toBeLessThanOrEqual(f.lengthM);
  } finally {disposeMmdModel(model);}
});

it('requires explicit manual registration for missing thighs and honors author units and arbitrary rolled bind axes',()=>{
  const root=new Group(), mesh=new SkinnedMesh(new BoxGeometry(100,100,100).translate(500,500,500)), hip=new Bone();
  hip.name='mixamorig:Hips';hip.position.set(2,9,1);hip.rotation.set(.35,.51,-.7);root.add(mesh);mesh.add(hip);
  root.updateMatrixWorld(true);mesh.bind(new Skeleton([hip]));
  root.scale.setScalar(.1);root.rotation.y=Math.PI*.5;root.position.set(4,-1,3);
  expect(registerPelvicSocket(root,defaults)).toBeNull();
  const c={...defaults,manual:{origin:[2,8,1.83] as const,unitsPerMeter:10},pitchDeg:0};
  const s=registerPelvicSocket(root,c)!;expect(s.kind).toBe('manual');expect(s.anchor).toBe(hip);
  const f=samplePelvicFrame(s,c)!;close(at(f.world),root.localToWorld(new Vector3(...c.manual.origin)));
  expect(f.scale).toBeCloseTo(1);close(new Vector3(0,0,-1).transformDirection(f.world),new Vector3(-1,0,0));
  const local=hip.worldToLocal(at(f.world));hip.rotation.z+=1;hip.position.y-=2;
  close(at(samplePelvicFrame(s,c)!.world),hip.localToWorld(local));
  const plain=new Group();plain.add(new Mesh(new BoxGeometry(10,30,1)));expect(registerPelvicSocket(plain,defaults)).toBeNull();
  expect(registerPelvicSocket(plain,c)!.anchor).toBe(plain);
  root.visible=false;expect(samplePelvicFrame(s,c)).toBeNull();
});

it('places the mounted, tilted physical mesh bore on the same bent arc and stop as its section (no scale inherited by the tool)',()=>{
  const parent=new Group(), piece=new Mesh();piece.rotation.x=siliconeTilt;piece.position.fromArray(siliconeMount);parent.add(piece);
  const f=frame();f.world.makeRotationZ(-.6).multiply(new Matrix4().makeRotationY(1.3)).setPosition(.53,1.08,-1.2);f.inverse.copy(f.world).invert();
  const s=createPelvicSolver(), section=pelvicSection(f);
  let last=-1;
  for(const requested of [-.025,-.001,.009,.03,.055,.078,.092,.13]) {
    const pose=pelvicRailMatrix(f,requested);pose.decompose(parent.position,parent.quaternion,parent.scale);
    parent.updateMatrixWorld(true);const d=Math.min(requested,f.lengthM);
    const bore=piece.localToWorld(new Vector3(0,tipHeight,centerZ(tipHeight)));
    close(bore,pelvicCenterline(f,d).applyMatrix4(f.world));close(parent.scale,one);
    const a=s.step(f,parent.matrixWorld,{dt});close(a.outletLocal,bore.applyMatrix4(f.inverse));close(a.shaftLocal.at(-1)!,a.outletLocal);
    close(a.shaftLocal[0],piece.localToWorld(new Vector3(0,-.0456,centerZ(-.0456))).applyMatrix4(f.inverse));
    expect(a.outletInside).toBe(d>0);expect(a.depthM).toBeCloseTo(Math.max(0,d),7);expect(a.depthM).toBeGreaterThanOrEqual(last);last=a.depthM;
    expect(a.atCervix).toBe(d>=f.lengthM);
  }
  close(section.stop,pelvicCenterline(f,f.lengthM));expect(section.stop.y).toBeGreaterThan(.01);
  for(let i=0;i<25;i++) close(section.canal[i].clone().lerp(section.canal[49-i],.5),pelvicCenterline(f,i*f.lengthM/24));
  close(section.cervix[0],section.stop);
});

it.each([-1,1])('rejects side-entry from side %d even with an inward-facing outlet and a swept rim intersection',sign=>{
  const f=frame(), s=createPelvicSolver();
  const step=(x:number,d:number)=>s.step(f,shifted(pelvicRailMatrix(f,d),x,0,0),{dt});
  step(sign*.045,-.009);step(sign*.02,-.0006);
  expect(step(0,.0006).inside).toBe(false);expect(step(0,.012).inside).toBe(false);
  s.reset();step(sign*.04,-.009);expect(step(sign*.04,.009)).toMatchObject({inside:false,outletVisible:false});expect(step(0,.011).inside).toBe(false);
});

it('separates physical outlet from contact hysteresis, rejects back-facing bores, obstruction, loss and reappearance inside',()=>{
  const f=frame(),s=createPelvicSolver();
  const step=(d:number,blocked=false)=>s.step(f,pelvicRailMatrix(f,d),{dt,blocked});
  const reverse=(d:number)=>{const m=pelvicRailMatrix(f,d), q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI);
    const ray=m.clone().premultiply(new Matrix4().makeRotationFromQuaternion(q)), offset=outlet(m).sub(outlet(ray));
    return s.step(f,shifted(ray,offset.x,offset.y,offset.z),{dt});};
  reverse(-.012);expect(reverse(.01).inside).toBe(false);
  s.reset();expect(step(.009)).toMatchObject({inside:false,outletVisible:false});expect(step(.018).inside).toBe(false);
  step(-.014);expect(step(.002).outletInside).toBe(true);expect(step(-.0007)).toMatchObject({inside:true,outletInside:false,outletVisible:true,depthM:0});
  expect(step(.0009).outletInside).toBe(true);expect(step(-.007).inside).toBe(false);
  step(.013,true);expect(step(.013).inside).toBe(false);step(-.009);expect(step(.013).inside).toBe(true);
  expect(s.step(f,null,{dt}).shaftLocal).toHaveLength(0);expect(step(.012).inside).toBe(false);
  step(-.018);expect(s.step(f,pelvicRailMatrix(f,.015),{dt:.28}).inside).toBe(false);
  step(-.014);expect(step(.064).inside).toBe(false);
  step(-.013);const newWorld=new Matrix4().makeTranslation(2,0,0);f.world.copy(newWorld);f.inverse.copy(newWorld).invert();
  expect(step(.012).inside).toBe(false); // both pieces teleported together
});

it('keeps the real hand pose beyond the stop, caps depth and never counts an outlet behind the cervix',()=>{
  const f=frame(), s=createPelvicSolver();for(const d of [-.012,.01,.03,.06,.088])s.step(f,pelvicRailMatrix(f,d),{dt});
  const m=pelvicRailMatrix(f,f.lengthM), localDir=new Vector3(...siliconeOutlet.direction).transformDirection(m);
  const jump=localDir.multiplyScalar(.008), past=shifted(m,jump.x,jump.y,jump.z), copy=past.clone();
  const a=s.step(f,past,{dt});expect(a).toMatchObject({inside:true,outletInside:false,outletVisible:false,depthM:f.lengthM,atCervix:true});
  close(a.outletLocal,outlet(past));expect(copy.equals(past)).toBe(true);
});

it('keeps a narrow normal opening at rest, follows the measured shaft cut and restores the same aperture on exit',()=>{
  const f=frame(),s=createPelvicSolver(), x=.003;
  const step=(d:number)=>s.step(f,shifted(pelvicRailMatrix(f,d),x,0,0),{dt});
  const outside=step(-.008);expect(pelvicSeal(f,outside,false)).toBeNull();
  const ring=pelvicSeal(f,outside,true)!,rest=ring.lip.map(v=>v.clone());expect(ring.lip[0].x).toBeGreaterThan(0);
  expect(Math.max(...ring.lip.map(v=>Math.abs(v.x)))).toBeLessThan(.1*f.radiusM);expect(ring.openness).toBe(0);
  step(.009);const actual=step(.035);pelvicSeal(f,actual,true,ring);
  const center=ring.lip.reduce((sum,p)=>sum.add(p),new Vector3()).divideScalar(ring.lip.length);
  const i=actual.shaftLocal.findIndex(p=>p.z<=0), a=actual.shaftLocal[i-1],b=actual.shaftLocal[i];
  close(center,a.clone().lerp(b,a.z/(a.z-b.z)));expect(ring.openness).toBeGreaterThan(.55);
  expect(ring.lip.every(v=>v.z===0)).toBe(true);step(.006);pelvicSeal(f,step(-.01),true,ring);expect(ring.openness).toBe(0);
  expect(ring.lip).toEqual(rest);
});
