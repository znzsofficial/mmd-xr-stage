import { useEffect, useMemo } from "react";
import { Color, PlaneGeometry } from "three";
import { Batch, type Part } from "../scenery/SceneryBatch";
import { WEDGES, LIVE_DECK_SIZE, BACKLINE } from '../scenery/placementAreas';
import { span } from '../scenery/detailParts';
import { noPick, paintedSurface } from '../scenery/sceneryPaint';
import { seededRandom } from '../scenery/ClassroomLayout';

function architecture(concert: boolean) {
  const blocks: Part[] = [];
  const lamps: Part[] = [];
  const cones: Part[] = [];
  const strips: Part[] = [];
  const box = (p: Part["p"], s: Part["s"], color: string, ry = 0, rz = 0) => blocks.push({ p, s, color, ry, rz });
  // An open proscenium: the deck surface stays at character foot height.
  box([0, -0.134, 0], [LIVE_DECK_SIZE, 0.26, LIVE_DECK_SIZE], "#574e49");
  box([0, 2.3, -5.64], [11.6, 4.6, 0.25], "#27262e");
  for (const side of [-1, 1]) {
    const color = concert ? (side < 0 ? "#e49a64" : "#72a4c2") : "#cac1b1";
    for (let i = 0; i < 7; i++) {
      box([side * (3.4 + i * 0.30), 2.1, -5.2 + i * 0.07], [0.37, 4.2, 0.21], i % 2 ? "#5a3943" : "#412e37", side * 0.36);
    }
    // Acoustic cabinets and recessed drivers in front of the side drapes.
    for (const y of [0.55, 1.6]) {
      box([side * 4.55, y, -3.88], [0.84, 1.02, 0.68], "#24272b");
      cones.push({ p: [side * 4.55, y - 0.08, -3.53], s: [0.58, 0.034, 0.58], rx: Math.PI / 2, color: "#393e42" });
      box([side * 4.55, y + 0.32, -3.53], [0.43, 0.09, 0.04], "#13171c");
    }
    for (const x of [1.4, 2.9, 4.3]) {
      box([side * x, 3.95, -4.55], [0.28, 0.34, 0.38], "#272a2f");
      lamps.push({ p: [side * x, 3.91, -4.34], s: [0.21, 0.035, 0.21], rx: Math.PI / 2, color });
    }
    strips.push({ p: [side * 3.19, 1.97, -5.22], s: [0.035, 3.80, 0.04], color });
    box([side * 5.1, 2.12, -4.55], [0.13, 4.24, 0.13], "#3c4046");
  }
  for (const y of [4.12, 4.43]) box([0, y, -4.55], [10.4, 0.075, 0.095], "#54565b");
  for (let i = 0; i < 26; i++) box([(i - 12.5) * 0.39, 4.27, -4.55], [0.051, 0.49, 0.055], "#484b50", 0, (i % 2 ? 1 : -1) * 0.87);
  // Beyond the deck: a small standing-room club with side galleries, a
  // recessed rear mix position and raked banquettes. Keep the stage centre free.
  box([0,-.78,2.4],[18,.24,19.8],'#443d42');
  for(const side of [-1,1]) {
    const x=side*8.7;
    box([x,2.65,2.1],[.25,6.8,18],'#53494a');
    for(let j=0;j<10;j++){
      const z=-5.75+j*1.69;box([x-side*.16,1.66,z],[.11,2.9,1.44],j%2?'#52444a':'#64534f');
      // Timber acoustic fins, backlit by a single strip for each bay.
      for(let k=0;k<4;k++)box([x-side*.255,1.60,z-.55+k*.33],[.095,2.94,.062],'#a08166');
      strips.push({p:[x-side*.20,3.17,z],s:[.11,.054,1.35],color:concert?'#db9259':'#b19b79'});
    }
    box([side*7.52,2.54,3.8],[2.16,.19,12],'#574b4b');
    box([side*6.48,2.75,3.8],[.11,.31,12],'#6a5c55');
    for(let j=0;j<13;j++)box([side*6.48,3.12,-2.1+j*.98],[.045,.61,.045],'#8d8275');
    box([side*6.48,3.42,3.8],[.068,.066,12.04],'#b8a691');
    for(const z of [-1.9,3.9,9.7]){box([side*6.57,1.01,z],[.19,2.99,.18],'#746557');}
    for(let j=0;j<3;j++) {
      const z=6.85+j*1.25,y=-.52+j*.21;
      box([side*4.15,y,z],[5.45,.26,.92],'#594643');
      box([side*4.15,y+.21,z],[5.22,.17,.54],'#886554');
      box([side*4.15,y+.48,z+.34],[5.22,.48,.12],'#76584c');
    }
  }
  for(let j=0;j<5;j++){const z=-4+j*2.6;box([0,5.85,z],[17.6,.22,.17],'#4a454a');}
  box([0,5.99,2],[17.7,.17,18.6],'#403d46');
  box([0,2.58,10.98],[17.65,6.5,.23],'#594c48');
  box([0,1.51,10.79],[4.10,1.58,.15],'#a68c70');box([0,1.51,10.68],[3.92,1.39,.061],'#394449');
  box([0,.98,9.73],[2.1,.13,.83],'#53545a');box([0,.19,9.94],[1.94,1.45,.43],'#524548');
  for(let i=0;i<13;i++){box([-.86+i*.14,1.058,9.67],[.035,.022,.12],'#a59b85');}
  for(const x of [-.57,.57]){box([x,1.36,9.92],[.68,.43,.075],'#37383f');strips.push({p:[x,1.36,9.873],s:[.60,.34,.006],color:'#576f78'});}
  for(const x of [-6.8,6.8]) {box([x,.64,10.76],[1.35,2.55,.09],'#74665b');box([x+.45,.81,10.69],[.09,.06,.07],'#c0ac85');lamps.push({p:[x,2.11,10.70],s:[.62,.19,.045],color:'#a6ceb3'});}
  for(const w of WEDGES){box([w.x,.16,w.z],[w.w,.32,w.d],'#36393d',w.yaw);
    blocks.push({p:[w.x,.338,w.z],s:[w.w*.94,.08,w.d*.9],ry:w.yaw,rx:-.19,color:'#4f5357'});
     for(let i=0;i<6;i++)box([w.x+(i-2.5)*.1*Math.cos(w.yaw),.39,w.z-(i-2.5)*.1*Math.sin(w.yaw)],[.023,.008,.38],'#33363b',w.yaw);}
  // A compact house kit on a low carpeted riser. Shells, hoops, cymbals and
  // stand hardware share the existing speaker-driver batch.
  const d=BACKLINE.drums,metal='#9ca5a4',shell='#ac6342';
  box([d.x,.085,d.z],[d.w,.17,d.d],'#5c4b48');
  const round=(x:number,y:number,z:number,w:number,h:number,color:string,rx=0)=>cones.push({p:[d.x+x,y,d.z+z],s:[w,h,w],rx,color});
  round(0,.54,.08,.70,.39,shell,Math.PI/2);
  for(const z of [-.13,.29])round(0,.54,z,.72,.038,metal,Math.PI/2);
  round(0,.54,.315,.66,.013,'#dfd6c0',Math.PI/2);round(.14,.43,.328,.12,.015,'#322f30',Math.PI/2);
  for(const [x,z,w,y] of [[-.52,.01,.38,.76],[.54,-.04,.44,.66],[-.17,-.04,.31,.95],[.20,-.04,.34,.9]]){
    round(x,y,z,w,.24,shell);round(x,y+.12,z,w+.025,.021,metal);round(x,y+.135,z,w-.025,.009,'#dbd0bf');round(x,y-.115,z,w+.02,.025,metal);
    for(const sign of [-1,1])round(x+sign*w*.39,y,z+w*.31,.026,.20,metal);
  }
  for(const [x,z,y,w] of [[-.77,-.12,1.37,.44],[.72,-.24,1.52,.57],[-.64,.34,1.03,.33]]){
    round(x,y-.014,z,w,.024,'#d9ad65');round(x,y+.013,z,w*.22,.041,'#bb955a');round(x,(y+.17)/2,z,.029,y-.17,metal);
    for(let i=0;i<3;i++){const a=i*2.094;cones.push(span([d.x+x,.38,d.z+z],[d.x+x+.16*Math.sin(a),.18,d.z+z+.16*Math.cos(a)],.021,metal));}
  }
  // Side-stage electric piano: crossed stand, individual ebony and ivory keys.
  const k=BACKLINE.keys;
  for(const dz of [-.22,.18]) for(const sign of [-1,1])blocks.push(span([k.x-sign*.58,.035,k.z+dz],[k.x+sign*.54,.98,k.z+dz],.055,'#78777c'));
  box([k.x,.985,k.z],[1.62,.14,.58],'#3c3b40');
  for(let i=0;i<35;i++){
    const x=k.x+(i-17)*.042;box([x,1.071,k.z+.12],[.041,.035,.28],'#ebdec6');
    if(i<34&&![2,6].includes(i%7))box([x+.021,1.102,k.z+.065],[.026,.046,.177],'#363237');
  }
  strips.push({p:[k.x-.46,1.06,k.z-.146],s:[.13,.008,.071],color:'#94b8b1'});
  return { blocks, lamps, strips, cones };
}

