#!/usr/bin/env node
// spec-gate-coverage.mjs — META-GATE (closes the conformance-by-construction loop).
// Parses the SPEC.md §15 conformance-gate matrix and asserts that EVERY normative rule row
// names at least one real, on-disk gate script — so a future PR can't add a MUST to the standard
// without wiring its automation. This is the institutional fix for "documented but not enforced"
// (the hash incident: a rule with no live gate drifted silently).
//
// Rules it enforces:
//   - Every row in the §15 table has a non-empty Gate cell (no "TODO"/"none"/"—").
//   - Every gate script named in backticks in that cell resolves to a file on disk
//     (searched across the standard, worker scripts, and kernels dirs).
//   - (warn) every gate script on disk is referenced by at least one row (no orphan gates).
//
// Zero-dependency. Non-zero exit blocks. Run in the SITE repo (SPEC.md lives there).
//   node spec-gate-coverage.mjs
//   SPEC=… node spec-gate-coverage.mjs

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC = process.env.SPEC || firstExisting([
  join(HERE, '..', 'repo', 'chaingraph', 'standard', 'SPEC.md'),
  join(HERE, 'SPEC.md'),
]);
// Where gate scripts may live (search roots).
const GATE_DIRS = (process.env.GATE_DIRS || [
  HERE,                                                     // landed: standard/ (SSOT gates)
  join(HERE, '..', 'kernels'),                             // landed: chaingraph/kernels (hash gates)
  join(HERE, '..', 'exporters'),                           // landed: chaingraph/exporters (§13 export gates)
  join(HERE, '..', '..', '..', 'mcp-apps-poc', 'scripts'), // local sibling worker repo (dev runs)
  join(HERE, '..', 'mcp-apps-poc', 'scripts'),             // staging: ssot-rollout/
  join(HERE, '..', 'repo', 'chaingraph', 'kernels'),       // staging
  join(HERE, '..', 'repo', 'chaingraph', 'standard'),      // staging
].join(';')).split(';').filter((d) => existsSync(d));
function firstExisting(ps) { return ps.find((p) => existsSync(p)) || ps[0]; }

// Gates that live in the WORKER repo (mcp-apps-poc) and are verified by the worker's own CI.
// When this meta-gate runs in the SITE repo (worker not checked out), treat these as satisfied-by-name
// — the rule still MUST name a gate; only the on-disk check is delegated to the worker CI.
const EXTERNAL_GATES = new Set((process.env.GATE_EXTERNAL ||
  'hash-sweep.mjs,verify-mcp-registered.mjs,smoke-mcp.mjs,smoke-compute.mjs,check-tool-names.mjs,kernel-coverage.mjs,validate-chains.mjs,linear-hash-freeze.mjs,gate-static.test.mjs,gate-semantics.test.mjs,gate-branch-coverage.test.mjs,gate-parity.test.mjs,compile-mandate-determinism.test.mjs,mandate-binding.test.mjs,validate-input-attestations.test.mjs,validate-private-inputs.test.mjs,gate-export-format-consistency.mjs'
).split(',').map((s) => s.trim()).filter(Boolean));

if (!existsSync(SPEC)) { console.error(`SPEC.md not found at ${SPEC}`); process.exit(2); }
const spec = readFileSync(SPEC, 'utf8');

// Known gate files on disk. A Map (basename -> GATE_DIR it was found in), so the orphan-gate
// heuristic below can reason about WHERE a file lives (SPECGATE-HYGIENE-1, 2026-09-01 — audit
// HASH-2: kernel filenames like validate-/coverage-/sweep-*.kernel.mjs false-positived the
// gate-name regex, printing ~26 advisory warnings every run and burying the real signal).
const onDisk = new Map();
for (const d of GATE_DIRS) for (const f of readdirSync(d)) if (/\.(mjs|js)$/.test(f)) onDisk.set(f, d);

