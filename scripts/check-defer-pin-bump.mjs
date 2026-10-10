#!/usr/bin/env node
// check-defer-pin-bump.mjs — NEWNODE-DEFER-PIN-DOCTRINE-1 bump-present lint (2026-10-09).
//
// WHAT: audits scripts/compute-proof-baseline.json (READ-ONLY — this lint never writes it) and,
// given a --base ref, the same file as of that ref, so a reviewer/CI step can verify that a PR
// which ADDS a deferred node also carries its §18 ceiling bump (the pr-autofix.yml
// "§18 bump rides the node PR" step output). RED (exit 1) if:
//   (1) deferred !== deferred_nodes.length (baseline self-consistency), or
//   (2) deferred_nodes GAINS an entry vs base without `deferred` rising by exactly the number of
//       gained names (the re-scope wording: "red if deferred_nodes gains an entry without the
//       matching deferred count change"), or
//   (3) a gained name was already in the BASE snapshot's known_gpu_false_nodes but not its
//       deferred_nodes — a previously-PROVEN node now deferred: a regression (S18-BASELINE-GUARD-1),
//       or
//   (4) deferred_nodes LOSES entries vs base without `deferred` dropping by exactly that number.
// DOCTRINE: board/reference/NEWNODE-DEFER-PIN-DOCTRINE.md — a new deferred gpu:false node pins its
// ceiling IN ITS OWN PR via the pr-autofix DERIVED_ROOT scratch bump, and in no other way.
// Zero-dependency. Reads only the baseline file + git; NEVER touches chaingraph.json, the gate
// source, kernels, or the baseline itself. Wiring into a workflow is intentionally out of scope
// (would be a line in pr-autofix.yml — a separate row).

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnv } from './_git-env-lib.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_REL = 'scripts/compute-proof-baseline.json';

function fail(msg) {
  console.error(`::error::check-defer-pin-bump: ${msg}`);
  process.exit(1);
}

function parseBaseline(text, label) {
  let j;
  try { j = JSON.parse(text); } catch (e) { fail(`${label}: not valid JSON: ${e.message}`); }
  if (!Array.isArray(j.deferred_nodes)) fail(`${label}: missing deferred_nodes[]`);
  if (!Number.isInteger(j.deferred)) fail(`${label}: missing integer "deferred"`);
  if (!Array.isArray(j.known_gpu_false_nodes)) fail(`${label}: missing known_gpu_false_nodes[]`);
  return j;
}

function args() {
  const out = { base: null, baseFile: null, baseline: join(REPO, BASELINE_REL) };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--base') out.base = a[++i];
    else if (a[i] === '--base-file') out.baseFile = a[++i];
    else if (a[i] === '--baseline') out.baseline = a[++i];
    else if (a[i] === '--help' || a[i] === '-h') {
      console.log('usage: node scripts/check-defer-pin-bump.mjs [--base <gitref>] [--base-file <path>] [--baseline <path>]');
      process.exit(0);
    } else fail(`unknown argument ${a[i]}`);
  }
  return out;
}

const opts = args();
const head = parseBaseline(readFileSync(opts.baseline, 'utf8'), `baseline ${opts.baseline}`);

// (1) self-consistency, always.
if (head.deferred !== head.deferred_nodes.length) {
  fail(`deferred=${head.deferred} but deferred_nodes has ${head.deferred_nodes.length} entries — baseline is internally inconsistent`);
}
const dup = head.deferred_nodes.filter((n, i) => head.deferred_nodes.indexOf(n) !== i);
if (dup.length) fail(`duplicate names in deferred_nodes: ${dup.join(', ')}`);
const unknown = head.deferred_nodes.filter((n) => !head.known_gpu_false_nodes.includes(n));
if (unknown.length) fail(`deferred_nodes entries absent from known_gpu_false_nodes: ${unknown.join(', ')}`);

if (!opts.base && !opts.baseFile) {
  console.log(`check-defer-pin-bump: OK (self-consistent; deferred=${head.deferred}, known_gpu_false_nodes=${head.known_gpu_false_nodes.length}). Pass --base <ref> to audit a PR's bump.`);
  process.exit(0);
}

let baseText;
if (opts.baseFile) baseText = readFileSync(opts.baseFile, 'utf8');
else {
  try {
    baseText = execFileSync('git', ['-C', REPO, 'show', `${opts.base}:${BASELINE_REL}`], { encoding: 'utf8', env: gitEnv() });
  } catch (e) {
    fail(`cannot read ${BASELINE_REL} at --base ${opts.base}: ${e.message.split('\n')[0]}`);
  }
}
const base = parseBaseline(baseText, `base ${opts.base || opts.baseFile}`);

const baseDeferred = new Set(base.deferred_nodes);
const headDeferred = new Set(head.deferred_nodes);
const added = head.deferred_nodes.filter((n) => !baseDeferred.has(n));
const removed = base.deferred_nodes.filter((n) => !headDeferred.has(n));

// (3) regression check FIRST — proven at pin, deferred now.
const regressions = added.filter((n) => base.known_gpu_false_nodes.includes(n));
if (regressions.length) {
  fail(`REGRESSION (S18-BASELINE-GUARD-1): ${regressions.join(', ')} was proven at the last pin and is deferred now — a re-park is a Tim call, not a baseline edit. STOP and report.`);
}

// (2)/(4) count must move by exactly the delta.
if (added.length > 0 && head.deferred !== base.deferred + added.length) {
  fail(`deferred_nodes gains ${added.length} entr${added.length === 1 ? 'y' : 'ies'} (${added.join(', ')}) but deferred went ${base.deferred} -> ${head.deferred}: the §18 ceiling bump is MISSING or wrong-sized. The pin rides the PR via pr-autofix (scratch DERIVED_ROOT + --update-baseline) — see board/reference/NEWNODE-DEFER-PIN-DOCTRINE.md.`);
}
if (removed.length > 0 && head.deferred !== base.deferred - removed.length) {
  fail(`deferred_nodes loses ${removed.length} entries (${removed.join(', ')}) but deferred went ${base.deferred} -> ${head.deferred}: count change does not match`);
}

console.log(`check-defer-pin-bump: OK (deferred ${base.deferred} -> ${head.deferred}; added=[${added.join(', ')}] removed=[${removed.join(', ')}]; provenance guard intact)`);
process.exit(0);
