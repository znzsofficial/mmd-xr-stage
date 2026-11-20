import {nurseSurface,section,mix,tau,type Ring,type Sample,type Finish} from './nurseSurface';

// All coordinates are measured from the existing chair at floor level; the
// keyboard is ahead (+Z). Keep UV islands inset so mipmaps don't sample labels.
const bell=(x:number,w:number)=>Math.exp(-(x*x)/(w*w));

export function clinicNurseGeometry(){
  const {patch,bulb,tube,cord,build}=nurseSurface();

  const skin='#dbad92',scrub='#54878b',binding='#426f76',trousers='#405b66';
  const skull:Ring[]=[[1.035,.014,.026,.119],[1.045,.04,.052,.107],[1.067,.055,.073,.092],[1.093,.070,.085,.080],[1.122,.079,.093,.078],[1.149,.082,.099,.077],[1.175,.081,.103,.078],[1.206,.083,.099,.079],[1.232,.077,.088,.080],[1.254,.059,.068,.080],[1.269,.034,.040,.081],[1.275,.003,.004,.081]];
  // One continuous face surface: jaw, chin, cheeks, eye sockets, brow and
  // nose alter the profile, rather than attaching balls to a spherical head.
  patch(64,44,(u,v)=>{
    const y=1.035+.240*v,[w,d,z]=section(skull,y),a=(u-.5)*tau,x=w*Math.sin(a),f=Math.max(0,Math.cos(a));
    const cheek=.008*bell(Math.abs(x)-.044,.019)*bell(v-.41,.15),socket=-.007*bell(Math.abs(x)-.031,.015)*bell(v-.518,.051);
    const brow=.005*bell(Math.abs(x)-.030,.022)*bell(v-.607,.044),nose=.012*bell(x,.011)*bell(v-.46,.155)+.015*bell(x,.016)*bell(v-.355,.054)+.005*bell(Math.abs(x)-.011,.006)*bell(v-.337,.022);
    const mouth=.005*bell(x,.029)*bell(v-.20,.034),chin=.006*bell(x,.023)*bell(v-.085,.069);
    return [x,y,z+d*Math.cos(a)+f*f*(cheek+socket+brow+nose+mouth+chin)];
  },'face','#ffffff');
  tube([[[0,.973,.055],.062,.053],[[0,1.01,.073],.053,.048],[[0,1.05,.079],.041,.038],[[0,1.096,.084],.043,.038]],skin);
  for(const s of [-1,1]){
    bulb([s*.079,1.144,.074],[.012,.021,.012],skin);
    bulb([s*.089,1.145,.075],[.003,.011,.006],'#b88673');
  }
  // Side part swept back from the temple. Keep the forehead and ears clear;
  // the nape and bun have different strand directions and a visible fabric tie.
  patch(48,18,(u,v)=>{const a=(u-.5)*tau,co=Math.cos(a),si=Math.sin(a);
    const edge=1.126+.084*Math.max(0,co)**1.55-.039*Math.max(0,-co)+.015*si*co;
    const y=mix(edge,1.281,v),[w,d,z]=section(skull,Math.min(y-.007,1.274));
    const corr=(.004+.0014*Math.cos(a*19+v*3.8))*(1-v);
    return [(w+corr)*si,y,z+(d+corr+.003*(1-co))*co];},'hair','#f6ece1');
  bulb([0,1.146,-.027],[.055,.052,.040],'#383633');
  patch(32,14,(u,v)=>{const a=tau*u,b=(v-.5)*3.14,r=1+.065*Math.sin(a*6+b*3);return [.002+.061*r*Math.cos(b)*Math.sin(a),1.14+.055*Math.sin(b),-.060+.052*r*Math.cos(a)*Math.cos(b)]},'hair','#e4dbcf');

  // Raglan top over the lap, with gathered side seams and a real overlapping V.
  const bodice:Ring[]=[[.503,.139,.099,.038],[.541,.173,.131,.041],[.60,.184,.143,.036],[.664,.172,.127,.036],[.708,.155,.107,.042],[.77,.146,.105,.048],[.836,.157,.114,.059],[.900,.174,.116,.068],[.95,.178,.092,.067],[.980,.148,.071,.061],[1.003,.070,.046,.070]];
  tube([[[0,.909,.070],.133,.109],[[0,.935,.072],.125,.097],[[0,.972,.069],.103,.068],[[0,.994,.072],.065,.046],[[0,1.015,.072],.047,.042]],skin,'paint',32);
  const bodyAt:Sample=(u,v)=>{const a=(u-.5)*tau,co=Math.cos(a),si=Math.sin(a);const cut=.085*Math.max(0,co)**7;
    const y=.503+(.5-cut)*v,[w,d,z]=section(bodice,y);
    const wrinkle=(.005*Math.cos(2*Math.PI*(y*13+.8*si))+.003*Math.sin(a*7+y*17))*bell(y-.665,.084)*(.4+.6*Math.abs(si));
    return [(w+wrinkle)*si,y,z+(d+wrinkle)*co];};
  patch(48,34,bodyAt,'fabric',scrub);
  const neckEdge=Array.from({length:31},(_,i)=>bodyAt(i/30,1));cord(neckEdge,.006,binding);
  for(const side of [-1,1]){
    cord(Array.from({length:11},(_,i)=>bodyAt(.5+side*(.265+.035*Math.sin(i*.23)),.04+i*.067)),.0018,'#4b7d81');
    cord(Array.from({length:9},(_,i)=>bodyAt(.5+side*(.36-i*.021),.89+.053*Math.cos(i*.26))),.0017,'#679797');
  }
  // Chest patch, stitched pocket and short pen clips, all attached to fabric.
  function panel(u0:number,u1:number,v0:number,v1:number,finish:Finish,col:string,lift:number){patch(8,6,(u,v)=>{const r=bodyAt(mix(u0,u1,u),mix(v0,v1,v));r[2]+=lift;return r;},finish,col,false);}
  panel(.558,.646,.57,.72,'fabric','#598b8d',.002);cord([bodyAt(.558,.72),bodyAt(.60,.719),bodyAt(.646,.72)].map(([x,y,z])=>[x,y,z+.003]),.0022,binding);
  panel(.554,.635,.80,.85,'badge','#ffffff',.003);
  for(const [i,c] of ['#335868','#8b5744'].entries()){const [x,y,z]=bodyAt(.578+i*.019,.70);cord([[x,y,z+.006],[x,y+.025,z+.004]],.0025,c);}

  for(const s of [-1,1]){
    const delta=s>0?.017:-.012;
    // Shoulder cap to cuff; arm continues *inside* the opening. Forearms
    // pronate and taper to a wrist resting just above the front of the desk.
    tube([[[s*.129,.948,.065],.044,.047],[[s*.167,.932,.068],.060,.066],[[s*.187,.902,.087],.061,.060],[[s*.202,.858,.113],.055,.052],[[s*.208,.840,.126],.054,.052]],scrub,'fabric');
    tube([[[s*.206,.847,.122],.055,.052],[[s*.21,.838,.127],.055,.052]],binding,'fabric');
    tube([[[s*.204,.851,.118],.044,.045],[[s*.215,.797,.171],.042,.042],[[s*.211,.762,.240],.037,.038],[[s*.201,.767,.285],.043,.039],[[s*.181,.787,.374],.037,.032],[[s*.139,.814,.514+delta],.025,.021],[[s*.121,.834,.569+delta],.023,.015],[[s*.112,.838,.616+delta],.036,.016],[[s*.109,.837,.635+delta],.035,.014]],skin,'paint',18);
    for(let j=0;j<4;j++){
      const x=s*(.082+j*.016),z=.628+delta,len=[.071,.078,.071,.055][j];
      tube([[[x,.838,z],.009,.010],[[x+s*.003,.842,z+len*.4],.008,.008],[[x+s*.004,.832,z+len*.75],.007,.007],[[x+s*.003,.826,z+len],.005,.005]],skin,'paint',9);
    }
    tube([[[s*.086,.837,.589+delta],.015,.012],[[s*.073,.827,.611+delta],.012,.010],[[s*.063,.826,.641+delta],.007,.007]],skin);
    // Seat compresses the back of the trousers; the two feet are staggered.
    const step=s>0?.042:-.022;
    tube([[[s*.080,.578,-.015],.083,.069],[[s*.083,.579,.060],.092,.076],[[s*.094,.561,.180],.086,.073],[[s*.106,.535,.292],.075,.067],[[s*.109,.512,.363],.067,.066],[[s*.110,.479,.389],.064,.061],[[s*.113,.413,.380],.060,.054],[[s*.114,.310,.35+step*.4],.054,.051],[[s*.115,.198,.334+step],.045,.044],[[s*.119,.115,.338+step],.045,.043],[[s*.119,.091,.340+step],.051,.045]],trousers,'fabric',20);
    const shoe:Ring[]=[[.011,.043,.101,.380],[.022,.054,.118,.386],[.037,.053,.117,.387],[.055,.050,.112,.385],[.078,.047,.080,.362],[.100,.041,.050,.342],[.109,.032,.039,.34]];
    for(const sole of [true,false])patch(20,sole?2:7,(u,v)=>{const y=sole?mix(.011,.031,v):mix(.031,.109,v),[w,d,z]=section(shoe,y),a=tau*u;return [s*.118+w*Math.sin(a),y-.010,z+step+d*Math.cos(a)]},'paint',sole?'#8c9694':'#e5e7db');
  }
  return build();
}
