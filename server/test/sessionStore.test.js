import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createSessionStore } from '../src/services/sessionStore.js';

const session = (id, date) => ({ id, date, mode: 'random', topic: 't', transcript: 'x', metrics: {}, analysis: {} });

describe('sessionStore', () => {
  let dir;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'speakup-store-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns an empty list when no history file exists', async () => {
    assert.deepEqual(await createSessionStore(dir).list(), []);
  });

  it('persists appended sessions and lists them newest first', async () => {
    const store = createSessionStore(dir);
    await store.append(session('a', '2026-01-01T00:00:00.000Z'));
    await store.append(session('b', '2026-03-01T00:00:00.000Z'));
    await store.append(session('c', '2026-02-01T00:00:00.000Z'));

    const ids = (await createSessionStore(dir).list()).map((s) => s.id);
    assert.deepEqual(ids, ['b', 'c', 'a']);
  });

  it('does not lose writes when appends run concurrently', async () => {
    const store = createSessionStore(dir);
    await Promise.all(Array.from({ length: 25 }, (_, i) => store.append(session(`s${i}`, new Date(i * 1000).toISOString()))));
    assert.equal((await store.list()).length, 25);
  });

  it('refuses to overwrite a corrupted history file', async () => {
    const file = path.join(dir, 'sessions.json');
    await writeFile(file, '[{"id": "a", truncated');
    const store = createSessionStore(dir);

    await assert.rejects(store.list(), SyntaxError);
    await assert.rejects(store.append(session('b', new Date().toISOString())), SyntaxError);
    assert.equal(await readFile(file, 'utf-8'), '[{"id": "a", truncated');
  });

  it('keeps accepting writes after a failed one', async () => {
    const file = path.join(dir, 'sessions.json');
    await writeFile(file, 'not json');
    const store = createSessionStore(dir);
    await assert.rejects(store.append(session('a', new Date().toISOString())));

    await writeFile(file, '[]');
    await store.append(session('b', new Date().toISOString()));
    assert.deepEqual((await store.list()).map((s) => s.id), ['b']);
  });

  it('leaves no temp files behind', async () => {
    await createSessionStore(dir).append(session('a', new Date().toISOString()));
    assert.deepEqual(await readdir(dir), ['sessions.json']);
  });
});
