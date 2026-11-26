// Select authored draws, not texture atlases: lashes, teeth and eye whites
// often use the very same diffuse as the cheeks. Never infer a role from its
// slot number, colour, actor name, or the directory the player imported.
const names = {
  face: /^(?:face|顔|颜|臉|脸|面)(?:skin|肌|皮肤)?$/,
  skin: /^(?:skin|bodyskin|skinbody|肌|皮膚|皮肤|身体肌)$/,
  hair: /^(?:(?:front|back|side)?hair|bangs|髪|前髪|後髪|头发|頭髮|发|髮)(?:alpha|透過|透明)?$/,
  cloth: /^(?:cloth(?:ing)?|fabric|dress|coat|skirt|cape|hood|布料?|服装|衣服|裙|スカート)$/,
  leather: /^(?:leather|皮革|革)$/,
  metal: /^(?:metal|metallic|金属|金屬)$/,
};
const roles = Object.keys(names);
const detail = /eye|iris|pupil|lash|brow|shadow|highlight|mouth|tooth|teeth|tongue|blush|expression|decal|瞳|眼|眉|睫|目|口|歯|牙|舌|表情|影/iu;
function namedRole(label) {
  const word = label.normalize('NFKC').toLowerCase().replace(/(?:^mat(?:erial)?[ _.:-]+)|[\s_.:#\d-]/g,'');
  return roles.find(role => names[role].test(word));
}

export function inspectActorStyle(model) {
  const hybridSlots = Object.fromEntries(roles.map(role => [role, []]));
  const inputs = [];
  for (const [i, material] of [model.mesh.material].flat().entries()) {
    const meta = material?.userData?.mmdMaterial, map = material?.map;
    if (typeof meta?.texturePath !== 'string' || meta.materialIndex !== i || !(meta.faceCount > 0) || !map?.image) continue;
    const labels = [meta.name, meta.englishName].filter(v => typeof v === 'string' && v.trim());
    if (labels.some(v => detail.test(v))) continue;
    const kinds = new Set(labels.map(namedRole).filter(Boolean));
    if (kinds.size !== 1) continue;
    const [role] = kinds;
    // A named surface and its authored diffuse family must agree. A generic
    // Body atlas is not evidence of skin unless the material itself says skin.
    const base = meta.texturePath.split(/[\\/]/).at(-1);
    const family = base.match(/(?:^|[_-])(face|body|skin|hair|cloth|leather|metal)(?:[_-]?\d+)?_d\.png$/i)?.[1].toLowerCase();
    if (!(role === family || (role === 'skin' && family === 'body') || (role === 'leather' && family === 'cloth'))) continue;
    hybridSlots[role].push(i);
    if (role === 'cloth' || role === 'face') {
      // Snapshot the decoder inputs before TSL replaces the source materials.
      // No image, live mesh or GPU resource needs to cross the worker boundary.
      inputs.push({ i, role, ref:meta.texturePath, width:map.image.width, height:map.image.height,
        wrapS:map.wrapS, wrapT:map.wrapT, flipY:map.flipY });
    }
  }
  return { hybridSlots, inputs };
}
