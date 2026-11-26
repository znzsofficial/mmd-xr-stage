import { MeshBasicNodeMaterial } from 'three/webgpu';
import { fwidth, materialOpacity, mix, positionLocal, smoothstep, vec3 } from 'three/tsl';
import { HUD_RAY } from '../../src/mmdVrShowcase/hud/hudPointer';

// Same two meshes, dimensions and hit testing as the game. The WebGL cursor
// and XR's stock beam paint with onBeforeCompile, which WebGPU never executes.
class Cursor extends MeshBasicNodeMaterial {
  constructor(){
    super({transparent:true,toneMapped:false,fog:false,depthWrite:false});
    const r=positionLocal.xy.mul(2).length(), w=fwidth(r).clamp(.008,.12);
    const edge=n=>smoothstep(w.negate().add(n),w.add(n),r);
    this.colorNode=mix(vec3(1),vec3(.009,.022,.052),edge(.64));
    this.opacityNode=materialOpacity.mul(edge(.38)).mul(edge(.92).oneMinus());
  }
}
class Beam extends MeshBasicNodeMaterial {
  constructor(){
    super({transparent:true,toneMapped:false});
    this.opacityNode=materialOpacity.mul(positionLocal.z.add(.5));
  }
}
export const gameHudRay={rayModel:{...HUD_RAY.rayModel,materialClass:Beam},cursorModel:{...HUD_RAY.cursorModel,materialClass:Cursor}};
