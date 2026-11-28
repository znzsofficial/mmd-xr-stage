import type { MeshStandardMaterial } from 'three';
import { CLERESTORY, ROOM } from './ClassroomLayout';
import { SHORE_SUN } from './shoreDaylight';

// Approximate light bounced from the window wall, without putting another
// scene light on the imported character. For the shadowless Quest profile the
// same window projection used on the parquet also crosses books and desktops.
// One interpolant, no shadow sampler and no runtime uniforms/updates.
type Shader = Parameters<MeshStandardMaterial['onBeforeCompile']>[0];
function windowLight(shader: Shader, project: boolean) {
  const [x,y,z] = SHORE_SUN;
  const high=CLERESTORY;
  shader.vertexShader = 'varying vec3 vClassPosition;\n' + shader.vertexShader.replace('#include <project_vertex>', `
    vec4 classLocal = vec4(transformed, 1.);
    #ifdef USE_INSTANCING
      classLocal = instanceMatrix * classLocal;
    #endif
    vClassPosition = (modelMatrix * classLocal).xyz;
    #include <project_vertex>`);
  shader.fragmentShader = 'varying vec3 vClassPosition;\n' + shader.fragmentShader.replace('#include <lights_fragment_end>', `
    #include <lights_fragment_end>
    vec3 roomPos = vClassPosition;
    float skyView = 1.-smoothstep(-${ROOM.w / 2}, ${ROOM.w / 2}, roomPos.x);
    float lift = smoothstep(.0, 1.6, roomPos.y);
    float facingWindow = max(0., dot(normal, mat3(viewMatrix) * vec3(-.94,.34,0.)));
    float indirect = .075 + (.16+.16*lift+.13*facingWindow)*skyView;
    reflectedLight.indirectDiffuse += diffuseColor.rgb * mix(vec3(1.00,.91,.75),vec3(.88,.96,1.),skyView)*indirect;
    ${project ? `
      float ray = (roomPos.z-(${high.z.toFixed(3)}))/${(-z).toFixed(3)};
      vec2 hit = roomPos.xy + ray*vec2(${x.toFixed(3)},${y.toFixed(3)});
      float offset = hit.x-(${high.left}), bay = mod(offset,${high.pitch.toFixed(3)});
      float pane = smoothstep(${high.pier/2},${high.pier/2+.055},min(bay,${high.pitch.toFixed(3)}-bay));
      pane *= step(0.,offset)*step(offset,${(high.count*high.pitch).toFixed(3)})*step(0.,ray);
      pane *= smoothstep(${high.sill},${high.sill+.055},hit.y)*(1.-smoothstep(${high.head-.055},${high.head},hit.y));
      float incidence = max(0.,dot(normal,mat3(viewMatrix)*normalize(vec3(${SHORE_SUN.map(n => n.toFixed(3)).join(',')}))));
      reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.,.86,.66)*(pane*incidence*1.3);
    ` : ''}`);
}

// Three uses the compile function as part of its material program key; keep
// the baked-projection and real-shadow variants distinct even after minifying.
export const classroomBounce = (shader: Shader) => windowLight(shader, false);
export const classroomSunlight = (shader: Shader) => windowLight(shader, true);
