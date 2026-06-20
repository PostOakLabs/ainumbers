// fix-catalog-non-canonical.mjs
//
// Patches the 9 catalog tools that use _sha256(JSON.stringify(x)) without a
// recursive canonical key sort (NON_CANONICAL_STRINGIFY from the audit).
//
// What it does per file:
//   1. Injects __ocgCanonStr() — a recursive key-sort function matching the
//      OCG spec — immediately after the _sha256 definition.
//   2. Replaces _sha256(JSON.stringify(<param>)) with _sha256(__ocgCanonStr(<param>)).
//
// The canonical string helper is named __ocgCanonStr to stay consistent with
// the naming used in chaingraph/kernels/_hash.mjs. It is purely synchronous
// and has no external dependencies.
//
// Usage:
//   node scripts/fix-catalog-non-canonical.mjs            # dry-run (default)
//   node scripts/fix-catalog-non-canonical.mjs --apply    # write changes
//
// After applying, re-run the audit to confirm zero soft violations:
//   node scripts/audit-catalog-hash.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE  = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(HERE, '..');
const APPLY = process.argv.includes('--apply');

// ── The canonical string helper to inject ────────────────────────────────────
// Matches the OCG canonical string function in chaingraph/kernels/_hash.mjs:
// recursively sorts object keys before serialising, so the hash preimage is
// deterministic across all implementations regardless of key insertion order.
const CANON_FN =
  'function __ocgCanonStr(v){' +
    "if(v===null||typeof v!=='object')return JSON.stringify(v);" +
    "if(Array.isArray(v))return'['+v.map(__ocgCanonStr).join(',')+']';" +
    "return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+__ocgCanonStr(v[k])).join(',')+'}';}" ;

