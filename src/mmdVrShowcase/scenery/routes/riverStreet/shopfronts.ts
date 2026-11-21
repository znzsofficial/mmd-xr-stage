import {A,Skin,type V} from '../../wedding/architectureMesh';
import {Frame} from '../../wedding/architectureJoinery';
import {fireGable,tiledRoof} from '../../wedding/architectureRoofs';
import {gateCheeks,gateHead,gatePosts,gateX,jars,landingHead,landingPosts,landingX,lamps,laneZ,malletBench,shadeCloths,shopFront,teaCounter,vatPosts} from './plan';

function board(g:Skin,art:Skin,frame:Frame,row:number,w:number,h:number,base:number,dep:number,side=1){
  const {x,z}=frame;
  new Frame(g,x,z,frame.alongZ).box(0,base+h/2,dep,w+.055,h+.06,.075,A.wood,'#9b8775');
  const v=1-(row*128+1)/512,t=1-(row*128+127)/512;
  const p=(u:number,y:number)=>frame.at(side*u,y,dep+side*.039);
  art.face([p(-w/2,base),p(w/2,base),p(w/2,base+h),p(-w/2,base+h)],0,'#ffffff',[[.50098,t],[.99902,t],[.99902,v],[.50098,v]]);
}

function lantern(g:Skin,lights:Skin,x:number,z:number,hook:number,size:number,color:string){
  // Eight bamboo ribs bow outward over waxed paper; solid brass lid and
  // bottom collar close the ends. A single unlit sheet captures lamp emission.
  const R=size*.46,Y=hook-size*.63,H=size*.43,n=10;
  g.beam([x,hook+.025,z],[x,Y+H,z],.011,.011,A.plain,'#6f5945');
  const v=(i:number,k:number):V=>{const a=2*Math.PI*i/n,f=[.70,.95,1,.95,.70][k];return [x+R*f*Math.cos(a),Y+(k/2-1)*H,z+R*f*Math.sin(a)];};
  for(let j=0;j<n;j++)for(let k=0;k<4;k++){
    lights.face([v(j+1,k),v(j,k),v(j,k+1),v(j+1,k+1)],0,color);
    g.beam(v(j,k),v(j,k+1),.008,.008,A.plain,'#9c7352');
  }
  for(const s of [-1,1]){const y=Y+s*H;g.block(x,y,z,R*1.47,.038,R*1.47,A.wood,'#aa8c60');}
  g.lathe(x,z,[[Y-H-.17,.017],[Y-H-.12,.017],[Y-H-.027,.007]],A.plain,'#ae6748',6);
}

export function buildGate(g:Skin,art:Skin,lights:Skin){
  for(const {x,z,w,d,top} of gatePosts){
    g.block(x,.13,z,w,.26,d,A.granite,'#d6cebb');
    g.block(x,(.26+top)/2,z,.205,top-.26,.205,A.wood,'#b39c7e');
    g.block(x,2.57,z,.30,.14,.29,A.wood,'#d3ac7c');
    for(const s of [-1,1])g.beam([x,2.43,z],[x,2.73,z+s*.31],.099,.13,A.wood,'#aa8e70');
  }
  for(const {x,z,w,d} of gateCheeks){
    g.block(x,.19,z,w,.38,d,A.brick,'#c1bcad');g.block(x,1.48,z,w,2.20,d-.025,A.lime,'#d8d3be');
    const f=new Frame(g,x,z),side=Math.sign(laneZ-z);
    f.rim(0,.73,side*(d/2+.001),.87,1.28,.046,.056,'#bfb8a3',A.granite);
    f.panel(0,.77,side*(d/2-.007),.80,1.19,side,A.swallows,'#c9caaf');
  }
  const h=gateHead;g.block(h.x,2.81,h.z,h.w,.40,h.d,A.boards,'#9c8976',1,.8);
  const frame=new Frame(g,gateX,laneZ,true);
  for(const s of [-1,1]){
    board(g,art,frame,0,1.52,.355,2.66,s*.80,s);
    frame.box(0,3.055,s*.66,4.0,.14,.24,A.wood,'#ad9377');
    for(const v of [-1,1]){const [x,,z]=frame.at(v*1.41,0,s*.76);lantern(g,lights,x,z,2.62,.31,'#eab679');}
  }
  tiledRoof(g,{x:gateX,z:laneZ,hw:2.26,hd:1.21,eave:3.16,rise:.59,hip:.47,lift:.18,turn:true,detail:false});
}

