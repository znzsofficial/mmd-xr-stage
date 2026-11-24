import type {Vector3} from 'three';

// A conservative shadow of the actual posed garment onto the attachment's
// own plane. Page/rod clearance is still a separate, smaller volume. The
// outside of a scanned cloth edge must not hide the whole attachment.
export const printW=40,printH=52,halfX=3,halfY=4;
export type GarmentPrint={pixels:Uint8Array<ArrayBuffer>;version:number;covered:number};
export function createGarmentPrint(){
  const next=new Uint8Array(printW*printH),value:GarmentPrint={pixels:next.slice(),version:0,covered:0};
  let covered=0;
  const xx=new Float64Array(3),yy=new Float64Array(3);
  function triangle(a:Vector3,b:Vector3,c:Vector3,r:number){
    if(covered===next.length)return;
    xx[0]=a.x;xx[1]=b.x;xx[2]=c.x;yy[0]=a.y;yy[1]=b.y;yy[2]=c.y;
    for(let i=0;i<3;i++){xx[i]=(xx[i]/(2*r*halfX)+.5)*printW;yy[i]=(yy[i]/(2*r*halfY)+.5)*printH;}
    const top=Math.min(printH-1,Math.floor(Math.max(yy[0],yy[1],yy[2])));
    for(let y=Math.max(0,Math.ceil(Math.min(yy[0],yy[1],yy[2]))-1);y<=top;y++){
      let left=Infinity,right=-Infinity;
      for(let i=0;i<3;i++){
        const j=(i+1)%3,x=xx[i],h=yy[i],dh=yy[j]-h,dx=xx[j]-x;
        if(h>=y&&h<=y+1){left=Math.min(left,x);right=Math.max(right,x);}
        if(!dh)continue;
        for(let k=0;k<2;k++){const t=(y+k-h)/dh;if(t<0||t>1)continue;const v=x+dx*t;left=Math.min(left,v);right=Math.max(right,v);}
      }
      const end=Math.min(printW-1,Math.floor(right));
      for(let x=Math.max(0,Math.ceil(left)-1);x<=end;x++){const k=y*printW+x;if(!next[k]){next[k]=255;covered++;}}
    }
  }
  function commit(){if(value.covered!==covered||value.pixels.some((x,i)=>x!==next[i])){value.pixels.set(next);value.covered=covered;value.version++;}}
  return {value,triangle,commit,reset(){next.fill(0);covered=0;}};
}
