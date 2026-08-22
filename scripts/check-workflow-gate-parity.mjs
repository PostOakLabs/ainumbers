#!/usr/bin/env node
// check-workflow-gate-parity.mjs — fail if a BLOCKING CI workflow runs a
// `node <script>` gate that scripts/preflight.mjs does NOT run locally.
//
// WHY: preflight.mjs is the pre-push hook and claims "green preflight ⇒ green
// CI". That held only by hand — an audit (2026-07-24) found two node gates in
// CI that preflight never ran (verify-proposals.mjs, the Node leg of
// check-engine-parity.mjs), the same drift class that let the worker repo's §23
// gate reach a red master. The existing check-generator-coverage.mjs guard only
// covers `--check` generators, so test/verify-shaped gates slipped past it. This
// gate closes that hole: every blocking-workflow `node` gate must be in preflight
// (or explicitly allowlisted here as physically CI-only).
//
// SCOPE: node-invoked script gates only (`node <path>.mjs|.js`) — the drift class
// that has actually bitten us. Python/shell gates and non-node engine legs (Bun,
// QuickJS via `bun run`/`qjs`) are out of scope by construction: they don't match
// the `node ` prefix, so they're never demanded of preflight. Zero-dep, text-based.
import { readFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WF = resolve(ROOT, ".github/workflows");
const PREFLIGHT = resolve(ROOT, "scripts/preflight.mjs");

// Workflows that gate a merge or deploy (push/PR). Scheduled/mirror/publish/SAST
// workflows are not merge gates and are excluded.
//
// JSDOC-CHECKJS-PREFLIGHT-1 SWEEP (2026-08-16) — full classification of every
// workflow under .github/workflows/, so no workflow is silently unclassified.
// Two classes only: `pr-gate-not-covered` (runs on pull_request and/or a push
// that can red a PR or main — belongs in BLOCKING_WORKFLOWS, or in CI_ONLY
// below with a NAMED physical reason if its node gate genuinely cannot run
// pre-push) vs `not-a-gate` (schedule/dispatch/deploy/sync — never blocks a
// merge, so parity has nothing to check).
//
//   pr-gate-not-covered, ADDED to BLOCKING_WORKFLOWS this sweep:
//     - jsdoc-checkjs.yml     — the incident this row exists to fix (see gate
//                               above); node scripts/jsdoc-checkjs-gate.mjs,
//                               now also in preflight.mjs.
//     - c2patool-oracle.yml   — pull_request (paths-filtered) + push main;
//                               node scripts/c2patool-oracle-compare.mjs, but
//                               that gate needs a downloaded+sha256-verified
//                               c2patool RUST BINARY, not npx-fetchable — see
//                               CI_ONLY below.
//     - ci-anchor.yml         — pull_request, no paths filter, is itself the
//                               required-status-check anchor (SO #22); zero
//                               `node` gates in its body (one `echo`), so
//                               listing it here documents the classification
//                               with no parity delta.
//     - zizmor.yml            — pull_request + push main (paths-filtered);
//                               runs a fetched Rust binary via a pinned
//                               Action, zero `node` gates in its body, so
//                               listing it here documents the classification
//                               with no parity delta.
//   pre-existing, already covered:
//     - deploy-to-dreamhost.yml, html-verify.yml, land-verify.yml,
//       scripts-verify.yml, cross-engine-parity.yml, proposals-verify.yml
//   not-a-gate (schedule/dispatch/deploy/sync — excluded, no action needed):
//     - deploy-docs.yml                  — push main only, deploys docs
//                                           subdomain post-merge.
//     - deploy-drift-check.yml           — schedule + workflow_dispatch only.
//     - derived-artifacts-regen.yml      — push main only, SO #35 single-writer
//                                           regen, post-merge.
//     - helm-guide-freshness-schedule.yml — schedule only.
//     - standards-watch.yml              — schedule + workflow_dispatch only.
//     - sync-chaingraph-spec.yml         — push main only, post-merge mirror sync.
//     - prepush-attestation.yml          — push main + workflow_dispatch only, so it
//                                           never gates a merge. Its node gate
//                                           (check-prepush-attestation.mjs) is
//                                           main-side BY CONSTRUCTION: it verifies
//                                           git notes on commits that exist only
//                                           after a merge, and the note it reads is
//                                           written by the very hook that would
//                                           invoke it. Pre-push there is nothing to
//                                           check, so parity has nothing to demand
//                                           (PREPUSH-ATTEST-CHECK-1).
const BLOCKING_WORKFLOWS = [
  "deploy-to-dreamhost.yml",
  "html-verify.yml",
  "land-verify.yml",
  "scripts-verify.yml",
  "cross-engine-parity.yml",
  "proposals-verify.yml",
  "jsdoc-checkjs.yml",
  "c2patool-oracle.yml",
  "ci-anchor.yml",
  "zizmor.yml",
];

// node gates that legitimately run ONLY in CI, each with the reason it cannot run
// pre-push. Keep tight — every entry is a hole in "green preflight ⇒ green CI".
const CI_ONLY = new Map([
  ["c2patool-oracle-compare.mjs",
    "needs a downloaded + sha256-verified c2patool RUST BINARY (c2patool-oracle.yml) — " +
    "not npx-fetchable like TypeScript, and this repo installs no CI-only binaries pre-push."],
  ["check-ci-relevant.mjs",
    "always-report CI shape's `relevant` job helper — decides whether a path-filtered " +
    "pull_request should run its substantive job. Reads github.event.pull_request base/head " +
    "SHAs from env:, meaningless outside an actual PR event; always exits 0 (never a pass/fail " +
    "gate, so it has nothing preflight.mjs could usefully assert)."],
  ["run-gate.mjs",
    "LAND-VERIFY-ADVISORY-SPLIT-1 dispatcher, not a gate itself — it wraps the SAME command " +
    "strings this regex already extracts from the workflow text (e.g. verify-counts.mjs, " +
    "check-nav-reachability.mjs), which land on preflight.mjs's own parity requirement via " +
    "their own basenames. preflight.mjs applies the identical PR-advisory/main-blocking split " +
    "inline via derived-artifacts.mjs's isMainContext()/advisoryGates() (no separate CLI " +
    "invocation needed locally), so run-gate.mjs itself has nothing for preflight to run."],
]);

function nodeGates(text) {
  const out = new Set();
  // `node path/to/script.mjs` or `.js`, ignoring flags/args after it.
  const re = /\bnode\s+([\w./\\-]+\.(?:mjs|js))\b/g;
  let m;
  while ((m = re.exec(text))) out.add(basename(m[1]));
  return out;
}

function main() {
  const preflight = nodeGates(readFileSync(PREFLIGHT, "utf8"));

  const problems = [];
  let totalCi = 0;
  for (const wf of BLOCKING_WORKFLOWS) {
    let text;
    try {
      text = readFileSync(resolve(WF, wf), "utf8");
    } catch {
      problems.push(`  ! workflow not found: ${wf} (update BLOCKING_WORKFLOWS)`);
      continue;
    }
    for (const g of nodeGates(text)) {
      totalCi++;
      if (!preflight.has(g) && !CI_ONLY.has(g)) {
        problems.push(`  - ${g}  (in ${wf}, not in preflight)`);
      }
    }
  }

  if (problems.length) {
    console.error(`✗ workflow gate parity: ${problems.length} blocking CI node-gate(s) not run by preflight.mjs:`);
    for (const p of problems) console.error(p);
    console.error(`  Add each to the GATES array in scripts/preflight.mjs (or, if it truly`);
    console.error(`  cannot run pre-push, allowlist it in CI_ONLY here with a reason).`);
    process.exit(1);
  }

  console.log(`✓ workflow gate parity: every blocking-workflow node gate runs in preflight (${CI_ONLY.size} CI-only allowlisted).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
