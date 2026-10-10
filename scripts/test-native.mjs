import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';

// Explicit files work consistently on cmd.exe and POSIX shells. Keep a useful
// annotation when a runner's archived logs are temporarily unavailable.
const tests = (await readdir('native-tests')).filter(name => name.endsWith('.test.cjs')).sort().map(name => `native-tests/${name}`);
const child = spawn(process.execPath, ['--test', ...tests], { stdio: ['ignore', 'pipe', 'pipe'] });
let tail = '';
function capture(data, output) { output.write(data); tail = (tail + data.toString()).slice(-24_000); }
child.stdout.on('data', data => capture(data, process.stdout));
child.stderr.on('data', data => capture(data, process.stderr));
function annotate(text) {
  for (const key of ['GH_TOKEN', 'GITHUB_TOKEN', 'CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_APP_SPECIFIC_PASSWORD']) if (process.env[key]) text = text.replaceAll(process.env[key], '[redacted]');
  process.stdout.write(`::error title=Native filesystem/update tests failed::${text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}\n`);
}
child.on('error', error => { if (process.env.GITHUB_ACTIONS) annotate(error.message); process.exitCode = 1; });
child.on('close', code => { if (code !== 0 && process.env.GITHUB_ACTIONS) annotate(tail || 'Native tests could not finish.'); process.exitCode = code ?? 1; });
