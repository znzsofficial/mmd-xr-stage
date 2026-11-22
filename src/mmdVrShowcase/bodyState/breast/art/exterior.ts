import { cutBounds, TAU, type Camera, type Ink, type P, type Side, type V } from './geometry';
import { drawSection, ductPoint, fatPoint, glandPoint, H, R, W, Y } from './section';

// A closed upper torso plus two continuously rounded, overlapping skin
// patches. The root of a patch samples the same thorax surface as the torso;
// only the free tissue projects and sags. There is no opening, muscle or
// false-colour anatomy in this view. x/y/z and normals are in body space.
const stride=9;
type Mesh={data:Float32Array;indices:Uint16Array;breast?:boolean;material?:'silk'|'metal'|'stone'|'hair'|'section'};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{x=clamp(x);return x*x*(3-2*x);};

// The arm is a separate continuous volume: the negative space from axilla
// to waist remains visible in front, and the arm occludes the flank in profile.
const trunk=[[-1.26,.70,.44],[-.89,.62,.39],[-.56,.64,.415],[-.20,.728,.47],[.17,.775,.525],[.47,.852,.525],
  [.60,.89,.50],[.71,.79,.43],[.78,.64,.36],[.85,.405,.28],[.96,.261,.225],[1.14,.244,.215],[1.39,.273,.24]];
const armForm=[[-1.28,2.59,.115,.14,-.285],[-.89,2.29,.128,.16,-.23],[-.49,1.98,.159,.183,-.193],[-.16,1.73,.177,.206,-.163],
  [.19,1.426,.205,.234,-.131],[.41,1.19,.215,.245,-.112],[.55,1.044,.225,.233,-.090],[.65,.932,.217,.195,-.073],
  [.723,.811,.163,.142,-.070],[.773,.701,.082,.076,-.082],[.785,.588,.002,.002,-.096]];
function profile(table:number[][],y:number,k:number){
  let i=1;while(i<table.length-1&&table[i][0]<y)i++;
  const a=table[i-1],b=table[i],l=table[Math.max(0,i-2)],r=table[Math.min(table.length-1,i+1)],span=b[0]-a[0];
  const t=clamp((y-a[0])/span),s=t*t*(3-2*t);
  return a[k]*(1-s)+b[k]*s+t*(1-t)*((1-t)*(b[k]-l[k])*span/(b[0]-l[0])-t*(r[k]-a[k])*span/(r[0]-a[0]));
}
const width=(y:number)=>profile(trunk,y,1),depth=(y:number)=>profile(trunk,y,2);
function chest(a:number,y:number):V {
  const w=width(y),x=w*Math.sin(a),c=Math.cos(a),ax=Math.abs(x),front=clamp(c*6);
  const clav=.718+.062*Math.sin(ax*4.8)-.092*(ax-.53)**2;
  const relief=front*(.037*Math.exp(-(((y-clav)/.061)**2))*smooth(ax/.15)-
    .046*Math.exp(-(((y-.744)/.095)**2)-(x/.133)**2)-.015*Math.exp(-((x/.089)**2)-((y-.28)/.49)**2));
  const collar=front*(.029*Math.exp(-(((y-.83)/.16)**2)-((ax-.22)/.11)**2));
  return [x,y,depth(y)*c+relief+collar-.063*smooth((y-.69)/.37)];
}

function grid(rows:number,cols:number,vertex:(t:number,r:number)=>V,paint:(t:number,r:number)=>V):Mesh {
  const data=new Float32Array(rows*cols*stride),ix=new Uint16Array((rows-1)*(cols-1)*6);let k=0,m=0;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const t=i/(cols-1),r=j/(rows-1),pos=vertex(t,r),pig=paint(t,r);
    data[k]=pos[0];data[k+1]=pos[1];data[k+2]=pos[2];data[k+6]=pig[0];data[k+7]=pig[1];data[k+8]=pig[2];k+=stride;
    if(i<cols-1&&j<rows-1){const a=j*cols+i,b=a+cols;ix[m++]=a;ix[m++]=b;ix[m++]=a+1;ix[m++]=b;ix[m++]=b+1;ix[m++]=a+1;}
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const a=(j*cols+i)*stride,left=(j*cols+(i===0?cols-2:i-1))*stride,right=(j*cols+(i===cols-1?1:i+1))*stride,
      lower=(Math.max(0,j-1)*cols+i)*stride,upper=(Math.min(rows-1,j+1)*cols+i)*stride;
    const u=data[right]-data[left],v=data[right+1]-data[left+1],w=data[right+2]-data[left+2],
      h=data[upper]-data[lower],g=data[upper+1]-data[lower+1],f=data[upper+2]-data[lower+2];
    const nx=v*f-w*g,ny=w*h-u*f,nz=u*g-v*h,len=Math.hypot(nx,ny,nz)||1;
    data[a+3]=nx/len;data[a+4]=ny/len;data[a+5]=nz/len;
  }return {data,indices:ix};
}

