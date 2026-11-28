export type ChartPoint = { u: number; v: number };
type Interval = { from: number; to: number };
const directions = 8;
const epsilon = 1e-6; // shared PMX seams may differ by a few float ULPs

/** Slice actual chart triangles along eight meridians. Long sparse faces
 * count throughout their interior; two distant rings never fill the gap. */
export function stockingCoverage() {
  const lines: Interval[][] = Array.from({ length: directions }, () => []);
  function add(points: readonly ChartPoint[]) {
    const [a,b,c] = points;
    const low = Math.min(a.u,b.u,c.u), high = Math.max(a.u,b.u,c.u);
    for (let k = Math.ceil(low * directions - .5); k <= Math.floor(high * directions - .5); k++) {
      const u = (k + .5) / directions;
      let from = Infinity, to = -Infinity;
      for (let j = 0; j < 3; j++) {
        const p = points[j], q = points[(j+1)%3];
        if ((p.u <= u) === (q.u <= u)) continue;
        const v = p.v + (q.v-p.v) * ((u-p.u)/(q.u-p.u));
        from = Math.min(from,v); to = Math.max(to,v);
      }
      from = Math.max(0,from); to = Math.min(1,to);
      if (to > from) lines[k % directions].push({ from, to });
    }
  }

  function longest(ankleV: number, minimumLegSpan: number) {
    const ends: { v: number; delta: number }[] = [];
    for (const line of lines) {
      let span: Interval | undefined;
      for (const interval of line.sort((a,b) => a.from-b.from)) {
        if (!span || interval.from > span.to + epsilon) {
          if (span) ends.push({v:span.from,delta:1}, {v:span.to,delta:-1});
          span = {...interval};
        } else span.to = Math.max(span.to, interval.to);
      }
      if (span) ends.push({v:span.from,delta:1}, {v:span.to,delta:-1});
    }
    // Count directions, not faces (overlapping material splits can otherwise
    // make a single side look like a whole leg). Exclude the foot from length.
    let count = 0, from = 0, footFrom = 0, best: (Interval & { footFrom: number }) | undefined, bestLegSpan = 0;
    for (const end of ends.sort((a,b) => a.v-b.v || b.delta-a.delta)) {
      const before = count; count += end.delta;
      // The dorsum can be an open sheet. Two meridians reaching up into
      // the proven tube allow that original sheet, but not a detached toe.
      if (before < 2 && count >= 2) footFrom = end.v;
      if (before < 5 && count >= 5) from = end.v;
      if (before >= 5 && count < 5) {
        const legSpan = end.v - Math.max(from, ankleV);
        if (legSpan >= minimumLegSpan && legSpan > bestLegSpan) {
          bestLegSpan = legSpan; best = {from, to:end.v, footFrom};
        }
      }
    }
    return best;
  }
  return { add, longest };
}
