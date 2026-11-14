#!/usr/bin/env node
/**
 * scripts/check-id-collision.test.mjs — fixture proof for the PR-number
 * resolution of scripts/check-id-collision.mjs (PREPUSH-PR-FROM-PUSH-TARGET-1).
 *
 * The row's gap: in a builders' worktree the LOCAL branch name is not the PR's
 * head branch (a cure push is `git push origin HEAD:<pr-branch>` from a
 * differently named local branch, or from a detached HEAD), so the
 * ID-COLLISION-SELF-PR-BY-HEAD-1 fallback resolved null and the pusher's own
 * open PR still read as a rival claim on the id (REFUSAL(c)). The cure: the
 * pre-push hook parses its stdin's REMOTE ref and exports
 * ID_COLLISION_PUSH_BRANCH = the branch being pushed TO, and thisPrNumber()
 * resolves THAT branch first.
 *
 * What each case proves (the gh runner is injected; this file never touches
 * the network, never spawns gh, and never needs a git repo):
 *   1. RESOLVES: local branch name differs from the pushed branch and exactly
 *      one open PR matches the PUSHED branch -> that PR number, with the gh
 *      lookup keyed on the pushed branch (a spy records what was queried).
 *   2. FAIL CLOSED, zero matches: no open PR on the pushed branch -> null,
 *      and the local branch is NEVER consulted (the old code fell through and
 *      could "resolve" an unrelated local-branch PR — a guess).
 *   3. FAIL CLOSED, two matches: two open PRs on the pushed branch -> null,
 *      local branch never consulted.
 *   4. ENV WINS: PR_ID_COLLISION_PR set -> returned as-is; the pushed branch
 *      (and the local branch) are never looked up.
 *   5. DETACHED HEAD: the local checkout has no branch name at all -> the
 *      pushed branch still resolves the PR.
 *   6. GH ERROR: the pushed-branch lookup throws -> null, never throws, and
 *      no local-branch fallback (fail closed exactly as the hook-less path).
 *   7. CONTROL, no pushed branch: ID_COLLISION_PUSH_BRANCH absent -> the
 *      unchanged ID-COLLISION-SELF-PR-BY-HEAD-1 local-branch behaviour.
 *
 * Usage: node --test --test-reporter=dot scripts/check-id-collision.test.mjs
 * Exit 0 = every assertion passed (the runner sets it from the counts).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { thisPrNumber } from './check-id-collision.mjs'

/** Spy gh runner: records every queried branch, answers from `byBranch`.
 *  The injected-runner contract is realOpenPrsByHead's: the PARSED array of
 *  {number} rows (or a throw), never a JSON string. */
function spyGh(byBranch) {
  const queried = []
  const runner = (branch) => {
    queried.push(branch)
    const prs = byBranch[branch]
    if (prs instanceof Error) throw prs
    return prs
  }
  runner.queried = queried
  return runner
}

const LOCAL = 'PR-3100-PORT-790-JE-CURE-1' // a worktree-local branch name
const PUSHED = 'PORT-790-JE-PERIOD-LOCK-GATE-1' // the PR's actual head branch

test('resolves: local branch differs from the pushed branch, exactly one open PR on the pushed branch', () => {
  const gh = spyGh({ [PUSHED]: [{ number: 3100 }] })
  const n = thisPrNumber({ ID_COLLISION_PUSH_BRANCH: PUSHED }, () => LOCAL, gh)
  assert.equal(n, 3100)
  assert.deepEqual(gh.queried, [PUSHED], 'the lookup is keyed on the PUSHED branch, not the local name')
})

test('fail closed, zero matches: no open PR on the pushed branch, local branch never consulted', () => {
  const gh = spyGh({ [PUSHED]: [] })
  const n = thisPrNumber({ ID_COLLISION_PUSH_BRANCH: PUSHED }, () => LOCAL, gh)
  assert.equal(n, null)
  assert.deepEqual(gh.queried, [PUSHED], 'no fall-through to the local-branch lookup (a guess)')
})

test('fail closed, two matches: two open PRs on the pushed branch stay undeterminable', () => {
  const gh = spyGh({ [PUSHED]: [{ number: 3100 }, { number: 3101 }] })
  const n = thisPrNumber({ ID_COLLISION_PUSH_BRANCH: PUSHED }, () => LOCAL, gh)
  assert.equal(n, null)
  assert.deepEqual(gh.queried, [PUSHED])
})

test('env wins: PR_ID_COLLISION_PR is returned without any branch lookup', () => {
  const gh = spyGh({ [PUSHED]: [{ number: 3100 }] })
  const n = thisPrNumber({ PR_ID_COLLISION_PR: '4242', ID_COLLISION_PUSH_BRANCH: PUSHED }, () => LOCAL, gh)
  assert.equal(n, 4242)
  assert.deepEqual(gh.queried, [], 'gh is never called when the explicit env var is set')
})

test('detached HEAD: no local branch name at all, the pushed branch still resolves', () => {
  const gh = spyGh({ [PUSHED]: [{ number: 3100 }] })
  const n = thisPrNumber({ ID_COLLISION_PUSH_BRANCH: PUSHED }, () => 'HEAD', gh)
  assert.equal(n, 3100)
  assert.deepEqual(gh.queried, [PUSHED])
})

test('gh error on the pushed-branch lookup: null, never throws, no local fallback', () => {
  const gh = spyGh({ [PUSHED]: new Error('gh: not authenticated') })
  const n = thisPrNumber({ ID_COLLISION_PUSH_BRANCH: PUSHED }, () => LOCAL, gh)
  assert.equal(n, null)
})

test('control, no pushed branch: the ID-COLLISION-SELF-PR-BY-HEAD-1 local fallback is unchanged', () => {
  const gh = spyGh({ [LOCAL]: [{ number: 3100 }] })
  const n = thisPrNumber({}, () => LOCAL, gh)
  assert.equal(n, 3100)
  assert.deepEqual(gh.queried, [LOCAL])
})
