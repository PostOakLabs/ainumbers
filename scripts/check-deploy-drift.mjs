#!/usr/bin/env node
/**
 * scripts/check-deploy-drift.mjs — DEPLOYDRIFT-1.
 *
 * Fetches the live deploy stamp (written by deploy-to-dreamhost.yml at rsync
 * time — see that workflow's "Write deploy stamp" step) and compares its sha
 * to origin/main's current HEAD. If they differ, the last push to main did
 * NOT reach production (the deploy workflow silently failed to fire, or
 * failed mid-run) and prints DRIFT with both shas.
 *
 * ADVISORY-ONLY SWITCH: FAIL_ON_DRIFT (below). Currently false — this script
 * always exits 0, reporting only. Flip to true once the false-positive rate
 * (CDN cache lag, in-flight deploys) is known, per STANDING ORDERS #14/GATE-FREEZE.
 */

import { execSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';

const FAIL_ON_DRIFT = false;

const STAMP_URL = process.env.DEPLOY_STAMP_URL || 'https://ainumbers.co/.well-known/deploy-stamp.json';

async function main() {
  // env: gitEnv() — `ls-remote <url>` needs no local repository, but an inherited GIT_DIR still
  // brings that repo's config (insteadOf rewrites, url.<base>.pushInsteadOf) into scope, which can
  // silently redirect which remote answers. Credentials are unaffected: this URL is public, and the
  // estate carries no GIT_ASKPASS/GIT_SSH_COMMAND in any workflow env (verified 2026-08-23).
  const headSha = execSync('git ls-remote https://github.com/PostOakLabs/ainumbers.git refs/heads/main', {
    env: gitEnv(),
    encoding: 'utf8',
  })
    .trim()
    .split(/\s+/)[0];

  if (!headSha) {
    console.error('✗ Could not resolve origin/main HEAD sha via git ls-remote.');
    process.exitCode = FAIL_ON_DRIFT ? 1 : 0;
    return;
  }

  let stampRes;
  try {
    stampRes = await fetch(STAMP_URL, { redirect: 'follow' });
  } catch (err) {
    console.error(`✗ Could not fetch live deploy stamp at ${STAMP_URL}: ${err.message}`);
    process.exitCode = FAIL_ON_DRIFT ? 1 : 0;
    return;
  }

  if (!stampRes.ok) {
    console.error(`✗ Deploy stamp fetch returned HTTP ${stampRes.status} (${STAMP_URL})`);
    process.exitCode = FAIL_ON_DRIFT ? 1 : 0;
    return;
  }

  const stamp = await stampRes.json();
  const liveSha = stamp.sha;

  console.log(`Live stamp sha : ${liveSha}`);
  console.log(`Live stamp time: ${stamp.deployed_at}`);
  console.log(`origin/main sha: ${headSha}`);

  if (liveSha === headSha) {
    console.log('✅ No drift — production is serving origin/main HEAD.');
    process.exitCode = 0;
    return;
  }

  console.error('⚠️  DRIFT DETECTED — production is NOT serving origin/main HEAD.');
  console.error(`   live=${liveSha}  main=${headSha}`);
  console.error('   The deploy workflow may have silently failed to fire or failed mid-run.');
  console.error(
    `   ADVISORY MODE (FAIL_ON_DRIFT=${FAIL_ON_DRIFT}) — exiting 0. Flip FAIL_ON_DRIFT to true to make this blocking.`
  );
  process.exitCode = FAIL_ON_DRIFT ? 1 : 0;
}

main();
