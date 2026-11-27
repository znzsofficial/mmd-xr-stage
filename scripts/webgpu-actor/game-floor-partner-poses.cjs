const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const captureEyes = require('./game-floor-partner-eyes.cjs');

const poses = ['sideLegLift','sideForwardLeg','halfKneel','supineKneeHug','allFours','forearmKneel','matingPress'];
const distance = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));

// Read the live PMX and the actual drawn partner. Do not infer either hand's
// position from the preset name, pose handles or the partner's IK targets.
async function observe({asset,runtime}) {
  const {useBackpack}=await import('/src/mmdVrShowcase/backpack/store.ts');
  const {useStagePlay}=await import('/src/mmdVrShowcase/play/stagePlay.ts');
  const {usePelvic}=await import('/src/mmdVrShowcase/pelvic/store.ts');
  const {usePoseSession}=await import('/src/mmdVrShowcase/pose/poseSession.ts');
  const {centerZ}=await import('/src/mmdVrShowcase/play/siliconeProfile.ts');
  const {authoredSurface}=await import('/src/mmdVrShowcase/play/authoredSurface.ts');
  const {createWandPose}=await import('/src/mmdVrShowcase/play/wandPose.ts');
  const {modelDrawRange}=await import('/src/mmdVrShowcase/mmdRuntime/modelDrawRange.ts');
  const {scene}=gameTargets.floorState(), owner=useStagePlay.getState().stand;
  const root=scene.children.find(o=>o.userData.mmdModelId===runtime);
  let mesh; root?.traverse(o=>{if(o.isSkinnedMesh&&authoredSurface.has(o))mesh??=o;});
  if(!mesh||owner?.assetId!==asset)throw Error('Missing original mounted actor or partner assignment');
  const floorY=useBackpack.getState().live[asset].position[1];
  const names=new Map();
  for(const bone of mesh.skeleton.bones)for(const name of [bone.name,bone.userData.mmdBoneName,bone.userData.mmdEnglishBoneName]) {
    if(typeof name!=='string')continue;
    const key=name.normalize('NFKC').toLowerCase().split(':').pop().replace(/[\s_.-]/g,'').replace(/^mixamorig/,'');
    if(!names.has(key))names.set(key,bone);
  }
  const sides=['left','right'];
  function bones(jp,en) {
    return sides.map((side,i)=>{
      const aliases=[...jp.map(k=>(i?'右':'左')+k),...en.flatMap(k=>[side+k,k+side[0],side[0]+k])];
      const bone=aliases.map(k=>names.get(k)).find(Boolean);
      if(!bone)throw Error(`Missing displayed ${side} ${en[0]}`);
      return bone;
    });
  }
  const knees=bones(['ひざ','膝'],['knee','shin','calf','lowerleg','leg']);
  const ankles=bones(['足首'],['ankle','foot']);
  const hips=bones(['足','大腿'],['thigh','upleg','upperleg']);
  const shoulders=bones(['腕','肩'],['upperarm','arm','shoulder']);
  const world=o=>o.getWorldPosition(mesh.position.clone());
  // The ankle pivot can be well above a PMX shoe's heel. Read the visible
  // sole and the opposite knee surface from the same posed drawn vertices.
  function halfKneelGround() {
    const source=authoredSurface.get(mesh),g=mesh.geometry,{skinIndex,skinWeight}=g.attributes;
    const skin=createWandPose(mesh,mesh,source.morphs,source.position);skin.begin();
    const rig=mesh.skeleton.bones,part=rig.map(b=>{
      for(let node=b;node?.isBone;node=node.parent) {
        const donor=rig[node.userData.mmdAppendTransform?.parentIndex];
        if(node===ankles[0]||donor===ankles[0])return 'sole';
        if([hips[1],knees[1]].includes(node)||[hips[1],knees[1]].includes(donor))return 'knee';
      }
    });
    const result={sole:Infinity,knee:Infinity},seen=new Set(),knee=world(knees[1]),point=mesh.position.clone();
    const reach=knee.distanceTo(world(ankles[1]))*.45;
    const draw=(m,start,end)=>{
      if(!m?.visible||!m.colorWrite||m.opacity<=0||m.userData.mmdTslOutlineMaterial)return;
      for(let j=start;j<end;j++) {
        const i=g.index?.getX(j)??j;if(seen.has(i))continue;seen.add(i);
        let main=0;for(let k=1;k<4;k++)if(skinWeight.getComponent(i,k)>skinWeight.getComponent(i,main))main=k;
        const key=part[skinIndex.getComponent(i,main)];if(!key)continue;
        skin.vertex(i,point);if(key==='knee'&&point.distanceTo(knee)>reach)continue;
        result[key]=Math.min(result[key],point.y-floorY);
      }
    };
    root.traverseVisible(o=>{
      if(!o.isMesh||o.geometry.attributes.position!==g.attributes.position)return;
      const {start,count}=modelDrawRange(o),end=Math.min(start+count,g.index?.count??source.position.count);
      if(Array.isArray(o.material))for(const gr of o.geometry.groups)draw(o.material[gr.materialIndex],Math.max(start,gr.start),Math.min(end,gr.start+gr.count));
      else draw(o.material,start,end);
    });
    if(!Object.values(result).every(Number.isFinite))throw Error('No drawable supporting shoe or rear knee surface');
    return result;
  }
  const midpoint=pair=>world(pair[0]).lerp(world(pair[1]),.5);
  function bodyAxes() {
    const up=midpoint(shoulders).sub(midpoint(hips)).normalize();
    const front=world(shoulders[0]).sub(world(shoulders[1])).cross(up).normalize();
    return {up,front};
  }
  function landmarks() {
    const group=scene.getObjectByName('pelvic:partner');
    const part=name=>group.getObjectByName('pelvic:partner-'+name);
    const scale=group.matrixWorld.getMaxScaleOnAxis();
    // Partner-space displacements expressed in metres: changing the partner's
    // overall position or heading does not count as a unilateral hand response.
    const hands=sides.map(side=>group.worldToLocal(world(part(side+'-hand'))).multiplyScalar(scale).toArray());
    const trunk=world(part('head')).sub(world(part('pelvis'))).normalize();
    const hip=midpoint(hips),{up,front}=bodyAxes(),pelvis=world(part('pelvis'));
    const headward=up.clone().setY(0).normalize();
    const facing=mesh.position.clone().set(0,0,-1).transformDirection(part('torso').matrixWorld);
    const shaft=group.getObjectByName('play:piece:dildo'),vertices=shaft.geometry.attributes.position;
    let baseY=Infinity;
    for(let i=0;i<vertices.count;i++)baseY=Math.min(baseY,vertices.getY(i));
    const base=shaft.localToWorld(mesh.position.clone().set(0,baseY,centerZ(baseY)));
    const skin=part('pelvis'),surface=skin.geometry.attributes.position,vertex=mesh.position.clone();
    let baseToSkinM=Infinity;
    for(let i=0;i<surface.count;i++)baseToSkinM=Math.min(baseToSkinM,vertex.fromBufferAttribute(surface,i).applyMatrix4(skin.matrixWorld).distanceTo(base));
    const entry=scene.getObjectByName('pelvic:adapter:'+asset);
    return {scale,floorY,knees:knees.map(k=>world(k).toArray()),ankleY:ankles.map(k=>world(k).y-floorY),
      kneeToShoulder:knees.map((k,i)=>world(k).distanceTo(world(shoulders[i]))),hands,trunkUp:trunk.y,
      spineAlignment:trunk.dot(up),chestToActor:-facing.dot(front),facesHeadward:facing.dot(headward),
      anteriorM:pelvis.clone().sub(hip).dot(front),rearDistanceM:hip.sub(pelvis).dot(headward),
      hipToShaftRootM:pelvis.distanceTo(base),baseToSkinM,entry:world(entry).toArray(),out:mesh.position.clone().set(0,0,1).transformDirection(entry.matrixWorld).toArray()};
  }
  const failures=new Set(); let previewFrames=null, crossing=null;
  const profile=usePelvic.getState().byAsset[asset];
  const offOwner=useStagePlay.subscribe(s=>{if(s.stand!==owner)failures.add('Partner assignment was replaced');});
  const offRig=usePelvic.subscribe(s=>{
    const p=s.byAsset[asset];
    if(s.active?.runtimeId!==runtime||s.active.assetId!==asset)failures.add('Lost original operating actor');
    if(s.strokeOrder||p?.fluid.vaginal!==profile.fluid.vaginal||p?.fluid.fantasyUterine!==profile.fluid.fantasyUterine||
      p?.overflow!==profile.overflow||p?.drained!==profile.drained)failures.add('Dose or fluid balance changed');
  });
  partnerTake.onDraw=()=>{
    const r=partnerTake.read();
    if(scene.getObjectByName('play:liquid-spray')?.count>0)failures.add('Liquid emitted during pose batch');
    if(previewFrames!==null&&r.editing) {
      previewFrames++;
      if(!r.partnerOnly||!r.owned||r.running||usePelvic.getState().sample||!r.home||!(r.z>.03)||!(r.tipError<.001))
        failures.add('Editor preview lost its measured outside partner');
    }
    if(crossing&&r.running&&Number.isFinite(r.z)&&!crossing.some(f=>f.inside))crossing.push({z:r.z,inside:r.inside,token:r.token});
  };
  window.partnerPoseBatch={landmarks,halfKneelGround,selected:()=>usePoseSession.getState().selected,
    beginPreview(){previewFrames=0;},finishPreview(){const n=previewFrames;previewFrames=null;return n;},
    beginCrossing(){crossing=[];},finishCrossing(){const trace=crossing;crossing=null;return trace;},
    failures:()=>[...failures],dispose(){delete partnerTake.onDraw;offOwner();offRig();delete window.partnerPoseBatch;}};
}

