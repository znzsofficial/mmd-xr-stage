import type { SkinnedMesh } from 'three';
import { wandMorphNames } from './wandResponse';

// Exact authored names only. In particular, `smile skirt`, `Blink material`
// and a Japanese mouth vowel embedded in an unrelated word aren't faces.
const groups = {
  blink: ['まばたき','瞬き','眨眼','閉眼','闭眼','blink','blinking','mabataki','eyesclosed','eyeclose','eyeclosing','closeeyes','eyeblink'],
  wink: ['ウィンク','ウィンク2','ウィンク右','ウィンク2右','wink','wink2','winkl','winkr','winkleft','winkright','blinkleft','blinkright','eyeblinkleft','eyeblinkright'],
  brow: ['困る','困り眉','困惑眉','びっくり','驚き','惊讶','驚訝','surprise','surprised','worried','troubled','browinnerup'],
  mouth: ['あ','お','ああ','张嘴','張嘴','mouthopen','openmouth','jawopen','moutha','moutho'],
  soft: ['なごみ','和み','細目','じと目','眯眼','瞇眼','目細め','halfclosedeyes','eyesquint','relaxedeyes'],
  smile: ['笑い','笑顔','にこり','微笑','笑眼','口角上げ','にやり','smile','happy','laugh','laughing','eyesmile','smileeyes','smilingeyes','mouthsmile'],
} as const;
type Family = keyof typeof groups;
const dictionary = new Map<string,Family>();
for (const family of Object.keys(groups) as Family[]) for (const word of groups[family]) dictionary.set(word,family);
const familyOf = (s:string) => dictionary.get(s.normalize('NFKC').trim().toLowerCase().replace(/[ _.-]/g,''));
const cache = new WeakMap<SkinnedMesh, readonly string[]>();

export function faceMorphNames(mesh: SkinnedMesh): readonly string[] {
  let names = cache.get(mesh);
  if (!names) {
    names = wandMorphNames(mesh).filter(name => {
      const i=mesh.morphTargetDictionary![name], meta=mesh.userData.mmdMorphs?.[i];
      const family=familyOf(name);
      return family && meta?.type==='vertex' && Number.isFinite(mesh.morphTargetInfluences?.[i]) &&
        [meta.name,meta.englishName].every((alias:unknown) => alias==null||typeof alias==='string'&&
          (!alias.trim()||familyOf(alias)||family==='mouth'&&/^[ao]$/i.test(alias.trim())));
    });
    cache.set(mesh,names);
  }
  return names;
}

/** Undefined is automatic, null is explicitly off. Never silently substitute
 * another morph for a player's choice that disappeared on a new instance. */
export function pickFaceMorphs(names: readonly string[], choice: string | null | undefined) {
  if (!names.length || choice === null || choice !== undefined && !names.includes(choice)) return [];
  if (choice !== undefined) return [choice,choice,choice,choice];
  const pick=(...families:Family[]) => {
    for(const family of families){const found=names.find(n=>familyOf(n)===family);if(found)return found;}
    return names[0];
  };
  return [pick('blink','wink','brow'),pick('mouth','brow','wink'),pick('soft','smile','blink'),pick('smile','mouth','soft')];
}
