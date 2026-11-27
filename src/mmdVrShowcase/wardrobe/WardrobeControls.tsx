import { useId, useState } from 'react';
import { HudButton, HudLine, HudSheet } from '../hud/PorcelainControls';
import type { WardrobeProps } from './actions';
import { useWardrobe } from './useWardrobe';
import { SlotFinder } from './SlotFinder';
import { StockingControls } from './StockingControls';
import './wardrobe.css';

function Screen(props:WardrobeProps){
  const w=useWardrobe(props),{l}=w,id=useId();
  const [expanded,expand]=useState<string|null>(null),[detail,open]=useState<'finder'|'stockings'|null>(null);
  if(detail==='finder'&&w.model)return <SlotFinder {...props} model={w.model} onBack={()=>open(null)}/>;
  if(detail==='stockings')return <StockingControls {...props} available={w.available} onBack={()=>open(null)}/>;
  return <div className="wardrobe-screen" role="group" aria-label={w.title}>
    <header><h3>{w.title}</h3><button type="button" onClick={props.onBack}>{w.back}</button></header>
    <nav aria-label={l('衣柜分类','Wardrobe categories')}>{w.types.map(k=><button type="button" key={k} aria-pressed={w.kind===k} onClick={()=>w.setKind(k)}>{w.labels[k]}</button>)}
      <button type="button" disabled={!w.available} onClick={()=>open('stockings')}>{l('黑色长筒袜','Black thigh-highs')}</button></nav>
    {w.items.length?<ul className="wardrobe-pieces">{w.items.map((p,i)=>{
      const row=`${p.kind}:${p.key}`,open=expanded===row,{mat,weight,percent}=w.values(p);
      const verb=mat?(mat.visible?l('隐藏','Hide'):l('显示','Show')):weight===null?l('启用','Apply'):l('随动作','Release');
      return <li key={row}>
        <div className="wardrobe-row">
          <button type="button" className="wardrobe-piece" aria-expanded={open} aria-controls={`${id}-${i}`} onClick={()=>{w.choose(p);expand(open?null:row);}}>
            <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="m5.5 3.5 4.5 4.5-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span>{p.label}</span></button>
          <button type="button" className="wardrobe-switch" aria-label={`${verb}: ${p.label}`} onClick={()=>w.toggle(p)}>{verb}</button>
        </div>
        <div id={`${id}-${i}`} hidden={!open}>{open&&<label className="wardrobe-range"><span>{w.field}<output>{percent}%</output></span>
          <input aria-label={`${p.label} · ${w.field}`} type="range" min="0" max="100" step="1" value={percent} disabled={mat?.visible===false} onChange={e=>w.setPercent(p,e.currentTarget.valueAsNumber)}/></label>}</div>
      </li>;
    })}</ul>:<p role="status">{w.empty}</p>}
    <footer><button type="button" disabled={!w.modified} onClick={()=>w.restore('original')}>{l('恢复原装','Original outfit')}</button>
      <button type="button" disabled={!w.undo} onClick={()=>w.restore('undo')}>{l('撤销衣柜改动','Undo wardrobe edits')}</button></footer>
    <button type="button" disabled={!w.available} onClick={()=>open('finder')}>{w.finder}</button><p className="wardrobe-note">{w.note}</p>
  </div>;
}

function Hud(props:WardrobeProps){
  const w=useWardrobe(props),{l}=w,width=1.64,[detail,open]=useState<'finder'|'stockings'|null>(null);
  if(detail==='finder'&&w.model)return <SlotFinder {...props} hud model={w.model} onBack={()=>open(null)}/>;
  if(detail==='stockings')return <StockingControls {...props} hud available={w.available} onBack={()=>open(null)}/>;
  return <group name="wardrobe-hud"><HudSheet size={[1.78,1.54]}/>
    <HudLine position={[-.31,.59,0]} width={1} text={w.title} role="title"/>
    <HudButton position={[.52,.59,0]} size={[.62,.145]} label={w.back} onPress={props.onBack} variant="quiet"/>
    {w.types.map((k,i)=><HudButton key={k} position={[(i-1)*.56,.39,0]} size={[.53,.15]} label={w.labels[k]} active={w.kind===k} variant="tab" onPress={()=>w.setKind(k)}/>)}
    {w.piece?<group key={`${w.kind}:${w.piece.key}`}>
      <HudButton position={[-.62,.18,0]} size={[.39,.14]} label={l('上一件','Previous')} disabled={!w.index} onPress={()=>w.choose(w.items[w.index-1])}/>
      <HudLine position={[0,.18,0]} width={.72} center text={`${w.index+1} / ${w.items.length}`}/>
      <HudButton position={[.62,.18,0]} size={[.39,.14]} label={l('下一件','Next')} disabled={w.index===w.items.length-1} onPress={()=>w.choose(w.items[w.index+1])}/>
      <HudLine position={[0,.025,0]} width={width} role="title" text={w.piece.label}/>
      <HudButton position={[-.45,-.14,0]} size={[.73,.15]} label={w.mat?(w.mat.visible?l('隐藏此件','Hide item'):l('显示此件','Show item')):l('随模型动作','Follow animation')}
        disabled={!w.mat&&w.weight===null} onPress={()=>w.mat?w.toggle(w.piece):w.follow(w.piece)}/>
      <HudLine position={[.41,-.14,0]} width={.78} text={`${w.field}  ${w.percent}%`} center/>
      <HudButton position={[.20,-.31,0]} size={[.38,.14]} label="−10%" disabled={!w.percent||w.mat?.visible===false} onPress={()=>w.setPercent(w.piece,Math.max(0,w.percent-10))}/>
      <HudButton position={[.62,-.31,0]} size={[.38,.14]} label="+10%" disabled={w.percent===100||w.mat?.visible===false} onPress={()=>w.setPercent(w.piece,Math.min(100,w.percent+10))}/>
    </group>:<HudLine position={[0,0,0]} width={width} text={w.empty} center/>}
    <HudButton position={[-.42,-.492,0]} size={[.80,.14]} label={l('恢复原装','Original outfit')} disabled={!w.modified} onPress={()=>w.restore('original')}/>
    <HudButton position={[.42,-.492,0]} size={[.80,.14]} label={l('撤销衣柜改动','Undo wardrobe edits')} disabled={!w.undo} onPress={()=>w.restore('undo')}/>
    <HudButton position={[-.42,-.664,0]} size={[.80,.14]} label={l('黑色长筒袜','Black thigh-highs')} disabled={!w.available} onPress={()=>open('stockings')}/>
    <HudButton position={[.42,-.664,0]} size={[.80,.14]} variant="quiet" label={w.finder} disabled={!w.available} onPress={()=>open('finder')}/>
  </group>;
}

export function WardrobeScreenControls(props:WardrobeProps){return <Screen key={`${props.assetId}:${props.runtimeId}`} {...props}/>;}
export function WardrobeHudControls(props:WardrobeProps){return <Hud key={`${props.assetId}:${props.runtimeId}`} {...props}/>;}