export function buildSongLanding(g:Skin,art:Skin,lights:Skin){
  // A red-lacquer landing sign at the turn, rather than a second wall or a
  // distant skyline straight across the walking line. Short, deep eaves read
  // as the songhouse at standing height even before the main hall is visible.
  const x=landingX,f=new Frame(g,x,laneZ,true);
  for(const p of landingPosts){
    g.block(x,.15,p.z,.25,.30,.25,A.granite,'#e8d6b9');
    g.lathe(x,p.z,[[.30,.093],[2.67,.092],[2.77,.135]],A.plain,'#784735',10);
    g.block(x,2.74,p.z,.32,.13,.34,A.plain,'#aa7953');
    g.beam([x,2.25,p.z],[x,2.75,p.z+Math.sign(laneZ-p.z)*.50],.082,.105,A.plain,'#96513b');
  }
  const h=landingHead;
  f.box(0,2.76,0,h.d,.17,.25,A.wood,'#ad805a');
  for(const side of [-1,1])board(g,art,f,3,1.38,.37,2.35,.14*side,side);
  for(const k of [-1,1]){
    f.box(k*1.72,2.82,0,.71,.19,.33,A.plain,'#925b43');
    lantern(g,lights,x+.10,laneZ+k*1.48,2.70,.48,'#ffc476');
  }
  tiledRoof(g,{x,z:laneZ,hw:2.36,hd:.56,eave:2.91,rise:.41,hip:.39,lift:.19,turn:true,detail:false});
}

function foldedCloth(g:Skin,art:Skin){
  // Double the loom-width over the bamboo pole, not a floating flat print.
  for(const p of vatPosts){g.block(p.x,1.32,p.z,p.w,2.64,p.d,A.wood,'#c6b599');g.block(p.x,.13,p.z,.21,.26,.21,A.granite,'#c9c1b0');}
  const z=vatPosts[0].z;
  g.beam([vatPosts[0].x-.17,2.49,z+.08],[vatPosts[1].x+.17,2.49,z+.08],.068,.068,A.plain,'#9b8962');
  for(const cloth of shadeCloths){
    const at=(u:number,t:number):V=>[cloth.x+(u-.5)*cloth.w,cloth.bottom+t*(cloth.top-cloth.bottom)+.013*(1-t)*Math.cos(u*21),cloth.z+.059*Math.sin(u*19+.6*t)+.018*Math.sin(t*5)];
    for(let i=0;i<10;i++)for(let j=0;j<3;j++){
      const a=i/10,b=(i+1)/10,c=j/3,d=(j+1)/3;
      const uv=(u:number,v:number):[number,number]=>[.003+u*.494,.007+.98*v];
      art.face([at(a,c),at(b,c),at(b,d),at(a,d)],0,'#f2e9d7',[uv(a,c),uv(b,c),uv(b,d),uv(a,d)]);
    }
    for(const s of [-.28,.28])g.block(cloth.x+s,2.495,cloth.z,.033,.090,.109,A.plain,'#987f5d');
  }
}

