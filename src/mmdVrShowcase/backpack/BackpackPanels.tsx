import { useMemo, useState } from "react";
import { useLanguageStore } from "../../languageStore";
import { useBackpack, type BackpackEntry } from "./store";
import { isSoloFloorSession, stageAssetLimit } from "./sessionAssets";
import { useMmdVrStore } from "../mmdVrStore";
import { SCENERY, mainSceneryIds } from "../scenery/catalog";
import {webgpuRooms,fitsWebgpuRoom} from '../xr/floorBackend';
import { HudButton, HudLine, HudSheet } from "../hud/PorcelainControls";
import { BackpackThumbnail, indexBackpackCovers } from "./BackpackThumbnail";
import { useXRInputSourceState } from '@react-three/xr';
import { shelfToys, toyLabel, TOYS, type Hand, type Toy } from '../play/propCatalog';
import { useStagePlay } from '../play/stagePlay';
import { clearCard, useLunarCard } from '../play/lunarCard';
import { resetEncore } from '../play/encore/encoreRound';

export function SceneryPanel({ onClose, onSelected, locked }: { onClose: () => void; onSelected: () => void; locked: boolean }) {
  const t = useLanguageStore(s => s.t);
  const current = useMmdVrStore(s => s.prefs.scenery);
  // Keep even the last set in the reading zone when using a seated eye height.
  const layouts=useBackpack(s=>s.layouts), solo=isSoloFloorSession(), rooms=solo?webgpuRooms:mainSceneryIds;
  const cols=3, rows=Math.ceil(rooms.length/cols), height=.48+.23*rows, top=height/2;
  return <group name="hud-scenery">
    <HudSheet size={[2.90,height]} />
    <HudLine position={[-.91,top-.19,0]} text={t("hudScenery")} width={0.86} role="title" />
    <HudButton position={[1.02,top-.19,0]} label={t("hudBack")} size={[0.65,0.14]} onPress={onClose} variant="quiet" />
    {rooms.map((id, i) => <HudButton key={id} position={[(i % cols - 1) * .94,top-.47-Math.floor(i/cols)*.23,0]}
      label={t(SCENERY[id].label)} active={id === current} disabled={locked || (solo && !fitsWebgpuRoom(layouts[id]))} size={[0.86, 0.17]} onPress={() => {
        if (useMmdVrStore.getState().prefs.scenery !== id) useMmdVrStore.getState().setPrefs({ scenery: id });
        onSelected();
      }} />)}
  </group>;
}

const kinds = { model: "hudCharacters", object: "hudObjects", motion: "hudMotions" } as const;
const pagesByKind = {...kinds, toy:'hudToys'} as const;
const ROWS = 3;

