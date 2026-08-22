#!/usr/bin/env node
/**
 * scripts/reconcile-guard.test.mjs — paired self-test for reconcile-guard.mjs
 * (RECONCILE-PUSH-QUARANTINE-1). Hermetic: no network, no `gh`, no real push.
 * Every decision function in the guard is pure, so this drives them with
 * fixtures recorded from the actual 2026-08-22 incident.
 *
 * Four controls, exactly the ones the row demands (SO #40(b)):
 *
 *   RED        the literal 2026-08-22 shape — 16 bare branch names created at
 *              origin in one push — is REFUSED. Plus the obvious evasion: the
 *              same branches pushed ONE AT A TIME are still refused (R2).
 *   GREEN      the sanctioned shape — the same 16 under refs/heads/wip/ —
 *              PROCEEDS, and is flagged quarantine-only so the hook skips
 *              preflight (removing the reason to reach for --no-verify).
 *   UNCHANGED  an ordinary build row's ordinary push is completely unaffected:
 *              branch creation from HEAD, re-push of an existing branch, tag
 *              push, notes push, branch deletion — all allowed, and none of
 *              them is even classified as reconcile-class.
 *   CLASSIFIER a branch whose PR was SQUASH-MERGED is called SUPERSEDED, not
 *              UNIQUE. Fixture: wave41-cbpr-iso20022, one of the real 12, whose
 *              measurements are quoted below.
 *
 * Usage: node scripts/reconcile-guard.test.mjs   (exit 0 = all controls hold)
 */
import {
  parseRefLines,
  evaluatePush,
  renderRefusal,
  classifyBranch,
  QUARANTINE_PREFIX,
} from './reconcile-guard.mjs';

let failures = 0;
const results = [];

