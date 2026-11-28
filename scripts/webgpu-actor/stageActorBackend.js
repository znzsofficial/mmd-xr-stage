import { DirectionalLight } from 'three';
import { xrPalms } from '../../experiments/gpu-cloth/xrPalms.js';
import { skirtPhysicsFilter } from '../../experiments/gpu-cloth/rig.js';
import { createActorMaterialAdapter } from './materialAdapter.js';
import { prepareRoomCloth, roomCloth } from './roomCloth.js';
import { inspectActorStyle } from './actorStyleSlots.js';
import { createActorStyle } from './actorStyle.js';
import { drawRevision, presentDraws, restoreDraws } from '../../src/mmdVrShowcase/wardrobe/draws';
import { prepareFloorMilk } from './actorMilk.js';
import {makeEggSurface} from './eggSurface.js';
import {bindAuthoredSurface} from './authoredSurface.js';
import {authoredSurface} from '../../src/mmdVrShowcase/play/authoredSurface';
import {createFloorPoseSkirt} from './poseSkirtDisplay.js';
import {createModelTextureUploads} from '../../src/mmdVrShowcase/stage/loading/modelTextureUploads';

const empty = () => ({mode:'none', cloth:'none', nodes:0, clothSteps:0, fullBodies:0, keptBodies:0,
  bulletSteps:0, bulletSimulatedSteps:0, updatedBones:0, evaluations:0, poseSeconds:0, physicsDelta:0});

/** Renderer resources only. StageRoom owns PMX/VMD, the one evaluator, the
 * visual placement scale and the physics rebind. Never request another RAF. */