function stageBoards(){return paintedSurface(1024,1024,g=>{
  const rng=seededRandom(60118),wood=['#917461','#826957','#8b705e','#967965','#886c59'];
  g.fillStyle='#514740';g.fillRect(0,0,1024,1024);
  for(let row=0;row<32;row++)for(let x=-200*rng();x<1024;){const w=166+rng()*173,y=row*32;
    g.fillStyle=wood[Math.floor(rng()*wood.length)];g.fillRect(x+1,y+.8,w-1,30.5);
    g.save();g.beginPath();g.rect(x+1,y+1,w-2,30);g.clip();
    for(let j=0;j<17;j++){const yy=y+2+rng()*28;g.strokeStyle=j%3?'rgba(52,32,22,.13)':'rgba(235,205,165,.19)';g.lineWidth=.6+rng()*.9;
      g.beginPath();g.moveTo(x,yy);g.bezierCurveTo(x+w*.28,yy-3*rng(),x+w*.72,yy+3*rng(),x+w,yy+2*rng()-1);g.stroke();}
    g.restore();x+=w;
  }
  // Small strips of spike tape mark the two sidestage instrument positions.
  for(const p of [BACKLINE.drums,BACKLINE.keys])for(const s of [-1,1]){
    const px=512+(p.x+s*(p.w/2+.09))*1024/LIVE_DECK_SIZE,py=512+(p.z+p.d/2+.09)*1024/LIVE_DECK_SIZE;
    g.fillStyle='#c8b586';g.fillRect(px-8,py,16,2.6);g.fillRect(px-s*8,py-10,2.7,12);
  }
});}

