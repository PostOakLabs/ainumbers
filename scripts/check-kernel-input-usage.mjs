#!/usr/bin/env node
// check-kernel-input-usage.mjs — KERNEL-INPUT-USAGE-CHECK-1 (2026-09-26).
//
// A zero-LLM gate for the "declared input never used" class (instance: art-224, whose manifest
// declares `loan_purpose`, whose kernel reads it into a local named `purpose` and never uses it —
// measured at origin/main ba49b25c, chaingraph/kernels/art-224-fha-mip-eligibility.kernel.mjs:66).
// Session 9's B12 found 21 of a 60-register sample carrying `declared_inputs: []`. No gate compared
// declared inputs to kernel usage, so the class recurred silently. Deciding implement-vs-remove
// needs primary text — that is a farm lane draft's job (farm/notes/INPUT-USAGE.md, fed by
// farm-ticks.mjs's `input-usage` step into draft-factory's `inputs` source). This gate only REPORTS.
//
// Scan (regex over source, four shapes and NOTHING else — no AST, by row spec):
//   1. `pp.<key>`                       2. `policy_parameters.<key>`
//   3. `pp['<key>']` / `pp["<key>"]`    4. destructuring `{ <key>[, …] } = pp`
// For each read key bound to a local (`const <id> = … pp.<key> …`, single line), `used` = the local
// identifier recurs at least once AFTER its declaration line. A read not bound to a const is used by
// construction. Known, accepted limits of the regex rule (documented, deliberate): a multi-const
// line can mis-bind the local (`const a = pp.x, b = pp.y` binds y to `a`); a key read only through
// a computed `pp[var]` is invisible. Neither can invent a finding class the AST would remove —
// they can only shift individual rows, and the ratchet makes shifting expensive.
//
// Findings, four codes:
//   DECLARED-NOT-READ      key in manifest input_schema.properties, never read in any shape
//   READ-NOT-USED          the art-224 shape: read into a const local that never recurs
//   READ-NOT-DECLARED      the inverse lie: kernel reads a key the schema does not declare
//   REGISTER-EMPTY-INPUTS  chaingraph/register/*.register.json has declared_inputs: [] while its
//                          manifest declares >= 1 property (registers whose manifest is absent
//                          are skipped — there is nothing to compare against)
// Scope: top-level chaingraph/kernels/art-*.kernel.mjs that have manifests/<tool_id>.manifest.json.
//
// Baseline ratchet, nav-island shape (scripts/nav-island-baseline.json) with the shared HARD-FAILING
// loader (scripts/ratchet-baseline.mjs — the object-baseline loader `loadRatchetBaselineOrExit`; this
// baseline carries a `accepted` name-list plus the four count ceilings, so it loads through there
// rather than being hand-parsed):
//   plain run  : a finding NOT in the baseline FAILS (exit 1) — the recurrence guard.
//                A finding already in the baseline is printed and marked `[baselined]`.
//                Context split, matching the row: ADVISORY on `pull_request` (warn, exit 0),
//                BLOCKING on main / merge_group / local (fail-closed — an unknown context blocks).
//                The baseline is single-writer on main (--init ran exactly once, in this row;
//                --prune only removes healed entries), so a PR could not green a new finding
//                anyway — advisory-on-PR is honest, blocking-on-main is the teeth.
//   --init     : HUMAN, ONCE: accepts every current finding, writes the baseline, exits 0.
//                Refuses to overwrite an existing baseline (never --init again).
//   --prune    : regen mode for main-side healing: removes accepted entries that no longer
//                correspond to a live finding, never adds. Exit 0.
//   --json     : machine document on stdout for the farm tick (same verdict semantics).
// Exit codes: 0 = verdict computed, nothing to fail on. 1 = new finding(s) in a blocking context,
// or a hard-failing baseline (MISSING-FILE / INVALID-JSON / MISSING-KEY / NAN-KEY / BAD-LIST-KEY).
// A deleted baseline is the "deletable baseline" state (gate-integrity F-11): the shared loader
// hard-fails it, and even without the loader the empty accepted set would fail every finding.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { loadRatchetBaselineOrExit, readBaselineForUpdate } from './ratchet-baseline.mjs';
import { gitEnv } from './_git-env-lib.mjs'; // GIT-ENV-LEAK-SWEEP-1: every git child passes a scrubbed env

