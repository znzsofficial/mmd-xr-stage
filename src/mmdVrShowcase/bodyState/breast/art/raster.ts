import { settleWeight } from './breastSurface';
import { type Camera, TAU } from './geometry';
import { clamp, type Mesh, smooth, VERTEX_STRIDE } from './mesh';

// Logical coordinates are also used by the brush and label anchors. Only the
// depth pass works at this intermediate resolution (the HUD canvas has its own DPR).
export const PORTRAIT_WIDTH = 400, PORTRAIT_HEIGHT = 260;
export const RASTER_SCALE = 1.3;
export const RASTER_WIDTH = PORTRAIT_WIDTH * RASTER_SCALE, RASTER_HEIGHT = PORTRAIT_HEIGHT * RASTER_SCALE;
const scale = 147, focus = .21, originY = 165;
export const portraitX = (cam: Camera, x: number, z: number) => 200 + scale * (x * cam.c - (z - focus) * cam.s);
export const portraitY = (y: number, depth: number) => originY - scale * (y - .057 * depth);

// Projected vertex: screen x/y, depth, and either RGB or cutaway texture coordinates.
const STRIDE = 6;
function project(mesh: Mesh, cam: Camera, out: Float32Array, flip: number, settle: number, level:boolean) {
  const v = mesh.data, {s,c} = cam, {radii,cols} = mesh;
  for (let i=0,k=0; i<v.length; i+=VERTEX_STRIDE,k+=STRIDE) {
    const x=v[i], z=v[i+2], depth=x*s+z*c, index=i/VERTEX_STRIDE;
    const r=radii ? radii[Math.floor(index/cols)] : 1;
    const y=level?Math.fround(v[i+1]+.057*depth):v[i+1]+(settle && radii ? settle*settleWeight(r,r*Math.sin(TAU*(index%cols)/(cols-1))) : 0);
    out[k]=portraitX(cam,x,z)*RASTER_SCALE;
    out[k+1]=portraitY(y,depth)*RASTER_SCALE;
    out[k+2]=depth+y*.057;
    if (mesh.material==='section') {
      out[k+3]=v[i+6]; out[k+4]=v[i+7]; out[k+5]=v[i+8]; continue;
    }
    const nx=flip*v[i+3], ny=flip*v[i+4], nz=flip*v[i+5], lr=nx*c-nz*s, eye=nx*s+nz*c;
    const light=-.47*lr+.68*ny+.56*eye;
    if (mesh.material) {
      const h=clamp(-.34*lr+.54*ny+.766*eye), metal=mesh.material==='metal', stone=mesh.material==='stone';
      const diff=.68+.34*clamp(light), glint=smooth((h-(metal ? .89 : .95))/.055)*(metal ? 59 : stone ? 94 : 24);
      out[k+3]=v[i+6]*diff+glint; out[k+4]=v[i+7]*diff+glint; out[k+5]=v[i+8]*diff+glint; continue;
    }
    // Warm cel shadows and a softer terminator at the rounded tip.
    const rounded=radii ? 1-smooth((r-.088)/.16) : 0;
    const shade=1-smooth((light-.045+.21*rounded)/(.23+.45*rounded)), deep=1-smooth((light+.53)/.35), lite=smooth((light-.58)/.30), rim=(1-clamp(eye))**4;
    const h=clamp(-.27*lr+.59*ny+.761*eye), shine=smooth((h-.962)/.032);
    out[k+3]=v[i+6]-16*shade-26*deep+6*lite+4*shine+6*rim;
    out[k+4]=v[i+7]-47*shade-29*deep+9*lite+9*shine+5*rim;
    out[k+5]=v[i+8]-27*shade-19*deep+10*lite+10*shine+10*rim;
  }
}

