#!/usr/bin/env node
/**
 * scripts/gen-errata-snapshot.mjs — KERNEL-ERRATA-READER-1 writer.
 *
 *   node scripts/gen-errata-snapshot.mjs          # write (main-side regen workflow)
 *   node scripts/gen-errata-snapshot.mjs --check  # freshness gate: exit 1 if output differs
 *
 * Bakes the page-load errata snapshot from the recorded module errata and the published
 * checkpoint, and splices the three generated surfaces:
 *   1. chaingraph/errata/errata-snapshot.mjs — the snapshot module chaingraph/verify.html
 *      imports (script-src 'self'; the pages make no network call of any kind).
 *   2. errata.html — the generated table of module errata, between
 *      KERNEL-ERRATA-TABLE:START/:END markers.
 *   3. chaingraph/receipt-bundle-verify.html — the vendored reader and snapshot blocks,
 *      between ERRATA-READER-VENDORED:START/:END and ERRATA-SNAPSHOT-VENDORED:START/:END
 *      markers (that page is deliberately self-contained: CONTRACT §1.1, no imports).
 *
 * Inputs are read-only: registry/errata/checkpoint, chaingraph/errata/sources/*.json,
 * chaingraph/errata/predicates/<id>.mjs, chaingraph/errata-check.mjs. Nothing is written
 * under registry/ (main-side log writer's lane, gen-registry-errata.mjs). No clock, no
 * network: the output is a fixpoint of the committed inputs, which is what the --check
 * freshness gate asserts. Entry ids are never reordered except by id ascending, and an
 * entry whose predicate sha256 does not match its record is refused (never guess).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ID_RE, sha256Text } from './lib/kernel-errata.mjs';
import { parseErrataCheckpoint } from '../chaingraph/errata-check.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKPOINT = 'registry/errata/checkpoint';
const SNAPSHOT_PATH = 'chaingraph/errata/errata-snapshot.mjs';
const ERRATA_PAGE = 'errata.html';
const BUNDLE_PAGE = 'chaingraph/receipt-bundle-verify.html';
const READER_PATH = 'chaingraph/errata-check.mjs';

const CHECK = process.argv.includes('--check');

function die(msg) {
  console.error(`gen-errata-snapshot: REFUSED ${msg}`);
  process.exit(1);
}

function splice(text, startMarker, endMarker, replacement, where) {
  const a = text.indexOf(startMarker);
  const b = text.indexOf(endMarker);
  if (a === -1 || b === -1 || b < a) die(`${where}: markers ${JSON.stringify(startMarker)} / ${JSON.stringify(endMarker)} not found or out of order`);
  return text.slice(0, a) + replacement + text.slice(b + endMarker.length);
}

function stripExportKeyword(src, where) {
  // Vendorable forms only: plain declarations. No export default / brace / star forms,
  // which cannot be turned into classic-script bodies by a keyword strip.
  if (/^export\s+(?!\b(function|const|let|var)\b)/m.test(src)) die(`${where}: unexpected export form (default/brace/star exports cannot be vendored)`);
  return src.replace(/^export /gm, '');
}

// ── load + validate ───────────────────────────────────────────────────────────────────
const cpText = readFileSync(join(ROOT, CHECKPOINT), 'utf8');
let cp;
try {
  cp = parseErrataCheckpoint(cpText);
} catch (e) {
  die(`${CHECKPOINT}: ${e.message}`);
}
if (!cp.stalenessSentence) die(`${CHECKPOINT}: no staleness extension line; the reader must ship the log's own sentence verbatim`);

const sourcesDir = join(ROOT, 'chaingraph/errata/sources');
const files = (readdirSafe(sourcesDir) || []).filter((f) => f.endsWith('.json')).sort();
const entries = [];
for (const f of files) {
  const raw = readFileSync(join(sourcesDir, f), 'utf8');
  let e;
  try { e = JSON.parse(raw); } catch (err) { die(`sources/${f}: not valid JSON (${err.message})`); }
  if (e.kind !== 'kernel') continue; // spec-keyed entries belong to the spec errata surface
  if (!ID_RE.test(e.id)) die(`sources/${f}: bad id ${e.id}`);
  if (!Array.isArray(e.kernel_digest_affected) || !e.kernel_digest_affected.length) die(`${e.id}: kernel_digest_affected must be a non-empty array`);
  if (typeof e.kernel_digest_fixed !== 'string') die(`${e.id}: kernel_digest_fixed missing`);
  if (typeof e.summary !== 'string' || !e.summary.trim()) die(`${e.id}: summary missing`);
  if (/[—―–]/.test(e.summary)) die(`${e.id}: summary carries a dash character; one plain sentence, no dashes`);
  const predRel = e.affected_predicate && e.affected_predicate.path;
  if (typeof predRel !== 'string') die(`${e.id}: affected_predicate.path missing`);
  const predSrc = readFileSync(join(ROOT, predRel), 'utf8');
  if (sha256Text(predSrc) !== e.affected_predicate.sha256) die(`${e.id}: predicate sha256 does not match ${predRel}`);
  if (/(^|[^:\w])import\b|(^|\n)\s*import\s*\(/.test(predSrc)) die(`${predRel}: carries an import; the browser reader embeds predicates verbatim and they must be import-free`);
  if (!/^export function affected\(/m.test(predSrc)) die(`${predRel}: no 'export function affected(' to embed`);
  entries.push({ entry: e, predSrc });
}
entries.sort((a, b) => (a.entry.id < b.entry.id ? -1 : 1));

// ── render: snapshot module ───────────────────────────────────────────────────────────
function renderSnapshotModule() {
  const L = [];
  L.push('// GENERATED FILE - written by scripts/gen-errata-snapshot.mjs. DO NOT hand-edit.');
  L.push('// Inputs: registry/errata/checkpoint (verbatim checkpoint lines), the recorded module');
  L.push('// errata under chaingraph/errata/sources/ and their predicates. Entries are');
  L.push('// append-only (K5): a correction is a new entry, never an edit of this output.');
  L.push('// Imported as a same-origin page-load resource by chaingraph/verify.html; vendored');
  L.push('// into chaingraph/receipt-bundle-verify.html by this writer (that page imports');
  L.push('// nothing: CONTRACT 1.1). KERNEL-ERRATA-READER-1.');
  L.push('');
  L.push('export const ERRATA_SNAPSHOT = {');
  L.push('  checkpoint: {');
  L.push(`    origin: ${JSON.stringify(cp.origin)},`);
  L.push(`    tree_size: ${cp.size},`);
  L.push(`    expires_at: ${cp.expiresAt === null ? 'null' : cp.expiresAt},`);
  L.push(`    staleness_sentence: ${JSON.stringify(cp.stalenessSentence)},`);
  L.push(`    source: ${JSON.stringify(CHECKPOINT)}`);
  L.push('  },');
  L.push('  entries: [');
  entries.forEach(({ entry: e, predSrc }, i) => {
    const comma = i < entries.length - 1 ? ',' : '';
    L.push('    {');
    L.push(`      id: ${JSON.stringify(e.id)},`);
    L.push(`      node_id: ${JSON.stringify(e.node_id ?? null)},`);
    L.push(`      tool_id: ${JSON.stringify(e.tool_id ?? null)},`);
    L.push(`      class: ${JSON.stringify(e.class ?? null)},`);
    L.push(`      summary: ${JSON.stringify(e.summary)},`);
    L.push(`      published_at: ${JSON.stringify(e.published_at ?? null)},`);
    L.push(`      kernel_digest_affected: ${JSON.stringify(e.kernel_digest_affected)},`);
    L.push(`      kernel_digest_fixed: ${JSON.stringify(e.kernel_digest_fixed)},`);
    L.push(`      affected_predicate_sha256: ${JSON.stringify(e.affected_predicate.sha256)},`);
    L.push('      // Predicate embedded verbatim (export keyword stripped; import-free, K3-pure).');
    L.push('      affected: (function () {');
    for (const line of stripExportKeyword(predSrc, predRelOf(e)).split('\n')) L.push('        ' + line);
    L.push('        return affected;');
    L.push('      })()');
    L.push('    }' + comma);
  });
  L.push('  ]');
  L.push('};');
  L.push('');
  return L.join('\n');
}

function predRelOf(e) { return e.affected_predicate.path; }

// ── render: errata.html table region ──────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function renderErrataTableRegion() {
  const L = [];
  L.push(`<!-- KERNEL-ERRATA-TABLE:START (generated by scripts/gen-errata-snapshot.mjs; DO NOT hand-edit) -->`);
  L.push('    <style>');
  L.push('    .ke-table{width:100%;border-collapse:collapse;font-size:.78rem;margin:.75rem 0 1rem}');
  L.push('    .ke-table th{text-align:left;color:var(--muted);font-weight:400;font-family:var(--mono,monospace);font-size:.65rem;letter-spacing:.06em;text-transform:uppercase;padding:.4rem .6rem .4rem 0;vertical-align:top;border-bottom:1px solid var(--border)}');
  L.push('    .ke-table td{color:var(--text);padding:.55rem .6rem .55rem 0;vertical-align:top;border-bottom:1px solid var(--border);word-break:break-word}');
  L.push('    .ke-table code{word-break:break-all}');
  L.push('    </style>');
  L.push(`    <p class="note" style="font-size:.78rem;color:var(--body)">Recorded module errata: ${entries.length}. A holder checks a receipt against this record offline on the <a href="chaingraph/verify.html">artifact verifier</a> and the <a href="chaingraph/receipt-bundle-verify.html">receipt bundle verifier</a>; past the checkpoint's expiry those pages print the log's own staleness sentence, unchanged. This record is optional due diligence and never a verification step.</p>`);
  L.push('    <table class="ke-table">');
  L.push('      <tr><th>erratum</th><th>module</th><th>class</th><th>summary</th><th>affected digest</th><th>fixed digest</th><th>published</th></tr>');
  if (!entries.length) {
    L.push('      <tr><td colspan="7" style="color:var(--body)">No module errata have been recorded. Entries are appended only when a kernel fix in place changes an output for some input.</td></tr>');
  }
  for (const { entry: e } of entries) {
    const affected = e.kernel_digest_affected.map((d) => esc(d)).join('<br>');
    L.push('      <tr>');
    L.push(`        <td><code>${esc(e.id)}</code></td>`);
    L.push(`        <td>${esc(e.tool_id ?? e.node_id ?? '')}</td>`);
    L.push(`        <td>${esc(e.class ?? '')}</td>`);
    L.push(`        <td>${esc(e.summary)}</td>`);
    L.push(`        <td><code>${affected}</code></td>`);
    L.push(`        <td><code>${esc(e.kernel_digest_fixed)}</code></td>`);
    L.push(`        <td>${esc(e.published_at ?? '')}</td>`);
    L.push('      </tr>');
  }
  L.push('    </table>');
  L.push('    <!-- KERNEL-ERRATA-TABLE:END -->');
  // No trailing newline: the page's own newline after the END marker terminates the line,
  // and splice() must stay a fixpoint (a trailing \n here would grow the page every run).
  return L.join('\n');
}

// ── render: vendored blocks (receipt-bundle-verify.html) ──────────────────────────────
function renderVendoredReader() {
  const body = stripExportKeyword(readFileSync(join(ROOT, READER_PATH), 'utf8'), READER_PATH);
  const L = [];
  L.push('<!-- ERRATA-READER-VENDORED:START (verbatim chaingraph/errata-check.mjs, export keywords stripped; regenerated by scripts/gen-errata-snapshot.mjs; DO NOT hand-edit) -->');
  L.push('<script>');
  L.push('/* The shared kernel-errata reader, vendored so this self-contained page imports nothing.');
  L.push('   SSOT: chaingraph/errata-check.mjs. Re-vendor with scripts/gen-errata-snapshot.mjs. */');
  L.push('const ERRATA_READER = (function () {');
  L.push(body);
  L.push('return { parseErrataCheckpoint, extractKernelDigest, extractPolicyParameters, errataCheck, errataSentence };');
  L.push('})();');
  L.push('</script>');
  L.push('<!-- ERRATA-READER-VENDORED:END -->');
  return L.join('\n');
}

