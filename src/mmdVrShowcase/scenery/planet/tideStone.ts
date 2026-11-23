import {BufferGeometry,Color,Float32BufferAttribute,Vector3} from 'three';
import {coil,PaintedParts,turn} from '../../play/modelParts';
import {apseBeds,apseRockX,apseStrike,apseWing,bedFlare,caveBackThickness,caveBed,caveCrest,caveLip,caveMouth,caveRear,caveSoffit,caveZ,easeTide,finLean,finWidth,tideChart,tideFins,tideFloor,tidePiles,tideRadius,tideRelief} from './tideLayout';

class Skin {
  p:number[]=[];uv:number[]=[];rgb:number[]=[];ix:number[]=[];
  point(x:number,y:number,z:number,u:number,v:number,c:Color){const i=this.p.length/3;
    this.p.push(x,y,z);this.uv.push(u,v);this.rgb.push(c.r,c.g,c.b);return i;}
  finish(){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.p,3));
    g.setAttribute('uv',new Float32BufferAttribute(this.uv,2));g.setAttribute('color',new Float32BufferAttribute(this.rgb,3));
    g.setIndex(this.ix);g.computeVertexNormals();g.computeBoundingSphere();return g;}
}
const tau=Math.PI*2;
export function tideTerrain(far=false){
  const shore=new Skin(),globe=new Skin(),{minX,maxX,minZ,maxZ}=tideChart;
  const cols=tideChart.cols/(far?4:1),rows=tideChart.rows/(far?4:1),shade=new Color(),rim:number[][]=[];
  const xOf=(i:number)=>minX+(maxX-minX)*i/cols,zOf=(j:number)=>minZ+(maxZ-minZ)*j/rows;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const x=xOf(i),z=zOf(j),y=tideFloor(x,z),k=shade.setRGB(1,1,1);
    // The mouth lights a swathe of floor past the wet shelves. Keep the room
    // exposure alone; this is a local contact/sky-occlusion bake on the geology.
    const indoors=easeTide(1.8,4.2,x)*(1-easeTide(2.68,3.1,Math.abs(z)));
    const shadow=indoors*(.18+.19*easeTide(.25,1.9,Math.abs(z)));
    k.setRGB(1-shadow*.85,1-shadow*.94,1-shadow*1.04);
    shore.point(x,y,z,i/cols,1-j/rows,k);
    if(i&&j){const d=j*(cols+1)+i,a=d-cols-2,b=a+1,c=d-1;shore.ix.push(a,c,b,b,c,d);}
  }
  for(let i=0;i<cols;i++)rim.push([xOf(i),minZ]);for(let j=0;j<rows;j++)rim.push([maxX,zOf(j)]);
  for(let i=cols;i>0;i--)rim.push([xOf(i),maxZ]);for(let j=rows;j>0;j--)rim.push([minX,zOf(j)]);
  const peat=new Color('#637a78'),lime=new Color('#b2a493'),salt=new Color('#cbbca2');
  // Connect the metric board to the rest of the globe at its actual vertices.
  // Thin out the perimeter twice once clear of that seam. No second polar cap.
  let prev:number[]=[];const bands=far?24:42;
  for(let j=0;j<bands;j++){
    const stride=j===0?1:far||j===1?2:4,ids:number[]=[];
    for(let i=0;i<rim.length;i+=stride){const [bx,bz]=rim[i],d=Math.hypot(bx,bz),pole=Math.asin(d/tideRadius);
      const theta=pole+(Math.PI-pole)*j/bands,sy=Math.cos(theta),sr=Math.sin(theta),sx=bx/d*sr,sz=bz/d*sr;
      const rad=tideRadius+(sy<0?tideRelief(sx,sy,sz):0),x=sx*rad,z=sz*rad,y=sy*rad-tideRadius;
      const field=.46*x+.31*y+.38*z+.65*Math.sin(.77*x-.43*z)+.29*Math.cos(.83*y+.17*x);
      shade.copy(peat).lerp(lime,.49+.31*Math.sin(field)+.16*Math.cos(2*field+.3*z));
      shade.lerp(salt,.31*Math.exp(-((Math.sin(1.8*field+.21*z)/.18)**2)));
      ids.push(globe.point(x,y,z,x*.30+z*.19,field*.34+.15*y,shade));
    }
    if(j){const skip=prev.length/ids.length;
      for(let i=0;i<ids.length;i++){const next=(i+1)%ids.length,p=i*skip,a=prev[p],b=prev[(p+1)%prev.length],n=ids[i],m=ids[next];
        if(skip===1)globe.ix.push(a,b,n,b,m,n);else globe.ix.push(a,b,n,b,prev[(p+2)%prev.length],m,b,m,n);}}
    prev=ids;
  }
  const south=globe.point(0,-2*tideRadius-tideRelief(0,-1,0),0,0,0,peat);
  for(let i=0;i<prev.length;i++)globe.ix.push(prev[i],prev[(i+1)%prev.length],south);
  return {shore:shore.finish(),globe:globe.finish()};
}

