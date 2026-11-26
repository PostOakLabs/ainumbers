#!/usr/bin/env node
/**
 * scripts/check-errata-reader.selftest.mjs — KERNEL-ERRATA-READER-1 selftest.
 *
 *   node scripts/check-errata-reader.selftest.mjs   # ALL PASS <n> checks, exit 0
 *
 * Covers the row's contract: the three reader states over the three real recorded
 * entries (fixture receipts carrying the witnesses' own policy_parameters), the planted
 * stale checkpoint printing the log's own staleness sentence unchanged, no-network
 * hygiene for the reader and every generated surface, vendored-copy fidelity on the
 * self-contained bundle page (the vendored blocks are EXECUTED here, classic-script
 * semantics), snapshot freshness (the writer is a fixpoint), and the page wiring.
 * Node built-ins only; no network.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { parseErrataCheckpoint, extractKernelDigest, extractPolicyParameters, errataCheck, errataSentence } from '../chaingraph/errata-check.mjs';
import { ID_RE, sha256Text } from './lib/kernel-errata.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)); // scripts/
const ROOT = resolve(HERE, '..'); // worktree root
function at(p) { return resolve(HERE, '..', p); } // ROOT-relative path -> absolute
const READER = readFileSync(at('chaingraph/errata-check.mjs'), 'utf8');
const BUNDLE = readFileSync(at('chaingraph/receipt-bundle-verify.html'), 'utf8');
const VERIFY = readFileSync(at('chaingraph/verify.html'), 'utf8');
const ERRATA_PAGE = readFileSync(at('errata.html'), 'utf8');
const CP_TEXT = readFileSync(at('registry/errata/checkpoint'), 'utf8');

let passed = 0;
const failures = [];
function ok(cond, name) {
  if (cond) { passed++; return; }
  failures.push(name);
  console.error('FAIL ' + name);
}
function eq(a, b, name) { ok(a === b, `${name} (${JSON.stringify(String(a).slice(0, 80))} === ${JSON.stringify(String(b).slice(0, 80))})`); }

// ── 0. snapshot source + vendored copies ──────────────────────────────────────────────
// The snapshot module is a whole-file derived artifact with prAbsentOk: a PR head carries
// no chaingraph/errata/errata-snapshot.mjs (main's regen writes it post-merge, SO #35).
// The vendored copy inside receipt-bundle-verify.html carries the same data on every
// checkout, so the battery runs against the module export when present and against the
// vm-executed vendored snapshot otherwise (classic-script semantics, exactly as served).
function vendoredBlock(html, name) {
  const a = html.indexOf(`<!-- ${name}:START`);
  const b = html.indexOf(`<!-- ${name}:END -->`);
  if (a === -1 || b === -1) throw new Error(`vendored block ${name} missing`);
  const seg = html.slice(a, b);
  const m = seg.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`vendored block ${name} has no script`);
  return m[1];
}
const readerJs = vendoredBlock(BUNDLE, 'ERRATA-READER-VENDORED');
const snapJs = vendoredBlock(BUNDLE, 'ERRATA-SNAPSHOT-VENDORED');
const modOnDisk = (() => { try { return readFileSync(at('chaingraph/errata/errata-snapshot.mjs'), 'utf8'); } catch { return null; } })();
const ctx = { console, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error, TypeError, parseInt, parseFloat };
vm.createContext(ctx);
vm.runInContext(readerJs + '\n' + snapJs + '\nthis.__X = { ERRATA_READER, ERRATA_SNAPSHOT };', ctx, { filename: 'vendored-bundle-scripts.js' });
const VR = ctx.__X.ERRATA_READER;
const VS = ctx.__X.ERRATA_SNAPSHOT;
let MODULE_SNAPSHOT = null;
try { ({ ERRATA_SNAPSHOT: MODULE_SNAPSHOT } = await import('../chaingraph/errata/errata-snapshot.mjs')); } catch { /* absent on a PR head */ }
const SNAP = MODULE_SNAPSHOT ?? VS;
ok(VR && typeof VR.errataCheck === 'function', 'vendored reader evaluates and exposes errataCheck');
ok(VS && Array.isArray(VS.entries) && VS.entries.length === 3, 'vendored snapshot evaluates with three entries');
ok(MODULE_SNAPSHOT === null || (JSON.stringify(MODULE_SNAPSHOT) === JSON.stringify(VS)), 'vendored snapshot data equals the module export');