export async function createStageActorBackend(renderer, scene, light, origin, grade={balancedModelColor:true}, gpuTiming, firstUse) {
  // The landmark sun can unmount when StageRoom mounts its own. The facade
  // takes one stable light reference; mirror the live room's world direction.
  const sun = new DirectionalLight(), palms = xrPalms();
  const textureUploads = createModelTextureUploads(texture => renderer.initTexture(texture));
  const adapter = await createActorMaterialAdapter(renderer,sun,{...grade,stageEdits:true,reuseStylePasses:true});
  // Models get their runtime IDs after attachment. Key the attachment by the
  // loaded model itself, including during restore and disposal of stale loads.
  const actors = new Map();
  let sourceLight = light, disposed = false, tracked = false, serial = 0, prepared = -1;
  let enabled = true, worldPalms = null, seedFrame = false, displayDirty = false;
  const listeners = new Set(), notify = () => { for (const f of listeners) f(); };
  function actorFor(id) {
    if(!id)return;
    for(const actor of actors.values())if(actor.model.root.userData.mmdModelId===id)return actor;
  }
  function styleFor(id,file) {
    const actor=actorFor(id);return actor?.file===file ? actor?.style : undefined;
  }
  function status() {
    const list=[...actors.values()],single=list.length===1?list[0]:null;
    const log=single?{...single.log}:empty();
    if(list.length>1){
      const counters=['nodes','clothSteps','fullBodies','keptBodies','bulletSteps','bulletSimulatedSteps','updatedBones','evaluations'];
      for(const {log:actorLog} of list){for(const key of counters)log[key]+=actorLog[key];}
      log.mode=list.every(actor=>actor.log.mode===list[0].log.mode)?list[0].log.mode:'mixed';
      log.cloth=list.every(actor=>actor.log.cloth===list[0].log.cloth)?list[0].log.cloth:'mixed';
    }
    return {...log,enabled,style:single?.style.snapshot??null,palms:list.length?[...palms.kinds]:['missing','missing'],
      actors:list.map(({model,log,style})=>({id:model.root.userData.mmdModelId,visible:model.root.visible,mode:log.mode,style:style.snapshot.mode}))};
  }
  function presentWardrobes(){for(const {model} of actors.values())presentDraws(model.mesh);}
  function afterMaterialSync(){
    for(const {skirt} of actors.values())skirt.submit();
    presentWardrobes();
  }
  return {
    loadOptions:adapter.loadOptions,
    beginModelLoad:firstUse?.model,
    prepareModelTextures:textureUploads.prepare,
    getGarmentPose:id=>actorFor(id)?.garment??null,
    getEggSurface:id=>actorFor(id)?.egg(),
    prepareMilkOutlets:(model,stale,bytes)=>prepareFloorMilk(model,stale,bytes,()=>{
      const actor=actors.get(model);return actor?.cloth?.active||actor?.skirt.active;
    }),
    styles:{subscribe(f) { listeners.add(f); return () => { listeners.delete(f); }; },
      read:(id,file) => styleFor(id,file)?.snapshot ?? null,
      choose:(id,file,mode) => styleFor(id,file)?.choose(mode)},
    get status() { return status(); }, getStatus:status,
    setLight(value) { sourceLight = value; displayDirty = true; },
    setClothEnabled(value) { enabled = !!value; if (!enabled) for(const actor of actors.values())actor.binding.interrupt(); },
    beginFrame(frame,space,reseed) {
      if (disposed) return;
      ++serial;
      seedFrame = reseed;
      tracked = !!(origin.current && space && frame?.session.visibilityState === 'visible' && frame.getViewerPose(space)?.views.length);
      if (tracked) textureUploads.advance();
      if (!tracked || reseed) {
        palms.reset();
        for(const actor of actors.values()){
          if(tracked)actor.cloth?.interrupt();else actor.binding.interrupt();
        }
      }
      worldPalms = tracked ? palms.read(frame,space,origin.current.matrixWorld) : null;
    },
    attach(model,source,timing) {
      if (disposed) throw new DOMException('Room retired','AbortError');
      if (actors.has(model)) throw Error('Model already attached');
      const log = empty();
      const attachAt = timing && performance.now();
      const g = model.mesh.geometry;
      const basePosition=g.attributes.position,baseUv=g.attributes.uv;
      // liveBounds reads GEOMETRY bounds, whereas the TSL facade caches the
      // skinned MESH box. Compute both on real positions, not sparse output.
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingSphere) g.computeBoundingSphere();
      let rig, cloth, egg;
      try {
        const fitted = prepareRoomCloth(model.mesh);
        if (!fitted.handSamples.faces.length) throw Error('No drawn cloth panel supports this rig');
        rig = fitted;
      }
      catch (error) { log.cloth = 'unsupported'; log.clothError = String(error?.message ?? error); }
      const plan = inspectActorStyle(model);
      try {
        adapter.attach(model,{reuseSparseMorphOutputs:true},plan.hasBase ? {hybridSlots:plan.hybridSlots,deferStyleGeometry:true,
          pmxBytes:source?.pmxBytes,pmxFile:source?.file} : undefined);
        if (rig) cloth = roomCloth(renderer,model,rig,log,gpuTiming);
      } catch (error) { adapter.detach(model); throw error; }

      const style = createActorStyle(model,source,plan,adapter,notify,undefined,firstUse);
      const surface=bindAuthoredSurface(model.mesh,basePosition,baseUv,source?.pmxBytes,rig,()=>cloth?.active);
      const skirt=createFloorPoseSkirt(renderer,model.mesh,surface);
      const filter = rig && skirtPhysicsFilter(rig);
      let ready = false, cut = false, stepped = false, lastPose = -1, retired = false, interrupted = true;
      const binding = {
        fitEditedSkirt:skirt.fit,
        beforePose(allow) {
          stepped = cut = false;
          ready = !!(allow && tracked && enabled && cloth?.ready(true));
          if (!ready) { cloth?.suspend(); interrupted = true; }
        },
        stepPhysics(context,step) {
          const selected = ready && enabled && tracked ? filter(context) : context;
          const result = step(selected); // Existing Bullet world AND all synthetic slots.
          stepped = true; cut = selected !== context;
          log.fullBodies = context.rigidBodies?.length ?? 0;
          log.keptBodies = selected.rigidBodies?.length ?? 0;
          log.updatedBones = result.updatedBoneCount ?? 0;
          ++log.bulletSteps;
          if (result.simulated) ++log.bulletSimulatedSteps;
          return result;
        },
        afterPose(seconds,delta,reseed) {
          log.poseSeconds = seconds; log.physicsDelta = delta; ++log.evaluations;
          log.mode = stepped ? 'bullet' : 'none';
          if (!stepped) log.fullBodies = log.keptBodies = log.updatedBones = 0;
          if (cut && tracked && lastPose !== serial) {
            // Just like the native world, takeover, seek and recovery show
            // this exact evaluated pose. The next continuous tick starts at
            // its own fresh goals with no previous hand sweep or inertia.
            if (reseed || seedFrame || interrupted) cloth.suspend();
            else cloth.frame(delta,true,worldPalms);
            interrupted = false;
            if (log.cloth === 'ready') log.mode = 'gpu';
            else ready = false; // next native step immediately gets its original topology
            lastPose = serial;
          } else if (!cut) { cloth?.suspend(); interrupted = true; }
        },
        reseed() { interrupted = true; displayDirty = true; cloth?.suspend(); },
        interrupt() { ready = cut = false; binding.reseed(); },
        dispose() {
          if (retired) return;
          retired = true; ready = cut = false;
          actors.delete(model);
          timing?.cancel();
          authoredSurface.delete(model.mesh);
          try { egg?.dispose();skirt.dispose();cloth?.dispose(); } finally {
            try { adapter.detach(model); } finally { style.dispose(); notify(); }
          }
        },
      };
      // Bone and sparse vertex shape edits are sampleable on the displayed
      // garment. A GPU cloth offset or unverified moving cutout is not.
      const offsets=model.mesh.userData.mmdMorphs.flatMap((m,i)=>['uv','material','unknown'].includes(m.type)?[i]:[]);
      const garment={position:basePosition,get morphs(){return surface.morphs;},
        sampleable:()=>!retired&&!cloth?.active&&!skirt.active&&surface.sampleable([])&&offsets.every(i=>model.mesh.morphTargetInfluences[i]===0)};
      actors.set(model,{log,binding,cloth,skirt,model,file:source?.file,style,timing,garment,egg:()=>egg??=makeEggSurface(model.mesh,basePosition,baseUv,source?.pmxBytes,rig,()=>cloth?.active)});
      if(timing){
        timing.report.attachWallMs=performance.now()-attachAt;
        timing.report.loaderWallMs=timing.work.loaderWallMs;
        timing.report.loadTexturesWallMs=timing.work.loaderStagesMs?.['load-textures']??null;
      }
      notify();
      return binding;
    },
    prepareRender(poseUpdated=true) {
      if (!actors.size || !tracked || disposed || serial === prepared) return;
      prepared = serial;
      let changed=poseUpdated||displayDirty;
      for(const actor of actors.values()){
        const {model,style}=actor, revision=drawRevision(model.mesh);
        if(actor.skirt.dirty)changed=true;
        if(model.root.parent && model.root.visible){actor.timing?.mark();if(style.frame())changed=true;}
        if(actor.drawRevision!==revision){actor.drawRevision=revision;changed=true;}
      }
      if(!changed)return;
      displayDirty = false;
      sun.visible = !!sourceLight?.visible;
      if (sourceLight) {
        sun.intensity = sourceLight.intensity; sun.color.copy(sourceLight.color);
        sourceLight.getWorldPosition(sun.position); sourceLight.target.getWorldPosition(sun.target.position);
      }
      // The loader rewrites surface + outline flags during prepareRender.
      // Reapply the wardrobe before the style's face shadow and both eye draws.
      for(const {model} of actors.values())restoreDraws(model.mesh);
      try {adapter.prepare(scene,afterMaterialSync);} finally {presentWardrobes();}
    },
    dispose() {
      if (disposed) return;
      disposed = true; tracked = false; worldPalms = null; palms.reset();
      textureUploads.dispose();
      for(const actor of actors.values())actor.binding.dispose();
      listeners.clear(); adapter.dispose(); sun.dispose();
    },
  };
}
