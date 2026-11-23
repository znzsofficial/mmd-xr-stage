import {BackSide,Mesh,MeshBasicMaterial,Quaternion,SphereGeometry,Vector3,type Scene} from 'three';

export const smallLandingAngle=Math.PI/9;
const dim=.055,reveal=.105;

/** A single covered cut, never a rolling camera. The old pose is display-only:
 * the destination motor already owns the foot and reads the full stick. */
export function landingCut(foot:Vector3,basis:Quaternion){return {foot:foot.clone(),basis:basis.clone(),time:0,cut:false,opacity:0};}
export type LandingCut=ReturnType<typeof landingCut>;

export function advanceCut(c:LandingCut,dt:number){
  c.time+=Math.min(.05,Math.max(0,dt));
  if(!c.cut&&c.time>=dim){c.cut=true;c.time=dim;} // always render a fully covered frame at the actual switch
  c.opacity=c.cut?Math.max(0,1-(c.time-dim)/reveal):c.time/dim;
  return c.cut&&c.opacity===0;
}

/** Same opacity for both eyes, unaffected by tracking translation. Invisible
 * on all ordinary frames, excluded from rays, solids and the shadow pass. */
export function landingCover(){
  let mesh:Mesh<SphereGeometry,MeshBasicMaterial>|undefined;
  return {paint(scene:Scene,eye:Vector3,opacity:number){
    if(!opacity){if(mesh)mesh.visible=false;return;}
    if(!mesh){mesh=new Mesh(new SphereGeometry(1,12,8),new MeshBasicMaterial({side:BackSide,color:0,transparent:true,depthWrite:false,depthTest:false,toneMapped:false,fog:false}));
      mesh.name='player:landing-cut';mesh.raycast=()=>{};mesh.frustumCulled=false;mesh.renderOrder=1e6;
    }
    if(mesh.parent!==scene)scene.add(mesh);
    mesh.position.copy(eye);mesh.visible=true;mesh.material.opacity=opacity;
  },dispose(){if(mesh){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();mesh=undefined;}}};
}
