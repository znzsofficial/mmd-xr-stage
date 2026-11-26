import {RoomShader} from './daylightMaterials';
import {useMemo} from 'react';
import {DoubleSide,type Texture} from 'three';

/** Thin hand-rolled glass: pale panes transmit the garden, dense enamel and
 * lead transmit much less. View-space incidence is evaluated per XR eye. */
export function ChapelGlass({map}:{map:Texture}){
  const uniforms=useMemo(()=>({cartoon:{value:map}}),[map]);
  return <RoomShader effect="glass" uniforms={uniforms} transparent depthWrite={false} side={DoubleSide} forceSinglePass toneMapped={false}
    vertexShader={`varying vec2 vUv;varying vec3 toEye,n;
      void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);toEye=-p.xyz;n=normalMatrix*normal;gl_Position=projectionMatrix*p;}`}
    fragmentShader={`uniform sampler2D cartoon;varying vec2 vUv;varying vec3 toEye,n;
      void main(){vec3 dye=texture2D(cartoon,vUv).rgb;float l=dot(dye,vec3(.22,.65,.13));float glass=smoothstep(.095,.19,l);
        float ripple=sin(vUv.x*104.+3.*sin(vUv.y*19.))+0.54*sin(vUv.y*123.+2.*sin(vUv.x*24.));
        float fres=pow(clamp(1.-abs(dot(normalize(toEye),normalize(n))),0.,1.),3.);float flash=smoothstep(.93,1.52,ripple+fres*.38)*glass;
        vec3 color=mix(vec3(.062,.067,.078),pow(dye,vec3(1.32))*1.36,glass);
        color+=glass*(.047*fres+.033*flash)*vec3(.76,.91,1.); float opacity=mix(.99,clamp(.83-.52*l+.18*fres,.37,.91),glass);
        gl_FragColor=vec4(color,opacity);
        #include <colorspace_fragment>
      }`}/>;
}
