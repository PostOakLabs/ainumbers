#!/usr/bin/env node
// scripts/replay-witness-guard.mjs — source-commit guard for the fork-facing
// replay-witness workflow. The workflow establishes whether the checked-out
// commit exists in the upstream repository, then calls this script with that
// fact. The decision is a pure function so it can be exercised offline by
// scripts/replay-witness.selftest.mjs.
//
// Usage (workflow step):
//   REPOSITORY=<owner/repo> SOURCE_SHA=<sha> UPSTREAM_PRESENT=<true|false> \
//     node scripts/replay-witness-guard.mjs --check
// Prints one REPLAY-WITNESS-GUARD line and exits 0 to allow, 1 to refuse.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const UPSTREAM_REPOSITORY = 'PostOakLabs/ainumbers';

/**
 * Decide whether a replay-witness run may proceed. Every refusal names the
 * exact reason instead of collapsing into a bare false.
 * @param {{repository: string, sha: string, upstreamPresent: boolean}} input
 * @returns {{allow: boolean, reason: string}}
 */
export function witnessGuard({ repository, sha, upstreamPresent }) {
  if (repository === UPSTREAM_REPOSITORY) {
    return { allow: false, reason: 'upstream-repository' };
  }
  if (typeof repository !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    return { allow: false, reason: 'malformed-repository' };
  }
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) {
    return { allow: false, reason: 'source-sha-not-a-commit' };
  }
  if (upstreamPresent !== true) {
    return { allow: false, reason: 'source-commit-not-in-upstream' };
  }
  return { allow: true, reason: 'fork-at-upstream-commit' };
}

function check() {
  const repository = process.env.REPOSITORY ?? '';
  const sha = process.env.SOURCE_SHA ?? '';
  const upstreamPresent = process.env.UPSTREAM_PRESENT === 'true';
  const verdict = witnessGuard({ repository, sha, upstreamPresent });
  console.log(`REPLAY-WITNESS-GUARD ${verdict.allow ? 'ALLOW' : 'REFUSE'} ${verdict.reason}`);
  return verdict.allow ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    process.exit(check());
  }
  console.error('usage: node scripts/replay-witness-guard.mjs --check (with REPOSITORY, SOURCE_SHA, UPSTREAM_PRESENT in env)');
  process.exit(2);
}
