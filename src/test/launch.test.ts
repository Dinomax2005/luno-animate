import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '../config/version';
import { whatsNew } from '../config/whats-new';
import { LAUNCH_KEY, presentLaunch, useLaunch } from '../services/launch';
import { useEditor } from '../store/editor';

beforeEach(() => {
  localStorage.removeItem(LAUNCH_KEY);
  useLaunch.setState({ showStart: true, seenVersion: null, presented: false, pendingStart: false, automaticNews: false, newMode: 'rigged' });
  useEditor.setState({ view: 'home', dialog: null, busy: false, interacting: false, blockReason: null });
});
describe('version-aware launch flow', () => {
  it('shows current release notes before the start window on first launch', () => {
    presentLaunch(); expect(useEditor.getState().dialog).toBe('whats-new'); expect(useLaunch.getState().pendingStart).toBe(true);
    useLaunch.getState().acknowledgeNews(); expect(useEditor.getState().dialog).toBe('start');
    expect(JSON.parse(localStorage.getItem(LAUNCH_KEY)!)).toEqual({ seenVersion: APP_VERSION, showStart: true });
  });
  it('does not repeat the release notes after acknowledgement for the same version', () => {
    useLaunch.setState({ seenVersion: APP_VERSION }); presentLaunch(); expect(useEditor.getState().dialog).toBe('start');
    useEditor.getState().setDialog(null); presentLaunch(); expect(useEditor.getState().dialog).toBeNull();
  });
  it('shows release notes again when upgrading from the previous version', () => {
    useLaunch.setState({ seenVersion: '0.3.4' }); presentLaunch(); expect(useEditor.getState().dialog).toBe('whats-new');
    expect(whatsNew.version).toBe(APP_VERSION); expect(whatsNew.changes).toHaveLength(4);
  });
  it('lets the start window be disabled independently of release notes', () => {
    useLaunch.getState().setShowStart(false); presentLaunch(); expect(useEditor.getState().dialog).toBe('whats-new');
    useLaunch.getState().acknowledgeNews(); expect(useEditor.getState().dialog).toBeNull();
    expect(JSON.parse(localStorage.getItem(LAUNCH_KEY)!).showStart).toBe(false);
  });
  it('does not show Start on top of a file association or a working canvas', () => {
    useLaunch.setState({ seenVersion: APP_VERSION }); presentLaunch(true); expect(useEditor.getState().dialog).toBeNull();
    useLaunch.setState({ presented: false }); useEditor.setState({ view: 'editor' }); presentLaunch(); expect(useEditor.getState().dialog).toBeNull();
  });
  it('can reopen What’s New manually without switching to Start on close', () => {
    useLaunch.setState({ seenVersion: APP_VERSION }); useLaunch.getState().openNews(); expect(useEditor.getState().dialog).toBe('whats-new');
    useLaunch.getState().acknowledgeNews(); expect(useEditor.getState().dialog).toBeNull();
  });
  it('never interrupts an existing dialog or a guarded operation', () => {
    useEditor.setState({ dialog: 'export' }); presentLaunch(); expect(useEditor.getState().dialog).toBe('export');
    useLaunch.setState({ presented: false }); useEditor.setState({ dialog: null, busy: true }); presentLaunch(); expect(useEditor.getState().dialog).toBeNull();
  });
  it('blocked preference storage does not prevent acknowledging notes or opening a document', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    try { presentLaunch(); expect(() => useLaunch.getState().acknowledgeNews()).not.toThrow(); expect(useEditor.getState().dialog).toBe('start'); }
    finally { spy.mockRestore(); }
  });
});
