import { useEffect, useLayoutEffect, useMemo } from 'react';
import { createPanelTexture, type PanelPaintContext } from '../../shared/panelTexture';

export type KeyPainter = (panel:PanelPaintContext)=>void;

/** Each key keeps its canvas and GPU allocation as a ray crosses it. Only the
 * affected key's ink is repainted; the material always displays it untinted. */
export function useHudKeyTexture(width:number, height:number, paint:KeyPainter) {
  const key = useMemo(()=>{
    const target:{panel?:PanelPaintContext}={};
    const map=createPanelTexture(width,height,p=>{target.panel=p;},'en');
    return {map,panel:target.panel};
  },[width,height]);
  useLayoutEffect(()=>{
    if (!key.panel) return;
    key.panel.ctx.clearRect(0,0,width,height);
    paint(key.panel);
    key.map.needsUpdate=true;
  },[key,width,height,paint]);
  useEffect(()=>()=>key.map.dispose(),[key]);
  return key.map;
}
