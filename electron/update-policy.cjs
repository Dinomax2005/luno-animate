const semver = require('semver');
const IDLE_MS = 120_000;
const COUNTDOWN_SECONDS = 30;
function newerStable(version, current) { return Boolean(typeof version === 'string' && semver.valid(version) && semver.valid(current) && !semver.prerelease(version) && semver.gt(version, current)); }
function safeToPrepare(activity) { return Boolean(activity && !activity.busy && !activity.playing && !activity.interacting); }
function safeToAutoInstall(activity, now) { return safeToPrepare(activity) && !activity.dirty && Number.isFinite(activity.lastActivity) && now - activity.lastActivity >= IDLE_MS; }
module.exports = { newerStable, safeToPrepare, safeToAutoInstall, IDLE_MS, COUNTDOWN_SECONDS };
