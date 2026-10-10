import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';

/**
 * Practice-session history persisted as a single JSON array on local disk.
 *
 * - A missing file means "no sessions yet"; any other read/parse failure is surfaced rather
 *   than treated as empty, so a corrupted file is never silently overwritten on the next save.
 * - Writes go to a temp file and are renamed into place, so a crash mid-write cannot truncate history.
 * - Appends are serialised through a promise chain, so concurrent saves cannot lose each other's
 *   read-modify-write. This is sufficient for a single server process, which is the only supported setup.
 */
export function createSessionStore(dataDir) {
  const file = path.join(dataDir, 'sessions.json');
  let writeQueue = Promise.resolve();

  async function readAll() {
    let raw;
    try {
      raw = await readFile(file, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    const sessions = JSON.parse(raw);
    if (!Array.isArray(sessions)) throw new Error(`${file} does not contain a JSON array`);
    return sessions;
  }

  /** Returns all sessions, newest first. */
  async function list() {
    const sessions = await readAll();
    return sessions.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }

  function append(session) {
    const op = writeQueue.then(async () => {
      const sessions = await readAll();
      sessions.push(session);
      await mkdir(dataDir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(sessions, null, 2));
      await rename(tmp, file);
      return session;
    });
    // Keep the queue alive after a failed write; the caller still sees the rejection via `op`.
    writeQueue = op.catch(() => {});
    return op;
  }

  return { list, append };
}
