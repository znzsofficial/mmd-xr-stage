import { useLanguageStore } from '../../languageStore';
import type { PoseKey } from './poseSession';

const zh = {
  title: '摆姿势', adjust: '调关节', library: '已存姿势', back: '返回', keep: '保留姿势并返回', end: '恢复原动作',
  frozen: '动作已定格', retry: '开始摆姿势', unavailable: '当前无法编辑这个角色。', held: '姿势已保留。', resume: '继续编辑',
  joint: '控制点', previous: '上一个', next: '下一个', rotate: '旋转轴', rotateOnly: '此关节仅可旋转',
  dragScreen: '拖动中心点移动关节；拖外环旋转。换个视角可沿另一平面移动。',
  rotateScreen: '拖外环旋转，或选轴后按角度微调。', dragXr: '按住中心点移动，拖外环旋转。', rotateXr: '仅可旋转：拖外环或选轴微调。',
  knee: '膝盖朝向', elbow: '手肘朝向', lock: '锁定双脚', unlock: '解除锁脚', undo: '撤销',
  labels: { pelvis: '骨盆', head: '头', leftHand: '左手', rightHand: '右手', leftFoot: '左脚', rightFoot: '右脚' },
  axes: { x: 'X 轴', y: 'Y 轴', z: 'Z 轴' }, pose: '姿势', name: '姿势名称', save: '保存新姿势', load: '应用姿势',
  saved: '已保存', empty: '这个角色还没有已存姿势。', duplicate: '这个名称已使用，请另取一个。',
  editName: '改名', typeName: '输入名称', done: '确定', erase: '退格', clear: '清空', space: '空格',
};
const en: typeof zh = {
  title: 'Pose', adjust: 'Joints', library: 'Saved poses', back: 'Back', keep: 'Keep pose & return', end: 'Restore motion',
  frozen: 'Motion paused', retry: 'Start posing', unavailable: 'This character cannot be posed right now.', held: 'Pose held.', resume: 'Continue posing',
  joint: 'Control point', previous: 'Previous', next: 'Next', rotate: 'Rotation axis', rotateOnly: 'Rotation only',
  dragScreen: 'Drag the center to move, or the ring to rotate. Orbit for a different drag plane.',
  rotateScreen: 'Drag the ring to rotate, or choose an axis and step the angle.', dragXr: 'Hold center to move; drag ring to turn.', rotateXr: 'Rotation only: drag ring or step angle.',
  knee: 'Knee direction', elbow: 'Elbow direction', lock: 'Lock both feet', unlock: 'Unlock feet', undo: 'Undo',
  labels: { pelvis: 'Pelvis', head: 'Head', leftHand: 'Left hand', rightHand: 'Right hand', leftFoot: 'Left foot', rightFoot: 'Right foot' },
  axes: { x: 'X axis', y: 'Y axis', z: 'Z axis' }, pose: 'Pose', name: 'Pose name', save: 'Save new pose', load: 'Apply pose',
  saved: 'Saved', empty: 'No saved poses for this character.', duplicate: 'Name in use. Choose another.',
  editName: 'Edit name', typeName: 'Enter name', done: 'Done', erase: 'Delete', clear: 'Clear', space: 'Space',
};

export function usePoseText() { return useLanguageStore(s => s.language === 'en' ? en : zh); }
export type PoseText = typeof zh;
export function limbBendLabel(t: PoseText, key: PoseKey) {
  if (key === 'leftFoot' || key === 'rightFoot') return t.knee;
  if (key === 'leftHand' || key === 'rightHand') return t.elbow;
}
export function nextPoseName(base: string, names: readonly string[]) {
  let n = 1;
  while (names.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}
