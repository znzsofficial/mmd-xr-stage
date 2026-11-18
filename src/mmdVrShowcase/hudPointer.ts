import { MeshBasicMaterial } from "three";

// XR supplies the intersection transform, visibility and opacity. Draw both
// edges on its existing cursor quad so the hit test and draw count stay intact.
class HudReticleMaterial extends MeshBasicMaterial {
  constructor() {
    super({ transparent: true, toneMapped: false, fog: false, depthWrite: false });
  }
  override onBeforeCompile(shader: Parameters<MeshBasicMaterial["onBeforeCompile"]>[0]) {
    shader.vertexShader = "varying vec2 vAim;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvAim = position.xy * 2.0;");
    shader.fragmentShader = "varying vec2 vAim;\n" + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float r = length(vAim);
      float edge = clamp(fwidth(r), 0.008, 0.12);
      diffuseColor.a *= smoothstep(0.38-edge,0.38+edge,r) * (1.0-smoothstep(0.92-edge,0.92+edge,r));
      diffuseColor.rgb = mix(vec3(1.), vec3(0.009, 0.022, 0.052), smoothstep(0.64-edge,0.64+edge,r));`);
  }
}

export const HUD_RAY = {
  rayModel: { color: "#79baff", opacity: 0.84, size: 0.007, maxLength: 2.3 },
  cursorModel: { materialClass: HudReticleMaterial, opacity: 1, size: 0.039, renderOrder: 100 },
};
