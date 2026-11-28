import assert from 'node:assert/strict';
import test from 'node:test';
import { BackSide, Bone, DirectionalLight, DoubleSide, Float32BufferAttribute, FrontSide, Mesh, MeshToonMaterial,
  PerspectiveCamera, PlaneGeometry, Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, WebGPURenderer } from 'three/webgpu';
import { lights, positionLocal, vec3 } from 'three/tsl';
import RenderObjects from 'three/src/renderers/common/RenderObjects.js';
import NodeManager from 'three/src/renderers/common/nodes/NodeManager.js';
import { createMmdTslMaterialFromSource } from '@yohawing/three-mmd-loader/webgpu';
import { endfieldColor } from './webgpu-actor/endfieldToon.js';
import { createActorStylePasses } from './webgpu-actor/actorStylePasses.js';
import { createFaceKeyShadow } from './webgpu-actor/faceKeyShadow.js';

// Real r187 render-object lookup, node-builder lifetime and CPU WGSL generation.
// Stop before device creation, bindings upload, pipelines and submission.
function measure(reuse) {
  const renderer = new WebGPURenderer({canvas:{width:16,height:16}});
  renderer.hasFeature = () => false;
  renderer.backend.capabilities.getUniformBufferLimit = () => 65536;
  renderer._bindings = undefined;
  const nodes = new NodeManager(renderer,renderer.backend);
  const objects = new RenderObjects(renderer,nodes,{deleteVertexState(){}},{delete(){}},{deleteForRender(){}},renderer.info);
  const scene = new Scene(), camera = new PerspectiveCamera(), lighting = lights(), context = {stateKey:'color'};
  const source = new MeshToonMaterial(), material = createMmdTslMaterialFromSource(source);
  const mesh = new Mesh(new PlaneGeometry(),material);
  const mmd = material.colorNode, endfield = endfieldColor(mmd,mmd,material,'cloth',mesh,{},0);
  const passes = reuse && createActorStylePasses(renderer);
  let builds = 0, state;
  renderer.debug.onNodeBuilderCreated = () => { ++builds; };
  renderer._handleObjectFunction = (object, mat, scene, camera, lights, _group, clipping, pass) => {
    state = objects.get(object,mat,scene,camera,lights,context,clipping,pass).getNodeBuilderState();
  };
  function draw(mode) {
    material.colorNode = mode === 'mmd' ? mmd : endfield;
    material.needsUpdate = true;
    if (passes) passes.set(material,mode);
    const before = builds;
    (renderer.getRenderObjectFunction() ?? renderer.renderObject).call(renderer,mesh,scene,camera,mesh.geometry,material,null,lighting);
    assert.match(state.fragmentShader, /@fragment/);
    return {builds:builds-before,state};
  }
  try {
    const baseline = draw('mmd'), first = draw('endfield'), restore = draw('mmd'), repeat = draw('endfield');
    assert.notEqual(baseline.state.fragmentShader,first.state.fragmentShader);
    assert.equal(repeat.state.fragmentShader,first.state.fragmentShader);
    if (reuse) {
      assert.ok(repeat.state === first.state && restore.state === baseline.state);
      draw('mmd');
      // An inactive style must revalidate wardrobe blend and cloth graph edits.
      material.transparent = true; material.depthWrite = false;
      material.positionNode = positionLocal.add(vec3(.12345,0,0)); material.needsUpdate = true;
      const edited = draw('endfield');
      assert.equal(edited.builds,1);
      assert.match(edited.state.vertexShader,/0\.12345/);
      assert.equal(first.state.usedTimes,0);
    }
    return [first,restore,repeat].map(row=>row.builds);
  } finally {
    if (passes) passes.dispose();
    assert.equal(renderer.getRenderObjectFunction(),null);
    material.dispose();
    assert.equal(objects._renderObjects.size,0);
    assert.equal(nodes.nodeBuilderCache.size,0);
    mesh.geometry.dispose(); source.dispose();
  }
}

test('Endfield → MMD → Endfield reuses completed Three node builders and rechecks edited passes', () => {
  assert.deepEqual(measure(false),[1,1,1]);
  assert.deepEqual(measure(true),[1,0,0]);
});

