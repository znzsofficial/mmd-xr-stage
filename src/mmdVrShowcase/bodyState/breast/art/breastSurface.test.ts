import {expect,it} from 'vitest';
import {breastPoint,cutAt,cutMound} from './breastSurface';
import {TAU} from './geometry';
import {grid,VERTEX_STRIDE} from './mesh';

// A deliberately coarse lattice: testing only the production portrait cannot
// catch a consumer using its old column count instead of the mesh's own.
it('samples the back seam and fits both cut edges on a different ring layout',()=>{
  const radii=[.01,.25,.65,1],cols=9;
  const mesh={...grid(radii.length,cols,(turn,row)=>{
    const r=radii[Math.round(row*(radii.length-1))];
    return [r*Math.cos(turn*TAU),r*Math.sin(turn*TAU),r];
  },()=>[1,1,1]),radii};
  for(const [u,v] of [[.45,0],[0,-.45],[-.45,0],[0,.45]]){
    const [x,y,z]=breastPoint(mesh,u,v);
    expect(x).toBeCloseTo(u);expect(y).toBeCloseTo(v);expect(z).toBeCloseTo(.45);
  }
  const {skin,face}=cutMound(mesh);
  const vertex=(data:Float32Array,i:number)=>data.subarray(i*VERTEX_STRIDE,i*VERTEX_STRIDE+3);
  for(const [row,r] of radii.entries()){
    const upper=vertex(skin.data,row*cols),lower=vertex(skin.data,(row+1)*cols-1);
    expect([...upper,...lower].every(Number.isFinite)).toBe(true);
    // The sampler stops just inside the outermost ring. Compare the other
    // rings directly with the boundaries of the trimmed skin.
    if(r<1)for(let axis=0;axis<3;axis++){
      expect(vertex(face.data,row*face.cols)[axis]).toBeCloseTo(lower[axis],5);
      expect(vertex(face.data,(row+1)*face.cols-1)[axis]).toBeCloseTo(upper[axis],5);
    }
    expect(cutAt(mesh,r,.5)[2]).toBeCloseTo(Math.min(.999,r));
  }
});
