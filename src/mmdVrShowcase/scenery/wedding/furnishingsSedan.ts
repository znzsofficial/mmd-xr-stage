import { arc, curve, tau, white, Workshop, type Cell, type V } from './furnishingsMesh';

const lacquer='#853f38', dark='#512c31', red='#aa4440', gold='#bf935a', thread='#d7ac6c';

/** A parked sedan on its short stand. Door is the -Z end, the +X window
 * overlooks the actor's mark. A split front drape preserves a real sightline
 * through to the padded seat and backrest. Both poles run continuously in Z. */
export function makeSedan(){
  const shop=new Workshop({shadowRings:true}),s=shop.body,m=shop.metal;
  const line=(a:V,b:V,r:number,color:string)=>s.sweep([a,b],r,color);
  function tassel(x:number,y:number,z:number,h:number){
    const k=h/.15;
    s.turn([x,y,z],[[.015*k,-h],[.018*k,-h*.94],[.012*k,-h*.52],[.007*k,-h*.41],[.013*k,-h*.35],[.012*k,-h*.24],[.005*k,-h*.19],[.004*k,0]],thread,'solid',8);
    for(const a of [0,2.1,4.2]){const dx=Math.cos(a)*.008*k,dz=Math.sin(a)*.008*k;
      line([x+dx,y-h*.42,z+dz],[x+dx*1.7,y-h*1.055,z+dz*1.7],.003*k,'#b98243');}
  }
  // The upper rail saddles sit on crossbars, bound at all four intersections.
  for(const k of [-1,1]){
    const x=k*.70;s.sweep([[x,.64,-1.8],[x,.64,-1.79],[x,.64,-1.44],[x,.64,-.61],[x,.64,.61],[x,.64,1.44],[x,.64,1.79],[x,.64,1.8]],
      [0,.027,.035,.036,.036,.035,.027,0],'#885637',14);
    for(const e of [-1,1]){
      const z=e*.46;
      s.box([k*.43,.14,z],.108,.28,.12,dark);s.box([k*.43,.034,z],.142,.068,.157,lacquer);
      s.box([k*.43,.23,z],.139,.06,.15,lacquer);
      // Wrapped turns span both members in a figure-eight rather than hovering bands.
      const wrap=arc(a=>[x+.047*Math.cos(a),.675+.068*Math.sin(a),z-.049+a/(tau*4)*.098],38,tau*4);
      s.sweep(wrap,.008,'#dbb881',6);
      s.sweep(curve([x+.045,.683,z+.051],[x+.082,.66,z+.083],[x+.069,.633,z+.068],[x+.067,.609,z+.09]),.008,'#c39458',6);
      for(const turn of [-1,1]){const zz=e*1.59+turn*.045;
        s.sweep(arc(a=>[x+.034*Math.cos(a),.64+.034*Math.sin(a),zz],12),.007,thread,6);}
      s.box([k*.475,.48,z],.084,.40,.087,lacquer);
    }
    s.box([0,.715,k*.46],1.52,.069,.077,lacquer);
    s.box([k*.475,.285,0],.106,.095,1.12,lacquer);
  }
  s.box([0,.32,0],1.06,.064,1.14,'#d09a70','wood');
  for(const k of [-1,1]){
    s.box([k*.40,.16,-.66],.065,.073,.38,lacquer);
    s.sweep([[k*.4,.273,-.47],[k*.4,.155,-.71]],.025,dark);
  }
  s.box([0,.191,-.727],.86,.058,.226,'#d6a680','wood');s.box([0,.198,-.828],.865,.032,.024,thread);
  // Back and two lower panels are framed independently; there is light below each seat rail.
  s.box([0,.99,.535],1.045,1.30,.07,lacquer);
  s.quad([-.43,.44,.497],[.43,.44,.497],[.43,1.62,.497],[-.43,1.62,.497],white,'calyx');
  s.quad([.43,.44,.573],[-.43,.44,.573],[-.43,1.59,.573],[.43,1.59,.573],white,'lotus');
  for(const k of [-1,1]){
    s.box([k*.49,.586,0],.066,.465,1.06,lacquer);
    s.quad([k*.526,.40,-.47],[k*.526,.40,.47],[k*.526,.77,.47],[k*.526,.77,-.47],white,'calyx');
    for(const y of [.39,.79])s.box([k*.50,y,0],.083,.029,1.1,gold);
    for(const e of [-1,1]){
      s.turn([k*.492,0,e*.529],[[.031,.32],[.036,.38],[.032,.77],[.044,.80],[.027,.85],[.029,1.56],[.045,1.59],[.042,1.74]],lacquer,'solid',12);
      s.turn([k*.492,0,e*.529],[[.038,.80],[.038,.815]],thread,'solid',12);
    }
    s.box([k*.48,1.66,0],.085,.12,1.13,lacquer);
    // Narrow brocade pilasters frame the side opening; its middle stays open.
    for(const e of [-1,1]){
      s.grid(9,5,(u,v)=>[k*(.491+.017*Math.sin(u*tau*2)),.82+v*.80,e*(.494-u*(.105+.083*v*v))],white,'lotus');
    }
  }
  s.box([0,1.66,0],1.10,.13,1.16,dark);
  // A stuffed seat with a welt and rounded oblong corners rather than a hard slab.
  const pillow=(cx:number,cy:number,cz:number,hw:number,hd:number,h:number,cell:Cell)=>{
    const pos=(a:number,q:number,y:number):V=>{
      const sn=Math.sin(a),cs=Math.cos(a);return [cx+q*hw*Math.sign(sn)*Math.abs(sn)**.38,cy+y,cz+q*hd*Math.sign(cs)*Math.abs(cs)**.38];};
    const rings=[[.88,0],[1,h*.32],[1,h*.56],[.95,h*.89],[.82,h],[0,h*1.025]];
    s.grid(32,rings.length-1,(u,v)=>{const [q,y]=rings[Math.round(v*(rings.length-1))];return pos(u*tau,q,y);},white,cell);
    s.sweep(arc(a=>pos(a,1.004,h*.52),32),.009,thread,6);
  };
  s.box([0,.548,.226],.80,.376,.47,dark);pillow(0,.736,.17,.417,.26,.105,'lotus');
  s.box([0,1.094,.435],.77,.58,.104,'#a44849');
  s.grid(15,7,(u,v)=>[(u-.5)*.72,.846+v*.499,.380-.033*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)],white,'calyx');
  // Each gathered half sweeps out from a full-width top into a small cord knot.
  function drape(k:number,u:number,v:number):V{
    const pinch=Math.exp(-((v-.35)**2)/.016),width=.22+.257*v**2-.155*pinch;
    return [k*(.488-u*width),.572+1.075*v+(.038*Math.cos(u*12)+.095*u)*(1-v)**3,-.556-.033*Math.cos(u*3*tau+.65*v)-.024*Math.sin(v*Math.PI)];
  }
  for(const k of [-1,1]){
    s.grid(24,13,(u,v)=>drape(k,u,v),white,'lotus');
    s.sweep(arc(v=>drape(k,1,v),15,1),.009,thread,6);
    const p=drape(k,.5,.35);s.sweep(arc(a=>[p[0]+.059*Math.cos(a),p[1]+.012*Math.cos(a),p[2]+.043*Math.sin(a)],16),.011,gold);
    s.sweep(curve(p,[p[0]-k*.10,p[1]-.03,p[2]-.09],[p[0]-k*.065,p[1]-.07,p[2]-.10],[p[0]-k*.075,p[1]-.108,p[2]-.072]),.008,thread,6);
    tassel(p[0]-k*.075,p[1]-.108,p[2]-.072,.126);
  }
  // Embroidered valance on all four eaves. Corners lift; each bay sags at its centre.
  for(const side of [-1,1])for(const alongX of [true,false]){
    const pos=(u:number,v:number):V=>{
      const a=u*2-1,fold=.008*Math.cos(u*tau*8),y=1.604+v*.164+Math.abs(a)**4*.073-(1-v)*.052*(.5-.5*Math.cos(tau*3*u));
      return alongX?[.61*a,y,side*(.636+fold)]:[side*(.61+fold),y,.636*a];};
    s.grid(24,3,pos,white,'calyx',(u,v)=>[u,.20+v*.18]);s.sweep(arc(t=>pos(t,0),24,1),.009,thread,6);
    for(let j=0;j<5;j++){const p=pos((j+.5)/5,0);tassel(...p,j%2?.083:.11);}
  }
  const roof=(u:number,v:number):V=>{
    // Each hip must meet the *actual* raised valance corner underneath. A
    // superellipse roof inset its corners too far, revealing gaps from the gate.
    const f=(u*4)%1,q=1-.90*v,t=2*f-1,side=Math.floor(u*4)%4;
    const x=[t,1,-t,-1][side],z=[1,-t,-1,t][side];
    return [.64*q*x,1.772+.274*(.34*v+.66*v*v)+.073*(1-v)**2*t**4,.67*q*z];};
  s.grid(48,6,roof,'#993b40');s.sweep(arc(a=>roof(a,0),48,1),.017,gold);
  for(let i=0;i<8;i++)s.sweep(arc(t=>roof(i/8,t),7,1),i%2?.015:.01,i%2?gold:'#b76c52',6);
  for(const k of [-1,1])for(const e of [-1,1]){const x=k*.61,z=e*.636;
    s.turn([x,1.61,z],[[.010,0],[.020,.011],[.021,.028],[.011,.041],[.010,.055]],'#b34e3e','solid',10);tassel(x,1.61,z,.17);}
  m.turn([0,2.032,0],[[.078,0],[.081,.015],[.051,.029],[.045,.041],[.052,.053],[.045,.083],[.022,.106],[.033,.124],[.022,.15],[0,.178]],gold,'solid',18);
  return shop.finish();
}
