import { Matrix4, Quaternion, Vector3 } from 'three';
import type { PelvicContact, PelvicFrame, PelvicSolver } from './contract';
import { nozzle, nozzleDir, pelvicCenterline, projectDepth, rod, rodRadii, tangent } from './path';

/** Owner-local history: never share a solver across actors, hands or rails. */
export function createPelvicSolver(): PelvicSolver {
  const shaft = rod.map(() => new Vector3());
  const contact: PelvicContact = { inside:false, outletInside:false, outletVisible:false, atCervix:false, depthM:0, shaftLocal:[], outletLocal:new Vector3() };
  const local = new Matrix4(), dir = new Vector3(), nearest = new Vector3(), t = new Vector3(), delta = new Vector3();
  const worldTip = new Vector3(), anchor = new Vector3(), angle = new Quaternion();
  const prevTip = new Vector3(), prevDir = new Vector3(), prevWorld = new Vector3(), prevAnchor = new Vector3(), prevAngle = new Quaternion();
  let prevLength = 0, prevRadius = 0, valid = false, armed = false;
  function clearContact() { contact.inside = contact.outletInside = contact.outletVisible = contact.atCervix = false; contact.depthM = 0; }
  function reset() { valid = armed = false; clearContact(); contact.shaftLocal = []; contact.outletLocal.set(0,0,0); }

  // The centre of the shaft, not the holder origin, must still pass through
  // the opening. Verify the inserted arc as well: tilting in through the side
  // after legitimate admission must invalidate it without re-arming inside.
  function fits(f: PelvicFrame, scale: number) {
    let reachesOutside = false;
    for (let i = 0; i < shaft.length; i++) {
      const p = shaft[i];
      if (p.z > 0) {
        reachesOutside = true;
        const n = shaft[i+1];
        if (n && n.z <= 0) {
          const k = p.z/(p.z-n.z);
          const r = rodRadii[i] + k*(rodRadii[i+1]-rodRadii[i]);
          if (Math.hypot(p.x+k*(n.x-p.x),p.y+k*(n.y-p.y)) + r*scale > f.radiusM*1.22) return false;
        }
        continue;
      }
      const d = projectDepth(f,p);
      pelvicCenterline(f,d,nearest);
      if (d > f.lengthM) nearest.addScaledVector(tangent(f,d,t),d-f.lengthM);
      if (nearest.distanceTo(p) + rodRadii[i]*scale > f.radiusM*1.22) return false;
    }
    return reachesOutside;
  }

  return { reset, step(f, pieceWorld, input) {
    if (!f || !pieceWorld || !pieceWorld.elements.every(Number.isFinite) || !(pieceWorld.determinant() > 0)) { reset(); return contact; }
    local.multiplyMatrices(f.inverse,pieceWorld);
    shaft.forEach((p,i) => p.copy(rod[i]).applyMatrix4(local));
    contact.shaftLocal = shaft;
    const tip = contact.outletLocal.copy(nozzle).applyMatrix4(local);
    dir.copy(nozzleDir).transformDirection(local);
    if (input.blocked || !(input.dt > 0) || !Number.isFinite(input.dt)) { valid = armed = false; clearContact(); return contact; }
    worldTip.copy(nozzle).applyMatrix4(pieceWorld); anchor.setFromMatrixPosition(f.world); angle.setFromRotationMatrix(f.world);
    const stepM = Math.min(.075, .012+2.8*input.dt);
    const continuous = valid && input.dt <= .12 && tip.distanceTo(prevTip) <= stepM && worldTip.distanceTo(prevWorld) <= stepM
      && anchor.distanceTo(prevAnchor) <= stepM && Math.abs(angle.dot(prevAngle)) >= .94 && dir.dot(prevDir) >= .72
      && Math.abs(f.lengthM-prevLength) < 1e-6 && Math.abs(f.radiusM-prevRadius) < 1e-6;
    if (!continuous) { armed = false; clearContact(); }

    const d = projectDepth(f,tip), inLine = dir.dot(tangent(f,d,t));
    const rim = Math.min(.004, f.radiusM*.14), pieceScale = pieceWorld.getMaxScaleOnAxis();
    if (contact.inside) {
      if (tip.z > rim || inLine < .67 || (tip.z >= 0 && Math.hypot(tip.x,tip.y) > f.radiusM) || !fits(f,pieceScale)) clearContact();
    } else if (continuous && armed && prevTip.z >= 0 && tip.z <= 0 && prevTip.z > tip.z) {
      const k = prevTip.z/(prevTip.z-tip.z);
      delta.subVectors(tip,prevTip);
      // Intersection within this frame, not just a tip that ends near the axis.
      const radial = Math.hypot(prevTip.x+k*delta.x,prevTip.y+k*delta.y);
      if (radial <= f.radiusM*.85 && -delta.z >= .63*delta.length() && -prevDir.z >= .78 && inLine >= .78 && fits(f,pieceScale)) contact.inside = true;
    }
    if (tip.z >= rim) armed = !contact.inside && -dir.z >= .78;
    else if (tip.z <= 0) armed = false;
    if (contact.inside) {
      contact.depthM = Math.max(0,Math.min(d,f.lengthM));
      contact.atCervix = d >= f.lengthM - 1e-5;
      // Contact has exit hysteresis. Routing liquid does not: even a fraction
      // outside the rim (or physically beyond the stop) is not an internal dose.
      contact.outletInside = d > 1e-6 && d <= f.lengthM+1e-6;
    }
    // No accepted path is not evidence of a *visible exterior* outlet. A
    // reacquired nozzle buried inside the section (or pushed behind its stop)
    // can neither emit exterior particles nor fill a vessel. Being lateral to
    // the canal behind the opening is not evidence of being outside the actor.
    // Only positive clearance on the exposed side counts as visible here.
    contact.outletVisible = !contact.outletInside && tip.z > 1e-6;
    valid = true; prevTip.copy(tip); prevWorld.copy(worldTip); prevAnchor.copy(anchor); prevAngle.copy(angle); prevDir.copy(dir);
    prevLength = f.lengthM; prevRadius = f.radiusM;
    return contact;
  } };
}