// REPO is the checkout this file lives in — always script-relative, NEVER cwd: the farm tick
// spawns `node repo/scripts/check-kernel-input-usage.mjs --json` with cwd = the workspace root,
// and preflight runs it with cwd = repo root; both must scan the same tree. The KIU_REPO_ROOT
// override exists ONLY for the self-test's fixture trees (its CLI cases run against a temp root);
// no registered invocation sets it.
export const REPO = process.env.KIU_REPO_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_PATH = join(REPO, 'scripts', 'kernel-input-usage-baseline.json');
export const BASELINE_LABEL = 'kernel-input-usage ratchet';
export const BASELINE_REPIN = 'node scripts/check-kernel-input-usage.mjs --init';
export const CODES = ['DECLARED-NOT-READ', 'READ-NOT-USED', 'READ-NOT-DECLARED', 'REGISTER-EMPTY-INPUTS'];
const COUNT_KEYS = {
  'DECLARED-NOT-READ': 'declared_not_read',
  'READ-NOT-USED': 'read_not_used',
  'READ-NOT-DECLARED': 'read_not_declared',
  'REGISTER-EMPTY-INPUTS': 'register_empty_inputs',
};
const REQUIRED_BASELINE_KEYS = [
  { key: 'accepted', type: 'name-list' },
  ...CODES.map((c) => ({ key: COUNT_KEYS[c], type: 'count' })),
];

const ID = '[A-Za-z_$][\\w$]*';                       // identifier
const KEYRE = new RegExp(`^${ID}$`);                  // a key/local name
const PPOBJ = '(?:pp|policy_parameters)';             // the two parameter-object spellings

// The four read shapes (and nothing else). `member` matches both `pp.<key>` and
// `policy_parameters.<key>`; `bracket` the quoted-subscript shape; `destructure` the
// `{ a, b = 1 } = pp` shape (RHS `pp` only, per spec).
const MEMBER_RE = new RegExp(`\\b(?:pp|policy_parameters)\\.(${ID})`, 'g');
const BRACKET_RE = new RegExp(`\\bpp\\[(['\\"])(${ID})\\1\\]`, 'g');
const DESTRUCTURE_RE = new RegExp(`\\{([^{}]+)\\}\\s*=\\s*${PPOBJ}\\b`, 'g');
const CONST_BIND_RE = (key) => new RegExp(`\\bconst\\s+(${ID})\\s*=[^;\\n]*\\b(?:pp|policy_parameters)\\.${key}\\b`);

// Reads of one kernel, keyed by input key:
//   { bound: localName | null, declLine: <0-based line of the binding>, inline: bool }
// The FIRST (lowest-line) const binding wins; a later plain read sets `inline`.
function readKeysOf(src) {
  const lines = src.split(/\r?\n/);
  const reads = new Map();
  const mark = (key, local, line) => {
    if (!KEYRE.test(key)) return;
    const e = reads.get(key) || { bound: null, declLine: -1, inline: false };
    if (local !== null && (e.bound === null || line < e.declLine)) { e.bound = local; e.declLine = line; }
    else if (local === null) e.inline = true;
    reads.set(key, e);
  };
  lines.forEach((l, i) => {
    let m;
    MEMBER_RE.lastIndex = 0;
    while ((m = MEMBER_RE.exec(l))) mark(m[1], CONST_BIND_RE(m[1]).test(l) ? CONST_BIND_RE(m[1]).exec(l)[1] : null, i);
    BRACKET_RE.lastIndex = 0;
    while ((m = BRACKET_RE.exec(l))) mark(m[2], null, i);
    DESTRUCTURE_RE.lastIndex = 0;
    while ((m = DESTRUCTURE_RE.exec(l))) {
      for (const part of m[1].split(',')) {
        const km = new RegExp(`^\\s*(?:\\.${ID}\\s*:\\s*)?(${ID})\\s*(?:=[^,]*)?$`).exec(part);
        if (km) mark(km[1], km[1], i); // destructuring binds the key's own name
      }
    }
  });
  return { lines, reads };
}

