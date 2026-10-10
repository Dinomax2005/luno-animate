# Installers and releases

## Installation for creators

A packaged Luno build is a standalone desktop app. Its installation wizard and first-run studio wizard are separate:

1. **The OS installer** puts Luno on your computer. Windows uses an NSIS guided wizard, macOS uses a drag-to-Applications DMG, Linux uses AppImage/DEB.
2. **The studio wizard** chooses your project template, canvas, frame rate, and (on desktop) default project folder. It only appears automatically on first launch. Reopen it any time with **Quick setup**.

Download installer artifacts from a successful `Build desktop installers` GitHub Actions run. Artifacts are ZIP containers, not the installer itself: extract them before opening the enclosed `.exe`, `.dmg`, `.deb`, or `.AppImage`. Artifacts require a GitHub login and expire after 30 days.

For Linux AppImage, your distribution may require FUSE support. The DEB is the alternative on Debian/Ubuntu. Do not disable Chromium's sandbox as a normal installation workaround.

Use `.luno` project files for reliable backups and sharing between computers. Images are embedded; no external assets need to be copied. The desktop app registers `.luno` file associations where supported by the operating system.

## Building on your computer

Install Node.js 22.12+ once, then:

```sh
npm ci
npm run verify
npm run desktop:windows # on Windows
npm run desktop:mac     # on macOS
npm run desktop:linux   # on Linux
```

Find the installers in `release/`. The `electron-builder.yml` file contains all packaging settings. On Windows, `oneClick: false` and `allowToChangeInstallationDirectory: true` provide guided installation rather than a silent installer. User app data is not intentionally removed during uninstall.

Initial builds download Electron and electron-builder helper binaries from GitHub. A network that blocks GitHub release-asset hosts can prevent native packaging even when the editor builds successfully. In that environment use the native GitHub Actions build workflow, not an insecure TLS override.

## Build automation

- `ci.yml`: types, unit tests, production renderer, and browser tests on pushes and PRs.
- `installers.yml`: builds Windows, macOS, and Linux on native runners. After the workflow is on the default branch, it can be run manually. It runs automatically on Arena working branches when app sources change. It uploads installers without publishing a public release or changing the default branch.
- `release.yml`: accepts a version tag and successful installer run ID, validates that the run belongs to the exact source commit, downloads the artifacts, computes SHA-256 checksums, and creates a **draft, prerelease** release. Publication is an explicit owner action.

Nothing in the app auto-updates or downloads remote code. Creators can download a newer installer and keep using existing `.luno` files.

Manual workflow dispatch becomes available after the workflow files are on the repository’s default branch. Arena branch pushes already trigger installer builds; no default-branch change is required to get test artifacts.

## Signing for public distribution

Without certificates, artifacts are **unsigned development builds**. Windows may warn about an unknown publisher. macOS unsigned builds are not intended for normal double-click public distribution. Production release claims should only be made after signing, notarization, and installation tests on the target OS.

Optional GitHub Actions repository secrets:

| Secret | Use |
| --- | --- |
| `WINDOWS_CERTIFICATE` | Windows code-signing certificate accepted by electron-builder (`CSC_LINK`). |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the Windows certificate. |
| `MACOS_CERTIFICATE` | Apple Developer ID certificate accepted by electron-builder. |
| `MACOS_CERTIFICATE_PASSWORD` | Password for the Apple certificate. |
| `APPLE_ID` | Apple account for notarization. |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific notarization password. |
| `APPLE_TEAM_ID` | Apple Developer team. |

Configure secrets **in GitHub Settings → Secrets and variables → Actions**, never in source code or chat. The build workflow passes them only to the appropriate platform job. Full production Windows trust also depends on your certificate provider/reputation.

## Release checklist

- [ ] Update `package.json`, preload version, and UI version labels together.
- [ ] Pass CI and all native installer jobs for the same source commit.
- [ ] Configure signing and notarization for a frictionless public release.
- [ ] Install/uninstall on clean Windows, macOS, and Linux machines.
- [ ] Open a `.luno` file through the OS file association.
- [ ] Verify wizard state and autosave survive app restart/update.
- [ ] Export/import a project containing embedded artwork.
- [ ] Verify published checksums and document early-version limitations.
- [ ] Publish the draft release after review; keep a copy of install artifacts.
