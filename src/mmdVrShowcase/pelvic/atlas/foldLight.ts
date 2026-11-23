import {createSealShell} from '../vulvaMesh';
import {slitHalfLength,slitHalfWidth,type CutBasis,type FoldStyle,type RimState} from '../vulvaForm';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const srgb=(v:number)=>255*(v<.0031308?12.92*v:1.055*v**(1/2.4)-.055);

/** Soft vertex lighting and per-pixel occlusion. In particular the clitoral
 * hood can eclipse the glans, and a near outer fold can hide the meatus in
 * profile. All three are the actual stage triangles, not overlays. */
export function exteriorBrush(ctx:CanvasRenderingContext2D,w:number,h:number,ox:number,oy:number,unit:number){
  const shell=createSealShell(),g=shell.geom,idx=g.getIndex()!.array,pos=g.getAttribute('position'),norm=g.getAttribute('normal');
  const finish=g.getAttribute('uv'),colors=g.getAttribute('color'),count=pos.count,ink=new Float32Array(count*3);
  const screen=new Float32Array(count*6),depth=new Float32Array(w*h),image=ctx.createImageData(w,h),rgba=image.data;
  let inkRim:RimState|undefined;
  return (yaw:number,cut:CutBasis,style:FoldStyle,rim:RimState)=>{
    shell.fitCut(cut,1,style,rim);depth.fill(-Infinity);rgba.fill(0);
    if(inkRim!==rim){for(let i=0;i<count;i++){ink[i*3]=srgb(colors.getX(i));ink[i*3+1]=srgb(colors.getY(i));ink[i*3+2]=srgb(colors.getZ(i));}inkRim=rim;}
    const co=Math.cos(yaw),si=Math.sin(yaw);
    // The floor of the illustration's single bore. Only place colour behind
    // its measured affine ellipse; the meatus is a blind relief on the mesh.
    const a=slitHalfWidth+cut.xx,b=cut.yx,c=cut.xy,d=slitHalfLength+cut.yy,det=a*d-b*c;
    if(co>.001&&det>1e-7){
      const cx=ox+unit*co*cut.x,cy=oy-unit*cut.y,rx=unit*co*Math.hypot(a,b),ry=unit*Math.hypot(c,d);
      for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(h,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(w,Math.ceil(cx+rx));x++){
        const px=(x+.5-cx)/(unit*co),py=(cy-y-.5)/unit,u=(d*px-b*py)/det,v=(-c*px+a*py)/det,r=u*u+v*v;
        if(r>1.01)continue;
        const axis=u+.28*si-.11*v*v+.095*Math.sin(2.4*v),channel=Math.exp(-axis*axis/.076-.45*v*v);
        const lobe=Math.exp(-((axis+.57-.12*v)**2)/.076-.85*(v-.21)**2)+.83*Math.exp(-((axis-.63-.14*v)**2)/.065-1.08*(v+.18)**2);
        const light=clamp(.35+.32*r+.30*lobe-.23*channel-.065*v),k=4*(y*w+x);
        rgba[k]=129+100*light;rgba[k+1]=71+87*light;rgba[k+2]=98+81*light;rgba[k+3]=255;
      }
    }
    for(let i=0;i<count;i++){
      const k=6*i,x=pos.getX(i),z=pos.getZ(i),nx=norm.getX(i),nz=norm.getZ(i);
      screen[k]=ox+unit*(co*x+si*z);screen[k+1]=oy-unit*pos.getY(i);screen[k+2]=co*z-si*x;
      const u=co*nx+si*nz,v=norm.getY(i),f=co*nz-si*nx,key=clamp(.47-.42*u+.25*v+.42*f);
      // Two broad feathered cel bands and a pink bounce, with the part's
      // own vertex normals turning each band and the narrow silk reflection.
      const t=clamp((key-.31)/.49),light=.74+.19*t*t*(3-2*t)+.07*key;
      const highlight=Math.max(0,-.33*u+.25*v+.91*f),satin=2*(finish.getX(i)-.25);
      const shine=.15*highlight**7+.79*satin*clamp(f+.20)*(.34+.66*highlight**10);
      const r=ink[3*i]*light+13*(1-key),gr=ink[3*i+1]*light-6*(1-key),bl=ink[3*i+2]*light+9*(1-key);
      screen[k+3]=r+(255-r)*shine;screen[k+4]=gr+(222-gr)*shine;screen[k+5]=bl+(225-bl)*shine;
    }
    for(let i=0;i<idx.length;i+=3){
      const p=6*idx[i],q=6*idx[i+1],s=6*idx[i+2];
      const x=screen[p],y=screen[p+1],ux=screen[q]-x,uy=screen[q+1]-y,vx=screen[s]-x,vy=screen[s+1]-y,det=ux*vy-uy*vx;
      if(det>=-1e-7)continue;
      const x0=Math.max(0,Math.ceil(x+Math.min(0,ux,vx)-.5)),x1=Math.min(w-1,Math.floor(x+Math.max(0,ux,vx)-.5));
      const y0=Math.max(0,Math.ceil(y+Math.min(0,uy,vy)-.5)),y1=Math.min(h-1,Math.floor(y+Math.max(0,uy,vy)-.5));
      for(let py=y0;py<=y1;py++)for(let px=x0;px<=x1;px++){
        const dx=px+.5-x,dy=py+.5-y,t=(dx*vy-dy*vx)/det,l=(ux*dy-uy*dx)/det,n=1-t-l;
        if(n<0||t<0||l<0)continue;
        const j=py*w+px,z=n*screen[p+2]+t*screen[q+2]+l*screen[s+2];if(z<depth[j])continue;
        depth[j]=z;const k=4*j;
        for(let ch=0;ch<3;ch++)rgba[k+ch]=n*screen[p+3+ch]+t*screen[q+3+ch]+l*screen[s+3+ch];rgba[k+3]=255;
      }
    }
    ctx.putImageData(image,0,0);
  };
}