function renderVendoredSnapshot() {
  const mod = renderSnapshotModule().replace(/^export /m, '');
  const L = [];
  L.push('<!-- ERRATA-SNAPSHOT-VENDORED:START (generated by scripts/gen-errata-snapshot.mjs; DO NOT hand-edit) -->');
  L.push('<script>');
  L.push('/* The errata snapshot (checkpoint + recorded module errata), vendored for the same');
  L.push('   reason as the reader above. SSOT: chaingraph/errata/errata-snapshot.mjs. */');
  L.push(mod);
  L.push('</script>');
  L.push('<!-- ERRATA-SNAPSHOT-VENDORED:END -->');
  return L.join('\n');
}

// ── outputs ───────────────────────────────────────────────────────────────────────────
const out = [];
out.push([SNAPSHOT_PATH, renderSnapshotModule()]);

const pageText = readFileSync(join(ROOT, ERRATA_PAGE), 'utf8');
out.push([ERRATA_PAGE, splice(pageText, '<!-- KERNEL-ERRATA-TABLE:START', '<!-- KERNEL-ERRATA-TABLE:END -->', renderErrataTableRegion(), ERRATA_PAGE)]);

const bundleText = readFileSync(join(ROOT, BUNDLE_PAGE), 'utf8');
out.push([BUNDLE_PAGE, splice(
  splice(bundleText, '<!-- ERRATA-READER-VENDORED:START', '<!-- ERRATA-READER-VENDORED:END -->', renderVendoredReader(), BUNDLE_PAGE + ' (reader)'),
  '<!-- ERRATA-SNAPSHOT-VENDORED:START', '<!-- ERRATA-SNAPSHOT-VENDORED:END -->', renderVendoredSnapshot(), BUNDLE_PAGE + ' (snapshot)'
)]);

