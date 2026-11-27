import { createMmdTslBaseColorNode, createMmdTslPipeline, disposeMmdTslShadowCaster } from '@yohawing/three-mmd-loader/webgpu';
import { Color } from 'three';
import { materialEmissive, materialOpacity, max, sRGBTransferEOTF, sRGBTransferOETF, uniform, uniformTexture, uv } from 'three/tsl';
import { invalidateDraws } from '../../src/mmdVrShowcase/wardrobe/draws';
import { actorKeyLight, hybridToonColor, parseHybridSlots } from './hybridToon.js';
import { endfieldColor } from './endfieldToon.js';
import { strinovaColor } from './strinovaToon.js';
import { actorStyleMode } from './actorStyleSlots.js';
import { mmdStylePigment } from './mmdStylePigment.js';
import { prepareSkinTransmission } from './skinTransmission.js';
import { createFaceKeyShadow } from './faceKeyShadow.js';
import { prepareOutline, installOutline } from './endfieldOutline.js';

// Fork 3ac1d8e, webgpu/material-core.ts: the pipeline's colorNode returns
// EOTF(clamp(toon/sphere/specular composite, 0, 1)). Its public output cannot
// recover detail already clipped by that clamp. Grade the surviving RGB in the
// same gamma space as mmdMaterialEnhance.ts, before framebuffer blending.
function balancedToonColor(linear, gain) {
  const rgb = sRGBTransferOETF(linear).mul(gain);
  // Floor peak at the knee: the scale is exactly one below it (also at black).
  const peak = max(0.82, max(rgb.r, max(rgb.g, rgb.b)));
  const shoulder = peak.sub(0.82).mul(0.18).div(peak.sub(0.64)).add(0.82);
  return sRGBTransferEOTF(rgb.mul(shoulder.div(peak)));
}

// The room's ordinary TSL pass has dedicated self-shadow off. Reuse the
// fork's composite and live PMX uniforms. All consumers of THIS slot (MMD
// RGB, alpha, styled pigment and the face caster) borrow one replaceable
// sampler; other slots can safely start with the very same atlas Texture.
function editableStageColor(mesh, material, balanced, ambientIntensity) {
  const refs = material.userData.mmdTslTextureReferences;
  const diffuse = refs.diffuseMap && uniformTexture(refs.diffuseMap);
  let original = material.colorNode;
  if (diffuse) {
    material.map = refs.diffuseMap;
    original = createMmdTslBaseColorNode({ ...refs, diffuseMap: diffuse,
      uniforms: material.userData.mmdTslMaterialUniforms,
      sphereMode: material.userData.mmdMaterial.sphereMode, gammaSpaceComposite: true });
    material.opacityNode = materialOpacity.mul(diffuse.sample(uv()).a);
  }
  const enabled = uniform(!!balanced, 'bool');
  const ambient = uniform(Math.min(3, Math.max(0, ambientIntensity)));
  const balancedColor = balancedToonColor(original, ambient.mul(.34).add(.76));
  const brightColor = sRGBTransferEOTF(sRGBTransferOETF(original).mul(ambient.mul(.77).add(.72)));
  material.colorNode = enabled.select(balancedColor, brightColor);
  const emission = uniform(new Color(0));
  const originalDiffuseWeight = uniform(1);
  material.emissiveNode = materialEmissive.add(emission);
  let previousIntensity = 0, previousTint = '#ffffff';
  material.userData.stageMaterial = {
    diffuse, originalDiffuseWeight,
    setDiffuse(map) {
      if (!diffuse || diffuse.value === map) return;
      diffuse.value = map;
      originalDiffuseWeight.value = Number(map === refs.diffuseMap);
      invalidateDraws(mesh); // redraw the optional face projection on a held pose
    },
    sync(override, lighting) {
      enabled.value = lighting.balancedModelColor !== false;
      ambient.value = Math.min(3, Math.max(0, lighting.ambientIntensity ?? .55));
      const strength = Math.max(0, override.emission), tint = override.emissionColor || '#ffffff';
      if (strength !== previousIntensity || tint !== previousTint) {
        emission.value.set(tint).multiplyScalar(strength * (.5 + strength));
        previousIntensity = strength;
        previousTint = tint;
      }
    },
  };
  return original;
}

