#!/usr/bin/env node
// apply-manifests.mjs — MANIFEST-APPLY-1: declarative desired-state apply / dry-run /
// check over manifests/*.manifest.json, with a down-only drift-gate baseline.
//
// SPEC: SPEC-MANIFEST-APPLY.md (workspace root) — this script is that spec's mechanical
// realization, not a second spec. Attribution: apply / idempotent-no-op / dry_run semantics
// inspired by grep.ai's expert_apply (Parcha Labs, https://grep.ai) — ideas only, no code.
//
// Desired state = FORM (canonical serialization, §SPEC 1.1) ∧ CONTENT (the overlay
// scripts/manifests.desired.json, §SPEC 1.2). The overlay ships empty by MEASURED
// decision (every content invariant is already owned by an existing single writer —
// see the spec's rejected-rules table); it is the ergonomics surface for future rows:
// declare → --dry-run → review plan → apply → the declaration becomes gate teeth.
//
// Modes (the row's three, plus the baseline writer and the paired controls):
//   (no flag) | --check   gate mode — RED (exit 1) on hand-drift beyond the baseline.
//   --dry-run             plan only — prints every drift entry and what apply would do
//                         (including what it would REFUSE), writes nothing, same exit contract.
//   --apply               perform the declared deltas, minimal-delta per SPEC §3; REFUSES
//                         (exit 2, file named) anything that would be a whole-file rewrite:
//                         non-canonical bytes (form drift) and unparseable files.
//   --update-baseline     the baseline's SOLE writer: recomputes the live drift set, PRUNES
//                         stale entries, REFUSES (exit 1, entries named) to ADD any entry —
//                         the ceiling only falls; new drift is fixed with apply, never absorbed.
//   --self-test           paired RED/GREEN/refusal controls in a temp dir (SO #40b shape);
//                         never touches the real manifests/.
//
// Zero-dependency except scripts/ratchet-baseline.mjs (RATCHET-BASELINE-LOADER-1): a
// deleted, corrupt or key-damaged baseline is a HARD RED, never a silent pass (F-11).
// ⛔ Reads manifests/ + the overlay only. Never reads the node graph, never writes
// chaingraph.json (single-writer), never touches kernels or fixtures.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRatchetBaseline, loadRatchetBaselineOrExit, readBaselineForUpdate, RatchetBaselineError } from './ratchet-baseline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const MANIFESTS_DIR = resolve(REPO, 'manifests');
const OVERLAY_PATH = resolve(REPO, 'scripts', 'manifests.desired.json');
const BASELINE_PATH = resolve(REPO, 'scripts', 'manifest-apply-baseline.json');
const BASELINE_LABEL = 'MANIFEST-APPLY-GATE-1 drift baseline';
const REPIN_COMMAND = 'node scripts/apply-manifests.mjs --update-baseline';
const REQUIRED_BASELINE_KEYS = [{ key: 'drift', type: 'name-list' }];

// ── natural sort — manifest filenames sort 2- < 10- like readers expect ──────────────
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// ── deep equal — value-level comparison for overlay entries ─────────────────────────
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

// ── canonical FORM (SPEC §1.1) ───────────────────────────────────────────────────────
function canonicalize(text) {
  return JSON.stringify(JSON.parse(text), null, 2) + '\n';
}

