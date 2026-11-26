#!/usr/bin/env node
// Decides whether derived-regen-deadman.yml's retry-once job re-runs a failed
// main Derived Artifacts Regen run.
//
// The retry was written as courtesy for the transient tail (network, runner,
// token, push race). It used to fire on every first failure, so a deterministic
// gate red (a copy gate, the fixpoint proof) waited 10 minutes and re-ran into
// the same red while holding the serialized regen group. Measured 2026-11-25:
// all 25 of the latest red regens on main failed in the step "Prove the regen
// pass was a fixpoint", and each one was retried.
//
// Rule (deny by default): retry only when the run's failed jobs show no failed
// step at all (the runner was lost), or when every failed step is one of the
// RETRYABLE_STEPS below. Any other failed step is a gate, so the alarm alone
// runs. A step renamed or added later is treated as a gate until it is listed
// here, which costs a retry, never an alarm.
//
//   gh api repos/<owner/repo>/actions/runs/<id>/jobs?per_page=100 \
//     | node scripts/ci/regen-retry-decide.mjs
// prints one JSON line { retry, reason, failedSteps } and exits 0 to retry,
// 1 to skip. Input it cannot parse retries (the old behaviour).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Steps whose failure is usually transient: runner setup, token mint, checkout,
// toolchain, the network-bound publish, and the final push (a race with
// another push to main).
export const RETRYABLE_STEPS = [
  /^Set up job$/,
  /^Mint /,
  /^Checkout/,
  /^Setup Node/,
  /^Publish the registry lineage log/,
  /^Commit and push$/,
  /^Re-request CI/,
  /^Post /,
  /^Complete job$/,
];

/** Failed step names across the run's failed jobs. Pure. */
export function failedSteps(jobsPayload) {
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
  const out = [];
  for (const j of jobs) {
    if (j.conclusion !== 'failure') continue;
    for (const s of j.steps || []) if (s.conclusion === 'failure') out.push(s.name);
  }
  return out;
}

/** { retry, reason, failedSteps } for a jobs API payload. Pure. */
export function retryDecision(jobsPayload) {
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : null;
  if (!jobs) return { retry: true, reason: 'jobs-unreadable', failedSteps: [] };
  const steps = failedSteps(jobsPayload);
  if (steps.length === 0) return { retry: true, reason: 'no-failed-step', failedSteps: steps };
  const gate = steps.find((n) => !RETRYABLE_STEPS.some((re) => re.test(n)));
  if (gate) return { retry: false, reason: `gate-failed:${gate}`, failedSteps: steps };
  return { retry: true, reason: 'transient-step', failedSteps: steps };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let payload = null;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    payload = null;
  }
  const d = retryDecision(payload);
  console.log(JSON.stringify(d));
  process.exit(d.retry ? 0 : 1);
}
