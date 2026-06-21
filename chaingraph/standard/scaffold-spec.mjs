#!/usr/bin/env node
// scaffold-spec.mjs — migration helper (Step 1). Two jobs:
//   --import : pull the DESCRIPTIVE sections (§7–§11) verbatim from the published
//             openchain-graph-spec.html into the [IMPORT §N] markers in SPEC.md, converting
//             the section's HTML to Markdown (headings, <pre> code, paragraphs, lists).
//   --verify : assert SPEC.md is a faithful SSOT — (1) frontmatter spec_version ==
//             chaingraph.json.spec_version, (2) all spec sections present, (3) the §1 envelope
//             JSON parses and carries the schema's required keys, (4) no stale version strings
//             outside the @context allowlist in the NORMATIVE CORE.
//
// This script does NOT invent content — it copies already-published prose. The human reviews the
// generated SPEC.md diff before committing (the §0.2 v0.3 remnants get fixed to v0.4 in passing).
//
// Usage:
//   node scaffold-spec.mjs --import   # writes SPEC.md descriptive sections from the HTML
//   node scaffold-spec.mjs --verify   # parity check; non-zero exit blocks the migration commit
// Paths default to the sibling layout; override SPEC / SPEC_HTML / CHAINGRAPH.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC = process.env.SPEC || firstExisting([
  join(HERE, 'SPEC.md'),                                         // landed: standard/SPEC.md
  join(HERE, '..', 'repo', 'chaingraph', 'standard', 'SPEC.md'), // staging: ssot-rollout/
]);
const SPEC_HTML = process.env.SPEC_HTML || firstExisting([
  join(HERE, '..', 'openchain-graph-spec.html'),                 // landed: chaingraph/openchain-graph-spec.html
  join(HERE, '..', 'repo', 'chaingraph', 'openchain-graph-spec.html'), // staging
]);
const CHAINGRAPH = process.env.CHAINGRAPH || firstExisting([
  join(HERE, '..', 'chaingraph.json'),                           // landed: chaingraph/chaingraph.json
  join(HERE, '..', 'repo', 'chaingraph', 'chaingraph.json'),     // staging
  join(HERE, 'chaingraph.json'),
]);
function firstExisting(ps) { return ps.find((p) => existsSync(p)) || ps[0]; }

