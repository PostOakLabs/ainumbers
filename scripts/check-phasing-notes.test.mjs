#!/usr/bin/env node
// check-phasing-notes.test.mjs — SO #40(b) RED-before-GREEN proof for scripts/check-phasing-notes.mjs
// (STALE-PHASING-NOTE-SWEEP-1).
//
// Six layers, each answering a question the gate would otherwise only assert about itself:
//   1. RED          a bare phasing note with no checkable form IS flagged
//   2. GREEN        the SAME note, given a date or a command, is NOT flagged
//   3. FALSE-POS    legitimate prose using the same vocabulary is NOT flagged — pinned VERBATIM
//                   from the live corpus, so a future loosening of the patterns reds here first
//   4. KNOWN-ANSWER the real kernel-contract.test.mjs:23-27 text is flagged (the row's own check)
//   5. RATCHET      the ceiling refuses an increase and reports a decrease
//   6. ANTI-DRIFT   the gate still loads its baseline through the HARD-FAILING shared loader, and
//                   the self-exclusion list has not been widened
//
// Zero-dependency. Exits 1 on the first failing assertion with the layer named.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanText, extractNotes, phasingReasons, checkableForm, ratchetVerdict, inScope, SELF_EXCLUDE } from './check-phasing-notes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
let failures = 0;
const ok = (cond, layer, msg) => {
  if (cond) { console.log(`  ✓ ${layer}: ${msg}`); return; }
  failures++;
  console.error(`  ✗ ${layer}: ${msg}`);
};

// ── LAYER 1 — RED ────────────────────────────────────────────────────────────────────────────
// The bare note the row asks for: a "for now" statement that names its own exit and gives the
// reader no way to find out where the condition stands.
console.log('LAYER 1 — RED: bare phasing note, no checkable form');
const RED_NOTE = [
  '// Phasing: the coverage check is a WARNING for now, because most nodes have no fixture yet.',
  '// Flip to --strict once every node ships one.',
].join('\n');
{
  const hits = scanText(RED_NOTE, 'mjs');
  ok(hits.length === 1, 'L1', `bare "for now ... flip to ... once every" note flagged (got ${hits.length} hit(s))`);
  ok(hits.length === 1 && hits[0].reasons.length >= 1, 'L1', `reasons named: ${hits[0]?.reasons.join(' + ') || '(none)'}`);
  ok(checkableForm(RED_NOTE) === null, 'L1', 'the note carries NO checkable form');
}

// ── LAYER 2 — GREEN ──────────────────────────────────────────────────────────────────────────
// The SAME sentence, twice, each time given one of the two accepted forms. Nothing else changes:
// the phasing language is still there, and still correctly recognised as phasing language.
console.log('LAYER 2 — GREEN: the same note with a date, and with a command');
const GREEN_DATE = [
  '// Phasing: the coverage check is a WARNING for now, because most nodes have no fixture yet.',
  '// Flip to --strict once every node ships one. Measured 2026-08-23: 629 of 629 have one.',
].join('\n');
const GREEN_CMD = [
  '// Phasing: the coverage check is a WARNING for now, because most nodes have no fixture yet.',
  '// Flip to --strict once every node ships one. Where it stands:',
  '// run `node chaingraph/kernels/kernel-contract.test.mjs --strict`.',
].join('\n');
{
  ok(phasingReasons(GREEN_DATE).length > 0, 'L2', 'dated note is still RECOGNISED as a phasing note (the gate did not stop looking)');
  ok(scanText(GREEN_DATE, 'mjs').length === 0, 'L2', `dated note passes — checkable form: ${checkableForm(GREEN_DATE)}`);
  ok(phasingReasons(GREEN_CMD).length > 0, 'L2', 'commanded note is still RECOGNISED as a phasing note');
  ok(scanText(GREEN_CMD, 'mjs').length === 0, 'L2', `commanded note passes — checkable form: ${checkableForm(GREEN_CMD)}`);
  // ⛔ The rejected third form, stated as a test so nobody "fixes" it back in: a bare hardcoded
  // count is NOT a checkable form. It is the exact artifact that went stale.
  const BARE_COUNT = [
    '// Phasing: the coverage check is a WARNING for now — only 5 of ~79 nodes ship a fixture.',
    '// Flip to --strict once every node ships one.',
  ].join('\n');
  ok(scanText(BARE_COUNT, 'mjs').length === 1, 'L2', 'a bare hardcoded count is REFUSED as a checkable form (it is the form that went stale)');
}