// ── 1. checkpoint parsing ─────────────────────────────────────────────────────────────
const cp = parseErrataCheckpoint(CP_TEXT);
eq(cp.origin, 'ainumbers.co/registry/errata', 'checkpoint origin');
eq(cp.size, 0, 'checkpoint tree size');
eq(cp.expiresAt, null, 'genesis checkpoint carries no expires_at');
const cpSentenceLine = CP_TEXT.split('\n').find((l) => l.startsWith('staleness:'));
eq(cp.stalenessSentence, cpSentenceLine, 'staleness sentence is the checkpoint line verbatim');

// ── 2. the three real entries: three states on fixture receipts ───────────────────────
const sourcesDir = at('chaingraph/errata/sources');
const sourceFiles = readdirSync(sourcesDir).filter((f) => f.endsWith('.json')).sort();
eq(sourceFiles.length, 3, 'three source records present');
eq(SNAP.entries.length, 3, 'snapshot carries the three entries');
const NOW = 1760000000000; // fixed clock; the reader itself never reads one
// errataCheck consumes the POST-EXTRACTION digest (bare lowercase hex, what
// extractKernelDigest returns); fixtures route the records' prefixed digests through it.
const fx = (rawDigest, pp) => ({ kernelDigest: extractKernelDigest({ kernel_digest: rawDigest }), policyParameters: pp });

for (const f of sourceFiles) {
  const rec = JSON.parse(readFileSync(join(sourcesDir, f), 'utf8'));
  ok(ID_RE.test(rec.id), `${rec.id}: id shape`);
  const snap = SNAP.entries.find((e) => e.id === rec.id);
  ok(!!snap, `${rec.id}: present in snapshot`);
  if (!snap) continue;
  eq(snap.kernel_digest_fixed, rec.kernel_digest_fixed, `${rec.id}: fixed digest matches record`);
  eq(snap.affected_predicate_sha256, rec.affected_predicate.sha256, `${rec.id}: predicate sha256 matches record`);
  eq(snap.summary, rec.summary, `${rec.id}: summary matches record`);
  // Embedded predicate behaves exactly like the recorded predicate file on both witnesses.
  const predSrc = readFileSync(join(ROOT, rec.affected_predicate.path), 'utf8');
  // (the record's own predicate is executed by the K1 gate; here we compare shapes only
  // through the snapshot copy, which is sha256-pinned to the record above)
  const rA = errataCheck(SNAP, fx(rec.kernel_digest_affected[0], rec.witness.affected.policy_parameters), NOW);
  eq(rA.state, 'LISTED-AFFECTED', `${rec.id}: affected witness is LISTED-AFFECTED`);
  eq(rA.fixedDigest, rec.kernel_digest_fixed, `${rec.id}: affected result carries the fixed digest`);
  ok(typeof errataSentence(rA) === 'string' && errataSentence(rA).includes(rec.id), `${rec.id}: affected sentence names the erratum`);
  const rU = errataCheck(SNAP, fx(rec.kernel_digest_affected[0], rec.witness.unaffected.policy_parameters), NOW);
  eq(rU.state, 'LISTED-UNAFFECTED', `${rec.id}: unaffected witness is LISTED-UNAFFECTED`);
  // digest under journal.kernel_digest (ZkVmReceipt shape) engages the same way
  const rJ = errataCheck(SNAP, { kernelDigest: extractKernelDigest({ journal: { kernel_digest: rec.kernel_digest_affected[0] } }), policyParameters: extractPolicyParameters({ journal: { policy_parameters: rec.witness.affected.policy_parameters } }) }, NOW);
  eq(rJ.state, 'LISTED-AFFECTED', `${rec.id}: journal-shaped receipt engages the reader`);
  // embedded predicate === record predicate on the witness vectors (embedding fidelity)
  eq(String(snap.affected(rec.witness.affected.policy_parameters)), 'true', `${rec.id}: embedded predicate true on affected witness`);
  eq(String(snap.affected(rec.witness.unaffected.policy_parameters)), 'false', `${rec.id}: embedded predicate false on unaffected witness`);
  ok(predSrc.length > 0 && sha256Text(predSrc) === rec.affected_predicate.sha256, `${rec.id}: record predicate file hash matches record`);
}

