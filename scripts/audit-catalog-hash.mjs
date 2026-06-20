// audit-catalog-hash.mjs — Full-catalog execution_hash canonicalization audit
//
// Scans ALL tools/*.html for hash-scheme violations. Unlike lint-forbidden-hash.mjs
// (which only covers live ChainGraph nodes), this script audits the entire
// non-ChainGraph catalog — the ~440 tools that were not individually checked
// during the 2026-06-18 remediation.
//
// VIOLATION TYPES
// ───────────────
// SCHEME_A  [HARD] JSON.stringify(x, Object.keys(x).sort())
//           Array-replacer collapses nested data → input-independent hash.
//           Same pattern banned in chaingraph/kernels/lint-forbidden-hash.mjs.
//
// SCHEME_C  [HARD] function simpleHash(…)
//           32-bit FNV mislabeled "sha256:". Not SHA-256.
//
// NON_CANONICAL_STRINGIFY  [SOFT]
//           A SHA-256 function called directly on JSON.stringify(x) where x
//           has NOT been recursively key-sorted first. The SHA-256 is real but
//           the preimage is non-deterministic across implementations.
//           Canonical form requires recursive key sort before serialisation
//           (RFC 8785 / JCS); the OCG marker is __ocgCanonStr / __ocgHash.
//
// Usage:
//   node scripts/audit-catalog-hash.mjs
//   node scripts/audit-catalog-hash.mjs --json-only   (suppress console output)
//
// Outputs:
//   scripts/catalog-hash-audit-YYYY-MM-DD.json  — machine-readable full report
//   Console summary with violation list
//
// Exit codes:
//   0  — report written (script is audit-only, never gates on violations)
//
// See: chaingraph/kernels/lint-forbidden-hash.mjs (ChainGraph-only gate)
//      HASH-FIX-STATUS-AND-VERIFICATION_2026-06-18.md §10
//      AGENT-NATIVE-MCP-SPEC_2026-06-18.md §0.6

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE  = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(HERE, '..');
const TOOLS = resolve(REPO, 'tools');

const QUIET = process.argv.includes('--json-only');