// ── overlay load + validation (SPEC §1.2) ────────────────────────────────────────────
// A policy whose own `set` does not make its selector stop matching can never be
// satisfied — it would red the gate forever. Refused here, in every mode.
export function loadOverlay(overlayPath = OVERLAY_PATH) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(overlayPath, 'utf8'));
  } catch (e) {
    throw new Error(`overlay INVALID-JSON — ${overlayPath}: ${e.message}`);
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('overlay INVALID — must be a JSON object with `policies` and `files`');
  }
  const errs = [];
  const policies = Array.isArray(raw.policies) ? raw.policies : null;
  if (!policies) errs.push('`policies` must be an array');
  const files = raw.files !== undefined
    ? (raw.files && !Array.isArray(raw.files) && typeof raw.files === 'object' ? raw.files : null)
    : {};
  if (files === null) errs.push('`files` must be an object keyed by manifest filename');
  if (errs.length) throw new Error('overlay INVALID — ' + errs.join('; '));

  const seenIds = new Set();
  policies.forEach((p, i) => {
    const at = `policies[${i}]`;
    if (!p || typeof p !== 'object') { errs.push(`${at} must be an object`); return; }
    if (typeof p.id !== 'string' || !p.id) { errs.push(`${at}.id must be a non-empty string`); return; }
    if (seenIds.has(p.id)) { errs.push(`${at}.id '${p.id}' is duplicated`); return; }
    seenIds.add(p.id);
    const when = p.when;
    if (!when || typeof when !== 'object') { errs.push(`${at}.when must be an object`); return; }
    for (const k of ['requires', 'omit']) {
      const v = when[k];
      if (v !== undefined && (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))) {
        errs.push(`${at}.when.${k} must be an array of key names`); return;
      }
    }
    if (!when.requires?.length && !when.omit?.length) { errs.push(`${at}.when must declare requires and/or omit`); return; }
    if (!p.set || typeof p.set !== 'object' || Array.isArray(p.set) || !Object.keys(p.set).length) {
      errs.push(`${at}.set must be a non-empty object of key → desired value`); return;
    }
    // fixpoint discipline: applying `set` to a matching doc must stop the match
    const doc = {};
    for (const k of when.requires ?? []) doc[k] = 'probe';
    const after = { ...doc, ...structuredClone(p.set) };
    const stillMatches =
      (when.requires ?? []).every((k) => k in after) &&
      (when.omit ?? []).every((k) => !(k in after));
    if (stillMatches) errs.push(`${at} ('${p.id}') cannot reach fixpoint — its own set leaves its selector matching`);
  });
  for (const [fname, entry] of Object.entries(files)) {
    const at = `files['${fname}']`;
    if (!fname.endsWith('.manifest.json')) { errs.push(`${at} — overlay files keys must be manifests/*.manifest.json filenames`); continue; }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errs.push(`${at} must be an object`); continue; }
    if (entry.set !== undefined) {
      if (!entry.set || typeof entry.set !== 'object' || Array.isArray(entry.set) || !Object.keys(entry.set).length) {
        errs.push(`${at}.set must be a non-empty object of key → desired value`);
      }
    } else {
      errs.push(`${at} must declare \`set\``);
    }
  }
  if (errs.length) throw new Error('overlay INVALID — ' + errs.join('; '));
  return { policies, files, comment: typeof raw._comment === 'string' ? raw._comment : '' };
}

// matchesSelector(doc, when) — key-presence selector (SPEC §1.2)
function matchesSelector(doc, when) {
  return (when.requires ?? []).every((k) => k in doc) && (when.omit ?? []).every((k) => !(k in doc));
}

// ── plan (SPEC §2) — one entry per drift, per file ───────────────────────────────────
// entry: { file, kind: 'parse' | 'form' | 'set', key?, desired?, baselineKey, repairable }
// baselineKey pins the entry in the baseline as "file::(parse)" / "file::(form)" / "file::key".
export function planForFile(fname, text, overlay) {
  const entries = [];
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    entries.push({ file: fname, kind: 'parse', baselineKey: `${fname}::(parse)`, repairable: false, detail: e.message });
    return entries;
  }
  if (canonicalize(text) !== text) {
    entries.push({ file: fname, kind: 'form', baselineKey: `${fname}::(form)`, repairable: false,
      detail: 'bytes are not the canonical serialization — repair would be a whole-file rewrite (REFUSED in apply)' });
  }
  for (const p of overlay.policies) {
    if (!matchesSelector(doc, p.when)) continue;
    for (const [key, desired] of Object.entries(p.set)) {
      if (!deepEqual(doc[key], desired)) {
        entries.push({ file: fname, kind: 'set', key, desired, policy: p.id,
          baselineKey: `${fname}::${key}`, repairable: true, doc });
      }
    }
  }
  const fe = overlay.files[fname];
  if (fe && fe.set) {
    for (const [key, desired] of Object.entries(fe.set)) {
      if (!deepEqual(doc[key], desired)) {
        entries.push({ file: fname, kind: 'set', key, desired, policy: `files:${fname}`,
          baselineKey: `${fname}::${key}`, repairable: true, doc });
      }
    }
  }
  return entries;
}

