import React,{useEffect,useMemo} from 'react';
import {NodeMaterial,DataTexture} from 'three/webgpu';
import {uniform,texture,viewportSize} from 'three/tsl';
import * as programs from './roomPrograms.generated.js';

// The authored shaders already have a mapped/ready branch while a texture is
// being decoded. The GPU still requires a valid binding for that branch.
const empty=new DataTexture(new Uint8Array([0,0,0,255]),1,1);empty.needsUpdate=true;
export function SceneShader({effect,uniforms,defines,ref,vertexShader,fragmentShader,...props}){
  const key=effect==='mineral'&&defines?.HALITE?'mineralHalite':effect;
  const m=useMemo(()=>{
    const m=new NodeMaterial();m.name='room:'+key;m.fog=false;m.uniforms=uniforms??{};
    const read=(name,type)=>{
      if(key==='catalogue'&&name==='height')return viewportSize.y;
      const cell=m.uniforms[name];if(!cell)throw Error(`Missing ${key} uniform ${name}`);
      if(type==='sampler2D')return texture(cell.value??empty);
      return uniform(cell.value,cell.value?.isColor?'color':type).onRenderUpdate(()=>cell.value);
    };
    Object.assign(m,programs[key](read));return m;
  },[key,uniforms]);useEffect(()=>()=>m.dispose(),[m]);return <primitive object={m} attach="material" ref={ref} {...props}/>;
}
