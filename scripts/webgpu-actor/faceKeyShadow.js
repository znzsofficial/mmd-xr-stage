import { BufferAttribute, DoubleSide, HalfFloatType, Matrix4, MeshBasicNodeMaterial, NearestFilter,
  OrthographicCamera, RedFormat, RendererUtils, RenderTarget, Vector3 } from 'three/webgpu';
import { attribute, cameraProjectionMatrix, float, materialOpacity, positionView, positionWorld, screenCoordinate,
  smoothstep, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';

const SIZE = 384, EYE_RADII = 3.8, NEAR = .01, FAR = 4, TAPS = 17;

// Redraw only the assigned groups of the original actor, after its morph
// dispatch. Skinned positions and UVs are read from the same live GPU inputs.
export function createFaceKeyShadow(renderer, mesh, light, slots) {
  const bones = mesh.skeleton.bones;
  const bone = (...names) => bones.find(b => [b.name,b.userData.mmdEnglishBoneName].some(n => names.includes(n?.toLowerCase())));
  const head = bone('頭','head'), left = bone('左目','left eye','eye_l'), right = bone('右目','right eye','eye_r');
  if (!head || !left || !right) return;

  const g = mesh.geometry, ids = g.getAttribute('skinIndex'), weights = g.getAttribute('skinWeight');
  const headBones = new Set(); head.traverse(b => headBones.add(b));
  // A sleeve can share a draw with the hood. Restrict even those mixed slots
  // to vertices weighted to the head or its descendants, before projection.
  const member = new Float32Array(ids.count);
  for (let i=0; i<member.length; i++) {
    for (let j=0; j<4; j++) if (headBones.has(bones[ids.getComponent(i,j)])) member[i]+=weights.getComponent(i,j);
  }
  const headWeight = new BufferAttribute(member,1);
  g.setAttribute('localFaceCasterWeight',headWeight);

  const target = new RenderTarget(SIZE,SIZE,{format:RedFormat,type:HalfFloatType,minFilter:NearestFilter,magFilter:NearestFilter});
  const reversed = renderer.reversedDepthBuffer, camera = new OrthographicCamera();
  const projection = uniform(new Matrix4()), amount = uniform(0);
  const p = projection.mul(vec4(positionWorld,1));
  // WebGPU render targets start at top left; clip +Y is up.
  const coord = p.xy.mul(vec2(.5,-.5)).add(.5), sample = texture(target.texture);
  let shade = float(0);
  for (let i=0; i<TAPS; i++) {
    const a=i*2.399963, r=Math.sqrt(i/(TAPS-1))*3.5/SIZE;
    const z=sample.sample(coord.add(vec2(r*Math.cos(a),r*Math.sin(a)))).r;
    // A key-light contact shadow, limited in reach in interocular units.
    const gap=p.z.sub(z).mul((reversed?-1:1)*EYE_RADII*(FAR-NEAR));
    shade=shade.add(smoothstep(.002,.025,gap).mul(smoothstep(.3,3.2,gap).oneMinus()));
  }
  const inside=p.x.abs().max(p.y.abs()).lessThan(1).and(p.z.greaterThan(0)).and(p.z.lessThan(1));
  const visibility=inside.select(shade.div(TAPS).mul(amount).oneMinus(),float(1));

  const casts=new Map(), materials=[mesh.material].flat();
  for (const i of slots) {
    const source=materials[i], m=new MeshBasicNodeMaterial({side:DoubleSide});
    const alpha=source.opacityNode ?? materialOpacity;
    // Coverage is stable in shadow texels, not eye/screen pixels. Alpha gaps
    // admit deeper geometry; two overlapping cards don't erase one another.
    const threshold=screenCoordinate.xy.dot(vec2(.06711056,.00583715)).add(i*.37).fract().mul(52.9829189).fract();
    m.maskNode=attribute('localFaceCasterWeight','float').greaterThan(.25).and(alpha.greaterThan(threshold.max(source.alphaTest)));
    m.colorNode=vec3(cameraProjectionMatrix.mul(vec4(positionView,1)).z);
    casts.set(source,m);
  }
  function drawCasters(object,scene,cam,geometry,material,group,lights,clip) {
    const m=casts.get(material);
    if (object!==mesh || !m) return;
    m.opacity=material.opacity;
    if (m.positionNode!==material.positionNode) { m.positionNode=material.positionNode; m.needsUpdate=true; }
    renderer.renderObject(object,scene,cam,geometry,m,group,lights,clip);
  }
  const center=new Vector3(), other=new Vector3(), direction=new Vector3(), state={};
  let enabled=true;
  return {
    visibility,
    setEnabled(on) { enabled=on; if (!on) amount.value=0; },
    prepare() {
      amount.value=0;
      if (!enabled || !light.visible) return;
      left.getWorldPosition(center); right.getWorldPosition(other);
      const radius=center.distanceTo(other)*EYE_RADII;
      if (!(radius>1e-5)) return;
      center.lerp(other,.5);
      light.getWorldPosition(direction).sub(light.target.getWorldPosition(other)).normalize();
      camera.position.copy(center).addScaledVector(direction,radius*2);
      camera.up.set(0,Math.abs(direction.y)>.99?0:1,Math.abs(direction.y)>.99?1:0);
      camera.lookAt(center); camera.left=camera.bottom=-radius; camera.right=camera.top=radius;
      camera.near=radius*NEAR; camera.far=radius*FAR; camera.updateProjectionMatrix();
      RendererUtils.resetRendererState(renderer,state);
      try {
        renderer.setClearColor(reversed?0:0xffffff,1);
        renderer.setRenderTarget(target); renderer.setRenderObjectFunction(drawCasters);
        renderer.render(mesh,camera);
        projection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
        amount.value=.62;
      } finally { RendererUtils.restoreRendererState(renderer,state); }
    },
    dispose() {
      for (const m of casts.values()) m.dispose();
      target.dispose(); g.deleteAttribute('localFaceCasterWeight'); headWeight.dispose();
    },
  };
}
