// Used in the tracked post-draw readback and right after the real WebGL draw.
// Derive sample sites from the displayed geometry/bones; don't change the scene.
export function layoutPixels(scene,camera,at,{signs,cast,items}){
  const sample=v=>{v.project(camera);return at((1+v.x)/2,(1-v.y)/2);};
  const props=scene.children.filter(o=>o.userData.stagePropSolid).map(root=>{
    const mesh=root.children[0],spec=signs.find(s=>s.name.startsWith(mesh.name+'.'));
    const point=(u,v)=>mesh.localToWorld(mesh.position.clone().set((u-.5)*spec.width,(1-v)*spec.height,0));
    const paint=point(.17,.14);
    return {name:spec.name,position:root.position.toArray(),scale:root.scale.x,
      paintSite:paint.toArray(),background:sample(paint),ink:sample(point(.5,spec.symbol==='='?.35:.5))};
  });
  const people=scene.children.filter(o=>o.userData.mmdModelId&&o.visible).map(root=>{
    const id=root.userData.mmdModelId, name=items?.find(i=>i.id===id)?.name;
    const actor=cast.find(c=>c.name===name);if(!actor)throw Error('Unidentified staged actor '+id);
    let torso;
    root.traverse(o=>{if(!torso&&o.isBone&&[o.name,o.userData.mmdBoneName].includes('上半身'))torso=o;});
    if(!torso)throw Error('Missing torso in '+name);
    const point=torso.getWorldPosition(root.position.clone());
    // A small patch within the chest, away from the garment boundary, also
    // reads the former chest area when the user hides only the form material.
    const patch=[];
    for(const dx of [-.035,0,.035])for(const dy of [-.035,0,.035]){
      const p=point.clone();p.x+=dx;p.y+=dy;patch.push(sample(p));
    }
    return {name,point:point.toArray(),rgb:patch[4],patch,id};
  });
  return {props,people};
}
