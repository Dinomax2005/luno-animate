# Installers, protected updates, and releases

## Install v0.4.0

Download the platform assets from the [official v0.4.0 release](https://github.com/Dinomax2005/luno-animate/releases/tag/v0.4.0). Public release downloads do not need a GitHub account or artifact ZIP extraction.

- Windows x64: run the `.exe` setup.
- macOS: use the appropriate Intel/Apple silicon `.dmg`; these development builds are unsigned, not notarized.
- Linux x64: use the `.AppImage` or `.deb` as appropriate to your distribution.

A separate 460 × 282 native blue-eclipse launcher appears while the library and associated document initialize. It closes before the hidden main studio is shown. Startup errors offer Retry or Quit; the browser preview uses a compact card, not a native window or a full-window loading page. The optional workspace configuration chooses panel layout, theme, document source, stage size, and FPS. Skipping it opens the real local document manager. New documents default to a blank stage. Templates are opt-in under **Templates**.

### Update an existing installation

If you already use an updater-enabled v0.2/v0.3.4/v0.3.5/v0.3.6/v0.3.7 Windows build or Linux AppImage, **do not uninstall or reinstall**. Open **Updates & backups → Check GitHub**, download v0.4.0, then choose **Save, back up & restart**, or leave automatic updates enabled. The public stable release and its update manifests—not Actions artifacts—provide the update.

Unsigned macOS and DEB installations still require manual replacement/package-manager updates. This preserves your native library; do not delete the application data directory. v0.1 has no updater and needs one initial manual upgrade.

Save/export portable `.lam` copies for independent backups. `.lam` file association and legacy `.luno` import remain supported.

No development tools/account/server are needed after installation. Linux AppImage may need distribution FUSE support. Do not disable the Chromium sandbox as a normal installation workaround.

Unsigned development installers may trigger Windows publisher warnings and are not a frictionless macOS public installer. Download only the official repository's assets. Signing/notarization and clean-machine Windows/macOS installation tests are required before calling a build a trusted production release.

## What the updater does

**Updates & backups** shows actual GitHub status, automation preference, downloaded update state, and five local complete library snapshots. Automatic checks use official **published stable releases**, never prereleases/drafts/downgrades. Downloads are checksum-verified by electron-updater. Actions ZIP artifacts by themselves cannot update an installed app.

After 2 clean idle minutes, a 30-second notice warns of restart; any activity pauses it. Editing dialogs, playback, exports, imports, dirty/failed saves, and gestures block installation. Choose **Not now** to defer 4 hours. You can also turn automation off or explicitly choose **Save, back up & restart**.

The guarded install path flushes/acknowledges the renderer's latest work/settings, validates and copies the entire native library, fsyncs/re-reads the backup, then permits installation. A failure or interrupted verification does **not** install or close the studio. Regular quitting does not trigger an update. External `.lam` originals are never touched. Close-time failed saves offer Keep editing/Quit without saving.

| Installation | Update installation |
| --- | --- |
| Windows NSIS | Protected download + setup restart |
| macOS Developer ID signed app + signed ZIP feed | Protected automatic installation |
| Unsigned macOS / development | Manual newer installer; automatic install disabled |
| Linux AppImage | Protected AppImage replacement/restart |
| DEB/system-managed Linux | Package-manager/manual update |

Only published stable versions are discoverable. A draft is deliberately invisible to installed applications. The app remains usable offline if checking fails. v0.4.0 preserves application identity, user-data location, native storage, and document schema. Legacy files remain loadable; advanced painting uses an explicit feature flag requiring v0.4.0 or later. Future schema changes need non-destructive migrations.

## Where your work lives

- Browser: IndexedDB `luno-library-v1`, three prior saves, separately persisted preferences. Clearing browser data can remove it; exported `.lam` files are independent.
- Desktop: Electron user-data directory (`luno-animate` under the platform app-data location). `library/projects` contains immutable binary revisions and atomic pointers. `work-backups` contains five complete library snapshots, including Trash/revisions/settings and the **default export-folder setting**, not the external files in that folder.
- Each native project retains current + three prior saves. The home project menu offers **Recover prior save**.
- Backup restore stages/validates the replacement first, makes a new current-library backup, and uses a rollback journal for crash recovery. It restores all projects and settings, not just the selected project.
- A corrupt pointer/file blocks automatic installation instead of silently excluding work. Preserve the entire user-data folder before manual recovery; do not delete it to troubleshoot an update. Keep independent `.lam` copies on another device. No software backup can protect against every hardware/OS failure.

The old current-project localStorage entry is migrated once and retains a migration/recovery copy. Uninstall intentionally leaves app data (`deleteAppDataOnUninstall: false`). Do not use two browser tabs to concurrently edit the same project; cross-tab collaborative merging is not implemented.

## Build and verification

Requires Node.js 22.12+; build on the target OS:

```sh
npm ci
npm run verify
npm run desktop:windows
npm run desktop:mac
npm run desktop:linux
```

`release/` is ignored. Packaging includes generated native validator/updater bundles, renderer/fonts, notices, exact unmodified MPL source ZIP, file associations, and `app-update.yml`. Build-time downloads require GitHub/Electron helper access. Use hosted Actions when local networking blocks them; do not bypass TLS.

- `ci.yml`: types, engine/store/IDB tests, production build, native vault/updater failure tests, full browser media/library/editor tests.
- `installers.yml`: native Windows/macOS/Linux build and manifests; native tests on every OS; packaged Linux smoke covering isolation, real filesystem library/LAM/backup, native MP4 with audio, close, association-style startup, and the real two-window launcher → studio visibility sequence. Updates are disabled and a temporary profile is used for smoke tests; a bounded test-only popup dwell lets the packaged lifecycle test observe both windows.
- `release.yml`: exact successful installer source (only download-link metadata may differ), flattened assets, verified SHA-512 manifest references, flat SHA-256 download sums, and a **draft release** for explicit owner review.

An installer push marked `[prepare-release]` stages a draft only after all matrix builds, tests, and feed checks pass; the draft targets the exact build SHA. Other builds remain artifacts. Workflows can be manually dispatched once they exist on the default branch. Arena branch source pushes already build test installers; publishing/merging main is not a prerequisite for those artifacts. The session branch does not automatically merge to main.

## Publish an update feed

After all installers/tests pass for the same source:

1. Use the verified draft produced by the `[prepare-release]` installer build, run the draft workflow with `v0.4.0` (matching `package.json`) and that successful installer run ID, or download the artifacts and run `node scripts/prepare-release.mjs installers release-assets`.
2. Upload the **flat** assets: Windows EXE + block map, macOS Intel/ARM ZIPs + DMGs + block maps, Linux AppImage/DEB, `latest.yml`, `latest-mac*.yml`, `latest-linux*.yml`, and `SHA256SUMS.txt`. Do not rename installers after generating manifests.
3. Review notes and OS/signing checks. The script validates manifest version, referenced files, and exact SHA-512; SHA-256 sums use flat names matching GitHub downloads (`sha256sum -c SHA256SUMS.txt`).
4. Publish the draft as a **stable, non-prerelease** only after review. Drafts and prereleases are deliberately excluded from the updater. Do not overwrite an existing version's assets—ship a newer version.
5. Test an actual update from the prior packaged version on each supported OS, including update cancellation, insufficient disk space, locked/corrupt documents, interrupted restart, and backup restore. Mock policy tests do not prove real installation on every OS.

Configured feed: `Dinomax2005/luno-animate`, public GitHub stable releases. No credentials are required by the installed app.

## Signing secrets

Configure secrets in **GitHub Settings → Secrets and variables → Actions**, never in code/chat:

| Secret | Use |
| --- | --- |
| `WINDOWS_CERTIFICATE` / `WINDOWS_CERTIFICATE_PASSWORD` | Windows signing certificate/password accepted by electron-builder. |
| `MACOS_CERTIFICATE` / `MACOS_CERTIFICATE_PASSWORD` | Apple Developer ID certificate/password. |
| `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` | Apple notarization. |

Missing/empty secrets are omitted, not interpreted as certificate paths. Public Windows trust depends on certificate reputation too. App ID/name/user-data location must remain stable across releases.

## Release checklist

- [ ] Version metadata and native bridge match; no schema changes without migrations.
- [ ] Types, unit/IDB/native failure tests, browser media decode/cancel, and production build pass.
- [ ] All native installer jobs pass; manifests/block maps are present.
- [ ] Signing/notarization configured where required.
- [ ] Clean-machine Windows/macOS/Linux install/uninstall/file association tested.
- [ ] Actual previous-to-newer update tested, including save/backup failure and restart recovery.
- [ ] Portable import/export with embedded image/audio and multiple scenes verified.
- [ ] Flat checksum/manifest assets validated; publish only after owner review.

## Launch and file-save changes in v0.3.7

After updating, the current What’s New notes appear once. A normal launch then shows Start with New/Open/Recent and the two animation types; disable it with its startup checkbox. Opening an associated `.lam` does not interrupt the canvas with Start. Workspace configuration remains under Help.

Open the external `.lam` through the native picker or file association to authorize in-place Save. Save As explicitly chooses a new destination. Autosave/revisions/backups do not automatically write external files. Capabilities expire on a new renderer session, so a recent library snapshot after restarting needs Open/Save As to link an external destination. Desktop Save refuses externally changed, missing, read-only, symbolic-link, and internal-vault targets; failed/cancelled writes do not silently change the destination.
