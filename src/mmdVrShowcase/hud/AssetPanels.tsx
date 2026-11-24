import { useEffect, useState } from "react";
import { useLanguageStore } from "../../languageStore";
import { useBackpack } from "../backpack/store";
import {
  formatMmdVrModelScale,
  mmdVrModelScaleToSlider,
  mmdVrSliderToModelScale,
} from "../settings/mmdVrAdjustments";
import { useMmdVrStore, type MmdVrModelEntry, type MmdVrObjectEntry } from "../mmdVrStore";
import { HudSlider, ValueLabel } from "./HudValues";
import { HudButton } from "./PorcelainControls";

function shortName(name: string, max = 8) {
  const base = name.replace(/\.[^.]+$/, "");
  if (base.length <= max) return base;
  return `${base.slice(0, max - 1)}…`;
}

export function AssetEditPanel({ asset, kind, editsLocked, onInteractionChange }: {
  asset: MmdVrModelEntry | MmdVrObjectEntry;
  kind: "model" | "object";
  editsLocked: boolean;
  onInteractionChange: (active: boolean) => void;
}) {
  const t = useLanguageStore((s) => s.t);
  const runtimeId = asset.id;
  const assetId = useBackpack(s => Object.keys(s.live).find(id => s.live[id].runtimeId === runtimeId));
  const enqueueVisibilityToggle = useMmdVrStore((s) => s.enqueueVisibilityToggle);
  const requestModelScale = useMmdVrStore((s) => s.requestModelScale);
  const requestModelRotation = useMmdVrStore((s) => s.requestModelRotation);
  const requestModelReset = useMmdVrStore((s) => s.requestModelReset);
  const enqueueModelRemoval = useMmdVrStore((s) => s.enqueueModelRemoval);
  const setMaterialPanelModelId = useMmdVrStore((s) => s.setMaterialPanelModelId);
  const hasMaterials = useMmdVrStore((s) => (s.materialModels[runtimeId]?.length ?? 0) > 0);
  const actionY = kind === "model" ? -0.27 : -0.31;

  return (
    <group position={[0, -0.23, 0.02]} scale={1.2}>
      <ValueLabel position={[0, 0.34, 0]} label={shortName(asset.name, 14)} value={asset.visible ? "●" : "○"} />
      <HudButton
        position={[-0.25, 0.19, 0]}
        label={t(asset.visible ? "settingsMmdVrHideModel" : "settingsMmdVrShowModel")}
        disabled={editsLocked}
        size={[0.42, 0.11]}
        onPress={() => enqueueVisibilityToggle(runtimeId)}
      />
      <HudButton position={[0.25, 0.19, 0]} size={[0.42, 0.13]} label={t("settingsMmdVrPlaceOff")} disabled={editsLocked || !assetId}
        onPress={() => { if (assetId) useBackpack.getState().beginPlace(assetId); }} />
      <ValueLabel position={[0, 0.02, 0]} label={t("settingsMmdVrModelScale")} value={formatMmdVrModelScale(asset.scale)} />
      <HudSlider
        position={[0, -0.12, 0]}
        value={mmdVrModelScaleToSlider(asset.scale)}
        disabled={editsLocked}
        onChange={(value) => requestModelScale(runtimeId, mmdVrSliderToModelScale(value))}
        onInteractionChange={onInteractionChange}
      />
      <HudButton position={[-0.36, actionY, 0]} label={t("settingsMmdVrRotateLeft")} size={[0.22, 0.1]} disabled={editsLocked} onPress={() => requestModelRotation(runtimeId, asset.rotationY - 15)} />
      <HudButton position={[-0.12, actionY, 0]} label={t("settingsMmdVrValueReset")} size={[0.22, 0.1]} disabled={editsLocked} onPress={() => requestModelReset(runtimeId)} />
      <HudButton position={[0.12, actionY, 0]} label={t("settingsMmdVrRotateRight")} size={[0.22, 0.1]} disabled={editsLocked} onPress={() => requestModelRotation(runtimeId, asset.rotationY + 15)} />
      <HudButton position={[0.36, actionY, 0]} label={t("settingsMmdVrRemoveModel")} size={[0.22, 0.1]} disabled={editsLocked} danger onPress={() => enqueueModelRemoval(runtimeId)} />
      {kind === "model" && <HudButton
        position={[0, -0.46, 0]}
        label={t("settingsMmdVrMaterials")}
        size={[0.42, 0.08]}
        disabled={!hasMaterials}
        onPress={() => setMaterialPanelModelId(runtimeId)}
      />}
    </group>
  );
}

