import { arc, curve, tau, white, Workshop, type V } from './furnishingsMesh';

const walnut='#674036',wine='#743c36', rose='#aa6952',gold='#bb905c',silk='#d4ad72', ivory='#e6d4af';

// Cloud-spandrel console: physical fretwork beneath the front apron and a
// through stretcher on each side. Both console tops stay inside their anchors.
function consoleTable(shop:Workshop,w:number,d:number,h:number,drawers=false){
  const s=shop.body,m=shop.metal,hw=w/2,hd=d/2,fx=hw-.14,fz=hd-.095;
  s.box([0,h-.034,0],w,.068,d,'#d7aa89','wood');
  s.box([0,h-.079,0],w-.035,.024,d-.021,wine);
  for(const side of [-1,1])for(const end of [-1,1]){
    const x=side*fx,z=end*fz;
    s.sweep([[x+side*.031,0,z+end*.014],[x+side*.041,.031,z+end*.02],[x+side*.027,.063,z+end*.015],
      [x,.14,z],[x,.51*h,z],[x+side*.013,.74*h,z],[x,h-.071,z]],
      [.036,.048,.045,.035,.034,.049,.049],walnut,8);
    s.sweep(curve([x,h-.325,z],[x-side*.037,h-.197,z],[x-side*.137,h-.252,z],[x-side*.237,h-.143,z]),.022,wine);
    s.sweep(curve([x-side*.042,h-.223,z],[x-side*.085,h-.164,z],[x-side*.122,h-.205,z],[x-side*.149,h-.16,z]),.012,rose,7);
    s.box([x,.11*h,z],.080,.023,.078,rose);
  }
  for(const k of [-1,1]){
    s.box([0,h-.133,k*fz],fx*2+.012,.089,.061,walnut);
    s.box([0,h-.107,k*(fz+.033)],fx*2-.04,.012,.008,rose);
    s.box([k*fx,h-.145,0],.071,.116,fz*2,walnut);
    s.sweep([[k*fx,.214,-fz],[k*fx,.214,fz]],.020,walnut,8);
  }
  s.sweep([[-fx,.225,-fz*.35],[fx,.225,-fz*.35]],.023,walnut,8);
  if(drawers){
    s.box([0,h-.157,0],w-.27,.149,d-.20,walnut);
    for(let i=-1;i<=1;i++){
      const ww=(w-.29)/3,x=i*ww,z=fz+.039;
      s.box([x,h-.158,z],ww-.011,.129,.020,'#d19e76','wood');
      m.disk([x,h-.148,z+.013],.022,gold,'solid','front',16);
      m.sweep(arc(a=>[x+.019*Math.sin(a),h-.171+.020*Math.cos(a),z+.023+.005*Math.sin(a/2)],16),.0042,gold,6);
    }
  }
}

function scrollScreenStand(shop:Workshop,cx:number,base:number,cz:number,r:number,cy:number){
  const s=shop.body;
  s.box([cx,base+.023,cz],r*1.33,.046,.20,walnut);
  s.box([cx,base+.052,cz],r*1.17,.024,.143,rose);
  for(const k of [-1,1]){
    const x=cx+k*r*.39;
    s.sweep(curve([x+k*.06,base+.053,cz],[x-k*.10,base+.108,cz],[x+k*.01,cy-r+.073,cz],[x+k*.04,cy-r+.14,cz]),.029,wine);
  }
}

