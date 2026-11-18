import type { MeshStandardMaterial } from 'three';
import { CLASS_SUN, ROOM } from './ClassroomLayout';

// Approximate light bounced from the window wall, without putting another
// scene light on the imported character. For the shadowless Quest profile the
// same window projection used on the parquet also crosses books and desktops.
// One interpolant, no shadow sampler and no runtime uniforms/updates.
type Shader = Parameters<MeshStandardMaterial['onBeforeCompile']>[0];
function windowLight(shader: Shader, project: boolean) {
  const [x,y,z] = CLASS_SUN;
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
    float indirect = .12 + (.20+.23*lift+.17*facingWindow)*skyView;
    reflectedLight.indirectDiffuse += diffuseColor.rgb * mix(vec3(1.00,.91,.75),vec3(.88,.96,1.),skyView)*indirect;
    ${project ? `
      float ray = (roomPos.x+${ROOM.w / 2})/${(-x).toFixed(3)};
      float wy = roomPos.y+ray*${y.toFixed(3)}, wz = roomPos.z+ray*${z.toFixed(3)};
      float bay = mod(wz+${ROOM.d / 2}, ${ROOM.d/ROOM.bays});
      float panes = smoothstep(.11,.21,bay)*(1.-smoothstep(${ROOM.d/ROOM.bays-.13},${ROOM.d/ROOM.bays-.04},bay));
      panes *= smoothstep(.016,.064,abs(bay-${ROOM.d/ROOM.bays/2}));
      float sunlit = panes * smoothstep(${ROOM.sill+.04},${ROOM.sill+.12},wy)*(1.-smoothstep(${ROOM.lintel-.06},${ROOM.lintel+.02},wy));
      sunlit *= smoothstep(.018,.068,abs(wy-${ROOM.transom}))*step(0.,ray)*(1.-smoothstep(${ROOM.d/2-.10},${ROOM.d/2},abs(wz)));
      float incidence = max(0.,dot(normal,mat3(viewMatrix)*normalize(vec3(${CLASS_SUN.map(n => n.toFixed(3)).join(',')}))));
      reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.,.84,.57)*(sunlit*incidence*1.5);
    ` : ''}`);
}

// Three uses the compile function as part of its material program key; keep
// the baked-projection and real-shadow variants distinct even after minifying.
export const classroomBounce = (shader: Shader) => windowLight(shader, false);
export const classroomSunlight = (shader: Shader) => windowLight(shader, true);
