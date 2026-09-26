#!/usr/bin/env node
// check-kernel-input-usage.selftest.mjs — RED/GREEN mutation control for KERNEL-INPUT-USAGE-CHECK-1.
//
// SO #40(b): a gate proves RED before GREEN. Everything here drives the SHIPPED functions and the
// SHIPPED CLI from ./check-kernel-input-usage.mjs — never a restatement of their logic (SO #34).
//
// Layers:
//   1. FIXTURE SCAN — four fixture kernels + manifests (one per finding code, one clean exercising
//      all four read shapes) plus two registers, copied into a temp root and scanned through
//      scanRepo(): each code fires exactly once, on exactly its fixture, and the clean
//      kernel/register yield nothing.
//   2. RATCHET MECHANICS — diffBaseline() accepts/shields/heals; the CLI --init pins (and refuses a
//      second pin), the plain run fails a NEW finding and shields a baselined one, --prune removes
//      healed entries and never adds, --json parses with per-finding baselined flags, and a missing
//      baseline hard-fails (F-11: a deleted baseline is a disabled ratchet, never a green one).
//   3. REAL-KERNEL REPRODUCTION — the art-224 shape must reproduce on the real kernel in THIS
//      checkout: `art-224-fha-mip-eligibility READ-NOT-USED loan_purpose`. If it is absent because
//      ART224-DECLARED-UNUSED-INPUT-1 landed (kernel fixed), the absence itself is asserted
//      (loan_purpose must then be either unread or read-into-a-used-local) and the pass is printed
//      as HEALED-ABSENCE. Any other absence is a failure.
//
// Exit 0 = all controls green; exit 1 = any control red (named on its own line).

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRepo, diffBaseline, classifyKernel, keyOf, advisoryContext, REPO, BASELINE_PATH } from './check-kernel-input-usage.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures', 'kernel-input-usage');
const CHECKER = join(HERE, 'check-kernel-input-usage.mjs');

