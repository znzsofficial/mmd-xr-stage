import { curve, tau, white, Workshop, type V } from './furnishingsMesh';

const wood='#ab7657', walnut='#694338', honey='#cf9e73', porcelain='#e6e7d7', glaze='#567b70';

/** Four complete covers per table; the bowls have rims, deep interiors and
 * unglazed feet. Everything is static and uses the same opaque material. */
export function makeFeast(){
  const shop=new Workshop(),s=shop.body;
  function bowl(x:number,y:number,z:number,r:number,h:number,cup=false){
    const p:V=[x,y,z],n=cup?16:20;
    s.turn(p,[[r*.38,0],[r*.39,h*.12],[r*.49,h*.14],[r*.70,h*.32]],porcelain,'solid',n);
    s.turn(p,[[r*.70,h*.32],[r*.87,h*.60],[r*.97,h*.88],[r,h]],white,'blue',n);
    s.turn(p,[[r,h],[r*.94,h*1.005],[r*.924,h*.94]],porcelain,'solid',n);
    s.turn(p,[[r*.924,h*.94],[r*.83,h*.68]],white,'blue',n);
    s.turn(p,[[r*.83,h*.68],[r*.61,h*.31],[r*.44,h*.24]],porcelain,'solid',n);
    s.disk([x,y+h*.24,z],r*.445,porcelain,'solid','up',n);
    if(cup){s.disk([x,y+h*.69,z],r*.86,'#a77942','solid','up',n);}
  }
  function saucer(x:number,y:number,z:number,r:number){
    s.turn([x,y,z],[[r*.45,0],[r*.46,.006],[r*.75,.009],[r,.022],[r,.026],[r*.9,.023],[r*.7,.013]],'#e0e3d7','solid',24);
    s.disk([x,y+.013,z],r*.706,white,'fish','up',24);
  }
  // The hoop and apron are linked to the mortises in four splayed legs.
  s.turn([0,0,0],[[.633,.692],[.652,.699],[.652,.71],[.669,.716],[.67,.757],[.659,.77]],wood,'solid',56);
  s.disk([0,.77,0],.659,'#eed3b6','wood','up',56);
  s.grid(56,1,(u,v)=>[(.637+.004*v)*Math.sin(tau*u),.7704,(.637+.004*v)*Math.cos(tau*u)],'#aa7d50');
  s.turn([0,0,0],[[.571,.60],[.60,.612],[.615,.65],[.615,.687],[.635,.693]],walnut,'solid',40);
  s.turn([0,0,0],[[.605,.623],[.61,.631]],honey,'solid',40);
  for(let i=0;i<4;i++){
    const a=(i+.5)*tau/4,pt=(r:number,y:number):V=>[r*Math.cos(a),y,r*Math.sin(a)];
    s.sweep([pt(.47,.00),pt(.49,.023),pt(.468,.083),pt(.422,.154),pt(.411,.48),pt(.445,.575),pt(.46,.661)],
      [.032,.043,.036,.026,.046,.058,.058],walnut,8);
    const next=(i+1.5)*tau/4;
    s.sweep([pt(.425,.227),[.42*Math.cos(next),.227,.42*Math.sin(next)]],.016,wood);
    // A low round stool at 45, 135, 225, 315 degrees. All three feet land within its seat diameter.
    const cx=.90*Math.cos(a),cz=.90*Math.sin(a);
    s.turn([cx,0,cz],[[.137,.379],[.152,.385],[.154,.395],[.177,.400],[.18,.423],[.173,.44]],wood,'solid',24);
    s.disk([cx,.44,cz],.173,'#efcf9c','wood','up',24);
    s.turn([cx,0,cz],[[.15,.388],[.155,.393]],honey,'solid',24);
    const feet:V[]=[];
    for(let k=0;k<3;k++){
      const ang=a+k*tau/3,fp=(r:number,y:number):V=>[cx+r*Math.cos(ang),y,cz+r*Math.sin(ang)];
      s.sweep([fp(.153,.001),fp(.154,.022),fp(.145,.072),fp(.107,.30),fp(.116,.391)],[.021,.026,.018,.023,.027],walnut,8);
      feet.push(fp(.137,.116));
    }
    for(let k=0;k<3;k++)s.sweep([feet[k],feet[(k+1)%3]],.010,wood,7);
    const place=(along:number,tangent:number,y:number):V=>[Math.cos(a)*along-Math.sin(a)*tangent,y,Math.sin(a)*along+Math.cos(a)*tangent];
    const [bx,,bz]=place(.46,0,.77),[tx,,tz]=place(.385,-.145,.77);
    saucer(bx,.77,bz,.092);bowl(bx,.784,bz,.071,.066);
    saucer(tx,.77,tz,.049);bowl(tx,.784,tz,.038,.049,true);
    s.box(place(.416,.116,.778),.067,.016,.017,glaze,'solid',-a-Math.PI/2);
    for(const offset of [-.010,.010]){
      const lower=place(.573,.116+offset,.774),upper=place(.344,.116+offset*.76,.791);
      s.sweep([lower,upper],[.0048,.0028],'#7d4b35',7);
      s.sweep([place(.551,.116+offset*.98,.778),place(.565,.116+offset,.777)],.005,'#c99c66',7);
    }
  }
  // Lidded celadon pot with an open C-handle and a lifted, hollow spout.
  const px=.072,pz=-.115;
  saucer(px,.77,pz,.118);
  s.turn([px,.787,pz],[[.040,0],[.05,.005],[.053,.019],[.075,.029],[.093,.070],[.088,.10],[.064,.131],[.048,.137],[.049,.146]],glaze,'solid',28);
  s.turn([px,.787,pz],[[.055,.140],[.058,.146],[.050,.151],[.036,.159],[.012,.163],[.010,.173],[.016,.18],[.012,.19],[0,.193]],'#729487','solid',24);
  s.sweep(curve([px-.068,.878,pz],[px-.12,.875,pz],[px-.121,.918,pz],[px-.153,.922,pz]),[.024,.023,.021,.019,.016,.014,.013,.014,.015],glaze,12);
  s.sweep(curve([px+.056,.902,pz],[px+.155,.936,pz],[px+.16,.803,pz],[px+.076,.825,pz],12),.010,glaze,10);
  // Stacked serving dishes and a basket of steamed peach buns. They leave the
  // inner fish medallions partly exposed when viewed from a seat.
  for(const y of [.771,.784,.798])saucer(-.177,y,.095,.125);
  s.turn([.159,.77,.170],[[.097,0],[.116,.011],[.119,.063],[.119,.069],[.112,.07],[.109,.026]],'#bd8d54','wood',32);
  s.disk([.159,.796,.17],.109,'#dfc58d','wood','up',28);
  for(const y of [.784,.823])s.turn([.159,y,.170],[[.118,0],[.119,.005]],'#a07547','solid',28);
  for(let j=0;j<3;j++){
    const a=j*tau/3,x=.159+.058*Math.cos(a),z=.170+.054*Math.sin(a);
    s.turn([x,.799,z],[[.028,0],[.039,.008],[.043,.027],[.038,.046],[.025,.060],[.008,.067],[0,.074]],'#e9c2a0','solid',14);
    s.sweep(curve([x-.001,.868,z],[x+.006,.857,z+.018],[x+.014,.848,z+.035],[x+.015,.83,z+.038]),.0025,'#c48e7a',5);
  }
  return shop.finish();
}
