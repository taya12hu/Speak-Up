#!/usr/bin/env node
/**
 * One-off import of the pre-multi-user history file (server/data/sessions.json) into Supabase.
 *
 * Legacy sessions have no owner, so this script never guesses one: the operator must name the
 * account explicitly with --user-id, the script confirms that account exists and prints its email,
 * and nothing is written unless --apply is given. Re-running is safe: rows keep their legacy ids
 * and existing ids are skipped, never overwritten or re-assigned.
 *
 * Usage (from server/):
 *   node scripts/import-legacy-sessions.js --user-id <uuid> [--file data/sessions.json] [--apply]
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env. The service-role key
 * bypasses Row Level Security, which is why it is only ever used by this local script and is
 * never read by the API server or sent to the browser.
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { parseArgs } from 'util';
import { number, object, oneOf, string } from '../src/validation.js';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH_SIZE = 100;

/**
 * Validates legacy records and converts them to practice_sessions rows owned by `userId`.
 * Returns { rows, skipped } where skipped lists each rejected record and why.
 */
export function planImport(records, userId) {
  if (!UUID.test(userId ?? '')) throw new Error('--user-id must be the UUID of an existing Supabase user');
  if (!Array.isArray(records)) throw new Error('The legacy file must contain a JSON array of sessions');

  const rows = [];
  const skipped = [];
  const seen = new Set();

  records.forEach((record, index) => {
    try {
      object(record, 'session');
      if (typeof record.id !== 'string' || !UUID.test(record.id)) throw new Error('"id" is not a UUID');
      if (seen.has(record.id.toLowerCase())) throw new Error('duplicate id in file');
      const createdAt = new Date(record.date);
      if (typeof record.date !== 'string' || Number.isNaN(createdAt.getTime())) throw new Error('"date" is not a valid timestamp');
      const analysis = object(record.analysis, 'analysis');
      number(object(analysis.scores, 'analysis.scores').overall, 'analysis.scores.overall');
      if (!Array.isArray(analysis.grammarIssues)) throw new Error('"analysis.grammarIssues" must be an array');

      rows.push({
        id: record.id,
        user_id: userId,
        created_at: createdAt.toISOString(),
        mode: oneOf(record.mode, 'mode', ['random', 'interview', 'vocab']),
        topic: string(record.topic, 'topic', { max: 1000 }),
        transcript: string(record.transcript, 'transcript', { max: 50_000 }),
        metrics: object(record.metrics, 'metrics'),
        analysis,
      });
      seen.add(record.id.toLowerCase());
    } catch (err) {
      skipped.push({ index, id: typeof record?.id === 'string' ? record.id : undefined, reason: err.message });
    }
  });

  return { rows, skipped };
}

async function main() {
  loadEnv({ path: path.join(SERVER_ROOT, '.env'), quiet: true });
  const { values } = parseArgs({
    options: {
      'user-id': { type: 'string' },
      file: { type: 'string', default: path.join(SERVER_ROOT, 'data', 'sessions.json') },
      apply: { type: 'boolean', default: false },
    },
  });

  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env to run the import.');

  const records = JSON.parse(await readFile(path.resolve(values.file), 'utf-8'));
  const { rows, skipped } = planImport(records, values['user-id']);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(values['user-id']);
  if (ownerError || !owner?.user) throw new Error(`No Supabase user with id ${values['user-id']} (${ownerError?.message ?? 'not found'})`);

  console.log(`Legacy file:     ${path.resolve(values.file)}`);
  console.log(`Owner account:   ${owner.user.email ?? '(no email)'} (${owner.user.id})`);
  console.log(`Valid sessions:  ${rows.length}`);
  console.log(`Skipped:         ${skipped.length}`);
  for (const s of skipped) console.log(`  - record #${s.index}${s.id ? ` (${s.id})` : ''}: ${s.reason}`);

  if (!values.apply) {
    console.log('\nDry run: nothing was written. Re-run with --apply to import into this account.');
    return;
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    // ignoreDuplicates: an id that already exists (e.g. a previous run) is left untouched.
    const { data, error } = await admin
      .from('practice_sessions')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(`Import failed after ${inserted} rows: ${error.message}`);
    inserted += data.length;
  }
  console.log(`\nImported ${inserted} session(s); ${rows.length - inserted} already existed and were left unchanged.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