let torso:Mesh|undefined;
function body(){return torso??=grid(54,73,(t,r)=>chest(t*TAU,-1.26+2.65*r),(t,r)=>{
  // Soft contact shade along the inferior folds. The torso's pigment and
  // geometry are independent of glandular state on either side.
  const a=t*TAU,y=-1.26+2.65*r,x=Math.abs(width(y)*Math.sin(a)),front=clamp(Math.cos(a)*5);
  const fold=-.555+.36*(x-.47)**2;
  const occl=front*(.056*Math.exp(-(((y-fold)/.126)**2)-((x-.48)/.37)**4)+
    .034*Math.exp(-((x/.13)**2)-((y+.23)/.27)**2));
  const v=3*smooth((r-.45)*2)-5*smooth((.26-r)*3);
  return [248+v-occl*61,211+v-occl*247,192+v-occl*164];
});}

const arms=(side:Side)=>grid(45,33,(t,r)=>{
  const y=-1.28+2.059*r,a=t*TAU;
  return [side*(profile(armForm,y,1)+profile(armForm,y,2)*Math.sin(a)),y,profile(armForm,y,4)+profile(armForm,y,3)*Math.cos(a)];
},(t,r)=>{const inner=clamp(-Math.sin(t*TAU)*2.6)*smooth((.94-r)/.24);return [249-inner*7,210-inner*21,190-inner*12];});

function choker(){const mesh=grid(11,81,(t,r)=>{
  const a=t*TAU,y=.952+.090*r-.010*Math.cos(a);const [x,_,z]=chest(a,y),relief=.008+.010*Math.sin(r*Math.PI);
  return [x+relief*Math.sin(a),y,z+relief*Math.cos(a)];
},(t,r)=>{const braid=r<.12||r>.88||r>.27&&r<.33,crease=Math.sin(Math.PI*r)**3;
  return braid?[210,152,126]:[75+19*crease,44+10*crease,69+16*crease]});mesh.material='silk';return mesh;}

function jewel(y:number,rx:number,ry:number,rz:number,z:number,kind:'metal'|'stone'){
  const mesh=grid(13,25,(t,r)=>{const a=t*TAU,b=(r-.5)*Math.PI,cr=Math.cos(b),drop=1-.29*Math.sin(b);
    return [rx*Math.sin(a)*cr*drop,y+ry*Math.sin(b),z+rz*Math.cos(a)*cr];},()=>kind==='stone'?[193,76,102]:[235,181,119]);mesh.material=kind;return mesh;
}

/** Two tapered, cross-sectioned locks at each outer shoulder. Their loose
 * curves frame the crop without falling over the central tissue. */
function lock(side:Side,which:number){
  const mesh=grid(39,17,(t,r)=>{
    const a=t*TAU,u=1-r,lo=(which?.39:.37)+side*.059,y=lo+(1.46-lo)*r;
    const swing=which?.08:-.16;
    const x=.57+.54*u+.10*Math.sin(Math.PI*u)+swing*smooth((u-.64)/.36)+side*.034*Math.sin(u*4.0);
    const z=.14+.21*Math.sin(u*2.3)-.10*r+(which?-.063:0);
    const radius=(which?.043:.092)*smooth(r/.43)**.73*(1+.12*Math.sin(r*8));
    return [side*(x+radius*Math.sin(a)),y,z+radius*(.31*Math.cos(a)+.30*Math.sin(a)*Math.sin(r*4.4))];
  },(t,r)=>{const a=t*TAU,u=1-r,light=Math.max(0,Math.cos(a+.49+.24*Math.sin(u*4)))**12,bounce=.4+.6*Math.sin(r*3.3),ridge=smooth((Math.cos(3*a+r*2)-.932)/.064);
    return [79+70*light*bounce+13*ridge,44+39*light*bounce+8*ridge,64+33*light*bounce+7*ridge];});mesh.material='hair';return mesh;
}

