import {BufferGeometry,Color,Float32BufferAttribute,Vector3} from 'three';
import {coil,PaintedParts,turn} from '../../play/modelParts';
import {apseRockX,caveBackThickness,caveBed,caveCrest,caveLip,caveMouth,caveRear,caveSoffit,caveZ,easeTide,lipCourses,seaWindow,tideChart,tideFloor,tidePiles,tideRadius,tideRelief,windowCut} from './tideLayout';
import {bluffBeds,bluffVertex,breakwaters} from './tideBreakwater';
import {chalk,tideLimestone,type StoneFace} from './tideArt';

class Skin {
  p:number[]=[];uv:number[]=[];rgb:number[]=[];ix:number[]=[];
  point(x:number,y:number,z:number,u:number,v:number,c:Color){const i=this.p.length/3;
    this.p.push(x,y,z);this.uv.push(u,v);this.rgb.push(c.r,c.g,c.b);return i;}
  finish(){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.p,3));
    g.setAttribute('uv',new Float32BufferAttribute(this.uv,2));g.setAttribute('color',new Float32BufferAttribute(this.rgb,3));
    g.setIndex(this.ix);g.computeVertexNormals();g.computeBoundingSphere();return g;}
}
export function tideTerrain(far=false){
  const shore=new Skin(),globe=new Skin(),{minX,maxX,minZ,maxZ}=tideChart;
  const cols=tideChart.cols/(far?4:1),rows=tideChart.rows/(far?4:1),shade=new Color(),rim:number[][]=[];
  const xOf=(i:number)=>minX+(maxX-minX)*i/cols,zOf=(j:number)=>minZ+(maxZ-minZ)*j/rows;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const x=xOf(i),z=zOf(j),y=tideFloor(x,z),k=shade.setRGB(1,1,1);
    // The mouth lights a swathe of floor past the wet shelves. Keep the room
    // exposure alone; this is a local contact/sky-occlusion bake on the geology.
    const indoors=easeTide(-.35,2.35,x-caveMouth(z)),shadow=indoors*(.18+.22*easeTide(.35,2.35,Math.abs(z)));
    // The face of a cut tread exposes peach sandstone; its level surface
    // stays pale. At the chamber fore-edge two blue-grey beds rise to the
    // cream actor platform. These colours stop when the rock face ends.
    const slopeX=(tideFloor(x+.045,z)-tideFloor(x-.045,z))/.09;
    const tread=easeTide(1.09,1.48,x)*(1-easeTide(2.72,2.99,x))*(1-easeTide(.61,1.01,Math.abs(z)))*easeTide(.12,.78,-slopeX);
    const face=easeTide(3.03,3.31,x)*(1-easeTide(4.58,4.80,x))*easeTide(.17,1.04,slopeX);
    const path=easeTide(.77,1.3,z)*(1-easeTide(1.75,2.17,z))*easeTide(.65,1.48,x)*(1-easeTide(5.65,6.64,x));
    k.setRGB((1-shadow*1.14)*(1-.19*tread-.51*face-.10*path),(1-shadow*.96)*(1-.32*tread-.41*face-.18*path),(1-shadow*.60)*(1-.39*tread-.17*face-.23*path));
    shore.point(x,y,z,i/cols,1-j/rows,k);
    if(i&&j){const d=j*(cols+1)+i,a=d-cols-2,b=a+1,c=d-1;shore.ix.push(a,c,b,b,c,d);}
  }
  for(let i=0;i<cols;i++)rim.push([xOf(i),minZ]);for(let j=0;j<rows;j++)rim.push([maxX,zOf(j)]);
  for(let i=cols;i>0;i--)rim.push([xOf(i),maxZ]);for(let j=rows;j>0;j--)rim.push([minX,zOf(j)]);
  const shale=new Color('#6176a0'),lime=new Color('#deb991'),salt=new Color('#f4ddba');
  // Connect the metric board to the rest of the globe at its actual vertices.
  // Thin out the perimeter twice once clear of that seam. No second polar cap.
  let prev:number[]=[];const bands=far?17:42;
  for(let j=0;j<bands;j++){
    const stride=j===0?1:far||j===1?2:4,ids:number[]=[];
    for(let i=0;i<rim.length;i+=stride){const [bx,bz]=rim[i],d=Math.hypot(bx,bz),pole=Math.asin(d/tideRadius);
      const theta=pole+(Math.PI-pole)*j/bands,sy=Math.cos(theta),sr=Math.sin(theta),sx=bx/d*sr,sz=bz/d*sr;
      const rad=tideRadius+(sy<0?tideRelief(sx,sy,sz):0),x=sx*rad,z=sz*rad,y=sy*rad-tideRadius;
      const field=y+.25*x-.14*z+.74*Math.sin(.29*x-.19*z);
      shade.copy(shale).lerp(lime,easeTide(-12,-5,field)).lerp(salt,.61*easeTide(-4.5,.5,field));
      shade.lerp(salt,.15*easeTide(-.4,.88,Math.cos(.93*field+.36*Math.sin(.72*z))));
      ids.push(globe.point(x,y,z,x*.33+z*.12,y*.36+.11*z,shade));
    }
    if(j){const skip=prev.length/ids.length;
      for(let i=0;i<ids.length;i++){const next=(i+1)%ids.length,p=i*skip,a=prev[p],b=prev[(p+1)%prev.length],n=ids[i],m=ids[next];
        if(skip===1)globe.ix.push(a,b,n,b,m,n);else globe.ix.push(a,b,n,b,prev[(p+2)%prev.length],m,b,m,n);}}
    prev=ids;
  }
  const south=globe.point(0,-2*tideRadius-tideRelief(0,-1,0),0,0,0,shale);
  for(let i=0;i<prev.length;i++)globe.ix.push(prev[i],prev[(i+1)%prev.length],south);
  return {shore:shore.finish(),globe:globe.finish()};
}

