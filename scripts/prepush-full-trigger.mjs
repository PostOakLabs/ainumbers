#!/usr/bin/env node
/**
 * scripts/prepush-full-trigger.mjs — PREPUSH-NARROW-1.
 *
 * Decides whether a diff owes the FULL preflight suite in .githooks/pre-push.
 * Reads changed paths (one per line, repo-relative, forward slashes) on stdin
 * and prints the ones that trigger the full suite. Exit 0 always; the hook
 * tests for non-empty output. `--self-test` runs the red/green controls.
 *
 * Why not "anything under scripts/": a docs-only change (README.md,
 * *.DEPRECATED) cannot move a gate verdict, yet the old pathspec paid ~30 min
 * for it. The trigger is now:
 *   - scripts/**  code        (.mjs .js .cjs .py .sh .ts)       the gates themselves
 *   - scripts/**  data        (.json .txt .html)                read by full-suite gates
 *   - .github/**                                                 workflows
 *   - chaingraph/kernels/_*.mjs                                  shared kernel machinery
 * EXCEPT the data files whose ONLY reader is a QUICK_GATES gate (the quick leg
 * already enforces them on every push): QUICK_ONLY_DATA below. Derived by
 * grepping every scripts/ gate for each data file's basename; a file with any
 * full-suite-only reader (or no static reader, e.g. a dynamically built path)
 * stays a trigger.
 *
 * Attestation (PREPUSH-ATTEST-CHECK-1) is INDEPENDENT of this decision: the
 * hook's attestation block uses check-prepush-attestation.mjs --print-pathspec
 * and still notes every scripts/** commit whether or not the full leg ran.
 */
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

const CODE_EXT = /\.(mjs|cjs|js|py|sh|ts)$/;
const DATA_EXT = /\.(json|txt|html)$/;

// Data files read ONLY by gates that are already in QUICK_GATES (scripts/preflight.mjs).
export const QUICK_ONLY_DATA = new Set([
  'scripts/compute-proof-baseline.json',      // check-compute-proof-coverage (quick #2)
  'scripts/pii-banner-baseline.json',         // check-pii-banner (quick #6)
  'scripts/scene-exemptions.json',            // sync-scene-kit --scene-required (quick #8)
  'scripts/webmcp-meta-budgets-baseline.json' // check-webmcp-meta-budgets (quick #9/#10)
]);

export function triggersFull(path) {
  const p = String(path).replace(/\\/g, '/').replace(/^\.\//, '');
  if (p.startsWith('.github/')) return true;
  if (/^chaingraph\/kernels\/_[^/]*\.mjs$/.test(p)) return true;
  if (p.startsWith('scripts/')) {
    if (QUICK_ONLY_DATA.has(p)) return false;
    return CODE_EXT.test(p) || DATA_EXT.test(p);
  }
  return false;
}

function selfTest() {
  const cases = [
    // [path, expected]  -- RED = must trigger, GREEN = must not
    ['scripts/preflight.mjs', true],
    ['scripts/check_tools.js', true],
    ['scripts/verify_repo.py', true],
    ['scripts/some-hook.sh', true],
    ['scripts/fixtures/x/clean.register.json', true],
    ['scripts/dead-link-baseline.json', true],
    ['scripts/kernel-templates/node-page.template.txt', true],
    ['scripts/ain-bridge-v1.snippet.html', true],
    ['.github/workflows/scripts-verify.yml', true],
    ['chaingraph/kernels/_hash.mjs', true],
    ['scripts\\win-style.mjs', true],
    ['scripts/cre-signer-snapshots/README.md', false],
    ['scripts/regen_sitemap.py.DEPRECATED', false],
    ['scripts/compute-proof-baseline.json', false],
    ['scripts/pii-banner-baseline.json', false],
    ['scripts/scene-exemptions.json', false],
    ['scripts/webmcp-meta-budgets-baseline.json', false],
    ['chaingraph/kernels/art-213.mjs', false],
    ['chaingraph/kernels/sub/_x.mjs', false],
    ['tools/152-baas-provider-comparator.html', false],
    ['.githooks/pre-push', false],
    ['notscripts/x.mjs', false]
  ];
  let bad = 0;
  for (const [p, want] of cases) {
    const got = triggersFull(p);
    if (got !== want) { bad++; console.error(`✗ ${p}: expected ${want}, got ${got}`); }
    else console.log(`✓ ${want ? 'RED  (full owed)    ' : 'GREEN (full not owed)'} ${p}`);
  }
  if (bad) { console.error(`❌ prepush-full-trigger self-test: ${bad} failure(s)`); process.exit(1); }
  console.log(`✅ prepush-full-trigger self-test: ${cases.length} controls passed`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    const rl = createInterface({ input: process.stdin });
    rl.on('line', (l) => { if (l && triggersFull(l)) console.log(l); });
  }
}