export function makeAltar(){
  const shop=new Workshop(),s=shop.body,m=shop.metal,p=shop.paper;
  consoleTable(shop,2.80,.90,.90);
  // The table runner crosses the top and curves over the edge; narrower than
  // the open fretwork, so one sees both supported corners of the table.
  const edge=([[-.421,.903],[.407,.903],[.439,.899],[.451,.887],[.451,.856],[.445,.714],[.446,.577]] as const);
  s.grid(18,edge.length-1,(u,v)=>{const [z,y]=edge[Math.round(v*(edge.length-1))];return [(u-.5)*.79,y+(v>.8?.015*Math.cos(tau*u):0),z+v**5*.004*Math.sin(tau*3*u)];},white,'calyx');
  const cy=1.65,cz=-.29,r=.44;
  scrollScreenStand(shop,0,.904,cz,r,cy);
  s.disk([0,cy,cz-.024],r-.012,ivory,'solid','front',56);
  s.disk([0,cy,cz+.008],r-.012,'#e1cba4','solid','front',56);
  s.sweep(arc(a=>[r*.974*Math.sin(a),cy+r*.974*Math.cos(a),cz-.003],56),.015,walnut,10);
  m.sweep(arc(a=>[r*.94*Math.sin(a),cy+r*.94*Math.cos(a),cz+.012],56),.0062,gold,8);
  const q=r*.92;
  p.quad([-q,cy-q,cz+.014],[q,cy-q,cz+.014],[q,cy+q,cz+.014],[-q,cy+q,cz+.014],white,'paper');
  for(const k of [-1,1]){
    const x=k*.96,z=-.075;
    m.turn([x,.90,z],[[.077,0],[.089,.013],[.089,.023],[.075,.029],[.049,.044],[.036,.068],[.024,.085],
      [.021,.170],[.038,.181],[.037,.192],[.023,.206],[.024,.236],[.054,.246],[.091,.266],[.096,.278],[.088,.285],[.068,.270],[.026,.266]],gold,'solid',28);
    m.disk([x,1.167,z],.065,gold,'solid','up',24);
    s.turn([x,1.164,z],[[.023,0],[.025,.013],[.024,.209],[.021,.214],[.010,.202],[0,.202]],'#bc5149','solid',16);
    for(let j=0;j<3;j++){
      const a=j*2+.7;s.sweep([[x+.023*Math.sin(a),1.372,z+.023*Math.cos(a)],[x+.024*Math.sin(a),1.357-j*.010,z+.024*Math.cos(a)]],[.0038,.0025],'#ca665a',6);
    }
    s.sweep([[x,1.369,z],[x+.003,1.391,z]],.0029,'#534038',5);
    s.sweep([[x+.003,1.383,z],[x+.003,1.394,z],[x,1.412,z],[x+.007,1.431,z]], [0,.009,.006,0],'#f6c77b',8);
  }
  // A small raised offering dish with dates, front of the papercut.
  m.turn([0,.911,.158],[[.050,0],[.061,.008],[.059,.018],[.032,.027],[.027,.055],[.059,.068],[.107,.077],[.117,.090],[.114,.098],[.094,.087],[.061,.085]],gold,'solid',24);
  m.disk([0,.996,.158],.062,gold,'solid','up',24);
  for(let j=0;j<6;j++){
    const a=j*tau/5,x=(j===5?0:.056)*Math.sin(a),z=.158+(j===5?0:.047)*Math.cos(a),y=j===5?1.029:.998;
    s.turn([x,y,z],[[.018,0],[.029,.009],[.029,.024],[.020,.036],[0,.039]],j%2?'#a9563e':'#925043','solid',12,.8);
  }
  return shop.finish();
}

/** Open-armed hat chairs, with a scalloped apron, shaped back splat, projecting
 * crest ends and staggered foot rails. Front = +Z (towards both actors). */
