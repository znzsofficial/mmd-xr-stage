// Original cutaway study. Coordinates are illustrative: +Y anterior, +Z fundal,
// +X to the right of the anterior plate. There are no imported meshes or images.
export type V = [number, number, number];
type P = [number, number];
export const clamp = (x:number, a=0, b=1) => Math.max(a,Math.min(b,x));
const mix = (a:number,b:number,t:number) => a+(b-a)*t;
const mix3 = (a:V,b:V,t:number):V => [mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
export const smooth = (a:number,b:number,x:number) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
const {sin,cos,abs,exp,PI,sqrt} = Math;
const TAU=2*PI;
type Vertex = {p:V;c:V; center?:number; lining?:number; lumen?:number};
export type Etching = {width:number;height:number;ink:Int8Array};
export type Mesh = {rows:number;cols:number;section:boolean;wing:number;a:Float32Array;b:Float32Array;indices:Uint32Array;etch?:[Etching,Etching]};
// Record = position, smooth normal, display pigment, section-axis centre,
// mucosal displacement weight, physical compartment (1 uterus, 2 vagina).
export const stride=12;
function grid(n:number,m:number,section:boolean,wing:number,sample:(u:number,v:number,side:boolean)=>Vertex):Mesh {
  const rows=m+1,cols=n+1;
  function bake(side:boolean){
    const data=new Float32Array(rows*cols*stride);
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const o=(j*cols+i)*stride,{p,c,center=0,lining=0,lumen=0}=sample(i/n,j/m,side);
      data.set(p,o);data.set(c,o+6);data[o+9]=center;data[o+10]=lining;data[o+11]=lumen;
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const o=(j*cols+i)*stride,l=o-(i?stride:0),r=o+(i<n?stride:0),d=o-(j?cols*stride:0),h=o+(j<m?cols*stride:0);
      const dx=data[r]-data[l],dy=data[r+1]-data[l+1],dz=data[r+2]-data[l+2];
      const ex=data[h]-data[d],ey=data[h+1]-data[d+1],ez=data[h+2]-data[d+2];
      const x=dy*ez-dz*ey,y=dz*ex-dx*ez,z=dx*ey-dy*ex,s=1/(Math.hypot(x,y,z)||1);
      data[o+3]=x*s;data[o+4]=y*s;data[o+5]=z*s;
    }
    return data;
  }
  const a=bake(false),b=section?bake(true):a,indices=new Uint32Array(n*m*6);
  let k=0;for(let j=0;j<m;j++)for(let i=0;i<n;i++){
    const x=j*cols+i;indices[k++]=x;indices[k++]=x+1;indices[k++]=x+cols;
    indices[k++]=x+1;indices[k++]=x+cols+1;indices[k++]=x+cols;
  }
  return {rows,cols,section,wing,a,b,indices};
}

