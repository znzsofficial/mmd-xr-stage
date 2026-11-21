import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { heightAt } from './site';
import type { Piece } from './pieces';

// One indexed mesh per finish/solid layer; casting, sightlines and locomotion
// use the real inclined prism, not a stack of level planks or a heavy CSG.
export function profiles(parts:readonly Piece[]){
  const p:number[]=[],rgb:number[]=[],ix:number[]=[],ink=new Color();
  for(const s of parts){
    ink.set(s.ink);
    const c=[[s.l,s.b],[s.l,s.f],[s.r,s.f],[s.r,s.b]].map(([x,z])=>[x,heightAt(s,x,z)+(s.y===0&&!s.sx&&!s.sz?.003:0),z]);
    c.push(...c.map(([x,y,z])=>[x,y-s.thick,z]));
    for(const [k,face] of [[0,1,2,3],[7,6,5,4],[1,0,4,5],[2,1,5,6],[3,2,6,7],[0,3,7,4]].entries()){
      const n=p.length/3,shade=k===0?1:k===1?.75:k%2?.93:.88;
      for(const i of face){p.push(...c[i]);rgb.push(ink.r*shade,ink.g*shade,ink.b*shade);}ix.push(n,n+1,n+2,n,n+2,n+3);
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(rgb,3));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
