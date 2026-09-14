import * as THREE from "three";
import { cubeUvDefines } from "./mmdEnvMap";
import type { MaterialOverride } from "./mmdRuntimeMaterials";

export type MmdMaterialEnhanceState = {
  modelId: string;
  materialName: string;
  override: MaterialOverride;
  envIntensity: number;
  /** Scene ambient light — MMD MeshToon ignores THREE.AmbientLight; inject here. */
  ambientIntensity: number;
  /** PMREM CubeUV env map (from sky). */
  envMap?: THREE.Texture | null;
  /** Directional light direction in world space (surface → light). */
  lightDirection?: THREE.Vector3 | null;
  /** Directional light intensity (0 when sun off). */
  lightIntensity?: number;
  lightColor?: THREE.Color | null;
};

const PARS_MARKER = "#include <map_pars_fragment>";
const INJECT_MARKER = "outgoingLight = ywMmdGammaToLinear( clamp( ywMmdColor, 0.0, 1.0 ) );";

type EnhanceShader = {
  uniforms: Record<string, { value: unknown }>;
};

function hexToLinearColor(hex: string) {
  const color = new THREE.Color(hex || "#ffffff");
  return color.convertSRGBToLinear();
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const ENHANCE_SHADER_REV = "v8-ibl-fix";

/** Self-contained CubeUV PMREM sampling (subset of three's cube_uv_reflection_fragment). */
const CUBE_UV_HELPERS = `
#ifndef YW_MMD_CUBE_UV
#define YW_MMD_CUBE_UV
#define ywCubeUV_minMipLevel 4.0
#define ywCubeUV_minTileSize 16.0
float ywGetFace( vec3 direction ) {
  vec3 absDirection = abs( direction );
  float face = -1.0;
  if ( absDirection.x > absDirection.z ) {
    if ( absDirection.x > absDirection.y ) face = direction.x > 0.0 ? 0.0 : 3.0;
    else face = direction.y > 0.0 ? 1.0 : 4.0;
  } else {
    if ( absDirection.z > absDirection.y ) face = direction.z > 0.0 ? 2.0 : 5.0;
    else face = direction.y > 0.0 ? 1.0 : 4.0;
  }
  return face;
}
vec2 ywGetUV( vec3 direction, float face ) {
  vec2 uv;
  if ( face == 0.0 ) uv = vec2( direction.z, direction.y ) / abs( direction.x );
  else if ( face == 1.0 ) uv = vec2( -direction.x, -direction.z ) / abs( direction.y );
  else if ( face == 2.0 ) uv = vec2( -direction.x, direction.y ) / abs( direction.z );
  else if ( face == 3.0 ) uv = vec2( -direction.z, direction.y ) / abs( direction.x );
  else if ( face == 4.0 ) uv = vec2( -direction.x, direction.z ) / abs( direction.y );
  else uv = vec2( direction.x, direction.y ) / abs( direction.z );
  return 0.5 * ( uv + 1.0 );
}
vec3 ywBilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
  float face = ywGetFace( direction );
  float filterInt = max( ywCubeUV_minMipLevel - mipInt, 0.0 );
  mipInt = max( mipInt, ywCubeUV_minMipLevel );
  float faceSize = exp2( mipInt );
  highp vec2 uv = ywGetUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
  if ( face > 2.0 ) {
    uv.y += faceSize;
    face -= 3.0;
  }
  uv.x += face * faceSize;
  uv.x += filterInt * 3.0 * ywCubeUV_minTileSize;
  uv.y += 4.0 * ( exp2( mmdEnhanceCubeMaxMip ) - faceSize );
  uv.x *= mmdEnhanceCubeTexelW;
  uv.y *= mmdEnhanceCubeTexelH;
  return texture2D( envMap, uv ).rgb;
}
float ywRoughnessToMip( float roughness ) {
  float mip = 0.0;
  if ( roughness >= 0.8 ) mip = ( 1.0 - roughness ) * ( -1.0 - ( -2.0 ) ) / ( 1.0 - 0.8 ) + ( -2.0 );
  else if ( roughness >= 0.4 ) mip = ( 0.8 - roughness ) * ( 2.0 - ( -1.0 ) ) / ( 0.8 - 0.4 ) + ( -1.0 );
  else if ( roughness >= 0.305 ) mip = ( 0.4 - roughness ) * ( 3.0 - 2.0 ) / ( 0.4 - 0.305 ) + 2.0;
  else if ( roughness >= 0.21 ) mip = ( 0.305 - roughness ) * ( 4.0 - 3.0 ) / ( 0.305 - 0.21 ) + 3.0;
  else mip = -2.0 * log2( 1.16 * max( roughness, 1e-4 ) );
  return mip;
}
vec3 ywTextureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
  float mip = clamp( ywRoughnessToMip( roughness ), -2.0, mmdEnhanceCubeMaxMip );
  float mipF = fract( mip );
  float mipInt = floor( mip );
  vec3 color0 = ywBilinearCubeUV( envMap, sampleDir, mipInt );
  if ( mipF == 0.0 ) return color0;
  vec3 color1 = ywBilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
  return mix( color0, color1, mipF );
}
#endif
`;

export function attachMmdMaterialEnhance(material: THREE.Material) {
  const typed = material as THREE.MeshToonMaterial & {
    userData: Record<string, unknown>;
  };
  if (typed.userData.mmdEnhanceAttached === ENHANCE_SHADER_REV) return;

  if (typed.userData.mmdEnhanceBaseDepthWrite == null) {
    typed.userData.mmdEnhanceBaseDepthWrite = typed.depthWrite;
  }
  if (typed.userData.mmdEnhanceBaseTransparent == null) {
    typed.userData.mmdEnhanceBaseTransparent = typed.transparent;
  }

  // Keep the pre-enhance hooks so rev bumps do not stack onBeforeCompile wrappers.
  if (typeof typed.userData.mmdEnhanceOriginalOnBeforeCompile !== "function") {
    typed.userData.mmdEnhanceOriginalOnBeforeCompile = typed.onBeforeCompile.bind(typed);
    typed.userData.mmdEnhanceOriginalCacheKey = typed.customProgramCacheKey.bind(typed);
  }
  const prev = typed.userData.mmdEnhanceOriginalOnBeforeCompile as (
    shader: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer,
  ) => void;
  const prevKey = typed.userData.mmdEnhanceOriginalCacheKey as () => string;

  typed.userData.mmdEnhanceAttached = ENHANCE_SHADER_REV;

  typed.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    const uniforms = shader.uniforms as Record<string, { value: unknown }>;
    uniforms.mmdEnhanceOpacity = { value: 1 };
    uniforms.mmdEnhanceMetallic = { value: 0 };
    uniforms.mmdEnhanceRoughness = { value: 0.55 };
    uniforms.mmdEnhanceOcclusion = { value: 1 };
    uniforms.mmdEnhanceEmission = { value: 0 };
    uniforms.mmdEnhanceEmissionColor = { value: new THREE.Color("#ffffff").convertSRGBToLinear() };
    uniforms.mmdEnhanceEnvInfluence = { value: 0 };
    uniforms.mmdEnhanceAmbient = { value: 0.55 };
    uniforms.mmdEnhanceSpecularMode = { value: 0 };
    uniforms.mmdEnhanceLightingModel = { value: 0 };
    uniforms.mmdEnhanceHasAoMap = { value: 0 };
    uniforms.mmdEnhanceHasEmissionMap = { value: 0 };
    uniforms.mmdEnhanceHasMaskMap = { value: 0 };
    uniforms.mmdEnhanceAoMap = { value: null };
    uniforms.mmdEnhanceEmissionMap = { value: null };
    uniforms.mmdEnhanceMaskMap = { value: null };
    uniforms.mmdEnhanceEnvMap = { value: null };
    uniforms.mmdEnhanceHasEnvMap = { value: 0 };
    uniforms.mmdEnhanceCubeMaxMip = { value: 8 };
    uniforms.mmdEnhanceCubeTexelW = { value: 1 / 256 };
    uniforms.mmdEnhanceCubeTexelH = { value: 1 / 256 };
    uniforms.mmdEnhanceLightDir = { value: new THREE.Vector3(0.4, 1, 0.2).normalize() };
    uniforms.mmdEnhanceLightColor = { value: new THREE.Color(1, 1, 1) };
    uniforms.mmdEnhanceLightIntensity = { value: 1 };

    typed.userData.mmdEnhanceShader = shader as EnhanceShader;
    if (!typed.userData.mmdMaterialFactorShader) {
      typed.userData.mmdMaterialFactorShader = shader;
    }
    const currentState = typed.userData.mmdEnhanceState as MmdMaterialEnhanceState | undefined;
    if (currentState) syncMmdMaterialEnhance(typed, currentState);

    shader.fragmentShader = shader.fragmentShader.replace(
      PARS_MARKER,
      [
        PARS_MARKER,
        "uniform float mmdEnhanceOpacity;",
        "uniform float mmdEnhanceMetallic;",
        "uniform float mmdEnhanceRoughness;",
        "uniform float mmdEnhanceOcclusion;",
        "uniform float mmdEnhanceEmission;",
        "uniform vec3 mmdEnhanceEmissionColor;",
        "uniform float mmdEnhanceEnvInfluence;",
        "uniform float mmdEnhanceAmbient;",
        "uniform float mmdEnhanceSpecularMode;",
        "uniform float mmdEnhanceLightingModel;",
        "uniform float mmdEnhanceHasAoMap;",
        "uniform float mmdEnhanceHasEmissionMap;",
        "uniform float mmdEnhanceHasMaskMap;",
        "uniform sampler2D mmdEnhanceAoMap;",
        "uniform sampler2D mmdEnhanceEmissionMap;",
        "uniform sampler2D mmdEnhanceMaskMap;",
        "uniform sampler2D mmdEnhanceEnvMap;",
        "uniform float mmdEnhanceHasEnvMap;",
        "uniform float mmdEnhanceCubeMaxMip;",
        "uniform float mmdEnhanceCubeTexelW;",
        "uniform float mmdEnhanceCubeTexelH;",
        "uniform vec3 mmdEnhanceLightDir;",
        "uniform vec3 mmdEnhanceLightColor;",
        "uniform float mmdEnhanceLightIntensity;",
        CUBE_UV_HELPERS,
      ].join("\n"),
    );

    if (!shader.fragmentShader.includes(INJECT_MARKER)) return;

    shader.fragmentShader = shader.fragmentShader.replace(
      INJECT_MARKER,
      [
        "  vec3 ywMmdEnhanceBaseColor = ywMmdColor;",
        "  vec3 ywMmdEnhanceEmissionColor = mmdEnhanceEmissionColor * mmdEnhanceEmission;",
        "  float ywMmdEnhanceRoughness = clamp( mmdEnhanceRoughness, 0.04, 1.0 );",
        "  float ywMmdEnhanceMetallic = clamp( mmdEnhanceMetallic, 0.0, 1.0 );",
        "  float ywMmdEnhanceOcclusion = clamp( mmdEnhanceOcclusion, 0.0, 1.0 );",
        "  float ywMmdEnhanceEnv = clamp( mmdEnhanceEnvInfluence, 0.0, 4.0 );",
        "  vec3 ywMmdEnhanceViewDir = normalize( -vViewPosition );",
        "  float ywMmdEnhanceNdotV = max( 0.0, dot( ywMmdNormal, ywMmdEnhanceViewDir ) );",
        "  float ywMmdEnhanceFresnel = pow( 1.0 - ywMmdEnhanceNdotV, mix( 5.0, 2.0, ywMmdEnhanceMetallic ) );",
        "  #ifdef USE_MAP",
        "    vec2 ywMmdEnhanceUv = vMapUv;",
        "  #else",
        "    vec2 ywMmdEnhanceUv = vec2( 0.5 );",
        "  #endif",
        // AO / mask / emission maps only need UVs; do not require USE_MAP (albedo).
        "  if ( mmdEnhanceHasMaskMap > 0.5 ) {",
        "    float ywMmdMask = texture2D( mmdEnhanceMaskMap, ywMmdEnhanceUv ).r;",
        "    ywMmdEnhanceOcclusion *= ywMmdMask;",
        "    ywMmdEnhanceEnv *= mix( 0.35, 1.0, ywMmdMask );",
        "  }",
        "  if ( mmdEnhanceHasAoMap > 0.5 ) {",
        "    float ywMmdAo = texture2D( mmdEnhanceAoMap, ywMmdEnhanceUv ).r;",
        "    ywMmdEnhanceOcclusion *= ywMmdAo;",
        "  }",
        "  if ( mmdEnhanceHasEmissionMap > 0.5 ) {",
        "    vec3 ywMmdEmissionTex = texture2D( mmdEnhanceEmissionMap, ywMmdEnhanceUv ).rgb;",
        "    ywMmdEnhanceEmissionColor *= ywMmdEmissionTex;",
        "  }",
        // Ambient lift for MeshToon (scene AmbientLight is ignored).
        "  float ywMmdAmb = clamp( mmdEnhanceAmbient, 0.0, 3.0 );",
        "  ywMmdColor *= mix( 1.0, ywMmdEnhanceOcclusion, 0.35 );",
        "  ywMmdColor = ywMmdColor * ( 0.72 + ywMmdAmb * 0.55 ) + ywMmdEnhanceBaseColor * ywMmdAmb * 0.22;",
        "  ywMmdColor += ywMmdEnhanceEmissionColor * ( 0.5 + mmdEnhanceEmission );",
        "  vec3 ywMmdF0 = mix( vec3( 0.04 ), ywMmdEnhanceBaseColor, ywMmdEnhanceMetallic );",
        "  vec3 ywMmdDiffuseCol = ywMmdEnhanceBaseColor * ( 1.0 - ywMmdEnhanceMetallic );",
        // --- IBL from PMREM CubeUV ---
        "  vec3 ywMmdIblDiffuse = vec3( 0.0 );",
        "  vec3 ywMmdIblSpecular = vec3( 0.0 );",
        "  if ( mmdEnhanceHasEnvMap > 0.5 && ywMmdEnhanceEnv > 0.001 && mmdEnhanceSpecularMode > 0.5 ) {",
        // view-space → world-space (column-major inverse view)
        "    vec3 ywWorldN = normalize( ( inverse( viewMatrix ) * vec4( ywMmdNormal, 0.0 ) ).xyz );",
        "    vec3 ywViewW = normalize( ( inverse( viewMatrix ) * vec4( ywMmdEnhanceViewDir, 0.0 ) ).xyz );",
        "    vec3 ywReflW = reflect( -ywViewW, ywWorldN );",
        "    ywReflW = normalize( mix( ywReflW, ywWorldN, ywMmdEnhanceRoughness * ywMmdEnhanceRoughness ) );",
        "    ywMmdIblDiffuse = ywTextureCubeUV( mmdEnhanceEnvMap, ywWorldN, 1.0 ) * ywMmdEnhanceEnv * 0.35;",
        "    ywMmdIblSpecular = ywTextureCubeUV( mmdEnhanceEnvMap, ywReflW, ywMmdEnhanceRoughness ) * ywMmdEnhanceEnv;",
        "    vec3 ywFresnelEnv = ywMmdF0 + ( max( vec3( 1.0 - ywMmdEnhanceRoughness ), ywMmdF0 ) - ywMmdF0 ) * ywMmdEnhanceFresnel;",
        "    ywMmdIblSpecular *= ywFresnelEnv;",
        "    ywMmdIblDiffuse *= ywMmdDiffuseCol * ywMmdEnhanceOcclusion;",
        "  }",
        // --- Directional GGX (lightingModel pbr) ---
        "  vec3 ywMmdDirSpec = vec3( 0.0 );",
        "  vec3 ywMmdDirDiff = vec3( 0.0 );",
        "  if ( mmdEnhanceLightingModel > 0.5 && mmdEnhanceLightIntensity > 0.0001 ) {",
        "    vec3 ywL = normalize( ( viewMatrix * vec4( mmdEnhanceLightDir, 0.0 ) ).xyz );",
        "    vec3 ywH = normalize( ywMmdEnhanceViewDir + ywL );",
        "    float ywNdotL = max( 0.0, dot( ywMmdNormal, ywL ) );",
        "    float ywNdotH = max( 0.0, dot( ywMmdNormal, ywH ) );",
        "    float ywNdotV2 = max( 0.001, ywMmdEnhanceNdotV );",
        "    float ywA = ywMmdEnhanceRoughness * ywMmdEnhanceRoughness;",
        "    float ywA2 = ywA * ywA;",
        "    float ywDDenom = ( ywNdotH * ywNdotH * ( ywA2 - 1.0 ) + 1.0 );",
        "    float ywD = ywA2 / max( 3.14159265 * ywDDenom * ywDDenom, 1e-6 );",
        "    float ywK = ( ywMmdEnhanceRoughness + 1.0 ) * ( ywMmdEnhanceRoughness + 1.0 ) / 8.0;",
        "    float ywG1V = ywNdotV2 / ( ywNdotV2 * ( 1.0 - ywK ) + ywK );",
        "    float ywG1L = ywNdotL / ( ywNdotL * ( 1.0 - ywK ) + ywK + 1e-6 );",
        "    float ywG = ywG1V * ywG1L;",
        "    vec3 ywF = ywMmdF0 + ( 1.0 - ywMmdF0 ) * pow( 1.0 - max( 0.0, dot( ywH, ywMmdEnhanceViewDir ) ), 5.0 );",
        "    vec3 ywSpec = ( ywD * ywG * ywF ) / max( 4.0 * ywNdotV2 * max( ywNdotL, 0.001 ), 1e-4 );",
        "    vec3 ywLight = mmdEnhanceLightColor * mmdEnhanceLightIntensity * ywNdotL;",
        "    ywMmdDirSpec = ywSpec * ywLight;",
        "    ywMmdDirDiff = ywMmdDiffuseCol * ywLight * ( 1.0 / 3.14159265 ) * 0.65;",
        "  }",
        "  if ( mmdEnhanceSpecularMode < 0.5 ) {",
        "    if ( mmdEnhanceLightingModel > 0.5 ) {",
        "      ywMmdColor = mix( ywMmdColor, ywMmdDiffuseCol * ( 0.55 + ywMmdAmb * 0.35 ), 0.35 );",
        "      ywMmdColor += ywMmdDirDiff * 0.55 + ywMmdDirSpec;",
        "    }",
        "  } else if ( mmdEnhanceSpecularMode < 1.5 ) {",
        "    ywMmdColor += ywMmdIblDiffuse + ywMmdIblSpecular;",
        "    if ( mmdEnhanceLightingModel > 0.5 ) {",
        "      ywMmdColor = mix( ywMmdColor, ywMmdColor * 0.92 + ywMmdDirDiff, 0.4 );",
        "      ywMmdColor += ywMmdDirSpec;",
        "    } else {",
        "      ywMmdColor += ywMmdIblSpecular * 0.15 * ( 1.0 - ywMmdEnhanceRoughness );",
        "    }",
        "  } else {",
        "    vec3 ywEnvLit = ywMmdDiffuseCol * ( 0.25 + ywMmdAmb * 0.35 ) + ywMmdIblDiffuse + ywMmdIblSpecular;",
        "    if ( mmdEnhanceLightingModel > 0.5 ) ywEnvLit += ywMmdDirDiff + ywMmdDirSpec;",
        "    ywMmdColor = mix( ywMmdEnhanceBaseColor * ( 0.55 + ywMmdAmb * 0.4 ), ywEnvLit, 0.92 );",
        "  }",
        // Keep HDR headroom for tone mapping; only floor at 0.
        "  outgoingLight = ywMmdGammaToLinear( max( ywMmdColor, vec3( 0.0 ) ) );",
      ].join("\n"),
    );
  };

  typed.customProgramCacheKey = () => `${prevKey()}-yw-mmd-enhance-${ENHANCE_SHADER_REV}`;
  typed.needsUpdate = true;
}