export function makeChair(){
  const shop=new Workshop(),s=shop.body,m=shop.metal;
  s.box([0,.463,.014],.615,.058,.583,'#d8a27c','wood');
  s.box([0,.499,.027],.534,.024,.493,'#ad7753');
  for(const k of [-1,1]){
    const x=k*.249;
    for(const e of [-1,1]){
      const z=e*.224;
      s.sweep([[x+k*.028,0,z+e*.039],[x+k*.029,.024,z+e*.04],[x+k*.012,.084,z+e*.019],[x,.402,z],[x,.458,z]],
        [.027,.032,.025,.034,.034],walnut,9);
      s.sweep(curve([x,.309,z],[x-k*.028,.398,z],[x-k*.064,.36,z],[x-k*.114,.415,z]),.014,rose,7);
    }
    s.box([x,.411,0],.046,.073,.48,walnut);
    s.sweep([[x,.154,-.25],[x,.154,.25]],.015,rose);
    // Rear posts follow the spine up into the crest. Arm terminals turn back.
    s.sweep(curve([x,.46,-.225],[x+k*.004,.68,-.241],[x+k*.014,.94,-.277],[x+k*.018,1.175,-.282]),.025,walnut,10);
    s.sweep(curve([x,.49,.205],[x-k*.046,.548,.201],[x+k*.014,.601,.123],[x,.698,.167]),.018,rose,9);
    s.sweep(curve([x,.518,-.071],[x+k*.007,.56,-.055],[x-k*.014,.643,-.116],[x,.716,-.085]),.014,walnut);
    s.sweep(curve([x+k*.004,.755,-.247],[x+k*.015,.733,-.06],[x+k*.021,.666,.177],[x+k*.024,.697,.249]),.027,walnut,10);
    s.sweep([[x+k*.024,.697,.249],[x+k*.024,.707,.261]], [.027,.020],rose,9,true);
    s.box([0,.411,k*.228],.506,.065,.047,walnut);
  }
  s.sweep([[-.267,.118,.257],[.267,.118,.257]],.019,rose,9);
  s.sweep([[-.26,.185,-.245],[.26,.185,-.245]],.014,walnut,8);
  s.sweep(arc(t=>[(t-.5)*.67,1.174+.044*(2*t-1)**4-.010*Math.cos(t*tau),-.283+.042*(2*t-1)**2],22,1),.027,walnut,12,true);
  const splat=(u:number,v:number,front:number):V=>{
    const w=.064+.028*Math.cos(v*tau)**2+.017*v;
    return [(u-.5)*2*w,.500+.659*v,-.245+.060*Math.sin(v*1.65*Math.PI)+front];};
  s.grid(2,14,(u,v)=>splat(u,v,0),'#c89472','wood');
  s.grid(2,14,(u,v)=>splat(1-u,v,-.027),'#b58668','wood');
  for(const u of [0,1])s.sweep(arc(v=>splat(u,v,-.012),15,1),.014,rose,7);
  const ry=1.028,rz=splat(.5,.802,0)[2]+.007;
  m.sweep(arc(a=>[.042*Math.sin(a),ry+.061*Math.cos(a),rz-.009*Math.cos(a)],28),.006,gold,7);
  m.sweep(curve([-.026,ry-.025,rz],[.043,ry+.008,rz],[-.036,ry-.008,rz],[.017,ry+.039,rz]),.0045,gold,6);
  return shop.finish();
}