export function tideCaveRock(far=false){
  const g=new Skin(),c=new Color(),along=far?7:32;
  const z0=seaWindow.z-seaWindow.r,z1=seaWindow.z+seaWindow.r;
  const segments=[[-caveZ,z0,far?10:22],[z0,z1,far?24:34],[z1,caveZ,far?22:44]],stations=[-caveZ];
  for(const [a,b,n] of segments)for(let i=1;i<=n;i++)stations.push(a+(b-a)*i/n);
  const across=stations.length-1,zOf=(v:number)=>stations[Math.round(v*across)];
  function sample(x:number,y:number,z:number,face:StoneFace,t=0){
    tideLimestone(c,x,y,z,face,t);
    return g.point(x,y,z,.48*x+.26*z,y*.52+.13*z-.05*x,c);
  }
  function sheet(w:number,h:number,make:(u:number,v:number)=>number,flip=false){
    const base=g.p.length/3;
    for(let j=0;j<=h;j++)for(let i=0;i<=w;i++){
      make(i/w,j/h);if(!i||!j)continue;
      const d=base+j*(w+1)+i,a=d-w-2,b=a+1,c=d-1;
      if(flip)g.ix.push(a,c,b,b,c,d);else g.ix.push(a,b,c,b,d,c);
    }
  }
  for(const outside of [false,true])sheet(along,across,(u,v)=>{
    const z=zOf(v),lip=outside?caveLip(z,1):caveMouth(z),x=lip+(caveRear(z)-lip)*u;
    return sample(x,outside?caveCrest(x,z):caveSoffit(x,z),z,outside?'outside':'inside');
  },outside);
  sheet(lipCourses.length-1,across,(u,v)=>{const t=lipCourses[Math.round(u*(lipCourses.length-1))][0],z=zOf(v),x=caveLip(z,t),inner=caveSoffit(caveMouth(z),z),outer=caveCrest(caveLip(z,1),z);
    return sample(x,inner+(outer-inner)*t,z,'edge',t);},true);
  // Split BOTH skins of the rear outcrop and connect their cut edges. The
  // visitor sees through a deep cheek, not a transparent decal on the apse.
  // All sheets share Z stations, including the exact tips of the opening.
  for(const [za,zb,count] of segments){
    const zAt=(v:number)=>za+(zb-za)*v;
    for(const upper of [false,true]){
      for(const outside of [false,true])sheet(outside?(far?2:6):(far?9:30),count,(t,v)=>{
        const z=zAt(v),rear=caveRear(z),bed=caveBed(rear,z),roof=caveSoffit(rear,z),outer=rear+caveBackThickness;
        const cut=windowCut(z,upper,bed,roof),lo=upper?cut:outside?caveBed(outer,z):bed,hi=upper?(outside?caveCrest(outer,z):roof):cut;
        // The shell falls away behind the actor. Do not spend half the
        // contact mesh below the stage and miss a visible shelf break.
        const buried=!outside&&lo<-.65&&hi>-.25;
        const y=buried?(t<.1?lo+(-.4-lo)*t/.1:-.4+(hi+.4)*(t-.1)/.9):lo+(hi-lo)*t;
        return sample(outside?outer:apseRockX(z,y,rear,roof),y,z,outside?'outside':'apse');
      },!outside);
      if(za===z0)sheet(far?1:6,count,(t,v)=>{
        const z=zAt(v),rear=caveRear(z),bed=caveBed(rear,z),roof=caveSoffit(rear,z),y=windowCut(z,upper,bed,roof),inside=apseRockX(z,y,rear,roof);
        return sample(inside+(rear+caveBackThickness-inside)*t,y,z,'window',upper?-.01-.99*t:t);
      },!upper);
    }
  }
  sheet(3,across,(u,v)=>{const z=zOf(v),x=caveRear(z)+u*caveBackThickness;
    return sample(x,caveCrest(x,z),z,'outside');},true);
  // The end of each flanking bank and the end of the roof are closed solids.
  for(const side of [-1,1])sheet(along,3,(u,t)=>{const z=side*caveZ,x=caveLip(z,t)+(caveRear(z)+caveBackThickness-caveLip(z,t))*u;
    return sample(x,caveBed(x,z)+(caveCrest(x,z)-caveBed(x,z))*t,z,'outside');},side<0);
  for(const b of breakwaters){const end=bluffBeds.length-1;
    // Individual facets share their vertical edges within a bed; the broad
    // cross-cut faces and their narrow bevels are not smoothed into a blob.
    for(let i=0;i<b.plan.length;i++)sheet(1,end,(u,v)=>{
      const j=Math.round(v*end),[x,y,z]=bluffVertex(b,i+u,j);
      return sample(x,y,z,'bluff',j/end);
    },true);
    sheet(1,b.plan.length,(u,v)=>{const [x,y,z]=bluffVertex(b,Math.round(v*b.plan.length),end,1-u);return sample(x,y,z,'outside');});
  }
  return g.finish();
}