// extract the §15 table: rows between "§15" heading and the next "## " heading
const s15 = (spec.split(/^##\s+§15\b/m)[1] || '').split(/^##\s/m)[0];
if (!s15) { console.error('✗ SPEC.md has no §15 conformance-gate section — the matrix is the SSOT for gates.'); process.exit(1); }

const rows = s15.split('\n').filter((l) => l.trim().startsWith('|') && !/^\|\s*-+/.test(l) && !/\|\s*Rule\s*\|/i.test(l));
let errs = 0, referenced = new Set();
console.log(`spec-gate-coverage · ${rows.length} matrix rows · gate dirs: ${GATE_DIRS.length}\n`);

for (const row of rows) {
  const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
  if (cells.length < 2) continue;
  const [rule, gateCell] = cells;
  // match any .mjs/.js token in the cell, even with trailing args inside backticks (e.g. `kernel-coverage.mjs --strict`)
  const gates = [...gateCell.matchAll(/([\w.\/-]+\.(?:mjs|js))\b/g)].map((m) => m[1].split(/[\/\\]/).pop());
  const meta = /meta\)/i.test(rule); // the meta-row referencing this script itself
  if (gates.length === 0 && !meta) {
    console.error(`✗ no gate for rule: "${rule.slice(0, 60)}"`); errs++; continue;
  }
  for (const g of gates) {
    referenced.add(g);
    if (onDisk.has(g)) console.log(`✓ ${g}  (rule: ${rule.slice(0, 48)})`);
    else if (EXTERNAL_GATES.has(g)) console.log(`○ ${g}  (external — verified in worker CI)`);
    else { console.error(`✗ gate "${g}" named in §15 but not found on disk (rule: ${rule.slice(0, 48)})`); errs++; }
  }
}

// orphan gates: on disk in the standard/kernels/exporters dirs but not referenced (warn only — tests/helpers exist)
const KNOWN_NONGATE = /\.(test|fixtures)\.|^_hash|^index\.mjs$|scaffold-spec|inject-counts|generate/;

// Dated not-a-§15-gate records (SPECGATE-HYGIENE-1, 2026-09-01 — audit HASH-2). These gate-like
// scripts are deliberately NOT §15 conformance gates. The row's alternative resolution — a dated
// note in each script's own header — sits outside this gate's repo for the two worker scripts and
// outside the row's fence for the site one, so the record lives HERE, next to the heuristic that
// would flag them, and prints loudly on every run that enumerates the file. ⛔ NOT silent
// suppression (SO #34c): every entry carries its date and reason, and deleting an entry without
// adding a matrix row re-flags the script.
const NOT_A_S15_GATE = new Map(Object.entries({
  'check-credits-coverage.mjs': { date: '2026-09-01', reason: 'vendoring-credits coverage gate (site scripts/, all-4-repo scope) — institutional hygiene, not an OCG conformance rule' },
  'build-mcp-parity.mjs': { date: '2026-09-01', reason: 'worker build-path parity proof (single-tool vs full buildServer tool-definition identity) — worker-CI build invariant, not a §15 rule' },
  'check-preflight-parity.mjs': { date: '2026-09-01', reason: 'worker CI-vs-preflight gate-list drift gate — infra hygiene, not a §15 conformance rule' },
  'check-utility-count-parity.mjs': { date: '2026-09-01', reason: 'worker↔site utility-tool count cross-check (MCPCOUNTS-FIX-1) — infra hygiene, not a §15 conformance rule' },
}));

for (const [f, dir] of onDisk) {
  // Kernel implementation files are node code, never §15 gates — skip them by NAME (.kernel.mjs),
  // not by directory: chaingraph/kernels also hosts real gate scripts (vm-parity-gate.mjs,
  // lint-forbidden-hash.mjs, kernel-hash-integrity.mjs) that MUST stay loud when unreferenced.
  // (SPECGATE-HYGIENE-1: excluding the kernels/ DIRECTORY literally would silence
  // vm-parity-gate.mjs; the measured false-positive class is exactly the .kernel.mjs filenames.)
  if (f.endsWith('.kernel.mjs')) continue;
  if (/(parity|consistency|coverage|sweep|registered|validate|lint-forbidden|hash-integrity|check-tool-names)/.test(f)
      && !referenced.has(f) && !KNOWN_NONGATE.test(f)) {
    const note = NOT_A_S15_GATE.get(f);
    if (note) { console.log(`– ${f} (${dir}) — not a §15 gate (dated ${note.date}): ${note.reason}`); continue; }
    console.warn(`⚠ gate-like script "${f}" is on disk but not referenced in §15 — add it to the matrix or rename`);
  }
}

console.log();
console.log(errs ? `✗ ${errs} coverage error(s) — a normative rule has no wired gate` : '✓ every §15 rule maps to a real gate on disk');
process.exitCode = errs ? 1 : 0;
