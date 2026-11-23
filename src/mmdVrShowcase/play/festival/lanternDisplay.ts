import { Color, DoubleSide, DynamicDrawUsage, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { ease, lanternTangent, PETALS, petalOpening, POD_LIMIT, SCHOOL_SIZE, SHELL_END, shellSize, SHOW_END, type LanternPodState } from './lanternFlight';
import { lanternBell, lanternPetal, lanternTassels } from './lanternPaper';

/** Three opaque, ink-coloured batches for the whole show. No transparent
 * shells to sort separately per eye, and no XR light or bloom pass. */
export function createLanternDisplay(){
  const group=new Group();group.name='play:lanternPod:flight';
  const ink=new MeshBasicMaterial({vertexColors:true,toneMapped:false,side:DoubleSide});
  const batch=(name:string,geometry:ReturnType<typeof lanternBell>,limit:number)=>{
    const m=new InstancedMesh(geometry,ink,limit);m.name='play:lanternPod:'+name;
    m.frustumCulled=false;m.instanceMatrix.setUsage(DynamicDrawUsage);m.count=0;m.visible=false;group.add(m);return m;
  };
  const petals=batch('petals',lanternPetal(),POD_LIMIT*PETALS);
  const bells=batch('bells',lanternBell(),POD_LIMIT*SCHOOL_SIZE),tassels=batch('tassels',lanternTassels(),POD_LIMIT*SCHOOL_SIZE);
  const palette=['#fff4e4','#bfffe4','#ffcadc','#c6ddff','#fff0ac'].map(s=>new Color(s));
  const pen=new Object3D(),basis=new Matrix4(),q=new Quaternion(),z=new Vector3(),x=new Vector3();
  function face(up:Vector3,lane:Vector3){
    lanternTangent(lane,up,z);x.crossVectors(up,z);q.setFromRotationMatrix(basis.makeBasis(x,up,z));
  }
  function flush(m:InstancedMesh,count:number){
    m.count=count;m.visible=count>0;
    if(count){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
  }
  function draw(pods:readonly LanternPodState[]){
    let leaves=0,swimmers=0;
    for(const p of pods){
      if(p.age<0)continue;
      if(p.age<SHELL_END){
        const open=petalOpening(p.age);face(p.up,p.dir);
        pen.position.copy(p.point);pen.scale.setScalar(shellSize(p.age));
        for(let i=0;i<PETALS;i++){
          pen.quaternion.copy(q);pen.rotateY(p.phase+i*2*Math.PI/PETALS+p.age*.31);
          pen.rotateX(open*(1.64+.09*Math.sin(p.phase+i*1.8)));
          pen.updateMatrix();petals.setMatrixAt(leaves++,pen.matrix);
        }
      }
      const fade=1-ease((p.age-(SHOW_END-.85))/.85);
      for(let i=0;i<p.school.length;i++){
        const j=p.school[i];if(j.age<0)continue;
        const unfolded=ease(j.age/.58),pulse=Math.sin(j.age*4.1+i),size=(1.10-i*.052)*fade;
        const width=(.18+.82*unfolded)*(1+.095*pulse)*size;
        pen.position.copy(j.point);face(j.up,j.lane);pen.quaternion.copy(q);pen.rotateZ(.08*pulse);pen.rotateY(.16*j.age);
        pen.scale.set(width,(.34+.66*unfolded)*(1-.085*pulse)*size,width);pen.updateMatrix();
        bells.setMatrixAt(swimmers,pen.matrix);bells.setColorAt(swimmers,palette[i]);
        // Ribbons unroll after the bell, twist at the shoulder and then
        // trail behind its contraction. Their attachment stays at its hem.
        pen.rotateX(.09*Math.sin(j.age*4.1+i-.6));pen.rotateY(.16*Math.sin(j.age*3.2+i));
        pen.scale.set(width,(.055+.945*ease((j.age-.08)/.64))*(1-.12*pulse)*size,width);pen.updateMatrix();
        tassels.setMatrixAt(swimmers,pen.matrix);tassels.setColorAt(swimmers++,palette[i]);
      }
    }
    flush(petals,leaves);flush(bells,swimmers);flush(tassels,swimmers);
  }
  function dispose(){
    group.clear();for(const m of [petals,bells,tassels]){m.dispose();m.geometry.dispose();}ink.dispose();
  }
  return {group,petals,bells,tassels,draw,dispose};
}
