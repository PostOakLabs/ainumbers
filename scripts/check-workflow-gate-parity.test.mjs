/**
 * scripts/check-workflow-gate-parity.test.mjs — paired self-test for the STATUS
 * axis (WORKFLOW-GATE-PARITY-ASSERT-1) and the REVERSE-PRESENCE axis
 * (CONTRACT-CLAIM-COVERAGE-1) of check-workflow-gate-parity.mjs
 * (GATE-SELFTEST-META-1, SO #40b).
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * SO #40b: "a checker that cannot be shown red proves nothing." The status-parity
 * assertion is a comparison over two text extractions, and a comparison fails in
 * one direction that matters: it can quietly compare NOTHING — because a regex
 * stopped matching, because a workflow stopped being classified, because an
 * argument string drifted — and report "consistent". That reads exactly like a
 * clean repo. So every case below is a MUTATION control: it builds a synthetic
 * call-site set, changes exactly ONE thing, and asserts the verdict moves.
 *
 * ⭐ The cases marked ABSENCE are the ones this row exists for. The family it
 * belongs to (MERGEQUEUE-GATE-PARITY-1 variants 1–4) is made of gates that were
 * green because nobody looked, not because anything agreed.
 *
 * Nothing under .github/ or scripts/ is read except the checker's own exports;
 * every fixture is an in-memory string.
 *
 * Run: node scripts/check-workflow-gate-parity.test.mjs
 */