// ── Injection anchor ─────────────────────────────────────────────────────────
// _sha256 always ends with this substring (the final hex-join return):
// T89 uses double-quoted string literals inside _sha256; all others use single.
// Match both variants with a regex instead of a literal anchor.
const SHA256_END_RE = /\.padStart\(8,["']0["']\)\)\.join\(["']["']\);\}/;

// ── Files to patch and their argument variable name ──────────────────────────
// All 9 soft-violation files from catalog-hash-audit-2026-06-20.json.
const TARGETS = [
  // expanded style — arg is "inputState"
  { file: 'tools/89-working-capital-optimizer.html',    arg: 'inputState' },
  { file: 'tools/100-dora-resilience-auditor.html',     arg: 'inputState' },
  { file: 'tools/101-iso20022-migration-scorer.html',   arg: 'inputState' },
  { file: 'tools/102-ap2-payments-checker.html',        arg: 'inputState' },
  { file: 'tools/103-payment-method-optimizer.html',    arg: 'inputState' },
  { file: 'tools/104-receivables-dso-optimizer.html',   arg: 'inputState' },
  // minified style — arg is "st"
  { file: 'tools/105-fx-netting-simulator.html',        arg: 'st' },
  { file: 'tools/106-treasury-float-workbench.html',    arg: 'st' },
  { file: 'tools/108-dlt-partition-recovery-sim.html',  arg: 'st' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function patchContent(src, arg) {
  let out = src;
  const errors = [];

  // ── Step 1: inject __ocgCanonStr after the end of _sha256 ────────────────
  if (out.includes('function __ocgCanonStr(')) {
    // Already patched — skip injection but still check the call site.
  } else {
    const anchorMatch = SHA256_END_RE.exec(out);
    if (!anchorMatch) {
      errors.push('Could not find _sha256 end anchor — injection skipped');
    } else {
      // Insert after the anchor (end of the matched substring)
      const insertAt = anchorMatch.index + anchorMatch[0].length;
      out = out.slice(0, insertAt) + '\n' + CANON_FN + out.slice(insertAt);
    }
  }

  // ── Step 2: replace the non-canonical stringify call ─────────────────────
  const BAD_CALL   = `_sha256(JSON.stringify(${arg}))`;
  const GOOD_CALL  = `_sha256(__ocgCanonStr(${arg}))`;

  if (!out.includes(BAD_CALL)) {
    // Check if it's already been patched
    if (out.includes(GOOD_CALL)) {
      // No-op — already correct
    } else {
      errors.push(`Could not find expected call: ${BAD_CALL}`);
    }
  } else {
    // replaceAll in case the template appears more than once (shouldn't, but safe)
    out = out.replaceAll(BAD_CALL, GOOD_CALL);
  }

  return { patched: out, errors };
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║   fix-catalog-non-canonical.mjs                         ║');
console.log(`║   Mode: ${APPLY ? '✏️  APPLY (writing files)               ' : '🔍  DRY-RUN (no files written)         '}║`);
console.log('╚══════════════════════════════════════════════════════════╝\n');

let patchedCount = 0;
let skipCount    = 0;
let errorCount   = 0;

for (const { file, arg } of TARGETS) {
  const abs = resolve(REPO, file);
  let src;
  try {
    src = readFileSync(abs, 'utf8');
  } catch {
    console.error(`  ✗ Cannot read: ${file}`);
    errorCount++;
    continue;
  }

  const { patched, errors } = patchContent(src, arg);

  if (errors.length) {
    for (const e of errors) console.error(`  ✗ ${file}: ${e}`);
    errorCount++;
    continue;
  }

  if (patched === src) {
    console.log(`  ○  ${file} — already patched, skipped`);
    skipCount++;
    continue;
  }

  // Verify the good call is present in the output
  const GOOD_CALL = `_sha256(__ocgCanonStr(${arg}))`;
  if (!patched.includes(GOOD_CALL)) {
    console.error(`  ✗ ${file}: post-patch verification failed — ${GOOD_CALL} not found`);
    errorCount++;
    continue;
  }
  // Verify the bad call is gone
  const BAD_CALL = `_sha256(JSON.stringify(${arg}))`;
  if (patched.includes(BAD_CALL)) {
    console.error(`  ✗ ${file}: post-patch verification failed — bad call still present`);
    errorCount++;
    continue;
  }
  // Verify __ocgCanonStr is present
  if (!patched.includes('function __ocgCanonStr(')) {
    console.error(`  ✗ ${file}: post-patch verification failed — __ocgCanonStr not injected`);
    errorCount++;
    continue;
  }

  if (APPLY) {
    try {
      writeFileSync(abs, patched, 'utf8');
      console.log(`  ✅  ${file} — patched and written`);
    } catch (e) {
      console.error(`  ✗ ${file}: write failed — ${e.message}`);
      errorCount++;
      continue;
    }
  } else {
    console.log(`  📝  ${file} — would patch (dry-run)`);
    console.log(`       + injected __ocgCanonStr after _sha256 definition`);
    console.log(`       + _sha256(JSON.stringify(${arg})) → _sha256(__ocgCanonStr(${arg}))`);
  }

  patchedCount++;
}

console.log('');
console.log('─────────────────────────────────────────────────────────');
if (APPLY) {
  console.log(`Written:  ${patchedCount}   Skipped: ${skipCount}   Errors: ${errorCount}`);
  if (errorCount === 0) {
    console.log('\n✅  All patches applied. Verify with:');
    console.log('    node scripts/audit-catalog-hash.mjs');
    console.log('\nThen commit:');
    console.log('    git add tools/89-working-capital-optimizer.html \\');
    console.log('            tools/100-dora-resilience-auditor.html \\');
    console.log('            tools/101-iso20022-migration-scorer.html \\');
    console.log('            tools/102-ap2-payments-checker.html \\');
    console.log('            tools/103-payment-method-optimizer.html \\');
    console.log('            tools/104-receivables-dso-optimizer.html \\');
    console.log('            tools/105-fx-netting-simulator.html \\');
    console.log('            tools/106-treasury-float-workbench.html \\');
    console.log('            tools/108-dlt-partition-recovery-sim.html');
    console.log('    git commit -m "fix(hash): canonicalise AP2 audit_trail_hash preimage in 9 catalog tools"');
    console.log('    git push');
  } else {
    console.log(`\n⚠️  ${errorCount} error(s) — review above and fix manually.`);
  }
} else {
  console.log(`Would patch: ${patchedCount}   Already done: ${skipCount}   Errors: ${errorCount}`);
  console.log('\nRun with --apply to write the changes:');
  console.log('  node scripts/fix-catalog-non-canonical.mjs --apply');
}
console.log('');