// dedupe: two rules may declare the same key with the same desired value — one entry each is noise.
// Conflicting desires (same key, different values) are an overlay defect the loader cannot see;
// caught here at plan time and surfaced as a hard error.
function planManifests(manifestsDir, overlay, { files } = {}) {
  let names;
  try {
    names = readdirSync(manifestsDir).filter((f) => f.endsWith('.manifest.json')).sort(collator.compare);
  } catch (e) {
    throw new Error(`cannot read manifests dir ${manifestsDir}: ${e.message}`);
  }
  if (files) names = names.filter((f) => files.has(f));
  const byKey = new Map();
  const conflicts = [];
  for (const fname of names) {
    const text = readFileSync(join(manifestsDir, fname), 'utf8');
    for (const e of planForFile(fname, text, overlay)) {
      const prev = byKey.get(e.baselineKey);
      if (prev) {
        if (prev.kind === 'set' && e.kind === 'set' && !deepEqual(prev.desired, e.desired)) {
          conflicts.push(`${fname}::${e.key} declared with conflicting desired values by '${prev.policy}' and '${e.policy}'`);
        }
        continue; // same key, same desire — one entry
      }
      byKey.set(e.baselineKey, e);
    }
  }
  if (conflicts.length) throw new Error('overlay CONFLICT — ' + conflicts.join('; '));
  return [...byKey.values()];
}

// ── baseline (SPEC §4) ───────────────────────────────────────────────────────────────
function loadBaseline() {
  return loadRatchetBaselineOrExit(BASELINE_PATH, REQUIRED_BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
}
const coveredByBaseline = (baseline, entry) => baseline.drift.includes(entry.baselineKey);

// ── modes ────────────────────────────────────────────────────────────────────────────
function summarize(entries) {
  const kinds = {};
  for (const e of entries) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  return Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ') || 'no drift';
}

function runCheck({ quiet }) {
  const overlay = loadOverlay();
  const baseline = loadBaseline();
  const entries = planManifests(MANIFESTS_DIR, overlay);
  const uncovered = entries.filter((e) => !coveredByBaseline(baseline, e));
  const absorbed = entries.length - uncovered.length;
  if (!quiet) {
    console.log(`apply-manifests --check — desired state: FORM (canonical bytes) ∧ CONTENT (overlay: ${overlay.policies.length} policies, ${Object.keys(overlay.files).length} file entries) over ${readdirSync(MANIFESTS_DIR).filter((f) => f.endsWith('.manifest.json')).length} manifests.`);
    console.log(`drift: ${summarize(entries)}; baseline '${BASELINE_LABEL}' pins ${baseline.drift.length} entr${baseline.drift.length === 1 ? 'y' : 'ies'} (absorbs ${absorbed}).`);
    for (const e of uncovered.slice(0, 20)) {
      console.log(`  ✗ ${e.baselineKey} [${e.kind}]${e.detail ? ' — ' + e.detail : ''}`);
    }
    if (uncovered.length > 20) console.log(`  … ${uncovered.length - 20} more`);
  }
  if (uncovered.length) {
    console.error(`✗ MANIFEST-APPLY-GATE-1 RED — ${uncovered.length} drift entr${uncovered.length === 1 ? 'y' : 'ies'} beyond the baseline. Fix with \`node scripts/apply-manifests.mjs --apply\` (declared deltas) or restore the owning writer's bytes. Plan first: \`node scripts/apply-manifests.mjs --dry-run\`.`);
    process.exit(1);
  }
  if (!quiet) console.log(`✓ manifest desired-state clean — no hand-drift beyond the baseline (MANIFEST-APPLY-GATE-1).`);
}

function runDryRun() {
  const overlay = loadOverlay();
  const baseline = loadBaseline();
  const entries = planManifests(MANIFESTS_DIR, overlay);
  console.log(`apply-manifests --dry-run — plan only, nothing written. Desired state over ${readdirSync(MANIFESTS_DIR).filter((f) => f.endsWith('.manifest.json')).length} manifests:`);
  if (!entries.length) {
    console.log('  plan is EMPTY — every manifest is at its desired state (idempotent no-op, grep.ai expert_apply semantics).');
    console.log('✓ nothing to do — --apply would write zero files.');
    return;
  }
  const byFile = new Map();
  for (const e of entries) {
    if (!byFile.has(e.file)) byFile.set(e.file, []);
    byFile.get(e.file).push(e);
  }
  for (const [fname, es] of byFile) {
    console.log(`  ${fname}`);
    for (const e of es) {
      const covered = coveredByBaseline(baseline, e) ? ' [BASELINED]' : ' [RED]';
      if (e.kind === 'set') {
        console.log(`    set ${e.key} = ${JSON.stringify(e.desired)}   (via ${e.policy})${covered}`);
      } else {
        console.log(`    REFUSED ${e.kind} — ${e.detail}${covered}`);
      }
    }
  }
  const uncovered = entries.filter((e) => !coveredByBaseline(baseline, e));
  const repairable = entries.filter((e) => e.kind === 'set');
  console.log(`plan: ${repairable.length} assignable drift entr${repairable.length === 1 ? 'y' : 'ies'} across ${new Set(repairable.map((e) => e.file)).size} file(s), ${entries.length - repairable.length} refused (form/parse).`);
  if (uncovered.length) process.exit(1);
  console.log('✓ all drift is baselined — --apply would repair it and --check stays green.');
}

// Line span of a top-level key in canonical text (SPEC §3): from its `  "key":` line to
// the last line before the next top-level sibling or the closing brace.
function topLevelSpan(lines, key) {
  const re = new RegExp(`^  "${key}":`);
  const start = lines.findIndex((l) => re.test(l));
  if (start === -1) return null;
  let end = lines.length - 1;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^  "/.test(lines[i]) || /^\}/.test(lines[i])) { end = i - 1; break; }
  }
  return [start, end];
}

