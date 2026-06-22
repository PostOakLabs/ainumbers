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
  'hash-sweep.mjs,verify-mcp-registered.mjs,smoke-mcp.mjs,smoke-compute.mjs,check-tool-names.mjs,kernel-coverage.mjs,validate-chains.mjs'
).split(',').map((s) => s.trim()).filter(Boolean));

if (!existsSync(SPEC)) { console.error(`SPEC.md not found at ${SPEC}`); process.exit(2); }
const spec = readFileSync(SPEC, 'utf8');

// known gate files on disk
const onDisk = new Set();
for (const d of GATE_DIRS) for (const f of readdirSync(d)) if (/\.(mjs|js)$/.test(f)) onDisk.add(f);

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

// orphan gates: on disk in the standard/scripts dirs but not referenced (warn only — tests/helpers exist)
const KNOWN_NONGATE = /\.(test|fixtures)\.|^_hash|^index\.mjs$|scaffold-spec|inject-counts|generate/;
for (const f of onDisk) {
  if (/(parity|consistency|coverage|sweep|registered|validate|lint-forbidden|hash-integrity|check-tool-names)/.test(f)
      && !referenced.has(f) && !KNOWN_NONGATE.test(f)) {
    console.warn(`⚠ gate-like script "${f}" is on disk but not referenced in §15 — add it to the matrix or rename`);
  }
}

console.log();
console.log(errs ? `✗ ${errs} coverage error(s) — a normative rule has no wired gate` : '✓ every §15 rule maps to a real gate on disk');
process.exitCode = errs ? 1 : 0;
