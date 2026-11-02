#!/usr/bin/env node
// check-merge-group-shadow.mjs — the arming decision for automerge-label.yml,
// as a PURE function over a `gh pr checks --json name,state` payload.
//
// WHY THIS EXISTS: pull_request CI judges the COMMITTED tree while merge_group
// judges the assembled DERIVED_ROOT tree (scripts-verify.yml's "Ephemeral
// derived tree" step). The `merge-group-shadow` job in scripts-verify.yml
// replays the queue's assembled-tree verdict ON the pull_request, where it is
// visible and fixable. This module is the enforcement teeth: automerge-label.yml
// refuses to arm or enqueue a labelled PR whose shadow check is failing,
// pending, or missing on its head — arming in that state would bet the merge
// queue on a verdict the PR side never saw (the #2797 bypass-merge class: red
// on the PR, green on the queue; and the inverse #2730/#2795 class: green on
// the PR, ejected from the queue on §18 digest freshness).
//
// NO NETWORK, NO gh, NO filesystem: the workflow collects the checks payload
// with `gh` and passes it in as argv[2] (or "-" for stdin). Everything here is
// deterministically fixture-testable — see check-merge-group-shadow.test.mjs.
//
// Exit codes:
//   0  proceed — the shadow check is present and passed
//  10  refuse — the shadow check is present and FAILED
//  11  refuse — the shadow check is MISSING from the payload (never reported,
//      or the payload could not be collected — refuse closed)
//  12  refuse — the shadow check is present but still PENDING
//
// The human-readable reason is printed on stdout exactly once; the workflow
// appends it verbatim to the job summary.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHADOW_CHECK = 'merge-group-shadow';

const REFUSALS = {
  fail: (state) =>
    `refusing to arm/enqueue: the "${SHADOW_CHECK}" check is ${state || 'FAILED'} on this PR head. ` +
    `The PR judges its committed tree, but the merge queue judges the assembled derived tree — ` +
    `a red shadow predicts a queue ejection or a red main post-merge. Fix the PR until the shadow is green, then re-label.`,
  missing: () =>
    `refusing to arm/enqueue: the "${SHADOW_CHECK}" check is MISSING on this PR head (never reported, still dispatching, or the checks payload could not be collected). ` +
    `The queue's assembled-tree verdict is unknown — arming now would bet the queue on a verdict the PR side never saw. Wait for the check to report, then re-label.`,
  pending: (state) =>
    `refusing to arm/enqueue: the "${SHADOW_CHECK}" check is ${state || 'PENDING'} on this PR head. ` +
    `The queue's assembled-tree verdict is not in yet — arming before it reports would arm blind. Re-label once it is green.`,
};

export function decide(checks) {
  const list = Array.isArray(checks) ? checks : [];
  const shadow = list.find((c) => c && c.name === SHADOW_CHECK);
  if (!shadow) {
    return { proceed: false, code: 11, reason: REFUSALS.missing() };
  }
  const state = String(shadow.state || '').toUpperCase();
  if (state === 'PASS' || state === 'SUCCESS') {
    return {
      proceed: true,
      code: 0,
      reason: `"${SHADOW_CHECK}" is ${state} on this head — the queue's assembled-tree verdict is green; arming may proceed.`,
    };
  }
  if (state === 'PENDING' || state === 'RUNNING' || state === 'QUEUED' || state === 'IN_PROGRESS') {
    return { proceed: false, code: 12, reason: REFUSALS.pending(state) };
  }
  return { proceed: false, code: 10, reason: REFUSALS.fail(state || 'FAIL') };
}

function isMain() {
  try {
    return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  const arg = process.argv[2];
  let raw = arg;
  if (!raw || raw === '-') raw = readFileSync(0, 'utf8');
  let checks = [];
  try {
    checks = JSON.parse(raw);
  } catch (e) {
    // An unparseable payload is refuse-closed: the same MISSING reasoning
    // applies — the verdict is unknown, so arming is refused.
    console.error(`check-merge-group-shadow: unparseable checks payload (${e.message}); refusing closed.`);
    const closed = decide(null);
    console.log(closed.reason);
    process.exit(closed.code);
  }
  const verdict = decide(checks);
  console.log(verdict.reason);
  process.exit(verdict.code);
}