module.exports=async function({page,asset,runtime,exposed,dir,press,target,frames,idleRay,wait,poseStable,inside,choosePose}) {
  const results=[], issues=[];
  const check=(ok,label)=>{if(!ok)issues.push(label);};
  const landmarks=()=>page.evaluate(()=>partnerPoseBatch.landmarks());
  const outside=r=>r.owned&&r.partnerOnly&&r.mode==='standManual'&&r.home&&!r.running&&!r.inside&&r.z>.03&&r.tipError<.001;
  async function capture(tag,{view,hands=false}={}) {
    await idleRay();
    const points=await landmarks();
    const options={runtime,floorY:points.floorY,view,hands};
    let shot=await page.evaluate(captureEyes,options);
    if(hands) {
      const visible=s=>Math.min(...s.hands.flat().map(e=>e.pixels));
      if(!view)for(const angle of [1.1,-1.1,Math.PI]) {
        if(visible(shot)>8)break;
        const other=await page.evaluate(captureEyes,{...options,angle});if(visible(other)>visible(shot))shot=other;
      }
      check(visible(shot)>8,`${tag}: a support hand is occluded in the submitted eyes`);
    } else if(!view) {
      // The front shoe and the companion can overlap almost completely in a
      // side-on shot. Compare actual eye contributions before choosing a view.
      const balance=s=>Math.min(...s.partner.map((e,i)=>Math.min(e.pixels,s.actor[i].pixels)));
      if(shot.partner.some((e,i)=>e.pixels<.45*shot.actor[i].pixels)) {
        for(const angle of [1.05,-1.05]) {
          const other=await page.evaluate(captureEyes,{...options,angle});if(balance(other)>balance(shot))shot=other;
        }
      }
    }
    const {png,...eyes}=shot;
    const file=`${exposed?'exposed':'covered'}-${tag}-stereo.png`;
    await fs.writeFile(path.join(dir,file),Buffer.from(png,'base64'));
    for(const subject of ['actor','partner']) {
      const pair=eyes[subject];
      check(pair.length===2&&pair.every(e=>e.pixels>240&&e.width>18&&e.height>18),`${tag}: missing ${subject} silhouette in submitted eyes: ${JSON.stringify(pair)}`);
    }
    check(eyes.skipped.every(n=>n>0),`${tag}: no draw omitted for silhouette control`);
    const floor=eyes.ground, low=Math.min(...Object.values(floor));
    const support=Math.min(...['left-foot','right-foot','left-shin','right-shin'].map(p=>floor[p]));
    check(low>=-.008*points.scale&&support<=.04*points.scale,`${tag}: lowest surface ${low} m, lowest leg support ${support} m from floor`);
    const after=await landmarks();
    check(distance(points.entry,after.entry)<.001&&distance(points.out,after.out)<.001,`${tag}: eye controls moved the entrance`);
    return {file,eyes,points};
  }
  async function adjustLeftLeg() {
    await press('调关节');
    for(let i=0;i<7&&await page.evaluate(()=>partnerPoseBatch.selected()!=='leftFoot');i++)await press('下一个');
    await target({name:'hud-label:左脚踝'});
    const before=await capture('sideLegLift-before-left-edit',{hands:true});
    // Use the named knee-plane control: the raised left ankle can lie behind
    // another world-space hit target on a clothed actor. Each press still uses
    // the right controller and the same pose solver as the on-body handle.
    for(let i=0;i<5;i++)await press('膝盖朝向 +');
    const after=await capture('sideLegLift-after-left-edit',{hands:true,view:before.eyes.view});
    const a=before.points,b=after.points;
    const kneeM=a.knees.map((k,i)=>distance(k,b.knees[i]));
    const handDelta=b.hands.map((p,i)=>p.map((v,j)=>v-a.hands[i][j]));
    const top=a.hands[0][1]>a.hands[1][1]?0:1;
    const upperHandM=Math.hypot(...handDelta[top]),bracingHandM=Math.hypot(...handDelta[1-top]);
    const upperHandPx=before.eyes.hands[top].map((p,eye)=>{
      const q=after.eyes.hands[top][eye];return p.pixels&&q.pixels?Math.hypot(q.centerX-p.centerX,q.centerY-p.centerY):0;
    });
    check(kneeM[0]>.025*a.scale&&kneeM[1]<.008*a.scale,`Left knee did not move independently: ${kneeM} m`);
    check(upperHandM>.012*a.scale&&bracingHandM<.008*a.scale,`Upper hand moved ${upperHandM} m; ground brace moved ${bracingHandM} m`);
    check(upperHandPx.every(n=>n>1),`No visible upper-hand travel at fixed eye poses: ${upperHandPx} px`);
    check(distance(a.entry,b.entry)<.002&&distance(a.out,b.out)<.005,'The leg edit moved or rotated the entrance');
    return {before,after,kneeM,handDelta,upperHandM,bracingHandM,upperHandPx};
  }

  // The ordinary exposed smoke just requested a dose. Let its existing spray
  // retire before installing the no-delivery observer for this separate phase.
  await (await page.waitForFunction(()=>(gameTargets.floorState().scene.getObjectByName('play:liquid-spray')?.count??0)===0)).dispose();
  await page.evaluate(observe,{asset,runtime});
  try {
    await press('推进'); await wait('start pose batch at admitted manual depth',inside);
    for(const id of poses) {
      // Always open the nested editor from inside. A test which starts from
      // home cannot distinguish a real park from a stale admitted operation.
      const old=await wait(`${id}: admitted before opening editor`,inside);
      await press('调整姿势');
      const preview=await wait(`${id}: partner-only outside editor preview`,r=>r.editing&&r.owned&&r.partnerOnly&&r.home&&!r.running&&!r.inside&&r.z>.03&&r.tipError<.001);
      assert.notEqual(preview.token,old.token,`${id}: editor retained admission token`);
      await page.evaluate(()=>partnerPoseBatch.beginPreview());
      const previous=await page.evaluate(()=>partnerTake.pose());
      await choosePose(id); await frames(3);
      const posed=await page.evaluate(()=>partnerTake.pose());
      const poseChangeM=Math.max(...posed.map((v,i)=>distance(v,previous[i])));
      assert(poseChangeM>.04,`${id}: preset receipt did not change the displayed PMX`);
      const legEdit=id==='sideLegLift'?await adjustLeftLeg():undefined;
      // Save from the displayed PMX *before* returning, including the edit.
      const edited=await landmarks();
      await page.evaluate(()=>partnerTake.keepPose());
      await press('保留姿势并返回'); await target({name:'hud:调整姿势'});
      const parked=await wait(`${id}: retained pose and original mount at home`,outside);poseStable(parked);
      assert.equal(parked.token,preview.token,`${id}: returning replaced the parked operation`);
      const retained=await landmarks();
      const supportDriftM=Math.max(...retained.hands.map((h,i)=>distance(h,edited.hands[i])));
      check(supportDriftM<.012*edited.scale,`${id}: same-home hand supports shifted ${supportDriftM} m on return`);
      const previewFrames=await page.evaluate(()=>partnerPoseBatch.finishPreview());assert(previewFrames>2);
      await page.evaluate(()=>partnerPoseBatch.beginCrossing());await press('推进');await frames(40);
      const deep=await wait(`${id}: fresh admitted crossing after editor`,inside);poseStable(deep);
      const trace=await page.evaluate(()=>partnerPoseBatch.finishCrossing());
      assert(trace.length>=3&&trace[0].z>.03&&!trace[0].inside&&trace.at(-1).inside&&trace.at(-1).z<0&&
        trace.some(f=>Math.abs(f.z)<.015)&&trace.every(f=>f.token===deep.token),`${id}: incomplete outside → inside trace: ${JSON.stringify(trace)}`);
      const shot=await capture(id);
      check(distance(edited.entry,shot.points.entry)<.002&&distance(edited.out,shot.points.out)<.005,`${id}: returning or driving moved the held actor's entrance`);
      const {hands,trunkUp,scale,rearDistanceM,knees,kneeToShoulder}=shot.points;
      if(id==='sideLegLift'||id==='sideForwardLeg') {
        check(Math.abs(trunkUp)<.65&&Math.abs(hands[0][1]-hands[1][1])>.08*scale,`${id}: expected a side-lying silhouette and distinct upper/lower support heights`);
        check(shot.points.spineAlignment>.78&&shot.points.chestToActor>.65&&shot.points.anteriorM>.03*scale,
          `${id}: spines must be parallel, with the partner on the actor's anterior side facing the actor`);
        check(shot.points.hipToShaftRootM<.24*scale&&shot.points.baseToSkinM<.09*scale,`${id}: pelvis separated from the visible shaft root`);
        check(Math.min(shot.eyes.ground['left-hand'],shot.eyes.ground['right-hand'])<.045*scale,`${id}: lower hand is not braced on the floor`);
      } else if(id==='allFours'||id==='forearmKneel') {
        check(trunkUp>.55&&rearDistanceM>.08*scale&&shot.points.facesHeadward>.75,`${id}: partner must be behind the kneeling actor, facing the head`);
      } else if(id==='halfKneel') {
        const ground=shot.points.bearingSurfaceM=await page.evaluate(()=>partnerPoseBatch.halfKneelGround());
        check(knees[0][1]-knees[1][1]>.10*scale&&Math.abs(ground.sole)<.035*scale&&Math.abs(ground.knee)<.035*scale,
          `${id}: expected a raised front knee, planted front sole and opposite knee: ${JSON.stringify(ground)} m from floor`);
      } else if(id==='supineKneeHug') {
        check(kneeToShoulder[0]+.12*scale<kneeToShoulder[1],`${id}: knees are not tucked independently`);
      }
      results.push({id,shot,legEdit,previewFrames,poseChangeM,outsideZ:parked.z,insideDepthM:deep.measured,poseDriftM:deep.poseDrift,supportDriftM,crossingFrames:trace.length});
    }
    issues.push(...await page.evaluate(()=>partnerPoseBatch.failures()));
    await fs.writeFile(path.join(dir,`${exposed?'exposed':'covered'}-pose-measurements.json`),JSON.stringify({poses:results,issues},null,2)+'\n');
    assert.deepEqual(issues,[],`Pose batch: ${issues.join('; ')}. Submitted comparisons: ${dir}`);
    return results;
  } finally {await page.evaluate(()=>window.partnerPoseBatch?.dispose());}
};