function localUsedAfter(lines, declLine, local) {
  const re = new RegExp(`\\b${local}\\b`);
  for (let j = declLine + 1; j < lines.length; j++) if (re.test(lines[j])) return true;
  return false;
}

// Pure kernel half of the scan (exported for the self-test): given one kernel's source and its
// manifest's declared input keys, return { read: Set, unusedBound: Set, neverRead: Set, notDeclared: Set }.
export function classifyKernel(src, declared) {
  const { lines, reads } = readKeysOf(src);
  const neverRead = [], unusedBound = [], notDeclared = [];
  for (const [key, e] of reads) {
    if (!declared.includes(key)) { notDeclared.push(key); continue; }
    if (e.bound !== null && !localUsedAfter(lines, e.declLine, e.bound)) unusedBound.push(key);
  }
  for (const d of declared) if (!reads.has(d)) neverRead.push(d);
  return { read: new Set(reads.keys()), unusedBound, neverRead, notDeclared };
}

// Pure whole scan (exported for the self-test): root must contain chaingraph/kernels,
// manifests, chaingraph/register. Deterministic order: kernels by stem, codes in CODES order,
// keys sorted; registers after kernels by tool_id.
export function scanRepo(root) {
  const kdir = join(root, 'chaingraph', 'kernels');
  const mdir = join(root, 'manifests');
  const rdir = join(root, 'chaingraph', 'register');
  const findings = [];
  let kernelsScanned = 0, registersScanned = 0;
  const stems = existsSync(kdir)
    ? readdirSync(kdir).filter((n) => /^art-.*\.kernel\.mjs$/.test(n)).map((n) => n.replace(/\.kernel\.mjs$/, '')).sort()
    : [];
  for (const stem of stems) {
    const mpath = join(mdir, `${stem}.manifest.json`);
    if (!existsSync(mpath)) continue; // "that has a manifest" — the row's scope rule
    let manifest;
    try { manifest = JSON.parse(readFileSync(mpath, 'utf8')); } catch { continue; } // unparseable manifest: not this gate's class
    const toolId = typeof manifest.tool_id === 'string' && manifest.tool_id ? manifest.tool_id : stem;
    const declared = Object.keys((manifest.input_schema && manifest.input_schema.properties) || {});
    let src;
    try { src = readFileSync(join(kdir, `${stem}.kernel.mjs`), 'utf8'); } catch { continue; }
    kernelsScanned++;
    const { neverRead, unusedBound, notDeclared } = classifyKernel(src, declared);
    for (const k of neverRead.sort()) findings.push({ tool_id: toolId, code: 'DECLARED-NOT-READ', key: k });
    for (const k of unusedBound.sort()) findings.push({ tool_id: toolId, code: 'READ-NOT-USED', key: k });
    for (const k of notDeclared.sort()) findings.push({ tool_id: toolId, code: 'READ-NOT-DECLARED', key: k });
  }
  if (existsSync(rdir)) {
    const regs = readdirSync(rdir).filter((n) => n.endsWith('.register.json')).sort();
    for (const r of regs) {
      let reg;
      try { reg = JSON.parse(readFileSync(join(rdir, r), 'utf8')); } catch { continue; }
      const toolId = typeof reg.tool_id === 'string' && reg.tool_id ? reg.tool_id : r.replace(/\.register\.json$/, '');
      const mpath = join(mdir, `${toolId}.manifest.json`);
      if (!existsSync(mpath)) continue; // no manifest to compare against — skip
      let manifest;
      try { manifest = JSON.parse(readFileSync(mpath, 'utf8')); } catch { continue; }
      const declaredN = Object.keys((manifest.input_schema && manifest.input_schema.properties) || {}).length;
      registersScanned++;
      if (Array.isArray(reg.declared_inputs) && reg.declared_inputs.length === 0 && declaredN >= 1) {
        findings.push({ tool_id: toolId, code: 'REGISTER-EMPTY-INPUTS', key: '-' });
      }
    }
  }
  const counts = Object.fromEntries(CODES.map((c) => [c, 0]));
  for (const f of findings) counts[f.code]++;
  return { findings, counts, kernels_scanned: kernelsScanned, registers_scanned: registersScanned };
}