/** Rope-wrapped landing piles; a few flat oyster clusters embedded in the
 * bedding, with overlapping fan-shaped valves rather than drilled cones. */
export function tideForeshore(){
  const g=new PaintedParts();
  for(const p of tidePiles){const y=tideFloor(p.x,p.z),at=(s:BufferGeometry)=>s.translate(p.x,y,p.z),r=p.r;
    g.add(at(turn([[0,-.28],[r*.95,-.28],[r,-.02],[r*.82,.20],[r*.95,p.h-.041],[r*.78,p.h],[0,p.h]],10)),'#735f50');
    g.add(at(coil(r*.91,.021,4,.011,16).translate(0,p.h-.12,0)),'#c2ab85');
    g.add(at(turn([[r*.96,.030],[r*.96,.064],[r*.90,.065]],10)),'#64847f');
  }
  const up=new Vector3(0,1,0),normal=new Vector3(),centre=new Vector3();
  const cos=Math.cos,sin=Math.sin,reef=new Skin(),old=new Color('#c4afa7'),valve=new Color('#eed6b7'),inner=new Color('#bdc9dc'),c=new Color();
  for(const [bx,bz,scale,lean] of [[2.53,-2.18,1,.42],[2.71,-2.16,.63,-.44],[5.02,2.22,.92,-.35],[5.13,2.20,.71,.62],
    [5.31,2.24,.54,.15],[6.21,-2.20,.81,-.63],[6.34,-2.19,.60,.26]]){
    const y=caveSoffit(bx,bz);if(y<.02||bx<caveMouth(bz)+.25)continue;
    normal.set((caveSoffit(bx+.01,bz)-caveSoffit(bx-.01,bz))/.02,-1,(caveSoffit(bx,bz+.01)-caveSoffit(bx,bz-.01))/.02).normalize();
    const u=new Vector3().crossVectors(normal,up).normalize(),v=new Vector3().crossVectors(normal,u),start=reef.p.length/3;
    const sectors=32;
    for(let j=0;j<=6;j++)for(let i=0;i<=sectors;i++){
      const a=-1.01+2.02*i/sectors,t=j/6,sc=.89+.08*cos(17*a)+.035*sin(6*a+bx);
      const side=(.016+.24*t)*sin(a)*sc,along=.30*t*cos(.64*a)*sc-.085;
      const h=.012+.061*sin(Math.PI*t)*cos(a)**2+.009*t*(cos(17*a)+.52*cos(34*a))-.019*t**5;
      centre.set(bx,y,bz).addScaledVector(u,scale*(side*cos(lean)-along*sin(lean))).addScaledVector(v,scale*(side*sin(lean)+along*cos(lean))).addScaledVector(normal,h*scale);
      c.copy(old).lerp(bz>0?valve:inner,.22+.43*t+.12*cos(17*a)).lerp(chalk,t**4*.73);
      reef.point(centre.x,centre.y,centre.z,0,0,c);
      if(i&&j){const d=start+j*(sectors+1)+i,b=d-sectors-1;reef.ix.push(b-1,b,d-1,b,d,d-1);}
    }
  }
  g.add(reef.finish());return g.finish();
}