let costume:Array<[Mesh,number]>|undefined;
function figure(){return costume??=[[body(),1],[arms(-1),-1],[arms(1),1],[choker(),1],
  [jewel(.934,.033,.035,.019,.237,'metal'),1],[jewel(.88,.046,.064,.018,.280,'metal'),1],
  [jewel(.88,.033,.048,.015,.294,'stone'),1],[lock(-1,0),-1],[lock(-1,1),-1],[lock(1,0),1],[lock(1,1),1]];}

const rings=[.0004,.018,.030,.046,.057,.071,.088,.108,.132,.154,.18,.208,.235,.268,.30,.34,.38,.42,.46,.50,.54,.58,.62,.66,.70,.74,.78,.82,.86,.895,.93,.96,.984,.998,1];
function mound(side:Side,full:number) {
  const rx=.449+.042*full, ry=.383+.064*full, projection=.423+.266*full;
  const cache:Array<[number,number,number]>=[];
  for(let i=0;i<57;i++) {const a=i/56*TAU;cache.push([Math.cos(a),Math.sin(a),a]);}
  const mesh=grid(rings.length,57,(t,j)=>{
    const [u,v]=cache[Math.round(t*56)],r=rings[Math.round(j*(rings.length-1))],tail=Math.max(0,u*v),free=1-r*r;
    const baseY=.022+ry*r*v*(v>0?1.31:1),x0=.431+r*((u<0?Math.min(.422,rx):Math.min(rx,width(baseY)-.442))*u+.012*tail);
    // Lateral tissue sweeps past its narrower insertion and returns under
    // the arm. Its broad lower pole is not the end of a hanging ellipsoid.
    const skirt=(.441+.121*full)*r*free**.69*Math.max(0,u)**1.12*(1+.13*Math.max(0,-v))*smooth((r-.16)/.43)*(1+.012*side);
    // A static weight-bearing lower pole, including at t=0. The root is
    // fixed; the upper skin descends into a shallower ramp than the lower fold.
    const load=(.137+.087*full+side*.009)*free**1.45;
    const y=baseY-load-.191*r*free*Math.max(0,-v)+.020*tail*r-.029*r*free*Math.max(-u,0)*Math.max(.27-v,0);
    const papilla=1-smooth((r-.027)/.078),dome=.009*Math.exp(-((r/.181)**2));
    const x=x0+free*(.036+.023*full)+skirt+.006*papilla,a=Math.asin(clamp(x0/width(baseY)));
    const z=chest(a,baseY)[2]+.0016+projection*free**(.93+.34*v)*(1-.18*r*Math.max(0,v))+dome+.019*papilla;
    return [side*x,y-.004*papilla,z];
  },(t,j)=>{
    const r=rings[Math.round(j*(rings.length-1))],[u,v,a]=cache[Math.round(t*56)];
    // Pigment feathers into the surrounding skin on the surface, never a
    // flat disc pasted onto a camera-facing billboard.
    const radius=r*(1+.058*u-.030*v+side*.018),edge=1-smooth((radius-.128)/.130),core=Math.exp(-((radius/.187)**2));
    const areola=.70*edge+.30*core,tip=1-smooth((radius-.029)/.049);
    const warmth=(1-r*r)*2.5,vary=.82*areola*(Math.sin(2.4*a+17*r+side)+.54*Math.cos(4*a-19*r));
    const blush=(1-r*r)*(.48+.32*v)*6;
    const glint=7*Math.exp(-(((u*r+.014*side)/.029)**2)-((v*r-.022)/.023)**2),foot=Math.exp(-(((radius-.07)/.025)**2))*(.56-.44*v);
    return [248+warmth-19*areola-5*tip+vary+glint,211+warmth-32*areola-10*tip+vary-blush+glint-3*foot,192+warmth-25*areola-8*tip+vary-blush*.6+glint-2*foot];
  });
  // Blend tangent normals onto the fixed rib cage at the insertion. A
  // continuous upper-pole highlight is more convincing than a hard oval
  // separating two differently lit meshes. Preserve the lower fold.
  const d=mesh.data;
  for(let j=0;j<rings.length;j++)for(let i=0;i<57;i++){
    const k=(j*57+i)*stride,r=rings[j],v=cache[i][1],x=d[k],y=d[k+1],w=width(y),a=Math.asin(Math.max(-1,Math.min(1,x/w)));
    // The inferior/posterior return tucks into the flank. Fade the normal at
    // this actual junction to prevent a rose shadow ending in a cut triangle.
    const seam=r>.68&&Math.abs(x)<w&&v<-.12?(1-smooth((d[k+2]-chest(a,y)[2]-.012)/.13))*smooth((-.12-v)/.51):0;
    const mix=Math.max(.91*seam,smooth((r-.68)/.32)*smooth((v+.83)/.97));
    if(mix===0)continue;
    const u=chest(a+.002,y),l=chest(a-.002,y),h=chest(a,y+.002),b=chest(a,y-.002);
    const dx=u[0]-l[0],dz=u[2]-l[2],dy=h[1]-b[1],nx=-dz*dy,ny=dz*(h[0]-b[0])-dx*(h[2]-b[2]),nz=dx*dy;
    const mag=Math.hypot(nx,ny,nz)||1;
    let sx=(1-mix)*d[k+3]-side*mix*nx/mag,sy=(1-mix)*d[k+4]-side*mix*ny/mag,sz=(1-mix)*d[k+5]-side*mix*nz/mag;
    const norm=Math.hypot(sx,sy,sz)||1;d[k+3]=sx/norm;d[k+4]=sy/norm;d[k+5]=sz/norm;
  }mesh.breast=true;return mesh;
}

