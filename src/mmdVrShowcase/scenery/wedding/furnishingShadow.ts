import type {BufferGeometry, Mesh} from 'three';

// Keep every authored ring centre, axial profile, sheet and joint. Only small
// circular cross-sections are allowed a coarser inscribed polygon for depth.
export function ringStride(segments:number,radius:number) {
  for(const stride of [4,3,2]){
    if(segments%stride===0 && segments/stride>=4 && radius*(1-Math.cos(Math.PI*stride/segments))<=.004) return stride;
  }
  return 1;
}

/** Replace a few runs in a second index range; positions, camera indices and
 * their order are byte-for-byte unchanged. One GPU index buffer dies with the
 * original geometry, including when the two tables share it. */
export class FurnishingShadow {
  private runs:{offset:number;end:number;indices:number[]}[]=[];
  rings(offset:number,vertex:number,n:number,rows:number,stride:number) {
    if(stride===1)return;
    const indices:number[]=[];
    for(let j=0;j<rows;j++)for(let i=0;i<n;i+=stride){
      const a=vertex+j*(n+1)+i,b=a+stride,d=a+n+1;
      indices.push(a,b,d,b,d+stride,d);
    }
    this.runs.push({offset,end:offset+6*n*rows,indices});
  }
  fan(offset:number,center:number,n:number,stride:number) {
    if(stride===1)return;
    const indices:number[]=[];
    for(let i=0;i<n;i+=stride)indices.push(center,center+1+i,center+1+(i+stride)%n);
    this.runs.push({offset,end:offset+3*n,indices});
  }
  append(index:number[]) {
    const full=index.length;
    let cursor=0;
    for(const run of this.runs){
      for(;cursor<run.offset;cursor++)index.push(index[cursor]);
      for(const i of run.indices)index.push(i);
      cursor=run.end;
    }
    for(;cursor<full;cursor++)index.push(index[cursor]);
    return full;
  }
}

// r187 WebGLShadowMap gets geometry BEFORE onBeforeShadow; assigning
// mesh.geometry there is too late. renderBufferDirect reads drawRange AFTER
// that hook, and onAfterShadow runs before another caster, camera or eye.
export function furnishingShadowPass(geometry:BufferGeometry):Pick<Mesh,'onBeforeShadow'|'onAfterShadow'> {
  const full=geometry.drawRange.count, coarse=geometry.index!.count-full;
  return {
    onBeforeShadow(){geometry.setDrawRange(full,coarse);},
    onAfterShadow(){geometry.setDrawRange(0,full);},
  };
}
