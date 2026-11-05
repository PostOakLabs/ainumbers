// scripts/lib/affected-gates.mjs — AFFECTED-GATES-PREPUSH-1 (2026-11-05).
//
// Pure selection logic for `node scripts/preflight.mjs --affected`: given the
// full GATES list ([label, cmd, meta?] entries) and the files a branch changed
// against merge-base(origin/main, HEAD), pick the full-suite gates that judge
// the path classes the diff touches.
//
// Why: builders ran only `--quick` (14 gates) before pushing. Measured
// 2026-11-05, about 30 of 52 red PRs first-failed on a gate --quick lacks but
// that runs in seconds to a minute on the PR's own files. The rest of the full
// suite still runs in CI on the PR head and the merge_group tree; this module
// removes no gate from anything. Design and data:
// research/HEAL-ROWS-VS-FIRST-TIME-RIGHT-2026-11-05.md (workspace root).
//
// Gate-machinery controls (selftests, fixture proofs, mutation controls) are
// skipped: a diff touching gate machinery gets the push-safety leg instead
// (scripts/prepush-full-trigger.mjs). The Mutation tier floor is skipped for
// cost (CI shards it six ways).
//
// Tests: node --test scripts/lib/affected-gates.test.mjs

// [class, path test, gate-label test]
export const AFFECTED_CLASSES = [
  ['kernel',
    (f) => /^chaingraph\/kernels\/(?!_)[^/]+\.mjs$/.test(f)
      || /^chaingraph\/kernels\/(?!_)[^/]+\.json$/.test(f)
      || /^chaingraph\/kernels\/(fixtures|__proptests__)\//.test(f)
      || /^registry\/kernel\//.test(f),
    /kernel|R4 null|flags-computed|flag-mirror|clause digest|citation|determinism|GPU flag|input-usage|§17|§18|compute-proof|WebMCP (wrapper|direct|chain)-execute|golden|parity/i],
  ['node',
    (f) => /^chaingraph\/(graph|chains)\//.test(f) || f === 'chaingraph/chaingraph.meta.json',
    /\bnode\b|accessib|a11y|shard|\bchain|§17|§18|registry|identity|compute-proof|WebMCP|manifest/i],
  ['manifest',
    (f) => /^manifests\//.test(f),
    /manifest|WebMCP|server card|\bMCP\b/i],
  ['page',
    (f) => /\.html$/.test(f),
    /hallmark|dead-link|install-link|PII|scene|explainer|CSP|chrome|a11y|accessib|\bpage\b|JSON-LD|tool-number/i],
  ['mcp-surface',
    (f) => /^(mcp|\.well-known)\//.test(f),
    /server card|\bMCP\b|WebMCP/i],
];

// Left to CI, measured 2026-11-05:
// - estate-wide and slow (129 s, 112 s, 57 s), not tied to one diff class;
// - verify_repo: locally on a branch its sitemap check reports main-regen-owned
//   sitemap.xml as missing pages (false red on green PR #2736); CI downgrades it
//   on pull_request. Its PII part is covered by the --quick PII banner gate.
export const AFFECTED_SLOW = /FV toolchain-digest|Groth16 seal parity|VM.worker parity|^verify_repo/i;
export const AFFECTED_SKIP = /controls|fixture proof|self-?test|selftest|mutation|SO #34|SO #40b|GATE-SELFTEST-META|Mutation tier/i;

export function affectedSelection(gates, files) {
  const classes = AFFECTED_CLASSES.filter(([, pathTest]) => files.some(pathTest));
  const picked = gates.filter(([label]) => !AFFECTED_SKIP.test(label) && !AFFECTED_SLOW.test(label)
    && classes.some(([, , labelTest]) => labelTest.test(label)));
  return { classes: classes.map(([c]) => c), picked };
}
