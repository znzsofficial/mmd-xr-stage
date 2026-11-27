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

const empty = () => ({mode:'none', cloth:'none', nodes:0, clothSteps:0, fullBodies:0, keptBodies:0,
  bulletSteps:0, bulletSimulatedSteps:0, updatedBones:0, evaluations:0, poseSeconds:0, physicsDelta:0});

/** Renderer resources only. StageRoom owns PMX/VMD, the one evaluator, the
 * visual placement scale and the physics rebind. Never request another RAF. */
export async function createStageActorBackend(renderer, scene, light, origin, grade={balancedModelColor:true}) {
  // The landmark sun can unmount when StageRoom mounts its own. The facade
  // takes one stable light reference; mirror the live room's world direction.
  const sun = new DirectionalLight(), palms = xrPalms();
  const adapter = await createActorMaterialAdapter(renderer,sun,grade);
  let actor, sourceLight = light, disposed = false, tracked = false, serial = 0, prepared = -1;
  let enabled = true, worldPalms = null, seedFrame = false, displayDirty = false;
  const listeners = new Set(), notify = () => { for (const f of listeners) f(); };
  const styleFor = (id,file) => actor?.file === file && actor?.model.root.userData.mmdModelId === id ? actor?.style : undefined;
  const status = () => ({...(actor?.log ?? empty()), enabled, style:actor?.style.snapshot ?? null, palms:actor ? [...palms.kinds] : ['missing','missing']});
  return {
    loadOptions:adapter.loadOptions,
    getGarmentPose:id=>actor?.model.root.userData.mmdModelId===id?actor.garment:null,
    getEggSurface:id=>actor?.model.root.userData.mmdModelId===id?actor.egg():undefined,
    prepareMilkOutlets:(model,stale,bytes)=>prepareFloorMilk(model,stale,bytes,()=>actor?.model===model&&actor.cloth?.active),
    styles:{subscribe(f) { listeners.add(f); return () => { listeners.delete(f); }; },
      read:(id,file) => styleFor(id,file)?.snapshot ?? null,
      choose:(id,file,enabled) => styleFor(id,file)?.choose(enabled)},
    get status() { return status(); }, getStatus:status,
    setLight(value) { sourceLight = value; displayDirty = true; },
    setClothEnabled(value) { enabled = !!value; if (!enabled) actor?.binding.interrupt(); },
    beginFrame(frame,space,reseed) {
      if (disposed) return;
      ++serial;
      seedFrame = reseed;
      tracked = !!(origin.current && space && frame?.session.visibilityState === 'visible' && frame.getViewerPose(space)?.views.length);
      if (!tracked || reseed) { palms.reset(); actor?.cloth?.interrupt(); }
      if (!tracked) actor?.binding.interrupt();
      worldPalms = tracked ? palms.read(frame,space,origin.current.matrixWorld) : null;
    },
    attach(model,source) {
      if (disposed) throw new DOMException('Room retired','AbortError');
      if (actor) throw Error('This floor supports one mounted actor at a time');
      const log = empty();
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
        adapter.attach(model,undefined,plan.hasBase ? {hybridSlots:plan.hybridSlots,pmxBytes:source?.pmxBytes} : undefined);
        if (rig) cloth = roomCloth(renderer,model,rig,log);
      } catch (error) { adapter.detach(model); throw error; }

      const style = createActorStyle(model,source,plan,adapter,notify);
      const surface=bindAuthoredSurface(model.mesh,basePosition,baseUv,source?.pmxBytes,rig,()=>cloth?.active);
      const filter = rig && skirtPhysicsFilter(rig);
      let ready = false, cut = false, stepped = false, lastPose = -1, retired = false, interrupted = true;
      const binding = {
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
           try { egg?.dispose();cloth?.dispose(); } finally {
            try { adapter.detach(model); } finally { style.dispose(); actor = undefined; notify(); }
          }
        },
      };
      // Bone and sparse vertex shape edits are sampleable on the displayed
      // garment. A GPU cloth offset or unverified moving cutout is not.
      const offsets=model.mesh.userData.mmdMorphs.flatMap((m,i)=>['uv','material','unknown'].includes(m.type)?[i]:[]);
      const garment={position:basePosition,get morphs(){return surface.morphs;},
        sampleable:()=>!retired&&!cloth?.active&&surface.sampleable([])&&offsets.every(i=>model.mesh.morphTargetInfluences[i]===0)};
      actor = {log,binding,cloth,model,file:source?.file,style,garment,egg:()=>egg??=makeEggSurface(model.mesh,basePosition,baseUv,source?.pmxBytes,rig,()=>cloth?.active)};
      notify();
      return binding;
    },
    prepareRender(poseUpdated=true) {
      if (!actor || !tracked || disposed || serial === prepared) return;
      prepared = serial;
      const styleChanged = actor.model.root.parent && actor.model.root.visible && actor.style.frame();
      const mesh=actor.model.mesh, revision=drawRevision(mesh);
      if (!poseUpdated && !styleChanged && !displayDirty && actor.drawRevision===revision) return;
      actor.drawRevision=revision;
      displayDirty = false;
      sun.visible = !!sourceLight?.visible;
      if (sourceLight) {
        sun.intensity = sourceLight.intensity; sun.color.copy(sourceLight.color);
        sourceLight.getWorldPosition(sun.position); sourceLight.target.getWorldPosition(sun.target.position);
      }
      // The loader rewrites surface + outline flags during prepareRender.
      // Reapply the wardrobe before the style's face shadow and both eye draws.
      restoreDraws(mesh);
      try {adapter.prepare(scene,()=>presentDraws(mesh));} finally {presentDraws(mesh);}
    },
    dispose() {
      if (disposed) return;
      disposed = true; tracked = false; worldPalms = null; palms.reset();
      actor?.binding.dispose(); listeners.clear(); adapter.dispose(); sun.dispose();
    },
  };
}
