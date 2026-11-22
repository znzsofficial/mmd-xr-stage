// Exterior-only art proof. Both rows use the same loft; the three columns
// differ only by yaw. Nothing in the stage imports this module.
import { breastPoint } from '../../src/mmdVrShowcase/bodyState/breast/art/breastSurface';
import { figure, chest, torsoWidth } from '../../src/mmdVrShowcase/bodyState/breast/art/figure';
import { camera, TAU, type Camera, type P, type Side, type V } from '../../src/mmdVrShowcase/bodyState/breast/art/geometry';
import { clamp, grid, smooth, VERTEX_STRIDE, type Mesh } from '../../src/mmdVrShowcase/bodyState/breast/art/mesh';
import { inkContours, meshRenderer, portraitX, portraitY, RASTER_SCALE, RASTER_HEIGHT as H, RASTER_WIDTH as W } from '../../src/mmdVrShowcase/bodyState/breast/art/raster';

const rows = 57, cols = 129;
const radii = Array.from({length:rows}, (_, i) => i / (rows - 1));
const cubic = (a:V,b:V,c:V,d:V,t:number): V => {
  const k=1-t;
  return [0,1,2].map(i=>k**3*a[i]+3*k*k*t*b[i]+3*k*t*t*c[i]+t**3*d[i]) as V;
};

/** Each meridian has a rounded forward pole, a belly and an insertion.
 * Keep the perimeter on the same rib cage for both states. A shared tangent
 * at the belly carries the contour back instead of cropping an ellipsoid. */
function loft(side:Side, full:number) {
  const cx=.428+.011*full, cy=-.086-.045*full+.004*side, cz=.831+.162*full;
  const mesh=grid(rows,cols,(t,r)=>{
    const a=t*TAU,u=Math.cos(a),v=Math.sin(a),down=Math.max(0,-v),up=Math.max(0,v),out=smooth((u+.8)/1.6);
    const ry=.035+v*(v>0?.665:.425),rx=.423+u*(u<0?.416:torsoWidth(ry)-.439);
    const root:V=[rx,ry,chest(Math.asin(clamp(rx/torsoWidth(ry))),ry)[2]-.004];
    const p:V=[cx,cy,cz], lead:V=[cx+.179*u,cy+.173*v,cz+.023*v-.040*u];
    const sw=.306+(.111+.042*up-.029*down)*out+.033*out*full, sh=.252+.004*down+.032*down*full;
    const cant=(.035*u+.014)*down;
    const cheek:V=[cx+u*sw,cy+v*sh+cant,cz-.065-.072*up-.043*u];
    const reach=.52+.055*up+.029*down;
    const belly:V=[cx+u*(sw+.060+.016*out),cy+v*(sh+.056)+cant,cz*reach+root[2]*(1-reach)];
    const aft=belly.map((n,i)=>n+.71*(n-cheek[i])) as V;
    const foot:V=[root[0]+.018*u,root[1]-(.032+.13*up)*v,root[2]+.026+.057*up];
    const q=r<=.52?cubic(p,lead,cheek,belly,r/.52):cubic(belly,aft,foot,root,(r-.52)/.48);
    const relief=.011*Math.exp(-((r/.049)**2))+.004*Math.exp(-((r/.15)**2));
    const lift=.096*Math.max(0,u)**2*Math.sin(Math.PI*r)**1.4;
    return [side*(q[0]+.25*relief),q[1]+lift-.28*relief,q[2]+relief];
  },()=>[0,0,0]);
  return {...mesh,radii};
}

