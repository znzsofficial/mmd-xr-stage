import { useLanguageStore } from '../../languageStore';
import type { PoseKey } from './poseSession';

const zh = {
  title: '摆姿势', adjust: '调关节', library: '已存姿势', back: '返回', keep: '保留姿势并返回', end: '恢复原动作',
  presets: '快速体位', applied: '已应用', undone: '已撤销', unsupported: '骨架不支持灰显体位。',
  basic: '基础体位', teasing: '挑逗体位',
  presetName: (p: { zh: string; en: string }) => p.zh,
  frozen: '动作已定格', retry: '开始摆姿势', unavailable: '当前无法编辑这个角色。', held: '姿势已保留。', resume: '继续编辑',
  joint: '控制点', previous: '上一个', next: '下一个', rotate: '旋转轴', rotateOnly: '此关节仅可旋转',
  dragScreen: '重叠时先选控制点。拖圆心移动，按住上滚拉近、下滚推远。松手后滚轮缩放；拖外环旋转。',
  reachScreen: '菱形是目标，圆心是关节；两者分开时显示相差的距离。',
  rotateScreen: '拖外环旋转，或选轴后按角度微调。', dragXr: '扣住圆心平移、推拉手柄；拖外环旋转。', reachXr: '菱形是目标；圆心是关节实际位置。', rotateXr: '仅可旋转：拖外环或选轴微调。',
  knee: '膝盖朝向', elbow: '手肘朝向', lock: '锁定双脚', unlock: '解除锁脚', undo: '撤销',
  pin: '固定腕部落点', unpin: '解除腕部固定', pinned: '手腕已固定。拖圆心换落点，拖外环转手腕。', incompleteArm: '手臂骨链不全；仅可旋转手腕。',
  labels: { pelvis: '骨盆', torso: '上身', head: '头', leftHand: '左手腕', rightHand: '右手腕', leftFoot: '左脚踝', rightFoot: '右脚踝' },
  axes: { x: 'X 轴', y: 'Y 轴', z: 'Z 轴' }, pose: '姿势', name: '姿势名称', save: '保存新姿势', load: '应用姿势',
  saved: '已保存', empty: '这个角色还没有已存姿势。', duplicate: '这个名称已使用，请另取一个。',
  editName: '改名', typeName: '输入名称', done: '确定', erase: '退格', clear: '清空', space: '空格',
};
const en: typeof zh = {
  title: 'Pose', adjust: 'Joints', library: 'Saved poses', back: 'Back', keep: 'Keep pose & return', end: 'Restore motion',
  presets: 'Quick poses', applied: 'Applied', undone: 'Undone', unsupported: 'This rig cannot use the dimmed poses.',
  basic: 'Basic poses', teasing: 'Teasing poses',
  presetName: p => p.en,
  frozen: 'Motion paused', retry: 'Start posing', unavailable: 'This character cannot be posed right now.', held: 'Pose held.', resume: 'Continue posing',
  joint: 'Control point', previous: 'Previous', next: 'Next', rotate: 'Rotation axis', rotateOnly: 'Rotation only',
  dragScreen: 'For stacked points, choose a joint above. Drag the center; scroll up to pull closer or down to push away. Release to zoom. Drag the ring to turn.',
  reachScreen: 'The diamond is your target; the dot is the joint. A gap shows the distance left.',
  rotateScreen: 'Drag the ring to rotate, or choose an axis and step the angle.', dragXr: 'Hold center; move your hand to carry. Drag ring to turn.', reachXr: 'Diamond: target. Dot: actual joint.', rotateXr: 'Rotation only: drag ring or step angle.',
  knee: 'Knee direction', elbow: 'Elbow direction', lock: 'Lock both feet', unlock: 'Unlock feet', undo: 'Undo',
  pin: 'Pin wrist', unpin: 'Unpin wrist', pinned: 'Drag center to move the pin; drag ring to turn.', incompleteArm: 'Incomplete arm chain. This wrist can only turn.',
  labels: { pelvis: 'Pelvis', torso: 'Torso', head: 'Head', leftHand: 'Left wrist', rightHand: 'Right wrist', leftFoot: 'Left ankle', rightFoot: 'Right ankle' },
  axes: { x: 'X axis', y: 'Y axis', z: 'Z axis' }, pose: 'Pose', name: 'Pose name', save: 'Save new pose', load: 'Apply pose',
  saved: 'Saved', empty: 'No saved poses for this character.', duplicate: 'Name in use. Choose another.',
  editName: 'Edit name', typeName: 'Enter name', done: 'Done', erase: 'Delete', clear: 'Clear', space: 'Space',
};

export function usePoseText() { return useLanguageStore(s => s.language === 'en' ? en : zh); }
export type PoseText = typeof zh;
export function jointHint(t:PoseText, screen:boolean, movable:boolean, dragging:boolean, wrist:{pinned:boolean}|null) {
  if (!movable) return wrist ? t.incompleteArm : screen ? t.rotateScreen : t.rotateXr;
  if (dragging) return screen ? t.reachScreen : t.reachXr;
  return wrist?.pinned ? t.pinned : screen ? t.dragScreen : t.dragXr;
}
export function limbBendLabel(t: PoseText, key: PoseKey) {
  if (key === 'leftFoot' || key === 'rightFoot') return t.knee;
  if (key === 'leftHand' || key === 'rightHand') return t.elbow;
}
export function nextPoseName(base: string, names: readonly string[]) {
  let n = 1;
  while (names.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}
