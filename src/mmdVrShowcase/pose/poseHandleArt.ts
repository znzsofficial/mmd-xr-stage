import { CanvasTexture, SRGBColorSpace } from 'three';
import { HUD_COLORS } from '../hudAppearance';

/** World-space registration marks: open center so the underlying joint
 * remains visible. One textured quad per control, independent of stage exposure. */
export function poseHandleArt(selected: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.translate(128,128);
  const stroke = (r: number, ink: string, width: number) => {
    c.strokeStyle = ink; c.lineWidth = width; c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.stroke();
  };
  if (selected) {
    stroke(96,HUD_COLORS.surface,12); stroke(96,HUD_COLORS.ink,7); stroke(96,HUD_COLORS.primary,3);
    for (let n=0;n<4;n++) {
      c.fillStyle = HUD_COLORS.surface; c.fillRect(-4,-107,8,17);
      c.fillStyle = HUD_COLORS.ink; c.fillRect(-2,-104,4,12); c.rotate(Math.PI / 2);
    }
  }
  stroke(29,HUD_COLORS.surface,16); stroke(29,HUD_COLORS.ink,10);
  if (selected) stroke(29,HUD_COLORS.primary,5);
  c.fillStyle = selected ? HUD_COLORS.primary : HUD_COLORS.ink;
  c.beginPath(); c.arc(0,0,6,0,Math.PI*2); c.fill();
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}