const gauss = (x:number,y:number) => Math.exp(-x*x-y*y);
// The turning surface between the free arc and the sternum. Build it into
// the cage, under the loft. Its small lower tail meets the cage tangentially.
function returnDepth(angle:number,y:number,full:number) {
  const bell=gauss((Math.abs(angle)-.56)/.39,0);
  return bell*(.390+.127*full)*smooth((y+.585+.063*full)/(.33-.010*full))*smooth((.065-y)/.30);
}
function cageWithReturn(mesh:Mesh,full:number):Mesh {
  const data=new Float32Array(mesh.data);
  for(let k=0;k<data.length;k+=VERTEX_STRIDE) {
    const a=TAU*((k/VERTEX_STRIDE)%mesh.cols)/(mesh.cols-1);
    data[k+2]+=returnDepth(a>Math.PI?a-TAU:a,data[k+1],full);
  }
  return {...mesh,data};
}
function paint(mesh:ReturnType<typeof loft>,side:Side,cam:Camera) {
  // Selective lights, warm turning halftone and bounced peach below it.
  // Use broad painted masses around the same meridians, not a threshold on
  // the normal (which used to leave a pointed violet wedge in profile).
  const d=mesh.data;
  for(let j=0;j<rows;j++) for(let i=0;i<cols;i++) {
    const k=(j*cols+i)*VERTEX_STRIDE,r=radii[j],a=i/(cols-1)*TAU,u=Math.cos(a)*r,v=Math.sin(a)*r;
    const nx=-side*d[k+3],ny=-side*d[k+4],nz=-side*d[k+5];
    const lr=nx*cam.c-nz*cam.s, eye=nx*cam.s+nz*cam.c;
    const rootBlend=smooth((r-.66)/.34);
    const fall=smooth((.03-v-.06*u-.38*u*u)/.40);
    const round=1-smooth((r-.03)/.15),lighting=-.34*lr+.68*ny+.46*eye;
    const turn=1-smooth((lighting+.37+.12*round)/(.81+.19*round));
    const flank=smooth((u-.22)/.54);
    const shadow=clamp(.51*fall*(.56+.44*turn)+.54*turn)*(1-.38*flank);
    const bounce=gauss((r-.66)/.22,(v+.56)/.21)*.19;
    const broad=gauss((u+.16*side)/.35,(v-.22)/.30)*(.52+.48*smooth(eye));
    const nectar=gauss((u-.08*side)/.29,(v+.024)/.23);
    const disk=.55*gauss(u/.101,v/.092)+.45*(1-smooth((Math.hypot(u,1.17*v)-.054)/.090));
    const tip=gauss((u-.009)/.031,(v+.014)/.030);
    const x=d[k],y=d[k+1],w=torsoWidth(y),z=chest(0,y)[2];
    const clearance=Math.hypot(x/w,d[k+2]/z)-1;
    const veil=Math.max(rootBlend*(1-smooth((-v-.07)/.54)),1-smooth((clearance-.006)/.255));
    const light=-.47*lr+.68*ny+.56*eye;
    const ribShade=1-smooth((light-.045)/.23),ribDeep=1-smooth((light+.53)/.35),ribLite=smooth((light-.58)/.30);
    const aRib=Math.atan2(x/w,d[k+2]/z), lo=chest(aRib-.003,y),hi=chest(aRib+.003,y);
    const dn=chest(aRib,y-.003),up=chest(aRib,y+.003), ax=hi[0]-lo[0],az=hi[2]-lo[2];
    const dnx=-az*.006,dny=az*(up[0]-dn[0])-ax*(up[2]-dn[2]),dnz=ax*.006;
    const len=Math.hypot(dnx,dny,dnz),bodyLight=(-.47*(dnx*cam.c-dnz*cam.s)+.68*dny+.56*(dnx*cam.s+dnz*cam.c))/len;
    const cage=smooth(veil),ribDark=(1-cage)*ribShade+cage*(1-smooth((bodyLight-.045)/.23));
    const deep=(1-cage)*ribDeep+cage*(1-smooth((bodyLight+.53)/.35)),lit=(1-cage)*ribLite+cage*smooth((bodyLight-.58)/.30);
    const rib=[248-16*ribDark-26*deep+6*lit,211-47*ribDark-29*deep+9*lit,192-27*ribDark-19*deep+10*lit];
    const skin=[251-24*shadow+6*bounce+3*broad-2*nectar-12*disk-6*tip,
      215-58*shadow+14*bounce+15*broad-5*nectar-28*disk-10*tip,
      193-33*shadow+13*bounce+18*broad-4*nectar-19*disk-6*tip];
    for(let c=0;c<3;c++)d[k+6+c]=skin[c]*(1-veil)+rib[c]*veil;
  }
}

// The live composition looks down by ~3°. Here the camera is exactly level,
// so the opposite pole does not draw a second edge in the 90° comparison.
function level(mesh:Mesh,cam:Camera) {
  const data=new Float32Array(mesh.data);
  for(let k=0;k<data.length;k+=VERTEX_STRIDE) data[k+1]+=.057*(data[k]*cam.s+data[k+2]*cam.c);
  return {...mesh,data};
}

