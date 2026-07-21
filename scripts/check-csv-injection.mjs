#!/usr/bin/env node
/**
 * check-csv-injection.mjs — CSV-injection sanitization gate (WORKBOOK-1-BUILD-SPEC.md §WB-5).
 *
 * A CSV-emitting file (Blob MIME `text/csv` in a tool/guide HTML page, or a
 * Node-side CSV serializer under chaingraph/kernels/) must apply the OWASP
 * CSV-injection prefix rule — a leading `= + - @ TAB CR` character gets
 * prefixed with `'` before quoting, since quoting alone does not stop Excel/
 * Sheets from treating such a field as a formula. The canonical
 * implementation is chaingraph/kernels/_csv_injection.mjs (workbook.mjs
 * imports it; tools/554-workbook-table-editor.html inlines it).
 *
 * Detection is a grep heuristic, not a parser: a file counts as "adopted" if
 * it references the shared helper by name (CSV_INJECTION / csvInjection /
 * csv-injection / sanitizeCsvField / serializeCsvField) anywhere in its text
 * — good enough to catch inlined copies of the canonical pattern without
 * false-negatives on the actual algorithm shape.
 *
 * scripts/csv-injection-baseline.json shields the 84 pre-existing emitters
 * found unprotected in the WB-5 sweep (2026-07-16 audit; too large a sweep to
 * fix in this gate row — SO doctrine: LIST, don't fix). The baseline is a
 * RATCHET: a file not in the baseline and not carrying the adoption marker
 * fails the gate outright. Shrink the baseline by fixing a file and removing
 * its entry; never add new entries for freshly-written code.
 *
 * Usage:
 *   node scripts/check-csv-injection.mjs            # gate (preflight + CI)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = resolve(REPO, 'scripts', 'csv-injection-baseline.json');

const ADOPTION_RE = /CSV_INJECTION|csvInjection|csv-injection|sanitizeCsvField|serializeCsvField/;
const EMITS_CSV_HTML_RE = /text\/csv/;
const EMITS_CSV_KERNEL_RE = /\bcsvField\s*\(|\bparseCsvLine\s*\(/; // Node-side CSV serializers (art-190, art-350 style)

function listHtml(dir) {
  return readdirSync(resolve(REPO, dir)).filter((f) => f.endsWith('.html')).map((f) => join(dir, f));
}

const candidates = [
  ...listHtml('tools'),
  ...listHtml('guides'),
  ...readdirSync(resolve(REPO, 'chaingraph', 'kernels'))
    .filter((f) => f.endsWith('.kernel.mjs'))
    .map((f) => join('chaingraph', 'kernels', f)),
];

const baseline = new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files);

const emitters = [];
for (const rel of candidates) {
  const text = readFileSync(resolve(REPO, rel), 'utf8');
  const isHtmlEmitter = rel.endsWith('.html') && EMITS_CSV_HTML_RE.test(text);
  const isKernelEmitter = rel.endsWith('.kernel.mjs') && EMITS_CSV_KERNEL_RE.test(text);
  if (isHtmlEmitter || isKernelEmitter) emitters.push({ rel: rel.split('\\').join('/'), adopted: ADOPTION_RE.test(text) });
}

const violations = emitters.filter((e) => !e.adopted && !baseline.has(e.rel));
const staleBaseline = [...baseline].filter((f) => !emitters.some((e) => e.rel === f));

if (violations.length) {
  console.error(`❌ CSV-INJECTION GATE: ${violations.length} CSV-emitting file(s) lack the OWASP prefix rule and are NOT in the baseline:`);
  for (const v of violations) console.error(`   ${v.rel}`);
  console.error('\nEither adopt chaingraph/kernels/_csv_injection.mjs\'s pattern (and it will pass), or — if this');
  console.error('is pre-existing debt being re-discovered, not new code — add it to scripts/csv-injection-baseline.json.');
  process.exit(1);
}

if (staleBaseline.length) {
  console.log(`ℹ️  ${staleBaseline.length} baseline entr${staleBaseline.length === 1 ? 'y no longer matches' : 'ies no longer match'} a detected CSV emitter (renamed/removed/no longer emits CSV) — safe to prune from scripts/csv-injection-baseline.json:`);
  for (const f of staleBaseline) console.log(`   ${f}`);
}

const unprotectedBaselined = emitters.filter((e) => !e.adopted && baseline.has(e.rel)).length;
console.log(`✅ CSV-injection gate: ${emitters.length} emitter(s) scanned, ${unprotectedBaselined} baselined (pre-existing debt), 0 new violations.`);
