import { CanvasTexture, SRGBColorSpace } from 'three';

export const noPick = () => null;
export function paintedSurface(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d'); if (g) paint(g);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}
