import { DirectionalLight } from 'three';
import { xrPalms } from '../../experiments/gpu-cloth/xrPalms.js';
import { skirtPhysicsFilter } from '../../experiments/gpu-cloth/rig.js';
import { createActorMaterialAdapter } from './materialAdapter.js';
import { prepareRoomCloth, roomCloth } from './roomCloth.js';

const empty = () => ({mode:'none', cloth:'none', nodes:0, clothSteps:0, fullBodies:0, keptBodies:0,
  bulletSteps:0, bulletSimulatedSteps:0, updatedBones:0, evaluations:0, poseSeconds:0, physicsDelta:0});

/** Renderer resources only. StageRoom owns PMX/VMD, the one evaluator, the
 * visual placement scale and the physics rebind. Never request another RAF. */
export async function createStageActorBackend(renderer, scene, light, origin) {
  // The landmark sun can unmount when StageRoom mounts its own. The facade
  // takes one stable light reference; mirror the live room's world direction.
  const sun = new DirectionalLight(), palms = xrPalms();
  const adapter = await createActorMaterialAdapter(renderer,sun,{balancedModelColor:true});
  let actor, sourceLight = light, disposed = false, tracked = false, serial = 0, prepared = -1;
  let enabled = true, worldPalms = null, seedFrame = false;
  const status = () => ({...(actor?.log ?? empty()), enabled, palms:actor ? [...palms.kinds] : ['missing','missing']});
  return {
    loadOptions:adapter.loadOptions,
    get status() { return status(); }, getStatus:status,
    setLight(value) { sourceLight = value; },
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
    attach(model) {
      if (disposed) throw new DOMException('Room retired','AbortError');
      if (actor) throw Error('This internal room supports one mounted actor');
      const log = empty();
      const g = model.mesh.geometry;
      // liveBounds reads GEOMETRY bounds, whereas the TSL facade caches the
      // skinned MESH box. Compute both on real positions, not sparse output.
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingSphere) g.computeBoundingSphere();
      let rig, cloth;
      try {
        const fitted = prepareRoomCloth(model.mesh);
        if (!fitted.handSamples.faces.length) throw Error('No drawn cloth panel supports this rig');
        rig = fitted;
      }
      catch (error) { log.cloth = 'unsupported'; log.clothError = String(error?.message ?? error); }
      try {
        adapter.attach(model);
        if (rig) cloth = roomCloth(renderer,model,rig,log);
      } catch (error) { adapter.detach(model); throw error; }

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
        reseed() { interrupted = true; cloth?.suspend(); },
        interrupt() { ready = cut = false; binding.reseed(); },
        dispose() {
          if (retired) return;
          retired = true; ready = cut = false;
          try { cloth?.dispose(); } finally { adapter.detach(model); actor = undefined; }
        },
      };
      actor = {log,binding,cloth};
      return binding;
    },
    prepareRender() {
      if (!actor || !tracked || disposed || serial === prepared) return;
      prepared = serial;
      sun.visible = !!sourceLight?.visible;
      if (sourceLight) {
        sun.intensity = sourceLight.intensity; sun.color.copy(sourceLight.color);
        sourceLight.getWorldPosition(sun.position); sourceLight.target.getWorldPosition(sun.target.position);
      }
      adapter.prepare(scene);
    },
    dispose() {
      if (disposed) return;
      disposed = true; tracked = false; worldPalms = null; palms.reset();
      actor?.binding.dispose(); adapter.dispose(); sun.dispose();
    },
  };
}
