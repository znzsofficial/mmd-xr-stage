import { roundRectPath, type PanelPaintContext } from "../shared/panelTexture";

export const HUD_COLORS = Object.freeze({
  surface: "#edf1f6",
  control: "#ffffff",
  border: "#ccd5e2",
  ink: "#172638",
  muted: "#52627a",
  primary: "#244fc5",
  selected: "#dce7ff",
  track: "#a6b5ca",
  danger: "#a52b3d",
  dangerSurface: "#fbe7eb",
  disabled: "#5d6b7f",
});

export function paintHudButton(
  { ctx, width, height }: Pick<PanelPaintContext, "ctx" | "width" | "height">,
  label: string,
  options: { active?: boolean; danger?: boolean; disabled?: boolean; variant?: "button" | "tab" | "quiet" } = {},
) {
  const { active, danger, disabled, variant = "button" } = options;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = disabled ? HUD_COLORS.surface : active ? HUD_COLORS.selected
    : danger ? HUD_COLORS.dangerSurface : variant === "button" ? HUD_COLORS.control : HUD_COLORS.surface;
  ctx.fillRect(0, 0, width, height);
  if (variant === "tab" && active) {
    ctx.fillStyle = HUD_COLORS.primary;
    roundRectPath(ctx, width * 0.25, height - 6, width * 0.5, 4, 2);
    ctx.fill();
  }
  ctx.fillStyle = disabled ? HUD_COLORS.disabled : danger ? HUD_COLORS.danger : active ? HUD_COLORS.primary : HUD_COLORS.ink;
  ctx.font = `${active ? 650 : 550} 31px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, width / 2, height / 2, width - 28);
}