// Catmull paths are independently authored in three dimensions; the ovaries
// lie posterior to the uterine horns. The tube bends back over each ovary.
function spline(points:number[][],t:number):number[]{
  const q=clamp(t)*(points.length-1),i=Math.min(points.length-2,Math.floor(q)),u=q-i;
  const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
  return b.map((x,k)=>.5*((2*x)+(-a[k]+c[k])*u+(2*a[k]-5*x+4*c[k]-d[k])*u*u+(-a[k]+3*x-3*c[k]+d[k])*u*u*u));
}
function profile(rows:number[][],z:number):number[]{
  let i=0;while(i<rows.length-2&&z>rows[i+1][0])i++;
  const t=clamp((z-rows[i][0])/(rows[i+1][0]-rows[i][0]));
  return spline(rows,(i+t)/(rows.length-1)).slice(1);
}
const corpus=[[-1.62,.05,.05,-.44],[-1.52,.60,.45,-.43],[-1.35,.97,.75,-.41],[-1.04,1.12,.89,-.35],[-.48,1.12,.97,-.20],[.30,1.02,.93,.01],[.87,1.20,1.02,.17],[1.50,1.49,1.16,.39],[2.30,1.98,1.38,.69],[3.15,2.32,1.54,1.01],[3.72,2.42,1.55,1.19],[4.06,2.27,1.46,1.30],[4.40,1.77,1.22,1.39],[4.65,1.08,.81,1.44],[4.78,.48,.39,1.46],[4.82,.012,.012,1.46]];
const cavity:P[]=[[.09,-1.64],[.10,-1.43],[.16,-1.14],[.21,-.78],[.18,-.38],[.10,.04],[.11,.49],[.26,.99],[.57,1.62],[.97,2.27],[1.42,2.88],[1.80,3.40],[2.06,3.74],[1.94,3.77],[1.49,3.65],[.81,3.54],[0,3.51]];
const sagittal:P[]=[[.07,-1.64],[.08,-1.36],[.14,-.91],[.13,-.53],[.09,-.04],[.07,.41],[.08,1.02],[.10,1.70],[.14,2.45],[.17,3.05],[.16,3.42],[.09,3.62],[0,3.72]];
function boundary(half:P[]){const pts=[...half,...half.slice(0,-1).reverse().map(([x,z]):P=>[-x,z])];
  return Array.from({length:pts.length*3},(_,i)=>spline(pts,i/(pts.length*3-1)) as P);
}
const cuts=[boundary(cavity),boundary(sagittal)];
// Match columns by anatomical boundary, not by raw x. Thus one continuous
// window narrows into a sagittal slit during an orbit instead of cross-fading
// two differently shaped cavities onto the same surface.
const seam=.46;
const axes=cuts.map(poly=>Float32Array.from({length:512},(_,i)=>{
  const z=mix(-1.618,4.819,i/511),level=Math.min(3.68,z),rw=profile(corpus,z)[poly===cuts[1]?1:0];let edge=.01;
  for(let j=0,k=poly.length-1;j<poly.length;k=j++){
    const a=poly[j],b=poly[k];if((a[1]>level)!==(b[1]>level))edge=Math.max(edge,a[0]+(b[0]-a[0])*(level-a[1])/(b[1]-a[1]));
  }
  return mix(Math.asin(clamp(edge/rw,.06,.91)),.75,smooth(3.68,4.48,z));
}));
function splitAngle(z:number,side:boolean){const f=clamp((z+1.618)/6.437)*511,i=Math.min(510,Math.floor(f)),a=axes[+side];return mix(a[i],a[i+1],f-i);}
function distance(poly:P[],x:number,y:number){let inside=false,best=1e3;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [a,b]=poly[j],[c,d]=poly[i]; if((b>y)!==(d>y)&&x<a+(c-a)*(y-b)/(d-b))inside=!inside;
    const dx=c-a,dy=d-b,t=clamp(((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy||1));
    best=Math.min(best,(x-a-t*dx)**2+(y-b-t*dy)**2);
  }return sqrt(best)*(inside?1:-1);
}
const serosa:V=[199,135,139],muscle:V=[220,143,129],lining:V=[250,192,155],mucosa:V=[183,106,112];
function pigment(c:V,amount:number):V{return [c[0]+amount,c[1]+amount*.87,c[2]+amount*.76];}
function body(back:boolean){const mesh=grid(back?32:85,back?37:117,true,0,(u,v,side)=>{
  const z=mix(-1.618,4.819,v),[rx,ry,yc]=profile(corpus,z),t=abs(u*2-1),b=splitAngle(z,side);
  const angle=back?(u-.5)*PI:(u<.5?-1:1)*(t<seam?b*t/seam:b+(PI/2-b)*(t-seam)/(1-seam));
  const rw=side?ry:rx,rd=side?rx:ry,x=rw*sin(angle),outer=rd*cos(angle),sag=side?.03*sin(z):0;
  if(back)return {p:[x,-outer,z],center:yc,c:pigment(serosa,5*sin(z*3+x*2))};
  const sd=distance(cuts[+side],x-sag,z),neck=1-smooth(.15,.75,z);
  const surf=.34+.13*rd+.05*cos(z*1.3)+.52*Math.max(0,z-3.61)**1.45+.058*(x/rw)**2,inside=smooth(-.105,.085,sd),border=(1-smooth(.065,.24,-sd))*(1-inside);
  // A shallow basin exposes the posterior endometrium. Both views have a
  // continuous endocervical canal, with oblique paired palmate folds below.
  const folds=mix(cos(8*x/(.23+Math.max(0,z)*.31)+.54*sin(z*2.6+x*3)),sin(z*20-abs(x)*30+.6*sin(z*5)),neck);
  // The upper cavity is smooth, moist and gently fluted lengthwise. The folds
  // become arborizing ONLY in the narrow endocervix, not across the fundal dome.
  const ostium=side?0:exp(-(((abs(x)-1.96)/.095)**2+((z-3.70)/.075)**2));
  const relief=surf-(.20*border+inside*(side?.32:.48))+.008*folds*(inside+border)-.05*inside*(1-smooth(-.08,.38,sd))-.07*ostium;
  const depth=Math.min(outer,relief),skin=1-smooth(-.05,.09,outer-relief);
  const flow=z*26+cos(x*2.9-z*.9)*2.7+sin(z*4+x*1.7)*.9;
  const grain=(sin(flow)*2.9+sin(2.3*flow+x*9)*1.6+cos(x*56+sin(z*6)*2)*1.5)*(1-inside);
  let c=mix3(muscle,[226,181,162],neck*.8);c=mix3(c,lining,border);c=mix3(c,mucosa,inside);
  c=pigment(c,grain*.63+inside*(folds*3+sin(x*32+z*5)*1.5)-inside*6*smooth(.1,.55,sd)+4*sin(x*2.3+z*2));
  c=mix3(c,[156,92,99],.24*exp(-(((sd+.245)/.052)**2)));c=mix3(c,[124,71,88],ostium*.77);
  c=mix3(c,serosa,skin);const edge=exp(-(((outer-relief-.035)/.047)**2));
  c=mix3(c,[240,188,164],edge*.77);
  return {p:[x,depth,z],c,center:yc,lining:border*(1-skin)*smooth(.36,.72,z),lumen:z>.49?inside*(1-skin):0};
});if(!back)mesh.etch=[engrave(false),engrave(true)];return mesh;}

