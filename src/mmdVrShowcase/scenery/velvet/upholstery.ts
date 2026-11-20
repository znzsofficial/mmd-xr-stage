import {Joinery,type V} from '../retreat/joinery';
import {velvetPlan} from './velvetLayout';

// The shared joinery builder batches every surface into one mesh per finish.
// This set dresses cloth=velour, brocade=satin and stone=pebbled leather.
const tau=Math.PI*2, brass='#b38d65',velour='#3d303e';
function cord(s:Joinery,f:'cloth'|'brocade'|'metal'|'stone',at:(t:number)=>V,thick:number,tint:string,n=24){
  let a=at(0);for(let k=1;k<=n;k++){const b=at(k/n);s.line(f,a,b,thick,tint);a=b;}
}
export function dressBackdrop(s:Joinery){
  const cx=-1.22,w=3.50,h=2.91,base=.25,zz=-3.52;
  // The etching sits inside a cut arch, not on a rectangular poster.
  const trim=(v:number)=>Math.sqrt(1-Math.max(0,(v-.61)/.39)**2);
  s.grid('city',24,40,(u,v)=>[cx+(u-.5)*w*trim(v),base+h*v,zz],'#fce9d6');
  for(const sign of [-1,1]){
    const a=(t:number):V=>[cx+sign*w*.50*Math.cos(t*Math.PI/2),base+h*(.61+.39*Math.sin(t*Math.PI/2)),zz+.018];
    s.line('metal',[cx+sign*w/2,base,zz+.018],a(0),.023,brass);cord(s,'metal',a,.023,brass,32);
  }
  // Thick velvet legs. The tied edges flare at the hem and sweep inwards
  // overhead; shift each fold sideways with the weight of the fabric.
  for(const side of [-1,1]){
    const at=(u:number,v:number):V=>{
      const tie=Math.exp(-((v-.47)**2)/.035),width=.92+.44*v-.53*tie;
      const fold=Math.cos(tau*(7*u+.075*Math.sin(4.2*v)+.07*Math.sin(tau*u)));
      return [cx+side*(2.17+(u-.50)*width+.20*tie),.05+v*3.47+.031*fold*(1-v),-3.65+.094*fold+.024*Math.cos(3*tau*u+v*4)];
    };
    s.grid('cloth',100,24,at,'#322938',[3.2,9]);
    for(const h of [.455,.472,.489])cord(s,'brocade',t=>{const [x,y,z]=at(t,h);return [x,y,z+.022];},.014,'#ae825e',28);
    const tip=at(side===-1?0:1,.48);
    cord(s,'brocade',t=>[tip[0]+side*(.06*t+.075*Math.sin(t*Math.PI)),tip[1]-.35*t,tip[2]+.07],.011,'#c39769',12);
    s.turn('brocade',[tip[0]+side*.06,tip[1]-.40,tip[2]+.07],.016,.048,.12,'#ba916a');
  }
}