function readdirSafe(p) { try { return readdirSync(p); } catch { return null; } }

if (CHECK) {
  // A missing output counts as "would change" (stale), not a crash: on a PR head the
  // whole-file snapshot module is absent BY DESIGN (prAbsentOk; SO #35 main-side regen
  // writes it after merge), and this gate is advisory there. On main it must be a fixpoint.
  const onDisk = (rel) => { try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return null; } };
  const bad = out.filter(([rel, rendered]) => rendered !== onDisk(rel));
  if (bad.length) {
    console.error(`gen-errata-snapshot --check: STALE (${bad.length} file(s) would change):`);
    for (const [rel] of bad) console.error(`  - ${rel}${onDisk(rel) === null ? ' (absent: PR heads carry no whole-file derived snapshot; main regen writes it post-merge)' : ''}`);
    console.error('Run: node scripts/gen-errata-snapshot.mjs   (main-side regen owns this output; on a PR this gate is advisory)');
    process.exit(1);
  }
  console.log(`gen-errata-snapshot --check: fixpoint ok (${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, checkpoint size ${cp.size}, 3 generated surfaces).`);
  process.exit(0);
}

for (const [rel, rendered] of out) writeFileSync(join(ROOT, rel), rendered);
console.log(`gen-errata-snapshot: wrote ${out.map(([rel]) => rel).join(', ')} (${entries.length} entries, checkpoint size ${cp.size}).`);
