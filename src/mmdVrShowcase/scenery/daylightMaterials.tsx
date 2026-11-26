import {createContext,useContext,type ComponentType} from 'react';
import type {ThreeElements} from '@react-three/fiber';

// TSL stays out of the WebGL entry. Geometry, baked maps and instance colors
// are identical on both backends; only the daylight shader differs.
export type DaySurfaceProps=Pick<ThreeElements['meshStandardMaterial'],'map'|'color'|'roughness'|'side'|'vertexColors'|'onBeforeCompile'>;
export type DaySkyProps={sun:[number,number,number];warm:boolean};
export type SceneShaderProps=ThreeElements['shaderMaterial'] & {effect:string};
export const DaylightMaterials=createContext<{Surface:ComponentType<DaySurfaceProps>;Sky:ComponentType<DaySkyProps>;Shader:ComponentType<SceneShaderProps>}|null>(null);
export function RoomShader({effect,...props}:SceneShaderProps){
  const backend=useContext(DaylightMaterials);
  return backend?<backend.Shader effect={effect} {...props}/>:<shaderMaterial {...props}/>;
}
export function DaySurface(props:DaySurfaceProps){
  const backend=useContext(DaylightMaterials);
  return backend?<backend.Surface {...props}/>:<meshStandardMaterial {...props}/>;
}
