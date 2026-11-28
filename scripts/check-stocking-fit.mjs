// CPU-only check of the real stage fit, posed ray and material cutout.
// node scripts/check-stocking-fit.mjs <local.pmx> [--unsupported | --cover=<footwear material>]
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Ray, Scene, Triangle, Vector3} from 'three';
import {loadNodeBulletStage} from './node-bullet-stage.mjs';

const path=process.argv[2]; if (!path) throw Error('Pass a local PMX path.');
const {createMmdRuntimeHandle,close}=await loadNodeBulletStage();
const app=s=>import(`../src/mmdVrShowcase/${s}.ts`);
const {mountStockingRoom,stockingFitStatus,pickStockingSurface}=await app('wardrobe/stockingSurface');
const {fitStockings}=await app('wardrobe/stockingFit'), {stockingDraws}=await app('wardrobe/stockingDraws');
const {armStockingTear,dressStockings,recordStockingTear,useStockings}=await app('wardrobe/stockingState');
const {useBackpack}=await app('backpack/store'),{useMmdVrStore}=await app('mmdVrStore');
const scene=new Scene(), rt=createMmdRuntimeHandle(scene), camera=new PerspectiveCamera();
const file=new File([readFileSync(path)],'actor.pmx');
let room;
try {
  const {modelId:runtimeId}=await rt.addModel(file,[],{physics:false}), actor={assetId:'actor',runtimeId};
  const model=rt.getModelSurface(runtimeId), tick=()=>{ rt.update(0,false,camera,1,false); room.advance(true); };
  const scale=(await app('stage/loading/firstCharacterScale')).firstCharacterScale(model.root)??1;
  rt.setModelTransform(runtimeId,{scale,rotationY:34,positionX:.7,positionZ:-1.9});
  useMmdVrStore.setState({overlayOpen:true,physicsEnabled:false,physicsBusy:false,physicsFatal:false,presentation:'screen'});
  useBackpack.setState({entries:[{id:'actor',kind:'model',file,path:'actor.pmx'}],selected:'actor',live:{actor:{runtimeId,visible:true,position:[.7,0,-1.9]}}});
  room=mountStockingRoom(scene,rt,()=>false,()=>true);
  assert(dressStockings(actor,'wear')); tick();
  if (process.argv.includes('--unsupported')) {
    assert.equal(stockingFitStatus(runtimeId),'unavailable'); assert(!scene.getObjectByName(`wardrobe:stockings:${runtimeId}`));
    console.log('Unsupported PMX: no fabricated leg geometry.');
  } else {
    assert.equal(stockingFitStatus(runtimeId),'ready');
    const group=scene.getObjectByName(`wardrobe:stockings:${runtimeId}`);
    const parts=group.children.filter(m=>m.name==='wardrobe:stocking:left'&&m.visible);
    const tri=new Triangle(),mid=new Vector3(),axis=new Vector3();
    let hit, site;
    function rayFor(mesh,face) {
      const g=mesh.geometry, index=g.index, p=g.attributes.position;
      for(const [k,v] of [tri.a,tri.b,tri.c].entries())v.fromBufferAttribute(p,index.getX(face+k));
      tri.getMidpoint(mid);tri.getNormal(axis);
      return new Ray(mid.clone().addScaledVector(axis,.4),axis.clone().negate());
    }
    for(const mesh of parts){
      const g=mesh.geometry,uv=g.attributes.uv1;
      for(let j=0;j<g.index.count;j+=3){
        const i=g.index.getX(j);if(Math.abs(uv.getX(i)-.5)>.09||Math.abs(uv.getY(i)-.41)>.1)continue;
        const ray=rayFor(mesh,j),candidate=pickStockingSurface(runtimeId,ray);
        if(candidate?.side==='left'&&candidate.point.distanceTo(mid)<.0005){hit=candidate;site={mesh,face:j,ray};break;}
      }
      if(site)break;
    }
    assert(site&&hit,'No exposed front calf on this PMX.');
    const fits=fitStockings(model.mesh,stockingDraws(model)), fit=fits[group.children.indexOf(site.mesh)];
    const ref=new Vector3(), scratch=new Vector3();
    function skinDistance(){
      ref.set(0,0,0);
      for(let k=0;k<3;k++){
        const i=fit.vertices[site.mesh.geometry.index.getX(site.face+k)];
        ref.add(fit.draw.body.getVertexPosition(i,scratch).applyMatrix4(fit.draw.body.matrixWorld));
      }
      return mid.distanceTo(ref.divideScalar(3));
    }
    const standingGap=skinDistance();assert(standingGap<.002,'Fabric detached from the standing PMX.');
    const clothAlpha=()=>{
      const map=site.mesh.material.alphaMap,{width,height,data}=map.image;
      const channels=data.length/(width*height);
      return data[(Math.floor(hit.v*height)*width+Math.floor(hit.u*width))*channels+1];
    };
    // Check cover, uncover, without a timeline tick or rewriting any PMX material.
    const block=new Mesh(new BoxGeometry(.04,.04,.04),new MeshBasicMaterial());
    block.userData.stagePropSolid=true;block.position.copy(hit.point).addScaledVector(site.ray.direction,-.08);
    scene.add(block);block.updateMatrixWorld(true);assert.equal(pickStockingSurface(runtimeId,site.ray),null);
    block.removeFromParent();block.material.dispose();block.geometry.dispose();
    const intact=clothAlpha();assert(intact>45&&intact<225);
    armStockingTear(actor);assert(recordStockingTear(useStockings.getState().armed,{side:hit.side,u:hit.u,v:hit.v,du:.06,dv:.12}));
    room.advance(false);assert.equal(clothAlpha(),0);assert.equal(pickStockingSurface(runtimeId,site.ray),null);
    // Drive the production pose evaluator: changing just the named knee's
    // quaternion would not move a PMX's independently append-driven D bones.
    const before=mid.clone(), editor=rt.beginPose(runtimeId,0);
    assert(editor?.applyPreset('allFours'));tick();
    rayFor(site.mesh,site.face);const travel=mid.distanceTo(before);assert(travel>.003,'Skinned calf did not move.');assert.equal(clothAlpha(),0);
    const posedGap=skinDistance();assert(posedGap<.002,'Fabric detached from the articulated PMX.');
    rt.endPose(runtimeId);tick();
    assert(dressStockings(actor,'replace'));room.advance(false);assert.equal(clothAlpha(),intact);assert(pickStockingSurface(runtimeId,site.ray));
    const cover=process.argv.slice(3).find(s=>s.startsWith('--cover='))?.slice(8);
    if(cover){
      const candidates=[];
      rt.setMaterialVisible(runtimeId,cover,false);tick();
      for(const mesh of parts){const g=mesh.geometry,uv=g.attributes.uv1;
        for(let j=0;j<g.index.count&&candidates.length<60;j+=15){
          const i=g.index.getX(j);if(uv.getY(i)>.17)continue;
          const ray=rayFor(mesh,j), found=pickStockingSurface(runtimeId,ray);
          if(found?.side==='left'&&found.point.distanceTo(mid)<.0005)candidates.push(ray);
        }}
      rt.setMaterialVisible(runtimeId,cover,true);tick();
      assert(candidates.some(ray=>!pickStockingSurface(runtimeId,ray)),'No change in stocking acquisition behind the requested material.');
    }
    assert(dressStockings(actor,'remove'));room.advance(false);assert.equal(group.parent,null);assert.equal(pickStockingSurface(runtimeId,site.ray),null);
    console.log(JSON.stringify({triangles:group.children.reduce((n,m)=>n+m.geometry.index.count/3,0),scale,posedCalfTravelM:+travel.toFixed(4),standingGapMm:+(standingGap*1000).toFixed(3),posedGapMm:+(posedGap*1000).toFixed(3),alpha:[intact,0,intact],propOcclusion:true,footwearOcclusion:cover?true:undefined}));
  }
} finally {room?.dispose();rt.dispose();close();}
