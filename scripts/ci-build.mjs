import { spawn } from 'node:child_process';

const targets = { Windows: 'desktop:windows', macOS: 'desktop:mac', Linux: 'desktop:linux' };
const platform = process.argv[2];
if (!Object.hasOwn(targets, platform)) throw new Error('Choose Windows, macOS, or Linux.');
const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(command, ['run', targets[platform], '--', '--publish', 'never'], { shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
let tail = '';
const capture = (data, destination) => {
  destination.write(data);
  tail = (tail + data.toString()).slice(-24_000);
};
child.stdout.on('data', data => capture(data, process.stdout));
child.stderr.on('data', data => capture(data, process.stderr));
const annotate = message => {
  // Never encode known signing credentials into an annotation. Normal CI logs
  // are masked by GitHub as well, but redaction here protects the encoded form.
  for (const name of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID', 'GH_TOKEN', 'GITHUB_TOKEN']) {
    const value = process.env[name];
    if (value) message = message.replaceAll(value, '[redacted]');
  }
  message = message.replace(/\u001b\[[0-9;]*m/g, '').replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  process.stdout.write(`::error title=${platform} installer build failed::${message}\n`);
};
child.on('error', error => { annotate(error.message); process.exitCode = 1; });
child.on('close', code => {
  if (code !== 0) annotate(tail || 'The native installer process could not finish.');
  process.exitCode = code ?? 1;
});
