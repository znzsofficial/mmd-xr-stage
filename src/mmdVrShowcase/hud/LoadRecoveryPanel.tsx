import { useEffect, useMemo, useState } from "react";
import { useLanguageStore } from "../../languageStore";
import { createPanelTexture } from "../../shared/panelTexture";
import { HUD_COLORS } from "./hudAppearance";
import { formatAssetProgress, paginateLoadDetails } from "./loadText";
import { useMmdVrStore } from "../mmdVrStore";
import { PRIVATE_TITLE_FACE } from "../pelvic/palette";
import { HudButton } from "./PorcelainControls";

export function LoadRecoveryPanel({ onExit, onContinue }: { onExit: () => void; onContinue: () => void }) {
  const t = useLanguageStore((s) => s.t);
  const progress = useMmdVrStore((s) => s.assetLoad);
  const physicsBusy = useMmdVrStore((s) => s.physicsBusy);
  const retry = useMmdVrStore((s) => s.retryFailedAssets);
  const [page, setPage] = useState(0);
  const details = progress.running ? progress.fileName : progress.failures.map((failure) => `${failure.fileName}\n${failure.message}`).join("\n\n");
  const pages = useMemo(() => paginateLoadDetails(details), [details]);
  const current = Math.min(page, pages.length - 1);
  const title = formatAssetProgress(progress, t);
  const texture = useMemo(() => createPanelTexture(1280, 420, ({ ctx, width }) => {
    ctx.fillStyle = HUD_COLORS.surface;
    ctx.fillRect(0, 0, width, 420);
    ctx.fillStyle = HUD_COLORS.ink;
    ctx.font = `600 34px ${PRIVATE_TITLE_FACE}`;
    ctx.fillText(title, 32, 50);
    ctx.font = "28px system-ui, sans-serif";
    pages[current].forEach((line, index) => ctx.fillText(line, 32, 112 + index * 48));
    ctx.fillText(`${current + 1}/${pages.length}`, width - 120, 392);
  }, "en"), [title, pages, current]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group>
    <mesh position={[0, 0.13, 0.02]} renderOrder={35}>
      <planeGeometry args={[3.2, 1.05]} />
      <meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
    <HudButton position={[-1.25, -0.5, 0.03]} size={[0.42, 0.13]} label={t("loadPrevious")} disabled={current === 0} onPress={() => setPage(current - 1)} />
    <HudButton position={[-0.78, -0.5, 0.03]} size={[0.42, 0.13]} label={t("loadNext")} disabled={current === pages.length - 1} onPress={() => setPage(current + 1)} />
    <HudButton position={[-0.08, -0.5, 0.03]} size={[0.82, 0.13]} label={t("loadRetry")} disabled={progress.running || physicsBusy} onPress={() => { setPage(0); retry(); }} />
    <HudButton position={[0.7, -0.5, 0.03]} size={[0.66, 0.13]} label={t("loadContinue")} disabled={progress.running} onPress={onContinue} />
    <HudButton position={[1.4, -0.5, 0.03]} size={[0.66, 0.13]} label={t("loadBack")} onPress={onExit} />
  </group>;
}
