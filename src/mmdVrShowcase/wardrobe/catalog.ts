import type { SkinnedMesh } from 'three';
import { bindSlots } from './slots';
import { wandMorphNames } from '../play/wandResponse';

export type Piece = { key:string; label:string; kind:'clothing'|'accessory'|'morph' };
const normalize=(s:string)=>s.normalize('NFKC').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_\-.\d]+/g,' ').trim();
const wear=/\b(?:shirts?|t\s?shirts?|blouses?|skirts?|dresses|dress|gowns?|jackets?|coats?|sweaters?|hoodies?|uniforms?|costumes?|outfits?|bodysuits?|swimsuits?|bikinis?|leotards?|kimonos?|pants|trousers|shorts|leggings|tights|pantyhose|stockings?|socks?|gloves?|sleeves?|boots?|shoes?|sandals?|underwear|panties|bras?|vests?|aprons?|capes?)\b|スカート|シャツ|ジャケット|ブラウス|ズボン|パンツ|ぱんつ|ショーツ|タイツ|ストッキング|ワンピース|レオタード|ビキニ|コート|ブーツ|ソックス|ドレス|エプロン|裙|裤|褲|衬衫|襯衫|上衣|外套|内衣|內衣|下着|制服|衣装|衣裝|衣服|洋服|水着|泳装|泳裝|胸罩|手套|手袋|靴|鞋|袜|襪|袖|披风|披風|围裙|圍裙|黑丝|黑絲|嗨丝|嗨絲/i;
const accessory=/\b(?:hair\s?(?:pins?|bands?|clips?|bows?|ribbons?|ties|tie)|headbands?|headsets?|headphones?|belts?|buckles?|hats?|caps?|bonnets?|ribbons?|bows?|scarves|scarf|neckties?|ties|earrings?|necklaces?|bracelets?|chokers?|garters?|glasses|goggles|brooch(?:es)?|backpacks?|handbags?)\b|リボン|カチューシャ|イヤリング|ピアス|ベルト|ネクタイ|ネックレス|ヘアピン|眼鏡|眼镜|髪飾|髮飾|发饰|发夹|髮夾|发箍|髮箍|头饰|頭飾|耳饰|耳飾|耳环|耳環|项链|項鏈|首飾|手环|手環|腕輪|腿环|腿環|腰带|腰帶|腰飾|腰饰|领带|領帶|领结|領結|袖扣|帽子|飘带|飄帶|蝴蝶结|蝴蝶結/i;
// Name heuristics are for the SHORT everyday list only. The slot finder can
// inspect and save any drawable source regardless of these labels.
const protectedPart=/\b(?:skin|body|face|eyes?|lashes|mouth|teeth|brows?|hair|nails?|breasts?|nipples?|torso|arms?|legs?|feet|hands?|atlas|merged|baked)\b|肌|皮肤|皮膚|素体|素體|身体|身體|胴体|胴體|顔|脸|臉|瞳|睫|眉|眼球|口内|口內|牙齿|牙齒|舌|乳首|乳頭|乳头|乳房|髪|头发|頭髮|合并|合併/i;
const adornment=/hair\s?(?:pins?|bands?|clips?|bows?|ribbons?|ties|tie)|髪飾り?|髮飾|发饰/gi;
export function wardrobeKind(...labels:unknown[]):Piece['kind']|null {
  const words=labels.filter((v):v is string=>typeof v==='string').map(normalize);
  if(words.some(s=>protectedPart.test(s.replace(adornment,''))))return null;
  return words.some(s=>accessory.test(s))?'accessory':words.some(s=>wear.test(s))?'clothing':null;
}

export function wardrobeCatalog(mesh:SkinnedMesh,slots=bindSlots(mesh)):Piece[] {
  const pieces:Piece[]=[];
  for(const {source:m,key,label} of slots){
    const meta=m.userData.mmdMaterial;
    const kind=wardrobeKind(m.name,meta?.name,meta?.englishName);
    if(kind)pieces.push({key,label,kind});
  }
  for(const key of wandMorphNames(mesh)){
    const index=mesh.morphTargetDictionary![key],meta=mesh.userData.mmdMorphs?.[index];
    if(meta?.type==='vertex'&&wardrobeKind(key,meta.name,meta.englishName))pieces.push({key,label:key,kind:'morph'});
  }
  return pieces;
}
