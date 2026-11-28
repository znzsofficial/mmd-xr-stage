// Local +Z points out of the shop toward the pavement. The buildings close
// the long views along the street and form the opposite sides of the venues.
export const streetPlots=[
  // Front x/z, rotation, frontage, depth, eaves, upper floors, facade, joinery, name, trading line.
  [-24.1,93.55,Math.PI,10.3,6.4,6.40,1,'#d9cbb3','#5e8982','潮汐器材社','LIDO SUPPLY  /  SWIM & SAIL'],
  [-14.15,94.00,Math.PI,8.5,5.8,4.25,0,'#c49177','#466c64','帆布工房','HARBOUR CANVAS  /  SAIL LOFT'],
  [-4.10,93.62,Math.PI,9.7,6.2,8.85,2,'#ccc4ac','#56746c','体育街邮务所','POST & TELEGRAPH'],
  [13.20,93.80,Math.PI,8.2,6.4,5.83,1,'#d7ac8c','#7a6557','海岸印务','COASTAL LETTERPRESS'],
  [28.8,93.72,Math.PI,11.3,7.4,7.85,2,'#e7dcc4','#527d74','灯塔唱片','LIGHTHOUSE RECORDS'],
  [40.05,93.93,Math.PI,9.10,7.1,5.70,1,'#b6c3b7','#597886','晨报发行所','THE MORNING EDITION'],
  [40.6,64.45,Math.PI,8.8,5.4,6.48,1,'#eadfc7','#537568','南窗文具店','SOUTH WINDOW  /  STATIONERS'],
  [-7.4,68.62,Math.PI/2,9.5,5.6,5.2,1,'#ddd4bd','#5d817a','海站修表铺','HARBOUR WATCH REPAIR'],
  [-7.4,79.12,Math.PI/2,8.7,5.1,6.7,1,'#d7b79d','#826c5b','潮路药房','TIDE STREET PHARMACY'],
  [-46.4,69.5,Math.PI/2,10.8,6.9,7.7,2,'#c0c8b9','#708375','滨海会所','BATHING PAVILION'],
  [52.4,79.75,-Math.PI/2,10.5,6.4,6.2,1,'#c8c6b5','#56796e','电工器材社','MARINE ELECTRICAL'],
] as const;

export const shopBuildingBlocks=streetPlots.flatMap(([cx,cz,yaw,w,d,h],i)=>{
  const c=Math.cos(yaw),s=Math.sin(yaw);
  const box=(x:number,z:number,width:number,depth:number,bottom:number,top:number)=>({
    x:cx+c*x+s*z,z:cz-s*x+c*z,w:Math.abs(c)*width+Math.abs(s)*depth,
    d:Math.abs(s)*width+Math.abs(c)*depth,bottom,top,
  });
  return [box(0,-d/2,w,d,0,h),box(0,-d/2,w+.33,d+.39,h,h+.17),
    ...(i%3===1?[]:[box(w*.20,-d*.66,w*.39,d*.41,h+.07,h+.99)])];
});
