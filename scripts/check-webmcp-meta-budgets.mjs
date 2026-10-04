// Advisory lint: WebMCP tool-metadata budgets over manifests/*.manifest.json.
// Budget source: stevysmith/gallery-402 gallery/evals/compat.mjs budgets
// (tool name <= 30 chars, description <= 500, parameter description <= 150,
// no $ref inside schemas), pattern-ported per
// research/WEBMCP-BORROW-AUDIT-2026-09-29.md (class P: no upstream bytes copied).
// Report mode by default (always exit 0); --strict exits 1 on any violation.
//
// CEILING mode (WEBMCP-META-LINT-CEILING-1, 2026-10-01, Tim's "Advisory + count
// ceiling" decision): --ceiling turns this report into a DOWN-ONLY ratchet, the
// same shape as the §18 compute-proof deferred ratchet. The pinned baseline
// (scripts/webmcp-meta-budgets-baseline.json) holds the violation count
// measured at the pin, and the gate exits 1 ONLY when the live count EXCEEDS
// that ceiling, quoting the delta and the new offender files. Below the
// ceiling it prints the re-pin command (--update-baseline); the gate never
// raises a ceiling. The baseline is loaded through the shared hard-failing
// loader (scripts/ratchet-baseline.mjs, RATCHET-BASELINE-LOADER-1), so a
// missing or garbled baseline exits 1 and is never read as green. In ceiling
// mode the exit code keys on the count alone (--strict is not consulted), so a
// count-neutral swap of one old violation for a new one stays legal by design.
// Report mode and --strict are unchanged by any of this.
//
// Optional argv entries override the scan set with explicit files/directories
// (fixture testing); each directory is scanned for *.manifest.json one level deep.
//
// Usage:
//   node scripts/check-webmcp-meta-budgets.mjs                 # report (always exit 0)
//   node scripts/check-webmcp-meta-budgets.mjs --strict        # exit 1 on any violation
//   node scripts/check-webmcp-meta-budgets.mjs --ceiling       # DOWN-ONLY ratchet vs the pinned baseline
//   node scripts/check-webmcp-meta-budgets.mjs --update-baseline  # re-pin (down only; refuses to raise)
//
// Self-test (SO #40b, RED before GREEN): scripts/check-webmcp-meta-budgets.test.mjs.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from './ratchet-baseline.mjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.resolve(HERE, 'webmcp-meta-budgets-baseline.json');
const BASELINE_LABEL = 'WebMCP meta budgets ceiling';
const REPIN_COMMAND = 'node scripts/check-webmcp-meta-budgets.mjs --update-baseline';
// Required by the shared hard-failing loader (RATCHET-BASELINE-LOADER-1):
// `violations` is the DOWN-ONLY ceiling; `violation_files` is the provenance
// snapshot used only to NAME new offenders in a breach message — the exit code
// keys on the count alone.
const BASELINE_REQUIRED_KEYS = ['violations', { key: 'violation_files', type: 'name-list' }];
const BASELINE_OPTS = { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND };

const NAME_MAX = 30;
const DESCRIPTION_MAX = 500;
const PARAM_DESCRIPTION_MAX = 150;

// Baseline snapshots must be portable across OSes (CI is linux, dev may be
// win32): store/compare rel paths POSIX-normalised. Display strings below keep
// the raw path.relative output, unchanged.
const toPosix = (p) => p.split(path.sep).join('/');

// Every "description" string inside a JSON Schema is field-level documentation
// for an agent, so the parameter budget applies to all of them, and $ref is
// rejected anywhere because an agent cannot resolve external fragments.
export function schemaFindings(schema, where, out) {
  if (schema === null || typeof schema !== 'object') return;
  if (Array.isArray(schema)) {
    for (const el of schema) schemaFindings(el, where, out);
    return;
  }
  for (const [key, value] of Object.entries(schema)) {
    if (key === '$ref') {
      out.push(`${where}: schema carries "$ref" (${String(value)})`);
    } else if (key === 'description' && typeof value === 'string' && value.length > PARAM_DESCRIPTION_MAX) {
      out.push(`${where}: schema description ${value.length} chars > ${PARAM_DESCRIPTION_MAX}`);
    } else {
      schemaFindings(value, where, out);
    }
  }
}

