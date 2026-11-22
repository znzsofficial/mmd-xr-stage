import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPanelTexture } from '../../shared/panelTexture';
import { useLanguageStore } from '../../languageStore';
import { drawPelvicSection, sectionLayout, SECTION_H, SECTION_W } from './sectionPaint';
import { usePelvic } from './store';

export type PelvicActor = { assetId:string; runtimeId:string };
type PaintTarget = () => HTMLCanvasElement|null;
const width = SECTION_W*2, height = SECTION_H*2;

/** Only the local canvas repaints. The store already limits position updates
 * to 10 Hz and publishes outlet transitions immediately. A second timer here
 * would leave the picture one beat behind the accepted dose. */
function useSectionCanvas({assetId,runtimeId}:PelvicActor, target:PaintTarget, dirty?:()=>void) {
  const zh=useLanguageStore(s=>s.language==='zh');
  useLayoutEffect(()=>{
    const canvas=target(), ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
    let cache:ReturnType<typeof sectionLayout>|undefined, lastLength=0,lastRadius=0;
    function paint() {
      const {active,sample,byAsset}=usePelvic.getState(),profile=byAsset[assetId];
      if(!profile||!ctx||!canvas)return;
      const actual=active?.assetId===assetId&&active.runtimeId===runtimeId?sample:null;
      const lengthM=actual?.lengthM??profile.calibration.lengthM, radiusM=actual?.radiusM??profile.calibration.radiusM;
      if(!cache||lengthM!==lastLength||radiusM!==lastRadius) {
        cache=sectionLayout(lengthM,radiusM);lastLength=lengthM;lastRadius=radiusM;
      }
      const alt=drawPelvicSection(ctx,cache,profile,actual,zh);
      canvas.setAttribute('aria-label',`${zh?'骨盆矢状剖面':'Pelvic sagittal section'} · ${alt}`);dirty?.();
    }
    paint();
    const unsub=usePelvic.subscribe((s,p)=>{
      if(s.sample===p.sample&&s.byAsset[assetId]===p.byAsset[assetId]&&s.active?.token===p.active?.token)return;
      paint();
    });
    return unsub;
  },[assetId,runtimeId,zh,target,dirty]);
}

export function PelvicScreenSection(actor:PelvicActor) {
  const ref=useRef<HTMLCanvasElement>(null);
  const [target]=useState(()=>()=>ref.current);
  useSectionCanvas(actor,target);
  return <canvas className="pelvic-section" ref={ref} width={width} height={height} role="img"/>;
}

/** The HUD and the world plate reuse the same projection; neither owns a
 * camera, ray target, session, nor solver. Exactly one atlas per mounted mesh. */
export function PelvicHudSection({widthM,...actor}:PelvicActor&{widthM:number}) {
  const [texture]=useState(()=>createPanelTexture(width,height,()=>{},'en'));
  const [target]=useState(()=>()=>texture.image as HTMLCanvasElement);
  const [dirty]=useState(()=>()=>{texture.needsUpdate=true;});
  useSectionCanvas(actor,target,dirty);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh name="pelvic:sagittal-section" pointerEvents="none" raycast={()=>null} renderOrder={30}>
    <planeGeometry args={[widthM,widthM*height/width]}/>
    <meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false}/>
  </mesh>;
}

/** Unscaled world metres. The caller supplies the actor-following billboard
 * and suppresses it while the same actor's section is on the XR tool sheet. */
export function PelvicLiveSection(actor:PelvicActor) {
  const visible=usePelvic(s=>s.active?.assetId===actor.assetId&&s.active?.runtimeId===actor.runtimeId&&!!s.byAsset[actor.assetId]&&!!s.sample);
  return visible?<PelvicHudSection {...actor} widthM={.42}/>:null;
}
