import { createMmdTslPipeline, disposeMmdTslShadowCaster } from '@yohawing/three-mmd-loader/webgpu';
import { max, sRGBTransferEOTF, sRGBTransferOETF } from 'three/tsl';
import { hybridToonColor, parseHybridSlots } from './hybridToon.js';
import { endfieldColor } from './endfieldToon.js';
import { prepareSkinTransmission } from './skinTransmission.js';
import { createFaceKeyShadow } from './faceKeyShadow.js';
import { prepareOutline, installOutline } from './endfieldOutline.js';

// Fork 3ac1d8e, webgpu/material-core.ts: the pipeline's colorNode returns
// EOTF(clamp(toon/sphere/specular composite, 0, 1)). Its public output cannot
// recover detail already clipped by that clamp. Grade the surviving RGB in the
// same gamma space as mmdMaterialEnhance.ts, before framebuffer blending.
function balancedToonColor(linear, ambientIntensity) {
  const ambient = Math.min(3, Math.max(0, ambientIntensity));
  const rgb = sRGBTransferOETF(linear).mul(0.76 + 0.34 * ambient);
  // Floor peak at the knee: the scale is exactly one below it (also at black).
  const peak = max(0.82, max(rgb.r, max(rgb.g, rgb.b)));
  const shoulder = peak.sub(0.82).mul(0.18).div(peak.sub(0.64)).add(0.82);
  return sRGBTransferEOTF(rgb.mul(shoulder.div(peak)));
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
export async function createActorMaterialAdapter(renderer, light, { balancedModelColor = false, ambientIntensity = 0.55, hybridSlots, endfield = false } = {}) {
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
    selfShadowEnabled: false, // The dedicated MMD shadow pass is degraded on r187.
  });
  function setStyle(model,enabled) {
    const a=actors.get(model);if(!a?.styled || a.enabled===enabled)return !!a?.styled;
    try {
      a.outline?.setEnabled(enabled && a.smoothOutline);
      a.shadow?.setEnabled(enabled && a.cast);
      for(const [material,color] of a.styled){material.colorNode=enabled?color:a.base.get(material);material.needsUpdate=true;}
    } catch(e){
      for(const [material,color] of a.base){material.colorNode=color;material.needsUpdate=true;}
      a.enabled=false;
      try {a.outline?.setEnabled(false);} finally {a.shadow?.setEnabled(false);}
      throw e;
    }
    a.enabled=enabled;
    return true;
  }
  function prepareStyle(model,maps={}) {
    const a=actors.get(model);if(!a?.slots.size || a.styled)return !!a?.styled;
    const {slots}=a;
    const details={...maps,thinSkin:a.thinSkin};
    const casters=details.faceCasterSlots ?? (details.face?.size ? [...slots].filter(([,role])=>['hair','cloth','leather'].includes(role)).map(([i])=>i) : []);
    if(casters.some(i=>!Number.isInteger(i)||i<0||i>=a.count||slots.get(i)==='face'))throw new RangeError('Expected authored non-receiver face caster slots');
    const styled=new Map(),materials=[model.mesh.material].flat();let shadow,outline;
    try {
      if(details.face?.size && casters.length) {
        try {
          shadow=createFaceKeyShadow(renderer,model.mesh,light,new Set(casters));
          if(shadow){details.faceKeyVisibility=shadow.visibility;shadow.setEnabled(false);}
        } catch(e){shadowFailure(a,e);}
      }
      for(const [index,role] of slots){
        const material=materials[index];
        if(a.base.has(material))styled.set(material,endfieldColor(a.input.get(material),material,role,model.mesh,details,index));
      }
      if(!styled.size){shadow?.dispose();return false;}
      if(a.bake)outline=installOutline(model.mesh,a.bake,{enabled:false});
    } catch(e){outline?.dispose();shadow?.dispose();throw e;}
    a.styled=styled;a.shadow=shadow;a.outline=outline;a.smoothOutline=details.smoothOutline!==false;
    return true;
  }
  function retire(model){
    const a=actors.get(model);if(!a)return;
    setStyle(model,false);a.outline?.dispose();a.shadow?.dispose();actors.delete(model);
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
      // r187 adds layer 1 to its left eye. The fork's optional shadow-only
      // geometry uses that same layer and draws an untextured white silhouette
      // in the color pass. This adapter has no dedicated XR shadow pass.
      if (attached && renderer.xr.enabled && !options?.selfShadowEnabled && !options?.selfShadow) disposeMmdTslShadowCaster(model.mesh);
      if (attached && (balancedModelColor || slots.size)) {
        const base=new Map(),input=new Map();
        for (const [index, material] of [model.mesh.material].flat().entries()) {
          // Only fork toon surfaces have these uniforms. Appended edges use a
          // different material; opacityNode, alpha test and depth stay loader-owned.
          if (!material.userData.mmdTslMaterialUniforms) continue;
          const original=material.colorNode;
          if (balancedModelColor) material.colorNode = balancedToonColor(material.colorNode, ambientIntensity);
          if (!canStyle && slots.has(index)) material.colorNode=hybridToonColor(material.colorNode,material,slots.get(index));
          if (canStyle && slots.has(index)) {
            base.set(material,material.colorNode);
            // On the stage return to its actual user-selected MMD grade. The
            // candidate itself uses the same loader input as the portrait.
            input.set(material,endfield?material.colorNode:original);
          }
        }
        if(canStyle&&styleReady)actors.set(model,{base,input,count,slots,bake,thinSkin,cast:true,enabled:false});
        if(endfield && prepareStyle(model,detailMaps))setStyle(model,true);
      }
      return attached;
    },
    prepareStyle,setStyle,
    setFaceCastersEnabled(model,on) {const a=actors.get(model);if(a&&!a.shadowFailed){a.cast=!!on;a.shadow?.setEnabled(a.enabled&&a.cast);}},
    prepare(scene) {
      const ready=pipeline.prepareRender(scene);
      if (ready) for (const a of actors.values()) if(a.enabled&&a.cast&&a.shadow){
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
