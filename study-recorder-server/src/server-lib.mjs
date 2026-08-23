import { createServer } from 'node:http';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DEFAULT_RESULTS_ROOT = resolve(
  fileURLToPath(new URL('../..', import.meta.url)),
  'study-results',
);

export function validateStudyPath(participantId, sessionId, filename) {
  if (!SAFE_ID.test(participantId)) throw new Error('Invalid participant ID.');
  if (!SAFE_ID.test(sessionId)) throw new Error('Invalid session ID.');
  if (filename !== undefined && !SAFE_FILE.test(filename))
    throw new Error('Invalid artifact filename.');
}

function json(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  response.end(JSON.stringify(payload));
}

async function writeRequestBody(request, destination, maximumBytes) {
  let received = 0;
  request.on('data', (chunk) => {
    received += chunk.length;
    if (received > maximumBytes)
      request.destroy(new Error('Artifact exceeds size limit.'));
  });
  await pipeline(request, createWriteStream(destination, { flags: 'wx' }));
}

export function createStudyServer(options = {}) {
  const resultsRoot = resolve(
    options.resultsRoot ??
      process.env.NEUROSCAPE_RESULTS_DIR ??
      DEFAULT_RESULTS_ROOT,
  );
  const maximumBytes = options.maximumBytes ?? 256 * 1024 * 1024;
  return createServer(async (request, response) => {
    response.setHeader('access-control-allow-origin', '*');
    response.setHeader(
      'access-control-allow-methods',
      'GET, PUT, POST, OPTIONS',
    );
    response.setHeader('access-control-allow-headers', 'content-type');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/api/study/health') {
      json(response, 200, { ok: true, resultsRoot });
      return;
    }
    const artifactMatch = url.pathname.match(
      /^\/api\/study\/sessions\/([^/]+)\/([^/]+)\/artifacts\/([^/]+)$/,
    );
    const finalizeMatch = url.pathname.match(
      /^\/api\/study\/sessions\/([^/]+)\/([^/]+)\/finalize$/,
    );
    try {
      if (request.method === 'PUT' && artifactMatch) {
        const [, participantId, sessionId, filename] = artifactMatch.map(
          (value) => decodeURIComponent(value),
        );
        validateStudyPath(participantId, sessionId, filename);
        const sessionDirectory = resolve(resultsRoot, participantId, sessionId);
        await mkdir(sessionDirectory, { recursive: true });
        const destination = resolve(sessionDirectory, filename);
        const temporary = `${destination}.upload-${Date.now()}`;
        try {
          await writeRequestBody(request, temporary, maximumBytes);
          await rm(destination, { force: true });
          await rename(temporary, destination);
        } catch (error) {
          await rm(temporary, { force: true });
          throw error;
        }
        json(response, 201, { ok: true, participantId, sessionId, filename });
        return;
      }
      if (request.method === 'POST' && finalizeMatch) {
        const [, participantId, sessionId] = finalizeMatch.map((value) =>
          decodeURIComponent(value),
        );
        validateStudyPath(participantId, sessionId);
        const sessionDirectory = resolve(resultsRoot, participantId, sessionId);
        await mkdir(sessionDirectory, { recursive: true });
        await writeFile(
          resolve(sessionDirectory, '_COMPLETE.json'),
          JSON.stringify(
            { participantId, sessionId, finalizedAt: new Date().toISOString() },
            null,
            2,
          ),
        );
        json(response, 200, {
          ok: true,
          participantId,
          sessionId,
          directory: sessionDirectory,
        });
        return;
      }
      json(response, 404, { ok: false, error: 'Not found.' });
    } catch (error) {
      json(
        response,
        error instanceof Error && error.message.startsWith('Invalid')
          ? 400
          : 500,
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  });
}
