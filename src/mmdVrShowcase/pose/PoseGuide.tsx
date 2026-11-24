import { useImperativeHandle, useLayoutEffect, useMemo, useRef, type Ref } from 'react';
import { CanvasTexture, Group, LinearFilter, Mesh, SRGBColorSpace, Vector3 } from 'three';
import { HUD_COLORS as color } from '../hud/hudAppearance';
import type { PoseKey } from './poseSession';
import { usePoseText } from './poseText';

export type PoseGuideUpdate = (root: Group, key: PoseKey, joint: Group, start?: Vector3, target?: Vector3) => void;
const up = new Vector3(0,1,0), noPick = () => {};

/** The joint registration mark stays on the solved bone. A diamond travels with
 * the requested centre, so a fully extended limb never masquerades as a hit. */
export function PoseGuide({ref}: {ref: Ref<PoseGuideUpdate>}) {
  const t = usePoseText(), label = useRef<Mesh>(null), goal = useRef<Group>(null), stem = useRef<Mesh>(null), origin = useRef<Mesh>(null);
  const badge = useMemo(() => {
    const c = document.createElement('canvas'); c.width=384; c.height=80;
    const ctx = c.getContext('2d')!, texture = new CanvasTexture(c); texture.colorSpace=SRGBColorSpace;
    texture.generateMipmaps=false; texture.minFilter=LinearFilter;
    return { texture, paint(text:string) {
      ctx.clearRect(0,0,c.width,c.height); ctx.font='550 48px system-ui, sans-serif';
      const w=Math.min(380,ctx.measureText(text).width+28);
      ctx.fillStyle=color.surface; ctx.beginPath(); ctx.roundRect((384-w)/2,4,w,72,12); ctx.fill();
      ctx.lineWidth=2;ctx.strokeStyle=color.border;ctx.stroke();
      ctx.fillStyle=color.ink; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,192,40,354);
      texture.needsUpdate=true;
    }};
  },[]);
  const diff = useMemo(() => new Vector3(),[]);
  const lastPrint=useRef({text:'',time:0});
  useLayoutEffect(() => () => badge.texture.dispose(),[badge]);
  useImperativeHandle(ref,() => (root,key,joint,start,target) => {
    const dot=goal.current!, line=stem.current!, tick=origin.current!, name=label.current!, scale=joint.scale.x;
    dot.visible=!!target; line.visible=false; tick.visible=false; let gap=0;
    if (target) {
      root.worldToLocal(dot.position.copy(target)); dot.quaternion.copy(joint.quaternion); dot.scale.setScalar(scale);
      if (start) {
        root.worldToLocal(tick.position.copy(start)); tick.quaternion.copy(joint.quaternion); tick.scale.setScalar(scale);
        tick.visible=tick.position.distanceToSquared(joint.position)>(scale*.9)**2;
      }
      diff.subVectors(dot.position,joint.position); gap=diff.length(); line.visible=gap>scale*.75;
      dot.visible=!!start || line.visible;
      if (line.visible) { line.position.copy(joint.position).addScaledVector(diff,.5); line.scale.set(scale*.065,gap,scale*.065); line.quaternion.setFromUnitVectors(up,diff.normalize()); }
    }
    const error = gap>.005 ? ` · ${Math.round(gap*100)} cm` : '';
    const text=t.labels[key]+error, now=performance.now(), last=lastPrint.current;
    if (text!==last.text && (!target || !last.text.startsWith(t.labels[key]) || now-last.time>120)) {
      badge.paint(text); last.text=text; last.time=now;
    }
    name.quaternion.copy(joint.quaternion); name.scale.setScalar(scale);
    name.position.set(0,start?1.95:3.8,0).multiplyScalar(scale).applyQuaternion(joint.quaternion).add(joint.position);
  },[badge,diff,t]);
  return <group pointerEvents="none">
    <mesh ref={label} name="pose:joint-label" raycast={noPick} renderOrder={14}><planeGeometry args={[8.64,1.8]}/><meshBasicMaterial map={badge.texture} transparent depthWrite={false} depthTest={false} toneMapped={false} fog={false}/></mesh>
    <mesh ref={origin} name="pose:start" visible={false} raycast={noPick} renderOrder={9}><ringGeometry args={[.22,.35,20]}/><meshBasicMaterial color={color.ink} depthWrite={false} depthTest={false} toneMapped={false}/></mesh>
    <mesh ref={stem} name="pose:reach-gap" visible={false} raycast={noPick} renderOrder={10}><cylinderGeometry args={[1,1,1,5]}/><meshBasicMaterial color={color.primary} depthWrite={false} depthTest={false} toneMapped={false}/></mesh>
    <group ref={goal} name="pose:target" visible={false}>
      <mesh raycast={noPick} renderOrder={12}><ringGeometry args={[.87,1.21,4]}/><meshBasicMaterial color={color.surface} depthWrite={false} depthTest={false} toneMapped={false}/></mesh>
      <mesh raycast={noPick} renderOrder={13}><ringGeometry args={[.94,1.11,4]}/><meshBasicMaterial color={color.primary} depthWrite={false} depthTest={false} toneMapped={false}/></mesh>
    </group>
  </group>;
}
