import {semenRGB} from '../../play/semenAppearance';
import {canalBands,canalGroove,mucosaEnd,vaultEnd,type CanalStudy} from './canalGeometry';
import {clamp,grid,smooth,stride,type Mesh} from './model';

// Retained material only. The ledger has already accounted for drainage and
// overflow; neither a camera turn nor the free-surface drawing owns a clock.
const {abs,sin,sqrt}=Math;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;

/** A partial-volume section through the tapered corpus. The lower cavity is
 * much narrower than the fundus: a first dose has appreciable height without
 * painting outside the lumen. `wallU` follows its anatomical material columns
 * in both coronal and sagittal cuts (0 at the centre, ~1 at the margin). */
export const cavityLevel=(fraction:number)=>.50+3.23*Math.cbrt(fraction);
/** The slit in the sagittal cut separates to receive the liquid; the nearby
 * rim follows it smoothly but the outer muscle and silhouette stay in place. */
export function cavityDistension(level:number,z:number,wallU:number){
  const u=abs(wallU);
  return (.084*(level-.50))*smooth(.47,.74,z)*(1-smooth(level-.07,level+.18,z))*
    Math.sign(wallU)*smooth(0,.87,u)*(1-smooth(1,1.72,u));
}
export type PoolSurface={height:number;opacity:number;pearl:number};
export function cavitySurface(s:PoolSurface,level:number,z:number,wallU:number,lumen:number){
  const u=Math.min(1,abs(wallU)),margin=smooth(.52,.96,lumen);
  const depth=level+.064*u*u-.024*wallU-z,wet=smooth(-.025,.045,depth)*margin;
  const lip=1-smooth(.012,.105,abs(depth-.034));
  s.height=wet*(.028+.11*(1-.6*u*u)*smooth(0,.20,depth));
  s.opacity=wet*(.72+.24*smooth(0,.22,depth));
  s.pearl=lip*20-28*u*u-5*smooth(.1,.8,depth)+6*(1-smooth(0,.48,abs(wallU+.31)));
}

// A free surface over the remaining posterior mucosa. At low stock isolated
// lenses follow specific rugae. When fuller a dependent tongue connects the
// lower lenses. Its cut edge and changing thickness are visible edge-on. Each
// sample reads the actual (possibly impressed) wall, never the previous view.
const streaks=[
  // fold, approximate station, lateral centre & half-length within the window, onset
  [1,.14,.47,.49,0], [2,.23,.36,.38,0], [3,.35,.64,.43,.09],
  [4,.49,.45,.44,.26], [5,.66,.61,.39,.52],
];
const cols=23,rows=17;
const makePatch=()=>grid(cols-1,rows-1,false,0,()=>({p:[0,0,0],c:[0,0,0],lumen:.65}));
function normals(m:Mesh){
  const a=m.a;
  for(let v=0,i=0;v<m.rows;v++)for(let u=0;u<m.cols;u++,i+=stride){
    const l=u?i-stride:i,r=u+1<m.cols?i+stride:i,b=v?i-m.cols*stride:i,t=v+1<m.rows?i+m.cols*stride:i;
    const dx=a[r]-a[l],dy=a[r+1]-a[l+1],dz=a[r+2]-a[l+2],ex=a[t]-a[b],ey=a[t+1]-a[b+1],ez=a[t+2]-a[b+2];
    const nx=dy*ez-dz*ey,ny=dz*ex-dx*ez,nz=dx*ey-dy*ex,k=1/(Math.hypot(nx,ny,nz)||1);
    a[i+3]=nx*k;a[i+4]=ny*k;a[i+5]=nz*k;
  }
}

export function createCanalLiquid(study:CanalStudy){
  const {posterior:p,anterior:a}=study,cache:Mesh[]=[],visible:Mesh[]=[],probe=new Float32Array(3);
  let previous=NaN;
  // Across the dissected window: from the exposed edge of the posterior
  // sheet to the return of the anterior one. The first 5/12 of wall columns
  // are its linear-in-X mucosa; the cut face and adventitia are never wetted.
  const last=Math.round((p.cols-1)*mucosaEnd),pitch=p.cols*stride;
  function sample(t:number,across:number,wall:Float32Array,dst:Float32Array,i:number){
    const f=t*canalBands/vaultEnd,j=Math.min(canalBands-1,Math.floor(f)),v=f-j,b=j*pitch;
    const minX=mix(p.a[b],p.a[b+pitch],v),maxX=mix(a.a[b],a.a[b+pitch],v),end=mix(p.a[b+last*stride],p.a[b+pitch+last*stride],v);
    const x=mix(minX,maxX,clamp(across)),s=clamp((x-minX)/(end-minX))*last,k=Math.min(last-1,Math.floor(s)),u=s-k,n=b+k*stride;
    dst[i]=x;
    for(let q=1;q<=2;q++)dst[i+q]=mix(mix(wall[n+q],wall[n+stride+q],u),mix(wall[n+pitch+q],wall[n+pitch+stride+q],u),v);
  }
  return {update(fraction:number,wall:Float32Array,shifted:boolean){
    if(fraction===previous&&!shifted)return visible;
    previous=fraction;visible.length=0;
    if(!(fraction>0))return visible;
    for(let pass=0;pass<=streaks.length;pass++){
      const pool=pass===streaks.length,def=streaks[pool?0:pass],onset=pool?.32:def[4];
      if(fraction<=onset)continue;
      const f=(fraction-onset)/(1-onset),reach=pool?Math.min(1,Math.cbrt(f*3)):Math.min(1,(f*5)**.19),body=sqrt(f);
      const m=cache[pass]??=makePatch(),buf=m.a;
      for(let c=0;c<cols;c++){
        const u=2*c/(cols-1)-1,round=sqrt(Math.max(0,1-u*u));
        const across=pool?.51+u*.508*reach:def[2]+u*def[3]*reach;
        let centre=def[1],half=0;
        if(!pool){sample(centre,across,wall,probe,0);centre=canalGroove(def[0],probe[0],centre);
          half=(.023+.027*body)*reach*round*(1+.35*sin(u*3+pass));}
        else{const bottom=.038+.045*u*u,top=Math.max(bottom+.008,.08+.77*f+.055*sin(2.7*u+.2)*body);
          centre=(top+bottom)/2;half=(top-bottom)/2*(1-.30*u*u)*round;}
        for(let r=0;r<rows;r++){
          const v=2*r/(rows-1)-1,t=centre+v*half,i=(r*cols+c)*stride;
          sample(t,across,wall,buf,i);
          const dome=round*sqrt(Math.max(0,1-v*v));
          // Small upper catch-light and pink reflected light in the thicker
          // lower lip. Most of the body remains the shared warm ivory.
          const rim=smooth(.57,.83,v)*(1-smooth(.83,1,v)),edge=1-smooth(0,.87,dome);
          buf[i+1]+=.002+dome*reach*(pool?.025+.155*body:.045+.054*body);
          buf[i+6]=semenRGB[0]-edge*42+rim*7;buf[i+7]=semenRGB[1]-edge*82+rim*9;buf[i+8]=semenRGB[2]-edge*63+rim*12;
        }
      }
      normals(m);visible.push(m);
    }
    return visible;
  }};
}