// ── Load chaingraph.json so we can annotate which files are already covered ──
const cgPath = resolve(REPO, 'chaingraph', 'chaingraph.json');
const cgCoveredFiles = new Set();
try {
  const cg = JSON.parse(readFileSync(cgPath, 'utf8'));
  for (const n of (cg.nodes ?? [])) {
    if (n.status !== 'live') continue;
    let rel;
    try { rel = new URL(n.url).pathname.replace(/^\//, ''); }
    catch { rel = `chaingraph/${n.tool_id}.html`; }
    cgCoveredFiles.add(rel.toLowerCase());
  }
} catch { /* chaingraph.json missing or malformed — annotation only, not fatal */ }

// ── Violation checks ──────────────────────────────────────────────────────────
//
// Each check has:
//   type       — identifier
//   severity   — HARD | SOFT
//   re         — primary detection regex (tested against full source)
//   skip       — optional regex; if it matches, skip this check (canonical guard)
//   lineRe     — regex used for per-line attribution (defaults to re)
//   why        — human explanation
//
const CHECKS = [
  {
    type: 'SCHEME_A',
    severity: 'HARD',
    re: /JSON\.stringify\(\s*([A-Za-z_$][\w$]*)\s*,\s*Object\.keys\(\s*\1\s*\)\.sort\(\)\s*\)/,
    why:
      'Array-replacer JSON.stringify collapses nested objects — the replacer ' +
      'function only receives top-level keys, so all nested values hash to the ' +
      'same string regardless of their actual content. This is the Scheme A ' +
      'pattern fixed across ChainGraph nodes in the 2026-06-18 remediation.',
    fix: 'Replace with __ocgCanonStr(obj) (recursive key sort) then hash the resulting string.',
  },
  {
    type: 'SCHEME_C',
    severity: 'HARD',
    re: /function\s+simpleHash\s*\(/,
    why:
      'simpleHash is a 32-bit FNV-1a variant that is mislabeled "sha256:" in ' +
      'its output. It is not SHA-256. Scheme C produced 8-hex-char digests that ' +
      'pass the 64-char format check only because they were padded.',
    fix: 'Replace with a real WebCrypto SHA-256 (crypto.subtle.digest) or the inline _sha256 pure-JS implementation over a canonically sorted preimage.',
  },
  {
    type: 'NON_CANONICAL_STRINGIFY',
    severity: 'SOFT',
    // Matches: _sha256(JSON.stringify(  |  sha256(JSON.stringify(
    // Intentionally does NOT match __ocgHash(…) since that already wraps
    // __ocgCanonStr internally.
    re: /\b(?:_sha256|sha256)\s*\(\s*JSON\.stringify\s*\(/,
    // Skip if the file already uses the OCG canonical string helper —
    // that means the sort is happening elsewhere in the same file.
    skip: /__ocgCanonStr\s*\(|__ocgHash\s*\(/,
    why:
      'SHA-256 is called directly on JSON.stringify(obj) without recursively ' +
      'sorting object keys first. Modern JS preserves insertion order, so the ' +
      'hash is stable within one runtime — but it will differ from an ' +
      'independent implementation that produces keys in a different order. ' +
      'RFC 8785 / JCS requires recursive key sort before serialisation.',
    fix:
      'Add a canonical-sort step: function canonStr(v) { if (v===null||typeof v!=="object") return JSON.stringify(v); ' +
      'if (Array.isArray(v)) return "["+v.map(canonStr).join(",")+"]"; ' +
      'return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonStr(v[k])).join(",")+"}"; } ' +
      'then call _sha256(canonStr(obj)) instead of _sha256(JSON.stringify(obj)).',
  },
];

// ── SHA-256 presence heuristic ────────────────────────────────────────────────
// True if the file performs ANY hash computation (determines NO_HASH vs CLEAN).
const HAS_HASH_RE = /\b(?:_sha256|simpleHash|sha256|__ocgHash|crypto\.subtle\.digest)\s*\(/;

// ── Scan tools/ ───────────────────────────────────────────────────────────────
const allFiles = readdirSync(TOOLS)
  .filter(f => f.endsWith('.html'))
  .sort();

const results   = [];
let hardTotal   = 0;
let softTotal   = 0;
let cleanCount  = 0;
let noHashCount = 0;

for (const fname of allFiles) {
  const rel = `tools/${fname}`;
  const abs = join(TOOLS, fname);
  let src;
  try { src = readFileSync(abs, 'utf8'); }
  catch { continue; }

  const alreadyCovered = cgCoveredFiles.has(rel.toLowerCase());
  const hasHashCompute = HAS_HASH_RE.test(src);

  const violations = [];

  for (const chk of CHECKS) {
    if (!chk.re.test(src)) continue;
    if (chk.skip?.test(src))  continue;

    // Collect line numbers
    const lines   = src.split('\n');
    const lineNums = [];
    for (let i = 0; i < lines.length; i++) {
      if ((chk.lineRe ?? chk.re).test(lines[i])) lineNums.push(i + 1);
    }

    violations.push({
      type:     chk.type,
      severity: chk.severity,
      lines:    lineNums,
      why:      chk.why,
      fix:      chk.fix,
    });
    if (chk.severity === 'HARD') hardTotal++;
    else softTotal++;
  }

  const hasHard = violations.some(v => v.severity === 'HARD');
  const hasSoft = violations.some(v => v.severity === 'SOFT');
  const status  =
    hasHard ? 'HARD_VIOLATION' :
    hasSoft ? 'SOFT_VIOLATION' :
    hasHashCompute ? 'CLEAN' : 'NO_HASH';

  if (status === 'CLEAN')   cleanCount++;
  if (status === 'NO_HASH') noHashCount++;

  results.push({
    file:            rel,
    status,
    alreadyCoveredByLintForbiddenHash: alreadyCovered,
    hasHashComputation: hasHashCompute,
    violations,
  });
}

// ── Build report ─────────────────────────────────────────────────────────────
const TODAY   = new Date().toISOString().slice(0, 10);
const outName = `catalog-hash-audit-${TODAY}.json`;
const outPath = resolve(HERE, outName);

const report = {
  generated:    new Date().toISOString(),
  scanned_dir:  'tools/*.html',
  script:       'scripts/audit-catalog-hash.mjs',
  note:
    'Audit-only — no files were modified. ' +
    'HARD violations require immediate remediation. ' +
    'SOFT violations should be fixed before advertising suite-wide verifiability ' +
    '(see AGENT-NATIVE-MCP-SPEC §0.6).',
  summary: {
    total_tools_scanned:  allFiles.length,
    hard_violations:      hardTotal,
    soft_violations:      softTotal,
    clean_with_hash:      cleanCount,
    no_hash:              noHashCount,
  },
  violation_types: CHECKS.map(c => ({
    type:     c.type,
    severity: c.severity,
    why:      c.why,
    fix:      c.fix,
  })),
  hard_violations: results.filter(r => r.status === 'HARD_VIOLATION'),
  soft_violations: results.filter(r => r.status === 'SOFT_VIOLATION'),
  clean_with_hash: results.filter(r => r.status === 'CLEAN').map(r => ({
    file: r.file,
    alreadyCoveredByLintForbiddenHash: r.alreadyCoveredByLintForbiddenHash,
  })),
  no_hash_tools: results.filter(r => r.status === 'NO_HASH').map(r => r.file),
  ci_proposal: {
    note:
      'When ready to gate CI, add the following step to ' +
      '.github/workflows/deploy-to-dreamhost.yml AFTER the existing ' +
      '"OpenChainGraph hash + JS syntax gates" step:',
    yaml: [
      '- name: 🔐 Catalog hash canonicalization audit',
      '  # Soft-gate: prints violations but does not block deploy.',
      '  # Flip `|| true` to `&& true` (i.e., remove it) to make this a hard gate.',
      '  run: node scripts/audit-catalog-hash.mjs || true',
    ].join('\n'),
    hardening_note:
      'To make it a hard gate (exit 1 on any HARD violation), add ' +
      '--fail-on-hard flag support to this script and remove the `|| true`.',
  },
};

writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

// ── Console output ────────────────────────────────────────────────────────────
if (!QUIET) {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   AINumbers — Catalog Hash Canonicalization Audit        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log(`Scanned: tools/*.html (${allFiles.length} files)\n`);
  console.log('SUMMARY');
  console.log('───────');
  console.log(`  ❌  Hard violations (SCHEME_A / SCHEME_C):           ${String(hardTotal).padStart(4)}`);
  console.log(`  ⚠️   Soft violations (NON_CANONICAL_STRINGIFY):       ${String(softTotal).padStart(4)}`);
  console.log(`  ✅  Clean (hash computed + canonical preimage):       ${String(cleanCount).padStart(4)}`);
  console.log(`  ○   No hash computation (no execution_hash emitted):  ${String(noHashCount).padStart(4)}`);
  console.log('');

  if (hardTotal > 0) {
    console.log('━━━ HARD VIOLATIONS (must fix before next deploy) ━━━');
    for (const r of report.hard_violations) {
      for (const v of r.violations.filter(v => v.severity === 'HARD')) {
        const lineStr = v.lines.length ? ` (line ${v.lines.join(', ')})` : '';
        console.log(`  ❌  ${r.file} — ${v.type}${lineStr}`);
      }
    }
    console.log('');
  }

  if (softTotal > 0) {
    console.log('━━━ SOFT VIOLATIONS (fix before advertising verifiability) ━━━');
    for (const r of report.soft_violations) {
      const lines = r.violations.flatMap(v => v.lines);
      const lineStr = lines.length ? ` (line ${lines.join(', ')})` : '';
      console.log(`  ⚠️   ${r.file}${lineStr}`);
    }
    console.log('');
  }

  if (cleanCount > 0) {
    console.log(`━━━ CLEAN (${cleanCount} tools compute hashes canonically) ━━━`);
    for (const r of report.clean_with_hash) {
      const tag = r.alreadyCoveredByLintForbiddenHash ? ' [also in ChainGraph lint]' : '';
      console.log(`  ✅  ${r.file}${tag}`);
    }
    console.log('');
  }

  console.log(`Full report written to: scripts/${outName}`);
  console.log('');
  console.log('CI PROPOSAL');
  console.log('───────────');
  console.log('Add to .github/workflows/deploy-to-dreamhost.yml preflight job,');
  console.log('after the existing "OpenChainGraph hash + JS syntax gates" step:\n');
  console.log(report.ci_proposal.yaml);
  console.log('');
}