function check(control, label, cond, detail = '') {
  if (cond) {
    results.push(`  ✅ [${control}] ${label}`);
  } else {
    failures += 1;
    results.push(`  ❌ [${control}] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ── fixtures ───────────────────────────────────────────────────────────── */

// The 16 refs WORKTREE-RECONCILE-2 pushed to origin in one --no-verify push
// (research/BRANCH-INVENTORY-16-2026-08-22.md). All 16 were later measured
// SUPERSEDED and deleted the same day.
const THE_16 = [
  'acct-amort-k-1-local', 'art394-fixture-1', 'at-reframe-batch1', 'at-reframe-batch2',
  'ccpcore-land-1', 'ci-anchor-required-check-1', 'inbound-migr-1-v2', 'wave35-batch1',
  'wave35-batch3', 'wave35-batch4', 'wave35-batch5', 'wave41-cbpr-iso20022',
  'wave42-remittance', 'wave43-insurance-stp', 'wave44-corporate-treasury', 'wave45-sales-hr-stp',
];

const ZERO = '0'.repeat(40);
const HEAD_OID = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const oidFor = (i) => (i + 1).toString(16).padStart(2, '0').repeat(20);

const bareCreateLines = THE_16.map((b, i) => `refs/heads/${b} ${oidFor(i)} refs/heads/${b} ${ZERO}`);
const wipCreateLines = THE_16.map((b, i) => `refs/heads/${b} ${oidFor(i)} ${QUARANTINE_PREFIX}${b} ${ZERO}`);

/* ── RED ────────────────────────────────────────────────────────────────── */

const red = evaluatePush(parseRefLines(bareCreateLines.join('\n')), { headOid: HEAD_OID });
check('RED', 'the 2026-08-22 shape (16 bare branch creations in one push) is REFUSED', red.ok === false);
check('RED', 'all 16 refs are named in the refusal', red.violations.length === 16, `got ${red.violations.length}`);
check(
  'RED',
  'R1 BULK-CREATE fires',
  red.violations.every((v) => v.reasons.some((r) => r.startsWith('R1 BULK-CREATE'))),
);
check(
  'RED',
  'R2 NOT-HEAD fires (none of the 16 was the working HEAD)',
  red.violations.every((v) => v.reasons.some((r) => r.startsWith('R2 NOT-HEAD'))),
);
const redText = renderRefusal(red);
check('RED', 'refusal text names the quarantine namespace and the classifier',
  redText.includes('refs/heads/wip/') && redText.includes('--classify'));

// Evasion control: split the same sweep into 16 separate single-ref pushes.
// R1 no longer fires (one ref each) but R2 still does, because a reconcile row
// is by definition pushing branches it is not standing on.
const evaded = THE_16.map((b, i) =>
  evaluatePush(parseRefLines(`refs/heads/${b} ${oidFor(i)} refs/heads/${b} ${ZERO}`), { headOid: HEAD_OID }),
);
check('RED', 'evasion: the same 16 pushed ONE AT A TIME are each still refused (R2)', evaded.every((r) => r.ok === false));
check(
  'RED',
  'evasion: R1 correctly does NOT fire on a single-ref push (the refusal is R2 alone)',
  evaded.every((r) => r.violations[0].reasons.every((x) => !x.startsWith('R1'))),
);

/* ── GREEN ──────────────────────────────────────────────────────────────── */

const green = evaluatePush(parseRefLines(wipCreateLines.join('\n')), { headOid: HEAD_OID });
check('GREEN', 'the sanctioned shape (same 16 under refs/heads/wip/) PROCEEDS', green.ok === true);
check('GREEN', 'all 16 are counted as quarantined', green.quarantined.length === 16, `got ${green.quarantined.length}`);
check('GREEN', 'the push is flagged quarantine-only, so the hook skips preflight', green.quarantineOnly === true);

// Mutation control (SO #34): strip the wip/ prefix from ONE of the sanctioned
// refs and the GREEN case must flip RED. A guard that stays green here is
// reading nothing.
const mutated = wipCreateLines.slice();
mutated[0] = `refs/heads/${THE_16[0]} ${oidFor(0)} refs/heads/${THE_16[0]} ${ZERO}`;
const mutatedResult = evaluatePush(parseRefLines(mutated.join('\n')), { headOid: HEAD_OID });
check('GREEN', 'mutation: un-namespacing one ref flips GREEN to REFUSED', mutatedResult.ok === false);
check('GREEN', 'mutation: only the un-namespaced ref is flagged', mutatedResult.violations.length === 1);

/* ── UNCHANGED (this one matters most) ──────────────────────────────────── */

const ordinary = [
  ['first push of the branch the row is standing on (git push -u origin <branch>)',
    `refs/heads/reconcile-push-quarantine-1 ${HEAD_OID} refs/heads/reconcile-push-quarantine-1 ${ZERO}`],
  ['push via HEAD refspec (git push origin HEAD:refs/heads/<branch>)',
    `HEAD ${HEAD_OID} refs/heads/some-build-row-1 ${ZERO}`],
  ['re-push of an existing remote branch (fixup commit)',
    `refs/heads/some-build-row-1 ${HEAD_OID} refs/heads/some-build-row-1 ${oidFor(3)}`],
  ['re-push of a branch that is NOT the working HEAD but already exists at origin',
    `refs/heads/other-row-1 ${oidFor(4)} refs/heads/other-row-1 ${oidFor(5)}`],
  ['tag push', `refs/tags/v1.2.3 ${oidFor(6)} refs/tags/v1.2.3 ${ZERO}`],
  ['preflight attestation notes push', `refs/notes/preflight-attestation ${oidFor(7)} refs/notes/preflight-attestation ${ZERO}`],
  ['branch deletion', `(delete) ${ZERO} refs/heads/stale-thing ${oidFor(8)}`],
];

for (const [label, line] of ordinary) {
  const r = evaluatePush(parseRefLines(line), { headOid: HEAD_OID });
  check('UNCHANGED', `${label} is unaffected`, r.ok === true);
}

// And the composite an active session actually produces: branch update + notes push.
const composite = evaluatePush(
  parseRefLines(
    [`refs/heads/some-build-row-1 ${HEAD_OID} refs/heads/some-build-row-1 ${oidFor(9)}`,
      `refs/notes/preflight-attestation ${oidFor(7)} refs/notes/preflight-attestation ${ZERO}`].join('\n'),
  ),
  { headOid: HEAD_OID },
);
check('UNCHANGED', 'branch update + notes push in one invocation is unaffected', composite.ok === true);
check('UNCHANGED', 'an ordinary push is never flagged quarantine-only (preflight still runs)', composite.quarantineOnly === false);

// Absence-is-not-a-pass (SO #34c): with no HEAD resolvable, R2 is skipped rather
// than guessed, but R1 must still hold the line on the bulk shape.
const noHead = evaluatePush(parseRefLines(bareCreateLines.join('\n')), { headOid: null });
check('UNCHANGED', 'with HEAD unresolvable, R2 is skipped but R1 still refuses the bulk shape', noHead.ok === false);

/* ── CLASSIFIER ─────────────────────────────────────────────────────────── */

// Recorded from the live repo on 2026-08-22 against origin/main 4359f594:
//   git cherry origin/main wave41-cbpr-iso20022  ->  3 lines, all `+`
//   git rev-list --count wave41-cbpr-iso20022..origin/main  ->  1605
//   files touched by the unique commits: 27, absent on origin/main: 0
//   gh pr list --head wave41-cbpr-iso20022 --state all
//     -> PR #159, MERGED 2026-07-05T13:41:57Z (squash)
const SQUASH_MERGED_FIXTURE = {
  branch: 'wave41-cbpr-iso20022',
  cherryUnique: 3,
  absentOnMain: 0,
  touchedFiles: 27,
  behind: 1605,
  prLookupAvailable: true,
  mergedPRs: [{ number: 159, state: 'MERGED', mergedAt: '2026-07-05T13:41:57Z', title: 'Wave 41: CBPR+/ISO 20022 cross-border payment STP (proven §18, art-241..247)' }],
};

const squash = classifyBranch(SQUASH_MERGED_FIXTURE);
check('CLASSIFIER', 'wave41-cbpr-iso20022 (squash-merged as PR #159) is SUPERSEDED, not UNIQUE', squash.verdict === 'SUPERSEDED', `got ${squash.verdict}`);
check('CLASSIFIER', 'the verdict cites the merged PR', squash.reasons.some((r) => r.includes('PR #159')));
check(
  'CLASSIFIER',
  'git cherry is reported ADVISORY ONLY and can never produce UNIQUE on its own',
  squash.reasons.some((r) => r.includes('ADVISORY ONLY') && r.includes('never')),
);

// The same branch WITHOUT the PR lookup: the content check must still catch it.
// This is the 4-with-no-PR case (absent-on-main = 0 across all four).
const contentOnly = classifyBranch({ ...SQUASH_MERGED_FIXTURE, branch: 'art394-fixture-1', mergedPRs: [], cherryUnique: 1, touchedFiles: 1 });
check('CLASSIFIER', 'art394-fixture-1 (no PR, absent-on-main = 0) is SUPERSEDED by the content check', contentOnly.verdict === 'SUPERSEDED', `got ${contentOnly.verdict}`);

// Patch-id alone must NEVER produce UNIQUE. With `gh` unavailable and unique
// patch-ids present, the verdict is INDETERMINATE, not UNIQUE (SO #34c).
const noLookup = classifyBranch({ ...SQUASH_MERGED_FIXTURE, mergedPRs: [], prLookupAvailable: false, absentOnMain: 4, touchedFiles: 27 });
check('CLASSIFIER', 'no merged-PR lookup available => INDETERMINATE, never UNIQUE', noLookup.verdict === 'INDETERMINATE', `got ${noLookup.verdict}`);

// The genuinely-unique case must still be reachable, or the classifier is a
// rubber stamp in the other direction.
const genuine = classifyBranch({ branch: 'brand-new-work-1', cherryUnique: 2, absentOnMain: 3, touchedFiles: 5, behind: 0, prLookupAvailable: true, mergedPRs: [] });
check('CLASSIFIER', 'a branch with files absent from main and no merged PR is still UNIQUE', genuine.verdict === 'UNIQUE', `got ${genuine.verdict}`);

// A cherry-clean branch is SUPERSEDED without needing anything else — cherry is
// sound for proving PRESENCE, only unsound for proving ABSENCE.
const cherryClean = classifyBranch({ branch: 'fully-landed-1', cherryUnique: 0, absentOnMain: 0, touchedFiles: 2, prLookupAvailable: false, mergedPRs: [] });
check('CLASSIFIER', 'a cherry-clean branch is SUPERSEDED even with no PR lookup', cherryClean.verdict === 'SUPERSEDED', `got ${cherryClean.verdict}`);

/* ── report ─────────────────────────────────────────────────────────────── */

console.log('reconcile-guard self-test — RECONCILE-PUSH-QUARANTINE-1');
for (const line of results) console.log(line);
console.log('');
if (failures) {
  console.error(`❌ reconcile-guard self-test: ${failures} control(s) FAILED of ${results.length}.`);
  process.exit(1);
}
console.log(`✅ reconcile-guard self-test: all ${results.length} controls hold (RED · GREEN · UNCHANGED · CLASSIFIER).`);
