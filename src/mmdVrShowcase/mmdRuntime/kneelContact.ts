import {Matrix4,Vector3,type Material,type SkinnedMesh} from 'three';
import type {MmdModel} from '@yohawing/three-mmd-loader/parser';
import {clothMorphGuard} from './clothMorphGuard';
import {safeClothScale,type ClothPoint} from './clothStrain';
import {measureKneeSurface,type KneeFace} from './kneelSurface';
import {kneelFaceBudget} from './kneelFaceBudget';
import {ThighShell} from './thighShell';

type Body=ReturnType<MmdModel['rigidBodies']>[number];
type Leg={hip:number;knee:number;weights:Set<number>;skin?:{mesh:SkinnedMesh;material:Material}};
type Vertex={index:number;weld:number;mask:number};
type Patch<T extends Vertex>={mesh:SkinnedMesh;shown:boolean;vertices:T[];faces:T[]};
type Edge={a:number;b:number;c:number};
const V=()=>new Vector3();
const MAX_SKIN_FACES=6800,MAX_FAN=24,MAX_SEEDS=12,MAX_QUERIES=900,MAX_LAYER_FACES=24000;

function outside(p:Vector3,lo:Vector3,hi:Vector3){
  return (p.x<lo.x?1:p.x>hi.x?2:0)|(p.y<lo.y?4:p.y>hi.y?8:0)|(p.z<lo.z?16:p.z>hi.z?32:0);
}