export function MaterialPanel({
  hideLabel,
  showLabel,
  materialsLabel,
  opacityLabel,
  emissionLabel,
  closeLabel,
  disabled,
  onInteractionChange,
}: {
  hideLabel: string;
  showLabel: string;
  materialsLabel: string;
  opacityLabel: string;
  emissionLabel: string;
  closeLabel: string;
  disabled: boolean;
  onInteractionChange: (active: boolean) => void;
}) {
  const modelId = useMmdVrStore((s) => s.materialPanelModelId);
  const setModelId = useMmdVrStore((s) => s.setMaterialPanelModelId);
  const model = useMmdVrStore((s) => s.models.find((m) => m.id === modelId));
  const materials = useMmdVrStore((s) => (modelId ? s.materialModels[modelId] ?? [] : []));
  const setMaterialVisible = useMmdVrStore((s) => s.setMaterialVisible);
  const setMaterialParam = useMmdVrStore((s) => s.setMaterialParam);
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedMat, setSelectedMat] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => { setView("list"); setSelectedMat(null); setPage(0); }, [modelId]);

  if (!modelId || !model) return null;
  const selectedState = materials.find((m) => m.name === selectedMat) ?? null;
  const perPage = 4;
  const pageCount = Math.max(1, Math.ceil(materials.length / perPage));
  const curPage = Math.min(page, pageCount - 1);
  const slice = materials.slice(curPage * perPage, curPage * perPage + perPage);

  return (
    <group position={[0, -0.12, 0.02]}>
      <HudButton position={[-0.65, 0.38, 0]} label={view === "detail" ? materialsLabel : closeLabel} size={[0.42, 0.14]} onPress={() => {
        if (view === "detail") { setView("list"); setSelectedMat(null); }
        else setModelId(null);
      }} />
      <ValueLabel position={[0.1, 0.38, 0]} label={view === "detail" ? shortName(selectedMat ?? "", 16) : `${materialsLabel}: ${shortName(model.name, 12)}`} value="" />
      {view === "list" ? (
        <>
          {slice.map((mat, i) => {
            const y = 0.17 - i * 0.18;
            return (
              <group key={mat.name}>
                <HudButton
                  position={[-0.56, y, 0]}
                  label={mat.visible ? hideLabel : showLabel}
                  size={[0.27, 0.14]}
                  active={mat.visible}
                  disabled={disabled}
                  onPress={() => setMaterialVisible(modelId, mat.name, !mat.visible)}
                />
                <HudButton
                  position={[0.1, y, 0]}
                  label={shortName(mat.name, 14)}
                  size={[0.92, 0.14]}
                  onPress={() => { setSelectedMat(mat.name); setView("detail"); }}
                />
              </group>
            );
          })}
          {pageCount > 1 ? (
            <>
              <HudButton position={[-0.36, -0.6, 0]} label="‹" size={[0.3, 0.14]} disabled={curPage === 0} onPress={() => setPage(Math.max(0, curPage - 1))} />
              <ValueLabel position={[0, -0.6, 0]} label={`${curPage + 1}/${pageCount}`} value="" size={[0.3, 0.14]} centered />
              <HudButton position={[0.36, -0.6, 0]} label="›" size={[0.3, 0.14]} disabled={curPage >= pageCount - 1} onPress={() => setPage(Math.min(pageCount - 1, curPage + 1))} />
            </>
          ) : null}
        </>
      ) : selectedState ? (
        <>
          <ValueLabel position={[-0.5, 0.25, 0]} label={opacityLabel} value={selectedState.opacity.toFixed(2)} />
          <HudSlider position={[0.1, 0.25, 0]} width={0.6} value={selectedState.opacity} onChange={(v) => setMaterialParam(modelId, selectedState.name, "opacity", v)} onInteractionChange={onInteractionChange} disabled={disabled} />
          <ValueLabel position={[-0.5, -0.23, 0]} label={emissionLabel} value={selectedState.emission.toFixed(2)} />
          <HudSlider position={[0.1, -0.23, 0]} width={0.6} value={Math.min(1, selectedState.emission / 2)} onChange={(v) => setMaterialParam(modelId, selectedState.name, "emission", v * 2)} onInteractionChange={onInteractionChange} disabled={disabled} />
          <HudButton position={[-0.3, -0.48, 0]} label={selectedState.visible ? hideLabel : showLabel} size={[0.22, 0.08]} active={selectedState.visible} disabled={disabled} onPress={() => setMaterialVisible(modelId, selectedState.name, !selectedState.visible)} />
        </>
      ) : null}
    </group>
  );
}
