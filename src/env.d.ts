/// <reference types="vite/client" />
interface Window {
  showOpenFilePicker?: (options: { multiple: boolean; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<import('./services/document-files').WritableFileHandle[]>;
  showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<import('./services/document-files').WritableFileHandle>;
  luno?: {
    platform: string; version: string;
    startup?: { report: (state: { phase: string; error: string | null }) => void; complete: () => Promise<boolean>; onRetry: (callback: () => void) => () => void };
    documents?: {
      open: () => Promise<import('./services/document-files').NativeOpenedFile | null>;
      save: (token: string, data: Uint8Array) => Promise<import('./services/document-files').NativeFileTarget>;
      saveAs: (data: Uint8Array, name: string) => Promise<import('./services/document-files').NativeFileTarget | null>;
    };
    saveProject: (data: Uint8Array, name: string) => Promise<boolean>;
    openProject: () => Promise<Uint8Array | null>;
    saveExport: (data: Uint8Array, name: string, extension: string) => Promise<boolean>;
    chooseFolder: () => Promise<string | null>; getWorkspace: () => Promise<string | null>;
    onCommand: (handler: (command: string) => void) => () => void;
    onProjectFile: (handler: (raw: Uint8Array | import('./services/document-files').NativeOpenedFile) => void) => () => void; ready: () => Promise<{ openedFile: boolean } | void>;
    library: {
      list: () => Promise<import('./engine/types').ProjectRecord[]>;
      save: (bytes: Uint8Array, thumbnail?: string | null) => Promise<import('./engine/types').ProjectRecord>;
      load: (id: string) => Promise<Uint8Array>;
      patch: (id: string, patch: { name?: string; starred?: boolean; deletedAt?: number | null }) => Promise<void>;
      deleteForever: (id: string) => Promise<void>; recover: (id: string) => Promise<Uint8Array>;
      getSettings: () => Promise<import('./services/repository').LibrarySettings>;
      saveSettings: (settings: import('./services/repository').LibrarySettings) => Promise<void>;
      backups: () => Promise<import('./engine/types').BackupInfo[]>;
      backup: () => Promise<import('./engine/types').BackupInfo>;
      restore: (id: string) => Promise<boolean>;
    };
    updater: {
      state: () => Promise<import('./engine/types').UpdateState>;
      check: () => Promise<void>; install: () => Promise<void>; defer: () => Promise<void>;
      setAutomatic: (enabled: boolean) => Promise<void>;
      activity: (activity: { busy: boolean; playing: boolean; interacting: boolean; dirty: boolean; lastActivity: number }) => void;
      onState: (handler: (state: import('./engine/types').UpdateState) => void) => () => void;
    };
    onPrepare: (handler: (request: { id: string; reason: 'update' | 'close' }) => void) => () => void;
    preparationResult: (id: string, ok: boolean, error?: string) => void;
    onResume: (handler: () => void) => () => void;
  };
}
declare module 'gifenc' {
  export function GIFEncoder(): { writeFrame: (index: Uint8Array, width: number, height: number, options: { palette: number[][]; delay: number; repeat?: number }) => void; finish: () => void; bytes: () => Uint8Array };
  export function quantize(rgba: Uint8ClampedArray, maxColors: number, options?: { format: string }): number[][];
  export function applyPalette(rgba: Uint8ClampedArray, palette: number[][], format?: string): Uint8Array;
}