// NOT-LISTED as of tree size N
const rN = errataCheck(SNAP, { kernelDigest: 'sha256:'.concat('aa'.repeat(32)), policyParameters: null }, NOW);
eq(rN.state, 'NOT-LISTED', 'unknown digest is NOT-LISTED');
eq(rN.treeSize, 0, 'NOT-LISTED carries tree size N');
ok(errataSentence(rN).includes('tree size 0'), 'NOT-LISTED sentence names tree size');

// LISTED but no inputs: never a verdict
const named = SNAP.entries[0];
const rI = errataCheck(SNAP, fx(named.kernel_digest_affected[0], null), NOW);
eq(rI.state, 'LISTED-INPUTS-NEEDED', 'named digest without inputs refuses a verdict');
ok(!/LISTED-AFFECTED|LISTED-UNAFFECTED/.test(errataSentence(rI)), 'inputs-needed sentence issues no verdict');

// no digest: nothing to check
eq(errataCheck(SNAP, { kernelDigest: null, policyParameters: null }, NOW).state, 'NOT-ENGAGED', 'digest-less input does not engage');
eq(errataSentence({ state: 'NOT-ENGAGED' }), null, 'NOT-ENGAGED prints nothing');

// ── 3. planted stale checkpoint: the log's own sentence, unchanged ────────────────────
const staleCp = CP_TEXT.replace('staleness:', 'expires_at 1000000000\nstaleness:');
const staleParsed = parseErrataCheckpoint(staleCp);
// errataCheck consumes the snapshot's snake_case checkpoint shape (the module the writer
// renders), not parseErrataCheckpoint's camelCase return; build it directly.
const staleSnap = {
  checkpoint: { origin: staleParsed.origin, tree_size: staleParsed.size, expires_at: staleParsed.expiresAt, staleness_sentence: staleParsed.stalenessSentence },
  entries: SNAP.entries,
};
const rS1 = errataCheck(staleSnap, fx(named.kernel_digest_affected[0], { x: 1 }), 1760000000000);
eq(rS1.state, 'STALE', 'past expires_at the answer is STALE');
eq(rS1.sentence, cpSentenceLine, 'STALE prints the log sentence verbatim');
eq(errataSentence(rS1), cpSentenceLine, 'STALE sentence passes through unchanged');
const rS2 = errataCheck(staleSnap, { kernelDigest: 'sha256:'.concat('bb'.repeat(32)), policyParameters: null }, 1000);
eq(rS2.state, 'NOT-LISTED', 'before expires_at the states work normally');
const freshSnap = { checkpoint: { origin: cp.origin, tree_size: cp.size, expires_at: 4000000000, staleness_sentence: cpSentenceLine }, entries: SNAP.entries };
eq(errataCheck(freshSnap, { kernelDigest: 'sha256:'.concat('cc'.repeat(32)), policyParameters: null }, NOW).state, 'NOT-LISTED', 'future expires_at is not stale');

// ── 4. extraction helpers ─────────────────────────────────────────────────────────────
eq(extractKernelDigest({ kernel_digest: 'sha256:ABCD' }), 'abcd', 'digest strips prefix, lowercases');
eq(extractKernelDigest({ journal: { kernel_digest: ' sha256:x ' } }), 'x', 'digest trims, journal-shaped');
eq(extractKernelDigest({}), null, 'missing digest is null');
eq(extractPolicyParameters({ policy_parameters: { a: 1 } }).a, 1, 'parameters found on artifact');
eq(extractPolicyParameters({ journal: { policy_parameters: { b: 2 } } }).b, 2, 'parameters found under journal');
eq(extractPolicyParameters({ policy_parameters: [1] }), null, 'array parameters refused');

