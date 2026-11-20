import {arc,curve,Surface,tau,white,Workshop,type V} from './furnishingsMesh';
import {FRONT,POST} from './bridalLayout';

const oxblood='#79352e',red='#aa4435',edge='#cc6c47',gold='#d6ac6c',bone='#ecdbad';

// Relief, undercut cloud scrolls and negative space in the pierced apron are
// modelled: the crest reads from its reverse, even before the prints arrive.
function blossom(s:Surface,x:number,y:number,z:number,r:number){
  for(let i=0;i<5;i++){
    const a=i*tau/5,b=Math.cos(a),c=Math.sin(a);
    s.sweep(arc(t=>[x+r*((.47+.39*Math.cos(t))*b-.21*Math.sin(t)*c),y+r*((.47+.39*Math.cos(t))*c+.21*Math.sin(t)*b),z+.012*Math.sin(t/2)],14),r*.10,edge,6);
  }
  s.disk([x,y,z+.012],.16*r,gold,'solid','front',12);
}

export function makeBridalBed(){
  const shop=new Workshop(),s=shop.body,m=shop.metal;
  for(const x of [-POST,POST])for(const z of [-.78,.78,FRONT]){
    s.turn([x,0,z],[[.053,0],[.058,.026],[.058,.071],[.045,.088],[.046,.17],[.055,.19],[.050,.24],[.043,.29],[.042,1.86],[.052,1.90],[.047,2.06],[.059,2.10],[.056,2.29]],red,'solid',12);
    for(const y of [.072,.195,1.916,2.095])m.turn([x,y,z],[[.052,0],[.055,.005],[.052,.011]],gold,'solid',12);
  }
  // Dashed gold inlay, swept ogee feet and a padded mattress, rather than
  // one red cuboid. Bedding and pillows are visible inside the open bay.
  for(const k of [-1,1]){
    s.box([0,.402,k*.79],2.91,.22,.094,oxblood);
    s.box([k*1.40,.40,0],.098,.22,1.57,oxblood);
    for(const x of [-1.36,1.36])s.sweep(curve([x,.30,k*.79],[x*.97,.16,k*.79],[x*.90,.34,k*.79],[x*.83,.29,k*.79]),.036,red,8);
    s.box([0,.493,k*.835],2.90,.018,.012,edge);
  }
  s.box([0,.537,0],2.95,.083,1.70,red);
  // Recessed cartouches in the long front apron, edged with a raised reed.
  for(const x of [-.94,0,.94]){
    const z=.841;s.box([x,.395,z],.80,.140,.016,'#843f35');
    const corners=[[-.34,-.053],[.34,-.053],[.385,-.025],[.385,.025],[.34,.053],[-.34,.053],[-.385,.025],[-.385,-.025],[-.34,-.053]];
    s.sweep(corners.map(([u,v])=>[x+u,.395+v,z+.009]),.0065,edge,6);
    for(const k of [-1,1])s.sweep(curve([x,.394,z+.013],[x+k*.084,.347,z+.018],[x+k*.126,.443,z+.018],[x+k*.238,.391,z+.014]),.007,edge,6);
  }
  s.box([0,.587,0],2.76,.095,1.54,'#c56954');
  const quilt=(u:number,v:number):V=>[(u-.5)*2.76,.64+.022*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)+.009*Math.sin(9*Math.PI*u+2*v),-.23+v*.97];
  s.grid(32,9,quilt,'#f2d0b1','lotus');
  s.grid(32,6,(u,v)=>{const [x,y,z]=quilt(u,1);return [x,y-.142*v+.011*v*Math.sin(u*tau*3),z+.037*Math.sin(v*Math.PI/2)];},'#dfa488','lotus');
  for(const x of [-.75,.75]){
    s.grid(22,10,(u,v)=>{const a=tau*v,scale=.80+.20*Math.sin(Math.PI*u);return [x+(u-.5)*.93,.754+.112*Math.sin(a)*scale,-.49+.159*Math.cos(a)*scale];},'#f8cf9a','calyx');
    for(const k of [-1,1]){
      const end=x+k*.465;
      s.grid(24,1,(u,v)=>[end+k*.003*(1-v),.754+v*.09*Math.sin(tau*u),-.49+v*.128*Math.cos(tau*u)],'#e2a976');
      s.sweep(arc(a=>[end,.754+.09*Math.sin(a),-.49+.128*Math.cos(a)],24),.008,gold,6);
    }
  }
  // Low enclosure on three sides; embroidered silk peeks through carved
  // frames, with real open fret above the side panels.
  s.box([0,1.00,-.79],2.83,.80,.070,oxblood);
  for(const x of [-.94,.94]){
    s.box([x,1.016,-.749],.84,.546,.018,red);
    s.grid(1,1,(u,v)=>[x+(u-.5)*.76,.78+v*.473,-.737],white,'lacquer',(u,v)=>[x>0?1-u:u,v]);
  }
  // The central medallion is an actual pierced double-happiness print, not
  // another repetition of the floral lacquer. Its ivory mount catches the eye
  // between the pillows and stays warm even when the real 2D print is late.
  s.disk([0,1.094,-.744],.282,bone,'solid','front',40);
  m.sweep(arc(a=>[.285*Math.sin(a),1.094+.285*Math.cos(a),-.738],40),.010,gold,8);
  shop.paper.quad([-.252,.842,-.734],[.252,.842,-.734],[.252,1.346,-.734],[-.252,1.346,-.734],white,'paper');
  for(const side of [-1,1]){
    s.box([side*POST,.85,0],.060,.45,1.52,oxblood);
    s.box([side*POST,1.24,0],.077,.068,1.54,red);
    for(let j=0;j<6;j++)s.sweep([[side*POST,1.073,(j-3)*.24],[side*POST,1.203,(j-2.5)*.24],[side*POST,1.073,(j-2)*.24]],.014,edge,6);
  }
  for(const x of [-1.46,1.46])s.box([x,2.285,.68],.14,.196,3.03,red);
  for(const z of [-.79,FRONT])s.box([0,2.28,z],3.04,.204,.12,oxblood);
  s.box([0,2.408,.68],3.12,.054,3.15,red);
  s.quad([-1.46,2.378,-.79],[1.46,2.378,-.79],[1.46,2.378,FRONT],[-1.46,2.378,FRONT],'#e8b5a0','calyx');
  for(const z of [-.79,FRONT]){
    const face=z+.072;
    s.box([0,2.393,face],3.09,.037,.071,edge);
    m.box([0,2.353,face],3.02,.014,.025,gold);
    for(let i=-3;i<=3;i++){
      const u=i*.40;
      s.sweep(arc(a=>[u+.176*Math.cos(a),2.258+.073*Math.sin(a),face+.012],24),.014,edge,7);
      blossom(s,u,2.255,face+.029,.071);
    }
    // The central top rail rises in a low cloud silhouette; open spaces under
    // its two curling shoulders remain visible against the ceiling from below.
    for(const k of [-1,1]){
      const a=(u:number,h:number):V=>[k*u,h,z+.01];
      s.sweep(curve(a(.78,2.42),a(.49,2.405),a(.52,2.55),a(.29,2.50)),.029,red,9);
      s.sweep(curve(a(.29,2.50),a(.095,2.46),a(.16,2.55),a(.02,2.58)),.025,edge,8);
      s.sweep(curve(a(.49,2.44),a(.40,2.53),a(.29,2.435),a(.22,2.462)),.013,red,7);
    }
    blossom(s,0,2.522,z+.028,.074);
    for(const k of [-1,1]){
      const at=(x:number,y:number):V=>[k*x,y,face];
      s.sweep(curve(at(1.46,1.81),at(1.24,1.84),at(1.42,2.15),at(1.04,2.08)),.034,red,8);
      s.sweep(curve(at(1.04,2.08),at(.81,2.01),at(.91,2.22),at(.66,2.19)),.025,red,8);
      s.sweep(curve(at(1.46,1.92),at(1.36,1.96),at(1.45,2.15),at(1.23,2.16)),.022,edge,7);
    }
  }
  // Front tie-controls are suspended from the canopy, not floating HUD.
  for(const sign of [-1,1]){
    const x=sign*1.61,z=FRONT+.11;
    s.sweep([[sign*1.46,2.22,FRONT],[x,2.22,z],[x,2.15,z]],.019,red);
    m.sweep([[x,2.15,z],[x,1.51,z]],.006,gold,6);
    m.sweep(arc(a=>[x+.043*Math.sin(a),1.31+.068*Math.cos(a),z],22),.009,gold,8);
    s.turn([x,1.122,z],[[.031,0],[.022,.065],[.009,.105],[.017,.12],[.009,.13]],sign<0?red:'#ddb99a','solid',12);
  }
  return shop.finish();
}

