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
export const AFFECTED_SKIP = /controls|fixture proof|self-?test|selftest|mutation|SO #34c|SO #40b|GATE-SELFTEST-META|Mutation tier/i;

// Whole-repo hygiene gates that ALWAYS run under `--affected` (and alone under
// `--hygiene`), whatever the touched set is. Chosen from preflight's own GATES by
// measured wall time (2026-11-06, one warm Windows checkout, whole-repo scan):
//   git-env scrub 2.9 s, internal-lang leak 0.3 s, copy hallmarks 5.2 s,
//   JS syntax 1.2 s, PII banner 0.7 s, tool-number uniqueness 0.1 s (total ~10 s).
// All are static scans with no network and no per-diff scoping, so a new spawn
// site, a leaked internal id in a workflow comment, an em-dash or a syntax slip
// is caught on any push, including one whose diff touches no gated path class.
// Matching is by exact command, not label, so a label reword cannot drop one;
// `missingHygiene` makes a renamed or removed command a loud error.
export const AFFECTED_HYGIENE_CMDS = [
  'node scripts/check-git-env-scrub.mjs',
  'node scripts/check-internal-lang-leak.mjs',
  'node scripts/check-copy-hallmarks.mjs',
  'node scripts/check_tools.js',
  'node scripts/check-pii-banner.mjs',
  'node scripts/check-tool-number-unique.mjs',
];

// Hygiene commands that no entry of `gates` runs (a rename would otherwise
// silently shrink the always-on set).
export function missingHygiene(gates) {
  const have = new Set(gates.map(([, cmd]) => cmd));
  return AFFECTED_HYGIENE_CMDS.filter((c) => !have.has(c));
}

export function affectedSelection(gates, files) {
  const classes = AFFECTED_CLASSES.filter(([, pathTest]) => files.some(pathTest));
  const hygiene = new Set(AFFECTED_HYGIENE_CMDS);
  const picked = gates.filter(([label, cmd]) => hygiene.has(cmd) || (!AFFECTED_SKIP.test(label) && !AFFECTED_SLOW.test(label)
    && classes.some(([, , labelTest]) => labelTest.test(label))));
  return { classes: classes.map(([c]) => c), picked };
}

// Plan for `--affected`: never zero gates. `files` is the touched set, or null
// when it could not be determined (then the FULL list runs, fail closed). An EMPTY set falls back to
// the hygiene set alone and says so loudly (`loud: true`); a determinable set
// gets hygiene plus its path-class gates.
export function affectedPlan(gates, files) {
  const hygieneCount = gates.filter(([, cmd]) => AFFECTED_HYGIENE_CMDS.includes(cmd)).length;
  if (files === null) {
    // Undeterminable (git error, missing base): fail closed exactly as before, the
    // FULL list (which contains the hygiene set). Never weaker than the old behaviour.
    return {
      classes: [], picked: gates, loud: true,
      note: `WARNING changed files UNDETERMINABLE, so the FULL list of ${gates.length} gates runs (fail closed; includes the ${hygieneCount} hygiene gates). Check that origin/main resolves`,
    };
  }
  if (files.length === 0) {
    const picked = gates.filter(([, cmd]) => AFFECTED_HYGIENE_CMDS.includes(cmd));
    return {
      classes: [], picked, loud: true,
      note: `WARNING touched set is EMPTY, so ONLY the ${hygieneCount} always-on hygiene gates run (not a diff-scoped selection). Check that the branch has commits`,
    };
  }
  const { classes, picked } = affectedSelection(gates, files);
  const classPicked = picked.length - hygieneCount;
  return {
    classes, picked, loud: false,
    note: `${hygieneCount} always-on hygiene gate(s) + ${classPicked} for ${classes.length ? `path class(es) ${classes.join(', ')}` : 'no gated path class'} over ${files.length} changed file(s)`,
  };
}
