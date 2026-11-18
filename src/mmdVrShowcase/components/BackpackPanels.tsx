import { useMemo, useState } from "react";
import { useLanguageStore } from "../../languageStore";
import { useBackpack, type BackpackEntry } from "../backpack";
import { MMD_VR_MAX_MODELS, MMD_VR_MAX_OBJECTS } from "../mmdVrAssets";
import { useMmdVrStore } from "../mmdVrStore";
import { SCENERY, sceneryIds } from "../scenery/catalog";
import { HudButton, HudLine, HudSheet } from "./PorcelainControls";
import { BackpackThumbnail, indexBackpackCovers } from "./BackpackThumbnail";

export function SceneryPanel({ onClose, onSelected, locked }: { onClose: () => void; onSelected: () => void; locked: boolean }) {
  const t = useLanguageStore(s => s.t);
  const current = useMmdVrStore(s => s.prefs.scenery);
  return <group name="hud-scenery">
    <HudSheet size={[1.98, 1.07]} />
    <HudLine position={[-0.48, 0.37, 0]} text={t("hudScenery")} width={0.8} role="title" />
    <HudButton position={[0.57, 0.37, 0]} label={t("hudBack")} size={[0.65, 0.14]} onPress={onClose} variant="quiet" />
    {sceneryIds.map((id, i) => <HudButton key={id} position={[(i % 2 - 0.5) * 0.92, 0.13 - Math.floor(i / 2) * 0.23, 0]}
      label={t(SCENERY[id].label)} active={id === current} disabled={locked} size={[0.86, 0.17]} onPress={() => {
        if (useMmdVrStore.getState().prefs.scenery !== id) useMmdVrStore.getState().setPrefs({ scenery: id });
        onSelected();
      }} />)}
  </group>;
}

const kinds = { model: "hudCharacters", object: "hudObjects", motion: "hudMotions" } as const;
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
  const [kind, setKind] = useState<BackpackEntry["kind"]>("model"), [index, setIndex] = useState(0);
  const list = useMemo(() => entries.filter(e => e.kind === kind), [entries, kind]);
  const used = list.filter(e => live[e.id]).length;
  const limit = kind === "model" ? MMD_VR_MAX_MODELS : MMD_VR_MAX_OBJECTS;
  const full = used >= limit;
  const pages = Math.max(1, Math.ceil(list.length / ROWS)), page = Math.min(index, pages - 1);
  const hint = kind === "motion" ? t("hudApplyFromCharacter") : `${t("hudOnStage")} ${used} / ${limit}${full ? ` · ${t("hudReturnFirst")}` : ""}`;
  return <group name="hud-backpack">
    <HudSheet size={[2.24, 1.72]} />
    <HudLine position={[-0.49, 0.69, 0]} text={t("hudBackpack")} role="title" width={1.05} />
    <HudButton position={[0.67, 0.69, 0]} size={[0.66, 0.14]} variant="quiet" label={t("hudBack")} onPress={onClose} />
    {(Object.keys(kinds) as BackpackEntry["kind"][]).map((k, i) => <HudButton key={k} position={[(i - 1) * 0.69, 0.45, 0]} size={[0.64, 0.16]}
      label={t(kinds[k])} active={k === kind} variant="tab" onPress={() => { setKind(k); setIndex(0); }} />)}
    <HudLine position={[0, 0.26, 0]} text={hint} width={2.04} role={full && kind !== "motion" ? "warning" : "muted"} />
    {!list.length && <HudLine position={[0, -0.15, 0]} text={t("hudBagEmpty")} width={2.02} center />}
    {list.slice(page * ROWS, (page + 1) * ROWS).map((entry, i) => {
      const instance = live[entry.id];
      const state = instance ? t(instance.visible ? "hudOnStage" : "hudOnStageHidden") : t("hudInBag");
      return <group key={entry.id} position-y={0.055 - i * 0.245}>
        <BackpackThumbnail kind={kind} cover={coverFor(entry)} />
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
  </group>;
}