// ── LAYER 3 — FALSE-POSITIVE SAFE ────────────────────────────────────────────────────────────
// ⭐ THE LAYER THAT DECIDES WHETHER THIS LINT SURVIVES. Every string below is real prose lifted
// verbatim from this repo, uses one of the phasing keywords, and is NOT a phasing note. A lint
// that fires on these gets baselined into uselessness inside a week.
console.log('LAYER 3 — FALSE-POSITIVE SAFE: legitimate prose using the same vocabulary');
const LEGIT = [
  // "currently" + "later" describing a CALL, not a deadline (chaingraph/kernels/_proof.mjs)
  ['// Callers are expected to vet `hash.oid` first; calling this helper directly with a hash object',
   '// that lacks `oid` currently throws later inside `concatBytes(...)`.'].join('\n'),
  // "once every" as CONTROL FLOW, not a phase exit (scripts/gen-registry-lineage.mjs)
  '// 7. Only once every step above has succeeded does it write tiles + entry bundles to disk.',
  // "once every" as an ALGORITHM description (chaingraph/kernels/_proof.mjs)
  '// dependency-ordered sweep: a proof runs once every previousProof id it names is verified',
  // "not yet" + "when <x>" as a CONDITIONAL, not a deadline (chaingraph/kernels/lint-forbidden-hash.mjs)
  ['// --only <tool-id>: scope to ONE node (whole-estate run is unchanged when this flag is absent).',
   '// A shard not yet assembled into chaingraph.json has no entry here yet — reported, not a failure.'].join('\n'),
  // "until now" — PAST tense: the condition already resolved (scripts/preflight.mjs)
  '// The page axis had no gate at all until now: art-231 shipped a corrected kernel silently.',
  // "until ... lands" describing a RECURRING operational window, naming no future edit (scripts/preflight.mjs)
  ['// an assembled chaingraph.json change means the worker repo freshness gate will read RED',
   '// until the batched vendor land runs — an expected window, not breakage.'].join('\n'),
  // "advisory ... until" narrating a CLOSED incident in the past tense. This one was caught by the
  // merge queue: a PR merging alongside added it, and the first version of the pattern went red on
  // it against the merged result (scripts/check-workflow-gate-parity.mjs).
  ['// deferred a missing registry record to main\'s writer on the (locally correct) reading that',
   '// the gate was advisory, and `land-verify / required` stayed red until the record was written.'].join('\n'),
  // "pending" as ordinary domain vocabulary — the single highest-volume keyword in the naive sweep
  "// An unpopulated slot returns a clear 'pending' error rather than emit an invented concept.",
  // a bare "currently" with no exit condition at all — an observation, not a phase
  '// The CONTRACT §1.3 PII banner is mandated verbatim and currently contains an em-dash.',
  // "today" with no exit condition — likewise an observation
  '// 105 server kernels today carry a bare-string regulatory_basis. Converting one moves its hash.',
];
LEGIT.forEach((src, i) => {
  const hits = scanText(src, 'mjs');
  ok(hits.length === 0, 'L3', `legit prose #${i + 1} NOT flagged: "${src.replace(/\s+/g, ' ').slice(4, 84)}..."`);
});
// And the positive control for this layer: the vocabulary alone is not what fires the gate.
ok(phasingReasons('// this is currently the fastest path').length === 0, 'L3', 'a bare "currently" is not a phasing note');
ok(phasingReasons('// the record stays pending until reviewed').length === 0, 'L3', 'a bare "pending ... until" with no provisional/change marker is not a phasing note');

// ── LAYER 4 — KNOWN-ANSWER ───────────────────────────────────────────────────────────────────
// The row's own check: if the sweep does not find kernel-contract.test.mjs:23-27, the sweep is
// wrong. Read from the REAL file, not a copy, so a future edit to that comment is noticed here.
console.log('LAYER 4 — KNOWN-ANSWER: the real kernel-contract.test.mjs phasing note');
{
  const rel = 'chaingraph/kernels/kernel-contract.test.mjs';
  ok(inScope(rel), 'L4', `${rel} is in scope`);
  const hits = scanText(readFileSync(resolve(REPO, rel), 'utf8'), 'mjs');
  const known = hits.find((h) => h.line >= 20 && h.line <= 30);
  ok(!!known, 'L4', `the known phasing note is flagged at line ${known?.line ?? '(NOT FOUND)'} — reasons: ${known?.reasons.join(' + ') ?? 'n/a'}`);
  // ⛔ Granularity control. The same file's header carries "Usage: node kernel-contract.test.mjs"
  // two paragraphs below. If notes were merged across blank comment lines, that command would
  // launder this phasing note into "checkable" and the gate would go silently blind.
  const notes = extractNotes(readFileSync(resolve(REPO, rel), 'utf8'), 'mjs');
  const phasingNote = notes.find((n) => /^Phasing:/.test(n.text));
  ok(!!phasingNote, 'L4', 'the phasing note is its own note, not merged into the file header');
  ok(phasingNote && !/\bnode\s+kernel-contract/.test(phasingNote.text), 'L4',
    'the note does NOT absorb the "Usage: node kernel-contract.test.mjs" line below it (blank comment line ends a note)');
}

