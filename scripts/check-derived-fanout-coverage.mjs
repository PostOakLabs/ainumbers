#!/usr/bin/env node
/**
 * scripts/check-derived-fanout-coverage.mjs — NODE-FANOUT-REGEN-CLOSE-1
 *
 * ── THE DEFECT THIS GATE RETIRES ────────────────────────────────────────────
 * On 2026-08-21 three node registrations each turned `main` RED with the same
 * six stale derived surfaces: art-661 (#1409 -> fixed by #1423), art-664 (#1411
 * -> fixed inside MAIN-UNBLOCK-0821-1), art-665 (#1428 -> fixed by #1430).
 *
 * The root cause was not any one generator. It was that a generator could read
 * the node graph, publish a freshness gate that a node registration turns red,
 * and appear in NEITHER list of scripts/derived-artifacts.mjs — so no main-side
 * regen owned it and (SO #35) no PR was allowed to repair it. Absence read as
 * "fine" instead of as "undecided" (SO #34c: absence is never a pass).
 *
 * The blast radius was much wider than a red branch: a red `main` fails the
 * merge queue's simulated-merge check, which SILENTLY EJECTS every queued PR.
 * #1426, #1429 and #1431 all read OPEN / CLEAN / MERGEABLE with every check
 * green while `isInMergeQueue` was false. One unregenerated node stalled the
 * whole queue and `gh pr view` could not see it.
 *
 * ── WHAT IT ASSERTS ─────────────────────────────────────────────────────────
 * Every generator that BOTH (a) is executed by a scripts/preflight.mjs gate and
 * publishes a `--check` freshness mode, AND (b) reads the node graph, is
 * CLASSIFIED in scripts/derived-artifacts.mjs — either COVERED (main regenerates
 * it) or EXCLUDED (a decision, with its measured reason). Unclassified is the
 * failure. This does not decide which list a generator belongs in; it only makes
 * the decision mandatory and visible at the moment the generator is added.
 *
 * Plus one ordering assertion. COVERED runs in array order, and these surfaces
 * CASCADE: `gen-euc-register-page --check` reads GREEN while the register entry
 * it derives from is still missing, and only goes red once gen-euc-register has
 * written it (measured on the real pre-#1430 tree 278e0318). That invisibility
 * is why each incident cost roughly six sequential preflight cycles instead of
 * one. An entry may declare `after: '<id>'`; this gate proves the ordering holds,
 * so a future re-sort of COVERED cannot quietly reintroduce the cascade.
 *
 * ── INDEPENDENT DERIVATION (SO #34) ─────────────────────────────────────────
 * The candidate set is RECOMPUTED here from two primary sources — the GATES
 * array of scripts/preflight.mjs, and the source text of each generator it
 * invokes. Nothing is read from a stored list of "known node-sensitive
 * generators", because such a list is exactly the thing that went stale:
 * gen-euc-register sat in EXCLUDED under a NON-IDEMPOTENT reason that had
 * already stopped being true, and five further node-sensitive generators were in
 * neither list.
 *
 * ⚠ SECURITY RIDER (SO #34): this gate never `eval`s or `require`s an artifact
 * under test. Generator sources are read as TEXT and matched with regexes; they
 * are never executed. The one module it imports, scripts/derived-artifacts.mjs,
 * is the first-party SSOT whose data it needs (preflight.mjs imports the same
 * module for the same reason), and its module body is pure declarations behind
 * an `isMain` CLI guard.
 *
 * ── THE HEURISTIC, STATED PLAINLY ───────────────────────────────────────────
 * "Reads the node graph" is a source-text match for chaingraph.json /
 * chaingraph.meta.json / graph/nodes / kernels/index.mjs — the same deliberately
 * simple string-search rigor scripts/check-generator-coverage.mjs uses, not an
 * AST parse. It is intentionally OVER-inclusive: it flags read-only gates such
 * as check-node-complete.mjs, which are then classified as decisions rather than
 * quietly dropped. Over-inclusion costs one EXCLUDED entry; under-inclusion costs
 * a red main and a stalled merge queue.
 *
 * Usage:
 *   node scripts/check-derived-fanout-coverage.mjs
 *   node scripts/check-derived-fanout-coverage.mjs --repo <dir>   (fixture proof)
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoArgIdx = process.argv.indexOf('--repo');
const REPO = repoArgIdx !== -1 && process.argv[repoArgIdx + 1]
  ? resolve(process.argv[repoArgIdx + 1])
  : resolve(HERE, '..');

// A generator reads the node graph if its source names one of the graph's
// primary sources. Kept in one place so the test fixture and the real run agree.
export const GRAPH_SOURCE_RE = /chaingraph\.json|chaingraph\.meta\.json|graph[/\\]nodes|kernels[/\\]index\.mjs/;
// "Publishes a freshness check mode" — the exact quoted-argv-token form
// check-generator-coverage.mjs uses, so the two gates classify identically.
export const CHECK_FLAG_RE = /['"]--check['"]/;

/**
 * Every script path executed by a live GATES entry in preflight.mjs.
 * Full-line comments are stripped first: a commented-out row is not an
 * execution, and must not count as one.
 */