export function chaise(s:Joinery){
  const {x,z}=velvetPlan.sofa;
  for(const xx of [-1.30,1.3])for(const zz of [-.37,.37]){
    s.line('wood',[x+xx,.225,z+zz],[x+xx*1.04,.039,z+zz*1.10],.04,'#694641');
    s.turn('metal',[x+xx*1.04,.037,z+zz*1.10],.041,.033,.057,brass);
  }
  s.pad('wood',[x,.222,z],2.94,.12,1.0,.052,'#624444');
  s.pad('cloth',[x,.324,z],3.02,.22,1.08,.088,velour);
  s.pad('brocade',[x,.423,z+.062],2.88,.036,.93,.017,'#68505d');
  s.pad('cloth',[x,.48,z+.06],2.88,.13,.98,.061,'#443345');
  // Diamond-tufted asymmetrical chaise back: each button pinches a valley in
  // the upholstery. A crest and base seam meet the same curved face.
  const back=(u:number,v:number):V=>{
    const a=6*u+1.55*v,b=6*u-1.55*v;
    const pinch=Math.exp(-10*(Math.sin(a*Math.PI)**2+Math.sin(b*Math.PI)**2));
    const swell=(Math.abs(Math.sin(a*Math.PI)*Math.sin(b*Math.PI)))**.65;
    const top=.86+.23*Math.sin(Math.PI*(.05+.91*u))+.065*(1-u);
    return [x+(u-.5)*2.86,.48+(top-.48)*v,z-.44+.074*swell-.026*pinch+.085*(1-v)];
  };
  s.grid('cloth',102,26,back,'#493647',[7,2]);
  for(const k of [0,1])cord(s,'brocade',t=>back(t,k),.009,'#77565e',36);
  s.grid('cloth',48,4,(u,v)=>{const a=back(u,1);return [a[0],a[1]+.025*Math.sin(v*Math.PI),a[2]-.115*v];},velour);
  s.grid('cloth',48,2,(u,v)=>{const a=back(u,v);return [a[0],a[1],z-.555];},velour);
  for(let j=1;j<3;j++)for(let i=0;i<6;i++){const u=(i+(j%2)*.5)/6;if(!u)continue;const a=back(u,j/(2*1.55));s.orb('brocade',a,.037,.032,.021,'#70535d');}
  for(const side of [-1,1]){
    const xx=x+side*1.43;
    s.pad('cloth',[xx,.624,z],.209,.50,1.07,.095,velour);
    s.turn('cloth',[xx,.835,z+.001],.127,.127,1.04,'#503a4a',[Math.PI/2,0,0],28);
    s.hoop('brocade',[xx,.835,z+.517],.094,.009,'#896772');
    s.turn('metal',[xx,.835,z+.526],.026,.026,.011,brass,[Math.PI/2,0,0]);
  }
  // A thrown satin stole follows the rear cushion, seat and front waterfall.
  const throwAt=(u:number,v:number):V=>{
    const x0=x+.67+(u-.5)*.63+.18*v+.033*Math.sin(5*v);
    const wave=.021*Math.sin(8*Math.PI*u+3*v)+.008*Math.cos(15*Math.PI*u-v);
    if(v<.29)return [x0,.81-.225*v/.29+wave,z-.374+.344*v/.29];
    if(v<.71)return [x0,.585+wave,z-.03+(v-.29)*.635/.42];
    return [x0,.585+wave*(1-v)/.29-(v-.71)*(.38+.025*Math.sin(8*u))/.29,z+.605+wave*(v-.71)/.29];
  };
  s.grid('brocade',48,36,throwAt,'#d09b96',[3,6]);
  for(const edge of [.055,.08,.92,.945])cord(s,'brocade',t=>throwAt(edge,t),.0035,'#f1c6ab',28);
  for(let i=0;i<34;i++){const [x0,y0,z0]=throwAt(i/33,1);s.line('brocade',[x0,y0,z0],[x0+.008,y0-.044,z0+.005],.0028,'#d4ab98');}
  // Round gathered satin bolster: routed pleats are actual geometry under the key.
  const px=x-.84,py=.75,pz=z-.24;
  const puff=(u:number,v:number):V=>{
    const a=tau*u,r=.267*v,flute=.009*Math.cos(a*24+2*v)*Math.sin(Math.PI*v);
    return [px+r*Math.cos(a),py+r*Math.sin(a)*.93,pz+.05+r*.26*Math.sin(a)+.11*Math.sin(Math.PI*v)**.62+flute];
  };
  s.grid('brocade',100,10,puff,'#986677',[6,1]);cord(s,'brocade',t=>puff(t,1),.009,'#bb8890',38);
  s.orb('brocade',[px,py,pz+.06],.041,.041,.03,'#bf9596');
}

export function loungeBench(s:Joinery){
  const {x,z,w,d}=velvetPlan.bench;
  for(const dx of [-.28,.28])for(const dz of [-.64,.64])s.turn('metal',[x+dx,.185,z+dz],.024,.033,.34,brass);
  s.pad('wood',[x,.324,z],w-.04,.105,d-.04,.041,'#754c42');
  s.pad('stone',[x,.441,z],w,.18,d,.075,'#51404a');
  for(let i=-2;i<=2;i++)s.pad('stone',[x,.505,z+i*.30],w-.045,.094,.30,.046,'#54414a');
  s.pad('brocade',[x+.019,.568,z-.43],.60,.056,.44,.024,'#be948e',[0,-.05,0]);
}
