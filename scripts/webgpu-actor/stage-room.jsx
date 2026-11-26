import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MmdVrPrepApp} from '../../src/mmdVrShowcase/prep/MmdVrPrepApp';
import {useBackpack} from '../../src/mmdVrShowcase/backpack/store';
import {useMmdVrStore} from '../../src/mmdVrShowcase/mmdVrStore';
import '../../src/styles.css';
import {startStageHost} from './stage-host.jsx';

let current,last;
window.stageRoomTest={get status(){return current?.status??last??{phase:'idle'};}};
function App(){
  const entries=useBackpack(s=>s.entries), overlay=useMmdVrStore(s=>s.overlayOpen),busy=useBackpack(s=>s.busy);
  const models=entries.filter(e=>e.kind==='model'), motions=entries.filter(e=>e.kind==='motion');
  const [picked,setPicked]=useState(''),[clip,setClip]=useState(''),[,refresh]=useState(0);
  const model=models.find(e=>e.id===picked)?.id??models[0]?.id??'',motion=motions.find(e=>e.id===clip)?.id??motions[0]?.id??'';
  const update=()=>refresh(n=>n+1);
  function enter(){
    if(current||useMmdVrStore.getState().overlayOpen)return;
    const host=current=startStageHost({model,motion},update);update();
    host.done.finally(()=>{if(current===host){last=host.status;current=null;update();}});
  }
  return <><section style={{padding:'1rem',display:'grid',gap:'.5rem'}}>
    <strong>WebGPU 内部联调 · 摄影地台</strong>
    <label>背包角色 <select id="gpu-model" value={model} disabled={!!current} onChange={e=>setPicked(e.target.value)}>{models.map(e=><option key={e.id} value={e.id}>{e.path}</option>)}</select></label>
    <label>身体动作 <select id="gpu-motion" value={motion} disabled={!!current} onChange={e=>setClip(e.target.value)}>{motions.map(e=><option key={e.id} value={e.id}>{e.path}</option>)}</select></label>
    <div><button id="gpu-enter" disabled={overlay||!!current} onClick={enter}>进入 WebGPU 地台</button> <button id="gpu-exit" disabled={!current} onClick={()=>current?.stop()}>退出</button> <button id="gpu-place" disabled={current?.status.phase!=='active'||busy} onClick={()=>current?.operate('left')}>X · 放下／收回</button> <button id="gpu-play" disabled={current?.status.phase!=='active'||busy} onClick={()=>current?.operate('right')}>A · 播放／暂停</button></div>
    <output>{current?.status.phase==='active'?'Y · 切换角色物理':current?.status.phase??last?.error??last?.phase??'从下方准备页导入'}</output>
  </section><div inert={!!current}><MmdVrPrepApp showOverlay={!current}/></div></>;
}
createRoot(document.getElementById('root')).render(<App/>);