export function preflightInvokedScripts(preflightSrc) {
  const live = preflightSrc.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const arraySrc = (live.match(/const GATES = \[([\s\S]*?)\n\];/) || [, ''])[1];
  const invoked = new Map(); // script path -> [full command, ...]
  const quotedRe = /'([^']*)'|"([^"]*)"|`([^`]*)`/g;
  let m;
  while ((m = quotedRe.exec(arraySrc))) {
    const cmd = m[1] ?? m[2] ?? m[3] ?? '';
    if (!/^(node|python)\s+\S/.test(cmd)) continue;
    const path = cmd.split(/\s+/)[1];
    if (!path || path === '-e') continue;
    if (!invoked.has(path)) invoked.set(path, []);
    invoked.get(path).push(cmd);
  }
  return invoked;
}

/** The candidate set: preflight-invoked, publishes --check, reads the node graph. */
export function nodeSensitiveGenerators(repo) {
  const preflightSrc = readFileSync(resolve(repo, 'scripts', 'preflight.mjs'), 'utf8');
  const out = [];
  for (const [path, cmds] of preflightInvokedScripts(preflightSrc)) {
    // A *.test.mjs is a CONTROL, never a generator: it publishes no derived
    // artifact, so there is nothing for main to own and nothing a node can turn
    // stale. They are excluded structurally rather than listed one by one,
    // because a control that builds fixture sources naturally contains both
    // marker strings this gate keys on — this gate's OWN control does, and
    // flagged itself the moment it was wired into preflight. Caught by the
    // mutation suite, which is what a mutation suite is for.
    if (path.endsWith('.test.mjs')) continue;
    let src;
    try { src = readFileSync(resolve(repo, path), 'utf8'); } catch { continue; }
    if (!CHECK_FLAG_RE.test(src)) continue;
    if (!GRAPH_SOURCE_RE.test(src)) continue;
    out.push({ path, cmds });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** Classification, read from the SSOT: COVERED regen commands + EXCLUDED `script` fields. */
export function classification(COVERED, EXCLUDED) {
  const covered = new Map();
  for (const c of COVERED) {
    const script = String(c.regen).split(/\s+/)[1];
    if (script) covered.set(script, c.id);
  }
  const excluded = new Map();
  for (const e of EXCLUDED) {
    if (e.script) excluded.set(e.script, e.what);
  }
  return { covered, excluded };
}

/** COVERED entries declaring `after: '<id>'` must actually follow that id. */
export function orderingViolations(COVERED) {
  const pos = new Map(COVERED.map((c, i) => [c.id, i]));
  const bad = [];
  COVERED.forEach((c, i) => {
    if (!c.after) return;
    if (!pos.has(c.after)) {
      bad.push(`'${c.id}' declares after: '${c.after}', but no COVERED entry has that id`);
    } else if (pos.get(c.after) > i) {
      bad.push(`'${c.id}' (index ${i}) must run AFTER '${c.after}' (index ${pos.get(c.after)}) — its freshness gate cannot detect staleness until '${c.after}' has written`);
    }
  });
  return bad;
}

// ── READER LINT (DERIVED-READER-COVERAGE-1) ─────────────────────────────────
// The generator lint above makes "absent from both lists" mean undecided. This
// extends the same rule to READERS: a preflight gate that reads main-regen
// derived bytes but is in none of
//   (a) DERIVED_ROOT_GATES (exact command string — it overlay-reads the
//       merge_group tree, so it judges the tree main will hold),
//   (b) a COVERED entry's own `gate` (a freshness gate, advisory on PRs and
//       blocking on main), or
//   (c) scripts/derived-reader-allowlist.json ({ "<command>": "<reason>" }),
// judges the COMMITTED derived bytes on a PR, which are stale by construction.
// That is how check-webmcp-chain-execute went red only after the regen
// (MAIN-CHAIN-EXECUTE-HEAL-1).
//
// ⚠ THE HEURISTIC, STATED PLAINLY: this lint is TEXT-BASED (a string/path literal
// match on the invoked script's own source). It OVER-FLAGS dynamic or constructed
// reads (a mention in a comment or message counts) and can MISS fully computed
// paths and reads reached through a helper module. Allowlist entries absorb false
// positives, each with a measured reason. *.test.mjs controls are structurally out
// of scope (they build fixtures), exactly as for generators above.
//
// The allowlist is SHRINK-ONLY (the CONTRACT §1.4 copy-hallmarks baseline
// pattern): its size may never exceed READER_ALLOWLIST_MAX, so a NEW entry fails;
// an entry that is no longer needed (command gone, now covered, no longer a
// reader) also fails until removed. Lower READER_ALLOWLIST_MAX when you remove
// entries; never raise it — fix the gate by putting it in DERIVED_ROOT_GATES.
export const READER_ALLOWLIST_MAX = 46; // seeded 2026-11-05 at the measured count; only ever lowered

// Fixed derived reads named by the row; the rest of the set is read from the
// SSOT's COVERED artifacts, never restated here.
export const FIXED_DERIVED_READS = [
  'chaingraph/chaingraph.json', 'sitemap.xml', 'sitemap.html',
  'mcp/catalog.json', 'docs/catalog.json', '.well-known/',
];

/** Whole-file COVERED artifacts: files with a data extension (no page .html, no dir prefixes). */
export function coveredFileArtifacts(COVERED) {
  const out = new Set();
  for (const c of COVERED) {
    for (const a of c.artifacts || []) {
      if (/\.(json|xml|txt|md|js|mjs)$/.test(a)) out.add(a);
    }
  }
  return [...out].sort();
}

function derivedReadRe(COVERED) {
  const lits = new Set([...FIXED_DERIVED_READS, ...coveredFileArtifacts(COVERED)]);
  const alts = [...lits].map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '[/\\\\]'));
  alts.push('chaingraph\\.json\\b'); // bare name: join('chaingraph', 'chaingraph.json')
  return new RegExp(alts.join('|'));
}