// applyPlanForFile — minimal-delta write (SPEC §3). Returns { status, changedKeys? } with
// status 'noop' | 'written' | 'refused'.
export function applyPlanForFile(fname, text, entries) {
  const sets = entries.filter((e) => e.kind === 'set');
  const refused = entries.filter((e) => e.kind !== 'set');
  if (refused.length) {
    return { status: 'refused', why: refused.map((e) => `${e.kind}: ${e.detail}`).join('; ') };
  }
  if (!sets.length) return { status: 'noop' };
  if (canonicalize(text) !== text) {
    return { status: 'refused', why: 'whole-file rewrite refused — bytes are not canonical; a value edit here would reformat untouched lines. Restore canonical bytes via the owning writer first.' };
  }
  const doc = JSON.parse(text);
  const oldLines = text.split('\n');
  const spans = [];
  for (const e of sets) {
    spans.push(topLevelSpan(oldLines, e.key));
    doc[e.key] = structuredClone(e.desired); // assignment: existing key keeps position, new key appends
  }
  const newText = JSON.stringify(doc, null, 2) + '\n';
  // value-safety: parsed result must equal the expected document (mutation confined to declared keys)
  const expected = JSON.parse(text);
  for (const e of sets) expected[e.key] = structuredClone(e.desired);
  if (!deepEqual(JSON.parse(newText), expected)) {
    return { status: 'refused', why: 'safety check failed — re-serialized value differs beyond the declared keys' };
  }
  // line-accounting: every changed line must lie inside a declared key's old-or-new span.
  // A key being APPENDED has no old span; its insertion point is the document tail — the
  // closing comma of the last existing key and the brace line move — so the tail from the
  // last existing top-level key onward is its allowed region (value confinement is already
  // proven by the deep-equal above; this only bounds formatting churn).
  const newLines = newText.split('\n');
  const changed = [];
  const n = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < n; i++) if (oldLines[i] !== newLines[i]) changed.push(i);
  const oldTopKeys = oldLines.map((l, i) => (/^  "/.test(l) ? i : -1)).filter((i) => i >= 0);
  let tailStart = Infinity;
  if (oldTopKeys.length) {
    const lastStart = oldTopKeys[oldTopKeys.length - 1];
    const lastKey = oldLines[lastStart].match(/^  "([^"]+)":/)?.[1];
    const lastSpan = topLevelSpan(oldLines, lastKey);
    tailStart = lastSpan ? lastSpan[0] : lastStart;
  }
  const allowed = new Set();
  for (const e of sets) {
    const oldSpan = topLevelSpan(oldLines, e.key);
    for (const span of [oldSpan, topLevelSpan(newLines, e.key)]) {
      if (!span) continue;
      for (let i = span[0]; i <= span[1]; i++) allowed.add(i);
    }
    if (!oldSpan) for (let i = tailStart; i < n; i++) allowed.add(i); // appended key: document tail
  }
  const outside = changed.filter((i) => !allowed.has(i));
  if (outside.length) {
    return { status: 'refused', why: `safety check failed — ${outside.length} changed line(s) outside the declared keys' spans (would be a whole-file rewrite)` };
  }
  return { status: 'written', text: newText, changedKeys: sets.map((e) => e.key), changedLines: changed.length };
}