export function manifestFindings(rel, mf) {
  const out = [];
  if (typeof mf.name !== 'string') {
    out.push(`${rel}: mcp_tool_definition has no string "name"`);
  } else if (mf.name.length > NAME_MAX) {
    out.push(`${rel}: tool name ${mf.name.length} chars > ${NAME_MAX} ("${mf.name}")`);
  }
  if (typeof mf.description !== 'string') {
    out.push(`${rel}: mcp_tool_definition has no string "description"`);
  } else if (mf.description.length > DESCRIPTION_MAX) {
    out.push(`${rel}: description ${mf.description.length} chars > ${DESCRIPTION_MAX}`);
  }
  schemaFindings(mf.inputSchema, `${rel}: inputSchema`, out);
  schemaFindings(mf.outputSchema, `${rel}: outputSchema`, out);
  return out;
}

export function collectManifestFiles(targets = [], root = ROOT) {
  if (targets.length > 0) {
    const files = [];
    for (const t of targets) {
      const abs = path.resolve(process.cwd(), t);
      if (statSync(abs).isDirectory()) {
        files.push(
          ...readdirSync(abs)
            .filter((f) => f.endsWith('.manifest.json'))
            .map((f) => path.join(abs, f)),
        );
      } else {
        files.push(abs);
      }
    }
    return files;
  }
  const dir = path.join(root, 'manifests');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.manifest.json') && !f.includes('DELETE ME'))
    .map((f) => path.join(dir, f));
}

/** The full scan as a pure result (no printing, no exiting): every violation
 * line plus the POSIX rel paths of the files carrying at least one (a parse
 * error counts — the line lands in findings exactly as before). */
export function scanBudgets(targets = [], root = ROOT) {
  const files = collectManifestFiles(targets, root);
  const findings = [];
  const offenderFiles = [];
  let withDef = 0;
  let parseErrors = 0;

  for (const file of files) {
    const rel = path.relative(root, file);
    let json;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      parseErrors += 1;
      findings.push(`${rel}: JSON parse error (${err.message})`);
      offenderFiles.push(toPosix(rel));
      continue;
    }
    const mf = json && json.mcp_tool_definition;
    if (!mf || typeof mf !== 'object') continue;
    withDef += 1;
    const out = manifestFindings(rel, mf);
    if (out.length) {
      findings.push(...out);
      offenderFiles.push(toPosix(rel));
    }
  }
  return { files, withDef, parseErrors, findings, offenderFiles: offenderFiles.sort() };
}

// The DOWN-ONLY ceiling check as a pure function (same shape as
// check-compute-proof-coverage.mjs's ratchetBreach): `over` is true iff the
// live count ROSE above the pinned ceiling; `added` names the offender files
// that were clean (or absent) at the pin. ⛔ NO `?? Infinity` DEFAULT on the
// ceiling — RATCHET-BASELINE-LOADER-1 (gate-integrity F-11): a ceiling that
// cannot be breached is not a ratchet, so this pure function enforces the same
// finite-ceiling rule the strict CLI path gets from loadRatchetBaselineOrExit().
export function ceilingBreach(scan, baseline) {
  const ceiling = assertFiniteCeiling(baseline?.violations, { label: BASELINE_LABEL, keyName: 'violations' });
  const known = Array.isArray(baseline?.violation_files) ? new Set(baseline.violation_files) : new Set();
  return {
    ceiling,
    count: scan.findings.length,
    over: scan.findings.length > ceiling,
    added: scan.offenderFiles.filter((f) => !known.has(f)),
  };
}

function baselineDocument(scan) {
  return {
    _comment:
      'Ratchet ceiling for WebMCP tool-metadata budgets (check-webmcp-meta-budgets.mjs --ceiling). ' +
      'Counts only go DOWN — the gate refuses to raise it. violation_files is the provenance snapshot ' +
      'used only to NAME new offenders in a breach message; the exit code keys on the count alone. ' +
      `Re-pin (down only): ${REPIN_COMMAND}`,
    violations: scan.findings.length,
    violation_files: [...new Set(scan.offenderFiles)].sort(),
  };
}