/** Readers: every preflight command (not *.test.mjs) whose script source matches a derived read. */
// A self-test invocation runs a gate against its OWN fixtures, not the tree.
export const SELFTEST_CMD_RE = /\s--?self-?test\b|\.selftest\.mjs\b/;

export function derivedReaders(repo, COVERED, decidedScripts = new Set()) {
  const preflightSrc = readFileSync(resolve(repo, 'scripts', 'preflight.mjs'), 'utf8');
  const re = derivedReadRe(COVERED);
  const out = [];
  for (const [path, cmds] of preflightInvokedScripts(preflightSrc)) {
    if (path.endsWith('.test.mjs')) continue;
    // Generators the lint above already forced into COVERED/EXCLUDED are decided.
    if (decidedScripts.has(path)) continue;
    let src;
    try { src = readFileSync(resolve(repo, path), 'utf8'); } catch { continue; }
    const hit = src.match(re);
    if (!hit) continue;
    for (const cmd of new Set(cmds)) {
      if (SELFTEST_CMD_RE.test(cmd)) continue;
      // A parametrised spelling (`${id}`, `${changedRef}`) is not an exact command
      // string; the script's static spelling, where it has one, is judged instead.
      if (cmd.includes('${')) continue;
      out.push({ path, cmd, read: hit[0] });
    }
  }
  return out.sort((a, b) => a.cmd.localeCompare(b.cmd));
}

/** Pure verdict, so the control can drive it directly. */
export function readerVerdict({ readers, rootGates, coveredGates, allowlist, allowlistMax }) {
  const unclassified = readers.filter((r) => !rootGates.has(r.cmd) && !coveredGates.has(r.cmd) && !(r.cmd in allowlist));
  const readerCmds = new Set(readers.map((r) => r.cmd));
  const stale = Object.keys(allowlist).filter((k) =>
    !readerCmds.has(k) || rootGates.has(k) || coveredGates.has(k));
  const noReason = Object.entries(allowlist).filter(([, v]) => typeof v !== 'string' || v.trim().length < 12).map(([k]) => k);
  const overCeiling = Object.keys(allowlist).length > allowlistMax
    ? [`allowlist has ${Object.keys(allowlist).length} entries, ceiling is ${allowlistMax} (shrink-only: a new entry fails)`]
    : [];
  return { unclassified, stale, noReason, overCeiling };
}

// ── run ──────────────────────────────────────────────────────────────────────
const ssot = await import(pathToFileURL(resolve(REPO, 'scripts', 'derived-artifacts.mjs')).href);
const { covered, excluded } = classification(ssot.COVERED, ssot.EXCLUDED);
const candidates = nodeSensitiveGenerators(REPO);

const unclassified = [];
for (const c of candidates) {
  if (covered.has(c.path) || excluded.has(c.path)) continue;
  unclassified.push(c);
}
const orderBad = orderingViolations(ssot.COVERED);

