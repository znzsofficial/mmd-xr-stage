// Offline only. Compile the project's authored scenery GLSL to ordinary TSL
// modules using the transpiler from our pinned Three. No shader parser, eval,
// second context, or general runtime translator is shipped to the headset.
import fs from 'node:fs';import path from 'node:path';
import {createServer} from 'vite';
import GLSLDecoder from 'three/addons/transpiler/GLSLDecoder.js';
import Linker from 'three/addons/transpiler/Linker.js';
import TSLEncoder from 'three/addons/transpiler/TSLEncoder.js';
const dir='src/mmdVrShowcase', programs=new Map(), output='scripts/webgpu-actor/roomPrograms.generated.js';
for(const name of fs.readdirSync(dir,{recursive:true}).filter(f=>f.endsWith('.tsx'))){
  const file=path.resolve(dir,name).replaceAll('\\','/'),src=fs.readFileSync(file,'utf8'),effects=[];
  for(const match of src.matchAll(/<RoomShader effect="(\w+)"([\s\S]*?)\/>/g)){
    const [,key,props]=match;
    function expression(k){return props.match(new RegExp(k+'=\\{(`[^`]*`|[\\w.]+)\\}'))?.[1]??(/\.\.\.material\}/.test(props)?`material.${k}`:null);}
    const v=expression('vertexShader'),f=expression('fragmentShader');if(!v||!f)throw Error('Missing shader source for '+key);
    effects.push(`${key}:[${v},${f}]`);
  }
  if(effects.length)programs.set(file,`\nexport function __roomPrograms(){${effects.some(k=>k.startsWith('pool:'))?'const w=POOL.water;':''}return {${effects.join(',\n')}};}`);
}
const server=await createServer({configFile:false,logLevel:'error',publicDir:false,server:{middlewareMode:true,hmr:false,watch:null},plugins:[{name:'room-source-inventory',enforce:'pre',transform(src,id){const append=programs.get(id.replaceAll('\\','/'));if(append)return src+append;}}]});
const sources={};try{for(const file of programs.keys()){const m=await server.ssrLoadModule('/'+path.relative('.',file).replaceAll('\\','/'));Object.assign(sources,m.__roomPrograms());}}finally{await server.close();}
const imports=new Set(['attribute','varyingProperty','varying','vec4','mat3','transpose','property','Fn','uv','positionGeometry','normalGeometry','cameraPosition','cameraViewMatrix','cameraProjectionMatrix','cameraNormalMatrix','modelNormalMatrix','modelWorldMatrix','modelViewMatrix','viewportSize']);
const builtins={position:'positionGeometry',normal:'normalGeometry',uv:'uv()',color:"attribute('color','vec3')",cameraPosition:'cameraPosition',viewMatrix:'cameraViewMatrix',modelMatrix:'modelWorldMatrix',normalMatrix:'cameraNormalMatrix.mul(modelNormalMatrix)',modelViewMatrix:'modelViewMatrix',projectionMatrix:'cameraProjectionMatrix',gl_PointCoord:'uv()'};
function clean(src,flags){const stack=[];return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'').split('\n').filter(line=>{const m=line.trim().match(/^#(\w+)\s*(.*)$/);if(m){const [,op,k]=m;if(op==='ifdef'||op==='ifndef')stack.push(flags.has(k)===(op==='ifdef'));else if(op==='else')stack[stack.length-1]=!stack.at(-1);else if(op==='endif')stack.pop();else if(op!=='include')throw Error('Unknown shader directive '+op);return false;}return stack.every(Boolean);}).join('\n');}
function compile(raw,stage,flags,vars,key){
  let src=clean(raw,flags);
  // Expand paired outputs from the Bezier derivative helper. r187's transpiler
  // treats GLSL out arguments as copies, unlike the original vertex program.
  if(src.includes('void spine(')){const re=/void spine\(float lane, float t, out vec3 p, out vec3 d\)\s*\{([\s\S]*?d=normalize\([^;]*;)[\s\n]*\}/;if(!re.test(src))throw Error('Update dust spine signature');src=src.replace(re,(_,body)=>['p','d'].map(k=>`vec3 spine_${k}(float lane,float t){vec3 p,d;${body}return ${k};}`).join('\n')).replace(/vec3 p,d;\s*spine\(lane,t,p,d\);/,'vec3 p=spine_p(lane,t),d=spine_d(lane,t);');}
  src=src.replace(/if\(amount<=0\.\)return vec3\(0\.\);/g,'');
  // A function parameter with only component assignments isn't identified as
  // mutable by the linker. Copy the input, never assign into vertex attributes.
  src=src.replace('vec3 tumble(vec3 p,vec2 a,vec2 b){','vec3 tumble(vec3 inputP,vec2 a,vec2 b){vec3 p=inputP;');
  const local=new Map();src=src.replace(/\b(attribute|uniform|varying)\s+(\w+)\s+([^;]+);/g,(_,kind,type,list)=>{for(const name of list.split(',').map(s=>s.trim())){if(!/^\w+$/.test(name))throw Error(name);if(!vars.has(name))vars.set(name,{kind,type});local.set(name,'rr_'+name);}return '';});
  for(const name of Object.keys(builtins))if(!local.has(name)&&new RegExp('\\b'+name+'\\b').test(src)){vars.set('builtin_'+name,{kind:'builtin',type:name});local.set(name,'rr_builtin_'+name);}
  // Rename accessors but not GLSL swizzles.
  src=src.replace(/(?<!\.)\b[A-Za-z_]\w*\b/g,s=>local.get(s)??s);
  src=src.replace(/void\s+main\s*\(\s*\)\s*\{/,'vec4 roomMain(){vec4 rrResult;'+(key==='catalogue'&&stage==='v'?'float rrSize;':''));
  src=src.replaceAll('gl_PointSize','rrSize').replaceAll(stage==='v'?'gl_Position':'gl_FragColor','rrResult');
  const ret=key==='catalogue'&&stage==='v'?'rrResult.xy+=(rr_corner.xy*rrSize*2./rr_viewport)*rrResult.w;':'';
  src=src.trim().replace(/\}\s*$/,ret+'return rrResult;}');
  const ast=new GLSLDecoder().parse(src);new Linker().process(ast);
  for(const s of ast.body)if(s.isFunctionDeclaration)s.layout=false;
  class RoomEncoder extends TSLEncoder {
    emitExpression(node,...args){
      if(node?.isUnary&&node.type==='-'&&node.expression.isNumber&&node.parent?.isOperator&&!node.parent.isNumericExpression){this.addImport('float');return `float(-${node.expression.value})`;}
      return super.emitExpression(node,...args);
    }
    emitVariables(node,root=true){
      // The stock encoder attaches .toVar() after the entire comma list.
      // Each local owns its storage, including locals with swizzle writes.
      const next=node.next;node.next=null;if(node.value&&node.parent?.isProgram!==true)node.needsToVar=true;
      const s=super.emitVariables(node,root);node.next=next;return s+(next?', '+this.emitVariables(next,false):'');
    }
  }
  const enc=new RoomEncoder(),code=enc.emit(ast);const imp=code.match(/import \{([^}]+)\}/)?.[1]??'';
  for(const s of imp.split(',').map(x=>x.trim()).filter(Boolean))imports.add(s);
  return code.replace(/^[\s\S]*?from 'three\/tsl';/,'').replace(/\bexport const /g,'const ').trim();
}
const factories=[];for(const key of Object.keys(sources).sort())for(const flags of (key==='mineral'?[[],['HALITE']]:key==='rocks'?[['ROCK_BATCH']]:[[]])){
  const vars=new Map(),id=key+(flags.includes('HALITE')?'Halite':'');let vs,fsrc;try{vs=compile(sources[key][0],'v',new Set(flags),vars,key);fsrc=compile(sources[key][1],'f',new Set(flags),vars,key);}catch(e){throw Error('Compiling '+id+': '+e.message,{cause:e});}
  // Use only the vertex-visible view matrix for the eye. Sharing r187's
  // fragment-only cameraPositions layout with a sky vertex pass is invalid.
  const bind=Array.from(vars).filter(([n])=>new RegExp('\\brr_'+n+'\\b').test(vs+fsrc)).map(([n,{kind,type}])=>{const expr=kind==='attribute'?`attribute('${n}','${type}')`:kind==='varying'?`varyingProperty('${type}','scene_${n}')`:kind==='uniform'?`read('${n}','${type}')`:key==='catalogue'&&type==='position'?`attribute('starDirection','vec3')`:type==='cameraPosition'?`varying(transpose(mat3(cameraViewMatrix)).mul(cameraViewMatrix.element(3).xyz.negate()))`:builtins[type];return `const rr_${n}=${expr};`;}).join('\n');
  factories.push(`export function ${id}(read){\n${bind}\n${key==='catalogue'?'const rr_corner=positionGeometry,rr_viewport=viewportSize;':''}\nconst vertexNode=(()=>{${vs}\nreturn roomMain();})();\nconst fragmentNode=(()=>{${fsrc}\nreturn roomMain();})();\nreturn {vertexNode,fragmentNode};\n}`);
}
const text=`// Generated by node scripts/build-room-nodes.mjs (Three r187). Edit the authored room shaders.\nimport {${[...imports].sort().join(',')}} from 'three/tsl';\n\n${factories.join('\n\n')}\n`;
if(process.argv.includes('--check')){if(fs.readFileSync(output,'utf8').replaceAll('\r\n','\n')!==text)throw Error('Stale WebGPU scene programs');}else fs.writeFileSync(output,text);
console.log(factories.length+' authored scenery shader variants');
