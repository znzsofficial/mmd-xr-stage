import {RoomShader,DaylightMaterials} from '../../daylightMaterials';
import {useContext,useEffect,useMemo} from 'react';
import {AdditiveBlending,BufferGeometry,Color,Float32BufferAttribute,InstancedBufferGeometry,InstancedBufferAttribute,Vector4,type Texture} from 'three';
import {noPick} from '../../sceneryPaint';
import {skySpace} from './skySpace';

// Stars are positions, magnitudes and colours, not texels. All points share
// one draw. A minority form a loose group in front of the luminous arm.
function catalogue(quads:boolean){
  let seed=271828;
  const rand=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  const p:number[]=[],rgb:number[]=[],data:number[]=[],c=new Color();
  const palette=['#b8d4ff','#deebff','#fff0d6','#ffd7ad','#ffa87b'];
  for(let i=0;i<16000;i++){
    const a=rand()*Math.PI*2,y=2*rand()-1,s=Math.sqrt(1-y*y),x=s*Math.cos(a),z=s*Math.sin(a);
    const lat=y+.29*x+.065*z+.15*Math.sin(3.1*x+2*z)+.07*Math.sin(7*x-3*y);
    if(rand()>.42+.57*Math.exp(-Math.pow(lat/.25,2)))continue;
    const mag=rand()**3,prominent=rand()<.014;
    const depth=i%6===0?330+280*rand():0; // zero means effectively infinite
    p.push(x,y,z);data.push(depth,(prominent?.0034:.00060+.00135*mag),prominent?1:.19+.64*mag);
    c.set(palette[Math.min(4,Math.floor(rand()*5))]);rgb.push(c.r,c.g,c.b);
  }
  if(quads){const g=new InstancedBufferGeometry();g.setIndex([0,1,2,2,1,3]);g.setAttribute('position',new Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,-.5,.5,0,.5,.5,0],3));g.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,0,1,1,1],2));
    for(const [k,v] of [['starDirection',p],['colour',rgb],['stellar',data]] as const)g.setAttribute(k,new InstancedBufferAttribute(Float32Array.from(v),3));g.instanceCount=p.length/3;return g;}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('colour',new Float32BufferAttribute(rgb,3));g.setAttribute('stellar',new Float32BufferAttribute(data,3));return g;
}

export function StarCatalogue({dust}:{dust:Texture|null}){
  const quads=!!useContext(DaylightMaterials),Primitive=quads?'mesh':'points';
  const g=useMemo(()=>catalogue(quads),[quads]),vp=useMemo(()=>new Vector4(),[]),u=useMemo(()=>({height:{value:720},dust:{value:dust},mapped:{value:dust?1:0}}),[dust]);
  useEffect(()=>()=>g.dispose(),[g]);
  return <Primitive name="sky:stellar-catalogue" geometry={g} renderOrder={-990} frustumCulled={false} raycast={noPick}
    onBeforeRender={r=>{if(!quads)u.height.value=r.getCurrentViewport(vp).w;}}>
    <RoomShader effect="catalogue" uniforms={u} blending={AdditiveBlending} depthTest={false} depthWrite={false} toneMapped={false}
      vertexShader={`${skySpace}
        attribute vec3 stellar,colour;uniform float height,mapped;uniform sampler2D dust;varying vec3 tint;varying float size,energy,spikes;
        void main(){vec3 eye=skyEye(cameraPosition);vec3 n=stellar.x>0.?normalize(position*stellar.x-eye):position;
          vec4 v=vec4(mat3(viewMatrix)*n,1.);vec4 p=projectionMatrix*v;gl_Position=p.xyww;
          float pixels=stellar.y*.5*height*projectionMatrix[1][1]/max(.35,-v.z);
          size=clamp(2.8+pixels*2.2,3.,14.);gl_PointSize=size;tint=colour;
          spikes=step(.95,stellar.z);energy=stellar.z*clamp(pixels+.42,.43,1.5);
          energy*=1.-.82*mapped*textureLod(dust,shellUV(shellDir(eye,n,dustDistance)),1.).b;
        }`}
      fragmentShader={`varying vec3 tint;varying float size,energy,spikes;
        void main(){vec2 p=(gl_PointCoord-.5)*size;float d=dot(p,p);
          float core=exp(-d/(.80+.10*size));float halo=exp(-d/(1.4+.52*size));
          float crossLight=exp(-min(abs(p.x),abs(p.y))*5.)*exp(-length(p)*.88);
          float flux=energy*(core+.13*halo+spikes*.40*crossLight);
          gl_FragColor=vec4(mix(tint,vec3(1.),.32*core),min(1.,flux));
          #include <colorspace_fragment>
        }`}/>
  </Primitive>;
}