export type Surface=HTMLCanvasElement|OffscreenCanvas;
export type Bitmap={canvas:Surface;ctx:Ink};
export type Allocate=(w:number,h:number)=>Bitmap|null;

// Compact CPU depth pass. Only the cropped model rectangle is rasterized;
// smooth per-vertex light avoids a faceted skin or thousands of Canvas paths.
const PX=1.3, SCALE=147, FOCUS=.21, ORIGIN=165, RW=520, RH=338, N=6;
const settleWeight=(r:number,v:number)=>.034*smooth((.94-r)/.64)*(.42+.58*smooth((.45-v)/1.1));
function project(mesh:Mesh,cam:Camera,out:Float32Array,flip:number,settle=0){
  const v=mesh.data,{s,c}=cam;
  for(let i=0,k=0;i<v.length;i+=stride,k+=N){
    const x=v[i],z=v[i+2],d=x*s+z*c,idx=i/stride,r=mesh.breast?rings[Math.floor(idx/57)]:1;
    const y=v[i+1]+(settle&&mesh.breast?settle*settleWeight(r,r*Math.sin(TAU*(idx%57)/56)):0);
    out[k]=(200+SCALE*(x*c-(z-FOCUS)*s))*PX;out[k+1]=(ORIGIN-SCALE*(y-.057*d))*PX;out[k+2]=d+y*.057;
    if(mesh.material==='section'){out[k+3]=v[i+6];out[k+4]=v[i+7];out[k+5]=v[i+8];continue;}
    const nx=flip*v[i+3],ny=flip*v[i+4],nz=flip*v[i+5],lr=nx*c-nz*s,eye=nx*s+nz*c;
    const light=-.47*lr+.68*ny+.56*eye;
    if(mesh.material){const h=clamp(-.34*lr+.54*ny+.766*eye),metal=mesh.material==='metal',stone=mesh.material==='stone';
      const diff=.68+.34*clamp(light),glint=smooth((h-(metal?.89:.95))/.055)*(metal?59:stone?94:24);
      out[k+3]=v[i+6]*diff+glint;out[k+4]=v[i+7]*diff+glint;out[k+5]=v[i+8]*diff+glint;continue;}
    // Two hand-painted colour families, with a soft cel terminator rather
    // than a grey Lambert ramp. Raking light stays creamy along the shoulder.
    const rounded=mesh.breast?1-smooth((r-.088)/.16):0;
    const shade=1-smooth((light-.045+.21*rounded)/(.23+.45*rounded)),deep=1-smooth((light+.53)/.35),lite=smooth((light-.58)/.30),rim=(1-clamp(eye))**4;
    const h=clamp(-.27*lr+.59*ny+.761*eye),shine=smooth((h-.962)/.032);
    out[k+3]=v[i+6]-16*shade-26*deep+6*lite+4*shine+6*rim;
    out[k+4]=v[i+7]-47*shade-29*deep+9*lite+9*shine+5*rim;
    out[k+5]=v[i+8]-27*shade-19*deep+10*lite+10*shine+10*rim;
  }
}
function raster(ix:Uint16Array,v:Float32Array,z:Float32Array,col:Uint8ClampedArray,tile?:ImageData) {
  for(let i=0;i<ix.length;i+=3){
    const a=N*ix[i],b=N*ix[i+1],c=N*ix[i+2],x=v[a],y=v[a+1],bx=v[b]-x,by=v[b+1]-y,cx=v[c]-x,cy=v[c+1]-y;
    const det=bx*cy-by*cx;if(Math.abs(det)<.012)continue;
    const x0=Math.max(0,Math.ceil(x+Math.min(0,bx,cx))),x1=Math.min(RW-1,Math.floor(x+Math.max(0,bx,cx))),
      y0=Math.max(0,Math.ceil(y+Math.min(0,by,cy))),y1=Math.min(RH-1,Math.floor(y+Math.max(0,by,cy)));
    const uX=cy/det,uY=-cx/det,vX=-by/det,vY=bx/det,za=v[a+2],dz1=v[b+2]-za,dz2=v[c+2]-za;
    for(let row=y0;row<=y1;row++){
      let u=(x0-x)*uX+(row-y)*uY,t=(x0-x)*vX+(row-y)*vY;
      for(let px=x0;px<=x1;px++,u+=uX,t+=vX){
        if(u<-.001||t<-.001||u+t>1.001)continue;
        const n=row*RW+px,d=za+dz1*u+dz2*t;if(d<z[n])continue;
        z[n]=d;const q=n*4;
        if(tile){
          const tx=Math.min(tile.width-1,Math.max(0,Math.round(v[a+3]+(v[b+3]-v[a+3])*u+(v[c+3]-v[a+3])*t))),
            ty=Math.min(tile.height-1,Math.max(0,Math.round(v[a+4]+(v[b+4]-v[a+4])*u+(v[c+4]-v[a+4])*t))),p=(ty*tile.width+tx)*4;
          // The border samples just outside the anti-aliased tile are dermis.
          const opaque=tile.data[p+3]>100;
          col[q]=opaque?tile.data[p]:249;col[q+1]=opaque?tile.data[p+1]:204;col[q+2]=opaque?tile.data[p+2]:177;
        }else for(let k=3;k<6;k++)col[q+k-3]=v[a+k]+(v[b+k]-v[a+k])*u+(v[c+k]-v[a+k])*t;
        col[q+3]=255;
      }
    }
  }
}