function triangles(indices: Uint16Array, v: Float32Array, z: Float32Array, color: Uint8ClampedArray, tile?: ImageData) {
  for (let i=0; i<indices.length; i+=3) {
    const a=STRIDE*indices[i], b=STRIDE*indices[i+1], c=STRIDE*indices[i+2];
    const x=v[a], y=v[a+1], bx=v[b]-x, by=v[b+1]-y, cx=v[c]-x, cy=v[c+1]-y;
    const det=bx*cy-by*cx; if (Math.abs(det)<.012) continue;
    const x0=Math.max(0,Math.ceil(x+Math.min(0,bx,cx))), x1=Math.min(RASTER_WIDTH-1,Math.floor(x+Math.max(0,bx,cx)));
    const y0=Math.max(0,Math.ceil(y+Math.min(0,by,cy))), y1=Math.min(RASTER_HEIGHT-1,Math.floor(y+Math.max(0,by,cy)));
    const uX=cy/det, uY=-cx/det, vX=-by/det, vY=bx/det, za=v[a+2], dz1=v[b+2]-za, dz2=v[c+2]-za;
    for (let row=y0; row<=y1; row++) {
      let u=(x0-x)*uX+(row-y)*uY, t=(x0-x)*vX+(row-y)*vY;
      for (let px=x0; px<=x1; px++,u+=uX,t+=vX) {
        if (u<-.001 || t<-.001 || u+t>1.001) continue;
        const n=row*RASTER_WIDTH+px, depth=za+dz1*u+dz2*t;
        if (depth<z[n]) continue;
        z[n]=depth; const q=n*4;
        if (tile) {
          const tx=Math.min(tile.width-1,Math.max(0,Math.round(v[a+3]+(v[b+3]-v[a+3])*u+(v[c+3]-v[a+3])*t)));
          const ty=Math.min(tile.height-1,Math.max(0,Math.round(v[a+4]+(v[b+4]-v[a+4])*u+(v[c+4]-v[a+4])*t)));
          const p=(ty*tile.width+tx)*4, opaque=tile.data[p+3]>100;
          // The border just outside the anti-aliased tissue tile is dermis.
          color[q]=opaque?tile.data[p]:249; color[q+1]=opaque?tile.data[p+1]:204; color[q+2]=opaque?tile.data[p+2]:177;
        } else {
          for (let k=3; k<6; k++) color[q+k-3]=v[a+k]+(v[b+k]-v[a+k])*u+(v[c+k]-v[a+k])*t;
        }
        color[q+3]=255;
      }
    }
  }
}

/** One scratch buffer per live painter. Retessellating a surface must not
 * depend on the torso happening to have the most vertices in the scene. */
export function meshRenderer(depths: Float32Array, color: Uint8ClampedArray, level=false) {
  let work=new Float32Array(0);
  return (mesh: Mesh, cam: Camera, flip: number, settle: number, tile?: ImageData) => {
    const length=mesh.data.length/VERTEX_STRIDE*STRIDE;
    if (work.length<length) work=new Float32Array(length);
    project(mesh,cam,work,flip,settle,level);
    triangles(mesh.indices,work,depths,color,tile);
  };
}

/** Ink only near silhouettes: a far lock or shoulder cannot draw through skin. */
export function inkContours(depths: Float32Array, rgb: Uint8ClampedArray) {
  for (let y=1; y<RASTER_HEIGHT-1; y++) for (let x=1,i=y*RASTER_WIDTH+1; x<RASTER_WIDTH-1; x++,i++) {
    const d=depths[i]; if (d < -100) continue;
    const down=d-depths[i+RASTER_WIDTH], up=d-depths[i-RASTER_WIDTH], side=d-Math.min(depths[i-1],depths[i+1]);
    const edge=Math.max(smooth((down-.033)/.072)*.68,smooth((side-.054)/.11)*.50,smooth((up-.074)/.15)*.33);
    if (edge<=.005) continue;
    const k=i*4;
    rgb[k]+=(107-rgb[k])*edge; rgb[k+1]+=(45-rgb[k+1])*edge; rgb[k+2]+=(70-rgb[k+2])*edge;
  }
}