/** Original hand-directed cut-surface engraving. These are material-space
 * fascicles / folds, sampled on the moving 3D face; never screen stickers. */
function engrave(side:boolean):Etching {
  const width=384,height=512,buf=new Float32Array(width*height),poly=cuts[+side];let seed=side?471:3181;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const widths=Array.from({length:height},(_,i)=>profile(corpus,mix(-1.618,4.819,i/(height-1)))[+side]);
  function uv(x:number,z:number):P{const v=(z+1.618)/6.437*(height-1),r=widths[Math.round(clamp(v,0,height-1))];
    const theta=Math.asin(clamp(abs(x)/r)),b=splitAngle(z,side),t=theta<b?seam*theta/b:seam+(1-seam)*(theta-b)/(PI/2-b);
    return [(.5+Math.sign(x)*t*.5)*(width-1),v];}
  function dab(x:number,y:number,r:number,value:number){for(let j=Math.max(0,Math.floor(y-r));j<=Math.min(height-1,y+r);j++)for(let i=Math.max(0,Math.floor(x-r));i<=Math.min(width-1,x+r);i++){
    const fall=1-((i-x)**2+(j-y)**2)/(r*r);if(fall>0)buf[j*width+i]+=value*fall;
  }}
  function stroke(fn:(t:number)=>P,r:number,ink:number){let last=uv(...fn(0));
    for(let j=1;j<=9;j++){const p=uv(...fn(j/9)),d=Math.hypot(p[0]-last[0],p[1]-last[1]),n=Math.max(1,Math.ceil(d/.84));
      for(let k=1;k<=n;k++){const t=k/n,x=mix(last[0],p[0],t),y=mix(last[1],p[1],t),wt=.2+.8*sin(PI*(j-1+t)/9)**.5;
        dab(x-.65,y+.63,r*.91,-ink*.48*wt);dab(x,y,r,ink*wt);}
      last=p;
    }
  }
  // Bundles turn over the fundus, run down the flanks, interlace at the
  // isthmus and resolve into a paler, collagen-rich cervical stroma.
  for(let k=0;k<1150;k++){
    const z=mix(-1.51,4.79,rand()),x=(rand()*2-1)*(side?1.62:2.44),rw=widths[Math.round((z+1.618)/6.437*(height-1))];
    if(abs(x)>rw*.94)continue;const sd=distance(poly,x,z);
    if(sd>-.19)continue;
    const gx=distance(poly,x+.035,z)-sd,gz=distance(poly,x,z+.035)-sd,len=Math.hypot(gx,gz)||1;
    const bias=(rand()-.5)*1.10+(k%5===0?.93:0),dx=(-gz*cos(bias)-gx*sin(bias))/len,dz=(gx*cos(bias)-gz*sin(bias))/len;
    const L=.095+rand()*.33,w=.65+rand()*.62,bend=(rand()-.5)*.070;
    const fn=(t:number,off:number):P=>[x+dx*L*(t-.5)-dz*(bend*sin(t*PI)+off),z+dz*L*(t-.5)+dx*(bend*sin(t*PI)+off)];
    stroke(t=>fn(t,0),w,-(3+rand()*6));if(k%4===0)stroke(t=>fn(t,.026),w*.85,-5);
  }
  // Delicate fan of striae on the intact posterior lining, ending under the
  // roof. Never use the large transverse rugae of the vagina in this region.
  for(let j=0;j<35;j++){
    const s=(j-17)/17,lo=.59+rand()*1.42,hi=2.43+rand()*.99;
    stroke(t=>{const z=mix(lo,hi,t);return [s*(side?.085:.12+1.53*((z-.5)/3)**1.36)+.018*sin(z*4+s*5),z];},.67+rand()*.56,-(5+rand()*9));
  }
  for(let s=-1;s<=1;s+=2)for(let j=0;j<11;j++){
    const z=-1.45+j*.145,r=.11+.064*sin(j/10*PI);
    stroke(t=>[s*(.015+t*r),z+.076*t+.034*t*t],.83,-15);
  }
  return {width,height,ink:Int8Array.from(buf,x=>clamp(Math.round(x),-32,30))};
}