const _lightDir = new THREE.Vector3();
const _lightColor = new THREE.Color(1, 1, 1);

export function syncMmdMaterialEnhance(material: THREE.Material, state: MmdMaterialEnhanceState) {
  const mat = material as THREE.MeshToonMaterial;
  mat.userData.mmdEnhanceState = state;
  const shader = (mat.userData.mmdEnhanceShader ?? mat.userData.mmdMaterialFactorShader) as EnhanceShader | undefined;
  if (!shader?.uniforms) return;

  const override = state.override;
  const opacity = clampRange(override.opacity, 0, 1);
  const metallic = clamp01(override.metallic);
  const roughness = clamp01(override.roughness);
  const occlusion = clamp01(override.occlusion);
  const emission = Math.max(0, override.emission);
  const envInfluence = Math.max(0, override.envInfluence) * Math.max(0, state.envIntensity);
  const ambient = Math.max(0, state.ambientIntensity);
  const specularMode = override.specularMode === "env" ? 2 : override.specularMode === "mmd+env" ? 1 : 0;
  const lightingModel = override.lightingModel === "pbr" ? 1 : 0;
  const emissionColor = hexToLinearColor(override.emissionColor);
  const enhancementData = mat.userData.mmdEnhanceTextures as {
    aoMap?: THREE.Texture | null;
    emissionMap?: THREE.Texture | null;
    maskMap?: THREE.Texture | null;
  } | undefined;

  const setNum = (key: string, value: number) => {
    const uniform = shader.uniforms[key];
    if (uniform) uniform.value = value;
  };
  setNum("mmdEnhanceOpacity", opacity);
  setNum("mmdEnhanceMetallic", metallic);
  setNum("mmdEnhanceRoughness", roughness);
  setNum("mmdEnhanceOcclusion", occlusion);
  setNum("mmdEnhanceEmission", emission);
  setNum("mmdEnhanceEnvInfluence", envInfluence);
  setNum("mmdEnhanceAmbient", ambient);
  setNum("mmdEnhanceSpecularMode", specularMode);
  setNum("mmdEnhanceLightingModel", lightingModel);

  const emissionColorUniform = shader.uniforms.mmdEnhanceEmissionColor;
  if (emissionColorUniform?.value instanceof THREE.Color) emissionColorUniform.value.copy(emissionColor);

  if (shader.uniforms.mmdEnhanceAoMap) shader.uniforms.mmdEnhanceAoMap.value = enhancementData?.aoMap ?? null;
  if (shader.uniforms.mmdEnhanceEmissionMap) {
    shader.uniforms.mmdEnhanceEmissionMap.value = enhancementData?.emissionMap ?? null;
  }
  if (shader.uniforms.mmdEnhanceMaskMap) shader.uniforms.mmdEnhanceMaskMap.value = enhancementData?.maskMap ?? null;
  setNum("mmdEnhanceHasAoMap", enhancementData?.aoMap ? 1 : 0);
  setNum("mmdEnhanceHasEmissionMap", enhancementData?.emissionMap ? 1 : 0);
  setNum("mmdEnhanceHasMaskMap", enhancementData?.maskMap ? 1 : 0);

  const envMap = state.envMap ?? null;
  const useEnv = Boolean(envMap) && envInfluence > 0.0001 && specularMode > 0;
  if (shader.uniforms.mmdEnhanceEnvMap) shader.uniforms.mmdEnhanceEnvMap.value = useEnv ? envMap : null;
  setNum("mmdEnhanceHasEnvMap", useEnv ? 1 : 0);
  if (useEnv && envMap) {
    const defs = cubeUvDefines(envMap);
    setNum("mmdEnhanceCubeMaxMip", defs.maxMip);
    setNum("mmdEnhanceCubeTexelW", defs.texelWidth);
    setNum("mmdEnhanceCubeTexelH", defs.texelHeight);
  }

  if (state.lightDirection) {
    _lightDir.copy(state.lightDirection).normalize();
  } else {
    _lightDir.set(0.35, 0.9, 0.25).normalize();
  }
  const lightDirU = shader.uniforms.mmdEnhanceLightDir;
  if (lightDirU?.value instanceof THREE.Vector3) lightDirU.value.copy(_lightDir);

  if (state.lightColor) _lightColor.copy(state.lightColor);
  else _lightColor.setRGB(1, 1, 1);
  const lightColorU = shader.uniforms.mmdEnhanceLightColor;
  if (lightColorU?.value instanceof THREE.Color) lightColorU.value.copy(_lightColor);
  setNum("mmdEnhanceLightIntensity", Math.max(0, state.lightIntensity ?? 0));

  const baseTransparent = Boolean(mat.userData.mmdEnhanceBaseTransparent);
  const baseDepthWrite = mat.userData.mmdEnhanceBaseDepthWrite !== false;
  const nextTransparent = opacity < 1 || baseTransparent;
  const nextDepthWrite = opacity < 1 ? false : baseDepthWrite;
  if (mat.opacity !== opacity) mat.opacity = opacity;
  if (mat.transparent !== nextTransparent) mat.transparent = nextTransparent;
  if (mat.depthWrite !== nextDepthWrite) mat.depthWrite = nextDepthWrite;
}
