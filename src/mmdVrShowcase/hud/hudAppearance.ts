import { roundRectPath, type PanelPaintContext } from "../../shared/panelTexture";
import { PRIVATE_COLORS as c, buttonInks, type ButtonState } from "../pelvic/palette";

export const HUD_COLORS = Object.freeze({
  surface: c.paper, control: c.control, border: c.rule, ink: c.ink, muted: c.muted,
  primary: c.gold, selected: c.selected, track: c.rule, fill: c.rouge,
  danger: c.danger, dangerSurface: c.dangerFill, disabled: c.disabled,
});

export function paintHudButton(
  { ctx, width, height }: Pick<PanelPaintContext, "ctx" | "width" | "height">,
  label: string,
  options: ButtonState = {},
) {
  const { face, letters, edge } = buttonInks(options);
  ctx.clearRect(0, 0, width, height);
  // Inset the chamfered rule inside the existing rounded hit geometry.
  const cut = height * .16, pad = 2;
  ctx.beginPath(); ctx.moveTo(cut, pad); ctx.lineTo(width-cut, pad);
  ctx.quadraticCurveTo(width-pad, pad, width-pad, cut); ctx.lineTo(width-pad, height-cut);
  ctx.lineTo(width-cut, height-pad); ctx.lineTo(cut, height-pad);
  ctx.quadraticCurveTo(pad, height-pad, pad, height-cut); ctx.lineTo(pad, cut); ctx.closePath();
  ctx.fillStyle = face; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 2;
  if (options.disabled) ctx.setLineDash([6, 4]);
  ctx.stroke(); ctx.setLineDash([]);
  if (options.variant === "tab" && options.active && !options.disabled) {
    ctx.fillStyle = HUD_COLORS.primary;
    roundRectPath(ctx, width * 0.25, height - 6, width * 0.5, 4, 2);
    ctx.fill();
  }
  ctx.fillStyle = letters;
  ctx.font = `${options.active || options.variant === 'primary' ? 650 : 550} 31px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, width / 2, height / 2, width - 28);
}