export const ENTRY=-3.88, STOP=-1.53;
export const canalY=(t:number)=>.35-.78*t-.04*sin(t*PI);
function vagina(back:boolean){return grid(back?26:57,back?20:47,true,0,(u,v,side)=>{
  const a=(u-.5)*PI,rw=side?.61+v*.34:1.08+v*.33,rd=side?1.08+v*.33:.61+v*.34;
  const x=rw*sin(a),z=ENTRY+v*(3.00+.26*sin(a)**2+(side?.19*sin(a):0))+.09*sin(a*1.7)*(1-v);
  const yc=canalY((z-ENTRY)/(STOP-ENTRY)),outer=rd*cos(a);
  if(back)return {p:[x,-outer,z],c:[174,111,122],center:yc};
  const cut=.29+.12*v,wall=side?smooth(.14+.19*v,.36+.15*v,abs(x)):clamp((abs(x)/rw-.78)/.17),rugae=sin(v*49+2.6*cos(x*2.6)+.9*sin(v*11+x*4));
  const rib=(.5+.5*rugae)**2,depth=Math.min(outer,mix(-.28-.13*cos(a)+.049*rib*(.66+.34*cos(x*3.2+v*4)),cut,wall));
  const fill=(1-wall)*smooth(.00,.06,outer-depth);
  return {p:[x,depth,z],center:yc,c:mix3(pigment([183,108,119],rib*25-6),[226,160,143],wall),lumen:2*fill};
});}

