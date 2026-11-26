// A translucent fringe over an opaque face still produces an opaque final pixel.
// Find the projected hair from its own draw, and locate visible eyes by toggling
// them behind it. All controls reuse this actor, evaluated pose and camera.
export function measureFringe(draws, {hairSlots, eyeSlots}, total, draw, full) {
  for (const list of [hairSlots, eyeSlots]) {
    if (!Array.isArray(list) || !list.length || list.some(i => !Number.isInteger(i) || i < 0 || i >= total)) throw Error('Invalid hair/eye material slots');
  }
  if (hairSlots.some(i => eyeSlots.includes(i))) throw Error('Hair and eye slots must be distinct');
  const select = (keep, hideEdge = false) => {
    for (const [m, {slot, edge, visible}] of draws) m.visible = visible && keep(slot) && !(hideEdge && edge);
    return draw();
  };
  try {
    const hair = select(i => hairSlots.includes(i), true);
    const withoutHair = select(i => !hairSlots.includes(i));
    const withoutBoth = select(i => !hairSlots.includes(i) && !eyeSlots.includes(i));
    const withoutEyes = select(i => !eyeSlots.includes(i));
    let partialHair = 0, eyePixels = 0, overlap = 0, changedOverlap = 0, bothVisible = 0, colorDelta = 0;
    const mask = new Uint8Array(full.length / 4), hairAlpha=new Uint8Array(mask.length);
    const delta = (a, b, j) => Math.max(Math.abs(a[j]-b[j]), Math.abs(a[j+1]-b[j+1]),
      Math.abs(a[j+2]-b[j+2]), Math.abs(a[j+3]-b[j+3]));
    for (let j = 0; j < full.length; j += 4) {
      const partial = hair[j+3] >= 8 && hair[j+3] <= 247;
      hairAlpha[j/4]=hair[j+3];
      const eye = delta(withoutHair, withoutBoth, j) > 6;
      if (partial) partialHair++;
      if (eye) eyePixels++;
      if (partial && eye) {
        mask[j/4] = 1; overlap++;
        const change = delta(full, withoutHair, j);
        colorDelta += change;
        if (change > 6) {
          changedOverlap++;
          if (delta(full,withoutEyes,j)>6) bothVisible++;
        }
      }
    }
    return {mask, hairAlpha, stats:{partialHair, eyePixels, overlap, changedOverlap, bothVisible, meanChange:overlap?+(colorDelta/overlap).toFixed(2):null}};
  } finally { for (const [m, {visible}] of draws) m.visible = visible; }
}
