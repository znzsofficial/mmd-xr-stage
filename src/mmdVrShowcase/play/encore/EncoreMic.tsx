import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, LatheGeometry, Vector2 } from 'three';
import { noPick, paintedSurface } from '../../scenery/sceneryPaint';
import { useStagePlay } from '../stagePlay';
import { ball, box, PaintedParts } from '../modelParts';

// Turn the enamel handle, gold collar and cap in one mesh. Keep the narrow
// part of the handle at the established wrist/palm socket, y = 0 here.
function handleGeometry() {
  const brass = '#e6b778', enamel = '#673747', grip = '#422f40';
  const profile: [number, number, string][] = [
    [0,-.099,brass],[.017,-.099,brass],[.019,-.096,brass],[.019,-.089,brass],
    [.017,-.088,enamel],[.018,-.067,enamel],[.018,-.064,brass],[.018,-.062,enamel],
    [.02,.026,grip],[.023,.043,enamel],[.024,.045,brass],[.024,.052,brass],
    [.022,.053,enamel],[.027,.072,enamel],[.03,.074,brass],[.03,.081,brass],[0,.081,brass],
  ];
  const g = new LatheGeometry(profile.map(([r,y]) => new Vector2(r,y)), 20);
  const colors = new Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3);
  const palette = profile.map(([, , c]) => new Color(c));
  for (let i = 0; i < colors.count; i++) { const c = palette[i % profile.length]; colors.setXYZ(i,c.r,c.g,c.b); }
  g.setAttribute('color',colors);
  const p=new PaintedParts();p.add(g);
  // Recessed thumb slide with a vermilion enamel index and three grip teeth.
  p.add(ball(0,.003,.0195,.009,.024,.0025),'#d4a872');
  p.add(ball(0,.003,.0215,.0068,.019,.0018),'#382f36');
  p.add(box(0,.006,.024,.010,.016,.003),'#ae5362');
  for(const y of [.002,.006,.010])p.add(box(0,y,.026,.008,.0014,.0014),'#e5bd91');
  return p.finish();
}

function grilleTexture() {
  return paintedSurface(256, 128, g => {
    g.fillStyle = '#524c55'; g.fillRect(0,0,256,128);
    // Woven capsule over a dark acoustic liner. Alternate the top wire at
    // the crossing rather than giving a metal shell a flat dot pattern.
    const stroke=(x:number,y:number,w:number,h:number,tint:string,width:number)=>{g.strokeStyle=tint;g.lineWidth=width;g.beginPath();g.moveTo(x,y);g.lineTo(x+w,y+h);g.stroke();};
    for(let x=-144;x<400;x+=12){stroke(x,0,128,128,'#c9bda9',2.7);stroke(x,0,-128,128,'#ddcfb7',2.5);}
    for(let y=0;y<128;y+=12)for(let x=-12;x<264;x+=12)stroke(x-2,y-2,4,4,'#f7e2bc',1.7);
    for (let x=0;x<256;x+=64) { g.fillStyle='#ecce98'; g.fillRect(x-2,0,4,128); }
    g.fillStyle='#382d38'; g.fillRect(0,60,256,9); g.fillStyle='#dfb47c'; g.fillRect(0,61,256,5);
  });
}

// Two swallowtail ribbons from the crimp ring. Wind a half twist into each so
// that they keep their silhouette from side-on. Fixed, short and face-safe.
function ribbonsGeometry() {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const widths = [-1, -.76, .76, 1], steps = 14;
  for (const side of [-1,1]) {
    const start = positions.length / 3;
    const silk = new Color(side === -1 ? '#ca6272' : '#57aaa8'), seam = new Color('#f5c789');
    for (let i=0;i<=steps;i++) {
      const t = i/steps, a = -.24 + t * (side === 1 ? 3.3 : 2.5);
      const x = side*(.019 + .04 * Math.sin(t * 2.5) + t*.012);
      const y = .066 - .122*t, z = -.026*Math.sin(t*5.1 + side*.35);
      for (const w of widths) {
        positions.push(x+w*.009*Math.cos(a), y + (i===steps && Math.abs(w)<1 ? .009 : 0), z + w*.009*Math.sin(a));
        const c = Math.abs(w)===1 ? seam : silk; colors.push(c.r,c.g,c.b);
      }
      if (!i) continue;
      const row = start + i * widths.length;
      for (let j=0;j<3;j++) indices.push(row+j-4,row+j,row+j+1,row+j-4,row+j+1,row+j-3);
    }
  }
  const g = new BufferGeometry(); g.setIndex(indices);
  g.setAttribute('position',new Float32BufferAttribute(positions,3)); g.setAttribute('color',new Float32BufferAttribute(colors,3));
  g.computeVertexNormals(); return g;
}

/** A forward-facing stamp die in the controller; the same handle, untipped
 * and without its ink shoe, is a ribbon microphone for either character wrist. */
export function EncoreMic() {
  const performing = useStagePlay(s => s.character?.toy === 'encore');
  const handle = useMemo(handleGeometry, []), ribbons = useMemo(ribbonsGeometry, []), grille = useMemo(grilleTexture, []);
  useEffect(() => () => { handle.dispose(); ribbons.dispose(); grille.dispose(); }, [handle, ribbons, grille]);
  return <group name="play:piece:encore" pointerEvents="none" position={[0,-.042,-.06]} rotation-x={performing ? -.22 : -.99}>
    <mesh geometry={handle} raycast={noPick}><meshStandardMaterial vertexColors metalness={.32} roughness={.38} /></mesh>
    <mesh geometry={ribbons} raycast={noPick}><meshStandardMaterial vertexColors side={DoubleSide} roughness={.55} /></mesh>
    <mesh name="encore:mic-grille" position-y={.11} scale={[.043,.051,.043]} raycast={noPick}>
      <sphereGeometry args={[1,24,14]} /><meshStandardMaterial map={grille} roughness={.42} metalness={.3} />
    </mesh>
    {!performing && <group name="encore:ink-shoe" position-y={.15}>
      <mesh raycast={noPick}><cylinderGeometry args={[.043,.036,.018,24]} /><meshStandardMaterial color="#d9a86e" roughness={.36} /></mesh>
      <mesh rotation-x={-Math.PI/2} position-y={.0095} raycast={noPick}>
        <ringGeometry args={[.023,.036,24]} /><meshBasicMaterial color="#a84f69" />
      </mesh>
    </group>}
  </group>;
}
