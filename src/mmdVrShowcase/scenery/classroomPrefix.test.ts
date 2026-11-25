import { expect, it } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Matrix4, MeshBasicMaterial, OrthographicCamera, Scene, type WebGLRenderer } from 'three';
import { cameraInstancePrefix } from './cameraInstancePrefix';

it('keeps an edge instance for the eye that sees it, then restores the whole translated row for other passes and room queries', () => {
  const geometry = new BoxGeometry(.1,.1,.1), material = new MeshBasicMaterial(), desk = new InstancedMesh(geometry,material,2);
  desk.setMatrixAt(0,new Matrix4()); desk.setMatrixAt(1,new Matrix4().makeTranslation(1.05,0,0));
  desk.position.x=4; desk.updateMatrixWorld();
  const before=desk.onBeforeRender, after=desk.onAfterRender, dispose=cameraInstancePrefix(desk,[1,2]);
  const eye=new OrthographicCamera(-1,1,1,-1,.1,8), args=[{} as WebGLRenderer,new Scene(),eye,geometry,material,new Group()] as const;
  for (const [x,count] of [[3.968,1],[4.032,2],[0,0],[4.032,2]]) {
    eye.position.set(x,0,2); eye.updateMatrixWorld(); desk.onBeforeRender(...args);
    expect(desk.count).toBe(count); desk.onAfterRender(...args); expect(desk.count).toBe(2);
  }
  eye.position.x=0; eye.updateMatrixWorld(); desk.onBeforeRender(...args); dispose();
  expect(desk.onBeforeRender).toBe(before); expect(desk.onAfterRender).toBe(after); expect(desk.count).toBe(2);
  desk.dispose(); material.dispose(); geometry.dispose();
});