// A separate contact AFTER the thigh solution. No new Bullet bodies and no
// displacement borrowed from a different layer or an old simulation frame.
export function fitKneelContact<T extends Vertex>(mesh:SkinnedMesh,pelvis:number,legs:Leg[],skirts:Map<number,number>,patches:Patch<T>[],nodes:ClothPoint[],edges:Edge[],
  bind:(v:T,patch:number,d:Vector3)=>void){
  const {bones,boneInverses}=mesh.skeleton,raw:Body[]=mesh.userData.mmdPhysics.rigidBodies;
  const labels=bones.map(b=>[b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].flatMap(n=>typeof n==='string'?[n.normalize('NFKC').toLowerCase().replace(/[ _.-]/g,'').replace(/d$/,'')]:[]));
  const match=(keys:string[])=>labels.flatMap((ns,i)=>ns.some(n=>keys.includes(n))?[i]:[]);
  const calf=legs.map((l,side)=>{const jp=side?'右':'左',en=side?'right':'left';
    const ankle=match([jp+'足首',en+'ankle',en+'foot'])[0],lower=new Set(match([jp+'ひざ',jp+'膝',en+'knee',en+'shin',en+'lowerleg']));
    const bodies=raw.filter(b=>b.mode==='static'&&lower.has(b.boneIndex));
    const allowed=new Set(raw.filter(b=>skirts.has(b.boneIndex)&&b.mode!=='static'&&bodies.some(c=>(b.mask&(1<<c.group))&&(c.mask&(1<<b.group)))).map(b=>b.boneIndex));
    return {ankle,lower,allowed,knee:l.knee};});
  if(calf.some(c=>c.ankle===undefined||!c.allowed.size))return null;
  // Fit from the very same draw which wrapped BOTH upper legs. Refuse to
  // invent an unseen calf or choose a second material by its texture name.
  const skin=legs[0].skin;if(!skin||legs[1].skin?.mesh!==skin.mesh||legs[1].skin.material!==skin.material)return null;
  const skinMesh=skin.mesh,skinMaterial=skin.material;
  const tmp=V(),up=V(),a=V(),b=V(),c=V(),local=new Matrix4(),inverse=new Matrix4();
  const world=(i:number,v:Vector3)=>v.setFromMatrixPosition(bones[i].matrixWorld);
  const rest=(i:number)=>V().setFromMatrixPosition(boneInverses[i].clone().invert());
  const front=rest(legs[0].hip).sub(rest(legs[1].hip)).cross(V().set(0,1,0)).normalize();
  function kneeling(){if(tmp.copy(front).transformDirection(local.multiplyMatrices(bones[pelvis].matrixWorld,boneInverses[pelvis])).y>.5)return false;
    return calf.every((s,i)=>{
    const thigh=up.subVectors(world(s.knee,a),world(legs[i].hip,b)).normalize();
    const shin=tmp.subVectors(world(s.ankle,c),a).normalize();
    // Knees support the hips, with the returned calves near horizontal. A
    // supine/side leg fold is not a kneeling pressure source.
    return thigh.y<-.52&&Math.abs(shin.y)<.56&&thigh.dot(shin)<.22;});}

  function fit(){
    const g=skinMesh.geometry,ix=g.index!,{skinIndex:si,skinWeight:sw,matricesSdefEnabled:sdef,matricesQdefEnabled:qdef,position}=g.attributes;
    const mats=[mesh.material].flat(),weights=[...legs.map(l=>l.weights),...calf.map(s=>s.lower)],points=new Map<number,Vector3>();
    const faces:{ids:number[];zone:number}[]=[],covered=calf.map(()=>new Set<number>()),checks=new Map<number,Matrix4>();
    const knees=calf.map(s=>rest(s.knee)),lengths=calf.map((s,i)=>rest(s.ankle).distanceTo(knees[i]));
    if(lengths.some(l=>!Number.isFinite(l)||l<1e-5))return null;
    for(const group of g.groups){if(mats[skinMesh.userData.mmdMorphSplitBody?.materialIndex??group.materialIndex??0]!==skinMaterial)continue;
      for(let k=group.start;k<group.start+group.count;k+=3){const ids=[ix.getX(k),ix.getX(k+1),ix.getX(k+2)],w=[0,0,0,0];
        for(const i of ids)for(let j=0;j<4;j++){const bone=si.getComponent(i,j),weight=sw.getComponent(i,j);if(weight)for(let z=0;z<4;z++)if(weights[z].has(bone))w[z]+=weight;}
        if(w[0]+w[1]+w[2]+w[3]<1.5)continue;
        if(ids.some(i=>sdef?.getX(i)||qdef?.getX(i))||faces.length>=MAX_SKIN_FACES)return null;
        const zone=w.indexOf(Math.max(...w));faces.push({ids,zone});
        for(const i of ids){if(!points.has(i))points.set(i,V());
          for(let j=0;j<4;j++)if(sw.getComponent(i,j)>0){const bone=si.getComponent(i,j);if(!checks.has(bone))checks.set(bone,new Matrix4());}
          if(zone<2||w[zone]<2)continue;const s=zone-2,p=tmp.fromBufferAttribute(position,i).sub(knees[s]),t=-p.y/lengths[s];
          if(t>.06&&t<.9)covered[s].add(8*Math.min(2,Math.floor((t-.06)/.28))+(Math.floor((Math.atan2(p.z,p.x)+Math.PI)*4/Math.PI)%8));}
      }}
    if(covered.some(c=>c.size<18))return null;
    const morph=clothMorphGuard(mesh,new Map([[skinMesh,new Set(points.keys())]]),new Set());
    // Each trial owns an entire welded fan. Don't move boundary points or a
    // seam shared with another material: those faces may have different masks.
    const fan=nodes.map(()=>[] as Edge[]),members=nodes.map(()=>[] as T[]),owner=new Int32Array(nodes.length).fill(-1),permissions=new Uint8Array(nodes.length).fill(3),degree=new Uint32Array(nodes.length);
    for(const f of edges){degree[f.a]++;degree[f.b]++;degree[f.c]++;}
    patches.forEach((patch,pi)=>{const {skinIndex,skinWeight}=patch.mesh.geometry.attributes;
      for(const v of patch.vertices){const id=v.weld;members[id].push(v);owner[id]=owner[id]===-1||owner[id]===pi?pi:-2;
        for(const [s,side] of calf.entries()){let allow=0,leg=0;for(let j=0;j<4;j++){const bone=skinIndex.getComponent(v.index,j),w=skinWeight.getComponent(v.index,j);if(side.allowed.has(bone))allow+=w;if(side.lower.has(bone))leg+=w;}
          if(allow<.46||!(v.mask&(1<<s)))permissions[id]&=~(1<<s);if(leg>.001)permissions[id]=0;}}
      for(let k=0;k<patch.faces.length;k+=3){const f={a:patch.faces[k].weld,b:patch.faces[k+1].weld,c:patch.faces[k+2].weld};for(const id of [f.a,f.b,f.c])fan[id].push(f);}
    });
    const eligible=nodes.flatMap((_,i)=>owner[i]>=0&&fan[i].length&&fan[i].length===degree[i]&&degree[i]<=MAX_FAN&&permissions[i]?[i]:[]);
    const permitted=permissions.slice();for(const id of eligible)for(const f of fan[id])permitted[id]&=permissions[f.a]&permissions[f.b]&permissions[f.c];
    const bound=safeClothScale(),faceBudget=kneelFaceBudget(),zero=V(),normal=V(),test=V(),allowed=new Set(eligible),lo=V(),hi=V();
    const zoneLength=new Float64Array(4),before=new Float64Array(4),after=new Float64Array(4),beforeFaces=new Uint32Array(4),afterFaces=new Uint32Array(4);
    const current=(id:number,v:Vector3)=>v.copy(nodes[id].p).add(nodes[id].d);
    let shells:{field:ThighShell;toLocal:Matrix4;toModel:Matrix4}[]=[],measure:ReturnType<typeof measureKneeSurface>;
    function seed(){shells=[];if(morph.blocked())return;
      inverse.copy(mesh.matrixWorld).invert();for(const [i,m] of checks)m.multiplyMatrices(inverse,bones[i].matrixWorld);
      for(const [i,p] of points)skinMesh.getVertexPosition(i,p);
      const drawn:KneeFace[]=faces.map(({ids,zone})=>({a:points.get(ids[0])!,b:points.get(ids[1])!,c:points.get(ids[2])!,zone}));
      for(const [s,k] of calf.entries()){const start=world(k.knee,a).applyMatrix4(inverse),y=world(k.ankle,b).applyMatrix4(inverse).sub(start).normalize();
        const x=V().set(1,0,0).transformDirection(local.multiplyMatrices(inverse,bones[k.knee].matrixWorld).multiply(boneInverses[k.knee]));x.addScaledVector(y,-x.dot(y)).normalize();if(x.lengthSq()<.95){shells=[];return;}
        const toModel=new Matrix4().makeBasis(x,y,V().crossVectors(x,y)).scale(tmp.setScalar(lengths[s])).setPosition(start),toLocal=toModel.clone().invert(),field=new ThighShell();
        for(const f of drawn)if(f.zone===s+2)field.add(a.copy(f.a).applyMatrix4(toLocal),b.copy(f.b).applyMatrix4(toLocal),c.copy(f.c).applyMatrix4(toLocal));shells.push({field,toModel,toLocal});}
      measure=measureKneeSurface(drawn,lengths[0]);}
    function valid(){if(shells.length!==2||!skinMaterial.visible||skinMaterial.opacity<.04||morph.blocked())return false;
      inverse.copy(mesh.matrixWorld).invert();for(const [i,m] of checks){const e=local.multiplyMatrices(inverse,bones[i].matrixWorld).elements;
        for(let k=0;k<16;k++)if(Math.abs(e[k]-m.elements[k])>1e-4)return false;}return true;}
    function present(){let moved=false,queries=0,layerFaces=0;const ledger=new Map<Edge,Float64Array>(),original=new Map<number,Vector3>(),layered=patches.filter(p=>p.shown&&p.faces.length).length>1;
      function lengthsAt(f:Edge){let l=ledger.get(f);if(!l){queries++;l=new Float64Array(4);measure(current(f.a,a),current(f.b,b),current(f.c,c),l);ledger.set(f,l);}return l;}
      for(const [side,sh] of shells.entries()){
        const candidates:{id:number;depth:number}[]=[],used=new Set<number>();
        for(const id of eligible){if(!(permitted[id]&(1<<side))||!patches[owner[id]].shown)continue;
          const d=sh.field.clearance(current(id,a).applyMatrix4(sh.toLocal),normal);if(d>.002)candidates.push({id,depth:d});}
        candidates.sort((a,b)=>b.depth-a.depth);
        for(const {id} of candidates.slice(0,MAX_SEEDS)){if(used.has(id))continue;const pi=owner[id],z=side+2;
          // Sparse panels span the calf even when their edge endpoints are
          // outside. Try the contact and its directly connected fabric first.
          const extend=(from:Set<number>)=>{const ring=new Set(from);for(const i of from)for(const f of fan[i])for(const j of [f.a,f.b,f.c])if(allowed.has(j)&&owner[j]===pi&&(permitted[j]&(1<<side))&&!used.has(j))ring.add(j);return ring;};
          const ring=extend(new Set([id])),region2=extend(ring),center=current(id,V()),centerDepth=sh.field.clearance(a.copy(center).applyMatrix4(sh.toLocal),normal),outward=normal.clone().transformDirection(sh.toModel);
          // Multiple independent sheets can lie one over another with different
          // bindings. In that case only the measured point may move, never
          // entrain a free ring (and with it the train's outer silhouette).
          for(const region of layered?[[id]]:[region2,ring,[id]]){const trial=new Map<number,ClothPoint>(),affected=new Set<Edge>(),offset=new Map<number,Vector3>();
            for(const j of region){const dist=current(j,a).distanceTo(center)/lengths[side];if(dist>.38)continue;
              const d=sh.field.clearance(a.applyMatrix4(sh.toLocal),normal);let push:Vector3;
              if(region===region2){const carry=Math.min(1,(.38-dist)/.20);push=outward.clone().multiplyScalar(carry*Math.min(.14,centerDepth+.045)*lengths[side]);}
              else {if(d<=-.02)continue;push=normal.clone().transformDirection(sh.toModel).multiplyScalar(Math.min(.14,d+.038)*lengths[side]);}
              if(sh.field.clearance(current(j,test).add(push).applyMatrix4(sh.toLocal),normal)>Math.max(.002,d+.002))continue;
              if(queries+fan[j].length>MAX_QUERIES)return moved;if(j!==id&&fan[j].some(f=>lengthsAt(f).some((l,k)=>k!==z&&l>0)))continue;
              push.clampLength(0,.042*lengths[side]);offset.set(j,push);const p={p:nodes[j].p,d:push.clone().add(nodes[j].d),movable:true};for(const v of members[j])bind(v,pi,p.d);
              if(!p.d.lengthSq())continue;trial.set(j,p);for(const f of fan[j])affected.add(f);}
            if(!trial.has(id))continue;if(queries+affected.size*2>MAX_QUERIES)return moved;
            let fraction=1;for(const f of affected){fraction=faceBudget(current(f.a,a),current(f.b,b),current(f.c,c),trial.has(f.a)?offset.get(f.a)!:zero,trial.has(f.b)?offset.get(f.b)!:zero,trial.has(f.c)?offset.get(f.c)!:zero,fraction);if(fraction<.05)break;}if(fraction<.05)continue;
            for(const [j,p] of trial)p.d.copy(nodes[j].d).addScaledVector(offset.get(j)!,fraction);
            const pt=(j:number)=>trial.get(j)??nodes[j];let safe=true;
            for(const f of affected){if(bound(pt(f.a),pt(f.b),pt(f.c))<1){safe=false;break;}
              // Two independently accepted fans can meet. Their combined edit
              // still owes ONE angular/edge budget to the original thigh fit.
              if(original.has(f.a)||original.has(f.b)||original.has(f.c)){
                const base=(j:number,v:Vector3)=>v.copy(nodes[j].p).add(original.get(j)??nodes[j].d);
                const change=(j:number,v:Vector3)=>v.copy(pt(j).d).sub(original.get(j)??nodes[j].d);
                if(faceBudget(base(f.a,a),base(f.b,b),base(f.c,c),change(f.a,lo),change(f.b,hi),change(f.c,test),1)<1){safe=false;break;}}
            }if(!safe)continue;
            before.fill(0);after.fill(0);beforeFaces.fill(0);afterFaces.fill(0);lo.setScalar(Infinity);hi.setScalar(-Infinity);
            let nBefore=0,nAfter=0;queries+=affected.size;for(const f of affected){const original=lengthsAt(f),vertices=[f.a,f.b,f.c],p=[a,b,c];for(let k=0;k<3;k++){current(vertices[k],p[k]);lo.min(p[k]);hi.max(p[k]);}
              for(let k=0;k<4;k++){before[k]+=original[k];beforeFaces[k]+=Number(original[k]>0);}if(original.some(l=>l>0))nBefore++;
              for(let k=0;k<3;k++){const v=pt(vertices[k]);p[k].copy(v.p).add(v.d);lo.min(p[k]);hi.max(p[k]);}measure(a,b,c,zoneLength);
              for(let k=0;k<4;k++){after[k]+=zoneLength[k];afterFaces[k]+=Number(zoneLength[k]>0);}if(zoneLength.some(l=>l>0))nAfter++;}
            if(nAfter>nBefore||after[z]>=before[z]*.99||after.some((l,k)=>l>before[k]+1e-8*lengths[side]||afterFaces[k]>beforeFaces[k]))continue;
            // Don't pass through another layer while clearing the leg. A box
            // overlap can reject an improvement; it cannot certify a crossing.
            if(patches.some((p,j)=>{if(j===pi||!p.shown)return false;
              for(let k=0;k<p.faces.length;k+=3){if(++layerFaces>MAX_LAYER_FACES)return true;let left=63;for(let h=0;h<3;h++)left&=outside(current(p.faces[k+h].weld,test),lo,hi);if(!left)return true;}return false;})){
              if(layerFaces>MAX_LAYER_FACES)return moved;continue;}
            for(const [j,p] of trial){if(!original.has(j))original.set(j,nodes[j].d.clone());nodes[j].d.copy(p.d);used.add(j);}for(const f of affected)ledger.delete(f);moved=true;break;
          }
        }
      }return moved;}
    return {seed,valid,present};
  }
  let rig:ReturnType<typeof fit>|undefined,active=false;
  return {seed(){active=kneeling();if(active){if(rig===undefined)rig=fit();rig?.seed();}},valid:()=>active&&!!rig?.valid(),present:()=>!!rig?.present()};
}