export function buildShops(g:Skin,art:Skin,lights:Skin){
  const {x,z,w,d,top}=shopFront,front=z+d/2;
  g.block(x,-.12,z,w,.96,d,A.brick,'#c7c4b0',1.4,1.1);g.block(x,1.76,z,w,2.80,d,A.lime,'#ebe5ce',1.6,1.5);
  tiledRoof(g,{x,z,hw:w/2+.25,hd:d/2+.46,eave:top+.04,rise:.72,lift:.095,detail:false});
  for(const s of [-1,1])fireGable(g,x+s*(w/2-.044),z,d/2+.066,top-.06,top+.12,.74,.17);
  for(const k of [-1,0,1]){
    const f=new Frame(g,x+k*2.03,front);
    if(k===0){f.box(0,1.10,.014,1.54,2.20,.061,A.boards,'#795a47');
      for(const s of [-1,1]){f.box(s*.362,1.10,.059,.705,2.12,.047,A.wood,'#aa8b71');f.rim(s*.362,.20,.092,.49,1.78,.047,.025,'#c9a575');}
    }else{
      f.box(0,1.47,.043,1.63,1.45,.08,A.paper,'#e0bd90');f.rim(0,.78,.106,1.73,1.47,.071,.078,'#b39a76');
      for(const a of [-.52,0,.52]){f.line(a,.84,a,2.18,.105,.034,.038,'#b99a75');
        for(const side of [-1,1])f.line(a,1.29,a+.23*side,1.64,.106,.028,.031,'#bb9a6e');}
      for(const y of [1.02,1.18,1.80,1.98])f.line(-.82,y,.82,y,.113,.034,.041,'#c9ab7d');
    }
    f.box(0,2.35,.065,1.98,.14,.22,A.wood,'#927c65');
  }
  board(g,art,new Frame(g,x,front),1,1.91,.43,2.48,.075);
  for(const k of [-1,1])lantern(g,lights,x+k*2.55,front+.26,3.03,.40,'#ffce8b');
  // Tea merchant's wicker trays, weighing beam and two lidded storage jars.
  const t=teaCounter;g.block(t.x,.83,t.z,t.w,.16,t.d,A.boards,'#d3b086');
  for(const a of [-1,1])for(const b of [-1,1])g.block(t.x+a*.65,.40,t.z+b*.21,.066,.80,.069,A.wood,'#af936e');
  for(const s of [-1,1]){
    g.lathe(t.x+s*.43,t.z,[[.91,.165],[.928,.195],[.99,.208],[1,.190],[.95,.155],[.948,.001]],A.plain,'#ad8b55',16);
    g.lathe(t.x+s*.43,t.z,[[.95,.157],[.99,.114],[1.007,.02],[1.009,0]],A.plain,s>0?'#736640':'#5e6448',12);
  }
  for(const j of jars){const h=j.top;
    g.lathe(j.x,j.z,[[0,.14],[.035,.164],[h*.32,.237],[h*.71,.218],[h*.84,.163],[h*.91,.150],[h*.94,.174],[h,.164],[h+.035,.044],[h+.036,0]],A.plain,'#63766d',16);
    for(const y of [.23,.45])g.lathe(j.x,j.z,[[y,.231],[y+.017,.232]],A.plain,'#a5a387',16);
  }
  const bench=malletBench;g.block(bench.x,.545,bench.z,bench.w,.15,bench.d,A.boards,'#c6ad87');
  for(const u of [-.62,.62])g.block(bench.x+u,.23,bench.z,.10,.46,.38,A.wood,'#b49e82');
  g.beam([bench.x-.53,.655,bench.z+.1],[bench.x+.06,.655,bench.z-.08],.041,.041,A.wood,'#b19771');
  g.block(bench.x+.12,.685,bench.z-.09,.22,.13,.19,A.wood,'#b39c7b');
  foldedCloth(g,art);
  // A low dyer's workshop behind the drying frame. Under the roof are closed
  // shutters, wash trough and a deep indigo vat. The footway stays open-air.
  const dye=new Frame(g,-10.03,6.25);
  dye.box(0,1.07,0,4.02,2.18,1.80,A.lime,'#dedcc7',1.4,1.3);
  tiledRoof(g,{x:dye.x,z:dye.z,hw:2.20,hd:1.12,eave:2.20,rise:.46,detail:false});
  for(const i of [-1,0,1])dye.box(i*1.22,1.08,.915,1.09,1.83,.055,A.boards,'#99a093');
  board(g,art,new Frame(g,dye.x,dye.z),2,1.57,.32,1.78,.987);
  g.lathe(-9.19,7.88,[[0,.31],[.3,.43],[.60,.42],[.65,.44],[.69,.433],[.70,.384],[.60,.37]],A.plain,'#617978',16);
  g.lathe(-9.19,7.88,[[.605,.374],[.606,0]],A.plain,'#345d6b',16);
  for(const p of lamps){const h=p.top,s=p.x<-20?1:-1;
    g.block(p.x,.12,p.z,p.w+.04,.24,p.d+.04,A.granite,'#ded2b7');
    g.block(p.x,(h+.24)/2,p.z,.105,h-.24,.105,A.wood,'#bda283');
    g.beam([p.x-s*.10,h-.013,p.z],[p.x+s*.55,h-.013,p.z],.095,.087,A.wood,'#b69f83');
    g.beam([p.x,h-.33,p.z],[p.x+s*.32,h-.035,p.z],.052,.052,A.wood,'#b69f83');
    lantern(g,lights,p.x+s*.45,p.z,h-.05,.38,'#ffcc8b');
  }
}
