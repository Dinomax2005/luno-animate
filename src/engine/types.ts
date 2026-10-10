export type Point = { x: number; y: number };
export type Tool = 'select' | 'hand' | 'rig' | 'pen' | 'rectangle' | 'ellipse';
export type Easing = 'linear' | 'ease-in-out' | 'ease-out' | 'hold';
export type ShapeKind = 'rectangle' | 'ellipse' | 'star' | 'sparkle' | 'ground';
export type Preset = 'wave' | 'bounce' | 'walk' | 'spin';

export interface Bone {
  id: string;
  name: string;
  parentId: string | null;
  length: number;
  angle: number;
}
export interface Rig {
  origin: Point;
  bones: Bone[];
}
export interface WorldBone extends Bone {
  start: Point;
  end: Point;
  worldAngle: number;
}
export interface SceneItem {
  id: string;
  name: string;
  type: 'character' | 'shape' | 'path' | 'image';
  shape?: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
  points?: Point[];
  imageData?: string;
  rig?: Rig;
}
export interface Pose {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity?: number;
  bones?: Record<string, number>;
}
export interface Keyframe {
  id: string;
  frame: number;
  easing: Easing;
  values: Pose;
}
export interface Project {
  version: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  background: string;
  items: SceneItem[];
  keyframes: Record<string, Keyframe[]>;
}
export interface Preferences {
  onboardingComplete: boolean;
  showBones: boolean;
  showGrid: boolean;
  loop: boolean;
  autoKey: boolean;
  theme: 'light' | 'dark';
}
export type Dialog = 'setup' | 'export' | 'new' | 'help' | 'settings' | 'download' | null;
