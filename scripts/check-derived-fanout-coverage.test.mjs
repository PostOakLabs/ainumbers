#!/usr/bin/env node
/**
 * scripts/check-derived-fanout-coverage.test.mjs — the CONTROL for
 * NODE-FANOUT-REGEN-CLOSE-1's coverage gate.
 *
 * A gate that has only ever been seen green proves nothing (SO #34: verify a
 * checker by MUTATION, never by reading it; SO #40(b): a new gate proves RED
 * before GREEN). Each case below builds a throwaway mini-repo — a preflight.mjs
 * carrying a GATES array and a derived-artifacts.mjs carrying COVERED/EXCLUDED —
 * flips exactly one fact, and requires the verdict to move.
 *
 * The cases mirror the real defect, not a synthetic one:
 *   1. GREEN  — a node-sensitive generator listed in COVERED.
 *   2. GREEN  — the same generator listed in EXCLUDED with a `script` field.
 *   3. RED    — the same generator in NEITHER list. This is exactly the state
 *               main was in for gen-registry-kernel-resolve, gen-fv-status,
 *               gen-integrator-profile, gen-euc-register-page and generate-okf
 *               while three consecutive registrations redded the branch.
 *   4. GREEN  — a generator that reads the node graph but publishes no freshness
 *               check mode is out of scope (nothing can go red).
 *   5. GREEN  — a generator with a freshness check mode that never reads the
 *               node graph is out of scope (a node cannot drift it).
 *   6. RED    — an EXCLUDED entry with prose but NO `script` field does not
 *               count as a classification. This is the precise regression that
 *               would re-open the hole: EXCLUDED text alone was unreadable by
 *               any machine, which is how a stale reason survived.
 *   7. RED    — a COVERED entry ordered before the entry it declares `after`.
 *               The cascade property, mutated.
 *   8. GREEN  — the same two entries in the correct order.
 *
 * Usage: node scripts/check-derived-fanout-coverage.test.mjs
 *
 * SANDBOX-FILELIST-SWEEP-2 DISPOSITION — DECLARED OUT, not converted to scripts/lib-sandbox-deps.mjs.
 * generatorSrc()/ssotSrc()/preflightSrc() SYNTHESIZE every fixture module's source from a template
 * string (see buildRepo() below); no fixture file here is a copy of a real repository file, so there
 * is no import graph to derive and no hand-maintained file LIST to go stale. The near-miss class this
 * row exists to close — a fixture silently missing a file the real module now imports — cannot occur
 * in a harness that never copies real files at all.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = resolve(HERE, 'check-derived-fanout-coverage.mjs');

/** A generator source with the two properties the gate keys on. */
function generatorSrc({ readsGraph, hasCheck }) {
  return [
    '// fixture generator',
    readsGraph ? "const CG = 'chaingraph/chaingraph.json';" : "const CG = 'nothing/relevant.json';",
    hasCheck ? "const isCheck = process.argv.includes('--check');" : 'const isCheck = false;',
    'export default { CG, isCheck };',
    '',
  ].join('\n');
}

function ssotSrc(covered, excluded, rootGates) {
  return [
    'export const COVERED = ' + JSON.stringify(covered, null, 2) + ';',
    'export const EXCLUDED = ' + JSON.stringify(excluded, null, 2) + ';',
    'export const DERIVED_ROOT_GATES = new Set(' + JSON.stringify(rootGates ?? []) + ');',
    '',
  ].join('\n');
}

function preflightSrc(commands) {
  return [
    'const GATES = [',
    ...commands.map((c) => `  ['fixture gate', ${JSON.stringify(c)}],`),
    '];',
    'export default GATES;',
    '',
  ].join('\n');
}

function buildRepo({ generators, covered, excluded, gateCommands, rootGates, readerAllowlist }) {
  const root = mkdtempSync(join(tmpdir(), 'fanout-fixture-'));
  mkdirSync(join(root, 'scripts'), { recursive: true });
  for (const [rel, opts] of Object.entries(generators)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), generatorSrc(opts));
  }
  writeFileSync(join(root, 'scripts', 'preflight.mjs'), preflightSrc(gateCommands));
  writeFileSync(join(root, 'scripts', 'derived-artifacts.mjs'), ssotSrc(covered, excluded, rootGates));
  if (readerAllowlist) {
    writeFileSync(join(root, 'scripts', 'derived-reader-allowlist.json'), JSON.stringify(readerAllowlist));
  }
  return root;
}

