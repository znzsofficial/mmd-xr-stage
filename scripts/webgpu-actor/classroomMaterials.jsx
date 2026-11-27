import React,{useEffect,useMemo} from 'react';
import {BackSide,Color,MeshBasicNodeMaterial,MeshStandardNodeMaterial} from 'three/webgpu';
import {attribute,cameraProjectionMatrix,cameraViewMatrix,color,diffuseColor,float,instanceIndex,mix,normalWorld,positionGeometry,positionLocal,positionWorld,roughness,smoothstep,texture,uv,vec2,vec3,vec4,cameraPosition} from 'three/tsl';
import {CLASS_SUN,ROOM} from '../../src/mmdVrShowcase/scenery/ClassroomLayout';
import {classroomBounce,classroomSunlight} from '../../src/mmdVrShowcase/scenery/ClassroomLight';
import {SceneShader} from './sceneShader.jsx';
import {boardDay,backDay,steelDay,boardShadow,backShadow,steelShadow,parquetContact} from '../../src/mmdVrShowcase/scenery/ClassroomFinish';
import {useBakedSurface} from '../../src/mmdVrShowcase/scenery/useBakedSurface';
import cloudsUrl from '../../src/mmdVrShowcase/scenery/day-clouds.webp';

const bayWidth=ROOM.d/ROOM.bays;
function windowFill(project){
  const p=positionWorld,sky=smoothstep(-ROOM.w/2,ROOM.w/2,p.x).oneMinus();
  const lift=smoothstep(0,1.6,p.y),facing=normalWorld.dot(vec3(-.94,.34,0)).max(0);
  const bounce=mix(vec3(1,.91,.75),vec3(.88,.96,1),sky).mul(lift.mul(.23).add(.20).add(facing.mul(.17)).mul(sky).add(.12));
  if(!project)return bounce;
  const ray=p.x.add(ROOM.w/2).div(-CLASS_SUN[0]),wy=p.y.add(ray.mul(CLASS_SUN[1])),wz=p.z.add(ray.mul(CLASS_SUN[2]));
  const bay=wz.add(ROOM.d/2).mod(bayWidth);
  const pane=smoothstep(.11,.21,bay).mul(smoothstep(bayWidth-.13,bayWidth-.04,bay).oneMinus()).mul(smoothstep(.016,.064,bay.sub(bayWidth/2).abs()))
    .mul(smoothstep(ROOM.sill+.04,ROOM.sill+.12,wy)).mul(smoothstep(ROOM.lintel-.06,ROOM.lintel+.02,wy).oneMinus())
    .mul(smoothstep(.018,.068,wy.sub(ROOM.transom).abs())).mul(ray.greaterThanEqual(0).select(1,0)).mul(smoothstep(ROOM.d/2-.1,ROOM.d/2,wz.abs()).oneMinus());
  return bounce.add(vec3(1,.84,.57).mul(pane).mul(normalWorld.dot(vec3(...CLASS_SUN).normalize()).max(0)).mul(1.5));
}
function windowGlint(r){
  const p=positionWorld,v=cameraPosition.sub(p).normalize(),d=v.negate().reflect(normalWorld),travel=p.x.add(ROOM.w/2).div(d.x.negate().max(.04)),hit=p.yz.add(d.yz.mul(travel));
  const blur=r.mul(r).mul(travel.mul(.68).add(1)).add(.065),opening=smoothstep(float(ROOM.sill).sub(blur),float(ROOM.sill).add(blur),hit.x)
    .mul(smoothstep(float(ROOM.lintel).sub(blur),float(ROOM.lintel).add(blur),hit.x).oneMinus()).mul(smoothstep(float(ROOM.d/2).sub(blur),float(ROOM.d/2).add(blur),hit.y.abs()).oneMinus());
  return vec3(.83,.93,1).mul(opening).mul(v.dot(normalWorld).clamp().oneMinus().pow(5).mul(.68).add(.038))
    .mul(smoothstep(.04,.38,d.x.negate())).mul(r.mul(.85).oneMinus()).mul(1.25);
}
function Surface({onBeforeCompile:shade,map,color:tint='white',roughness:base=.88,side,vertexColors=false}){
  const mat=useMemo(()=>{
    const board=shade===boardDay||shade===boardShadow,back=shade===backDay||shade===backShadow,tube=shade===steelDay||shade===steelShadow,wood=board||back;
    const m=new MeshStandardNodeMaterial({color:new Color(tint),roughness:base,vertexColors,...(side==null?{}:{side})});
    if(wood){
      const edge=attribute('classCut','float').greaterThan(.5),panel=uv().sub(.5),wear=panel.length().mul(2.6).clamp().oneMinus();
      // Data atlas: R is wood pigment; G/B are pore slopes, never display RGB.
      const coord=uv().mul(board?vec2(.91,1.15):vec2(.46,.40)).add(vec2(instanceIndex.toFloat().mul(.317),instanceIndex.toFloat().mul(.139)));
      const fibre=map?texture(map,coord).r:float(.93);
      m.colorNode=edge.select(vec3(.77,.72,.68),vec3(fibre));m.roughnessNode=edge.select(.43,wear.mul(-.18).add(.52));
    }else{m.map=map??null;if(tube)m.roughnessNode=mix(.78,.34,smoothstep(.03,.033,positionGeometry.y));}
    if(shade===parquetContact&&map)m.aoNode=texture(map).a;
    if(!(wood||tube||shade===classroomSunlight||shade===classroomBounce||shade===parquetContact))return m;
    const fill=diffuseColor.rgb.mul(windowFill(shade===classroomSunlight||shade===boardDay||shade===backDay||shade===steelDay));
    m.emissiveNode=wood||tube?fill.add(windowGlint(roughness)):fill;return m;
  },[shade,map,tint,base,side,vertexColors]);useEffect(()=>()=>mat.dispose(),[mat]);return <primitive object={mat} attach="material"/>;
}
function Sky({sun,warm}){
  const clouds=useBakedSurface(cloudsUrl,'mask'),[x,y,z]=sun;
  const m=useMemo(()=>{const mat=new MeshBasicNodeMaterial({side:BackSide,depthTest:false,depthWrite:false,fog:false});
    const clip=cameraProjectionMatrix.mul(vec4(cameraViewMatrix.mul(vec4(positionGeometry,0)).xyz,1));mat.vertexNode=vec4(clip.xy,0,clip.w);
    const d=positionLocal.normalize(),s=vec3(x,y,z).normalize(),a=d.dot(s).clamp(),cloud=clouds?texture(clouds,uv()).r:float(0);
    const c=mix(color(warm?'#f3d9b5':'#c9e3ec'),color(warm?'#6486ac':'#417fba'),d.y.max(0).pow(.48));
    mat.colorNode=mix(c,vec3(.92,.94,.94),cloud.mul(.78)).add(vec3(1,.78,.48).mul(a.pow(30).mul(.23).add(a.pow(330).mul(.45)).add(smoothstep(.007,.013,d.sub(s).length()).oneMinus().mul(1.8))).mul(cloud.mul(.72).oneMinus()));return mat;
  },[x,y,z,warm,clouds]);useEffect(()=>()=>m.dispose(),[m]);return <mesh name="day-sky" renderOrder={-100} frustumCulled={false} raycast={()=>null}><sphereGeometry args={[1,36,18]}/><primitive object={m} attach="material"/></mesh>;
}
export const classroomMaterials={Surface,Sky,Shader:SceneShader};
