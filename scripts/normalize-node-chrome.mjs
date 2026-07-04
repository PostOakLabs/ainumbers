#!/usr/bin/env node
/**
 * scripts/normalize-node-chrome.mjs
 * Normalize nav + footer + CSS in all chaingraph/art-*.html to the canonical
 * form defined in chaingraph/_page-chrome.mjs.
 *
 * Usage:
 *   node scripts/normalize-node-chrome.mjs --sample <filenames…>  # named pages, dry-run preview
 *   node scripts/normalize-node-chrome.mjs --dry-run              # all pages, no write
 *   node scripts/normalize-node-chrome.mjs --apply                # all pages, write
 *
 * SCOPE: only <nav>…</nav>, <footer>…</footer>, and <style> CSS injection.
 *        NEVER touches body/main/tool content, MANIFEST, mfst toggle, scripts,
 *        <head>, <title>, meta, JSON-LD, or tools/*.html.
 *
 * Breadcrumb source: chaingraph.json display_name (NOT <title>/<meta>/<h1>).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNav, FOOTER, CHROME_CSS, CSS_MARKER } from '../chaingraph/_page-chrome.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(__dir, '..');
const CG    = resolve(REPO, 'chaingraph');

const SAMPLE_MODE = process.argv.includes('--sample');
const APPLY_MODE  = process.argv.includes('--apply');

// Build display_name map from chaingraph.json
const chaingraphJson = JSON.parse(readFileSync(resolve(CG, 'chaingraph.json'), 'utf-8'));
const DISPLAY_NAME = new Map();
for (const node of (chaingraphJson.nodes || [])) {
  if (node.tool_id && node.display_name) {
    DISPLAY_NAME.set(node.tool_id, node.display_name);
  }
}

// In --sample mode, filenames come after --sample on the CLI
const sampleFiles = SAMPLE_MODE
  ? process.argv.slice(process.argv.indexOf('--sample') + 1).filter(a => !a.startsWith('-'))
  : [];

const all = readdirSync(CG).filter(f => /^art-\d+.*\.html$/.test(f)).sort();
const targets = SAMPLE_MODE ? sampleFiles : all;

const changed = [];
const skipped = [];

/* ─── helpers ─── */

function decodeEntities(s) {
  return s
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&nbsp;/g, ' ');
}

/**
 * Derive breadcrumb for a page.
 * Primary: chaingraph.json display_name.
 * Fallback (only for pages not in chaingraph.json): h1 text.
 * The html argument is passed for the h1 fallback.
 */
function deriveBreadcrumb(filename, html) {
  const toolId  = filename.replace(/\.html$/, '');
  const artM    = filename.match(/^art-(\d+)/);
  const artNN   = artM ? `ART-${artM[1]}` : null;
  if (!artNN) return null;

  const display = DISPLAY_NAME.get(toolId);
  // §1.4: em-dashes banned in reader-facing copy; en-dashes allowed.
  if (display) return `${artNN} · ${display.replace(/—/g, '–')}`;

  // Fallback: h1 text (for pages not in chaingraph.json — art-15/16/17/18)
  if (html) {
    const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    if (h1M) {
      const text = decodeEntities(h1M[1].replace(/<[^>]+>/g, '')).trim();
      if (text && text.length > 3) return `${artNN} · ${text}`;
    }
  }

  return null; // still no source → skip
}

/* ─── main transform ─── */

// Signal used to classify a footer block as "chrome" vs "body tool content".
// If ALL footer blocks in a multi-footer page match this pattern, they are
// chrome and safe to collapse into one canonical footer.
const CHROME_FOOTER_SIGNAL = /AINumbers\.co|Post Oak Labs|CC BY|client-side only|Zero PII/i;

