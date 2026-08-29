import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFailures = [];
const optionalWarnings = [];

function ok(label, detail = '') {
  console.log(`[OK] ${label}${detail ? ` - ${detail}` : ''}`);
}

function warn(label, detail = '') {
  optionalWarnings.push(label);
  console.log(`[WARN] ${label}${detail ? ` - ${detail}` : ''}`);
}

function fail(label, detail = '') {
  requiredFailures.push(label);
  console.log(`[FAIL] ${label}${detail ? ` - ${detail}` : ''}`);
}

function commandVersion(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) return null;
  return (result.stdout || result.stderr || '').trim();
}

function nodeIsSupported(version) {
  const [major, minor] = version.split('.').map(Number);
  if (major === 20) return minor >= 19;
  if (major === 22) return minor >= 13;
  return major >= 24;
}

console.log('* NeuroScape environment doctor');
console.log('');

const nodeVersion = process.versions.node;
if (nodeIsSupported(nodeVersion)) {
  const recommended = existsSync('.nvmrc')
    ? readFileSync('.nvmrc', 'utf8').trim()
    : null;
  ok('Node', `${nodeVersion}${recommended ? ` (repo recommends ${recommended})` : ''}`);
} else {
  fail('Node', `${nodeVersion} does not satisfy package.json engines`);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmVersion = commandVersion(npmCommand);
if (npmVersion) ok('npm', npmVersion);
else fail('npm', 'not found');

const justVersion = commandVersion('just');
if (justVersion) ok('just', justVersion);
else fail('just', 'not found');

const pythonCandidates = [
  process.env.NEUROSCAPE_PYTHON
    ? { command: process.env.NEUROSCAPE_PYTHON, prefix: [] }
    : null,
  { command: 'python3.13', prefix: [] },
  { command: 'python3.12', prefix: [] },
  { command: 'python3.11', prefix: [] },
  { command: 'python3', prefix: [] },
  { command: 'python', prefix: [] },
  ...(process.platform === 'win32'
    ? [{ command: 'py', prefix: ['-3'] }]
    : []),
].filter(Boolean);

let python = null;
for (const candidate of pythonCandidates) {
  const result = spawnSync(
    candidate.command,
    [
      ...candidate.prefix,
      '-c',
      'import sys; print(sys.version.split()[0]); raise SystemExit(0 if sys.version_info >= (3, 11) else 1)',
    ],
    { encoding: 'utf8', shell: false },
  );
  if (result.status === 0) {
    python = {
      command: candidate.command,
      version: result.stdout.trim(),
    };
    break;
  }
}

if (python) ok('Python', `${python.version} via ${python.command}`);
else fail('Python', '3.11+ not found');

if (existsSync('node_modules')) ok('Node dependencies', 'node_modules present');
else warn('Node dependencies', 'run `just setup`');

const venvPython =
  process.platform === 'win32'
    ? 'eeg-calibration/.venv/Scripts/python.exe'
    : 'eeg-calibration/.venv/bin/python';

if (existsSync(venvPython)) ok('EEG calibration venv', venvPython);
else warn('EEG calibration venv', 'run `just setup`');

if (existsSync('.env')) ok('.env', 'present');
else warn('.env', 'optional for mock modes; required for live OpenAI-backed operation');

console.log('');
if (requiredFailures.length) {
  console.log(`[FAIL] ${requiredFailures.length} required environment check(s) failed`);
  process.exit(1);
}

if (optionalWarnings.length) {
  console.log(`[WARN] ${optionalWarnings.length} optional/readiness warning(s)`);
} else {
  console.log('[OK] Environment ready');
}