// The sparse marks are curves on the volumes, not marks in screen space.
// A depth-tested brush gives them a pointed start and a fuller stroke through
// the turn. Hair, near arm and breast can all hide the far-side brush.
function breastPoint(m:Mesh,u:number,v:number):V{
  const r=Math.min(.999,Math.hypot(u,v)),theta=(Math.atan2(v,u)/TAU+1)%1*56,i=Math.min(55,Math.floor(theta));
  let j=1;while(j<rings.length-1&&rings[j]<r)j++;
  const f=clamp((r-rings[j-1])/(rings[j]-rings[j-1])),g=theta-i,d=m.data,p=((j-1)*57+i)*stride,off=57*stride;
  const at=(k:number)=>((1-g)*d[p+k]+g*d[p+stride+k])*(1-f)+((1-g)*d[p+off+k]+g*d[p+off+stride+k])*f;
  return [at(0),at(1),at(2)];
}

const startAngle=(r:number)=>Math.acos(.04+.68*r);
const cutAt=(mesh:Mesh,r:number,h:number):V=>{
  const a=startAngle(r),x=r*Math.cos(a),v=r*Math.sin(a),lo=breastPoint(mesh,x,-v),hi=breastPoint(mesh,x,v);
  return [lo[0]+h*(hi[0]-lo[0]),lo[1]+h*(hi[1]-lo[1]),lo[2]+h*(hi[2]-lo[2])];
};
function cutMound(mesh:Mesh){
  // Trim the lateral sector from the same rounded mesh, keeping its original
  // smooth skin normals. The exposed surface shares both actual cut edges.
  const data=new Float32Array(mesh.data.length),source=mesh.data;
  for(let j=0;j<rings.length;j++){
    const r=rings[j],alpha=startAngle(r);
    for(let i=0;i<57;i++){
      const t=(alpha+(TAU-2*alpha)*i/56)*56/TAU,k=Math.floor(t),q=t-k,d=(j*57+i)*stride,a=(j*57+k)*stride;
      for(let n=0;n<stride;n++)data[d+n]=source[a+n]+(source[a+stride+n]-source[a+n])*q;
    }
  }
  const face=grid(rings.length,5,(h,j)=>cutAt(mesh,rings[Math.round(j*(rings.length-1))],h),(h,j)=>{
    const r=rings[Math.round(j*(rings.length-1))],s=1-r**1.60,[hi,lo]=cutBounds(s);
    return [s*(W-1),Y-(lo+(hi-lo)*h)*R,1];
  });face.material='section';return {skin:{indices:mesh.indices,data,breast:true},face};
}