const basalt=new Color('#495e62'),oxidized=new Color('#9d8170'),chalk=new Color('#eed3ac'),cut=new Color('#afb3a5'),wet=new Color('#526e74');
const cold=new Color('#41656c'),shade=new Color('#344850'),ochre=new Color('#a57560'),slate=new Color('#688083'),cream=new Color('#ffdfaf'),pearl=new Color('#b5d7c9');
export function tideCaveRock(far=false){
  const g=new Skin(),c=new Color(),across=far?28:88,along=far?14:42;
  function sample(x:number,y:number,z:number,face:'inside'|'outside'|'edge'|'apse',t=0){
    // A lifted bedding plane shows both on the intrados and on the eroded
    // front cut. The common tide notch is concentrated at the foot of the rock.
    const stratum=y+.22*z-.094*x+.13*Math.sin(1.32*x+1.8*z)+.048*Math.cos(3.6*z-.95*x);
    const band=Math.sin(6.4*stratum+.41*Math.cos(.89*x));
    const chalkBed=Math.exp(-((Math.sin(3.65*stratum)/.21)**2));
    c.copy(basalt).lerp(oxidized,.38+.25*band+.13*Math.cos(2*x+z));
    c.lerp(cut,.17+.42*chalkBed).lerp(wet,.43*(1-easeTide(-.31,.34,y)));
    c.lerp(chalk,.32*Math.exp(-(((y-.11-.04*Math.cos(5*x))/ .09)**2)));
    if(face==='edge'){
      c.lerp(cut,.40+.20*Math.cos(5*t+.36*z)).lerp(chalk,.68*Math.exp(-((Math.sin(11.6*t+.62*Math.cos(3.41*z))/.35)**2)));
    }else if(face==='inside'){
      const ribs=.21+.20*Math.sin(1.29*x+z*.71),h=y+.105*x-.22*Math.sin(1.46*x+z*.8);
      c.copy(slate).lerp(ochre,.29+.21*Math.cos(1.84*x+1.3*z)).lerp(shade,.48*easeTide(1.4,3.85,y));
      for(const [mark,width] of [[.04,.072],[.43,.11],[1.04,.068],[1.85,.18],[2.61,.098]]){
        const f=(h-mark-ribs)/width;
        c.lerp(shade,.55*Math.exp(-((f+1.05)**2))).lerp(Math.abs(mark-.43)<.01?pearl:chalk,.80*Math.exp(-(f*f))*(.67+.27*Math.sin(1.17*x+1.5*z+mark)));
      }
      c.multiplyScalar(.98-.20*easeTide(2,7,x));
    }else if(face==='apse'){
      const wing=apseWing(z),strike=apseStrike(y,z),sky=.10*Math.cos(1.7*z+.41*y)+.05*Math.cos(2*y);
      c.copy(cold).lerp(shade,.31+sky).lerp(ochre,wing*(.52+.23*Math.cos(1.7*z-.61*y)));
      // The exposed cut brightens, then turns sharply into marine shadow
      // under a projecting shelf. A calm, recessed cool vein behind the head.
      for(const [mark,width] of apseBeds){const b=(strike-mark)/width;
        c.lerp(shade,wing*.76*Math.exp(-((b+1.0)**2)/.31));
        c.lerp(slate,wing*.63*bedFlare(strike,mark,width));
        c.lerp(z>0?cream:pearl,wing*(.80+.13*Math.cos(z*4.5-mark))*Math.exp(-((b+.10)**2)/.19));
        c.lerp(chalk,.39*wing*Math.exp(-((b-.79)**2)/.057));
      }
    }
    else c.lerp(cut,.14+.17*Math.cos(.5*x-.47*z));
    return g.point(x,y,z,.53*x+.23*z+.12*y,(face==='apse'?apseStrike(y,z):stratum)*.54+.071*z,c);
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
    const z=(2*v-1)*caveZ,lip=outside?caveLip(z,1):caveMouth(z),x=lip+(caveRear(z)-lip)*u;
    return sample(x,outside?caveCrest(x,z):caveSoffit(x,z),z,outside?'outside':'inside');
  },outside);
  sheet(far?5:18,across,(t,v)=>{const z=(2*v-1)*caveZ,x=caveLip(z,t),inner=caveSoffit(caveMouth(z),z),outer=caveCrest(caveLip(z,1),z);
    return sample(x,inner+(outer-inner)*t,z,'edge',t);},true);
  sheet(far?12:68,across,(t,v)=>{const z=(2*v-1)*caveZ,rear=caveRear(z),roof=caveSoffit(rear,z),floor=caveBed(rear,z),y=floor+(roof-floor)*t;
    return sample(apseRockX(z,y,rear,roof),y,z,'apse');},true);
  sheet(6,across,(u,v)=>{const z=(2*v-1)*caveZ,x=caveRear(z)+u*caveBackThickness;
    return sample(x,caveCrest(x,z),z,'outside');},true);
  sheet(8,across,(t,v)=>{const z=(2*v-1)*caveZ,x=caveRear(z)+caveBackThickness,bed=caveBed(x,z);
    return sample(x,bed+(caveCrest(x,z)-bed)*t,z,'outside');});
  // The end of each flanking bank and the end of the roof are closed solids.
  for(const side of [-1,1])sheet(along,3,(u,t)=>{const z=side*caveZ,x=caveLip(z,t)+(caveRear(z)+caveBackThickness-caveLip(z,t))*u;
    return sample(x,caveBed(x,z)+(caveCrest(x,z)-caveBed(x,z))*t,z,'outside');},side<0);
  for(const f of tideFins){const foot=tideFloor(f.x,f.z);
    sheet(12,9,(u,t)=>{const a=tau*u,w=finWidth(t),x=f.x+finLean(t)+f.rx*w*Math.cos(a),z=f.z+f.rz*w*Math.sin(a);
      return sample(x,foot-.10+(f.h+.10)*t,z,'edge',t);},true);
    sheet(12,1,(u,t)=>{const a=tau*u,w=(1-t)*finWidth(1);
      return sample(f.x+finLean(1)+f.rx*w*Math.cos(a),foot+f.h+.012*t,f.z+f.rz*w*Math.sin(a),'outside');},true);
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
  const cos=Math.cos,sin=Math.sin,reef=new Skin(),old=new Color('#ac9385'),valve=new Color('#d6b99e'),inner=new Color('#bcc9ba'),c=new Color();
  for(const [bx,bz,scale,lean] of [[2.53,-2.18,1,.42],[2.71,-2.16,.63,-.44],[5.02,2.22,.92,-.35],[5.13,2.20,.71,.62],
    [5.31,2.24,.54,.15],[6.21,-2.20,.81,-.63],[6.34,-2.19,.60,.26]]){
    const y=caveSoffit(bx,bz);if(y<.02)continue;
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
