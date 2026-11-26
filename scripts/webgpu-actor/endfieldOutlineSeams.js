import { parsePmxSectionInventory } from '@yohawing/three-mmd-loader/parser';
import { Vector3 } from 'three/webgpu';

// The sparse TSL path deliberately omits dense morphs. Read just the exact
// position-morph memberships/deltas from the SAME source PMX, using the
// loader's validated section inventory. No second model or dense morph atlas.
function sparseSignatures(bytes, n) {
  const data = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength) : new Uint8Array(bytes);
  const {counts,header,sections} = parsePmxSectionInventory(data);
  if (counts.vertices !== n) return null;
  const section = sections.find(s=>s.name==='morphs'), d = new DataView(data.buffer,data.byteOffset,data.byteLength);
  const ix = header.indexSizes, stride = [ix.morph+4,ix.vertex+12,ix.bone+28,...Array(5).fill(ix.vertex+16),ix.material+113,ix.morph+4,ix.rigidBody+25];
  const signatures = new Map(); let pos = section.offset;
  for (let m=0; m<counts.morphs; m++) {
    for (let name=0; name<2; name++) pos += 4 + d.getInt32(pos,true);
    const type = d.getUint8(pos+1), count = d.getInt32(pos+2,true); pos+=6;
    if (type === 1) for (let i=0; i<count; i++) {
      const p = pos+i*stride[type], k=p+ix.vertex;
      const v=ix.vertex===4 ? d.getUint32(p,true) : ix.vertex===2 ? d.getUint16(p,true) : d.getUint8(p);
      const x=d.getFloat32(k,true),y=d.getFloat32(k+4,true),z=d.getFloat32(k+8,true);
      if (v>=n || ![x,y,z].every(Number.isFinite)) return null;
      if (x || y || z) signatures.set(v,(signatures.get(v) ?? '')+`${m}:${x},${y},${z};`);
    }
    pos+=stride[type]*count;
  }
  return pos===section.offset+section.byteLength ? signatures : null;
}

function morphMatch(mesh, bytes) {
  const g=mesh.geometry, metadata=mesh.userData.mmdMorphs;
  const dense=g.morphAttributes.position;
  if (dense?.length && (!metadata || dense.length===metadata.length) && dense.every(a=>a?.count===g.attributes.position.count)) {
    return (i,j)=>dense.every(a=>a.getX(i)===a.getX(j) && a.getY(i)===a.getY(j) && a.getZ(i)===a.getZ(j));
  }
  if (metadata ? metadata.every(m=>!['vertex','base','unknown'].includes(m.type)) : !mesh.morphTargetInfluences?.length) return ()=>true;
  if (bytes) {
    try {
      const s=sparseSignatures(bytes,g.attributes.position.count);
      if (s) return (a,b)=>s.get(a)===s.get(b);
    } catch { /* Different/unsupported container: don't assume absent deltas. */ }
  }
  return null;
}

// Position keys only find CANDIDATES. Reject >2 IDs at a point (including
// third-party material panels); never use proximity or merge geometry.
export function seamEvidence(mesh, bytes) {
  const g=mesh.geometry, {position:p, normal:N, uv, skinWeight:w, skinIndex:b, matricesSdefEnabled:sdef, matricesQdefEnabled:qdef}=g.attributes;
  const morph=morphMatch(mesh,bytes);
  if (!morph || !uv || !w || !b) return null;
  const reps=new Map(), twin=new Int32Array(p.count).fill(-1), used=new Uint8Array(p.count);
  for (const {start,count} of g.groups) for(let k=start;k<start+count;k++) {
    const i=g.index ? g.index.getX(k):k; if(used[i])continue; used[i]=1;
    const key=`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`, first=reps.get(key);
    if(first===undefined)reps.set(key,i);
    else if(twin[first]===-1){twin[first]=i;twin[i]=first;}
    else { if(twin[first]>=0)twin[twin[first]]=-2; twin[first]=twin[i]=-2; }
  }
  const n1=new Vector3(),n2=new Vector3();
  return { twin, compatible(i,j) {
    if (twin[i]!==j || sdef?.getX(i) || sdef?.getX(j) || qdef?.getX(i) || qdef?.getX(j) || !morph(i,j)) return false;
    if (uv.getX(i)===uv.getX(j) && uv.getY(i)===uv.getY(j)) return false;
    if (n1.fromBufferAttribute(N,i).normalize().dot(n2.fromBufferAttribute(N,j).normalize()) < Math.cos(Math.PI/6)) return false;
    for(let k=0;k<4;k++) if(w.getComponent(i,k)!==w.getComponent(j,k) || (w.getComponent(i,k) && b.getComponent(i,k)!==b.getComponent(j,k))) return false;
    return true;
  }};
}

// A reverse directed, unique boundary half-edge from this very draw. The two
// outward face normals agree (third corners lie on opposite sides of the
// edge); coincident overlays, flips and hard panel hinges cannot pass.
export function pairChartEdges(edges,evidence,locked,shared,out,normal,stats,panel) {
  const pairs=new Map(), n=normal.count, done=new Set(), islands=new Map();
  if (!evidence) return pairs;
  const {twin,compatible}=evidence;
  function admit(e,other) {
    pairs.set(e.i,other.v); pairs.set(e.v,other.i); stats.pairedSeamEdges++;
  }
  for(const e of edges.values()) {
    if(e.count!==1 || done.has(e))continue;
    const a=twin[e.i], b=twin[e.v]; if(a<0||b<0)continue;
    const other=edges.get(Math.min(a,b)*n+Math.max(a,b));
    if(other?.count!==1 || other.i!==b || other.v!==a || other.face.dot(e.face)<Math.cos(Math.PI/8))continue;
    if([e.i,e.v,a,b].some(i=>locked.has(i)||shared[i]||!(out[4*i+3]>0)))continue;
    if(out[4*a+3]!==out[4*e.i+3] || out[4*b+3]!==out[4*e.v+3] || !compatible(e.i,a) || !compatible(e.v,b))continue;
    done.add(e);done.add(other);
    const A=panel(e.i), B=panel(a);
    if(A===B) {admit(e,other); continue;}
    // Two islands could simply be two independent hair cards touching at
    // their tips. Require a closed, manifold run of proven twin edges around
    // the chart; an incomplete/ambiguous ring or a point contact stays locked.
    const key=Math.min(A,B)*n+Math.max(A,B), list=islands.get(key) ?? [];
    list.push(A<B ? [e,other]:[other,e]);islands.set(key,list);
  }
  for(const list of islands.values()) {
    const adjacent=new Map(),seen=new Set();
    for(const pair of list) for(const i of [pair[0].i,pair[0].v]) {
      const a=adjacent.get(i) ?? [];a.push(pair);adjacent.set(i,a);
    }
    for(const start of list) {
      if(seen.has(start))continue;
      const component=[start];seen.add(start);let closed=true;
      for(let k=0;k<component.length;k++) for(const i of [component[k][0].i,component[k][0].v]) {
        const around=adjacent.get(i);if(around.length!==2)closed=false;
        for(const p of around)if(!seen.has(p)){seen.add(p);component.push(p);}
      }
      if(closed && component.length>=3)for(const [a,b] of component)admit(a,b);
    }
  }
  return pairs;
}
