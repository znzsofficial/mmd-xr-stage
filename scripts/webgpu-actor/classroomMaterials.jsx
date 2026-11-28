import React,{useEffect,useMemo} from 'react';
import {BackSide,Color,MeshBasicNodeMaterial,MeshStandardNodeMaterial} from 'three/webgpu';
import {attribute,cameraProjectionMatrix,cameraViewMatrix,color,diffuseColor,float,instanceIndex,mix,normalWorld,positionGeometry,positionLocal,positionWorld,roughness,smoothstep,step,texture,uv,vec2,vec3,vec4,cameraPosition} from 'three/tsl';
import {CLERESTORY,ROOM} from '../../src/mmdVrShowcase/scenery/ClassroomLayout';
import {SHORE_SUN} from '../../src/mmdVrShowcase/scenery/shoreDaylight';
import {wardBounce,nurseFinish,wardWindows} from '../../src/mmdVrShowcase/scenery/clinic/wardDaylight';
import {classroomBounce,classroomSunlight} from '../../src/mmdVrShowcase/scenery/ClassroomLight';
import {SceneShader} from './sceneShader.jsx';
import {boardDay,backDay,steelDay,boardShadow,backShadow,steelShadow,parquetContact} from '../../src/mmdVrShowcase/scenery/ClassroomFinish';
import {useBakedSurface} from '../../src/mmdVrShowcase/scenery/useBakedSurface';
import cloudsUrl from '../../src/mmdVrShowcase/scenery/day-clouds.webp';

function windowFill(project){
  const p=positionWorld,sky=smoothstep(-ROOM.w/2,ROOM.w/2,p.x).oneMinus();
  const lift=smoothstep(0,1.6,p.y),facing=normalWorld.dot(vec3(-.94,.34,0)).max(0);
  const bounce=mix(vec3(1,.91,.75),vec3(.88,.96,1),sky).mul(lift.mul(.16).add(.16).add(facing.mul(.13)).mul(sky).add(.075));
  if(!project)return bounce;
  const high=CLERESTORY,ray=p.z.sub(high.z).div(-SHORE_SUN[2]);
  const offset=p.x.add(ray.mul(SHORE_SUN[0])).sub(high.left),wy=p.y.add(ray.mul(SHORE_SUN[1])),bay=offset.mod(high.pitch);
  const pane=smoothstep(high.pier/2,high.pier/2+.055,bay.min(float(high.pitch).sub(bay)))
    .mul(step(0,offset)).mul(step(offset,high.count*high.pitch)).mul(step(0,ray))
    .mul(smoothstep(high.sill,high.sill+.055,wy)).mul(smoothstep(high.head-.055,high.head,wy).oneMinus());
  return bounce.add(vec3(1,.86,.66).mul(pane).mul(normalWorld.dot(vec3(...SHORE_SUN).normalize()).max(0)).mul(1.3));
}
function windowGlint(r){
  const p=positionWorld,v=cameraPosition.sub(p).normalize(),d=v.negate().reflect(normalWorld),travel=p.x.add(ROOM.w/2).div(d.x.negate().max(.04)),hit=p.yz.add(d.yz.mul(travel));
  const blur=r.mul(r).mul(travel.mul(.68).add(1)).add(.065),opening=smoothstep(float(ROOM.sill).sub(blur),float(ROOM.sill).add(blur),hit.x)
    .mul(smoothstep(float(ROOM.lintel).sub(blur),float(ROOM.lintel).add(blur),hit.x).oneMinus()).mul(smoothstep(float(ROOM.d/2).sub(blur),float(ROOM.d/2).add(blur),hit.y.abs()).oneMinus());
  return vec3(.83,.93,1).mul(opening).mul(v.dot(normalWorld).clamp().oneMinus().pow(5).mul(.68).add(.038))
    .mul(smoothstep(.04,.38,d.x.negate())).mul(r.mul(.85).oneMinus()).mul(1.25);
}
function Surface({onBeforeCompile:shade,map,color:tint='white',roughness:base=.88,metalness=0,side,vertexColors=false}){
  const mat=useMemo(()=>{
    const board=shade===boardDay||shade===boardShadow,back=shade===backDay||shade===backShadow,tube=shade===steelDay||shade===steelShadow,wood=board||back;
    const m=new MeshStandardNodeMaterial({color:new Color(tint),roughness:base,metalness,vertexColors,...(side==null?{}:{side})});
    if(shade===wardBounce||shade===nurseFinish){
      const p=positionWorld,hall=smoothstep(1.8,2.38,p.x.abs()).oneMinus().mul(p.z.add(.83).mul(2.088).cos().mul(.5).add(.5));
      const [west,east,north]=wardWindows.map(([x,z])=>p.xz.sub(vec2(x,z)).length());
      const skylight=smoothstep(.3,4.4,west.min(east).min(north)).oneMinus();
      m.map=map??null;
      m.emissiveNode=diffuseColor.rgb.mul(vec3(.11,.12,.126).add(vec3(.08,.073,.058).mul(hall)).add(vec3(.15,.185,.21).mul(skylight)));
      if(shade===nurseFinish)m.roughnessNode=attribute('finishRoughness','float');
      return m;
    }
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
  },[shade,map,tint,base,metalness,side,vertexColors]);useEffect(()=>()=>mat.dispose(),[mat]);return <primitive object={mat} attach="material"/>;
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