export function makeWeddingCups(){
  const shop=new Workshop(),s=shop.body,m=shop.metal;
  s.box([0,.763,0],.80,.074,1.66,'#cba17c','wood');
  for(const k of [-1,1]){
    s.box([k*.344,.68,0],.048,.11,1.52,oxblood);
    s.box([0,.68,k*.747],.71,.11,.051,oxblood);
    for(const j of [-1,1])s.sweep([[k*.34,0,j*.72],[k*.35,.035,j*.73],[k*.33,.14,j*.71],[k*.32,.62,j*.70],[k*.34,.75,j*.73]],[.035,.044,.031,.044,.049],red,8);
    s.box([k*.32,.236,0],.038,.038,1.45,oxblood);
  }
  // Lacquer tray with a raised lip; the paired cups are connected by silk
  // threaded through handles. Hollow rims, a liquid line and porcelain feet.
  s.box([-.065,.819,-.04],.51,.035,.62,oxblood);
  s.quad([-.306,.839,.251],[.177,.839,.251],[.177,.839,-.331],[-.306,.839,-.331],white,'lacquer');
  for(const k of [-1,1]){
    s.box([-.065+k*.246,.845,-.04],.017,.024,.60,red);
    s.box([-.065,.845,-.04+k*.302],.51,.024,.016,red);
    const x=-.10+k*.125,z=-.04+k*.047;
    const at:V=[x,.840,z];
    s.turn(at,[[.025,0],[.030,.006],[.027,.014],[.021,.024],[.034,.033],[.048,.070],[.055,.092]],white,'blue',28);
    s.turn(at,[[.055,.092],[.055,.101],[.051,.102],[.050,.096],[.044,.070],[.029,.038],[.019,.031]],bone,'solid',28);
    m.turn(at,[[.054,.096],[.0554,.098],[.0548,.101]],gold,'solid',28);
    s.disk([x,.909,z],.044,'#bd7f41','solid','up',24);
    s.sweep(curve([x-k*.041,.908,z],[x-k*.087,.93,z],[x-k*.086,.857,z],[x-k*.034,.885,z]),.0065,bone,8);
  }
  s.sweep(curve([-.162,.897,-.088],[-.18,.832,-.17],[-.012,.836,-.17],[-.030,.891,.006],16),.0039,red,6);
  // A narrow wine ewer sits beyond the tray. Sinuous handle and splayed lip.
  const x=.15,z=.38;
  s.turn([x,.80,z],[[.046,0],[.054,.009],[.047,.025],[.064,.052],[.072,.10],[.069,.15],[.048,.18],[.027,.203],[.026,.252],[.039,.261],[.035,.269],[.024,.262]],'#82a79a','solid',32);
  s.sweep(curve([x,.915,z-.053],[x,.91,z-.131],[x,.99,z-.129],[x,1.012,z-.145]),[.023,.023,.021,.019,.018,.017,.015,.014,.014],'#82a79a',12);
  s.sweep(curve([x,.970,z+.046],[x,1.04,z+.160],[x,.854,z+.15],[x,.886,z+.066]),.012,'#82a79a',10);
  return shop.finish();
}

export function makeBridalTrunk(){
  const shop=new Workshop(),s=shop.body,m=shop.metal;
  s.box([0,.24,0],1.23,.42,.59,oxblood);
  s.box([0,.502,0],1.26,.104,.62,red);
  s.quad([-.595,.556,.28],[.595,.556,.28],[.595,.556,-.28],[-.595,.556,-.28],white,'lacquer');
  for(const x of [-.53,.53])m.box([x,.29,.298],.046,.37,.009,gold);
  m.disk([0,.410,.312],.071,gold,'solid','front',24);m.box([0,.392,.326],.026,.081,.02,oxblood);
  return shop.finish();
}