function wallPoint(side:Side,t:number,u:number):V{
  const y=-.58+1.23*t,a=.52+.84*u+.08*Math.cos(t*4.2),[x,_,z]=chest(side*a,y);
  return [x+side*.009*Math.sin(a),y,z+.009*Math.cos(a)];
}
let walls:Mesh[]|undefined;
function wallMeshes(){return walls??=([-1,1] as Side[]).map(side=>{
  const m=grid(24,19,(u,t)=>wallPoint(side,t,u),(u,t)=>[u*127,(1-t)*195,1]);m.material='section';return m;
});}
function wallTile(ctx:Ink){
  const g=ctx.createLinearGradient(0,0,128,90);g.addColorStop(0,'#d27e80');g.addColorStop(.52,'#e9a391');g.addColorStop(1,'#a65f76');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,196);ctx.lineJoin='round';ctx.lineCap='round';
  for(let j=0;j<21;j++){ctx.beginPath();ctx.moveTo(-2,j*10);ctx.bezierCurveTo(26,j*9+2,54,j*5+6,80,j*3-4);
    ctx.strokeStyle=j%3?'#de9590':'#f6ba9e';ctx.lineWidth=j%3?1.1:2;ctx.stroke();}
  ctx.beginPath();ctx.moveTo(77,-1);ctx.bezierCurveTo(85,55,62,146,78,197);ctx.lineTo(128,197);ctx.lineTo(128,-1);ctx.closePath();ctx.fillStyle='#b7717d';ctx.fill();ctx.lineWidth=2.8;ctx.strokeStyle='#f6b49c';ctx.stroke();
  for(let j=0;j<8;j++){
    const y=j*27+3,x=101+3*Math.sin(j*1.3);ctx.beginPath();ctx.ellipse(x,y,17,6,-.27,0,TAU);ctx.fillStyle='#f3cfab';ctx.fill();ctx.strokeStyle='#bd8581';ctx.lineWidth=1.3;ctx.stroke();
    ctx.beginPath();ctx.ellipse(x,y,11,2.9,-.27,0,TAU);ctx.fillStyle='#d99792';ctx.fill();
    for(let k=0;k<4;k++){ctx.beginPath();ctx.ellipse(x-7+k*4,y+2-k,.8,.65,0,0,TAU);ctx.fillStyle='#ffe4bb';ctx.fill();}
  }ctx.fillStyle='#f4c8b2';ctx.fillRect(0,0,3,196);
}

