import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createStudyServer, validateStudyPath } from '../src/server-lib.mjs';

let server;
afterEach(() => server?.close());

describe('study recorder server', () => {
  it('rejects traversal-like IDs and filenames', () => {
    expect(() => validateStudyPath('../P1', 'session', 'file.json')).toThrow();
    expect(() => validateStudyPath('P1', 'session', '../file.json')).toThrow();
  });

  it('writes artifacts and a completion marker inside the configured root', async () => {
    const resultsRoot = await mkdtemp(join(tmpdir(), 'neuroscape-study-'));
    server = createStudyServer({ resultsRoot });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const base = `http://127.0.0.1:${address.port}`;
    const uploaded = await fetch(
      `${base}/api/study/sessions/P001/session-01/artifacts/manifest.json`,
      { method: 'PUT', body: '{"ok":true}' },
    );
    expect(uploaded.status).toBe(201);
    const finalized = await fetch(
      `${base}/api/study/sessions/P001/session-01/finalize`,
      { method: 'POST' },
    );
    expect(finalized.status).toBe(200);
    expect(
      await readFile(
        join(resultsRoot, 'P001', 'session-01', 'manifest.json'),
        'utf8',
      ),
    ).toBe('{"ok":true}');
    expect(
      JSON.parse(
        await readFile(
          join(resultsRoot, 'P001', 'session-01', '_COMPLETE.json'),
          'utf8',
        ),
      ).participantId,
    ).toBe('P001');
  });
});