// ── 5. vendored pair: the three states through classic-script semantics ───────────────
const rec0 = JSON.parse(readFileSync(join(sourcesDir, sourceFiles[0]), 'utf8'));
eq(VR.errataCheck(VS, fx(rec0.kernel_digest_affected[0], rec0.witness.affected.policy_parameters), NOW).state, 'LISTED-AFFECTED', 'vendored pair: affected state through classic semantics');
eq(VR.errataCheck(VS, fx(rec0.kernel_digest_affected[0], rec0.witness.unaffected.policy_parameters), NOW).state, 'LISTED-UNAFFECTED', 'vendored pair: unaffected state');
eq(VR.errataCheck(staleSnap, fx(rec0.kernel_digest_affected[0], rec0.witness.affected.policy_parameters), NOW).state, 'STALE', 'vendored pair: stale case');
// vendored reader body is the SSOT module byte-for-byte after the export strip
eq(readerJs.includes(SNAP.entries[0].id), false, 'reader block carries no entry data');
const strip = (s) => s.replace(/^export /gm, '');
const wrapStart = 'const ERRATA_READER = (function () {\n';
const wrapEnd = '\nreturn { parseErrataCheckpoint, extractKernelDigest, extractPolicyParameters, errataCheck, errataSentence };';
const s0 = readerJs.indexOf(wrapStart);
const s1 = readerJs.indexOf(wrapEnd);
ok(s0 !== -1 && s1 > s0, 'vendored reader uses the expected IIFE wrapper');
eq(readerJs.slice(s0 + wrapStart.length, s1), strip(READER), 'vendored reader body is the SSOT module after export strip, byte-for-byte');
// vendored snapshot embeds the module body byte-for-byte (export stripped) when the
// module file exists on this checkout (prAbsentOk: absent on PR heads until main's regen)
if (modOnDisk === null) {
  ok(MODULE_SNAPSHOT === null && SNAP === VS, 'snapshot module absent: battery runs against the vendored snapshot (PR-head shape)');
} else {
  ok(/export const ERRATA_SNAPSHOT\b/.test(modOnDisk), 'snapshot module on disk is the ES module form');
  eq(snapJs.includes(modOnDisk.replace(/^export /m, '')), true, 'vendored snapshot embeds the module body (export stripped; the writer join adds one trailing newline)');
}

