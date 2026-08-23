import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [
  spawn(npm, ['run', 'study:server'], { stdio: 'inherit' }),
  spawn(npm, ['run', 'dev:frontend'], { stdio: 'inherit' }),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill('SIGTERM'));
  process.exitCode = exitCode;
}

children.forEach((child) => {
  child.on('exit', (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`Development process stopped (${signal ?? code}).`);
      stop(code ?? 1);
    }
  });
});

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