export type Marks={muscle:P;wall:P;gland:P;duct:P;fat:P};
function marks(mesh:Mesh,side:Side,cam:Camera,z:Float32Array):Marks {
  const p=([x,y,z]:V):P=>[200+SCALE*(x*cam.c-(z-FOCUS)*cam.s),ORIGIN-SCALE*(y-.057*(x*cam.s+z*cam.c))];
  const tissue=([s,h]:readonly[number,number])=>{const [hi,lo]=cutBounds(s);return p(cutAt(mesh,(1-s)**(1/1.6),clamp((h-lo)/(hi-lo))));};
  const wallSide=Math.abs(cam.s)<.40?(side===1?-1:1):side;
  const wallMark=(ty:number,tx:number)=>{
    let best=Infinity,anchor=p(wallPoint(wallSide,ty,tx));
    for(let j=0;j<17;j++)for(let i=0;i<8;i++){
      const t=.035+j*.059,u=(tx>.5 ? .64 : .036)+i*.040,v=wallPoint(wallSide,t,u),pt=p(v),d=v[0]*cam.s+v[2]*cam.c+.057*v[1],
        diff=Math.abs(d-z[Math.round(pt[1]*PX)*RW+Math.round(pt[0]*PX)]),dist=Math.abs(t-ty)+Math.abs(u-tx)*.5;
      if(diff<.019&&dist<best){best=dist;anchor=pt;}
    }return anchor;
  };
  return {muscle:wallMark(.91,.29),wall:wallMark(.26,.83),gland:tissue(glandPoint),duct:tissue(ductPoint),fat:tissue(fatPoint)};
}
function brushwork(ctx:Ink,cam:Camera,z:Float32Array,breasts:Mesh[],settle:number) {
  const brush=(point:(t:number)=>V,ink:string,width:number,steps=36)=>{
    let pts:Array<[number,number,number]>=[];
    const finish=()=>{if(pts.length<2){pts=[];return;}
      const rim:Array<[number,number]>=[],aft:Array<[number,number]>=[];
      for(let i=0;i<pts.length;i++){
        const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],p=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],k=p[2]/(Math.hypot(dx,dy)||1);
        rim.push([p[0]-dy*k,p[1]+dx*k]);aft.push([p[0]+dy*k,p[1]-dx*k]);
      }
      ctx.beginPath();ctx.moveTo(...rim[0]);for(const p of rim)ctx.lineTo(...p);for(let i=aft.length-1;i>=0;i--)ctx.lineTo(...aft[i]);
      ctx.closePath();ctx.fillStyle=ink;ctx.fill();pts=[];
    };
    for(let i=0;i<=steps;i++){
      const t=i/steps,[x,y,w]=point(t),d=x*cam.s+w*cam.c,px=(200+SCALE*(x*cam.c-(w-FOCUS)*cam.s))*PX,py=(ORIGIN-SCALE*(y-.057*d))*PX;
      const k=Math.floor(py)*RW+Math.floor(px),visible=px>=0&&py>=0&&px<RW&&py<RH&&Math.abs(d+y*.057-z[k])<.027;
      if(visible)pts.push([px,py,width*PX*.5*Math.sin(t*Math.PI)**.62]);else finish();
    }finish();
  };
  for(const side of [-1,1] as Side[]){
    const clav=(t:number,dy:number)=>{const a=.074+t*.90,ax=width(.70)*Math.sin(a);return chest(side*a,.701+.073*Math.sin(ax*4.6)+dy);};
    brush(t=>clav(t,0),'#b77676',1.34);
    brush(t=>clav(.17+.56*t,.028),'#ffeacd',1.83);
    brush(t=>chest(side*(.116+.138*t),.898-.151*t),'#c68b86',.88);
    brush(t=>chest(side*(1.064+.38*t),.53-.25*t+.027*Math.sin(t*Math.PI)),'#b57578',1.36);
    const m=breasts[side===1?1:0],at=(u:number,v:number)=>{const p=breastPoint(m,u,v);if(settle)p[1]+=settle*settleWeight(Math.hypot(u,v),v);return p;};
    brush(t=>{const a=3.63+1.87*t,r=.941-.060*Math.sin(Math.PI*t);return at(r*Math.cos(a),r*Math.sin(a));},'#aa737d',.90);
    // A pair of tapered peach-white accents; the broader softbox tint is
    // in the skin shader, leaving these few small shapes sharply legible.
    brush(t=>at(-side*.20+.067*Math.sin(t*1.9),.43-.207*t),'#fff1d8',2.91,22);
    brush(t=>at(-side*.23+.025*t,.27-.049*t),'#fff4dd',1.48,14);
    brush(t=>at(side*(-.022+.047*t),.024+.008*Math.sin(t*Math.PI)),'rgba(255,222,196,.81)',1.27,14);
  }
  brush(t=>chest((t-.5)*.19,.736-.021*Math.sin(t*Math.PI)),'#af7477',1.20,20);
}
export function exterior(allocate:Allocate) {
  const bitmap=allocate(RW,RH);if(!bitmap)return null;
  const img=bitmap.ctx.createImageData(RW,RH),depths=new Float32Array(RW*RH);
  const work=new Float32Array(body().data.length/stride*N);
  type Entry={full:number;mesh:Mesh|null;cut?:ReturnType<typeof cutMound>;tile?:ImageData;amount?:number};
  const cache:Entry[]=[{full:-1,mesh:null},{full:-1,mesh:null}];let wall:ImageData|undefined;
  let backdrop:{s:number;section:boolean;z:Float32Array;color:Uint8ClampedArray}|undefined;
  let scratch:Bitmap|null=null;
  const plate=(b:Entry,side:Side,amount:number,lactating:boolean)=>{
    const key=lactating?amount:-1;
    if(!b.tile||b.amount!==key){scratch??=allocate(W,H);if(scratch){const c=scratch.ctx;c.clearRect(0,0,W,H);drawSection(c,side,amount,lactating);b.tile=c.getImageData(0,0,W,H);b.amount=key;}}
    return b.tile;
  };
  return {draw(ctx:Ink,cam:Camera,left:number,right:number,section:boolean,lactating:boolean,fillL:number,fillR:number,settle:number){
    const render=(mesh:Mesh,flip:number,tile?:ImageData)=>{project(mesh,cam,work,flip,settle);raster(mesh.indices,work,depths,img.data,tile);};
    if(backdrop?.s===cam.s&&backdrop.section===section){depths.set(backdrop.z);img.data.set(backdrop.color);}else{
      depths.fill(-1e4);img.data.fill(0);for(const [mesh,sign] of figure())render(mesh,sign);
      if(section){if(!wall){scratch??=allocate(W,H);if(scratch){wallTile(scratch.ctx);wall=scratch.ctx.getImageData(0,0,128,196);}}
        if(wall)for(const m of wallMeshes())render(m,1,wall);}
      backdrop??={s:NaN,section,z:new Float32Array(depths.length),color:new Uint8ClampedArray(img.data.length)};
      backdrop.s=cam.s;backdrop.section=section;backdrop.z.set(depths);backdrop.color.set(img.data);
    }
    for(const side of [-1,1] as Side[]){const f=side===1?left:right,memo=cache[side===1?1:0];
      if(!memo.mesh||memo.full!==f){memo.mesh=mound(side,f);memo.full=f;memo.cut=undefined;}
      if(section){memo.cut??=cutMound(memo.mesh);render(memo.cut.skin,-side);const texture=plate(memo,side,side===1?fillL:fillR,lactating);if(texture)render(memo.cut.face,1,texture);}
      else render(memo.mesh,-side);
    }
    // Ink the near contour only, using geometric depth, so a far arm, lock
    // or breast cannot draw its outline on the nearer skin during a turn.
    const rgb=img.data;
    for(let y=1;y<RH-1;y++)for(let x=1,i=y*RW+1;x<RW-1;x++,i++){
      const d=depths[i];if(d < -100)continue;
      const down=d-depths[i+RW],up=d-depths[i-RW],side=d-Math.min(depths[i-1],depths[i+1]);
      const edge=Math.max(smooth((down-.033)/.072)*.68,smooth((side-.054)/.11)*.50,smooth((up-.074)/.15)*.33);
      if(edge<=.005)continue;const k=i*4;
      rgb[k]+=(107-rgb[k])*edge;rgb[k+1]+=(45-rgb[k+1])*edge;rgb[k+2]+=(70-rgb[k+2])*edge;
    }
    bitmap.ctx.putImageData(img,0,0);brushwork(bitmap.ctx,cam,depths,cache.map(m=>m.mesh!),settle);
    ctx.drawImage(bitmap.canvas,0,0,400,260);
    const side=cam.s<0?-1:1;return section?marks(cache[side===1?1:0].mesh!,side,cam,depths):null;
  }};
}
