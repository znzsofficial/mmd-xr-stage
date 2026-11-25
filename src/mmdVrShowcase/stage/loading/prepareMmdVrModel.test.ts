import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { prepareMmdVrModel } from "./prepareMmdVrModel";
import {shareMorphGeometry} from './shareMorphGeometry';

describe("prepareMmdVrModel", () => {
  it("disables model culling without changing material face settings", () => {
    const root = new THREE.Group();
    const front = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
    const back = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [front, back]);
    root.add(mesh);

    prepareMmdVrModel(root);

    expect(root.frustumCulled).toBe(false);
    expect(mesh.frustumCulled).toBe(false);
    expect(front.side).toBe(THREE.FrontSide);
    expect(back.side).toBe(THREE.BackSide);
  });
});

it('restores the current material range after nested shadow/pick calls and keeps a compact body independent',()=>{
  const root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),base=new THREE.BoxGeometry(),geo=new THREE.BufferGeometry();
  geo.setAttribute('position',base.attributes.position);geo.setIndex(base.index);geo.addGroup(0,6,1);geo.addGroup(6,30,0);
  geo.morphAttributes.position=[base.attributes.position.clone()];geo.morphTargetsRelative=true;geo.setDrawRange(0,0);
  const source=new THREE.SkinnedMesh(geo,[material,material]);source.userData.mmdModel={};source.skeleton=new THREE.Skeleton([]);
  function proxy(body:THREE.SkinnedMesh,start:number,count:number,slot:number,outline=false){
    const g=new THREE.BufferGeometry(),s=body.geometry;g.setIndex(s.index);g.setAttribute('position',s.attributes.position);g.morphAttributes.position=s.morphAttributes.position;g.morphTargetsRelative=true;g.setDrawRange(start,count);g.addGroup(start,count,0);
    const draw=new THREE.SkinnedMesh(g,material);draw.skeleton=body.skeleton;Object.assign(draw.userData,outline?{mmdOutlineProxy:{sourceMaterialIndex:slot}}:{mmdMaterialRenderProxy:{materialIndex:slot}});root.add(draw);return draw;
  }
  const compact=new THREE.SkinnedMesh(geo.clone(),[material,material]);compact.skeleton=source.skeleton;compact.userData.mmdMorphSplitBody={materialIndex:1};compact.geometry.clearGroups();compact.geometry.addGroup(0,6,1);compact.geometry.setDrawRange(0,Infinity);
  root.add(source,compact);const a=proxy(source,0,6,1),b=proxy(source,6,30,0),edge=proxy(compact,0,6,1,true);
  const calls:string[]=[];b.raycast=()=>{calls.push('pick');expect(geo.drawRange).toEqual({start:6,count:30});throw Error('aborted pick');};
  a.onBeforeRender=()=>calls.push('colour');edge.onBeforeRender=()=>calls.push('outline');
  shareMorphGeometry(root);shareMorphGeometry(root);expect(a.geometry).toBe(geo);expect(b.geometry).toBe(geo);expect(edge.geometry).toBe(compact.geometry);
  const r={} as THREE.WebGLRenderer,s=new THREE.Scene(),c=new THREE.PerspectiveCamera(),group=new THREE.Group();
  a.onBeforeRender(r,s,c,geo,material,group);expect(geo.drawRange).toEqual({start:0,count:6});
  b.onBeforeShadow(r,s,c,c,geo,material,group);expect(geo.drawRange).toEqual({start:6,count:30});
  b.onAfterShadow(r,s,c,c,geo,material,group);expect(geo.drawRange).toEqual({start:0,count:6});
  expect(()=>b.raycast(new THREE.Raycaster(),[])).toThrow('aborted pick');expect(geo.drawRange).toEqual({start:0,count:6});
  a.onAfterRender(r,s,c,geo,material,group);expect(geo.drawRange).toEqual({start:0,count:0});
  edge.onBeforeRender(r,s,c,edge.geometry,material,group);expect(edge.geometry.drawRange.count).toBe(6);edge.onAfterRender(r,s,c,edge.geometry,material,group);expect(compact.geometry.drawRange.count).toBe(Infinity);
  expect(calls).toEqual(['colour','pick','outline']);
});