// Gate body runs only when this file is executed directly, never on `import` —
// the self-test imports the exported pure pieces without triggering a full
// estate scan or a process.exit as an import side effect.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const strict = process.argv.includes('--strict');
const CEILING = process.argv.includes('--ceiling');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');
const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const scan = scanBudgets(targets);

if (UPDATE_BASELINE) {
  // ⚖ THE ONE SANCTIONED ABSENT-BASELINE PATH (ratchet-baseline.mjs): this mode
  // is the file's WRITER — on a first-ever pin there is legitimately nothing to
  // read (null), while an EXISTING corrupt baseline still hard-fails rather
  // than being overwritten as if it had been a clean pin. ⛔ Never raises: a
  // live count above the current pin is refused — fix violations first.
  const old = readBaselineForUpdate(BASELINE_PATH, BASELINE_REQUIRED_KEYS, BASELINE_OPTS);
  if (old && scan.findings.length > old.violations) {
    console.error(
      `webmcp-meta-budgets: --update-baseline REFUSED — live violations ${scan.findings.length} exceed the ` +
        `pinned ceiling ${old.violations} (counts only go DOWN). Fix violations first, then re-pin.`,
    );
    process.exit(1);
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(baselineDocument(scan), null, 2) + '\n');
  console.log(
    `webmcp-meta-budgets: baseline written — ${scan.findings.length} violation(s) → ` +
      `scripts/webmcp-meta-budgets-baseline.json${old ? ` (was ${old.violations})` : ' (first pin)'}`,
  );
  process.exit(0);
}

for (const f of scan.findings) console.log(f);
console.log(
  `webmcp-meta-budgets: scanned ${scan.files.length} manifests, ${scan.withDef} with mcp_tool_definition, ` +
    `violations: ${scan.findings.length}${scan.parseErrors > 0 ? ` (incl. ${scan.parseErrors} parse errors)` : ''}`,
);

if (CEILING) {
  // Hard-failing load: a missing or garbled baseline exits 1 here, never green
  // (RATCHET-BASELINE-LOADER-1). The exit code keys on the count alone.
  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_REQUIRED_KEYS, BASELINE_OPTS);
  const ratchet = ceilingBreach(scan, baseline);
  if (ratchet.over) {
    console.error(
      `webmcp-meta-budgets: FAIL (ceiling) — violations ${ratchet.count} > pinned ceiling ${ratchet.ceiling} ` +
        `(+${ratchet.count - ratchet.ceiling}); counts only go DOWN.`,
    );
    if (ratchet.added.length) console.error('  New offender file(s): ' + ratchet.added.join(', '));
    console.error(`  Fix the new violation(s) (trim the manifest) — or, for a deliberate net-zero swap, re-pin lower with: ${REPIN_COMMAND} (never raises).`);
    process.exit(1);
  }
  if (ratchet.count < ratchet.ceiling) {
    console.log(`webmcp-meta-budgets: within ceiling (${ratchet.count} < ${ratchet.ceiling}) — re-pin lower with: ${REPIN_COMMAND}`);
  } else {
    console.log(`webmcp-meta-budgets: at ceiling (${ratchet.count} = ${ratchet.ceiling})`);
  }
  // WEBMCP-META-BUDGETS-EXIT-FLUSH-1: end naturally with exit code 0. An explicit
  // process.exit(0) here can discard the pending piped-stdout writes (the summary +
  // verdict lines above) before they flush — run 37181833046 truncated exactly those
  // lines on CI and failed the self-test's GREEN (e2e) verdict match.
  process.exitCode = 0;
} else if (strict && scan.findings.length > 0) {
  console.error('webmcp-meta-budgets: FAIL (--strict, violations above)');
  process.exit(1);
} else {
  console.log('webmcp-meta-budgets: done (' + (strict ? 'strict' : 'report') + ' mode)');
}
}