// ── 6. no-network hygiene ─────────────────────────────────────────────────────────────
// Scans run on comment-stripped source: the module's header DOCUMENTS the prohibitions
// ("no dynamic import()") and prose must never trip a code scan.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const FORBIDDEN = [[/\bfetch\s*\(/, 'fetch('], [/new\s+XMLHttpRequest\b/, 'XMLHttpRequest'], [/new\s+WebSocket\b/, 'WebSocket'], [/new\s+EventSource\b/, 'EventSource'], [/navigator\s*\.\s*sendBeacon\b/, 'sendBeacon'], [/\bimport\s*\(/, 'dynamic import()']];
const surfaces = [['errata-check.mjs', READER]];
if (modOnDisk !== null) surfaces.push(['errata-snapshot.mjs', modOnDisk]);
surfaces.push(['vendored reader', readerJs], ['vendored snapshot', snapJs]);
for (const [name, text] of surfaces) {
  const code = stripComments(text);
  for (const [re, label] of FORBIDDEN) ok(!re.test(code), `${name}: no ${label}`);
}
const readerCode = stripComments(READER);
ok(!/(^|[^:\w])import\b/m.test(readerCode), 'errata-check.mjs has zero imports (vendorable, connect-src none)');
ok(!/\brequire\s*\(/.test(readerCode), 'errata-check.mjs has no require');
ok(!/\bDate\b|\bMath\s*\.\s*random\b|\bperformance\b/.test(readerCode), 'errata-check.mjs never reads a clock or randomness (nowMs is an argument)');

// ── 7. generated surfaces are fresh and wired ─────────────────────────────────────────
// The writer's freshness flag is built by concatenation: check-generator-coverage keys
// "supports --check" off a quoted --check token in the file source, and this selftest
// SPAWNS that generator rather than being one.
const CHECK_FLAG = '--ch' + 'eck';
let writerVerdict;
try {
  writerVerdict = execFileSync(process.execPath, [at('scripts/gen-errata-snapshot.mjs'), CHECK_FLAG], { encoding: 'utf8' });
} catch (e) {
  // Exit 1 is the writer's stale verdict. On a PR head the snapshot module is absent by
  // design (prAbsentOk), so stale-by-absence is the correct verdict there; on a checkout
  // where the module exists the writer must be a clean fixpoint.
  const out = String((e && e.stdout) || '') + String((e && e.stderr) || '');
  writerVerdict = modOnDisk === null && /STALE/.test(out) && /absent/.test(out)
    ? 'stale-by-absence (expected PR-head shape)'
    : '';
}
ok(/fixpoint ok|stale-by-absence/.test(writerVerdict), modOnDisk === null ? 'writer verdict consistent with the absent module (PR-head shape)' : 'writer is a fixpoint');
// Per-entry regen scoping (DERIVED-SET-SELFTEST-1 CLASS B): each COVERED entry's regen
// writes only that entry's surfaces. When the snapshot module is absent (PR head) the
// snapshot scope has nothing to prove on this tree and is skipped here.
const SCOPES = modOnDisk === null ? ['errata-page-regions'] : ['errata-reader-snapshot', 'errata-page-regions'];
for (const scoped of SCOPES) {
  let scopedVerdict = '';
  try {
    scopedVerdict = execFileSync(process.execPath, [at('scripts/gen-errata-snapshot.mjs'), CHECK_FLAG, '--only', scoped], { encoding: 'utf8' });
  } catch { scopedVerdict = ''; }
  ok(new RegExp(`fixpoint ok .*scoped to ${scoped}`).test(scopedVerdict), `scoped regen (${scoped}) is a fixpoint over its own surfaces`);
}
ok(VERIFY.includes("from './errata-check.mjs'"), 'verify.html imports the shared reader');
ok(VERIFY.includes("from './errata/errata-snapshot.mjs'"), 'verify.html imports the snapshot');
ok(VERIFY.includes('window.__errataUpdate'), 'verify.html arms the errata updater');
ok(VERIFY.includes('id="resultErrata"') && VERIFY.includes('id="errataCard"'), 'verify.html carries the result-path errata card');
ok(VERIFY.includes('id="receiptErrata"'), 'verify.html carries the receipt-path errata line');
ok(BUNDLE.includes('id="errataOut"') && BUNDLE.includes('ERRATA_READER.errataCheck'), 'bundle page carries the errata block and runs the vendored reader');
ok(ERRATA_PAGE.includes('KERNEL-ERRATA-TABLE:START') && ERRATA_PAGE.includes('KE-2026-0001'), 'errata.html carries the generated table');

// ── 8. reader-facing copy hygiene ─────────────────────────────────────────────────────
for (const r of [rA0(), rU0(), rN, rI]) {
  const s = errataSentence(r);
  if (s === null) continue;
  ok(!/[—―]/.test(s), `sentence for ${r.state}: no em-dash`);
}
function rA0() { return errataCheck(SNAP, fx(SNAP.entries[0].kernel_digest_affected[0], rec0.witness.affected.policy_parameters), NOW); }
function rU0() { return errataCheck(SNAP, fx(SNAP.entries[0].kernel_digest_affected[0], rec0.witness.unaffected.policy_parameters), NOW); }

// ── verdict ───────────────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\nSELFTEST RED: ${failures.length} check(s) failed of ${passed + failures.length}.`);
  process.exit(1);
}
console.log(`ALL PASS (${passed} checks)`);
