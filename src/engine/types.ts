export type Point = { x: number; y: number };
export type Tool = 'select' | 'hand' | 'rig' | 'pen' | 'rectangle' | 'ellipse' | 'text' | 'camera';
export type Easing = 'linear' | 'ease-in-out' | 'ease-out' | 'ease-in' | 'hold' | 'back-out' | 'bounce-out' | 'elastic-out' | 'bezier';
export type ShapeKind = 'rectangle' | 'ellipse' | 'star' | 'sparkle' | 'ground';
export type Preset = 'wave' | 'bounce' | 'walk' | 'spin' | 'float' | 'pulse' | 'fade' | 'slide';
export type AnimationMode = 'rigged' | 'frame-by-frame';
export type Template = 'character' | 'shapes' | 'blank' | 'title' | 'cutout';
export interface Bone { id: string; name: string; parentId: string | null; length: number; angle: number; locked?: boolean; minAngle?: number; maxAngle?: number }
export interface Rig { origin: Point; bones: Bone[] }
export interface WorldBone extends Bone { start: Point; end: Point; worldAngle: number }
export interface Stroke { points: Point[]; color: string; width: number }
export interface DrawingCel { frame: number; strokes: Stroke[] }
export interface Attachment { characterId: string; boneId: string; anchor: number }
export interface SceneItem {
  id: string; name: string; type: 'character' | 'shape' | 'path' | 'image' | 'text' | 'group' | 'drawing';
  shape?: ShapeKind; parentId?: string | null; attachment?: Attachment;
  x: number; y: number; width: number; height: number; scaleX: number; scaleY: number;
  rotation: number; opacity: number; visible: boolean; locked: boolean; fill: string; stroke: string; strokeWidth: number;
  points?: Point[]; imageData?: string; rig?: Rig; characterStyle?: 'milo' | 'skeleton';
  text?: string; fontSize?: number; fontWeight?: number; textAlign?: 'start' | 'middle' | 'end';
  cels?: DrawingCel[]; holdCels?: boolean; blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay';
}
export interface Pose { x?: number; y?: number; scaleX?: number; scaleY?: number; rotation?: number; opacity?: number; bones?: Record<string, number> }
export interface Keyframe { id: string; frame: number; easing: Easing; values: Pose; bezier?: [number, number, number, number] }
export interface Camera { x: number; y: number; zoom: number; rotation: number; keys: Keyframe[] }
export interface AudioClip { id: string; name: string; data: string; duration: number; startFrame: number; trimStart: number; volume: number; muted: boolean; waveform: number[] }
export interface SceneContent { duration: number; background: string; items: SceneItem[]; keyframes: Record<string, Keyframe[]>; camera: Camera; audio: AudioClip[]; workArea: { start: number; end: number } }
export interface Scene extends SceneContent { id: string; name: string }
/** Active scene is inline, inactive scenes are stored separately (no duplicate artwork). */
export interface Project extends SceneContent { version: 2; animationMode: AnimationMode; id: string; name: string; width: number; height: number; fps: number; sceneId: string; sceneName: string; sceneOrder: string[]; scenes: Scene[] }
export interface Preferences {
  onboardingComplete: boolean; showBones: boolean; showGrid: boolean; loop: boolean; autoKey: boolean;
  theme: 'light' | 'dark'; onionSkin: boolean; onionBefore: number; onionAfter: number; showMotionPath: boolean;
  snapToGrid: boolean; gridSize: number; inverseKinematics: boolean; brushColor: string; brushSize: number;
  drawingMode: 'vector' | 'cel'; automaticUpdates: boolean;
}
export interface ProjectRecord { id: string; name: string; createdAt: number; updatedAt: number; starred: boolean; deletedAt: number | null; thumbnail: string | null; width: number; height: number; fps: number; frames: number; scenes: number; kind: string }
export interface SavedProject extends ProjectRecord { bytes: Uint8Array }
export type View = 'home' | 'editor';
export type Dialog = 'setup' | 'export' | 'new' | 'help' | 'settings' | 'download' | 'commands' | 'updates' | 'start' | 'whats-new' | null;
export interface KeyRef { itemId: string; frame: number }
export interface UpdateState { phase: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'waiting' | 'preparing' | 'installing' | 'current' | 'unpublished' | 'disabled' | 'error'; version: string | null; progress: number; message: string; checkedAt: number | null; countdown: number | null; automatic: boolean; backupId: string | null }
export interface BackupInfo { id: string; createdAt: number; reason: string; version: string; projects: number }
