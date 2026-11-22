import { DynamicDrawUsage, InstancedMesh, LatheGeometry, Matrix4, MeshStandardMaterial, Quaternion, Vector2, Vector3, type Scene } from 'three';

type Side = 'left'|'right';
export type SampleOutlet = (side:Side, position:Vector3, normal:Vector3)=>boolean;
const sides = ['left','right'] as const;
const capacity=24, hang=.20, fall=.37, gravity=9.81;
const outlet=()=>({position:new Vector3(),normal:new Vector3()});
type Outlet=ReturnType<typeof outlet>;
type Drop={side:Side; age:number; radius:number; center:Vector3; velocity:Vector3; pendant:Quaternion};

/** One opaque, depth-tested draw for both eyes. All centers, including the
 * release point, are world-space; the instance mesh never belongs to a PMX. */
export function createMilkDroplets(scene:Scene, sample:SampleOutlet) {
  const ports={left:outlet(),right:outlet()}, active:Drop[]=[], free:Drop[]=[];
  const matrix=new Matrix4(),up=new Vector3(0,1,0),axis=new Vector3(),scale=new Vector3(),rotation=new Quaternion(),vertical=new Quaternion();
  let mesh:InstancedMesh<LatheGeometry,MeshStandardMaterial>|undefined;
  function drawing(){
    if(mesh)return mesh;
    const profile=[[0,-1],[.56,-.85],[.90,-.47],[1,-.1],[.92,.29],[.64,.74],[.29,1.17],[0,1.48]];
    mesh=new InstancedMesh(new LatheGeometry(profile.map(([r,y])=>new Vector2(r,y)),12),
      new MeshStandardMaterial({color:0xfffaf0,emissive:0xf5f2e9,emissiveIntensity:.16,roughness:.24}),capacity);
    mesh.name='body:milk-droplets';mesh.frustumCulled=false;mesh.raycast=()=>{};
    mesh.matrixAutoUpdate=false;mesh.matrixWorldAutoUpdate=false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.count=0;scene.add(mesh);return mesh;
  }
  function read(side:Side){
    const {position,normal}=ports[side];
    position.setScalar(NaN);normal.setScalar(NaN);
    if(!sample(side,position,normal)||!Number.isFinite(position.lengthSq()))return false;
    const length=normal.length();if(!Number.isFinite(length)||length<1e-6)return false;
    normal.multiplyScalar(1/length);return true;
  }
  const size=(d:Drop)=>d.radius*(.70+.30*Math.min(1,Math.max(0,d.age)/hang));
  const stretch=(d:Drop)=>d.age<=hang?1+.38*Math.max(0,d.age)/hang:1.38-.45*Math.min(1,(d.age-hang)/.055);
  function attach(d:Drop,p:Outlet){
    // Tip touches the outlet even as the pendant grows. The belly sags along
    // the surface tangent, with enough clearance to work on a reclined actor.
    axis.copy(up).addScaledVector(p.normal,-p.normal.y-.78).normalize();
    d.pendant.setFromUnitVectors(up,axis);
    d.center.copy(p.position).addScaledVector(axis,-1.48*size(d)*stretch(d));
    d.velocity.copy(p.normal).multiplyScalar(.042);
  }
  function draw(){
    let count=0;
    for(const d of active){
      if(d.age<0)continue;
      const r=size(d)*Math.min(1,(hang+fall-d.age)/.075);
      rotation.copy(d.pendant).slerp(vertical,Math.min(1,Math.max(0,(d.age-hang)/.085)));
      matrix.compose(d.center,rotation,scale.set(r,r*stretch(d),r));
      drawing().setMatrixAt(count++,matrix);
    }
    if(mesh){mesh.count=count;mesh.visible=count>0;if(count)mesh.instanceMatrix.needsUpdate=true;}
  }
  function clear(side?:Side){
    for(let i=active.length-1;i>=0;i--)if(!side||active[i].side===side){free.push(active[i]);active.splice(i,1);}
    draw();
  }
  return {
    get active(){return active.length>0;},
    emit(side:Side,amount:number,singleBead=false){
      if(!(amount>0)||!Number.isFinite(amount)||!sides.includes(side))return false;
      if(!read(side)){clear(side);return false;}
      const volume=Math.min(1,amount),count=singleBead?1:Math.min(3,Math.ceil(volume/.10));
      if(active.length+count>capacity)return false; // Reject this event whole, never enqueue it.
      // Held beats form one legible pendant now. Never schedule sibling beads
      // for after release; the queued bead train is only the legacy button.
      const radius=Math.max(.0032,(singleBead ? .0105 : .0073)*Math.cbrt(volume/(count*.10)));
      for(let i=0;i<count;i++){
        const d=free.pop()??{side,age:0,radius,center:new Vector3(),velocity:new Vector3(),pendant:new Quaternion()};
        d.side=side;d.radius=radius;d.age=-i*hang;attach(d,ports[side]);active.push(d);
      }
      draw();return true;
    },
    advance(dt:number){
      if(!active.length)return;
      // Even airborne drops disappear when their side ceases to be exposed.
      // Sample each occupied side once, independent of the number of drops.
      for(const side of sides){
        if(!active.some(d=>d.side===side))continue;
        const valid=read(side);
        for(let i=active.length-1;i>=0;i--){
          const d=active[i];if(d.side!==side)continue;
          const prev=d.age;d.age+=dt;
          if(!valid||d.age>=hang+fall){free.push(d);active.splice(i,1);continue;}
          if(d.age<0)continue;
          if(prev<hang){const now=d.age;d.age=Math.min(now,hang);attach(d,ports[side]);d.age=now;}
          const airborne=d.age-Math.max(prev,hang);
          if(airborne>0){d.center.addScaledVector(d.velocity,airborne);d.center.y-=.5*gravity*airborne*airborne;d.velocity.y-=gravity*airborne;}
        }
      }
      draw();
    },
    clear,
    dispose(){clear();if(mesh){mesh.removeFromParent();mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();mesh=undefined;}free.length=0;},
  };
}