export function makeVanity(){
  const shop=new Workshop(),s=shop.body,m=shop.metal;
  consoleTable(shop,1.60,.75,.79,true);
  const x=.03,z=-.17,y=1.16,r=.255;
  // Weighted stand, trunnions and tilting mirror. The bronze face is painted
  // and rough metallic: no reflection camera or update at frame rate.
  s.box([x,.807,z],.62,.034,.218,walnut);s.box([x,.831,z],.555,.022,.18,rose);
  for(const k of [-1,1]){
    s.sweep(curve([x+k*.24,.839,z],[x+k*.336,.91,z],[x+k*.291,1.01,z],[x+k*.278,1.16,z]),.021,walnut,10);
    m.sweep([[x+k*.242,y,z],[x+k*.305,y,z]],[.011,.014],gold,10);
    m.turn([x+k*.278,y,z],[[.025,-.006],[.026,.013],[.011,.027],[0,.031]],gold,'solid',16);
  }
  m.disk([x,y,z-.02],r-.01,'#998359','solid','front',56);
  m.disk([x,y,z+.018],r-.013,white,'bronze','front',56);
  m.sweep(arc(a=>[x+(r-.010)*Math.sin(a),y+(r-.010)*Math.cos(a),z],56),.013,'#a78051',10);
  m.sweep(arc(a=>[x+(r-.015)*Math.sin(a),y+(r-.015)*Math.cos(a),z+.017],56),.005,'#d2b476',8);
  // A curved solid spine and tapered teeth, splayed at the ends. The dark
  // wide-tooth comb and pale fine-tooth comb lie flat beside the jewellery box.
  function comb(cx:number,cz:number,w:number,count:number,h:number,color:string,yaw:number){
    const ca=Math.cos(yaw),sa=Math.sin(yaw);
    const at=(dx:number,y:number,dz:number):V=>[cx+dx*ca+dz*sa,y,cz-dx*sa+dz*ca];
    const pos=(u:number,v:number):V=>at((u-.5)*w,.798+.007*Math.sin(Math.PI*u),-.014-.029*Math.sin(Math.PI*u)+v*(.026+.011*Math.sin(Math.PI*u)));
    s.grid(18,1,pos,color);
    for(const v of [0,1])s.sweep(arc(t=>pos(t,v),18,1),.0047,color,6);
    for(let j=0;j<count;j++){
      const t=(j+.35)/(count-.3),dx=(t-.5)*w;
      s.sweep([pos(t,1),at(dx*1.02,.799,h*.48),at(dx*1.052,.793,h*(.72+.28*Math.sin(Math.PI*t)))],
        [w/(count*2.8),w/(count*3.4),w/(count*7)],color,6);
    }
  }
  comb(-.465,.087,.23,12,.063,'#77543c',.33);comb(-.425,.195,.216,24,.056,'#ddbd84',-.15);
  // Black-red lacquer casket; its plum/magpie painting spans a single lid.
  const corners=[[.83,1],[1,.77],[1,-.77],[.83,-1],[-.83,-1],[-1,-.77],[-1,.77],[-.83,1]];
  const levels=[[.95,.791],[1,.796],[1,.807],[.952,.814],[.95,.887],[.99,.889],[.99,.895],[1,.896],[1,.914],[.965,.925]];
  s.grid(8,levels.length-1,(u,v)=>{const [x,z]=corners[Math.round(u*8)%8],[r,y]=levels[Math.round(v*(levels.length-1))];return [.487+.176*r*x,y,.025+.114*r*z];},'#633b39');
  s.grid(8,1,(u,v)=>{const [x,z]=corners[Math.round(u*8)%8];return [.487+.170*(1-v)*x,.925,.025+.110*(1-v)*z];},white,'lacquer',
    (u,v)=>{const [x,z]=corners[Math.round(u*8)%8];return [.5+.5*x*(1-v),.5-.5*z*(1-v)];});
  m.box([.487,.892,.139],.289,.005,.0026,gold);m.box([.487,.887,.142],.030,.037,.006,gold);
  m.sweep(arc(a=>[.487+.009*Math.sin(a),.879+.010*Math.cos(a),.148],14),.0027,'#b09971',6);
  // Hairpin with open blossom prongs and a bead on the front edge; second,
  // smaller lidded powder pot sits free of the mirror's feet.
  m.sweep([[.212,.794,.256],[.378,.797,.231],[.430,.801,.219]],[.002,.004,.005],gold,7);
  for(let j=0;j<5;j++){const a=j*tau/5;
    m.sweep(arc(t=>[.432+(.006+.005*Math.cos(t))*Math.cos(a)-.004*Math.sin(t)*Math.sin(a),.803,
      .219+(.006+.005*Math.cos(t))*Math.sin(a)+.004*Math.sin(t)*Math.cos(a)],12),.002,gold,6);}
  s.turn([-.138,.791,.143],[[.044,0],[.052,.007],[.054,.025],[.049,.041],[.047,.045],[.054,.048],[.053,.054],[.034,.062],[0,.063]],'#94a69b','solid',24);
  s.turn([-.138,.791,.143],[[.05,.039],[.051,.043]],'#c4b180','solid',24);
  return shop.finish();
}
