import {Vector3,type MeshBasicMaterial} from 'three';
import type {WindLane} from './windAtlas';
import {windFace,windTerminals} from './windTerminalLayout';

/** The ink and metal stay completely opaque. Cut only tracer fragments whose
 * eye ray continues through a selected legend. View-space origin is the
 * individual eye, including in XR; mvPosition includes the tracer instance.
 * No extra pass, texture, depth override or camera-centre stencil. */
export function windChartVisibility(lane:WindLane):MeshBasicMaterial['onBeforeCompile']{
  const plates=windTerminals.filter(s=>s.lane===lane).map(s=>({
    center:s.face,right:new Vector3(1,0,0).applyQuaternion(s.faceRotation),up:new Vector3(0,1,0).applyQuaternion(s.faceRotation),
  }));
  return shader=>{
    shader.uniforms.windPlate={value:plates};
    shader.vertexShader='varying vec3 windEyeRay;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nwindEyeRay=mvPosition.xyz;');
    shader.fragmentShader=`varying vec3 windEyeRay;
      struct Chart { vec3 center; vec3 right; vec3 up; }; uniform Chart windPlate[2];
      float chartWind(Chart plate){
        vec3 ctr=(viewMatrix*vec4(plate.center,1.)).xyz;
        vec3 right=mat3(viewMatrix)*plate.right,up=mat3(viewMatrix)*plate.up,n=cross(right,up);
        float plane=dot(ctr,n),aim=dot(windEyeRay,n);
        if(aim>=-.0001 || plane>=aim)return 1.;
        vec3 offset=windEyeRay*(plane/aim)-ctr;
        vec2 edge=abs(vec2(dot(offset,right),dot(offset,up)))-vec2(${windFace.width/2},${windFace.height/2});
        return smoothstep(.008,.095,max(edge.x,edge.y));
      }\n`+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        diffuseColor.a*=smoothstep(.75,2.7,length(windEyeRay))*chartWind(windPlate[0])*chartWind(windPlate[1]);`);
  };
}