import {
  statusParity, reversePresence, prReachable, workflowCommands, preflightCommands,
  unwrapRunGate, scriptOf, normalizeCmd, softeners, HARD, SPLIT,
} from './check-workflow-gate-parity.mjs';

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    fail++;
    failures.push(`${name}\n      ${e.message}`);
    console.log(`  \u2717 ${name}\n      ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const kinds = (r) => r.problems.map((p) => p.kind);
const has = (r, kind) => kinds(r).includes(kind);

const GATE = 'node scripts/gen-thing.mjs --check';

/** A minimal blocking workflow whose `on:` block makes it PR-reachable. */
function prWorkflow(runLine, name = 'pr-gate.yml') {
  return {
    file: name,
    blocking: true,
    text: [
      'name: PR Gate',
      'on:',
      '  push:',
      '    branches: [ main ]',
      '  pull_request:',
      '    types: [opened]',
      '  merge_group:',
      '    types: [checks_requested]',
      'jobs:',
      '  verify:',
      '    steps:',
      '      - name: The gate',
      `        run: ${runLine}`,
      '',
    ].join('\n'),
  };
}

/** The same workflow with only main-side triggers. */
function mainOnlyWorkflow(runLine, name = 'deploy.yml') {
  return {
    file: name,
    blocking: true,
    text: [
      'name: Deploy',
      'on:',
      '  push:',
      '    branches: [ main ]',
      '  workflow_dispatch: {}',
      'jobs:',
      '  deploy:',
      '    steps:',
      '      - name: The gate',
      `        run: ${runLine}`,
      '',
    ].join('\n'),
  };
}

const base = (workflows, extra = {}) => ({
  advisory: new Set([GATE]),
  preflight: new Map([[GATE, [10]]]),
  workflows,
  ...extra,
});
const noDecl = { declarations: new Map(), distinctLegs: new Map(), noCallSite: new Map(), softeners: new Map() };

console.log('check-workflow-gate-parity.test.mjs — status-axis mutation controls\n');

// ── 1. THE ROW'S KNOWN INSTANCE, in miniature ────────────────────────────────
// advisory in preflight (it is in advisoryGates()), raw in a PR-reachable
// workflow ⇒ the same commit gets two verdicts. This is gen-registry-kernel-
// resolve.mjs --check / land-verify.yml:176 with the names taken off.
test('RED - advisory in preflight + RAW in a PR-reachable workflow is an undeclared divergence', () => {
  const r = statusParity(base([prWorkflow(GATE)]), noDecl);
  assert(has(r, 'undeclared-divergence'), `expected undeclared-divergence, got ${JSON.stringify(kinds(r))}`);
  assert(r.census.undeclared.length === 1, 'the census must count it as DIVERGENT, UNDECLARED');
});

// ── 2. GREEN when the CI step goes through the wrapper ───────────────────────
test('GREEN - the same gate wrapped in run-gate.mjs is consistent', () => {
  const r = statusParity(base([prWorkflow(`node scripts/run-gate.mjs ${GATE}`)]), noDecl);
  assert(!has(r, 'undeclared-divergence'), `expected no divergence, got ${JSON.stringify(kinds(r))}`);
  assert(r.census.consistent.length === 1, 'the census must count it as consistent');
});

// ── 3. GREEN when the divergence is DECLARED — and the declaration is checked ─
test('GREEN - a DECLARED divergence passes, and the declaration is asserted against measurement', () => {
  const key = `pr-gate.yml :: ${GATE}`;
  const ok = statusParity(base([prWorkflow(GATE)]), {
    ...noDecl,
    declarations: new Map([[key, { ci: HARD, preflight: SPLIT, decided: '2026-08-23', why: 'deliberate' }]]),
  });
  assert(!has(ok, 'undeclared-divergence'), `a declared divergence must pass, got ${JSON.stringify(kinds(ok))}`);
  assert(ok.census.declared.length === 1, 'the census must count it as DIVERGENT, declared');

  // A declaration that MISDESCRIBES the statuses is not a declaration.
  const wrong = statusParity(base([prWorkflow(GATE)]), {
    ...noDecl,
    declarations: new Map([[key, { ci: SPLIT, preflight: HARD, decided: '2026-08-23', why: 'backwards' }]]),
  });
  assert(has(wrong, 'declaration-mismatch'), 'a declaration recording the wrong statuses must fail');
});

// ── 4. ABSENCE - a declaration may not outlive its call site ─────────────────
test('RED (ABSENCE) - a declaration matching no live divergence is STALE, not a pass', () => {
  const r = statusParity(base([prWorkflow(`node scripts/run-gate.mjs ${GATE}`)]), {
    ...noDecl,
    declarations: new Map([[`pr-gate.yml :: ${GATE}`, { ci: HARD, preflight: SPLIT, why: 'already aligned' }]]),
  });
  assert(has(r, 'stale-declaration'), `expected stale-declaration, got ${JSON.stringify(kinds(r))}`);
});

// ── 5. CONTEXT - a main-only workflow cannot diverge ─────────────────────────
// Not a waiver: isMainContext() is true there, so 'advisory-on-pr' and
// 'blocking' are the SAME behaviour. Flagging it would bury the real cases under
// 9 false positives (measured: deploy-to-dreamhost.yml raw-invokes 9 of them).
test('GREEN - a RAW invocation in a main-only workflow is consistent BY CONSTRUCTION', () => {
  const r = statusParity(base([mainOnlyWorkflow(GATE)]), noDecl);
  assert(!has(r, 'undeclared-divergence'), `main-only must not diverge, got ${JSON.stringify(kinds(r))}`);
  assert(r.census.mainOnly.length === 1, 'the census must count it as main-only');
});

// ── 6. ABSENCE - reachability must be DERIVED, and fail closed ───────────────
test('RED (ABSENCE) - an unparseable `on:` block fails CLOSED (treated as PR-reachable)', () => {
  const broken = { file: 'broken.yml', blocking: true, text: 'name: X\njobs:\n  a:\n    steps:\n      - run: ' + GATE + '\n' };
  assert(prReachable(broken.text).value === true, 'no `on:` block must fail closed to PR-reachable');
  const r = statusParity(base([broken]), noDecl);
  assert(has(r, 'undeclared-divergence'), 'a workflow we cannot classify must be COMPARED, not skipped');
});

// ── 7. ABSENCE - argument drift must not read as "some unrelated command" ────
// The silent-green this family is made of: exact-string grouping would put
// `--check --strict` in its own group of one, find no disagreement, and pass.
test('RED (ABSENCE) - an argument variant of an advisory gate script is flagged, never silently ignored', () => {
  const variant = 'node scripts/gen-thing.mjs --check --strict';
  const r = statusParity(base([prWorkflow(variant)]), noDecl);
  assert(has(r, 'argument-drift'), `expected argument-drift, got ${JSON.stringify(kinds(r))}`);
});

test('GREEN - a variant declared as a DISTINCT leg passes, and a stale leg entry does not', () => {
  const variant = 'node scripts/gen-thing.mjs';
  const ok = statusParity(base([prWorkflow(variant)]), {
    ...noDecl,
    distinctLegs: new Map([[variant, { sibling: GATE, why: 'different leg, hard everywhere' }]]),
  });
  assert(!has(ok, 'argument-drift'), `a declared leg must pass, got ${JSON.stringify(kinds(ok))}`);
  const stale = statusParity(base([prWorkflow(`node scripts/run-gate.mjs ${GATE}`)]), {
    ...noDecl,
    distinctLegs: new Map([['node scripts/gone.mjs', { sibling: GATE, why: 'deleted' }]]),
  });
  assert(has(stale, 'stale-declaration'), 'a DISTINCT_LEGS entry matching nothing must fail');
});

// ── 8. ABSENCE - an advisory gate nobody invokes is ABSENT, not consistent ───
// SO #34c at the call-site level. Measured live: `node scripts/sync-stats.mjs`
// is declared advisory in derived-artifacts.mjs and invoked at zero call sites.
test('RED (ABSENCE) - an advisory gate with ZERO call sites fails; declaring it passes', () => {
  const r = statusParity({ advisory: new Set([GATE]), preflight: new Map(), workflows: [] }, noDecl);
  assert(has(r, 'uncalled-advisory-gate'), `expected uncalled-advisory-gate, got ${JSON.stringify(kinds(r))}`);
  assert(r.census.uncalled.length === 1, 'the census must count it as uncalled');
  const ok = statusParity({ advisory: new Set([GATE]), preflight: new Map(), workflows: [] }, {
    ...noDecl,
    noCallSite: new Map([[GATE, { why: 'reported, not resolved' }]]),
  });
  assert(!has(ok, 'uncalled-advisory-gate'), 'a declared uncalled gate must pass');
});

// ── 9. ABSENCE - a THIRD status mechanism must not slip past the model ──────
test('RED (ABSENCE) - continue-on-error / `|| true` on a gate step is an undeclared softener', () => {
  const wf = prWorkflow(`node scripts/run-gate.mjs ${GATE}`);
  wf.text = wf.text.replace('      - name: The gate', '      - name: The gate\n        continue-on-error: true');
  const r = statusParity(base([wf]), noDecl);
  assert(has(r, 'undeclared-softener'), `expected undeclared-softener, got ${JSON.stringify(kinds(r))}`);

  const wf2 = prWorkflow(`node scripts/run-gate.mjs ${GATE} || true`);
  const r2 = statusParity(base([wf2]), noDecl);
  assert(has(r2, 'undeclared-softener'), '`|| true` on a gate line must be flagged too');
});

// ── 10. ABSENCE - a wrapper over a NON-advisory command reads split, blocks ──
test('RED (ABSENCE) - run-gate.mjs wrapping a command that is not in advisoryGates() is flagged', () => {
  const other = 'node scripts/check-other.mjs';
  const r = statusParity(base([prWorkflow(`node scripts/run-gate.mjs ${other}`)]), noDecl);
  assert(has(r, 'wrapped-not-advisory'), `expected wrapped-not-advisory, got ${JSON.stringify(kinds(r))}`);
});

// ── 11. ACCOUNTING - every advisory gate lands in exactly one bucket ─────────
test('RED (ABSENCE) - census accounting fails CLOSED if a gate is uncategorised', () => {
  const r = statusParity(base([prWorkflow(GATE)]), noDecl);
  const bucketed = r.census.consistent.length + r.census.mainOnly.length + r.census.declared.length
    + r.census.undeclared.length + r.census.preflightOnly.length + r.census.uncalled.length;
  assert(bucketed === r.total, `every advisory gate must be bucketed: ${bucketed} vs ${r.total}`);
  assert(!has(r, 'accounting'), 'a correctly bucketed run must not report an accounting failure');
});

// ── 12. EXTRACTION - the parts a silent green would come from ────────────────
test('PARSE - workflowCommands reads run: steps only, never a `node …` inside a comment', () => {
  const text = [
    'jobs:',
    '  a:',
    '    steps:',
    '      - name: hint',
    '        # Fix: node scripts/gen-chain-index.mjs (re-embeds grid), commit.',
    '        run: |',
    '          node scripts/one.mjs --check',
    '          # node scripts/commented-out.mjs',
    '          node scripts/two.mjs && node scripts/three.mjs',
    '      - name: next',
    '        run: node scripts/four.mjs',
    '',
  ].join('\n');
  const cmds = workflowCommands(text).map((c) => c.command);
  assert(cmds.includes('node scripts/one.mjs --check'), 'block-scalar line missed');
  assert(cmds.includes('node scripts/two.mjs') && cmds.includes('node scripts/three.mjs'), '&& not split');
  assert(cmds.includes('node scripts/four.mjs'), 'inline run: missed');
  assert(!cmds.some((c) => c.includes('gen-chain-index')), 'a remediation HINT in a comment is not a call site');
  assert(!cmds.some((c) => c.includes('commented-out')), 'a commented-out line inside a block is not a call site');
});

test('PARSE - preflightCommands reads the GATES literal only, and blanks commented-out rows', () => {
  const src = [
    'const OTHER = ["node scripts/not-a-gate.mjs"];',
    'const GATES = [',
    "  ['A', 'node scripts/alpha.mjs --check'],",
    "  // ['B', 'node scripts/beta.mjs --check'],",
    "  ['C', 'node scripts/gamma.mjs'],",
    '];',
    '',
  ].join('\n');
  const { commands, found } = preflightCommands(src);
  assert(found === true, 'the GATES literal must be located');
  assert(commands.has('node scripts/alpha.mjs --check'), 'live GATES row missed');
  assert(!commands.has('node scripts/beta.mjs --check'), 'a commented-out GATES row is not an execution');
  assert(!commands.has('node scripts/not-a-gate.mjs'), 'only the GATES array counts');
  assert(commands.get('node scripts/alpha.mjs --check')[0] === 3, 'line numbers must survive comment blanking');
});

test('PARSE - helpers: unwrapRunGate, scriptOf, normalizeCmd, softeners', () => {
  assert(unwrapRunGate('node scripts/run-gate.mjs node scripts/x.mjs --check').inner === 'node scripts/x.mjs --check', 'wrapper not peeled');
  assert(unwrapRunGate('node scripts/x.mjs').wrapped === false, 'unwrapped command misreported as wrapped');
  assert(scriptOf('node chaingraph/kernels/gen-index.mjs --check') === 'chaingraph/kernels/gen-index.mjs', 'script path wrong');
  assert(scriptOf('echo hi') === null, 'a non-node command has no gate script');
  assert(normalizeCmd('node   scripts\\x.mjs   --check ') === 'node scripts/x.mjs --check', 'normalisation wrong');
  assert(softeners('        run: node scripts/x.mjs || true').length === 1, '`|| true` missed');
  assert(softeners('        # run: node scripts/x.mjs || true').length === 0, 'a comment is not a softener');
});

test('PARSE - prReachable derives from the `on:` block, not from the file name', () => {
  assert(prReachable(prWorkflow(GATE).text).value === true, 'pull_request/merge_group must read as PR-reachable');
  assert(prReachable(mainOnlyWorkflow(GATE).text).value === false, 'push+dispatch only must read as main-only');
  assert(prReachable('on:\n  schedule:\n    - cron: "0 0 * * *"\n').value === false, 'schedule-only is main-only');
});

// ── AXIS 3: REVERSE PRESENCE (CONTRACT-CLAIM-COVERAGE-1, 2026-08-30) ─────────
// The converse of axis 1. Axis 1 asks "is every CI gate in preflight?"; axis 3
// asks "is every preflight gate in CI?". The second question had never been
// asked, and check_tools.js — which CONTRACT.md §6.2 calls "the BLOCKING first
// gate" — has been the answer's counterexample the whole time.
//
// Same mutation discipline as above: build a synthetic pair of gate sets, change
// exactly one thing, require the verdict to move. The ABSENCE cases matter most
// — an empty extraction and a clean estate print the same green.
const REV = 'node scripts/check-thing.mjs';
const revBase = (workflows, preflight = new Map([[REV, [7]]])) => ({ preflight, workflows });
const noAllow = { allowlist: new Map() };

test('AXIS3 RED - a preflight gate in NO blocking workflow is an unwired preflight gate', () => {
  const r = reversePresence(revBase([]), noAllow);
  assert(has(r, 'unwired-preflight-gate'), `expected unwired-preflight-gate, got ${kinds(r)}`);
  assert(r.census.undeclared.length === 1 && r.census.wired.length === 0, 'must land in the undeclared bucket');
});

test('AXIS3 GREEN - the same gate run by a blocking workflow is wired', () => {
  const r = reversePresence(revBase([prWorkflow(REV)]), noAllow);
  assert(r.problems.length === 0, `expected clean, got ${kinds(r)}`);
  assert(r.census.wired.length === 1, 'must land in the wired bucket');
});

test('AXIS3 GREEN - basename keying: an ARGUMENT variant in CI still counts as wired', () => {
  // preflight runs `--check`, the workflow runs `--check --strict`. CI does run
  // the gate; the argument question is axis 2's (DISTINCT_LEGS), not axis 3's.
  // Command-string keying here would report a WIRED gate as unwired.
  const r = reversePresence(
    revBase([prWorkflow('node scripts/check-thing.mjs --check --strict')], new Map([['node scripts/check-thing.mjs --check', [7]]])),
    noAllow,
  );
  assert(r.problems.length === 0, `expected clean, got ${kinds(r)}`);
});

test('AXIS3 RED (ABSENCE) - named ONLY in a non-blocking workflow is NOT wired', () => {
  const nb = { ...mainOnlyWorkflow(REV, 'schedule.yml'), blocking: false };
  const r = reversePresence(revBase([nb]), noAllow);
  assert(has(r, 'unwired-preflight-gate'), 'a scheduled/post-merge mention is not CI enforcement');
  assert(/gates no merge/.test(r.problems[0].detail), 'the report must SAY where it was found, not stay silent');
  assert(r.census.undeclared[0].nonBlocking?.length === 1, 'the non-blocking site must be recorded, not dropped');
});

test('AXIS3 GREEN - an allowlisted preflight-only gate passes, with its reason retained', () => {
  const r = reversePresence(revBase([]), { allowlist: new Map([['check-thing.mjs', 'declared: reason']]) });
  assert(r.problems.length === 0, `expected clean, got ${kinds(r)}`);
  assert(r.census.allowlisted[0].reason === 'declared: reason', 'the reason must survive into the census');
});

test('AXIS3 RED (ABSENCE) - an allowlist entry that matches nothing is STALE, not a pass', () => {
  const r = reversePresence(revBase([prWorkflow(REV)]), { allowlist: new Map([['check-thing.mjs', 'stale']]) });
  assert(has(r, 'stale-declaration'), 'a now-wired gate must not keep its exemption');
});

test('AXIS3 RED (ABSENCE) - an EMPTY preflight gate set fails CLOSED, never green', () => {
  // The one way this axis could quietly measure nothing: the GATES extraction
  // stops matching. "No preflight gates found" and "every gate is wired" are the
  // same green, and only one of them is true (SO #34c).
  const r = reversePresence(revBase([], new Map()), noAllow);
  assert(has(r, 'reverse-empty'), `an empty reverse set must fail closed, got ${kinds(r)}`);
});

test('AXIS3 SCOPE - a non-node preflight gate is COUNTED out-of-scope, never silently dropped', () => {
  const r = reversePresence(revBase([], new Map([['python scripts/check-yaml.py', [9]]])), noAllow);
  assert(r.census.outOfScope.length === 1, 'the python gate must be named in the census');
  assert(r.census.outOfScope[0].script === 'check-yaml.py', 'and named by script, not just counted');
  assert(has(r, 'reverse-empty'), 'with no node gates left, the axis still fails closed rather than reporting parity');
});

test('AXIS3 - the --no-allowlist lever re-reds every declared gate (permanent RED control)', () => {
  const allowlist = new Map([['check-thing.mjs', 'declared']]);
  assert(reversePresence(revBase([]), { allowlist }).problems.length === 0, 'declared ⇒ green');
  const red = reversePresence(revBase([]), { allowlist, useAllowlist: false });
  assert(has(red, 'unwired-preflight-gate'), 'useAllowlist:false must re-expose the declared case');
});

console.log(`\ncheck-workflow-gate-parity.test.mjs: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