function accents(ctx:CanvasRenderingContext2D, cam:Camera, z:Float32Array, right:ReturnType<typeof loft>, left:ReturnType<typeof loft>) {
  const stroke=(point:(t:number)=>V,color:string,width:number)=>{
    let rim:P[]=[],aft:P[]=[];
    const flush=()=>{if(rim.length>1){ctx.beginPath();ctx.moveTo(...rim[0]);for(const p of rim.slice(1))ctx.lineTo(...p);
      for(const p of aft.reverse())ctx.lineTo(...p);ctx.closePath();ctx.fillStyle=color;ctx.fill();}rim=[];aft=[];};
    const position=(t:number)=>{const [x,y,s]=point(t),d=x*cam.s+s*cam.c;
      return [portraitX(cam,x,s)*RASTER_SCALE,portraitY(y,0)*RASTER_SCALE,d+.057*(y+.057*d)];};
    for(let i=0;i<=48;i++) {const t=i/48,[x,y,d]=position(t),px=Math.round(x),py=Math.round(y);
      if(px<0||px>=W||py<0||py>=H||Math.abs(d-z[py*W+px])>.027){flush();continue;}
      const a=position(Math.max(0,t-.009)),b=position(Math.min(1,t+.009)),dx=b[0]-a[0],dy=b[1]-a[1];
      const w=width*RASTER_SCALE*.5*Math.sin(t*Math.PI)**.70/(Math.hypot(dx,dy)||1);
      rim.push([x-dy*w,y+dx*w]);aft.push([x+dy*w,y-dx*w]);}flush();
  };
  for(const side of [-1,1] as const) {
    const clavicle=(t:number,dy=0)=>{const a=.066+.90*t;return chest(side*a,.701+.073*Math.sin(torsoWidth(.70)*Math.sin(a)*4.6)+dy);};
    stroke(t=>clavicle(t),'#b77676',1.28);stroke(t=>clavicle(.17+.56*t,.025),'#ffeacd',1.56);
    stroke(t=>chest(side*(.116+.138*t),.898-.151*t),'#c68b86',.82);
    stroke(t=>chest(side*(1.064+.38*t),.53-.25*t+.027*Math.sin(t*Math.PI)),'#b57578',1.24);
    const at=(u:number,v:number)=>breastPoint(side===1?left:right,u,v);
    // The highest mark travels around the volume; leave the middle of the
    // lower arc to the form colour instead of outlining the entire insertion.
    stroke(t=>at(-side*(.23-.044*Math.sin(2.4*t)),.43-.19*t),'rgba(255,243,217,.87)',2.52);
    stroke(t=>at(-side*(.265-.012*t),.275-.047*t),'rgba(255,245,223,.90)',1.35);
    stroke(t=>at(side*(-.025+.034*t),.034+.008*Math.sin(t*Math.PI)),'#ffe0c8',1.33);
  }
}

export function portrait(full:number, yaw:number) {
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d')!,pix=ctx.createImageData(W,H),z=new Float32Array(W*H).fill(-1e4);
  const render=meshRenderer(z,pix.data),cam=camera(yaw);
  // Underpaint the return like a cel overlap: keep it in negative space
  // behind the principal figure. A volumetric overlap should shape the side
  // outline, not punch a pale notch into the frontal lower arc.
  render(level(cageWithReturn(figure()[0][0],full),cam),cam,1,0);
  const under=z.slice();z.fill(-1e4);
  for(const [m,s] of figure())render(level(m,cam),cam,s,0);
  const left=loft(1,full),right=loft(-1,full);
  for(const [m,s] of [[left,1],[right,-1]] as const) {
    paint(m,s,cam);
    // The stage raster's interpolant pass with no texture interpolates the
    // three supplied channels verbatim. Pigment was already lit above.
    render({...level(m,cam),material:'section'},cam,-s,0);
  }
  // Ink the union's outer boundary, never the hidden upright torso edge
  // inside the return. The underpainting affects depth here, not pigment.
  for(let i=0;i<z.length;i++)z[i]=Math.max(z[i],under[i]);
  inkContours(z,pix.data);ctx.putImageData(pix,0,0);
  accents(ctx,cam,z,right,left);
  return canvas;
}
