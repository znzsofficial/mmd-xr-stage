// Select authored draws, not texture atlases: lashes, teeth and eye whites
// often use the very same diffuse as the cheeks. Never infer a role from its
// slot number, colour, actor name, or the directory the player imported.
const names = {
  face: /^(?:face|顔|颜|臉|脸|面)(?:skin|肌|皮肤)?$/,
  skin: /^(?:skin|bodyskin|skinbody|肌|皮膚|皮肤|身体肌)$/,
  hair: /^(?:(?:front|back|side)?hair|bangs|髪|前髪|後髪|头发|頭髮|发|髮)(?:alpha|透過|透明)?\d*$/,
  cloth: /^(?:cloth(?:ing)?|fabric|dress|coat|skirt|cape|hood|stockings?|tights|布料?|服装|衣服|裙(?:子|内|內)?|丝袜|絲襪|嗨丝|スカート)\d*$/,
  leather: /^(?:leather(?:gloves?)?|皮革(?:手套)?|革)$/,
  metal: /^(?:metal|metallic|(?:发饰|髮飾)?(?:金属|金屬))$/,
};
const roles = Object.keys(names);
const detail = /eye|iris|pupil|lash|brow|shadow|highlight|mouth|tooth|teeth|tongue|blush|expression|decal|瞳|眼|眉|睫|目|口|嘴|唇|歯|牙|舌|表情|影/u;
const word = v => v.normalize('NFKC').trim().toLowerCase().replace(/^mat(?:erial)?[ _.:-]+|[\s_.:#-]/g,'');
const roleOf = v => roles.find(role => names[role].test(v));
const numberedFace = v => /\d+$/.test(v) && names.face.test(v.replace(/\d+$/, ''));

function authoredRole(meta) {
  const primary = word(meta.name ?? ''), alias = meta.englishName?.normalize('NFKC').trim() ?? '';
  let translated = word(alias);
  // Either label can protect a detail draw. A numbered primary face can
  // denote an eye surround; a generic English "Face" cannot override that.
  if (detail.test(primary) || detail.test(translated) || numberedFace(primary)) return;
  const role = roleOf(primary), duplicate = alias.match(/^(.+)\.\d{3}$/);
  if (duplicate) {
    const stem = word(duplicate[1]);
    // An exporter duplicate can corroborate a role, never supply a missing
    // one or defeat a conflict. This contract is the same for every role.
    if (roleOf(stem)) {
      if (roleOf(stem) !== role) return;
      translated = stem;
    }
  }
  if (numberedFace(translated)) return;
  const other = roleOf(translated);
  if (!role || !other || role === other) return role ?? other;
}

export function inspectActorStyle(model) {
  const hybridSlots = Object.fromEntries(roles.map(role => [role, []]));
  const inputs = [];
  for (const [i, material] of [model.mesh.material].flat().entries()) {
    const meta = material?.userData?.mmdMaterial, map = material?.map;
    if (meta?.materialIndex !== i || !(meta.faceCount > 0)) continue;
    const role = authoredRole(meta);
    if (!role) continue;
    hybridSlots[role].push(i);
    // The base grade works with any diffuse (or just the PMX pigment). Only
    // a matching face/cloth diffuse convention can nominate optional data.
    const base = typeof meta.texturePath === 'string' && meta.texturePath.split(/[\\/]/).at(-1);
    const family = base && base.match(/(?:^|[_-])(face|cloth)(?:[_-]?\d+)?_d\.png$/i)?.[1].toLowerCase();
    if (role === family && map?.image) {
      // Snapshot the decoder inputs before TSL replaces the source materials.
      // No image, live mesh or GPU resource needs to cross the worker boundary.
      inputs.push({ i, role, ref:meta.texturePath, width:map.image.width, height:map.image.height,
        wrapS:map.wrapS, wrapT:map.wrapT, flipY:map.flipY });
    }
  }
  return { hybridSlots, inputs, hasBase:roles.some(role => hybridSlots[role].length > 0) };
}
