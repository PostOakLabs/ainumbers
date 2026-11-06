#!/usr/bin/env node
/**
 * scripts/check-mg-shadow-parity.mjs — MERGE-GROUP-SHADOW-SQUASH-SIM-1
 *
 * The `merge-group-shadow` job in scripts-verify.yml replays the merge queue's
 * judgment on the PR. It only works while it keeps pace with the queue: a step
 * added to land-verify.yml / scripts-verify.yml that runs ONLY under
 * `merge_group` is a queue-only red the shadow cannot see (the post-regen copy
 * validators and the proven-digest freeze were exactly that).
 *
 * This gate parses both workflows for every step whose `if:` mentions
 * `merge_group` (and every job whose job-level `if:` does), and requires each
 * to be either
 *   - REPLAYED: a step of the same purpose exists in the merge-group-shadow job
 *     (the map names the shadow step that carries it, and that step must exist), or
 *   - EXEMPT: listed with a measured reason.
 * Stale entries in either map fail too, so the maps cannot rot.
 *
 *   node scripts/check-mg-shadow-parity.mjs
 * Self-test: scripts/check-mg-shadow-parity.test.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = ['land-verify.yml', 'scripts-verify.yml'];
const SHADOW_FILE = 'scripts-verify.yml';
const SHADOW_JOB = 'merge-group-shadow';

// queue-only step/job (as "<file>::<name>") -> shadow step name that replays it.
export const REPLAYED = new Map([
  ['land-verify.yml::Ephemeral derived tree (merge_group)', 'Ephemeral derived tree (the merge_group assembly, byte-for-byte)'],
  ['land-verify.yml::Post-regen copy validators on the ephemeral tree (merge_group, HARD)', 'Post-regen copy validators on the squash-faithful tree (HARD)'],
  ['land-verify.yml::Derived-freshness, index-sync, sitemap (HARD on merge_group)', 'DERIVED_ROOT_GATES against the assembled tree (merge_group shape, HARD)'],
  ['land-verify.yml::Assert clean tree (merge_group — nothing derived was committed)', 'Assert clean tree (nothing derived was committed)'],
  ['scripts-verify.yml::Ephemeral derived tree (merge_group, push:main non-regen, dispatch)', 'Ephemeral derived tree (the merge_group assembly, byte-for-byte)'],
  ['scripts-verify.yml::Assert clean tree (nothing derived was committed)', 'Assert clean tree (nothing derived was committed)'],
]);

// queue-only step/job -> why the shadow does not run it. Keep tight.
export const EXEMPT = new Map([
  ['land-verify.yml::Main regen state (advisory only, never blocks)',
    'Advisory-only probe of the latest regen run on main via curl; its `if:` is pull_request || merge_group, ' +
    'so it already runs on the PR itself, and it never fails a job.'],
]);

/** Extract { job, name, cond } for every step / job whose `if:` mentions merge_group. */
export function queueOnlySteps(file, text) {
  const lines = text.split(/\r?\n/);
  const found = [];
  let job = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const jm = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
    if (jm) { job = jm[1]; continue; }
    const jif = /^ {4}if:\s*(.*)$/.exec(l);
    if (jif && job) {
      const cond = readCond(lines, i, 4, jif[1]);
      if (/merge_group/.test(cond)) found.push({ file, job, name: `job:${job}`, cond });
      continue;
    }
    const sm = /^ {6}- (?:name:\s*(.*)|\w+:.*)$/.exec(l);
    if (!sm || !job) continue;
    // Step block: until the next step start or a dedent to job level.
    let j = i + 1;
    while (j < lines.length && !/^ {6}- /.test(lines[j]) && !/^ {0,5}\S/.test(lines[j])) j++;
    let name = sm[1] ? sm[1].trim() : null;
    let cond = '';
    for (let k = i; k < j; k++) {
      const nm = /^ {8}name:\s*(.*)$/.exec(lines[k]);
      if (nm && !name) name = nm[1].trim();
      const im = /^ {8}if:\s*(.*)$/.exec(lines[k]);
      if (im) cond = readCond(lines, k, 8, im[1]);
    }
    if (/merge_group/.test(cond)) found.push({ file, job, name: name || `step@${i + 1}`, cond });
    i = j - 1;
  }
  return found;
}

function readCond(lines, idx, indent, first) {
  let cond = first;
  if (/^[>|][-+]?$/.test(first.trim())) {
    cond = '';
    for (let k = idx + 1; k < lines.length && new RegExp(`^ {${indent + 1},}\\S`).test(lines[k]); k++) cond += ' ' + lines[k].trim();
  }
  return cond;
}

/** Names of the steps inside the shadow job. */
export function shadowStepNames(text) {
  const lines = text.split(/\r?\n/);
  const names = [];
  let inJob = false;
  for (const l of lines) {
    const jm = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
    if (jm) inJob = jm[1] === SHADOW_JOB;
    const nm = /^ {6}- name:\s*(.*)$/.exec(l);
    if (inJob && nm) names.push(nm[1].trim());
  }
  return names;
}

/** Pure verdict over an already-read workflow set: { problems[], census }. */
export function evaluate(files, replayed = REPLAYED, exempt = EXEMPT) {
  const problems = [];
  const all = [];
  for (const [file, text] of Object.entries(files)) all.push(...queueOnlySteps(file, text));
  const shadow = new Set(shadowStepNames(files[SHADOW_FILE] ?? ''));
  const keys = new Set();
  for (const s of all) {
    // The shadow job itself is pull_request only; never its own subject.
    if (s.file === SHADOW_FILE && s.job === SHADOW_JOB) continue;
    const key = `${s.file}::${s.name}`;
    keys.add(key);
    if (replayed.has(key)) {
      if (!shadow.has(replayed.get(key))) problems.push(`${key}: mapped to shadow step "${replayed.get(key)}" which does not exist in ${SHADOW_JOB}`);
    } else if (!exempt.has(key)) {
      problems.push(`${key}: runs only under merge_group but ${SHADOW_JOB} neither replays nor exempts it. Add a replay step to ${SHADOW_JOB} (and REPLAYED here), or an EXEMPT entry with a measured reason.`);
    }
  }
  for (const k of [...replayed.keys(), ...exempt.keys()]) {
    if (!keys.has(k)) problems.push(`${k}: stale entry, no such merge_group-only step in the workflows`);
  }
  return { problems, census: { queueOnly: keys.size, replayed: replayed.size, exempt: exempt.size } };
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const files = {};
  for (const f of WORKFLOWS) files[f] = readFileSync(resolve(REPO, '.github', 'workflows', f), 'utf8');
  const { problems, census } = evaluate(files);
  if (problems.length) {
    console.error(`✗ merge-group-shadow parity: ${problems.length} problem(s)`);
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  console.log(`✓ merge-group-shadow parity: ${census.queueOnly} merge_group-only step(s), ${census.replayed} replayed, ${census.exempt} exempt.`);
}
