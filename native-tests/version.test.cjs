const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');
const { version, name } = require('../package.json');
const { newerStable } = require('../electron/update-policy.cjs');
test('v0.3.4 is eligible for the previous installed updater and identity remains unchanged', () => {
  assert.equal(version, '0.3.4'); assert(newerStable(version, '0.2.0')); assert(!newerStable(version, version));
  assert.equal(name, 'luno-animate');
  assert(readFileSync('electron/preload.cjs', 'utf8').includes(`version: '${version}'`));
  assert.equal(require('../src/config/desktop-build.json').version, version);
  const config = yaml.load(readFileSync('electron-builder.yml', 'utf8'));
  assert.equal(config.appId, 'studio.luno.animate'); assert.equal(config.productName, 'Luno Animate'); assert.equal(config.nsis.deleteAppDataOnUninstall, false);
  assert.equal(config.publish.owner, 'Dinomax2005'); assert.equal(config.publish.repo, 'luno-animate'); assert.equal(config.publish.releaseType, 'release');
  assert(readFileSync('electron/main.cjs', 'utf8').includes('persist:luno-studio'));
});
