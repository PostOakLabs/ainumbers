// replay-house-line.selftest.mjs: controls for gen-replay-house-line.mjs and
// replay-house-subjects.mjs (REPLAY-HOUSE-SIGN-1). Run: node scripts/replay-house-line.selftest.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildHouseLine, serializeLine, BEACON_PREFIX } from './gen-replay-house-line.mjs';
import { deriveSubjects, checksumsText } from './replay-house-subjects.mjs';
import { serializeResult } from './replay-result.mjs';

const SUBJECTS_CLI = fileURLToPath(new URL('./replay-house-subjects.mjs', import.meta.url));
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const RESULT = {
  schema: 'ainumbers.co/replay-result/v1',
  corpus_digest: 'a'.repeat(64),
  exclusion_rules_digest: 'b'.repeat(64),
  excluded_count: 2,
  modules: { ['c'.repeat(64)]: 'd'.repeat(64) },
  mismatches: {},
  root: 'e'.repeat(64),
};
const COUNTS = { modules: 1, vectors: 3 };

test('house line states the two attested digests', () => {
  const line = buildHouseLine({ result: RESULT, counts: COUNTS });
  assert.equal(line.result_sha256, sha256(serializeResult(RESULT)));
  assert.equal(line.beacon_digest, sha256(BEACON_PREFIX + RESULT.corpus_digest));
  assert.equal(line.signature_status, 'signed');
  assert.equal(line.vectors_differing, 0);
});

test('house line is byte-stable, and a changed leaf changes the result digest (red control)', () => {
  const a = serializeLine(buildHouseLine({ result: RESULT, counts: COUNTS }));
  const b = serializeLine(buildHouseLine({ result: RESULT, counts: COUNTS }));
  assert.equal(a, b);
  const moved = { ...RESULT, modules: { ['c'.repeat(64)]: 'f'.repeat(64) } };
  assert.notEqual(buildHouseLine({ result: moved, counts: COUNTS }).result_sha256, JSON.parse(a).result_sha256);
});

test('a differing vector is counted on the line, never dropped', () => {
  const bad = { ...RESULT, mismatches: { ['c'.repeat(64)]: ['v1', 'v2'] } };
  assert.equal(buildHouseLine({ result: bad, counts: COUNTS }).vectors_differing, 2);
});

test('subjects derive from the result bytes and match the house line', () => {
  const bytes = Buffer.from(serializeResult(RESULT), 'utf8');
  const s = deriveSubjects(bytes);
  const line = buildHouseLine({ result: RESULT, counts: COUNTS });
  assert.equal(s.beacon, line.beacon_digest);
  assert.equal(s.result, line.result_sha256);
  assert.equal(checksumsText(s), `${s.beacon}  replay-beacon\n${s.result}  replay-result\n`);
});

test('CRLF result bytes change the result digest (red control: the file must stay LF)', () => {
  const lf = Buffer.from(serializeResult(RESULT), 'utf8');
  const crlf = Buffer.from(serializeResult(RESULT).replace(/\n/g, '\r\n'), 'utf8');
  assert.notEqual(deriveSubjects(lf).result, deriveSubjects(crlf).result);
});

test('a result without corpus_digest is refused', () => {
  assert.throws(() => deriveSubjects(Buffer.from('{}')), /corpus_digest/);
});

test('CLI writes the checksums file and --compare reports MATCH then DIFFERS', () => {
  const dir = mkdtempSync(join(tmpdir(), 'replay-house-'));
  try {
    writeFileSync(join(dir, 'replay-result.json'), serializeResult(RESULT));
    const w = spawnSync(process.execPath, [SUBJECTS_CLI, dir], { encoding: 'utf8' });
    assert.equal(w.status, 0, w.stderr);
    const s = deriveSubjects(readFileSync(join(dir, 'replay-result.json')));
    assert.equal(readFileSync(join(dir, 'replay-subjects.txt'), 'utf8'), checksumsText(s));
    const linePath = join(dir, 'line.json');
    writeFileSync(linePath, serializeLine(buildHouseLine({ result: RESULT, counts: COUNTS })));
    const ok = spawnSync(process.execPath, [SUBJECTS_CLI, dir, '--compare', linePath], { encoding: 'utf8' });
    assert.match(ok.stdout, /^MATCH/);
    writeFileSync(linePath, serializeLine({ ...buildHouseLine({ result: RESULT, counts: COUNTS }), result_sha256: '0'.repeat(64) }));
    const bad = spawnSync(process.execPath, [SUBJECTS_CLI, dir, '--compare', linePath], { encoding: 'utf8' });
    assert.match(bad.stdout, /^DIFFERS/);
    assert.equal(bad.status, 0, 'compare is never fatal');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