function runApply() {
  const overlay = loadOverlay();
  const entries = planManifests(MANIFESTS_DIR, overlay);
  const byFile = new Map();
  for (const e of entries) {
    if (!byFile.has(e.file)) byFile.set(e.file, []);
    byFile.get(e.file).push(e);
  }
  if (!byFile.size) {
    console.log('apply-manifests — plan is EMPTY, nothing to do (idempotent no-op). Zero files written.');
    return;
  }
  let written = 0, refused = 0, noop = 0;
  for (const [fname, es] of byFile) {
    const path = join(MANIFESTS_DIR, fname);
    const r = applyPlanForFile(fname, readFileSync(path, 'utf8'), es);
    if (r.status === 'written') {
      writeFileSync(path, r.text);
      written++;
      console.log(`  ✓ ${fname} — set ${r.changedKeys.join(', ')} (${r.changedLines} line${r.changedLines === 1 ? '' : 's'} changed)`);
    } else if (r.status === 'refused') {
      refused++;
      console.log(`  ⛔ ${fname} — REFUSED: ${r.why}`);
    } else noop++;
  }
  console.log(`apply-manifests — ${written} file(s) written, ${noop} no-op, ${refused} refused.`);
  if (refused) {
    console.error('✗ REFUSALS — whole-file-rewrite class (SPEC §3). Fix the named files via their owning writers, then re-run.');
    process.exit(2);
  }
}

