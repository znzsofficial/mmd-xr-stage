// Drive a selected actor on an existing Chinese screen stage or stereo IWER
// fixture. No store access, synthetic React callbacks or second renderer.
// XR needs the release fixture's qa.click (real trigger) and qa.all (visible
// objects). `capture`, if supplied, saves the stage or both eyes locally.
export async function observationReferenceFlow(page,{xr=false,capture=async()=>{}}={}){
  const press=async name=>{
    if(xr){await page.waitForFunction(n=>qa.ui().includes('hud:'+n),name);await page.evaluate(n=>qa.click('hud:'+n),name);}
    else await page.getByRole('button',{name,exact:true}).click();
  };
  async function frame(id,degrees,section){
    const result=await page.waitForFunction(({xr,id,degrees,section})=>{
      const canvas=xr?qa.all().map(n=>n.material?.map?.image).find(c=>c?.dataset?.view===id):document.querySelector(`.observation-art[aria-busy="false"] canvas[data-view="${id}"]`);
      if(!canvas||degrees!==undefined&&Number(canvas.dataset.angle)!==degrees||section!==undefined&&canvas.dataset.section!==String(section))return false;
      const tile=document.createElement('canvas');tile.width=80;tile.height=52;const ctx=tile.getContext('2d');ctx.drawImage(canvas,0,0,80,52);
      const bytes=ctx.getImageData(0,0,80,52).data;let digest=2166136261,lit=0;
      for(let i=0;i<bytes.length;i+=4){if(bytes[i]>80)lit++;for(let j=0;j<3;j++)digest=Math.imul(digest^bytes[i+j],16777619);}
      return {id,angle:Number(canvas.dataset.angle),caption:canvas.getAttribute('aria-label'),section:canvas.dataset.section,digest:digest>>>0,lit};
    },{xr,id,degrees,section},{timeout:15000,polling:100});
    try{return await result.jsonValue();}finally{await result.dispose();}
  }
  const rows=[],take=async(id,angle,cut)=>{const r=await frame(id,angle,cut);rows.push(r);await capture(`${id}-${r.angle}${cut?'-section':''}`);return r;};
  const turns=[['正面',0],['斜面',38],['侧面',90]];
  async function turnsOf(id,cut){const hashes=[];for(const [label,angle] of turns){await press(label);const r=await take(id,angle,cut);if(r.lit<200)throw Error('Empty plate: '+id);hashes.push(r.digest);}
    if(new Set(hashes).size!==3)throw Error('Orbit did not change all three pictures: '+id);return hashes;}
  await press('身体观察');await frame('breast');await press('孕态参考');await press('子宫');await turnsOf('reference-uterus');
  await press('乳房');const opening=await frame('reference-breast');if(opening.section==='true')await press('剖面');
  const skin=await turnsOf('reference-breast',false);await press('剖面');const cut=await turnsOf('reference-breast',true);
  if(cut.some((x,i)=>x===skin[i]))throw Error('Cutaway did not change the reference');await press('剖面');
  for(const [part,id] of [['阴道','vagina'],['外阴','vulva']]){await press(part);await press('斜面');await take('reference-context-'+id,38);await press('日常观察');await take(id,38);await press('孕态参考');}
  await press('卵子');const egg=await take('egg');await press('日常观察');const daily=await frame('egg');if(daily.caption!==egg.caption)throw Error('Egg record changed');
  await press('孕态参考');await press('返回角色');await press('身体观察');await frame('breast');await press('返回角色');
  await press('互动');await press('插入');await take('uterus');
  if(xr?await page.evaluate(()=>qa.ui().includes('hud:孕态参考')):await page.getByRole('button',{name:'孕态参考',exact:true}).count())throw Error('Reference selector leaked into insertion');
  return rows;
}