console.log(
  `check-derived-fanout-coverage: ${candidates.length} preflight freshness generator(s) read the node graph — `
  + `${candidates.filter((c) => covered.has(c.path)).length} COVERED, `
  + `${candidates.filter((c) => excluded.has(c.path)).length} EXCLUDED.`,
);

if (unclassified.length) {
  console.error(`\n✗ NODE-FANOUT-REGEN-CLOSE-1 FAILED — ${unclassified.length} node-sensitive generator(s) classified in NEITHER list:`);
  for (const c of unclassified) console.error(`  • ${c.path}   [preflight gate: ${c.cmds.join(' | ')}]`);
  console.error('\nA node registering in chaingraph.json can turn each of these gates RED on main, and SO #35');
  console.error('forbids the PR that caused the drift from repairing it — so an unowned generator reds the');
  console.error('default branch and silently ejects every PR waiting in the merge queue.');
  console.error('\nDecide, in scripts/derived-artifacts.mjs:');
  console.error('  • COVERED  — add an entry whose `regen` names the script. Prove idempotency FIRST');
  console.error('               (two write passes, compare BYTES not `git status`): the regen bot pushes with');
  console.error('               an App token, which re-triggers the workflow, so a generator that always');
  console.error('               diffs never converges.');
  console.error('  • EXCLUDED — add an entry with `script:` and a MEASURED `why:`. A reason, never a shrug.');
}
if (orderBad.length) {
  console.error(`\n✗ NODE-FANOUT-REGEN-CLOSE-1 FAILED — ${orderBad.length} COVERED ordering violation(s):`);
  for (const b of orderBad) console.error('  • ' + b);
}

// ── reader lint run ─────────────────────────────────────────────────────────
const maxIdx = process.argv.indexOf('--allowlist-max'); // fixture proof only
const allowlistMax = maxIdx !== -1 ? Number(process.argv[maxIdx + 1]) : READER_ALLOWLIST_MAX;
let allowlist = {};
try { allowlist = JSON.parse(readFileSync(resolve(REPO, 'scripts', 'derived-reader-allowlist.json'), 'utf8')); } catch { /* absent = empty */ }
const readers = derivedReaders(REPO, ssot.COVERED, new Set([...covered.keys(), ...excluded.keys()]));
const rv = readerVerdict({
  readers,
  rootGates: new Set(ssot.DERIVED_ROOT_GATES ?? []),
  coveredGates: new Set(ssot.COVERED.map((c) => c.gate).filter(Boolean)),
  allowlist,
  allowlistMax,
});
console.log(`check-derived-fanout-coverage: ${readers.length} preflight gate command(s) read main-regen derived bytes (TEXT-BASED match) — ${Object.keys(allowlist).length} allowlisted.`);
const readerBad = rv.unclassified.length + rv.stale.length + rv.noReason.length + rv.overCeiling.length;
if (rv.unclassified.length) {
  console.error(`\n✗ DERIVED-READER-COVERAGE-1 FAILED — ${rv.unclassified.length} gate(s) read main-regen derived bytes but are in NONE of DERIVED_ROOT_GATES, a COVERED gate, or scripts/derived-reader-allowlist.json:`);
  for (const r of rv.unclassified) console.error(`  • ${r.cmd}   [reads: ${r.read}]`);
  console.error('\nOn a PR such a gate judges the COMMITTED (stale-by-construction) derived bytes, so a regen can turn it red only after merge.');
  console.error('Fix: make it DERIVED_ROOT-aware and add its exact command to DERIVED_ROOT_GATES in scripts/derived-artifacts.mjs.');
  console.error('Last resort (a false positive of this text match): add it to the allowlist with a measured reason — the allowlist is shrink-only and a new entry exceeds its ceiling.');
}
if (rv.stale.length) {
  console.error(`\n✗ DERIVED-READER-COVERAGE-1 FAILED — ${rv.stale.length} stale allowlist entr(y/ies) (not a current uncovered reader; remove, then lower READER_ALLOWLIST_MAX):`);
  for (const k of rv.stale) console.error('  • ' + k);
}
if (rv.noReason.length) {
  console.error(`\n✗ DERIVED-READER-COVERAGE-1 FAILED — allowlist entr(y/ies) without a measured reason: ${rv.noReason.join(' | ')}`);
}
for (const o of rv.overCeiling) console.error(`\n✗ DERIVED-READER-COVERAGE-1 FAILED — ${o}`);

if (unclassified.length || orderBad.length || readerBad) process.exit(1);

console.log('✓ every node-sensitive freshness generator is classified, COVERED order respects every declared dependency, and every derived-bytes reader is covered or allowlisted.');
