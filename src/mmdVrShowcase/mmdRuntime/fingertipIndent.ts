import { Box3, BufferAttribute, Matrix3, Matrix4, Vector3, type Bone, type SkinnedMesh } from 'three';
import { FINGERTIP_MASK, type TrackedPressure } from './trackedPressure';

// Hard limits for untrusted, arbitrarily large PMXs. Never truncate a patch
// halfway across the chest: retain the existing bone response on an unfit rig.
const MAX_VERTICES = 160_000, MAX_INDICES = 960_000, MAX_CANDIDATES = 4096, MAX_MORPH_CHECKS = 262_144;
const MAX_CELLS = 256, MAX_MORPHS = 256;
type Transform = { matrix:Matrix4; extent:Vector3 };
type Vertex = { index:number; p:Vector3; n:Vector3; weight:number; edge:number; depth:number; tilt:Vector3; skin:{m:Matrix4;w:number}[] };
type Cell = { center:Vector3; bones:Set<Transform>; vertices:Vertex[]; active:boolean };
type Morph = { index:number; attr:BufferAttribute; max:number; weight:number };
type Layer = {mesh:SkinnedMesh;position:BufferAttribute;normal:BufferAttribute;cells:Cell[];palette:Map<number,Transform>;
  morphs:Morph[];activeMorphs:Morph[];active:Vertex[]};
type Tip = { slot:number; distSq:number; start:Vector3; end:Vector3; axis:Vector3; invLengthSq:number; r:number; bounds:Box3 };
const vector = () => new Vector3();
const float3 = (a:unknown): a is BufferAttribute => a instanceof BufferAttribute && a.array instanceof Float32Array && a.itemSize===3 && !a.normalized;

// A moved vertex displaces every incident triangle. Retain its longest rest
// edge so a fingertip never folds a large, sparsely tessellated panel.
function* fitEdges(position:BufferAttribute,index:BufferAttribute,cells:Cell[]){
  const ids=new Uint16Array(position.count),eligible:Vertex[]=[];
  for(const c of cells)for(const v of c.vertices)ids[v.index]=eligible.push(v);
  const edgeSq=(a:number,b:number)=>{const x=position.getX(a)-position.getX(b),y=position.getY(a)-position.getY(b),z=position.getZ(a)-position.getZ(b);return x*x+y*y+z*z;};
  for(let j=0;j<index.count;j+=3){if(j>0 && (j&1023)===0)yield;
    const a=index.array[j],b=index.array[j+1],c=index.array[j+2],ia=ids[a],ib=ids[b],ic=ids[c];
    if(!ia&&!ib&&!ic)continue;
    const va=eligible[ia-1],vb=eligible[ib-1],vc=eligible[ic-1];
    const ab=edgeSq(a,b),bc=edgeSq(b,c),ca=edgeSq(c,a);
    if(va)va.edge=Math.max(va.edge,ab,ca);if(vb)vb.edge=Math.max(vb.edge,ab,bc);if(vc)vc.edge=Math.max(vc.edge,bc,ca);
  }
  for(const c of cells)for(const v of c.vertices)v.edge=Math.sqrt(v.edge);
}

/** Post-evaluation display pass. Writes only ordinary linear-skinned surface
 * attributes (also shared by the loader's render-order, shadow and outline
 * proxies). No modifications to evaluator, morph buffers, shaders or colliders. */
