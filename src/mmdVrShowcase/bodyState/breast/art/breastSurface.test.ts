import {expect,it} from 'vitest';
import {breastPoint,cutAt,cutMound} from './breastSurface';
import {TAU} from './geometry';
import {grid,VERTEX_STRIDE} from './mesh';
import {egg,eggNorm,field,height,middle,sideFullness,slice} from './teardrop';
import {cutMap,cutSlope} from './teardropCut';
import {cutBounds} from './geometry';

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

it('keeps the two approved poles and only shifts the free pole on the debited side',()=>{
  for(const [f,top,bottom] of [[0,.675,-.443],[1,.685,-.495]]){
    expect(egg(top,f).h).toBeCloseTo(1,10);expect(egg(bottom,f).h).toBeCloseTo(-1,10);
    const y=middle(f)-.55*height(f),rest=slice(y,f,f),released=slice(y,f,f,-.7,0);
    expect(released.l.h).toBeGreaterThan(rest.l.h);expect(released.r).toEqual(rest.r);
    expect(slice(top,f,f,-.7,0).l).toEqual(slice(top,f,f).l);
  }
  const left=sideFullness(.8,.19),right=sideFullness(.8,1);
  for(const y of [-.35,-.05,.25]){
    const a=slice(y,left,right,-.3,0),b=slice(y,right,left,0,-.3);
    for(const [x,z] of [[.36,.62],[.01,.48],[.65,.43]])expect(field(a,x,z)).toBeCloseTo(field(b,-x,z),11);
  }
});

it('maps the tissue key to the actual moving lateral section, with both edges on the same ovate lobe',()=>{
  for(const f of [0,1.31])for(const side of [-1,1] as const){
    const cut=cutMap(f,side);
    for(const s of [.16,.42,.72,.94]){
      const [top,bottom]=cutBounds(s);
      for(const h of [bottom,(bottom+top)/2,top]){
        const [x,y,z]=cut.point(s,h),[u,v]=cut.uv(y,z);
        expect(x*side+cutSlope*z).toBeCloseTo(cut.k,10);
        expect(u).toBeCloseTo(s,10);expect(v).toBeCloseTo(h,10);
        const e=eggNorm(egg(y,f),side*x,z);
        if(h===bottom||h===top)expect(Math.abs(e-1)).toBeLessThan(.002);else expect(e).toBeLessThan(1);
      }
    }
  }
});