// Bake the light wash into the drape vertices, not a transparent screen quad.
function Cyclorama({ concert }: { concert: boolean }) {
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(6.5, 4.25, 144, 16);
    const pos = geo.attributes.position;
    const colors = pos.clone();
    const base = new Color(concert ? "#332e45" : "#5b5461");
    const amber = new Color(concert ? "#c2886b" : "#837775");
    const blue = new Color(concert ? "#688faa" : "#717e89");
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), h = y / 4.25 + 0.5;
      const fold = Math.sin(x * 17 + 0.22 * Math.sin(x + h * 2));
      pos.setZ(i, 0.044 * fold);
      const wash = (center: number) => Math.exp(-(((x - center) / (1.05 + h * 0.5)) ** 2) - (((h - 0.80) / 0.72) ** 2));
      c.copy(base).lerp(amber, wash(-2.3)).lerp(blue, wash(2.3)).multiplyScalar(0.75 + 0.25 * (fold + 1) * 0.5);
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    geo.setAttribute("color", colors);
    return geo;
  }, [concert]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="woven-backdrop" position={[0, 2.125, -5.32]} geometry={geometry} raycast={() => null}><meshBasicMaterial vertexColors /></mesh>;
}

export function LiveHouse({ concert }: { concert: boolean }) {
  const parts = useMemo(() => architecture(concert), [concert]);
  const boards=useMemo(stageBoards,[]);
  const print=useMemo(()=>paintedSurface(768,128,g=>{g.fillStyle='#302b31';g.fillRect(0,0,768,128);g.strokeStyle='#b69a78';g.strokeRect(8,8,752,112);g.fillStyle='#f1d8a4';g.font='600 54px system-ui';g.textAlign='center';g.fillText('THE LISTENING ROOM',384,82);}),[]);
  useEffect(()=>()=>{print.dispose();boards.dispose();},[print,boards]);
  return <group name="live-house">
    <mesh rotation-x={-Math.PI/2} receiveShadow raycast={noPick}><planeGeometry args={[LIVE_DECK_SIZE,LIVE_DECK_SIZE]}/><meshStandardMaterial map={boards} roughness={.68}/></mesh>
    <Cyclorama concert={concert} />
    <Batch parts={parts.blocks} name="deck-curtains-truss" />
    <Batch parts={parts.cones} name="speaker-drivers" round />
    <Batch parts={parts.lamps} name="stage-practicals" round lit />
    <Batch parts={parts.strips} name="wing-lights" lit />
    <mesh position={[0,5.20,-5.49]} raycast={noPick}><planeGeometry args={[4.8,.8]} /><meshBasicMaterial map={print}/></mesh>
  </group>;
}