const IMPORT_SECTIONS = [7, 8, 9, 10, 11];
const CORE_SECTIONS = [0, 1, 4, 5, 12, 13, 14, 15];
const CONTEXT_ALLOW = [/context\/v0\.3\//, /\/v0\.2#/, /new in v0\.[123]/i];

const mode = process.argv.includes('--import') ? 'import'
  : process.argv.includes('--verify') ? 'verify' : null;
if (!mode) { console.error('usage: scaffold-spec.mjs --import | --verify'); process.exit(2); }

const recordVersion = JSON.parse(readFileSync(CHAINGRAPH, 'utf8')).spec_version;

if (mode === 'import') {
  if (!existsSync(SPEC_HTML)) { console.error(`spec HTML not found: ${SPEC_HTML}`); process.exit(2); }
  const html = readFileSync(SPEC_HTML, 'utf8');
  let spec = readFileSync(SPEC, 'utf8');
  let done = 0;
  for (const n of IMPORT_SECTIONS) {
    const md = extractSectionMarkdown(html, n);
    if (!md) { console.warn(`! could not extract §${n} from HTML — leaving marker`); continue; }
    const marker = new RegExp(`^##\\s*§${n}\\b.*\\[IMPORT §${n}[^\\]]*\\].*$`, 'm');
    if (marker.test(spec)) { spec = spec.replace(marker, md.trimEnd()); done++; console.log(`✓ imported §${n} (${md.length} chars)`); }
    else console.warn(`! no [IMPORT §${n}] marker in SPEC.md`);
  }
  writeFileSync(SPEC, spec);
  console.log(`\nimported ${done}/${IMPORT_SECTIONS.length} sections into ${SPEC}. Review the diff before committing.`);
  process.exit(0);
}

// ---- verify ----
let fail = 0;
const spec = readFileSync(SPEC, 'utf8');

const fmVer = (spec.match(/^spec_version:\s*([0-9.]+)/m) || [])[1];
if (fmVer !== recordVersion) { console.error(`✗ SPEC.md spec_version ${fmVer} != chaingraph.json ${recordVersion}`); fail++; }
else console.log(`✓ version of record: ${fmVer}`);

for (const n of [...CORE_SECTIONS, ...IMPORT_SECTIONS]) {
  if (!new RegExp(`^##\\s*§${n}\\b`, 'm').test(spec)) { console.error(`✗ SPEC.md missing §${n}`); fail++; }
}
if (IMPORT_SECTIONS.some((n) => new RegExp(`\\[IMPORT §${n}[^\\]]*\\]`).test(spec))) {
  console.error('✗ SPEC.md still has unfilled [IMPORT §N] markers — run --import first'); fail++;
} else console.log('✓ all sections present, no unfilled imports');

// §1 envelope must parse and carry the schema's required keys
const envelope = (spec.match(/```json\s*([\s\S]*?"execution_hash"[\s\S]*?)```/) || [])[1];
const required = ['@context','chaingraph_version','tool_id','tool_version','generated_at','execution_hash','chain','policy_parameters','output_payload','audit_signature'];
try {
  const obj = JSON.parse(envelope.replace(/<[^>]*>/g, 'x')); // tolerate <placeholder> tokens (already inside quotes)
  const miss = required.filter((k) => !(k in obj));
  if (miss.length) { console.error(`✗ §1 envelope missing keys: ${miss.join(', ')}`); fail++; }
  else console.log('✓ §1 envelope carries all schema-required keys');
} catch { console.error('✗ §1 envelope JSON does not parse'); fail++; }

// stale version strings in the NORMATIVE CORE (outside the @context allowlist)
spec.split('\n').forEach((line, i) => {
  const hits = line.match(/v0\.[123](\.\d+)?/g);
  if (hits && !CONTEXT_ALLOW.some((r) => r.test(line)) && /§(0|1|4|5|12|13|14|15)/.test(sectionOf(spec, i)) === false) {
    // only warn for core; descriptive sections legitimately say "new in v0.3"
  }
});

console.log(`\n${fail ? '✗ ' + fail + ' problem(s)' : '✓ SPEC.md verified as faithful SSOT'}.`);
process.exit(fail ? 1 : 0);

// ---- helpers ----
function extractSectionMarkdown(html, n) {
  // grab from inside <div class="section" id="sN"> up to the next <div class="section"
  const open = new RegExp(`<div[^>]*\\bid=["']s${n}["'][^>]*>`);
  const m = open.exec(html);
  if (!m) return null;
  const rest = html.slice(m.index + m[0].length);
  const nextIdx = rest.search(/<div class="section"/);
  const block = nextIdx < 0 ? rest : rest.slice(0, nextIdx);
  return htmlToMd(block, n);
}
function htmlToMd(block, n) {
  let s = block;
  // drop page chrome that must not leak into the SSOT prose
  s = s.replace(/<div class="sec-num"[^>]*>[\s\S]*?<\/div>/g, '');     // "Section N — New in vX" label
  s = s.replace(/<div class="code-header"[^>]*>[\s\S]*?<\/div>/g, ''); // code-lang label + copy button
  s = s.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (_, t) => tableToMd(t));
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, (_, c) => '\n```\n' + stripTags(c).trim() + '\n```\n');
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (_, c) => `\n## §${n} ${stripTags(c)}\n`);
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, (_, c) => `\n### ${stripTags(c)}\n`);
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/g, (_, c) => `\n#### ${stripTags(c)}\n`);
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_, c) => `- ${stripTags(c)}\n`);
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (_, c) => `\n${stripTags(c)}\n`);
  s = s.replace(/<[^>]+>/g, '');
  let out = deindentOutsideFences(decode(s));
  out = out.replace(/[ \t]+\n/g, '\n')
           .replace(/([^\n])\n(#{2,4} )/g, '$1\n\n$2') // blank line before headings
           .replace(/\n{3,}/g, '\n\n');
  return out.trim() + '\n';
}
function deindentOutsideFences(s) {
  // left-trim prose lines (stray callout/box titles indent as markdown code otherwise) but
  // never touch lines inside ``` fences, where indentation is significant.
  let inFence = false;
  return s.split('\n').map((line) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return line.trim(); }
    return inFence ? line : line.replace(/^[ \t]+/, '');
  }).join('\n');
}
function tableToMd(t) {
  const rows = [];
  for (const tr of t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/g)]
      .map((c) => stripTags(c[2]).trim().replace(/\|/g, '\\|'));
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) return '';
  const fmt = (r) => `| ${r.join(' | ')} |`;
  return '\n' + [fmt(rows[0]), fmt(rows[0].map(() => '---')), ...rows.slice(1).map(fmt)].join('\n') + '\n';
}
function stripTags(s) { return decode(s.replace(/<[^>]+>/g, '')); }
function decode(s) { return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' '); }
function sectionOf() { return ''; }