/**
 * One facade per fixture renderer. Use geometryAwareAlpha: true on the loader
 * (its WebGL outlines normally enable this scan). Load with loadOptions, then
 * attach that exact model once. After pose evaluation, call prepare(scene)
 * once per frame before the fixture's own draw (not once per model or eye).
 * Pass { balancedModelColor: true, ambientIntensity } to test the stage's
 * default toon grade; pass the same ambient scalar as the WebGL reference.
 * hybridSlots optionally maps cloth/leather/metal to disjoint, zero-based PMX
 * indices. Unlisted slots retain the requested grade (loader baseline if off).
 *
 * The fixture owns the renderer, light and loaded model, including its materials
 * and textures. In finally, detach(model) before the usual model disposal, and
 * dispose the adapter on teardown. Init/attach errors propagate to that owner.
 * Detach releases TSL compute/shadow helpers; it does not undo material and
 * outline replacement. Discard a failed/retired model rather than reattaching it.
 */
export async function createActorMaterialAdapter(renderer, light, { balancedModelColor = false, ambientIntensity = 0.55, hybridSlots, endfield = false, stageEdits = false } = {}) {
  const defaultSlots = parseHybridSlots(hybridSlots, endfield);
  const actors = new Map();
  function shadowFailure(a,error) {
    // A bad optional caster must never take down the device session's actor.
    // Keep its zero-strength target until detach: compiled face nodes refer to it.
    if(endfield)throw error; // The offline probe should fail its visual test.
    a.cast=false;a.shadowFailed=true;a.shadow?.setEnabled(false);
    console.warn('Optional face projection disabled for this actor',error);
  }
  // The facade awaits init() and checks the selected backend after fallback.
  const pipeline = await createMmdTslPipeline(renderer, {
    light,
    selfShadowEnabled: false, // The stage owns its lighting and submits both XR eyes itself.
  });
  function setStyle(model,value) {
    const a=actors.get(model), mode=actorStyleMode(value);
    const colors=mode==='mmd' ? a?.base : a?.styles.get(mode);
    if(!colors || a.mode===mode)return !!colors;
    try {
      a.outline?.setEnabled(mode==='endfield' && a.smoothOutline);
      a.shadow?.setEnabled(mode==='endfield' && a.cast);
      for(const [material,color] of colors){material.colorNode=color;material.needsUpdate=true;}
    } catch(e){
      for(const [material,color] of a.base){material.colorNode=color;material.needsUpdate=true;}
      a.mode='mmd';
      try {a.outline?.setEnabled(false);} finally {a.shadow?.setEnabled(false);}
      throw e;
    }
    a.mode=mode;
    return true;
  }
  function prepareStyle(model,maps={},mode='endfield') {
    const a=actors.get(model);
    if(!a?.slots.size)return false;
    if(a.styles.has(mode))return true;
    if(mode==='endfield' && !a.endfieldReady)return false;
    if(mode!=='strinova' && mode!=='endfield')return false;
    const {slots}=a;
    const details={...maps,thinSkin:a.thinSkin};
    const casters=details.faceCasterSlots ?? (details.face?.size ? [...slots].filter(([,role])=>['hair','cloth','leather'].includes(role)).map(([i])=>i) : []);
    if(casters.some(i=>!Number.isInteger(i)||i<0||i>=a.count||slots.get(i)==='face'))throw new RangeError('Expected authored non-receiver face caster slots');
    const styled=new Map(),materials=[model.mesh.material].flat();let shadow,outline;
    try {
      if(mode==='endfield' && details.face?.size && casters.length) {
        try {
          shadow=createFaceKeyShadow(renderer,model.mesh,light,new Set(casters));
          if(shadow){details.faceKeyVisibility=shadow.visibility;shadow.setEnabled(false);}
        } catch(e){shadowFailure(a,e);}
      }
      for(const [index,role] of slots){
        const material=materials[index];
        if(!a.base.has(material))continue;
        const color = mode==='strinova' ? strinovaColor(a.base.get(material),material,role,model.mesh,details.hair?.get(index)) :
          endfieldColor(a.input.get(material),a.base.get(material),material,role,model.mesh,details,index);
        styled.set(material,color);
      }
      if(!styled.size){shadow?.dispose();return false;}
      if(mode==='endfield' && a.bake)outline=installOutline(model.mesh,a.bake,{enabled:false});
    } catch(e){outline?.dispose();shadow?.dispose();throw e;}
    a.styles.set(mode,styled);
    if(mode==='endfield'){a.shadow=shadow;a.outline=outline;a.smoothOutline=details.smoothOutline!==false;}
    return true;
  }
  function retire(model){
    const a=actors.get(model);if(!a)return;
    setStyle(model,'mmd');a.outline?.dispose();a.shadow?.dispose();actors.delete(model);
  }
  return {
    loadOptions: pipeline.createModelLoadOptions(),
    attach(model, options, detailMaps) {
      // Validate against authored slots before the fork replaces materials and
      // appends outline slots. The stage discovers these separately per actor.
      const source = model.mesh.material, count = Array.isArray(source) ? source.length : 1;
      const slots=detailMaps?.hybridSlots ? parseHybridSlots(detailMaps.hybridSlots,true) : defaultSlots;
      const canStyle=endfield||!!detailMaps?.hybridSlots;
      for (const i of slots.keys()) {
        if (i >= count) throw new RangeError(`Hybrid PMX slot ${i} outside authored slot count ${count}`);
      }
      const skin = canStyle && detailMaps?.skinLighting!==false ? [...slots.keys()].filter(i=>slots.get(i)==='skin') : [];
      let thinSkin=false,bake=null,styleReady=true;
      try {
        thinSkin=skin.length>0 && prepareSkinTransmission(model.mesh,skin)>0;
        if(canStyle&&slots.size&&detailMaps?.smoothOutline!==false)bake=prepareOutline(model.mesh,slots,{pmxBytes:detailMaps?.pmxBytes});
      } catch(e){
        // In the switchable stage these are optional attributes, not a reason
        // to discard a valid PMX. The research probe, however, must report it.
        if(endfield)throw e;
        styleReady=false;
      }
      const attached = pipeline.attach(model, options);
      // Slot identities were captured before TSL attach; the replacement
      // material carries PMX metadata but has an empty Three material name.
      if(attached){const draws=[model.mesh.material].flat();
        for(const [i,m] of [source].flat().entries())draws[i].name=m.name;
      }
      // r187 adds layer 1 to its left eye. The fork's optional shadow-only
      // geometry uses that same layer and draws an untextured white silhouette
      // in the color pass. This adapter has no dedicated XR shadow pass.
      if (attached && renderer.xr.enabled && !(options?.selfShadowEnabled ?? options?.selfShadow)) disposeMmdTslShadowCaster(model.mesh);
      if (attached && (stageEdits || balancedModelColor || slots.size)) {
        const base=new Map(),input=new Map();
        for (const [index, material] of [model.mesh.material].flat().entries()) {
          // Only fork toon surfaces have these uniforms. Appended edges use a
          // different material; opacityNode, alpha test and depth stay loader-owned.
          if (!material.userData.mmdTslMaterialUniforms) continue;
          let original = material.colorNode;
          if (stageEdits) original = editableStageColor(model.mesh, material, balancedModelColor, ambientIntensity);
          else if (balancedModelColor) material.colorNode = balancedToonColor(original, .76 + .34 * Math.min(3, Math.max(0, ambientIntensity)));
          if (!canStyle && slots.has(index)) {
            const pigment=mmdStylePigment(material), mmd=material.colorNode;
            material.colorNode=pigment.resolve(hybridToonColor(mmd,actorKeyLight(material),slots.get(index),pigment.paint),mmd);
          }
          if (canStyle && slots.has(index)) {
            base.set(material,material.colorNode);
            // On the stage return to its actual user-selected MMD grade. The
            // candidate itself uses the same loader input as the portrait.
            input.set(material,endfield?material.colorNode:original);
          }
        }
        if(canStyle)actors.set(model,{base,input,count,slots,bake,thinSkin,cast:true,endfieldReady:styleReady,styles:new Map(),mode:'mmd'});
        if(endfield && prepareStyle(model,detailMaps))setStyle(model,'endfield');
      }
      return attached;
    },
    prepareStyle,setStyle,
    setFaceCastersEnabled(model,on) {const a=actors.get(model);if(a&&!a.shadowFailed){a.cast=!!on;a.shadow?.setEnabled(a.mode==='endfield'&&a.cast);}},
    prepare(scene,afterMaterialSync) {
      const ready=pipeline.prepareRender(scene);
      afterMaterialSync?.();
      if (ready) for (const a of actors.values()) if(a.mode==='endfield'&&a.cast&&a.shadow){
        try {a.shadow.prepare();} catch(e){shadowFailure(a,e);}
      }
      return ready;
    },
    detach(model) {
      retire(model);return pipeline.detach(model);
    },
    dispose() {
      for(const model of actors.keys())retire(model);pipeline.dispose();
    },
  };
}
