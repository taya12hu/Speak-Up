import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { planImport } from '../scripts/import-legacy-sessions.js';

const owner = randomUUID();
const legacy = (overrides = {}) => ({
  id: randomUUID(),
  date: '2026-07-12T12:05:08.065Z',
  mode: 'random',
  topic: 'How does our environment shape our identity?',
  transcript: 'I think that the environment...',
  metrics: { fillerCount: 1, fillerBreakdown: {}, wpm: 110, pauseCount: 0, longestPauseSec: 0, totalPauseSec: 0 },
  // Legacy shape: no topicRelevance/ideaDepth/stuckPoints, no grammar categories.
  analysis: { nativeRewrite: '', grammarIssues: [{ original: 'a', corrected: 'b', explanation: 'c' }], pronunciationTips: [], fluencyCommentary: '', scores: { overall: 74 }, summary: '' },
  ...overrides,
});

describe('planImport (legacy sessions.json → practice_sessions)', () => {
  it('requires an explicit owner and never guesses one', () => {
    assert.throws(() => planImport([legacy()], undefined), /--user-id/);
    assert.throws(() => planImport([legacy()], 'someone@example.com'), /--user-id/);
  });

  it('assigns every row to the named owner, keeping legacy id and date', () => {
    const record = legacy();
    const { rows, skipped } = planImport([record], owner);
    assert.deepEqual(skipped, []);
    assert.equal(rows[0].user_id, owner);
    assert.equal(rows[0].id, record.id);
    assert.equal(rows[0].created_at, '2026-07-12T12:05:08.065Z');
    assert.deepEqual(rows[0].analysis, record.analysis);
  });

  it('ignores any ownership field present in the legacy data', () => {
    const { rows } = planImport([legacy({ user_id: randomUUID() })], owner);
    assert.equal(rows[0].user_id, owner);
    assert.equal(Object.keys(rows[0]).includes('userId'), false);
  });

  it('skips invalid records with a reason instead of failing the whole import', () => {
    const dup = legacy();
    const { rows, skipped } = planImport(
      [legacy({ id: 'not-a-uuid' }), legacy({ date: 'yesterday' }), legacy({ mode: 'history' }), legacy({ analysis: { grammarIssues: [] } }), dup, { ...dup }, 'junk'],
      owner,
    );
    assert.equal(rows.length, 1);
    assert.deepEqual(
      skipped.map((s) => s.index),
      [0, 1, 2, 3, 5, 6],
    );
    assert.match(skipped.find((s) => s.index === 5).reason, /duplicate/);
  });

  it('rejects a file that is not an array', () => {
    assert.throws(() => planImport({ sessions: [] }, owner), /JSON array/);
  });
});