// Pure ratchet diff (exported for the self-test): accepted is the baseline's `accepted` strings.
// baselined findings keep the scan order and carry baseline_index (-1 for new); `healed` lists
// accepted strings with no live finding (prune material — never added to, only removed).
export const keyOf = (f) => `${f.tool_id} ${f.code} ${f.key}`;
export function diffBaseline(findings, accepted) {
  const idx = new Map(accepted.map((s, i) => [s, i]));
  const seen = new Set(findings.map(keyOf));
  const baselined = [], fresh = [];
  for (const f of findings) {
    const k = keyOf(f);
    if (idx.has(k)) baselined.push({ ...f, baselined: true, baseline_index: idx.get(k) });
    else fresh.push({ ...f, baselined: false, baseline_index: -1 });
  }
  const healed = accepted.filter((s) => !seen.has(s));
  return { new: fresh, baselined, healed };
}

// Context split (exported for the self-test): advisory ONLY on a CI pull_request run; blocking on
// main, merge_group, and locally — fail-closed on anything unrecognised, like isMainContext().
export function advisoryContext(env) {
  return env.GITHUB_ACTIONS === 'true' && env.GITHUB_EVENT_NAME === 'pull_request';
}

function repoHead() {
  try { return execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf8', env: gitEnv() }).trim(); }
  catch { return 'unknown'; }
}

function printReport(scan, diff, advisory) {
  for (const f of scan.findings) {
    const k = keyOf(f);
    const tag = diff.baselined.some((b) => keyOf(b) === k) ? ' [baselined]' : ' [NEW]';
    console.log(`${k}${tag}`);
  }
  console.log(`DECLARED-NOT-READ ${scan.counts['DECLARED-NOT-READ']} / READ-NOT-USED ${scan.counts['READ-NOT-USED']} / READ-NOT-DECLARED ${scan.counts['READ-NOT-DECLARED']} / REGISTER-EMPTY-INPUTS ${scan.counts['REGISTER-EMPTY-INPUTS']}  (kernels=${scan.kernels_scanned}, registers=${scan.registers_scanned}, head=${repoHead()})`);
}

function jsonDoc(scan, diff, advisory) {
  return {
    context: advisory ? 'pull_request-advisory' : 'blocking',
    counts: scan.counts,
    kernels_scanned: scan.kernels_scanned,
    registers_scanned: scan.registers_scanned,
    head: repoHead(),
    findings: scan.findings.map((f) => {
      const d = diff.baselined.find((b) => keyOf(b) === keyOf(f));
      return { ...f, baselined: Boolean(d), baseline_index: d ? d.baseline_index : -1 };
    }),
    new: diff.new.map(keyOf),
    healed: diff.healed,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const advisory = advisoryContext(process.env);

  if (argv.includes('--init')) {
    if (existsSync(BASELINE_PATH)) {
      console.error(`REFUSED --init: ${BASELINE_PATH} already exists. --init ran exactly ONCE (KERNEL-INPUT-USAGE-CHECK-1); healing is --prune's job, and a deliberate reviewed re-pin is a human row of its own.`);
      process.exit(2);
    }
    const scan = scanRepo(REPO);
    const doc = {
      accepted: scan.findings.map(keyOf).sort(),
      declared_not_read: scan.counts['DECLARED-NOT-READ'],
      read_not_used: scan.counts['READ-NOT-USED'],
      read_not_declared: scan.counts['READ-NOT-DECLARED'],
      register_empty_inputs: scan.counts['REGISTER-EMPTY-INPUTS'],
    };
    mkdirSync(dirname(BASELINE_PATH), { recursive: true });
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n');
    console.log(`--init wrote ${BASELINE_PATH}: ${doc.accepted.length} accepted findings`);
    console.log(`DECLARED-NOT-READ ${doc.declared_not_read} / READ-NOT-USED ${doc.read_not_used} / READ-NOT-DECLARED ${doc.read_not_declared} / REGISTER-EMPTY-INPUTS ${doc.register_empty_inputs}`);
    return;
  }

  const scan = scanRepo(REPO);
  let accepted = [];
  if (argv.includes('--prune')) {
    // Writer path: absent baseline is a legal first prune (writes the empty-ratchet document);
    // present-but-corrupt still hard-fails (never overwrite damage as if it were a first pin).
    const prior = readBaselineForUpdate(BASELINE_PATH, REQUIRED_BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: BASELINE_REPIN });
    accepted = prior ? prior.accepted.filter((s) => scan.findings.some((f) => keyOf(f) === s)) : [];
    const doc = {
      accepted: accepted.slice().sort(),
      declared_not_read: scan.counts['DECLARED-NOT-READ'],
      read_not_used: scan.counts['READ-NOT-USED'],
      read_not_declared: scan.counts['READ-NOT-DECLARED'],
      register_empty_inputs: scan.counts['REGISTER-EMPTY-INPUTS'],
    };
    mkdirSync(dirname(BASELINE_PATH), { recursive: true });
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n');
    const removed = prior ? prior.accepted.length - accepted.length : 0;
    console.log(`--prune wrote ${BASELINE_PATH}: ${accepted.length} accepted (removed ${removed} healed; never adds)`);
    console.log(`DECLARED-NOT-READ ${doc.declared_not_read} / READ-NOT-USED ${doc.read_not_used} / READ-NOT-DECLARED ${doc.read_not_declared} / REGISTER-EMPTY-INPUTS ${doc.register_empty_inputs}`);
    return;
  }

  // Gate path. Missing/corrupt baseline hard-fails through the shared loader (F-11: a missing
  // baseline is a disabled ratchet, never a green one).
  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, REQUIRED_BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: BASELINE_REPIN });
  accepted = baseline.accepted;
  const diff = diffBaseline(scan.findings, accepted);
  if (diff.healed.length && !json) {
    console.log(`HEALED ${diff.healed.length} baselined finding(s) no longer present — main-side regen may run --prune (never --init):`);
    for (const s of diff.healed) console.log(`  healed: ${s}`);
  }
  printReport(scan, diff, advisory);
  if (json) console.log(JSON.stringify(jsonDoc(scan, diff, advisory))); // the LAST { line on stdout; verdict lines may follow
  if (diff.new.length === 0) {
    console.log(`OK: no new input-usage findings against the baseline (${accepted.length} accepted)${advisory ? ' · context=pull_request' : ''}`);
    return;
  }
  if (advisory) {
    console.log(`ADVISORY (context=pull_request): ${diff.new.length} new input-usage finding(s) reported, exit 0 — implement-or-remove is a farm lane draft's decision (farm/notes/INPUT-USAGE.md), and the baseline is single-writer on main.`);
    return;
  }
  console.error(`FAIL: ${diff.new.length} input-usage finding(s) not in the baseline (context=blocking). New findings are a red by design: fix the kernel (implement the input or remove the declaration), or — main-side only, after the fix — --prune the healed entries. --init will refuse: it ran exactly once.`);
  process.exit(1);
}

if (process.argv[1] && /check-kernel-input-usage\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) main();
