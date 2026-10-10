import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCORE_WEIGHTS, finalizeScores } from '../src/scoring.js';

const uniform = (value) => Object.fromEntries(Object.keys(SCORE_WEIGHTS).map((k) => [k, value]));

describe('finalizeScores', () => {
  it('uses weights that sum to 1', () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
  });

  it('computes the weighted overall score', () => {
    const scores = { ...uniform(50), grammar: 90, ideaDepth: 70 };
    // 50 + 0.15 * 40 + 0.15 * 20 = 59
    assert.equal(finalizeScores(scores).overall, 59);
  });

  it('ignores a model-supplied overall score', () => {
    assert.equal(finalizeScores({ ...uniform(80), overall: 12 }).overall, 80);
  });

  it('clamps and rounds out-of-range dimension scores', () => {
    const result = finalizeScores({ ...uniform(70), grammar: 130, fluency: -5, vocabulary: 66.6 });
    assert.equal(result.grammar, 100);
    assert.equal(result.fluency, 0);
    assert.equal(result.vocabulary, 67);
  });

  it('rejects a response missing a dimension', () => {
    const { ideaDepth: _omitted, ...partial } = uniform(70);
    assert.throws(() => finalizeScores(partial), /missing the "ideaDepth" score/);
  });
});
