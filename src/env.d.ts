/// <reference types="vite/client" />
import type { LibraryEntry } from "./state/studio";
declare global {
  interface Window {
    studio?: {
      version: string;
      platform: string;
      ready: () => Promise<void>;
      library: {
        list: () => Promise<LibraryEntry[]>;
        load: (id: string) => Promise<Uint8Array>;
        save: (
          data: Uint8Array,
          thumbnail: string,
          workspace: string,
        ) => Promise<LibraryEntry>;
        delete: (id: string) => Promise<void>;
        backups: () => Promise<{ id: string; date: number }[]>;
        backup: () => Promise<void>;
        restore: (id: string) => Promise<void>;
      };
      files: {
        open: () => Promise<{
          bytes: Uint8Array;
          token: string;
          name: string;
          hash: string;
        } | null>;
        save: (
          bytes: Uint8Array,
          title: string,
          token?: string,
          hash?: string,
        ) => Promise<{ token: string; name: string; hash: string } | null>;
        export: (
          bytes: Uint8Array,
          name: string,
          extension: string,
        ) => Promise<boolean>;
      };
      onCommand: (callback: (id: string) => void) => () => void;
      onOpen: (
        callback: (file: {
          bytes: Uint8Array;
          token: string;
          name: string;
          hash: string;
        }) => Promise<void>,
      ) => () => void;
      onPrepare: (callback: () => Promise<void>) => () => void;
      external: (url: string) => Promise<void>;
      updates: {
        state: () => Promise<{
          phase: string;
          message: string;
          version: string | null;
          percent: number;
        }>;
        check: () => Promise<void>;
        download: () => Promise<void>;
        install: () => Promise<void>;
        defer: () => Promise<void>;
        activity: (safe: boolean, lastActivity: number) => void;
        listen: (
          callback: (state: {
            phase: string;
            message: string;
            version: string | null;
            percent: number;
          }) => void,
        ) => () => void;
      };
    };
    showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
  }
}
export {};
