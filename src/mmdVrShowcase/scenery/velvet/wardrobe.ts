import {Joinery,type V} from '../retreat/joinery';
import {velvetPlan} from './velvetLayout';

const brass='#b38a64',grain='#72514e',rose='#b97f82';
function hem(s:Joinery,at:(t:number)=>V,tint:string,r=.005,n=28){
  for(let i=0;i<n;i++)s.line('brocade',at(i/n),at((i+1)/n),r,tint);
}
function hanger(s:Joinery,x:number,z:number,drop:number){
  const top=2.28-drop;
  s.hoop('metal',[x,2.278,z],.047,.007,brass);
  s.line('metal',[x,2.25,z],[x,top-.11,z],.007,brass);
  for(const sign of [-1,1])s.line('wood',[x,top-.11,z],[x+sign*.254,top-.221,z],.021,grain);
  s.line('wood',[x-.251,top-.219,z],[x+.251,top-.219,z],.012,grain);
  return top-.215;
}
function slip(s:Joinery,x:number,z:number){
  const top=hanger(s,x,z,.07),hemY=.66;
  // A bias-cut slip hanging slack. The back and face meet at narrow sides;
  // the scalloped neckline and straps leave genuinely empty air above it.
  const skin=(u:number,v:number,face:number):V=>{
    const a=2*u-1,width=.27+.096*(1-v)**2-.052*Math.sin(v*.95*Math.PI);
    const topY=top-.238+.095*Math.cos((Math.abs(a)-.66)*Math.PI*1.78);
    const ripple=.034*Math.cos(4.5*Math.PI*a+.9*v)*(.72-.43*v);
    return [x+a*width+.045*(1-v),hemY+.026*Math.sin(11*a)*(1-v)+v*(topY-hemY),z+face*(.023+.066*(1-a*a)+ripple)];
  };
  for(const side of [-1,1])s.grid('brocade',48,18,(u,v)=>skin(u,v,side),'#cfaa9d',[2.5,4]);
  for(const sign of [-1,1]){
    const u=(sign*.66+1)*.5,a=skin(u,1,1),b=skin(u,1,-1),strap:V=[x+sign*.222,top+.014,z];
    s.line('brocade',a,strap,.009,'#d8ad95');s.line('brocade',strap,b,.009,'#c19588');
  }
  hem(s,t=>skin(t,1,1),'#ead3b4',.008);hem(s,t=>skin(t,.030,1),'#b08270');
}
function wrap(s:Joinery,x:number,z:number){
  const top=hanger(s,x,z,.04),bot=.43;
  const shell=(u:number,v:number):V=>{
    const a=(u*1.84+.08)*Math.PI,waist=Math.exp(-((v-.59)**2)/.026);
    const w=.31+.093*(1-v)-.121*waist-.060*v**5;
    return [x+w*Math.sin(a)+.025*Math.sin(3*v),bot+(top-bot)*v+.042*Math.sin(a*6+.7)*(1-v),z+.115*Math.cos(a)+.023*Math.cos(10*a+4*v)*(1-.65*waist)];
  };
  const band=(lo:number,hi:number,n:number,tint:string)=>s.grid('brocade',n,30,(u,v)=>shell(lo+(hi-lo)*u,v),tint,[4*(hi-lo),6]);
  band(0,.069,7,'#c08c83');band(.069,.931,72,'#8b4457');band(.931,1,7,'#c08c83');
  for(const side of [-1,1]){
    // Soft sleeves drop away from the hanger; each cuff has a contrasting facing.
    const sleeve=(u:number,v:number):V=>{
      const a=2*Math.PI*u;return [x+side*(.225+.248*v)+(.089+.038*v)*Math.sin(a),top-.016-.61*v+.045*Math.sin(a),z+.012+.105*Math.cos(a)+.018*Math.sin(4*a+.6*v)];
    };
    s.grid('brocade',32,8,(u,v)=>sleeve(u,.89*v),'#985368',[1.8,2.5]);s.grid('brocade',32,3,(u,v)=>sleeve(u,.89+.11*v),'#bd8c84');
  }
  s.grid('brocade',60,3,(u,v)=>{const [xx,y,zz]=shell(u,.56+.041*v);return [x+1.02*(xx-x),y,z+1.16*(zz-z)];},'#bd8b81');
  for(const d of [-1,1])s.grid('brocade',4,10,(u,v)=>[x+.03+(u-.5)*.056+d*.061*v,1.35-.30*v-.075*(d===1?1:0)*v,z+.15+.035*Math.sin(3.14*v)],'#ca9d90');
}
function bodice(s:Joinery,x:number,z:number){
  const top=hanger(s,x,z,.26);
  // A flat boned waistcoat, clipped to the hanger. No torso/mount inside.
  const at=(u:number,v:number,side=1):V=>{
    const a=2*u-1,w=.259-.060*Math.sin(Math.PI*v)+.011*(1-v),bot=top-.655+.085*a*a;
    return [x+a*w,bot+(top-.115-.042*Math.cos(a*Math.PI*1.9)-bot)*v,z+side*(.041+.031*(1-a*a)+.005*Math.cos(6*Math.PI*a))];
  };
  for(const face of [-1,1])s.grid('stone',32,12,(u,v)=>at(u,v,face),'#664149',[2.1,2.1]);
  for(const u of [.11,.30,.45,.55,.7,.89])hem(s,t=>at(u,t),'#ac7b70',.004,10);
  for(const v of [0,1])hem(s,t=>at(t,v),'#b48976',.006);
  for(const u of [.12,.88]){
    const a=at(u,1);s.line('metal',a,[a[0],top+.02,z],.009,brass);
    s.box('metal',[a[0],a[1]-.016,a[2]+.005],.047,.027,.023,'#d0aa78');
  }
  for(let j=0;j<6;j++)for(const sign of [-1,1]){
    const a=at(.5+sign*.055,.12+.12*j),b=at(.5-sign*.055,.24+.12*j);
    s.line('brocade',a,b,.004,'#d5b29e');s.orb('metal',a,.019,.019,.012,brass);
  }
}
export function wardrobe(s:Joinery){
  const {x,z,w,d}=velvetPlan.wardrobe,fb=z+d/2;
  s.box('wood',[x,1.27,z-.38],w,2.54,.12,grain);
  s.box('matte',[x,1.36,z-.30],w-.15,2.23,.055,'#bb9a8c');
  for(const side of [-1,1])s.box('wood',[x+side*(w/2-.06),1.27,z],.12,2.54,d,'#6b4a45');
  for(const y of [.105,2.47]){s.box('wood',[x,y,z],w,.17,d,grain);s.box('metal',[x,y,fb+.002],w-.055,.012,.009,brass);}
  s.box('glow',[x,2.373,z+.22],w-.34,.022,.053,'#ffdfb3');
  s.line('metal',[x-1.58,2.28,z],[x+1.58,2.28,z],.021,brass);
  for(const xx of [x-.94,x-.03,x+.98])s.turn('metal',[xx,.197,fb-.075],.03,.03,.009,brass);
  slip(s,x-.97,z);wrap(s,x-.01,z);bodice(s,x+1.02,z);
  // Leather train case and buckled lid beside the hanging waistcoat.
  s.pad('stone',[x+1.04,.33,z+.035],.68,.253,.45,.046,'#764f49');
  s.pad('stone',[x+1.04,.467,z+.035],.68,.071,.45,.028,'#7d5650');
  for(const k of [-1,1]){
    s.pad('stone',[x+1.04+k*.228,.363,z+.258],.041,.24,.022,.009,'#976d5d');
    s.box('metal',[x+1.04+k*.228,.429,z+.275],.057,.049,.018,brass);
  }
  hem(s,t=>[x+1.04+.105*Math.cos(Math.PI*t),.497+.051*Math.sin(Math.PI*t),z+.035],'#6c504a',.013,14);
}
export function vanity(s:Joinery){
  const {x,z}=velvetPlan.vanity;
  s.box('wood',[x,1.10,z],.23,2.2,1.45,'#73564e');
  s.pad('wood',[x-.105,.79,z],.28,.205,1.45,.05,'#79574e');
  s.box('metal',[x-.25,.86,z],.012,.02,1.41,brass);
  s.turn('metal',[x-.136,1.59,z],.538,.538,.048,'#9e9797',[0,0,Math.PI/2],64);
  s.hoop('metal',[x-.166,1.59,z],.534,.021,brass,[0,Math.PI/2,0]);
  for(const k of [-1,1])for(const v of [1.24,1.60,1.96])s.orb('glow',[x-.17,v,z+k*.61],.066,.076,.076,'#ffdab2');
  for(const [dx,dz,h,col] of [[0,-.39,.16,rose],[.04,-.25,.12,'#cfa583']] as const){
    s.pad('stone',[x-.13+dx,.89+h/2,z+dz],.091,h,.072,.018,col);s.turn('metal',[x-.13+dx,.91+h,z+dz],.023,.023,.043,brass);
  }
}