function processFile(filename) {
  const path     = resolve(CG, filename);
  const original = readFileSync(path, 'utf-8');
  let html       = original;

  // Breadcrumb: chaingraph.json first, h1 fallback for pages not in chaingraph.json
  const breadcrumb = deriveBreadcrumb(filename, html);
  if (!breadcrumb) {
    skipped.push({ file: filename, reason: 'no display_name in chaingraph.json and no usable h1' });
    return;
  }

  // ── guard: exactly one <nav>…</nav> ──
  const navOpens  = (html.match(/<nav[^>]*>/g) || []).length;
  const navCloses = (html.match(/<\/nav>/g) || []).length;
  if (navOpens !== 1 || navCloses !== 1) {
    skipped.push({ file: filename, reason: `nav count (${navOpens}/${navCloses})` });
    return;
  }

  // ── REPLACE nav (handle optional attributes on opening tag) ──
  html = html.replace(/<nav[^>]*>[\s\S]*?<\/nav>/, buildNav(breadcrumb));

  // ── handle footer: 1 footer → replace; N footers (all chrome) → collapse → insert ──
  const ftrOpens  = (html.match(/<footer[^>]*>/g) || []).length;
  const ftrCloses = (html.match(/<\/footer>/g) || []).length;

  if (ftrOpens !== ftrCloses) {
    skipped.push({ file: filename, reason: `footer count asymmetric (${ftrOpens}/${ftrCloses})` });
    return;
  }

  if (ftrOpens === 1) {
    // Standard single-footer replacement
    html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/, FOOTER);
  } else if (ftrOpens > 1) {
    // Multiple footers: safe to collapse only if every block is chrome-type
    const blocks = [...html.matchAll(/<footer[^>]*>[\s\S]*?<\/footer>/g)].map(m => m[0]);
    const allChrome = blocks.every(b => CHROME_FOOTER_SIGNAL.test(b));
    if (!allChrome) {
      skipped.push({ file: filename, reason: `footer count (${ftrOpens}/${ftrCloses}) — non-chrome footer detected, scope fence` });
      return;
    }
    // Strip all footer blocks, then insert canonical before </body>
    html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/g, '');
    if (!html.includes('</body>')) {
      skipped.push({ file: filename, reason: 'no </body> after footer collapse' });
      return;
    }
    html = html.replace('</body>', `\n${FOOTER}\n</body>`);
  } else {
    // Zero footers — insert before </body>
    if (!html.includes('</body>')) {
      skipped.push({ file: filename, reason: 'no footer and no </body>' });
      return;
    }
    html = html.replace('</body>', `\n${FOOTER}\n</body>`);
  }

  // ── inject CSS (idempotent) ──
  // Use </head> injection (new <style> block) to avoid hitting </style> tags inside
  // document.write() calls within <script> blocks (which lastIndexOf would find last).
  if (!html.includes(CSS_MARKER)) {
    const headClose = html.indexOf('</head>');
    if (headClose === -1) {
      skipped.push({ file: filename, reason: 'no </head> tag found' });
      return;
    }
    html = html.slice(0, headClose) + `<style>${CHROME_CSS}\n</style>\n` + html.slice(headClose);
  }

  // ── post-transform sanity: counts must still be (1,1) ──
  const navAfter = (html.match(/<nav[^>]*>/g) || []).length;
  const ftrAfter = (html.match(/<footer[^>]*>/g) || []).length;
  if (navAfter !== 1 || ftrAfter !== 1) {
    // Should never happen, but guard anyway
    skipped.push({ file: filename, reason: `post-transform count error nav=${navAfter} footer=${ftrAfter}` });
    return;
  }

  if (html === original) return; // already canonical

  if (APPLY_MODE && !SAMPLE_MODE) {
    writeFileSync(path, html, 'utf-8');
  }
  changed.push({ file: filename, breadcrumb, applied: APPLY_MODE && !SAMPLE_MODE });
}

/* ─── run ─── */

for (const f of targets) {
  try {
    processFile(f);
  } catch (e) {
    skipped.push({ file: f, reason: `exception: ${e.message}` });
  }
}

/* ─── report ─── */

console.log('\n=== normalize-node-chrome ===');
if (SAMPLE_MODE) {
  console.log('Mode: SAMPLE (dry-run, no files written)');
} else if (APPLY_MODE) {
  console.log('Mode: APPLY (all pages written)');
} else {
  console.log('Mode: DRY-RUN (no files written)');
}

console.log(`\nTarget pages : ${targets.length}`);
console.log(`Would change : ${changed.length}`);
console.log(`Skipped      : ${skipped.length}`);

if (changed.length) {
  const label = (APPLY_MODE && !SAMPLE_MODE) ? 'Written' : 'Would write / Sample';
  console.log(`\n${label}:`);
  changed.forEach(c => console.log(`  ✓ ${c.file}  breadcrumb="${c.breadcrumb}"`));
}

if (skipped.length) {
  console.log('\nSkipped (manual follow-up):');
  skipped.forEach(s => console.log(`  SKIP ${s.file}: ${s.reason}`));
}

if (!APPLY_MODE && !SAMPLE_MODE && changed.length > 0) {
  console.log('\nRun with --apply to write all changes.');
}
