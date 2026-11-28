import type { MmdPhysicsJoint, MmdPhysicsRigidBody, MmdPhysicsStepContext } from '@yohawing/three-mmd-loader/physics';

// The single-precision Bullet joint solver drops rows with an effective
// inverse mass <= FLT_EPSILON. Against a static anchor the dynamic root can
// be the sole contributor on a linear axis.
const inverseEpsilon = 2 ** 23;

function isFixedLink(joint: MmdPhysicsJoint) {
  const {linearLimit, angularLimit, spring} = joint;
  // Omitted limits and spring factors upload as zero in the native backend.
  return [linearLimit?.lower, linearLimit?.upper, angularLimit?.lower, angularLimit?.upper,
    spring?.linear, spring?.angular].every(axis => !axis || axis.every(value => value === 0));
}

// Fail the whole strand on a branch, cross-link, second anchor or driven
// body. Conditioning just a prefix would change its authored joint ratios.
function fixedTaper(bodies: readonly MmdPhysicsRigidBody[], links: MmdPhysicsJoint[][], root: number, anchor: MmdPhysicsJoint) {
  const strand: number[] = [];
  let index = root, incoming = anchor, previousMass = Infinity;
  while (isFixedLink(incoming)) {
    const body = bodies[index], mass = body.mass ?? 0, edges = links[index];
    if (body.motionType !== 'dynamic' || !(mass > 0 && mass < previousMass) || edges.length > 2) return null;
    strand.push(index);
    if (edges.length === 1) return strand.length >= 2 ? strand : null;
    incoming = edges[0] === incoming ? edges[1] : edges[0];
    index = incoming.rigidBodyIndexA === index ? incoming.rigidBodyIndexB : incoming.rigidBodyIndexA;
    previousMass = mass;
  }
  return null;
}

function conditionMasses(bodies: readonly MmdPhysicsRigidBody[], joints: readonly MmdPhysicsJoint[]) {
  if (!bodies.some(body => body.motionType === 'dynamic' && (body.mass ?? 0) >= inverseEpsilon)) return bodies;

  const links: MmdPhysicsJoint[][] = bodies.map(() => []);
  for (const joint of joints) {
    const {rigidBodyIndexA: a, rigidBodyIndexB: b} = joint;
    if (!links[a] || !links[b]) return bodies;
    links[a].push(joint);
    links[b].push(joint);
  }

  let result: MmdPhysicsRigidBody[] | undefined;
  for (const anchorLink of joints) {
    const {rigidBodyIndexA: a, rigidBodyIndexB: b} = anchorLink;
    const root = bodies[a].motionType === 'static' ? b : bodies[b].motionType === 'static' ? a : -1;
    if (root < 0 || bodies[root].motionType !== 'dynamic') continue;
    const rootMass = bodies[root].mass ?? 0;
    if (rootMass < inverseEpsilon || !Number.isFinite(rootMass)) continue;

    const strand = fixedTaper(bodies, links, root, anchorLink);
    if (!strand) continue;
    // Two epsilons of inverse mass at the root. Scale the tip by the same
    // factor only if its inverse mass remains representable in Bullet.
    const scale = (inverseEpsilon / 2) / rootMass;
    const tipMass = bodies[strand[strand.length - 1]].mass! * scale;
    if (!Number.isFinite(Math.fround(1 / tipMass))) continue;
    result ??= bodies.slice();
    for (const i of strand) result[i] = {...bodies[i], mass: bodies[i].mass! * scale};
  }
  return result ?? bodies;
}

/** Cache immutable definitions per actor world. Run on authored topology,
 * before a renderer can omit cloth or XR can append contact bodies. */
export function createAnchoredChainMassInput() {
  let source: MmdPhysicsStepContext['rigidBodies'], joints: MmdPhysicsStepContext['joints'];
  let conditioned: typeof source;
  return (context: MmdPhysicsStepContext): MmdPhysicsStepContext => {
    if (source !== context.rigidBodies || joints !== context.joints) {
      source = context.rigidBodies;
      joints = context.joints;
      conditioned = source && joints?.length ? conditionMasses(source, joints) : source;
    }
    return conditioned === source ? context : {...context, rigidBodies: conditioned};
  };
}
