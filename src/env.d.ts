/// <reference types="vite/client" />
interface Window {
  luno?: {
    platform: string;
    version: string;
    saveProject: (data: string, name: string) => Promise<boolean>;
    openProject: () => Promise<string | null>;
    saveExport: (data: number[], name: string, extension: string) => Promise<boolean>;
    chooseFolder: () => Promise<string | null>;
    getWorkspace: () => Promise<string | null>;
    onCommand: (handler: (command: string) => void) => () => void;
    onProjectFile: (handler: (raw: string) => void) => () => void;
    ready: () => Promise<void>;
  };
}
declare module 'gifenc' {
  export function GIFEncoder(): { writeFrame: (index: Uint8Array, width: number, height: number, options: { palette: number[][]; delay: number; repeat?: number }) => void; finish: () => void; bytes: () => Uint8Array };
  export function quantize(rgba: Uint8ClampedArray, maxColors: number, options?: { format: string }): number[][];
  export function applyPalette(rgba: Uint8ClampedArray, palette: number[][], format?: string): Uint8Array;
}