export function fileSource(entry: BackpackEntry) {
  const path = entry.path.replace(/\\/g, "/");
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

export function PageControls({ page, count, onPage, y, spread = 0.68 }: { page: number; count: number; onPage: (p: number) => void; y: number; spread?: number }) {
  const t = useLanguageStore(s => s.t);
  if (count <= 1) return null;
  return <group position-y={y}>
    <HudButton position={[-spread, 0, 0]} label={t("loadPrevious")} disabled={page === 0} size={[0.4, 0.13]} onPress={() => onPage(page - 1)} />
    <HudLine position={[0, 0, 0]} text={`${page + 1} / ${count}`} width={0.35} center />
    <HudButton position={[spread, 0, 0]} label={t("loadNext")} disabled={page + 1 >= count} size={[0.4, 0.13]} onPress={() => onPage(page + 1)} />
  </group>;
}

export function BackpackPanel({ onClose, locked }: { onClose: () => void; locked: boolean }) {
  const t = useLanguageStore(s => s.t);
  const entries = useBackpack(s => s.entries), live = useBackpack(s => s.live);
  const files = useBackpack(s => s.files), coverFor = useMemo(() => indexBackpackCovers(files), [files]);
  const [kind, setKind] = useState<keyof typeof pagesByKind>("model"), [index, setIndex] = useState(0);
  const list = useMemo(() => entries.filter(e => e.kind === kind), [entries, kind]);
  const used = list.filter(e => live[e.id]).length;
  const limit = stageAssetLimit(kind === 'model' ? 'model' : 'object');
  const full = used >= limit;
  const pages = Math.max(1, Math.ceil(list.length / ROWS)), page = Math.min(index, pages - 1);
  const hint = kind === "motion" ? t("hudApplyFromCharacter") : `${t("hudOnStage")} ${used} / ${limit}${full ? ` · ${t("hudReturnFirst")}` : ""}`;
  return <group name="hud-backpack">
    <HudSheet size={[2.24,1.72]} />
    <HudLine position={[-0.49, 0.69, 0]} text={t("hudBackpack")} role="title" width={1.05} />
    <HudButton position={[0.67, 0.69, 0]} size={[0.66, 0.14]} variant="quiet" label={t("hudBack")} onPress={onClose} />
    {(Object.keys(pagesByKind) as (keyof typeof pagesByKind)[]).map((k, i) => <HudButton key={k} position={[(i - 1.5) * 0.52, 0.45, 0]} size={[0.49, 0.16]}
      label={t(pagesByKind[k])} active={k === kind} variant="tab" disabled={isSoloFloorSession() && (k === 'object' || k === 'toy')} onPress={() => { setKind(k); setIndex(0); }} />)}
    {kind==='toy'?<ToyShelf locked={locked} onClose={onClose}/>:<>
    <HudLine position={[0, 0.26, 0]} text={hint} width={2.04} role={full && kind !== "motion" ? "warning" : "muted"} />
    {!list.length && <HudLine position={[0, -0.15, 0]} text={t("hudBagEmpty")} width={2.02} center />}
    {list.slice(page * ROWS, (page + 1) * ROWS).map((entry, i) => {
      const instance = live[entry.id];
      const state = instance ? t(instance.visible ? "hudOnStage" : "hudOnStageHidden") : t("hudInBag");
      return <group key={entry.id} position-y={0.055 - i * 0.245}>
        <BackpackThumbnail kind={entry.kind} cover={coverFor(entry)} />
        <HudLine position={[-0.16, 0.036, 0]} text={entry.file.name} width={1.28} />
        <HudLine position={[-0.16, -0.053, 0]} text={`${fileSource(entry) || t("hudLooseFile")} · ${state}${entry.warning ? ` · ${entry.warning}` : ""}`} width={1.28} role={entry.warning ? "warning" : "muted"} />
        {kind !== "motion" && <HudButton position={[0.78, 0, 0]} size={[0.46, 0.15]} label={t(instance ? "hudSelect" : "hudPlace")} disabled={locked || (!instance && full)}
          onPress={() => {
            const bag = useBackpack.getState();
            if (bag.live[entry.id]) bag.select(entry.id); else bag.beginPlace(entry.id);
            const after = useBackpack.getState();
            if (after.selected === entry.id || after.draft === entry.id) onClose();
          }} />}
      </group>;
    })}
    <PageControls page={page} count={pages} onPage={setIndex} y={-0.68} />
    </>}
  </group>;
}

function ToyShelf({locked,onClose}:{locked:boolean;onClose:()=>void}) {
  const t=useLanguageStore(s=>s.t),room=useMmdVrStore(s=>s.prefs.scenery),held=useStagePlay(s=>s.held),n=useLunarCard(s=>s.stamps.length);
  const left=useXRInputSourceState('controller','left'),right=useXRInputSourceState('controller','right');
  const characterHasToy=useStagePlay(s=>!!(s.character||s.stand));
  const connected=(h:Hand)=>!!(h==='left'?left:right)?.inputSource.gripSpace;
  const [help,setHelp]=useState<Toy|null>(null);
  const [page,setPage]=useState(0), pages=Math.ceil(shelfToys.length/ROWS);
  if(help){const item=TOYS[help],{vr,end}=item.guide;return <group key="guide" name={`play:guide:${help}`}>
    <HudLine position={[0,.22,0]} text={t(toyLabel(help,room))+' · '+t('toyGuide')} width={2.03} role="title"/>
    <HudLine position={[0,.08,0]} text={t('toyShelfHome')+t(item.homeLabel)} width={2.03} role="muted"/>
    {(help==='remoteEgg'?['toyGuideEquip',vr,end] as const:['toyGuideEquip','toyGuideGive',vr,end] as const).map((key,i)=><HudLine key={key} position={[0,-.06-i*.128,0]} text={t(key)} width={2.03}/>)}
    <HudLine position={[0,-.59,0]} text={`B → ${t('hudBackpack')} → ${t('hudToys')} → ${t('toyStow')}`} width={2.03}/>
    <HudButton position={[-.49,-.755,0]} size={[.89,.16]} label={t('toyCloseGuide')} onPress={()=>setHelp(null)}/>
    {item.home&&room!==item.home&&<HudButton position={[.49,-.755,0]} size={[.89,.16]} label={t(item.visit)} variant="quiet" disabled={locked} onPress={()=>{setHelp(null);useMmdVrStore.getState().setPrefs({scenery:item.home});}}/>}
  </group>}
  return <group name="play:shelf">
    <HudLine position={[0,.24,0]} text={t(left||right?'toyShelfRule':'toyNeedController')} width={2.04} role="muted" />
    {shelfToys.slice(page*ROWS,(page+1)*ROWS).map((toy,i)=>{const {home,homeLabel}=TOYS[toy];
      return <group name={`play:shelf:${toy}`} key={toy} position-y={.05-i*.205}>
        <HudLine position={[-.63,.041,0]} width={.84} text={t(toyLabel(toy,room))} />
        <HudLine position={[-.63,-.044,0]} width={.84} text={t('toyShelfHome')+t(homeLabel)+(toy==='post'&&room===home?` · ${n}/3`:'')} role="muted" />
        {(['left','right'] as const).map((hand,j)=><HudButton key={hand} position={[.02+j*.43,0,0]} size={[.40,.15]} active={held?.toy===toy&&held.hand===hand} label={t(hand==='left'?'toyLeft':'toyRight')} disabled={locked||!connected(hand)} onPress={()=>{useStagePlay.getState().equip(toy,hand);onClose();}}/>)}
        <HudButton position={[.88,0,0]} size={[.36,.145]} variant="quiet" label={t('toyGuide')} onPress={()=>setHelp(toy)}/>
      </group>;})}
    <PageControls page={page} count={pages} onPage={setPage} y={-.55} />
    <HudButton position={[-.46,-.75,0]} size={[.83,.15]} disabled={locked||(!held&&!characterHasToy)} label={t('toyStow')} onPress={()=>{useStagePlay.getState().stow();onClose();}} />
    {room==='liveHouse'?<HudButton position={[.49,-.75,0]} size={[.83,.15]} disabled={locked} label={t('storyClear')} onPress={resetEncore}/>:
      room==='floor'&&<HudButton position={[.49,-.75,0]} size={[.83,.15]} disabled={locked||!n} label={t('toyNewCard')} onPress={clearCard} />}
  </group>;
}
