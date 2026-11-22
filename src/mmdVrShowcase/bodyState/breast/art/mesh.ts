import type { V } from './geometry';

// Interleaved body-space position, unit normal and pigment (or section UV).
export const VERTEX_STRIDE = 9;
export interface Mesh {
  data: Float32Array;
  indices: Uint16Array;
  cols: number;
  radii?: readonly number[];
  material?: 'silk' | 'metal' | 'stone' | 'hair' | 'section';
}

export const clamp = (x:number) => Math.max(0,Math.min(1,x));
export const smooth = (x:number) => {x=clamp(x);return x*x*(3-2*x);};

export function grid(rows:number,cols:number,vertex:(t:number,r:number)=>V,paint:(t:number,r:number)=>V):Mesh {
  const data=new Float32Array(rows*cols*VERTEX_STRIDE),indices=new Uint16Array((rows-1)*(cols-1)*6);
  let k=0,m=0;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const t=i/(cols-1),r=j/(rows-1),pos=vertex(t,r),pig=paint(t,r);
    data[k]=pos[0];data[k+1]=pos[1];data[k+2]=pos[2];data[k+6]=pig[0];data[k+7]=pig[1];data[k+8]=pig[2];k+=VERTEX_STRIDE;
    if(i<cols-1&&j<rows-1){
      const a=j*cols+i,b=a+cols;
      indices[m++]=a;indices[m++]=b;indices[m++]=a+1;indices[m++]=b;indices[m++]=b+1;indices[m++]=a+1;
    }
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const a=(j*cols+i)*VERTEX_STRIDE,left=(j*cols+(i===0?cols-2:i-1))*VERTEX_STRIDE,right=(j*cols+(i===cols-1?1:i+1))*VERTEX_STRIDE,
      lower=(Math.max(0,j-1)*cols+i)*VERTEX_STRIDE,upper=(Math.min(rows-1,j+1)*cols+i)*VERTEX_STRIDE;
    const u=data[right]-data[left],v=data[right+1]-data[left+1],w=data[right+2]-data[left+2],
      h=data[upper]-data[lower],g=data[upper+1]-data[lower+1],f=data[upper+2]-data[lower+2];
    const nx=v*f-w*g,ny=w*h-u*f,nz=u*g-v*h,len=Math.hypot(nx,ny,nz)||1;
    data[a+3]=nx/len;data[a+4]=ny/len;data[a+5]=nz/len;
  }
  return {data,indices,cols};
}
