// scripts/compare-obligation-spans.selftest.mjs — controls for
// scripts/compare-obligation-spans.mjs (row OBLIGATION-REPIN-1).
//
// Builds a fixture pair of excerpts (old text, then the same text re-pinned
// with an amended middle segment) and proves the helper: marks the unchanged
// spans MATCH and the changed/shifted/out-of-range spans DIFFERS, verifies both
// digests, and refuses bad inputs. All fixture text below is synthetic and our
// own; no source text appears in this file.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HELPER = join(HERE, 'compare-obligation-spans.mjs');
const failures = [];
const ok = (m) => console.log('  PASS ' + m);
const fail = (m) => { failures.push(m); console.log('  FAIL ' + m); };
const sha = (s) => 'sha256:' + createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');

// run the helper as a subprocess; never let a nonzero exit throw
function run(args) {
  const r = spawnSync('node', [HELPER, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// ── fixture pair ─────────────────────────────────────────────────────────────
const head1 = 'the head segment stays fixed in both texts.';
const head2 = 'a second head segment for a second matching span.';
const middleOld = 'middle region subject to change alpha beta gamma.';
const middleNew = 'middle region amended delta epsilon zeta now extended.';
const tail = 'tail segment that shifts when the middle changes length.';
const oldText = [head1, head2, middleOld, tail].join('\n') + '\n';
const newText = [head1, head2, middleNew, tail].join('\n') + '\n';
const truncText = [head1, head2, middleNew].join('\n') + '\n';
const off = (s) => Buffer.byteLength(s, 'utf8');
const O1s = 0, O1e = off(head1);
const O2s = O1e + 1, O2e = O2s + off(head2);
const O3s = O2e + 1, O3e = O3s + off(middleOld);
const O4s = O3e + 1, O4e = O4s + off(tail);

const list = {
  clause_digest: sha(oldText),
  excerpt_bytes: off(oldText),
  split_by: 'model-a', split_at: '2026-11-16',
  reviewed_by: 'model-b', reviewed_at: '2026-11-16',
  obligations: [
    { id: 'O1', label: 'head obligation one', span: { start: O1s, end: O1e }, kind: 'condition' },
    { id: 'O2', label: 'head obligation two', span: { start: O2s, end: O2e }, kind: 'condition' },
    { id: 'O3', label: 'middle obligation three', span: { start: O3s, end: O3e }, kind: 'threshold' },
    { id: 'O4', label: 'tail obligation four', span: { start: O4s, end: O4e }, kind: 'procedure' },
  ],
};

const tmp = mkdtempSync(join(tmpdir(), 'span-compare-'));
const listPath = join(tmp, 'old-list.json');
const oldPath = join(tmp, 'old.txt');
const newPath = join(tmp, 'new.txt');
const truncPath = join(tmp, 'trunc.txt');
writeFileSync(listPath, JSON.stringify(list, null, 2));
writeFileSync(oldPath, oldText);
writeFileSync(newPath, newText);
writeFileSync(truncPath, truncText);

// ── green: unchanged spans marked, changed spans named ───────────────────────
console.log('span compare on a fixture pair (red controls, then green):');
{
  const r = run(['--list', listPath, '--old-excerpt', oldPath, '--new-excerpt', newPath, '--new-digest', sha(newText)]);
  const out = r.stdout;
  if (r.status === 0) ok('clean run exits 0');
  else fail(`clean run exited ${r.status}: ${r.stderr.slice(0, 120)}`);
  if (out.includes(`MATCH   O1 [${O1s},${O1e}) condition: head obligation one`)) ok('unchanged head span O1 marked MATCH');
  else fail('O1 not marked MATCH: ' + out.split('\n').find((l) => l.includes('O1')) || out.slice(0, 200));
  if (out.includes(`MATCH   O2 [${O2s},${O2e}) condition: head obligation two`)) ok('unchanged head span O2 marked MATCH');
  else fail('O2 not marked MATCH');
  if (out.includes(`DIFFERS O3 [${O3s},${O3e}) threshold: middle obligation three (first differing byte at offset ${O3s + 14})`)) ok('amended middle span O3 marked DIFFERS with the first differing byte');
  else fail('O3 not marked DIFFERS with a byte offset: ' + (out.split('\n').find((l) => l.includes('DIFFERS O3')) || '').slice(0, 160));
  if (out.includes(`DIFFERS O4 [${O4s},${O4e}) procedure: tail obligation four (first differing byte at offset ${O4s})`)) ok('shifted tail span O4 marked DIFFERS at its start offset');
  else fail('O4 not marked DIFFERS: ' + (out.split('\n').find((l) => l.includes('DIFFERS O4')) || '').slice(0, 160));
  if (out.includes('summary: 2 of 4 obligation spans still match byte for byte; 2 differ')) ok('summary counts 2 of 4');
  else fail('summary line wrong: ' + (out.split('\n').find((l) => l.startsWith('summary')) || '(none)'));
  if (out.includes('propose-obligation-split.mjs')) ok('report points at the fresh-split helper');
  else fail('no next-step pointer to propose-obligation-split.mjs');
  if (!out.includes('note: no --new-digest given')) ok('no note line when --new-digest is given');
  else fail('note line printed despite --new-digest');
  // the report must never carry excerpt bytes: only labels
  const leaked = [head1.slice(8, 24), middleOld.slice(8, 24), tail.slice(8, 24)].filter((t) => out.includes(t));
  if (!leaked.length) ok('no excerpt bytes in the report');
  else fail('report leaked excerpt text: ' + leaked[0]);
}

// ── red controls ─────────────────────────────────────────────────────────────
{
  const wrongNew = run(['--list', listPath, '--old-excerpt', oldPath, '--new-excerpt', newPath, '--new-digest', sha(truncText)]);
  if (wrongNew.status === 1 && wrongNew.stderr.includes('new excerpt does not hash to --new-digest')) ok('wrong --new-digest refused (exit 1)');
  else fail(`wrong --new-digest not refused: status ${wrongNew.status} ${wrongNew.stderr.slice(0, 120)}`);

  const tampered = join(tmp, 'old-tampered.txt');
  writeFileSync(tampered, oldText.replace('fixed', 'altered'));
  const rOld = run(['--list', listPath, '--old-excerpt', tampered, '--new-excerpt', newPath]);
  if (rOld.status === 1 && rOld.stderr.includes("does not hash to the list's clause_digest")) ok('tampered old excerpt refused against the pinned digest');
  else fail(`tampered old excerpt not refused: status ${rOld.status} ${rOld.stderr.slice(0, 120)}`);

  const noList = run(['--old-excerpt', oldPath, '--new-excerpt', newPath]);
  if (noList.status === 2 && noList.stderr.includes('usage:')) ok('missing --list is a usage error (exit 2)');
  else fail(`missing --list not a usage error: status ${noList.status}`);

  const badList = join(tmp, 'bad-list.json');
  writeFileSync(badList, JSON.stringify({ clause_digest: sha(oldText), excerpt_bytes: 10, obligations: [] }));
  const rBad = run(['--list', badList, '--old-excerpt', oldPath, '--new-excerpt', newPath]);
  if (rBad.status === 2 && rBad.stderr.includes('no obligations')) ok('list without obligations refused (exit 2)');
  else fail(`empty list not refused: status ${rBad.status} ${rBad.stderr.slice(0, 120)}`);

  const rTrunc = run(['--list', listPath, '--old-excerpt', oldPath, '--new-excerpt', truncPath]);
  if (rTrunc.status === 0 && rTrunc.stdout.includes(`DIFFERS O4 [${O4s},${O4e}) procedure: tail obligation four (span runs past the end of the new excerpt (${off(truncText)} bytes))`)) ok('span past the end of the new excerpt marked DIFFERS');
  else fail('truncated-new run wrong: ' + (rTrunc.stdout.split('\n').find((l) => l.includes('DIFFERS O4')) || `status ${rTrunc.status}`).slice(0, 160));
  if (rTrunc.stdout.includes('summary: 2 of 4 obligation spans still match byte for byte; 2 differ')) ok('truncated-new summary counts 2 of 4');
  else fail('truncated-new summary wrong: ' + (rTrunc.stdout.split('\n').find((l) => l.startsWith('summary')) || '(none)'));
}

rmSync(tmp, { recursive: true, force: true });
console.log(failures.length ? `SELFTEST RED: ${failures.length} failure(s)` : 'SELFTEST GREEN: all controls passed');
process.exit(failures.length ? 1 : 0);
