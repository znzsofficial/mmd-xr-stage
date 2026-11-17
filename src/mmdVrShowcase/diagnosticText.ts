import type { TranslationKey } from "../languageStore";
import type { RenderDiagnostics } from "./renderDiagnostics";
import { formatFrameRateLabel, type ImmersiveFrameRate } from "../xr/qualityAxes";

export function diagnosticLines(data: RenderDiagnostics | null, t: (key: TranslationKey) => string, language: "zh" | "en") {
  if (!data?.active) return [t("diagWaiting")];
  const unknown = t("diagUnknown");
  const onOff = (value: boolean | null) => value === null ? unknown : value ? t("diagOn") : t("diagOff");
  const requestedRate = / Hz$/.test(data.requested.frameRate) ? data.requested.frameRate : formatFrameRateLabel(data.requested.frameRate as ImmersiveFrameRate, language);
  return [
    `${t("diagRequested")}: ${requestedRate} · AA ${onOff(data.requested.antialias)}`,
    `${t("diagRequestedScale")}: ${data.requested.framebufferScale ?? t("diagDefault")} / ${data.requested.foveation ?? t("diagDefault")}`,
    `${t("diagRefresh")}: ${data.refreshRate == null ? unknown : `${data.refreshRate} Hz`}`,
    `${t("diagMeasured")}: ${data.fps == null ? unknown : `${data.fps} FPS · ${data.frameIntervalMs} ms`}`,
    `${t("diagLayer")}: ${data.layer} · ${data.width == null || data.height == null ? unknown : `${data.width} × ${data.height}`}`,
    `${t("diagLayerAA")}: ${onOff(data.layerAntialias)} · ${t("diagSamples")}: ${data.targetSamples ?? unknown}`,
    `${t("diagFoveation")}: ${data.foveation ?? unknown}`,
    `${t("diagDrawCalls")}: ${data.drawCalls ?? unknown} / ${data.triangles ?? unknown}`,
    `${t("diagResources")}: ${data.textures ?? unknown} / ${data.geometries ?? unknown}`,
    `${t("diagModelCpu")}: ${data.modelUpdateCpuMs == null ? unknown : data.modelUpdateCpuMs.toFixed(2)} / ${data.modelUpdateCpuMaxMs == null ? unknown : data.modelUpdateCpuMaxMs.toFixed(2)} ms`,
  ];
}