test('only styled materials in the ordinary pass are routed, and teardown respects other draw owners', () => {
  const renderer = new WebGPURenderer({canvas:{width:16,height:16}});
  const original = (...args) => args[8];
  renderer.setRenderObjectFunction(original);
  const passes = createActorStylePasses(renderer), a = {}, b = {};
  const draw = (material, passId = null, overrideMaterial = null) =>
    renderer.getRenderObjectFunction()(null,{overrideMaterial},null,null,material,null,null,null,passId);
  passes.set(a,'endfield');
  assert.equal(draw(a),'mmd-stage:endfield'); assert.equal(draw(b),null);
  assert.equal(draw(a,'backSide'),'backSide'); assert.equal(draw(a,null,{}),null);
  passes.set(b,'strinova'); passes.set(a,'mmd');
  assert.equal(draw(a),null); assert.equal(draw(b),'mmd-stage:strinova');
  passes.set(b,'mmd'); assert.equal(renderer.getRenderObjectFunction(),original);
  passes.set(a,'endfield');
  const inner = renderer.getRenderObjectFunction(), outer = (...args) => inner(...args);
  renderer.setRenderObjectFunction(outer); passes.dispose();
  assert.equal(renderer.getRenderObjectFunction(),outer); assert.equal(draw(a),null);
});

test('r187 keeps the authored single draw or the separate back/front draws on a transparent PMX slot', () => {
  const renderer = new WebGPURenderer({canvas:{width:16,height:16}});
  const camera = new PerspectiveCamera(), scene = new Scene(), lighting = lights();
  const source = new MeshToonMaterial({side:DoubleSide,transparent:true});
  source.userData.mmdMaterial = {flags:{doubleSided:true}};
  const material = createMmdTslMaterialFromSource(source), mesh = new Mesh(new PlaneGeometry(),material);
  const passes = createActorStylePasses(renderer), draws = [];
  renderer._handleObjectFunction = (_object, mat, _scene, _camera, _lights, _group, _clip, pass) => draws.push([mat.side,pass]);
  passes.set(material,'endfield');
  renderer._currentRenderObjectFunction = renderer.getRenderObjectFunction();
  const list = [{object:mesh,geometry:mesh.geometry,material,group:null,clippingContext:null}];
  function check(doublePassList, expected) {
    draws.length = 0;
    renderer._renderTransparents(list,doublePassList,camera,scene,lighting);
    assert.deepEqual(draws,expected);
    assert.equal(material.side,DoubleSide);
  }
  assert.equal(material.forceSinglePass,true);
  check([],[[DoubleSide,'mmd-stage:endfield']]);
  material.forceSinglePass = false;
  // Both the ordinary transparent draw and renderer-separated transmission
  // draw hold their own back pass; neither may alias the front's state.
  for (const backList of [[],list]) check(backList,[[BackSide,'backSide'],[FrontSide,'mmd-stage:endfield']]);
  passes.set(material,'mmd'); renderer._currentRenderObjectFunction = renderer.renderObject;
  check([],[[BackSide,'backSide'],[FrontSide,null]]);
  passes.dispose(); mesh.geometry.dispose(); material.dispose(); source.dispose();
});

test('the real face projector uses its own material, live opacity and cloth node, then restores the style callback', () => {
  const renderer = new WebGPURenderer({canvas:{width:16,height:16}});
  const scene = new Scene(), geometry = new PlaneGeometry();
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(16),4));
  geometry.setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
  const source = new MeshToonMaterial(), material = createMmdTslMaterialFromSource(source);
  const mesh = new SkinnedMesh(geometry,[material]), light = new DirectionalLight();
  const [head,left,right] = ['head','left eye','right eye'].map(name=>Object.assign(new Bone(),{name}));
  left.position.x = .03; right.position.x = -.03; mesh.add(head); head.add(left,right);
  mesh.bind(new Skeleton([head,left,right]));
  const passes = createActorStylePasses(renderer);
  passes.set(material,'endfield');
  const mainDraw = renderer.getRenderObjectFunction(), shadow = createFaceKeyShadow(renderer,mesh,light,new Set([0]));
  const observed = [];
  renderer._handleObjectFunction = (_object, mat, _scene, _camera, _lights, _group, _clip, pass) => observed.push([mat,pass]);
  // Supply only the render-list traversal. Run the real caster filter,
  // Renderer.renderObject and state save/reset/restore, without a device.
  renderer.render = (object,camera) => renderer.getRenderObjectFunction()(object,scene,camera,geometry,material,null,lights(),null);
  try {
    material.positionNode = positionLocal.add(vec3(0,.125,0)); material.opacity = .4;
    shadow.prepare();
    assert.equal(observed.length,1);
    const [[caster,pass]] = observed;
    assert.ok(caster !== material); assert.equal(pass,null);
    assert.equal(caster.positionNode,material.positionNode); assert.equal(caster.opacity,.4);
    assert.equal(renderer.getRenderObjectFunction(),mainDraw);
    mainDraw(mesh,scene,new PerspectiveCamera(),geometry,material,null,lights(),null);
    assert.ok(observed[1][0] === material); assert.equal(observed[1][1],'mmd-stage:endfield');
  } finally {
    shadow.dispose(); passes.dispose(); geometry.dispose(); material.dispose(); source.dispose(); mesh.skeleton.dispose();
  }
});
