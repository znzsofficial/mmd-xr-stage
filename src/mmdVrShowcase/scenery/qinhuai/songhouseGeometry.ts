import {BufferGeometry,Float32BufferAttribute,Color} from 'three';
import type {Part} from '../SceneryBatch';
import {span} from '../detailParts';
import {BACKDROP,CEILINGS,DAIS_TREADS,GALLERY,GALLERY_RAIL,GALLERY_Y,HALL,HEADER,MIRROR,MUSIC,PIER,POSTS,PRIVATE_TOP,QUARTERS,QUAY,RIVER_RAILS,STAGE,STAGE_Y,STAIR_TREADS,STOOLS,TABLES,UPPER_SEAT,VANITY,WALLS,stageDrapes,type Rect} from './songhouseLayout';
import {makeSonghouseClose} from './songhouseClose';
import {furnishQuarters} from './privateQuarters';

type V=Part['p'];
type UV=[number,number];
const wood='#774638',timber='#512f2b',dark='#422e30',amber='#ad7650',brass='#bf955d',ivory='#e3d1ad',jade='#53746c';
export class Skin {
  p:number[]=[]; uv:number[]=[]; colors:number[]=[]; indices:number[]=[];
  quad(a:V,b:V,c:V,d:V,color:string,uv:UV[]=[[0,0],[1,0],[1,1],[0,1]]){
    const i=this.p.length/3,col=new Color(color);this.p.push(...a,...b,...c,...d);this.uv.push(...uv.flat());
    for(let k=0;k<4;k++)this.colors.push(col.r,col.g,col.b);this.indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  finish(){const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(this.p,3));geo.setAttribute('uv',new Float32BufferAttribute(this.uv,2));geo.setAttribute('color',new Float32BufferAttribute(this.colors,3));geo.setIndex(this.indices);geo.computeVertexNormals();geo.computeBoundingSphere();return geo;}
}
export function makeSonghouse(){
  const boxes:Part[]=[],round:Part[]=[],glow:Part[]=[],facets:Part[]=[];
  const roofs=new Skin(),prints=new Skin(),hulls=new Skin(),fabric=new Skin();
  let seed=88131;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c=wood,ry=0,rx=0,rz=0)=>boxes.push({p:[x,y,z],s:[w,h,d],color:c,ry,rx,rz});
  const tube=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,rx=0,rz=0)=>round.push({p:[x,y,z],s:[w,h,d],color:c,rx,rz});
  const bead=(x:number,y:number,z:number,w:number,h:number,d:number,c:string)=>facets.push({p:[x,y,z],s:[w,h,d],color:c});
  const line=(a:V,b:V,w:number,c:string,d=w)=>boxes.push(span(a,b,w,c,d));
  const slab=(r:Rect,base:number,top:number,c:string)=>box(r.x,(base+top)/2,r.z,r.w,top-base,r.d,c);
  const panel=(x:number,z:number,y:number,w:number,h:number,tile:[number,number,number,number],yaw=0,c='#ffffff')=>{
    const p=(a:number,b:number):V=>[x+a*Math.cos(yaw),y+b,z-a*Math.sin(yaw)];const [u,v,ue,ve]=tile;
    prints.quad(p(-w/2,0),p(w/2,0),p(w/2,h),p(-w/2,h),c,[[u/1536,1-ve/1024],[ue/1536,1-ve/1024],[ue/1536,1-v/1024],[u/1536,1-v/1024]]);
  };
  function lantern(x:number,z:number,hook:number,size:number,peach=false){
    const y=hook-size*.85;line([x,hook+.05,z],[x,y+.45*size,z],.018,timber);
    glow.push({p:[x,y,z],s:[size*.81,size*.83,size*.81],color:peach?'#ffe4a0':'#ffb16e'});
    for(const k of [-1,1]){tube(x,y+k*size*.445,z,.83*size,.08*size,.83*size,timber);tube(x,y+k*.34*size,z,size*.83,.022,size*.83,brass);}
    for(let j=0;j<8;j++){const a=j*Math.PI/4;box(x+.39*size*Math.cos(a),y,z+.39*size*Math.sin(a),.014,size*.82,.014,'#ad7045');}
    tube(x,y-size*.64,z,.058*size,size*.31,.058*size,'#a6513d');
  }
  // Curved, hipped grey-tile roofs. Eaves sweep up at corners, hip run
  // narrows into a capped ridge. UVs are tile courses rather than one image per roof.
  function roof(cx:number,cz:number,hw:number,hd:number,eave:number,rise:number,swap=false,pale=false){
    const world=(u:number,y:number,v:number):V=>swap?[cx+v,y,cz+u]:[cx+u,y,cz+v];
    const ridge=Math.max(.22,hw-.76*hd),lift=Math.min(.45,rise*.26);
    for(const end of [false,true])for(const side of [-1,1]){
      const at=(s:number,t:number)=>{
        const u=end?side*(hw*(1-t)+ridge*t):s*(hw*(1-t)+ridge*t);
        const v=end?s*hd*(1-t):side*hd*(1-t);
        return world(u,eave+rise*(.28*t+.72*t*t)+lift*Math.pow(Math.abs(s),6)*(1-t)**2,v);
      };
      const n=pale?(end?3:6):(end?8:20),m=pale?3:6;
      for(let j=0;j<m;j++)for(let i=0;i<n;i++){
        const a=i/n*2-1,b=(i+1)/n*2-1,l=j/m,k=(j+1)/m;
        const ps=[at(a,l),at(b,l),at(b,k),at(a,k)] as [V,V,V,V];
        const tint=pale?(j%2?'#707477':'#676f72'):(j%2?'#484e56':'#50575f');
        roofs.quad(...ps,tint,ps.map(([x,y,z])=>[end?(swap?x:z):(swap?z:x),y*1.8+((end?(swap?z:x):(swap?x:z))*(1-l)*.04)]));
        if(j===0)line(ps[0],ps[1],.094,pale?'#87878a':'#697178',.14);
      }
      if(!end)for(const k of [-1,1])for(let j=0;j<m;j++)line(at(k,j/m),at(k,(j+1)/m),.12,'#737978');
    }
    line(world(-ridge-.16,eave+rise+.045,0),world(ridge+.16,eave+rise+.045,0),.17,pale?'#78787c':'#686f74',.22);
    for(const k of [-1,1])line(world(k*ridge,eave+rise+.085,0),world(k*(ridge+.4),eave+rise+.26,0),.12,'#757c80');
  }
  slab(HALL,-.20,-.04,timber);slab(GALLERY,-.18,GALLERY_Y-.042,timber);slab(QUAY,-.89,-.095,'#797778');slab(STAGE,-.06,STAGE_Y-.035,wood);
  // Real joints, softly varied board lengths and edge battens.
  function boards(r:Rect,y:number,tints:string[]){const n=Math.ceil(r.d/.32);for(let j=0;j<n;j++){
    let left=r.x-r.w/2;while(left<r.x+r.w/2-.004){const end=Math.min(r.x+r.w/2,left+(j%2&&left===r.x-r.w/2?1.16:2.6+rnd()*1.95));box((left+end)/2,y-.022,r.z-r.d/2+(j+.5)*r.d/n,end-left-.008,.044,r.d/n-.008,tints[Math.floor(rnd()*tints.length)]);left=end;}
  }}
  boards(HALL,0,['#9a735d','#a27a62','#a07a64','#94715d']);boards(STAGE,STAGE_Y,['#b98b68','#b58c6d','#bf9776']);boards(GALLERY,GALLERY_Y,['#957560','#9d7861','#a58065']);
  slab(PIER,-.18,-.048,timber);boards(PIER,0,['#9c826d','#9e806b','#ae8e72']);
  for(let j=0;j<9;j++){let left=-8.8;const z=4.5+(j+.5)*.7;while(left<7.48){const next=Math.min(7.5,left+(left===-8.8&&j%2?.77:1.42+rnd()*.55));box((next+left)/2,-.05,z,next-left-.015,.10,.689,['#b1a597','#b5aa9c','#a99d90','#b4a899'][Math.floor(rnd()*4)]);left=next;}}
  for(const [i,r] of [...STAIR_TREADS,...DAIS_TREADS].entries()){slab(r,r.bottom,r.top,i%2?wood:'#905d45');box(r.x,r.top-.019,r.z+r.d/2-.036,r.w+.002,.044,.074,'#bb9874');}
  for(const x of [-8.73,-5.77]){line([x,.81,8.04],[x,GALLERY_Y+.81,2.6],.085,timber);line([x,.34,8.04],[x,GALLERY_Y+.34,2.6],.065,amber);for(let i=0;i<16;i+=2){const t=STAIR_TREADS[i];box(x,t.top+.4,t.z,.075,.80,.075,wood);}}
  for(const [i,w] of WALLS.entries())slab(w,w.bottom,w.top,i===2?'#856451':i>=4?timber:'#d2bfaa');
  const lattice=(x:number,y:number,z:number,w:number,h:number,side=false)=>{
    const piece=(u:number,v:number,ww:number,hh:number,c:string)=>box(x+(side?0:u),y+v,z+(side?u:0),side?.055:ww,hh,side?ww:.055,c);
    for(const s of [-1,1]){piece(s*w/2,h/2,.075,h+.07,timber);piece(0,s*h/2+h/2,w+.08,.07,timber);}
    const n=Math.max(2,Math.round(w/.42));for(let j=1;j<n;j++)piece(w*(j/n-.5),h/2,.032,h,amber);
    for(const v of [.20,.28,.72,.8])piece(0,h*v,w,.031,amber);
    for(let j=0;j<n;j++){const u=w*((j+.5)/n-.5);piece(u,h*.50,.023,h*.44,amber);piece(u,h*.50,w/n*.58,.031,amber);}
  };
  for(const x of [-4.43,4.43]){box(x,1.5,4.52,2.0,2.47,.065,'#d1b68e');lattice(x,.72,4.565,1.92,1.74);box(x,.34,4.54,2.08,.56,.07,wood);lattice(x,.72,4.32,1.92,1.74);}
  for(let j=0;j<3;j++){
    const z=-5.78+j*3.73;box(5.53,2.32,z,.072,2.22,3.39,'#d3bd98');lattice(5.47,1.23,z,3.37,2.17,true);
    box(-5.59,1.09,z,.075,1.86,3.48,'#aa886a');lattice(-5.53,.44,z,3.37,1.53,true);
    const gz=-5.95+j*3.26;box(-8.65,4.31,gz,.07,1.72,2.96,'#d2b891');lattice(-8.60,3.44,gz,2.88,1.68,true);
  }
  for(const p of POSTS){const upper=p.x<-5.7;const h=upper?5.48:5.0;const y=upper?GALLERY_Y:0;
    tube(p.x,(y+h)/2,p.z,p.w,h-y,p.d,timber);tube(p.x,y+.12,p.z,p.w*1.34,.24,p.d*1.34,'#9a9280');tube(p.x,h-.21,p.z,p.w*1.32,.10,p.d*1.32,brass);
    for(const k of [-1,1]){line([p.x,h-.64,p.z],[p.x+k*.52,h-.16,p.z],.095,wood,.12);box(p.x+k*.20,h-.12,p.z,.56,.16,.34,wood);box(p.x+k*.15,h-.30,p.z,.39,.13,.31,'#976446');}
  }
  slab(HEADER,HEADER.bottom,HEADER.top,timber);box(0,3.16,4.59,11.4,.082,.10,amber);
  for(const z of [-7.65,-3.4,.22,4.42]){box(0,4.97,z,11.5,.28,.28,wood);box(0,4.84,z,11.46,.055,.31,amber);}
  for(const x of [-5.54,5.54])box(x,4.98,-1.68,.27,.32,12.39,wood);
  for(const x of [-8.62,-5.85])box(x,5.52,-2.60,.23,.27,10.46,timber);
  for(const r of CEILINGS){slab(r,r.bottom,r.top,'#875f4c');
    const nx=Math.ceil(r.w/1.31),nz=Math.ceil(r.d/1.50);for(let i=0;i<=nx;i++)box(r.x+r.w*(i/nx-.5),r.bottom-.042,r.z,.07,.084,r.d,timber);
    for(let j=0;j<=nz;j++)box(r.x,r.bottom-.04,r.z+r.d*(j/nz-.5),r.w,.080,.075,timber);}
  // Latticed transom over the open entrance; dark beams leave the rear stage
  // visible from the water. Do not infill the west face at gallery eye level.
  for(let j=0;j<5;j++){const x=(j-2)*2.2;box(x,4.24,4.45,2.12,1.13,.11,'#b29979');lattice(x,3.71,4.525,2.03,1.05);}
  // The front eave frames the river-facing entrance; the deeper, higher roof
  // crowns the stage. A separate longitudinal roof shelters the upper gallery.
  roof(0,1.28,6.25,3.89,5.13,1.38);roof(0,-5.24,6.40,3.51,5.58,1.63);roof(-7.26,-2.63,5.76,1.90,5.66,1.10,true);
  for(const z of [-3.42,-1.10,1.58,4.65]){if(z!==4.65)box(0,4.94,z,10.98,.09,.08,amber);for(const x of [-3.44,3.44])lantern(x,z,z===4.65?3.63:4.88,z===4.65?.69:.53,z<1);}
  box(0,3.33,4.65,2.55,.79,.19,timber);panel(0,4.75,2.97,2.44,.72,[0,650,780,908]);
  const rail=(r:Rect,h:number,base:number,side:boolean,stone=false)=>{
    for(const t of [.24,.94])box(r.x,base+h*t,r.z,side?.088:r.w,.092,side?r.d:.088,stone?'#b2a99a':amber);
    const l=side?r.d:r.w,n=Math.ceil(l/(stone?1.7:1.32));for(let j=0;j<=n;j++){const along=l*(j/n-.5);const x=r.x+(side?0:along),z=r.z+(side?along:0);box(x,base+h*.54,z,.12,h*1.08,.12,stone?'#a49a8c':wood);bead(x,base+h*1.12,z,.17,.15,.17,stone?'#ada394':brass);}
    if(!stone)for(let j=0;j<n;j++){const z=r.z+l*((j+.5)/n-.5);for(const k of [-1,1])line([r.x,base+.23,z],[r.x,base+.58,z+k*.37],.038,wood);}
  };
  rail(GALLERY_RAIL,.93,GALLERY_Y,true);for(const r of RIVER_RAILS)rail(r,.83,0,r.w<r.d,true);
  for(const r of TABLES){box(r.x,.746,r.z,r.w,.085,r.d,'#784b38');box(r.x,.672,r.z,r.w-.08,.085,r.d-.045,amber);
    for(const a of [-1,1])for(const b of [-1,1])box(r.x+a*.56,.334,r.z+b*.26,.079,.67,.079,timber);
    tube(r.x+.03,.81,r.z,.43,.034,.31,'#97704a');bead(r.x+.03,.904,r.z,.20,.17,.17,jade);tube(r.x+.03,.997,r.z,.12,.025,.12,brass);line([r.x-.04,.90,r.z],[r.x-.14,.98,r.z],.049,jade);
    for(const a of [-1,1]){tube(r.x+a*.33,.80,r.z+.12,.16,.017,.16,'#a7b1a4');tube(r.x+a*.33,.84,r.z+.12,.10,.07,.10,'#d3d6c3');}
  }
  for(const r of STOOLS){box(r.x,.436,r.z,r.w,.057,r.d,amber);for(const k of [-1,1])box(r.x+k*.14,.204,r.z,.058,.41,.35,timber);}
  slab(UPPER_SEAT,GALLERY_Y+.39,GALLERY_Y+.47,wood);for(const k of [-1,1])box(UPPER_SEAT.x,GALLERY_Y+.2,UPPER_SEAT.z+k*.68,.41,.4,.13,timber);
  // Six hinged silk leaves: one continuous landscape, real folds and feet.
  slab(BACKDROP,STAGE_Y,3.72,timber);
  for(let i=0;i<6;i++){
    const x=(i-2.5)*1.12,y=STAGE_Y+.27,yaw=(i%2?1:-1)*.105;
    box(x,2.08,-7.49,1.12,3.03,.057,amber,yaw);panel(x,-7.45,y,1.072,2.77,[i*256+1,0,(i+1)*256-1,640],yaw);
  }
  for(const s of stageDrapes){
    const side=Math.sign(s.x);const drape=(u:number,t:number):V=>{const gather=Math.exp(-((t-.45)**2)/.035),fold=Math.sin(u*Math.PI*13);
      return [s.x+side*(.18*gather)+(u-.5)*s.w*(1-.59*gather),.48+.054*fold+(3.07-.054*fold)*t,s.z+.062*fold+.055*Math.sin(t*8+u*3)];};
    for(let j=0;j<12;j++)for(let i=0;i<40;i++){const a=i/40,b=(i+1)/40,t=j/12,v=(j+1)/12;
      fabric.quad(drape(a,t),drape(b,t),drape(b,v),drape(a,v),j===5?'#c49a63':Math.cos(a*Math.PI*13)>.3?'#985353':'#884546');}
    for(let i=0;i<10;i++)line(drape(i/10,.46),drape((i+1)/10,.46),.028,brass);const knot=drape(side<0?1:0,.46);line(knot,[knot[0]-side*.06,knot[1]-.22,knot[2]],.025,brass);tube(knot[0]-side*.06,knot[1]-.29,knot[2],.042,.16,.042,'#bd9362');
  }
  box(0,3.74,-5.23,9.5,.46,.26,timber);panel(0,-5.084,3.53,9.4,.38,[0,920,1536,1023]);box(0,4.02,-5.08,2.16,.64,.17,wood);panel(0,-4.986,3.72,2.06,.61,[800,650,1534,908]);
  slab(VANITY,1.194,1.286,wood);for(const r of [MUSIC,VANITY])for(const a of [-1,1])for(const b of [-1,1])box(r.x+a*(r.w*.44),.82,r.z+b*r.d*.38,.076,.81,.076,timber);
  // Lute on a peg stand behind the qin. Build its pear outline in thin strips,
  // not a spherical guitar. A curved pegbox and frets sit above the shoulders.
  const px=4.53,pz=-7.00;box(px,1.53,pz,.10,.46,.085,timber);box(px,1.31,pz+.04,.37,.054,.16,amber);
  const widths=[.07,.15,.195,.211,.207,.176,.132,.098,.060];for(let j=0;j<widths.length-1;j++){const a=1.36+j*.067,b=a+.067;
    const l=widths[j],u=widths[j+1];hulls.quad([px-l,a,pz+.13],[px+l,a,pz+.13],[px+u,b,pz+.13],[px-u,b,pz+.13],'#c79d65');for(const k of [-1,1])hulls.quad([px+k*l,a,pz+.13],[px+k*u,b,pz+.13],[px+k*u*.83,b,pz+.05],[px+k*l*.83,a,pz+.05],wood);}
  box(px,2.14,pz+.10,.096,.55,.083,'#9d7756');box(px,2.45,pz+.07,.115,.16,.09,timber,0,-.3);box(px,1.50,pz+.146,.18,.032,.026,timber);
  for(let j=0;j<10;j++)box(px,1.88+j*.044,pz+.155,.097,.011,.022,ivory);for(let j=0;j<4;j++){const x=px-.024+j*.016;line([x,1.51,pz+.164],[x,2.41,pz+.168],.0038,'#e4cba9');box(px+(j%2?1:-1)*.094,2.34+j*.044,pz+.08,.11,.028,.031,brass);}
  tube(MIRROR.x,1.72,MIRROR.z,.86,.10,.83,brass,Math.PI/2);tube(MIRROR.x,1.72,MIRROR.z+.065,.68,.04,.66,'#9aa59a',Math.PI/2);box(MIRROR.x,1.37,MIRROR.z,.16,.22,.14,amber);
  tube(VANITY.x+.56,1.34,VANITY.z+.07,.21,.11,.21,'#b35e51');for(const k of [-1,1])box(VANITY.x-.52,1.31,VANITY.z+k*.04,.33,.038,.026,'#e3c38b',.13);

  // River skyline, not an extension of the placeable ground.
  box(1,-.62,27,63,.75,9,'#918c87');
  box(-3,-.54,-14.8,24.4,.84,38.4,'#918d7d');box(-13.00,-.45,4.94,8.35,.61,3.34,'#908b7d');
  for(const side of [-1,1]){
    const near=side<0?-14.1:12.9;box(near,-.45,-6.17,7.26,.68,20.4,'#8a8379');
    for(let i=0;i<3;i++){const x=near+(i===2?side*3.55:0),z=-1.2-i*5.1,w=2.07+i*.17,h=2.42+i*.46;box(x,h*.5-.12,z,w*2,h,3.75,i%2?'#c5b9a6':'#d0c1ad');roof(x,z,w+.46,2.10,h-.05,.93+.12*i,false,true);
      for(const j of [-1,0,1]){box(x+j*w*.59,h*.53,z+1.90,.61,.87,.061,timber);box(x+j*w*.59,h*.53,z+1.946,.49,.74,.029,'#bcaa91');box(x+j*w*.59,h*.53,z+1.968,.036,.75,.026,wood);}
    }
  }
  for(let i=0;i<10;i++){const x=-22+i*4.91,z=25.4+rnd()*1.4,w=1.9+rnd()*.5,h=1.6+rnd()*1.8;box(x,h/2-.28,z,w*2,h,3.2,['#c8b8a8','#aaa79c','#c1b2a3'][i%3]);roof(x,z,w+.27,1.91,h-.15,.72+rnd()*.36,false,true);
    for(const a of [-1,0,1]){box(x+a*w*.62,h*.57,z-1.63,.51,.75,.06,timber);glow.push({p:[x+a*w*.62,h*.57,z-1.665],s:[.41,.62,.023],color:i%3?'#bfa47d':'#e5bd82'});}
  }
  // Moored painted pleasure boat: fine taper at each end, sheer running to
  // raised stems, cabin roof over latticed windows; boat is scenery, not a deck.
  function boat(cx:number,cz:number,size:number){
    const tr=(x:number,y:number,z:number):V=>[cx+x*size,-.54+y*size,cz+z*size];
    const stations=[[-3.65,.05,.76],[-3.13,.51,.44],[-2.31,.83,.29],[1.94,.83,.29],[2.89,.56,.42],[3.66,.045,.75]];
    for(let i=0;i<stations.length-1;i++){
      const [a,wa,ha]=stations[i],[b,wb,hb]=stations[i+1];for(const side of [-1,1]){
        hulls.quad(tr(a,-.10,side*wa*.66),tr(b,-.1,side*wb*.66),tr(b,hb,side*wb),tr(a,ha,side*wa),wood);
        line(tr(a,ha,side*wa),tr(b,hb,side*wb),.076*size,brass);
      }hulls.quad(tr(a,ha,-wa),tr(b,hb,-wb),tr(b,hb,wb),tr(a,ha,wa),'#a67b55');
    }
    for(const a of [-1.72,-.59,.59,1.72])for(const k of [-1,1]){const [x,y,z]=tr(a,1.14,k*.66);box(x,y,z,.073*size,1.65*size,.073*size,timber);}
    for(const k of [-1,1]){const [x,y,z]=tr(0,.63,k*.68);box(x,y,z,3.62*size,.65*size,.074*size,'#854d39');const [u,v,b]=tr(0,1.65,k*.67);box(u,v,b,3.65*size,.24*size,.07*size,wood);
      panel(x,z+k*.04*size,y-.15*size,3.53*size,.22*size,[0,920,1536,1023],k>0?0:Math.PI);
      for(const j of [-1,1]){const xx=x+j*1.14*size;box(xx,y+.63*size,z,1.06*size,.62*size,.039,'#ceb28b');for(const s of [-.37,-.14,.14,.37])box(xx+s*size,y+.63*size,z+k*.029,.031*size,.66*size,.047,wood);box(xx,y+.72*size,z+k*.034,size,.036,.039,timber);}
    }
    roof(cx,cz,2.20*size,.96*size,-.54+1.94*size,.48*size);for(const k of [-1,1])lantern(cx+k*1.60*size,cz-.68*size,-.54+1.75*size,.38*size,true);
    line(tr(1.86,.38,0),tr(3.94,1.19,.78),.06*size,amber);
  }
  boat(-1.9,13.1,1);boat(9.7,18.4,.83);
  // Two old willows soften the ends of the opposite quay. Small overlapping
  // leaf masses and pendent leaflets stand out against the layered dusk sky.
  function willow(x:number,z:number,h:number){const fork:V=[x+.26,h*.62,z];line([x,-.31,z],fork,.32,'#655b4d');for(let j=0;j<9;j++){
    const a=j*2.399,l=1+rnd()*1.55,tip:V=[x+Math.cos(a)*l,h*(.84+rnd()*.18),z+Math.sin(a)*l];line(fork,tip,.105,'#6e6654');bead(...tip,1.83,.75,1.42,['#72806f','#788676','#687d70'][j%3]);
    for(let i=0;i<6;i++){const u=tip[0]+(rnd()-.5)*1.65,v=tip[2]+(rnd()-.5)*1.18,low=tip[1]-.45-rnd()*1.5;line([u,tip[1],v],[u+.07,low,v+.11],.024,'#687967');for(let k=0;k<3;k++){const y=low+k*.26;hulls.quad([u+.07,y-.13,v+.11],[u+.13,y+.05,v+.13],[u+.08,y+.18,v+.09],[u+.03,y+.05,v+.08],'#7b8974');}}}
  }willow(-10.2,23.35,3.75);willow(7.76,23.49,4.05);
  const art=new Skin();slab(QUARTERS,-.18,GALLERY_Y-.042,'#806e60');boards(QUARTERS,GALLERY_Y,['#a48269','#a8866d','#ad8e73']);
  roof(QUARTERS.x,QUARTERS.z,3.63,3.49,PRIVATE_TOP+.15,1.13);
  furnishQuarters({box,tube,bead,line,lantern,fabric,art});
  return {boxes,round,facets,glow,roofs:roofs.finish(),prints:prints.finish(),hulls:hulls.finish(),fabric:fabric.finish(),close:makeSonghouseClose(boxes),quarters:art.finish()};
}