const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? '  ok ' : '  RED '} ${name}${detail ? `  -- ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

// ---------------------------------------------------------------- build the temp fixture root
const root = mkdtempSync(join(tmpdir(), 'kiu-selftest-'));
cpSync(FIXTURES, root, { recursive: true });

const FINDING_KEYS = [
  'art-9001-declared-not-read DECLARED-NOT-READ unused_threshold',
  'art-9002-read-not-used READ-NOT-USED notice_text',
  'art-9003-read-not-declared READ-NOT-DECLARED rush_processing',
  'art-9005-empty-inputs REGISTER-EMPTY-INPUTS -',
];

try {
  // ---------------------------------------------------------------- layer 1: fixture scan
  console.log('layer 1 — fixture scan (one finding per code, clean yields nothing)');
  const scan = scanRepo(root);
  const keys = scan.findings.map(keyOf);
  for (const k of FINDING_KEYS) check(`fixture fires: ${k}`, keys.includes(k));
  check('no finding besides the four fixtures', keys.length === FINDING_KEYS.length, `got ${JSON.stringify(keys)}`);
  check('clean kernel yields nothing', !keys.some((k) => k.startsWith('art-9004-clean')));
  check('clean register yields nothing', !keys.some((k) => k.startsWith('art-9004-clean')));
  check('counts exact', JSON.stringify(scan.counts) === JSON.stringify({
    'DECLARED-NOT-READ': 1, 'READ-NOT-USED': 1, 'READ-NOT-DECLARED': 1, 'REGISTER-EMPTY-INPUTS': 1,
  }), JSON.stringify(scan.counts));
  check('scanned 4 kernels + 2 registers', scan.kernels_scanned === 4 && scan.registers_scanned === 2,
    `kernels=${scan.kernels_scanned} registers=${scan.registers_scanned}`);

  // The clean fixture names all four read shapes — assert each shape was actually read (if a
  // shape regex broke, its key would fall into DECLARED-NOT-READ and the count assert above
  // would already be red; this names WHICH shape broke).
  const cleanSrc = readFileSync(join(root, 'chaingraph', 'kernels', 'art-9004-clean.kernel.mjs'), 'utf8');
  const cleanDeclared = ['amount_cents', 'risk_tier', 'region_code', 'channel'];
  const clean = classifyKernel(cleanSrc, cleanDeclared);
  check('shape 1 read (pp.<key>)', clean.read.has('amount_cents'));
  check('shape 2 read (policy_parameters.<key>)', clean.read.has('risk_tier'));
  check("shape 3 read (pp['<key>'])", clean.read.has('region_code'));
  check('shape 4 read ({ <key> } = pp)', clean.read.has('channel'));
  check('clean kernel has zero unused-bound reads', clean.unusedBound.length === 0, JSON.stringify(clean.unusedBound));

  // ---------------------------------------------------------------- layer 2: ratchet mechanics
  console.log('layer 2 — ratchet mechanics (accept, shield, fail-new, prune, json, missing-baseline)');

  const fullAccepted = FINDING_KEYS.slice();
  const d0 = diffBaseline(scan.findings, fullAccepted);
  check('accepts everything: no new', d0.new.length === 0);
  check('accepts everything: 4 baselined with indices', d0.baselined.length === 4 && d0.baselined.every((b) => b.baseline_index >= 0));
  check('accepts everything: nothing healed', d0.healed.length === 0);

  // A finding that disappears from the tree while still accepted is HEALED (prune material);
  // an accepted entry dropped from the baseline while its finding is live is NEW (covered below).
  const fewer = scan.findings.filter((f) => keyOf(f) !== FINDING_KEYS[0]);
  const d1 = diffBaseline(fewer, fullAccepted);
  check('no new when the tree merely healed', d1.new.length === 0);
  check('live findings shrink -> HEALED names the dead entry', d1.healed.length === 1 && d1.healed[0] === FINDING_KEYS[0], JSON.stringify(d1.healed));
  check('the remaining three stay baselined', d1.baselined.length === 3);

  check('advisoryContext: pull_request is advisory',
    advisoryContext({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' }) === true);
  check('advisoryContext: push is blocking',
    advisoryContext({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push' }) === false);
  check('advisoryContext: merge_group is blocking',
    advisoryContext({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'merge_group' }) === false);
  check('advisoryContext: local (unset) is blocking (fail-closed)',
    advisoryContext({}) === false);

  const run = (args, extraEnv = {}) => spawnSync(process.execPath, [CHECKER, ...args], {
    encoding: 'utf8', timeout: 120000, windowsHide: true,
    env: {
      ...process.env,
      KIU_REPO_ROOT: root,
      GITHUB_ACTIONS: '', GITHUB_EVENT_NAME: '', // blocking context unless a case overrides
      ...extraEnv,
    },
  });
  const envOf = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v ?? '']));
  const outOf = (r) => `${r.stdout || ''}${r.stderr || ''}`;

  // missing baseline -> hard fail (F-11)
  let r = run([]);
  check('CLI: missing baseline exits 1', r.status === 1, `status=${r.status}`);
  check('CLI: missing baseline names MISSING-FILE', /MISSING-FILE/.test(outOf(r)));

  // --init pins once, refuses a second pin
  r = run(['--init']);
  check('CLI: --init exits 0', r.status === 0, `status=${r.status} ${outOf(r).slice(0, 120)}`);
  check('CLI: --init wrote the baseline', existsSync(join(root, 'scripts', 'kernel-input-usage-baseline.json')));
  const pinned = JSON.parse(readFileSync(join(root, 'scripts', 'kernel-input-usage-baseline.json'), 'utf8'));
  check('CLI: --init accepted all four findings', JSON.stringify(pinned.accepted.slice().sort()) === JSON.stringify(FINDING_KEYS.slice().sort()), JSON.stringify(pinned.accepted));
  check('CLI: --init pinned the four counts',
    pinned.declared_not_read === 1 && pinned.read_not_used === 1 && pinned.read_not_declared === 1 && pinned.register_empty_inputs === 1,
    JSON.stringify(pinned));
  r = run(['--init']);
  check('CLI: second --init REFUSED (exit 2)', r.status === 2, `status=${r.status}`);

  // plain run, everything baselined, blocking context -> green
  r = run([]);
  check('CLI: all-baselined blocking run exits 0', r.status === 0, `status=${r.status} ${outOf(r).slice(-200)}`);
  check('CLI: baselined rows are marked', /\[baselined\]/.test(r.stdout || '') && !/\[NEW\]/.test(r.stdout || ''));

  // --json parses; carries counts, flags and new/healed
  r = run(['--json']);
  const lines = String(r.stdout || '').split(/\r?\n/).filter(Boolean);
  const jsonLine = [...lines].reverse().find((l) => l.startsWith('{'));
  let doc = null;
  try { doc = JSON.parse(jsonLine); } catch { /* named by the check below */ }
  check('CLI: --json emits a parseable document', doc !== null);
  if (doc) {
    check('CLI: --json counts exact', JSON.stringify(doc.counts) === JSON.stringify({ 'DECLARED-NOT-READ': 1, 'READ-NOT-USED': 1, 'READ-NOT-DECLARED': 1, 'REGISTER-EMPTY-INPUTS': 1 }));
    check('CLI: --json flags baselined findings', doc.findings.length === 4 && doc.findings.every((f) => f.baselined === true));
    check('CLI: --json new/healed empty', doc.new.length === 0 && doc.healed.length === 0);
  }

  // heal one finding -> prune removes exactly it and never adds; the healed-again kernel is NEW again
  rmSync(join(root, 'chaingraph', 'kernels', 'art-9001-declared-not-read.kernel.mjs'));
  rmSync(join(root, 'manifests', 'art-9001-declared-not-read.manifest.json'));
  r = run([]);
  check('CLI: healed finding does not fail the run (exit 0)', r.status === 0, `status=${r.status}`);
  check('CLI: healed finding is reported', /HEALED 1/.test(r.stdout || '') && /healed: art-9001-declared-not-read DECLARED-NOT-READ unused_threshold/.test(r.stdout || ''));
  r = run(['--prune']);
  check('CLI: --prune exits 0 and removes 1', r.status === 0 && /removed 1 healed/.test(r.stdout || ''), `status=${r.status}`);
  const pruned = JSON.parse(readFileSync(join(root, 'scripts', 'kernel-input-usage-baseline.json'), 'utf8'));
  check('CLI: --prune shrank accepted to 3', pruned.accepted.length === 3 && !pruned.accepted.includes(FINDING_KEYS[0]), JSON.stringify(pruned.accepted));
  cpSync(join(FIXTURES, 'chaingraph', 'kernels', 'art-9001-declared-not-read.kernel.mjs'), join(root, 'chaingraph', 'kernels', 'art-9001-declared-not-read.kernel.mjs'));
  cpSync(join(FIXTURES, 'manifests', 'art-9001-declared-not-read.manifest.json'), join(root, 'manifests', 'art-9001-declared-not-read.manifest.json'));
  r = run([]);
  check('CLI: the un-pruned finding is NEW again and FAILS (exit 1)', r.status === 1, `status=${r.status}`);
  check('CLI: the failing row is marked [NEW]', /art-9001-declared-not-read DECLARED-NOT-READ unused_threshold \[NEW\]/.test(r.stdout || ''));

  // same tree, advisory context -> exit 0 with the ADVISORY line
  r = run([], envOf({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' }));
  check('CLI: advisory context exits 0 on the same tree', r.status === 0, `status=${r.status}`);
  check('CLI: advisory line names the new count', /ADVISORY \(context=pull_request\): 1 new/.test(r.stdout || ''));

  // ---------------------------------------------------------------- layer 3: real-kernel reproduction
  console.log('layer 3 — real-kernel reproduction (the art-224 shape, in THIS checkout)');
  const real = scanRepo(REPO);
  const want = 'art-224-fha-mip-eligibility READ-NOT-USED loan_purpose';
  const hit = real.findings.map(keyOf).includes(want);
  if (hit) {
    check(`REAL-KERNEL reproduces: ${want}`, true);
  } else {
    // Absent is only acceptable if ART224-DECLARED-UNUSED-INPUT-1 landed: the kernel must no
    // longer carry the shape (loan_purpose unread, or read into a local that IS used).
    let healedShape = false;
    try {
      const ksrc = readFileSync(join(REPO, 'chaingraph', 'kernels', 'art-224-fha-mip-eligibility.kernel.mjs'), 'utf8');
      const manifest = JSON.parse(readFileSync(join(REPO, 'manifests', 'art-224-fha-mip-eligibility.manifest.json'), 'utf8'));
      const declared = Object.keys((manifest.input_schema && manifest.input_schema.properties) || {});
      const cls = classifyKernel(ksrc, declared);
      healedShape = !cls.unusedBound.includes('loan_purpose');
    } catch { /* unreadable -> not healed */ }
    check(`REAL-KERNEL ${want}${healedShape ? ' — HEALED-ABSENCE (ART224-DECLARED-UNUSED-INPUT-1 landed; the shape is gone)' : ' — MISSING and the kernel still carries the shape: FAIL'}`, healedShape);
  }
  check('real scan covers the estate', real.kernels_scanned > 400 && real.registers_scanned > 400,
    `kernels=${real.kernels_scanned} registers=${real.registers_scanned}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log(`\ncheck-kernel-input-usage.selftest — ${failures.length ? `${failures.length} RED` : 'all controls green'}`);
if (failures.length) {
  for (const f of failures) console.log(`  RED: ${f}`);
  process.exit(1);
}