// `--allowlist-max` is the fixture-only override of the pinned ceiling (the real
// run never passes it); each case states the ceiling it is proving.
function runGate(root, allowlistMax = 0) {
  try {
    const out = execFileSync(process.execPath, [GATE, '--repo', root, '--allowlist-max', String(allowlistMax)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const GEN = 'scripts/gen-fixture-thing.mjs';
const cases = [];

// 1. COVERED ⇒ green
cases.push({
  name: 'node-sensitive generator listed in COVERED',
  expect: 0,
  repo: {
    generators: { [GEN]: { readsGraph: true, hasCheck: true } },
    gateCommands: [`node ${GEN} --check`],
    covered: [{ id: 'fixture', regen: `node ${GEN} --write`, gate: `node ${GEN} --check`, artifacts: ['x'] }],
    excluded: [],
  },
});

// 2. EXCLUDED with a script field ⇒ green
cases.push({
  name: 'node-sensitive generator listed in EXCLUDED with script:',
  expect: 0,
  repo: {
    generators: { [GEN]: { readsGraph: true, hasCheck: true } },
    gateCommands: [`node ${GEN} --check`],
    covered: [],
    excluded: [{ what: 'fixture thing', script: GEN, why: 'measured reason' }],
  },
});

// 3. THE REAL DEFECT — in neither list ⇒ red
cases.push({
  name: 'node-sensitive generator in NEITHER list (the 2026-08-21 defect)',
  expect: 1,
  repo: {
    generators: { [GEN]: { readsGraph: true, hasCheck: true } },
    gateCommands: [`node ${GEN} --check`],
    covered: [],
    excluded: [],
  },
});

// 4. no check mode ⇒ out of scope, green
cases.push({
  name: 'reads the node graph but publishes no freshness check mode',
  expect: 0,
  repo: {
    generators: { [GEN]: { readsGraph: true, hasCheck: false } },
    gateCommands: [`node ${GEN}`],
    covered: [],
    excluded: [],
    // Out of the GENERATOR lint, but it IS a reader of the monolith: the reader
    // lint below needs it decided, so it carries a reasoned allowlist entry.
    readerAllowlist: { [`node ${GEN}`]: 'fixture reason: reads the committed monolith, PR-side stale' },
  },
  max: 1,
});

// 5. no graph read ⇒ out of scope, green
cases.push({
  name: 'has a freshness check mode but never reads the node graph',
  expect: 0,
  repo: {
    generators: { [GEN]: { readsGraph: false, hasCheck: true } },
    gateCommands: [`node ${GEN} --check`],
    covered: [],
    excluded: [],
  },
});

// 6. EXCLUDED prose with no script field ⇒ still unclassified, red
cases.push({
  name: 'EXCLUDED prose naming the file but with NO script: field',
  expect: 1,
  repo: {
    generators: { [GEN]: { readsGraph: true, hasCheck: true } },
    gateCommands: [`node ${GEN} --check`],
    covered: [],
    excluded: [{ what: `${GEN} — mentioned only in prose`, why: 'unreadable by any machine' }],
  },
});

// 7/8. ordering mutation
const GEN_A = 'scripts/gen-fixture-entries.mjs';
const GEN_B = 'scripts/gen-fixture-page.mjs';
const orderRepo = (order) => ({
  generators: {
    [GEN_A]: { readsGraph: true, hasCheck: true },
    [GEN_B]: { readsGraph: true, hasCheck: true },
  },
  gateCommands: [`node ${GEN_A} --check`, `node ${GEN_B} --check`],
  covered: order,
  excluded: [],
});
const entryEntry = { id: 'entries', regen: `node ${GEN_A}`, gate: `node ${GEN_A} --check`, artifacts: ['a'] };
const pageEntry = { id: 'page', regen: `node ${GEN_B}`, gate: `node ${GEN_B} --check`, after: 'entries', artifacts: ['b'] };
cases.push({ name: 'COVERED entry ordered BEFORE the entry it declares after:', expect: 1, repo: orderRepo([pageEntry, entryEntry]) });
cases.push({ name: 'the same two entries in the correct order', expect: 0, repo: orderRepo([entryEntry, pageEntry]) });

// 9. A *.test.mjs control is never a candidate, however it reads. THIS FILE is
// the reason the case exists: it builds fixture generator sources, so it
// contains both marker strings, and it flagged ITSELF the first time it was
// wired into preflight. A control that demands classification of controls would
// make the gate demand an EXCLUDED entry for every future self-test.
cases.push({
  name: 'a *.test.mjs control is structurally out of scope, whatever it contains',
  expect: 0,
  repo: {
    generators: { 'scripts/gen-fixture-thing.test.mjs': { readsGraph: true, hasCheck: true } },
    gateCommands: ['node scripts/gen-fixture-thing.test.mjs'],
    covered: [],
    excluded: [],
  },
});

// ── DERIVED-READER-COVERAGE-1: the reader lint (text-based; see the gate header) ──
// A fixture GATE that reads chaingraph.json but publishes no --check mode, so it
// is out of the generator lint and only the reader lint can judge it.
const RDR = 'scripts/check-fixture-reader.mjs';
const RDR_CMD = `node ${RDR}`;
const rdrRepo = (extra = {}) => ({
  generators: { [RDR]: { readsGraph: true, hasCheck: false } },
  gateCommands: [RDR_CMD],
  covered: [],
  excluded: [],
  ...extra,
});
const REASON = 'fixture reason: reads the committed monolith, PR-side stale';

// 10. RED  — reads chaingraph.json, in no membership list (the check-webmcp-chain-execute shape).
cases.push({ name: 'reader of chaingraph.json in NO list (the MAIN-CHAIN-EXECUTE-HEAL-1 shape)', expect: 1, repo: rdrRepo() });
// 11. GREEN — the same reader in DERIVED_ROOT_GATES.
cases.push({ name: 'the same reader in DERIVED_ROOT_GATES', expect: 0, repo: rdrRepo({ rootGates: [RDR_CMD] }) });
// 12. GREEN — the same reader as a COVERED entry's own freshness gate.
cases.push({
  name: 'the same reader as a COVERED entry\'s own gate',
  expect: 0,
  repo: rdrRepo({ covered: [{ id: 'fx', regen: 'node scripts/other-writer.mjs', gate: RDR_CMD, artifacts: ['x'] }] }),
});
// 13. GREEN — allowlisted with a reason, inside the ceiling.
cases.push({ name: 'the same reader allowlisted with a reason', expect: 0, max: 1, repo: rdrRepo({ readerAllowlist: { [RDR_CMD]: REASON } }) });
// 14. RED  — shrink-only: a NEW entry past the ceiling fails.
cases.push({
  name: 'a NEW allowlist entry past the ceiling (shrink-only)',
  expect: 1,
  max: 1,
  // Two REAL uncovered readers, both allowlisted, ceiling 1: only the ceiling can fail it.
  repo: rdrRepo({
    generators: { [RDR]: { readsGraph: true, hasCheck: false }, 'scripts/check-fixture-reader-2.mjs': { readsGraph: true, hasCheck: false } },
    gateCommands: [RDR_CMD, 'node scripts/check-fixture-reader-2.mjs'],
    readerAllowlist: { [RDR_CMD]: REASON, 'node scripts/check-fixture-reader-2.mjs': REASON },
  }),
});
// 15. RED  — an allowlist entry that is no longer an uncovered reader is stale.
cases.push({
  name: 'a STALE allowlist entry (the reader is now in DERIVED_ROOT_GATES)',
  expect: 1,
  max: 1,
  repo: rdrRepo({ rootGates: [RDR_CMD], readerAllowlist: { [RDR_CMD]: REASON } }),
});
// 16. RED  — an allowlist entry with no real reason.
cases.push({ name: 'an allowlist entry with no reason', expect: 1, max: 1, repo: rdrRepo({ readerAllowlist: { [RDR_CMD]: '' } }) });
// 17. GREEN — a self-test invocation runs on its own fixtures, not the tree.
cases.push({
  name: 'a --self-test invocation of a reader is out of scope',
  expect: 0,
  repo: rdrRepo({ gateCommands: [`${RDR_CMD} --self-test`] }),
});
// 18. GREEN — a script that reads nothing derived is out of scope.
cases.push({
  name: 'a gate that reads no derived bytes',
  expect: 0,
  repo: rdrRepo({ generators: { [RDR]: { readsGraph: false, hasCheck: false } } }),
});

let failures = 0;
for (const c of cases) {
  const root = buildRepo(c.repo);
  const { code, out } = runGate(root, c.max ?? 0);
  const ok = code === c.expect;
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${c.name} — expected exit ${c.expect}, got ${code}`);
  if (!ok) console.log(out.split('\n').map((l) => '      | ' + l).join('\n'));
  rmSync(root, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n✗ check-derived-fanout-coverage control FAILED — ${failures} of ${cases.length} case(s) did not move the verdict.`);
  console.error('  The gate cannot be trusted: a mutation it must catch went unnoticed, or a legitimate state was rejected.');
  process.exit(1);
}
console.log(`\n✓ check-derived-fanout-coverage control clean — ${cases.length} mutation case(s), every verdict moved as required.`);
