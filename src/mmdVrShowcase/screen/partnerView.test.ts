import {Bone,BoxGeometry,Group,Mesh,MeshBasicMaterial,PerspectiveCamera,Vector3} from 'three';
import {expect,it} from 'vitest';
import {partnerView} from './partnerView';

it('frames the posed actor and partner together even with a narrow operating viewport',()=>{
  const partner=new Group(),actor=new Group(),g=new BoxGeometry(.4,.68,.2),material=new MeshBasicMaterial();
  const torso=new Mesh(g,material);torso.name='pelvic:partner-torso';torso.rotation.z=1.43;partner.add(torso);
  partner.position.set(2.5,.39,-3.8);partner.rotation.y=1.14;partner.scale.setScalar(.85);
  actor.position.copy(partner.position);
  const joints=[['LeftFoot',-1.05,-.31,.48],['Head',.47,.96,-.42]] as const;
  for(const [name,x,y,z] of joints){const bone=new Bone();bone.name=name;bone.position.set(x,y,z);actor.add(bone);}
  actor.updateMatrixWorld(true);partner.updateMatrixWorld(true);
  try{for(const aspect of [.56,1.9]){
    const shot=partnerView(partner,actor,aspect,46),camera=new PerspectiveCamera(46,aspect,.01,50);
    camera.position.copy(shot.eye);camera.lookAt(shot.target);camera.updateMatrixWorld();
    const points=actor.children.map(o=>o.getWorldPosition(new Vector3()));
    for(let i=0;i<g.attributes.position.count;i++)points.push(torso.localToWorld(new Vector3().fromBufferAttribute(g.attributes.position,i)));
    for(const p of points){p.project(camera);expect(Math.abs(p.x)).toBeLessThan(.99);expect(Math.abs(p.y)).toBeLessThan(.99);}
  }}finally{g.dispose();material.dispose();}
});