// ── LAYER 5 — RATCHET, BOTH DIRECTIONS ───────────────────────────────────────────────────────
console.log('LAYER 5 — RATCHET: refuses an increase, reports a decrease');
{
  const pinned = { total: 2, files: ['a.mjs', 'b.mjs'], per_file: { 'a.mjs': 1, 'b.mjs': 1 } };
  const hit = (line) => ({ line, reasons: ['x'], excerpt: 'x' });

  // UP — a new note in an already-baselined file
  const up = ratchetVerdict({ 'a.mjs': [hit(1), hit(2)], 'b.mjs': [hit(1)] }, pinned);
  ok(up.failures.length > 0, 'L5', `count UP fails: ${up.failures[0].split('\n')[0]}`);

  // UP — a note in a file that has no baseline entry at all (allowed = 0, never a silent pass)
  const upNew = ratchetVerdict({ 'a.mjs': [hit(1)], 'b.mjs': [hit(1)], 'c.mjs': [hit(9)] }, pinned);
  ok(upNew.failures.some((f) => f.startsWith('c.mjs')), 'L5', 'an UNBASELINED file gets a ceiling of 0, not an infinite one');

  // DOWN — reported as an improvement with the re-pin instruction, never a red
  const down = ratchetVerdict({ 'a.mjs': [hit(1)] }, pinned);
  ok(down.failures.length === 0, 'L5', 'count DOWN does not fail the build');
  ok(down.improvements.some((s) => s.includes('b.mjs')) && down.improvements.some((s) => s.includes('2 -> 1')), 'L5',
    `count DOWN is reported: ${down.improvements.join(' | ')}`);

  // FLAT — neither
  const flat = ratchetVerdict({ 'a.mjs': [hit(1)], 'b.mjs': [hit(1)] }, pinned);
  ok(flat.failures.length === 0 && flat.improvements.length === 0, 'L5', 'count FLAT is silent');

  // F-11 at the per-file layer: a corrupt ceiling must throw, never compare permissively.
  let threw = null;
  try { ratchetVerdict({ 'a.mjs': [hit(1)] }, { total: 2, files: ['a.mjs'], per_file: { 'a.mjs': Infinity } }); }
  catch (e) { threw = e; }
  ok(threw && threw.state === 'NAN-KEY', 'L5', `a non-finite per-file ceiling throws NAN-KEY, not a silent pass (got ${threw?.state ?? 'no throw'})`);
}

// ── LAYER 6 — ANTI-DRIFT ─────────────────────────────────────────────────────────────────────
// This layer reds if a future edit re-creates the two holes this gate was built to avoid.
console.log('LAYER 6 — ANTI-DRIFT: hard-failing loader kept, self-exclusion not widened');
{
  const src = readFileSync(resolve(HERE, 'check-phasing-notes.mjs'), 'utf8');
  ok(/loadRatchetBaselineOrExit\(BASELINE_PATH/.test(src), 'L6',
    'the gate path still loads its baseline through the shared HARD-FAILING loader');
  ok(!/existsSync\(\s*BASELINE_PATH\s*\)\s*\?/.test(src), 'L6',
    'no `existsSync(BASELINE_PATH) ? ... : {}` deletable-baseline branch (F-11)');
  ok(!/\?\?\s*Infinity/.test(src), 'L6', 'no `?? Infinity` default ceiling (F-11)');
  ok(SELF_EXCLUDE.size === 2 && SELF_EXCLUDE.has('scripts/check-phasing-notes.mjs') && SELF_EXCLUDE.has('scripts/check-phasing-notes.test.mjs'),
    'L6', `self-exclusion is exactly the gate and its test (${[...SELF_EXCLUDE].join(', ')})`);
  // DENOMINATOR-SENTINEL-1 posture: an empty scope is a failure, not a green scan.
  ok(/scope enumeration returned ZERO files/.test(src), 'L6', 'an empty scope enumeration is a FAILURE, not "0 of 0 clean"');
}

if (failures) {
  console.error(`\n✗ check-phasing-notes.test: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\ncheck-phasing-notes.test: OK — RED, GREEN, false-positive-safe, known-answer, ratchet both ways, anti-drift.');