function norm(v:V):V{const m=Math.hypot(...v)||1;return v.map(x=>x/m) as V;}
function cross(a:V,b:V):V{return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function sweep(s:number,path:(t:number)=>V,radius:(t:number,a:number)=>number,color:(t:number,a:number)=>V,n=32,m=12,flat=1){
  return grid(m,n,false,s,(u,v)=>{const p=path(v),p0=path(clamp(v-.002)),p1=path(clamp(v+.002));
    const t=norm([p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]]),b=norm(cross(t,[0,1,0])),c=cross(t,b),a=TAU*u,r=radius(v,a);
    return {p:p.map((e,i)=>e+r*(cos(a)*b[i]+sin(a)*c[i]*flat)) as V,c:color(v,a)};
  });
}
const tubePoints=[[1.92,1.09,3.63],[2.49,1.04,3.65],[2.93,.96,3.54],[3.35,.75,3.67],[3.73,.67,3.99],[4.09,.44,4.07],[4.48,.19,3.97],[4.90,-.09,4.13],[5.29,-.43,4.10],[5.54,-.74,3.88],[5.59,-.64,3.59],[5.47,-.37,3.38]];
function tubePath(t:number,s:number):V{const [x,y,z]=spline(tubePoints,t);return [x*s,y+(s<0?.18*sin(t*3):0),z+(s<0?.16*sin(t*6):0)];}
const ovary=(s:number):V=>[4.53*s,-1.19+(s<0?.19:0),2.74+(s<0?-.14:0)];
function adnexa(s:number,all:Mesh[]){
  const o=ovary(s),pt=(t:number)=>tubePath(t,s);
  // The thin mesosalpinx hangs from the tubal arch, tapering to the ovarian
  // ligament. Modulated thickness and converging folds give it a translucent look.
  function membrane(u:number,v:number):V{
    const a=pt(u*.98),h=spline([[.71,-.24,1.15],[2.01,-.53,1.75],[3.21,-.78,2.29],[4.29,-1.34,2.49],[5.40,-1.25,3.38]],u) as V;
    h[0]*=s;const p=mix3(h,a,v);p[1]-=.42+.17*sin(PI*v)*sin(u*21+v*2);return p;
  }
  all.push(grid(51,15,false,s,(u,v)=>({p:membrane(u,v),c:pigment(mix3([169,116,128],[219,164,154],v*.72),7*sin(u*21+v*4))})));
  // Fine vascular arcades on the supporting fold; they branch toward the tube.
  const vessel=(u:number,v:number)=>{const p=membrane(u,v);p[1]+=.031;return p;};
  all.push(sweep(s,t=>vessel(.14+.72*t,.19+.055*sin(t*8)),t=>.020-.007*t,()=>[151,97,116],28,6));
  for(let j=0;j<5;j++){
    const u0=.21+j*.119,v0=.19+.055*sin((u0-.14)/.72*8);
    all.push(sweep(s,t=>vessel(u0+.065*t+.017*sin(t*5+j)*t,v0+.62*t),t=>.021*(1-.72*t),()=>[158,102,119],15,6));
    all.push(sweep(s,t=>vessel(u0+.027-.043*t,v0+.22+.22*t),t=>.012*(1-.72*t),()=>[165,111,125],9,5));
  }
  all.push(sweep(s,t=>{const p=spline([[1.61,.78,2.86],[2.48,.04,2.68],[3.18,-.31,2.58],[3.90,-.92,o[2]]],t) as V;p[0]*=s;return p;},t=>.095+.045*sin(t*PI),()=>[218,167,150],21,10));
  const ro=(t:number,a:number)=>.115+.066*smooth(.16,.70,t)+.19*smooth(.83,1,t)+.027*cos(7*a+t*5)*smooth(.78,1,t);
  all.push(sweep(s,pt,ro,
    (t,a)=>pigment(mix3([218,148,143],[229,162,144],t),cos(a*6+t*4)*3),64,18));
  all.push(sweep(s,t=>pt(.90+.1*t),(t,a)=>ro(.90+.1*t,a)*(.28+.69*t),
    (t,a)=>pigment(mix3([133,74,91],[220,139,135],t),cos(8*a)*8),13,24));
  const end=pt(1),prev=pt(.999),axis=norm(end.map((val,i)=>val-prev[i]) as V),bi=norm(cross(axis,[0,1,0])),ci=cross(axis,bi);
  // Eleven separate curled, tapered fimbrial lamellae and one ovarian fimbria.
  for(let j=0;j<12;j++){
    const a=j*TAU/12+.12*sin(j*4.2),len=.35+.24*(.5+.5*sin(3.3*j))+(j===6?.27:0);
    all.push(sweep(s,t=>{const b=a+.26*sin(t*5+j)*t+.12*t,rr=ro(1,a)-.018+.25*sin(t*1.85)+.045*sin(6*t+j)*t;
      return end.map((e,i)=>e+axis[i]*len*t+rr*(cos(b)*bi[i]+sin(b)*ci[i])-(i===2?.30*t*t:i===0?.12*s*t*t:0)) as V;},
      t=>.080*(.89+.32*sin(t*PI)+.15*sin(t*8+j))*(1-.89*t**2), (t,b)=>pigment(mix3([205,123,123],[241,165,144],t),cos(b)*5),15,8,.59));
  }
  // Pearl cortex. On one ovary an opened anterior window exposes embedded
  // follicles of uneven sizes (not beads attached to its outside).
  const follicles=[[.48,.09,.24],[-.19,.33,.14],[-.47,-.17,.11],[.08,-.27,.10],[.63,-.21,.08],[-.62,.07,.063],[.10,.10,.055]];
  all.push(grid(78,39,false,s,(u,v)=>{
    const a=TAU*u,b=(v-.5)*PI,xx=cos(b)*cos(a)*1.05,yy=cos(b)*sin(a)*.57,zz=sin(b)*.56;
    const rind=sin(xx*16+zz*9)*sin(zz*20-xx*5)*cos(a*3)*.013;
    let y=yy+rind,col=pigment([224,193,160],4*sin(xx*11+sin(zz*12))+4*cos(zz*17+xx*7));
    if(s===-1&&yy>.24){y=.24;col=[227,172,142];const edge=smooth(.24,.29,yy);col=mix3([250,220,179],col,edge);
      for(const [cx,cz,r] of follicles){const dx=xx-cx,dz=zz-cz,rr=sqrt(dx*dx+dz*dz)/r;
        if(rr>1.23)continue;const inside=1-smooth(.82,1.01,rr);
        col=mix3(col,[246,209,174],1-smooth(.99,1.23,rr));col=mix3(col,[164+30*rr,115+31*rr,118+18*rr],inside);
        y-=inside*.08;y+=.018*exp(-(((rr-.98)/.11)**2));if(Math.hypot(dx+.35*r,dz-.27*r)<r*.17)col=[242,210,170];
      }
    }
    return {p:[o[0]+s*(xx*.96-zz*.27),o[1]+y,o[2]+xx*.27+zz*.96],c:col};
  }));
}
let cached:Mesh[]|undefined;
export function organMeshes(){if(!cached){cached=[vagina(true),vagina(false),body(true),body(false)];adnexa(-1,cached);adnexa(1,cached);}return cached;}