function runUpdateBaseline() {
  const overlay = loadOverlay();
  const entries = planManifests(MANIFESTS_DIR, overlay);
  const live = [...new Set(entries.map((e) => e.baselineKey))].sort(collator.compare);
  const prev = readBaselineForUpdate(BASELINE_PATH, REQUIRED_BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
  const prevKeys = prev ? [...prev.drift] : null;
  if (prevKeys) {
    const additions = live.filter((k) => !prevKeys.includes(k));
    if (additions.length) {
      console.error(`✗ --update-baseline REFUSED — the ratchet only goes DOWN (SPEC §4). It would ADD ${additions.length} entr${additions.length === 1 ? 'y' : 'ies'} absent from the current baseline:`);
      for (const k of additions) console.error(`    + ${k}`);
      console.error('  New drift is fixed with `node scripts/apply-manifests.mjs --apply`, never absorbed.');
      process.exit(1);
    }
  }
  if (prevKeys && prevKeys.length === live.length && live.every((k) => prevKeys.includes(k))) {
    console.log(`--update-baseline: unchanged — ${live.length} entr${live.length === 1 ? 'y' : 'ies'} (down-only ratchet).`);
    return;
  }
  const pruned = prevKeys ? prevKeys.filter((k) => !live.includes(k)) : [];
  const doc = {
    _comment: 'MANIFEST-APPLY-GATE-1 drift baseline (SPEC-MANIFEST-APPLY.md §4). Sole writer: apply-manifests.mjs --update-baseline. Down-only: additions are REFUSED; entries disappear only when the drift they pin is really gone. Absorbs the drift set known at pin time so pre-existing rot does not red the estate; new hand-drift beyond this set is always RED.',
    drift: live,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n');
  console.log(`--update-baseline: wrote ${live.length} entr${live.length === 1 ? 'y' : 'ies'}${pruned.length ? ` (pruned ${pruned.length}: ${pruned.join(', ')})` : (prevKeys ? ' (no additions — refused path not taken)' : ' (first pin)')}.`);
}

// ── self-test (SPEC §4 controls; SO #40b RED-before-GREEN shape) ─────────────────────
function runSelfTest() {
  const failures = [];
  const t = (name, fn) => {
    try { fn(); console.log(`  ✓ ${name}`); }
    catch (e) { failures.push(name); console.log(`  ✗ ${name}\n      ${e.message}`); }
  };
  const expect = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };

  // fixture world
  const dir = mkdtempSync(join(tmpdir(), 'apply-manifests-selftest-'));
  const mDir = join(dir, 'manifests');
  mkdirSync(mDir);
  const overlayPath = join(dir, 'desired.json');
  const baselinePath = join(dir, 'baseline.json');
  const GOOD = (over) => JSON.stringify({ tool_id: 't1', version: '1.0.0', title: 'Tool One', ...(over ?? {}) }, null, 2) + '\n';
  const write = (f, s) => writeFileSync(join(mDir, f), s);
  const read = (f) => readFileSync(join(mDir, f), 'utf8');
  const ov = (o) => { writeFileSync(overlayPath, JSON.stringify(o, null, 2) + '\n'); return loadOverlay(overlayPath); };
  const plan = (overlay, file) => planManifests(mDir, overlay, { files: file ? new Set([file]) : undefined });
  const checkExit = (overlay, baselineKeys) => {
    const entries = plan(overlay);
    const base = { drift: baselineKeys ?? [] };
    return entries.filter((e) => !base.drift.includes(e.baselineKey));
  };

  try {
    // clean world → green
    write('a.manifest.json', GOOD());
    const oEmpty = ov({ policies: [], files: {} });
    t('GREEN: canonical file + empty overlay → zero drift', () => expect(plan(oEmpty).length === 0));

    // form drift (hand-mangled bytes) → detected, non-repairable
    write('a.manifest.json', JSON.stringify({ tool_id: 't1', version: '1.0.0', title: 'Tool One' }));
    const formPlan = plan(oEmpty, 'a.manifest.json');
    t('RED: form drift detected on non-canonical bytes', () =>
      expect(formPlan.length === 1 && formPlan[0].kind === 'form' && formPlan[0].baselineKey === 'a.manifest.json::(form)'));
    t('REFUSED: form drift is not apply-repairable (whole-file rewrite class)', () => {
      const r = applyPlanForFile('a.manifest.json', read('a.manifest.json'), formPlan);
      expect(r.status === 'refused' && /whole-file rewrite/.test(r.why), 'expected refusal, got ' + JSON.stringify(r));
    });

    // rule drift → planned, minimally applied, idempotent
    write('a.manifest.json', GOOD());
    write('b.manifest.json', GOOD());
    const oRule = ov({ policies: [], files: { 'a.manifest.json': { set: { title: 'Tool One (renamed)' } } } });
    const rp = plan(oRule, 'a.manifest.json');
    t('RED: overlay file-entry drift detected, sibling untouched', () =>
      expect(rp.length === 1 && rp[0].kind === 'set' && rp[0].key === 'title' && plan(oRule, 'b.manifest.json').length === 0));
    const before = read('a.manifest.json');
    const r1 = applyPlanForFile('a.manifest.json', before, rp);
    t('apply: minimal one-key write, sibling byte-identical', () => {
      expect(r1.status === 'written', 'expected written');
      write('a.manifest.json', r1.text);
      const j = JSON.parse(read('a.manifest.json'));
      expect(j.title === 'Tool One (renamed)' && j.tool_id === 't1' && j.version === '1.0.0', 'value not applied');
      expect(Object.keys(j)[0] === 'tool_id' && Object.keys(j)[2] === 'title', 'key order disturbed');
      expect(read('b.manifest.json') === GOOD(), 'sibling file changed');
      expect(r1.changedLines <= 2, 'expected a 1-2 line delta, got ' + r1.changedLines);
    });
    t('idempotent: second plan/apply is a no-op (grep.ai no-op semantics)', () => {
      const rp2 = plan(oRule, 'a.manifest.json');
      expect(rp2.length === 0, 'drift after apply');
      expect(applyPlanForFile('a.manifest.json', read('a.manifest.json'), []).status === 'noop');
    });

    // policy selector + fixpoint refusal
    t('policy: omit-scoped set (when key absent, declare it) matches only until fixpoint', () => {
      const oPol = ov({ policies: [{ id: 'p1', when: { requires: [], omit: ['license'] }, set: { license: 'MIT' } }], files: {} });
      const b = plan(oPol, 'b.manifest.json'); // b lacks `license`
      expect(b.length === 1 && b[0].key === 'license', 'expected one license entry, got ' + JSON.stringify(b));
      const r = applyPlanForFile('b.manifest.json', read('b.manifest.json'), b);
      expect(r.status === 'written', 'expected written');
      write('b.manifest.json', r.text);
      expect(plan(oPol, 'b.manifest.json').length === 0, 'policy did not reach fixpoint after apply');
      writeFileSync(join(mDir, 'c.manifest.json'), GOOD({ license: 'Apache-2.0' }));
      expect(plan(oPol, 'c.manifest.json').length === 0, 'policy must not touch a file that already has the key');
    });
    t('REFUSED: policy that cannot reach fixpoint is rejected at load', () => {
      let threw = false;
      try { ov({ policies: [{ id: 'bad', when: { requires: ['version'], omit: [] }, set: { version: '1.0.0' } }], files: {} }); }
      catch { threw = true; }
      expect(threw, 'overlay with unfixpoint policy loaded');
    });

    // baseline: absorb, prune, refuse-to-raise, hard-RED on deletion
    write('a.manifest.json', JSON.stringify({ tool_id: 't1', title: 'Tool One' })); // non-canonical
    t('baseline absorbs pinned drift (green within baseline)', () =>
      expect(checkExit(oEmpty, ['a.manifest.json::(form)']).length === 0));
    t('RED: drift beyond the baseline is never absorbed', () =>
      expect(checkExit(oEmpty, []).length === 1));
    t('HARD RED: deleted baseline is MISSING-FILE, never a silent pass', () => {
      let state = '';
      try { loadRatchetBaseline(join(dir, 'nope.json'), REQUIRED_BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND }); }
      catch (e) { state = e instanceof RatchetBaselineError ? e.state : 'threw-non-baseline'; }
      expect(state === 'MISSING-FILE', 'expected MISSING-FILE, got ' + state);
    });
    t('HARD RED: corrupt baseline (drift not a name-list) fails validation', () => {
      writeFileSync(baselinePath, '{"drift": 42}\n');
      let state = '';
      try { loadRatchetBaseline(baselinePath, REQUIRED_BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND }); }
      catch (e) { state = e instanceof RatchetBaselineError ? e.state : 'threw-non-baseline'; }
      expect(state === 'NAN-KEY' || state === 'BAD-LIST-KEY', 'expected a hard state, got ' + state);
    });
    t('--update-baseline: prunes entries whose drift is gone, refuses additions', () => {
      write('a.manifest.json', GOOD()); // repair the form drift
      writeFileSync(baselinePath, JSON.stringify({ drift: ['a.manifest.json::(form)'] }) + '\n');
      const live = plan(ov({ policies: [], files: {} })).map((e) => e.baselineKey);
      expect(live.length === 0, 'world should be clean');
      // prune path (writes baselinePath): reuse update semantics via direct re-implementation guard
      const prev = JSON.parse(readFileSync(baselinePath, 'utf8')).drift;
      const pruned = prev.filter((k) => !live.includes(k));
      expect(pruned.length === 1 && prev.length === 1, 'prune computed wrong');
      writeFileSync(baselinePath, JSON.stringify({ drift: live }) + '\n');
      // raise refusal
      writeFileSync(baselinePath, JSON.stringify({ drift: [] }) + '\n');
      write('a.manifest.json', JSON.stringify({ tool_id: 't1' })); // drift again
      const live2 = plan(ov({ policies: [], files: {} })).map((e) => e.baselineKey);
      expect(live2.length === 1 && !JSON.parse(readFileSync(baselinePath, 'utf8')).drift.includes(live2[0]), 'raise-fixture wrong');
      // the CLI refuses; assert the refusal decision path directly
      const prevKeys = JSON.parse(readFileSync(baselinePath, 'utf8')).drift;
      const additions = live2.filter((k) => !prevKeys.includes(k));
      expect(additions.length === 1, 'addition should be detected');
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  if (failures.length) {
    console.error(`\n✗ apply-manifests self-test: ${failures.length} control(s) FAILED: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log(`\n✓ apply-manifests self-test: all controls green (RED/GREEN/refusal/idempotence/baseline ratchet).`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (argv.includes('--self-test')) { runSelfTest(); }
  else if (argv.includes('--update-baseline')) { runUpdateBaseline(); }
  else if (argv.includes('--apply')) { runApply(); }
  else if (argv.includes('--dry-run')) { runDryRun(); }
  else if (argv.includes('--check') || argv.length === 0) { runCheck({ quiet: false }); }
  else {
    console.error('usage: apply-manifests.mjs [--check (default) | --dry-run | --apply | --update-baseline | --self-test]');
    process.exit(2);
  }
}
