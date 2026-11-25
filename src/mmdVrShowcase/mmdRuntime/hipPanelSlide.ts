import {Matrix4,Vector3,type Bone,type SkinnedMesh} from 'three';
import type {ThighShell} from './thighShell';
import type {ClothCrossing} from './clothCrossing';

type Strip={angle:number;links:{bone:Bone}[];side:number};
export type HipSurface={field:Pick<ThighShell,'clearance'>;crossing?:Pick<ClothCrossing,'crosses'>;depth?:((p:Vector3,side:number)=>number)&{upper?:(p:Vector3)=>number};toLocal:Matrix4;toLap:Matrix4;length:number};
const V=()=>new Vector3(),ease=(a:number,b:number,t:number)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};

/** Evaluate a continuous slide of the same strip in both layers. No vertex
 * is projected onto a leg: probes only score possible translations of bones. */
export function fitHipPanelSlide(mesh:SkinnedMesh,columns:Strip[],lapBind:Matrix4){
  const bones=mesh.skeleton.bones,ids=new Map(bones.map((b,i)=>[b,i])),weights=[new Float32Array(bones.length),new Float32Array(bones.length)];
  const moved:{bone:Bone;weight:number;parent:number;side:number}[]=[];
  for(const c of columns){const ang=Math.abs(c.angle),w=ease(.32,.91,ang)*(1-ease(1.55,2.06,ang));
    for(let j=0;j<c.links.length;j++){const b=c.links[j].bone,v=w*ease(0,.32,j/(c.links.length-1));weights[c.side][ids.get(b)!]=v;
      if(j&&v)moved.push({bone:b,weight:v,parent:weights[c.side][ids.get(b.parent as Bone)!],side:c.side});}}
  const draws:SkinnedMesh[]=mesh.userData.mmdMorphSplitBodyMeshes?.length?mesh.userData.mmdMorphSplitBodyMeshes:[mesh];
  type Probe={body:SkinnedMesh;i:number;w:number;layer:number;p:Vector3};
  type Face={a:Probe;b:Probe;c:Probe;layer:number};
  const groups:[Probe[],Probe[]]=[[],[]],fans:[Face[],Face[]]=[[],[]],all:[Probe[],Probe[]]=[[],[]],q=V(),dst=V(),normal=V();
  for(const body of draws){const g=body.geometry,{position,skinIndex,skinWeight}=g.attributes,ix=g.index;if(!ix||!skinIndex||!skinWeight)continue;
    const visits=position.count<=650000?new Uint32Array(position.count):null;
    for(const [gi,gr] of g.groups.entries()){const layer=body.userData.mmdMorphSplitBody?.materialIndex??gr.materialIndex??0;
      const selected=new Set<string>();const ids=[new Map<number,Probe>(),new Map<number,Probe>()];
      for(let k=gr.start;k<gr.start+gr.count;k++){const i=ix.getX(k);
        if(visits){if(visits[i]===gi+1)continue;visits[i]=gi+1;}q.fromBufferAttribute(position,i).applyMatrix4(lapBind);
        if(q.y>.32||q.y<-.70||Math.abs(q.x)<.09||q.z<-.32)continue;
        const side=q.x>0?0:1;let w=0;for(let j=0;j<4;j++)w+=skinWeight.getComponent(i,j)*weights[side][skinIndex.getComponent(i,j)];
        if(w<.03||ids[side].has(i))continue;const pt={body,i,w,layer,p:V()};ids[side].set(i,pt);all[side].push(pt);
        const key=`${Math.floor(q.x*20)},${Math.floor(q.y*20)},${Math.floor(q.z*20)}`;
        if(selected.has(key))continue;selected.add(key);groups[side].push(pt);
      }
      if(ids[0].size||ids[1].size)for(let k=gr.start;k<gr.start+gr.count;k+=3){const first=ix.getX(k),side=ids[0].has(first)?0:1,m=ids[side],a=m.get(first);
        if(!a)continue;const b=m.get(ix.getX(k+1)),c=m.get(ix.getX(k+2));if(b&&c)fans[side].push({a,b,c,layer});}
    }}
  const slide=[V(),V()],inv=new Matrix4(),mats=[mesh.material].flat(),d=V(),shift=V();
  const before=new Int32Array(mats.length),after=new Int32Array(mats.length),peak=new Float32Array(mats.length),exact=new Float64Array(mats.length);
  const a=V(),b=V(),c=V(),proposed=V(),pressure=V(),worst=V(),along=V(),ranked=Array.from({length:18},()=>({d:V(),cost:0}));
  const directions=Array.from({length:6},V);
  const refs=groups.map(list=>list.filter((p,i)=>i%Math.max(1,Math.ceil(list.length/24))===0).map(p=>({p,ref:V()})));
  const exactRefs:[Probe[],Probe[]]=[[],[]],lastEnv:(HipSurface|undefined)[]=[];
  const clock=[0,0];
  return (worldToLap:Matrix4,lapToWorld:Matrix4,thighs:HipSurface[],cached:boolean)=>{
    if(!cached)for(let side=0;side<2;side++){const s=thighs[side],probes=groups[side],drift=refs[side];if(!s?.crossing||!s.depth||!probes.length||probes.length>600||fans[side].length>3000||all[side].length>4200){slide[side].set(0,0,0);continue;}
      const read=(p:Probe)=>p.body.getVertexPosition(p.i,p.p).applyMatrix4(p.body.matrixWorld).applyMatrix4(worldToLap).applyMatrix4(s.toLocal);
      const previous=lastEnv[side]===s;clock[side]++;let movement=0;for(const x of drift)movement=Math.max(movement,read(x.p).distanceToSquared(x.ref));
      // A new body pose needs one fit, not an exhaustive search at every
      // Bullet tick. Reopen only after several cloth steps and actual travel.
      const solve=!previous||clock[side]>=12&&movement>.065**2;
      if(!solve){const t=slide[side];if(!t.lengthSq())continue;proposed.copy(t).transformDirection(s.toLocal).multiplyScalar(t.length()/s.length);
        // Check the previously most buried cloth from *this* displayed frame.
        // If either layer starts moving through its thigh, withdraw the whole
        // panel. Never wait for the next expensive solve to revoke a bad slide.
        for(const p of exactRefs[side]){const before=read(p);if(s.field.clearance(before,normal)<-.07&&s.field.clearance(q.copy(before).addScaledVector(proposed,p.w),normal)<-.07)continue;
          const raw=s.depth(dst.copy(before).applyMatrix4(s.toLap),side),after=s.depth(dst.copy(before).addScaledVector(proposed,p.w).applyMatrix4(s.toLap),side);
          if(after>raw+.006){t.set(0,0,0);break;}}
        continue;}
      slide[side].set(0,0,0);lastEnv[side]=s;clock[side]=0;for(const x of drift)x.ref.copy(x.p.p);exactRefs[side].length=0;
      for(const p of all[side])p.body.getVertexPosition(p.i,p.p).applyMatrix4(p.body.matrixWorld).applyMatrix4(worldToLap).applyMatrix4(s.toLocal);
      function score(travel:Vector3){let sum=0,peak=0;for(const p of probes){const material=mats[p.layer];if(!material?.visible||material.opacity<.04)continue;
        dst.copy(p.p).addScaledVector(travel,p.w);const depth=s.field.clearance(dst,normal);if(depth<=-.005)continue;
        const v=depth+.005;peak=Math.max(peak,v);sum+=v*v;}return sum+peak*peak*2;}
      function crossing(travel:Vector3,tally:Int32Array){tally.fill(0);let count=0;for(const f of fans[side]){if(!mats[f.layer].visible||mats[f.layer].opacity<.04)continue;
        if(s.crossing!.crosses(a.copy(f.a.p).addScaledVector(travel,f.a.w),b.copy(f.b.p).addScaledVector(travel,f.b.w),c.copy(f.c.p).addScaledVector(travel,f.c.w))){tally[f.layer]++;count++;}}return count;}
      const original=score(slide[side]);if(original<.0002)continue;let n=0;peak.fill(0);
      for(const p of all[side])peak[p.layer]=Math.max(peak[p.layer],s.field.clearance(p.p,normal));
      function inside(travel:Vector3){for(const p of all[side]){dst.copy(p.p).addScaledVector(travel,p.w);const depth=s.field.clearance(dst,normal);
        // Cap the fitted depth too. This open-shell estimate is supplementary
        // to the independent parity/closest-triangle audit on the full leg.
        if(depth>peak[p.layer]+.006)return false;}return true;}
      pressure.set(0,0,0);worst.set(0,0,0);let maxDepth=0;
      for(const p of probes){const depth=s.field.clearance(p.p,normal);if(depth<=0)continue;
        pressure.addScaledVector(normal,depth*p.w);if(depth>maxDepth){maxDepth=depth;worst.copy(normal);}}
      pressure.transformDirection(s.toLap);worst.transformDirection(s.toLap);along.set(0,1,0).transformDirection(s.toLap);
      directions[0].copy(pressure);directions[1].copy(worst);directions[2].set(0,1,0).addScaledVector(pressure,.7).normalize();
      directions[3].copy(pressure).addScaledVector(along,.8).normalize();directions[4].set(side?-1:1,.65,0).normalize();directions[5].copy(worst).addScaledVector(along,-.67).normalize();
      for(const direction of directions){d.copy(direction);
        for(const travel of [.055,.11,.19]){q.copy(d).transformDirection(s.toLocal).multiplyScalar(travel/s.length);
          const r=ranked[n++];r.cost=score(q)+.04*travel*travel;r.d.copy(d).multiplyScalar(travel);}}
      ranked.sort((a,b)=>a.cost-b.cost);if(ranked[0].cost>original*.96)continue;
      let best=crossing(q.set(0,0,0),before);if(!best)continue;
      for(let j=0,tests=0;j<ranked.length&&tests<6;j++){const r=ranked[j];if(r.cost>original*.96)break;
        proposed.copy(r.d).transformDirection(s.toLocal).multiplyScalar(r.d.length()/s.length);if(!inside(proposed))continue;tests++;
        const count=crossing(proposed,after);
        if(count<best&&after.every((x,i)=>x<=before[i])){slide[side].copy(r.d);best=count;}}
      if(slide[side].lengthSq()){
        const witnesses=new Map<number,Probe>();exact.fill(0);for(const p of all[side])if(s.field.clearance(p.p,normal)>-.045){dst.copy(p.p).applyMatrix4(s.toLap);if(s.depth.upper&&s.depth.upper(dst)<=exact[p.layer])continue;
          const depth=s.depth(dst,side);if(depth>exact[p.layer]){exact[p.layer]=depth;witnesses.set(p.layer,p);}}
        proposed.copy(slide[side]).transformDirection(s.toLocal).multiplyScalar(slide[side].length()/s.length);
        for(const p of all[side]){dst.copy(p.p).addScaledVector(proposed,p.w);if(s.field.clearance(dst,normal)<=-.045)continue;
          dst.applyMatrix4(s.toLap);if(s.depth.upper&&s.depth.upper(dst)<=exact[p.layer]+.001)continue;
          if(s.depth(dst,side)>exact[p.layer]+.001){slide[side].set(0,0,0);break;}}
        exactRefs[side].push(...witnesses.values());
      }
    }
    // Add only the difference from the parent's offset. This translates a
    // patch without changing its bone orientations, authored fold or UV seams.
    const e=lapToWorld.elements,scale=Math.hypot(e[0],e[1],e[2]);
    for(const {bone,weight,parent,side}of moved){const t=slide[side];if(!t.lengthSq())continue;
      const m=bone.parent!.matrixWorld.elements,s=Math.hypot(m[0],m[1],m[2]);
      shift.copy(t).transformDirection(lapToWorld).transformDirection(inv.copy(bone.parent!.matrixWorld).invert()).multiplyScalar(t.length()*scale*(weight-parent)/s);
      bone.position.add(shift);bone.updateWorldMatrix(false,false);}
    for(const c of columns)if(slide[c.side].lengthSq())c.links[0].bone.updateWorldMatrix(false,true);
  };
}