function* prepareSurface(source:SkinnedMesh, pads:readonly Bone[], shoulderWidth:number) {
  if (!(shoulderWidth>0 && Number.isFinite(shoulderWidth))) return null;
  const bodies:SkinnedMesh[] = source.userData.mmdMorphSplitBodyMeshes ?? [source];
  if (bodies.length>96 || bodies.reduce((n,m)=>n+(m.geometry.attributes.position?.count??0),0)>MAX_VERTICES) return null;
  const {bones,boneInverses} = source.skeleton;
  const pad = new Set(pads.map(b=>bones.indexOf(b)).filter(i=>i>=0));
  const cellSize = shoulderWidth*.16, cellRadius = cellSize*Math.sqrt(3)/2;
  const layers:Layer[] = [], seen = new Set<BufferAttribute>();
  let candidates = 0, morphChecks = 0, cellCount = 0, indices = 0;
  for (const mesh of bodies) {
    const g=mesh.geometry, {position,normal,skinIndex,skinWeight,matricesSdefEnabled:sdef,matricesQdefEnabled:qdef}=g.attributes;
    if(mesh.skeleton!==source.skeleton || !float3(position) || !float3(normal) || seen.has(position) || normal.count!==position.count ||
      skinIndex?.itemSize!==4 || skinWeight?.itemSize!==4 || skinIndex.count!==position.count || skinWeight.count!==position.count) return null;
    seen.add(position);
    const cells=new Map<string,Cell>(), palette=new Map<number,Transform>();
    for(let i=0;i<position.count;i++) {
      if(i>0 && (i&511)===0)yield;
      let supported=0,total=0;
      for(let j=0;j<4;j++) { const w=skinWeight.getComponent(i,j); total+=w; if(pad.has(skinIndex.getComponent(i,j))) supported+=w; }
      // Do not invent a deformable area on a rigid bodice, hair or spine.
      // Taper across skin-weight and side-facing boundaries rather than cutting a seam.
      if(supported<=.20 || normal.getZ(i)<=.05) continue;
      if(Math.abs(total-1)>.002 || !Number.isFinite(total) || sdef?.getX(i) || qdef?.getX(i) || ++candidates>MAX_CANDIDATES) return null;
      const p=vector().fromBufferAttribute(position,i), n=vector().fromBufferAttribute(normal,i);
      if(!Number.isFinite(p.lengthSq()+n.lengthSq()) || n.lengthSq()<.5) return null;
      const x=Math.floor(p.x/cellSize),y=Math.floor(p.y/cellSize),z=Math.floor(p.z/cellSize),key=`${x},${y},${z}`;
      let cell=cells.get(key);
      if(!cell){if(++cellCount>MAX_CELLS)return null;
        cell={center:new Vector3(x+.5,y+.5,z+.5).multiplyScalar(cellSize),bones:new Set(),vertices:[],active:false}; cells.set(key,cell);}
      const skin:Vertex['skin']=[];
      for(let j=0;j<4;j++){const w=skinWeight.getComponent(i,j);if(!w)continue;const k=skinIndex.getComponent(i,j);
        if(!bones[k] || !boneInverses[k] || w<0)return null;
        let binding=palette.get(k);if(!binding){binding={matrix:new Matrix4(),extent:vector()};palette.set(k,binding);}
        cell.bones.add(binding);skin.push({m:binding.matrix,w});}
      const weight=Math.min(1,(supported-.20)/.40)*Math.min(1,(n.z-.05)/.35);
      cell.vertices.push({index:i,p,n,weight,edge:0,depth:0,tilt:vector(),skin});
    }
    if(!cells.size)continue;
    if(!g.index || g.index.count%3 || (indices+=g.index.count)>MAX_INDICES)return null;
    yield* fitEdges(position,g.index,[...cells.values()]);
    const attrs=g.morphAttributes.position??[], morphs:Morph[]=[];
    morphChecks+=attrs.length*[...cells.values()].reduce((n,c)=>n+c.vertices.length,0);
    if(morphChecks>MAX_MORPH_CHECKS || attrs.length>MAX_MORPHS || (attrs.length&&!g.morphTargetsRelative) || g.morphAttributes.normal?.length) return null;
    const remap=mesh.userData.mmdMorphSplitBody?.morphTargetIndices;
    let checked=0;
    for(let j=0;j<attrs.length;j++) {
      const attr=attrs[j];if(!float3(attr) || attr.count!==position.count)return null;
      let maxSq=0;for(const c of cells.values())for(const {index:i} of c.vertices){if((++checked&511)===0)yield;
        const x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i);maxSq=Math.max(maxSq,x*x+y*y+z*z);}
      if(!Number.isFinite(maxSq))return null;
      if(maxSq) morphs.push({index:remap?.[j]??j,attr,max:Math.sqrt(maxSq),weight:0});
    }
    layers.push({mesh,position,normal,cells:[...cells.values()],palette,morphs,activeMorphs:[],active:[]});
  }
  if(!layers.length)return null;

  const slots:Tip[]=Array.from({length:12},(_,slot)=>({slot,distSq:Infinity,start:vector(),end:vector(),axis:vector(),r:0,invLengthSq:0,bounds:new Box3()}));
  const tipBroadGain=new Float32Array(12).fill(1);
  const tips:Tip[]=[],near:Tip[]=[],box=new Box3(),mid=vector(),lo=vector(),hi=vector();
  const world=new Matrix4(),blend=new Matrix4(),linear=new Matrix3();
  const p=vector(),n=vector(),delta=vector(),tilt=vector(),tmp=vector();
  let active=false,restored=true;
  // A Blender rig may weight chest skin well beyond the nearest dynamic
  // proxy. After a tracking gap, native clearance need not mean surface
  // clearance. Reuse the posed cell boxes; don't add a second skinning pass.
  let previousTips=0, recovering=0;
  const clearTime=new Float32Array(12);

  function dirty(attr:BufferAttribute,first:number,last:number){
    if(last<first)return;
    // One pending upload even when a mesh is off camera for many ticks.
    const old=attr.updateRanges[0],start=first*3,end=(last+1)*3;
    if(old && attr.updateRanges.length===1){const e=Math.max(end,old.start+old.count);old.start=Math.min(start,old.start);old.count=e-old.start;}
    else attr.addUpdateRange(start,end-start);
    attr.needsUpdate=true;
  }
  function restore(){
    if(restored)return;
    for(const l of layers){let first=Infinity,last=-1;
      for(const {index:i,p,n} of l.active){l.position.setXYZ(i,p.x,p.y,p.z);l.normal.setXYZ(i,n.x,n.y,n.z);first=Math.min(first,i);last=Math.max(last,i);}
      dirty(l.position,first,last);dirty(l.normal,first,last);
    }
    restored=true;
  }
  function reset(){restore();previousTips=recovering=0;clearTime.fill(0);tipBroadGain.fill(1);if(!active)return;
    for(const l of layers){for(const v of l.active){v.depth=0;v.tilt.set(0,0,0);} l.active.length=0;for(const c of l.cells)c.active=false;}
    active=false;
  }

  function apply(hands:TrackedPressure|undefined,dt:number,strength=1,rebound=.085){
    restore();
    tips.length=0;tipBroadGain.fill(1);
    const mask=(hands?.mask??0)&FINGERTIP_MASK;
    recovering|=previousTips&~mask;previousTips=mask;
    let nearRecovered=0;
    if(recovering)for(let i=0;i<12;i++)if(recovering&(1<<i)){
      tipBroadGain[i]=0;if(!(mask&(1<<i)))clearTime[i]=0;
    }
    if(!active && !mask)return;
    if(hands)for(let i=0;i<12;i++){
      const t=slots[i];t.r=hands.readFinger(i,t.start,t.end);if(!t.r)continue;t.distSq=Infinity;
      t.axis.subVectors(t.end,t.start);t.invLengthSq=1/Math.max(1e-12,t.axis.lengthSq());
      t.bounds.makeEmpty().expandByPoint(t.start).expandByPoint(t.end).expandByScalar(3.5*t.r);tips.push(t);
    }
    const seconds=Math.min(.05,Math.max(0,dt)),attack=-Math.expm1(-seconds/.018),release=-Math.expm1(-seconds/(.065*rebound/.085));
    active=false;
    for(const l of layers){
      l.active.length=0;l.activeMorphs.length=0;
      let margin=0,first=Infinity,last=-1;
      if(tips.length){
        world.multiplyMatrices(l.mesh.matrixWorld,l.mesh.bindMatrixInverse);
        for(const m of l.morphs){m.weight=source.morphTargetInfluences?.[m.index]??0;if(m.weight){l.activeMorphs.push(m);margin+=Math.abs(m.weight)*m.max;}}
        for(const [i,b] of l.palette){
          const e=b.matrix.copy(world).multiply(bones[i].matrixWorld).multiply(boneInverses[i]).multiply(l.mesh.bindMatrix).elements;
          // Row norms give exact AABB extents of a transformed sphere, even with shear.
          b.extent.set(Math.hypot(e[0],e[4],e[8]),Math.hypot(e[1],e[5],e[9]),Math.hypot(e[2],e[6],e[10])).multiplyScalar(cellRadius+margin);
        }
      }
      for(const c of l.cells){
        near.length=0;
        if(tips.length){
          // A positive skin-weight blend lies inside the union's enclosing box.
          // Include active morph travel so a sliding hand follows the drawn pose.
          box.makeEmpty();for(const b of c.bones){mid.copy(c.center).applyMatrix4(b.matrix);
            box.expandByPoint(lo.copy(mid).sub(b.extent));box.expandByPoint(hi.copy(mid).add(b.extent));}
           for(const t of tips)if(box.intersectsBox(t.bounds)){
             const bit=1<<t.slot;if(recovering&bit)nearRecovered|=bit;else near.push(t);
           }
        }
        if(!near.length&&!c.active)continue;
        c.active=false;
        for(const v of c.vertices){const i=v.index;let goal=0;tilt.set(0,0,0);
          if(near.length){
            let matrix=v.skin[0].m;
            if(v.skin.length>1){const e=blend.elements;e.fill(0);
              for(let j=0;j<v.skin.length;j++){const {m,w}=v.skin[j],a=m.elements;for(let k=0;k<15;k++)e[k]+=a[k]*w;}
              e[15]=1;matrix=blend;}
            p.copy(v.p);for(const m of l.activeMorphs)p.addScaledVector(tmp.fromBufferAttribute(m.attr,i),m.weight);
            p.applyMatrix4(matrix);linear.setFromMatrix4(matrix);n.copy(v.n).applyMatrix3(linear);const scale=n.length();
            if(scale>1e-8){n.multiplyScalar(1/scale);linear.transpose();
              for(const t of near){
                const along=Math.max(0,Math.min(1,delta.subVectors(p,t.start).dot(t.axis)*t.invLengthSq));
                delta.addScaledVector(t.axis,-along);const height=-delta.dot(n),r=t.r;
                const fine=Math.min(1,5-v.edge*scale/r);
                if(!(fine>0 && v.edge>0) || height>=r || height<=-2.5*r)continue;
                delta.addScaledVector(n,height);const footprint=2.3*r,lateralSq=delta.lengthSq(),f=1-lateralSq/(footprint*footprint);if(f<=0)continue;
                if(lateralSq<t.distSq){t.distSq=lateralSq;tipBroadGain[t.slot]=1-Math.min(1,Math.max(0,1+height/(1.4*r)))*Math.min(1,f*2)*fine;}
                // Plane penetration at a real posed vertex; quartic radial falloff.
                // Fade out inside the surface, where the broad pressure takes over.
                const depth=v.weight*fine*Math.min(.0038/scale,shoulderWidth*.009,(r-height)*.8/scale)*Math.min(1,(height/r+2.5)/1.5);
                const d=depth*f*f;if(d<=goal)continue;goal=d;
                tilt.copy(delta).applyMatrix3(linear).multiplyScalar(-4*depth*f/(footprint*footprint));
                tilt.addScaledVector(v.n,-tilt.dot(v.n)/v.n.lengthSq());
              }
            }
          }
          if(!goal&&!v.depth)continue;
          const alpha=goal>v.depth?attack:release;v.depth+=(goal-v.depth)*alpha;v.tilt.lerp(tilt,alpha);
          if(!goal && v.depth<shoulderWidth*1e-6){v.depth=0;v.tilt.set(0,0,0);continue;}
          if(!v.depth)continue;
          p.copy(v.p).addScaledVector(v.n,-v.depth*strength);n.copy(v.n).addScaledVector(v.tilt,strength).normalize();
          l.position.setXYZ(i,p.x,p.y,p.z);l.normal.setXYZ(i,n.x,n.y,n.z);
          first=Math.min(first,i);last=Math.max(last,i);c.active=active=true;l.active.push(v);
        }
      }
      dirty(l.position,first,last);dirty(l.normal,first,last);
    }
    if(recovering)for(const t of tips){const bit=1<<t.slot;if(!(recovering&bit))continue;
      if(nearRecovered&bit)clearTime[t.slot]=0;
      else if((clearTime[t.slot]+=seconds)>=2/60){recovering&=~bit;clearTime[t.slot]=0;tipBroadGain[t.slot]=1;}
    }
    restored=!active;
    return tipBroadGain;
  }
  return {apply,restore,reset,tipBroadGain,candidates};
}

/** Build only while tracked fingertips are eligible. Bound work between clock
 * checks: first tracking on a large rig must not run a full topology scan in
 * one XR callback. The broad response remains available while this warms. */
export function beginFingertipFit(mesh:SkinnedMesh,pads:readonly Bone[],width:number){
  const work=prepareSurface(mesh,pads,width);
  return (budgetMs=.65)=>{
    const deadline=performance.now()+budgetMs;
    do {const step=work.next();if(step.done)return step.value;}while(performance.now()<deadline);
    return undefined;
  };
}
