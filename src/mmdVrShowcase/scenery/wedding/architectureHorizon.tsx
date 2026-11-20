import {useEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {BufferGeometry,Color,Float32BufferAttribute} from 'three';
import {noPick} from '../sceneryPaint';

// A distant Jiangnan ridgeline occupies only a few degrees above the roofline.
// Treat it like the day sky, not a wall cut in half by Quest's short far plane.
export function ArchitectureHorizon(){
  const scene=useThree(s=>s.scene);
  const view=useMemo(()=>{
    const p:number[]=[],c:number[]=[],id:number[]=[];
    const n=128;
    for(let i=0;i<=n;i++){
      const a=i/n*2*Math.PI,far=.061+.013*Math.sin(4*a)+.011*Math.cos(7*a)+.007*Math.sin(13*a+.24),near=.029+.008*Math.sin(6*a+.52)+.005*Math.cos(11*a);
      for(const [y,k] of [[-8,0],[-.013,0],[near,.47],[near,.16],[far,.25]]){p.push(Math.cos(a),y,Math.sin(a));c.push(k);}
      if(i<n)for(const row of [0,1,3]){const l=i*5+row,r=l+5;id.push(l,r,r+1,l,r+1,l+1);}
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('haze',new Float32BufferAttribute(c,1));g.setIndex(id);
    return {g,uniforms:{mist:{value:new Color('#e6d9c6')},hill:{value:new Color('#789396')}}};
  },[]);
  useEffect(()=>()=>view.g.dispose(),[view]);
  return <mesh name="wedding:mist-hills" geometry={view.g} raycast={noPick} renderOrder={-90} frustumCulled={false}
    onBeforeRender={()=>{if(scene.fog)view.uniforms.mist.value.copy(scene.fog.color);}}>
    <shaderMaterial uniforms={view.uniforms} depthWrite={false} depthTest={false}
      vertexShader={`attribute float haze;varying float h;void main(){h=haze;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=vec4(p.xy,0.,p.w);}`}
      fragmentShader={`varying float h;uniform vec3 mist,hill;void main(){gl_FragColor=vec4(mix(mist,hill,h),1.);
      #include <colorspace_fragment>
      }`}/>
  </mesh>;
}
