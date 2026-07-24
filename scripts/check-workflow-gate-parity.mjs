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
const BLOCKING_WORKFLOWS = [
  "deploy-to-dreamhost.yml",
  "html-verify.yml",
  "land-verify.yml",
  "scripts-verify.yml",
  "cross-engine-parity.yml",
  "proposals-verify.yml",
];

// node gates that legitimately run ONLY in CI, each with the reason it cannot run
// pre-push. Keep tight — every entry is a hole in "green preflight ⇒ green CI".
const CI_ONLY = new Map([
  // populated below after first run surfaces the genuinely CI-bound node gates
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
