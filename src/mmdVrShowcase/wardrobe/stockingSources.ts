import type { Material, SkinnedMesh } from 'three';
import { shownMaterial, shownObject, type StockingDraw } from './stockingDraws';
import { garmentKeys } from './slots';

function surfaceKind(material: Material) {
  const meta = material.userData.mmdMaterial;
  const label = [meta?.name, meta?.englishName, material.name].filter(Boolean).join(' ')
    .normalize('NFKC').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.\d-]/g, ' ');
  // A translated alias like "Body" must not override the author's "boots".
  if (/cloth|suit|dress|skirt|pants?|trouser|legging|shoe|boot|sandal|stockings?|\bstock\b|tights|socks?|\bhose\b|ストッキング|タイツ|ソックス|ズボン|パンツ|ブーツ|スカート|靴|衣|服|裙|鞋|裤|褲|袜|襪|[黑白嗨][丝絲]/i.test(label)) return 'garment';
  if (/leather|metal|plastic|armor|armour|ribbon|band|garter|atlas|リボン|皮革|金属|金屬|塑料|装甲|装饰|配件|飾|带|帶|环|環/i.test(label)) return null;
  if (/\b(?:skin|bare|legs?|thighs?|feet|foot|toes?)\b|肌|皮肤|皮膚|素足|脚部|腿部|大腿|足裏|(?:^|\s)腿(?:\s|$)/i.test(label)) return 'skin';
  if (/\bbody\b|身体|身體|素体|素體|軀體|躯体/i.test(label)) return 'body';
  return null;
}

/** In the absence of a Skin slot, a single author-designated Body can be
 * corroborated by its original weights on both the torso and the fingers.
 * Inspect the slot's index range, never the full (often shared) geometry. */
function wholeBodyPartition(draws: StockingDraw[]) {
  if (!draws.length || new Set(draws.map(d => d.author)).size !== 1 || draws.reduce((n,d) => n+d.end-d.start,0) > 1_200_000) return false;
  const regions = draws[0].body.skeleton.bones.map(b => {
    const name = [b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].join(' ').normalize('NFKC');
    if (/上半身|spine|chest/i.test(name)) return 1;
    if (/指|finger|thumb|index|pinky/i.test(name)) return 2;
    return 0;
  });
  let found = 0;
  for (const draw of draws) {
    const {index,attributes:{skinIndex,skinWeight}} = draw.body.geometry;
    if (!skinIndex || !skinWeight) continue;
    for (let j = draw.start; j < draw.end; j++) {
      const i = index?.getX(j)??j;
      for (let k = 0; k < 4; k++) if (skinWeight.getComponent(i,k) > .3) found |= regions[skinIndex.getComponent(i,k)];
      if (found === 3) return true;
    }
  }
  return false;
}

/** A tear always shows the original surface, including painted shading or
 * clothing. Authored draw partitions can share an atlas. A Body alongside
 * a dedicated Skin (or replacing the model's entire outfit) is ambiguous. */
const sourceCache = new WeakMap<readonly StockingDraw[],{mesh:SkinnedMesh; candidates:readonly StockingDraw[]}>();

export function stockingSourceCandidates(mesh: SkinnedMesh, draws: readonly StockingDraw[]) {
  const known = sourceCache.get(draws);
  if (known?.mesh === mesh) return known.candidates;
  const slots = draws.filter(d => d.body.skeleton === mesh.skeleton).map(draw => ({ draw, kind:surfaceKind(draw.author) }));
  const hasDedicatedSkin = slots.some(s => s.kind === 'skin');
  const bodies = slots.filter(s => s.kind === 'body').map(s => s.draw);
  const allowBody = !hasDedicatedSkin && slots.some(s => s.kind === 'garment') && wholeBodyPartition(bodies);
  const candidates = slots.filter(s => s.kind === 'skin' || (allowBody && s.kind === 'body')).map(s => s.draw);
  sourceCache.set(draws,{mesh,candidates});
  return candidates;
}

export function stockingSources(mesh: SkinnedMesh, draws: readonly StockingDraw[]) {
  const excluded = garmentKeys(mesh);
  return stockingSourceCandidates(mesh,draws).filter(draw => !excluded?.has(draw.key) &&
    shownObject(draw.owner) && shownMaterial(draw.material()));
}
