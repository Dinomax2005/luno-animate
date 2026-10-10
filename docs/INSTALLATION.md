# Installers, protected updates, and releases

## For creators

1. Download an owner-reviewed public release, or a successful v0.2 [installer Actions run](https://github.com/Dinomax2005/luno-animate/actions/workflows/installers.yml). Actions downloads need GitHub login and expire after 30 days.
2. Extract the artifact ZIP. Windows opens the `.exe` setup wizard; macOS uses the appropriate Intel/Apple silicon DMG; Linux uses the AppImage or DEB.
3. Open Luno. Its separate first-run wizard chooses a starting project, canvas/FPS, and default export folder. Skipping the tour opens the real project home, not a fake pre-populated library.
4. Create/animate locally. Export `.lam` copies for portable backups. Double-click `.lam` to open it with Luno where the OS association is installed; legacy `.luno` remains supported.

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

There may be no published stable update yet. The app explicitly says so and remains usable offline. Version 0.1 has no updater; install v0.2 once manually. Future releases must preserve the same app identity/user-data directory and migrate document versions without deleting the previous data.

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
- `installers.yml`: native Windows/macOS/Linux build and manifests; native tests on every OS; packaged Linux smoke covering isolation, real filesystem library/LAM/backup, native MP4 with audio, close and association-style startup. Updates are disabled and a temporary profile is used for smoke tests.
- `release.yml`: exact successful installer source (only download-link metadata may differ), flattened assets, verified SHA-512 manifest references, flat SHA-256 download sums, and a **draft release** for explicit owner review.

Workflows can be manually dispatched once they exist on the default branch. Arena branch source pushes already build test installers; publishing/merging main is not a prerequisite for those artifacts. The session branch does not automatically merge to main.

## Publish an update feed

After all installers/tests pass for the same source:

1. Run the draft workflow with `v0.2.0` (matching `package.json`) and that successful installer run ID, or download the verified artifacts and run `node scripts/prepare-release.mjs installers release-assets`.
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
