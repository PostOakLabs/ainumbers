#!/usr/bin/env node
/**
 * scripts/normalize-node-chrome.mjs
 * Normalize nav + footer + CSS in chaingraph/*.html pages to the canonical
 * form defined in chaingraph/_page-chrome.mjs. Covers three page classes:
 *   art       — chaingraph/art-*.html AND any other chaingraph/*.html that is
 *               a registered node in chaingraph.json (tool_id match) but whose
 *               filename doesn't start with "art-" (e.g. cry-01-…, ml-01-…).
 *   guide     — chaingraph/guide-*.html (per-network/standard workflow guides).
 *   explainer — remaining chaingraph/*.html non-node pages (hubs, explainers,
 *               demos) not in EXEMPT.
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
 * Breadcrumb source: class 'art' → chaingraph.json display_name (fallback h1).
 *                     class 'guide'/'explainer' → <title> text, site-suffix stripped
 *                     (fallback h1).
 *
 * EXEMPT (GUIDE-CHROME-AUDIT-1, 2026-08-17) — pages excluded from this normalizer
 * and from the widened check-node-page-chrome.mjs gate, each with a reason:
 *   chaingraph-hub.html        — is the SSOT source the nav/footer template was
 *                                 derived from; it is the "you are here" page for
 *                                 the OCG Suite breadcrumb link, so it cannot link
 *                                 to itself the way every other page does.
 *   ocg-verify-badge-demo.html — a deliberately chromeless embed-fixture/demo page
 *                                 (no <nav> at all in source) illustrating the badge
 *                                 in isolation; adding suite chrome would defeat the
 *                                 point of the embed demo.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNav, FOOTER, CHROME_CSS, CSS_MARKER, CHROME_EXEMPT } from '../chaingraph/_page-chrome.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(__dir, '..');
const CG    = resolve(REPO, 'chaingraph');

const SAMPLE_MODE = process.argv.includes('--sample');
const APPLY_MODE  = process.argv.includes('--apply');
// --skip-art: exclude true art-NN-*.html filenames (the pre-existing, separately-
// gated node-page class) from this run. Used by GUIDE-CHROME-AUDIT-1 to scope a
// run to the newly-covered classes without re-touching pages already governed by
// this SSOT — art-*.html footer content can drift from FOOTER independently
// (e.g. a new footer link added to _page-chrome.mjs) and that drift is a
// separate, already-in-scope-elsewhere concern, not this flag's job to fix.
const SKIP_ART_MODE = process.argv.includes('--skip-art');

const EXEMPT = CHROME_EXEMPT;

// Build display_name map from chaingraph.json
const chaingraphJson = JSON.parse(readFileSync(resolve(CG, 'chaingraph.json'), 'utf-8'));
const DISPLAY_NAME = new Map();
const NODE_IDS = new Set();
for (const node of (chaingraphJson.nodes || [])) {
  if (node.tool_id) {
    NODE_IDS.add(node.tool_id);
    if (node.display_name) DISPLAY_NAME.set(node.tool_id, node.display_name);
  }
}

function classify(filename) {
  const id = filename.replace(/\.html$/, '');
  if (/^art-\d+/.test(filename) || NODE_IDS.has(id)) return 'art';
  if (/^guide-/.test(filename)) return 'guide';
  return 'explainer';
}

// In --sample mode, filenames come after --sample on the CLI
const sampleFiles = SAMPLE_MODE
  ? process.argv.slice(process.argv.indexOf('--sample') + 1).filter(a => !a.startsWith('-'))
  : [];

const all = readdirSync(CG)
  .filter(f => /\.html$/.test(f))
  .filter(f => !EXEMPT.has(f))
  .filter(f => !(SKIP_ART_MODE && /^art-\d+/.test(f)))
  .sort();
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

/** Strip the trailing " · AINumbers.co" / " | AINumbers.co" site suffix from a <title>. */
function stripSiteSuffix(title) {
  return title.replace(/\s*[·|]\s*AINumbers\.co\s*$/i, '').trim();
}

/**
 * Derive breadcrumb for a page.
 * Class 'art': chaingraph.json display_name, prefixed "ART-NN · ", h1 fallback.
 * Class 'guide'/'explainer': <title> text (site suffix stripped), h1 fallback.
 * The html argument is passed for the h1 fallback.
 */
function deriveBreadcrumb(filename, html, pageClass) {
  const toolId = filename.replace(/\.html$/, '');

  if (pageClass === 'art') {
    const artM  = filename.match(/^art-(\d+)/);
    const artNN = artM ? `ART-${artM[1]}` : null;
    const display = DISPLAY_NAME.get(toolId);
    // §1.4: em-dashes banned in reader-facing copy; en-dashes allowed.
    if (artNN && display) return `${artNN} · ${display.replace(/—/g, '–')}`;
    if (artNN && html) {
      const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      if (h1M) {
        const text = decodeEntities(h1M[1].replace(/<[^>]+>/g, '')).trim();
        if (text && text.length > 3) return `${artNN} · ${text}`;
      }
    }
    // Registered node without an "art-" filename (e.g. cry-01-…): no ART-NN prefix.
    if (display) return display.replace(/—/g, '–');
    return null;
  }

  // guide / explainer: <title> first, h1 fallback. §1.4: em-dashes banned in
  // reader-facing copy (en-dash ranges fine) — the breadcrumb is visible text.
  const titleM = html && html.match(/<title>([\s\S]*?)<\/title>/);
  if (titleM) {
    const text = decodeEntities(stripSiteSuffix(titleM[1])).replace(/—/g, '–').trim();
    if (text && text.length > 3) return text;
  }
  if (html) {
    const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    if (h1M) {
      const text = decodeEntities(h1M[1].replace(/<[^>]+>/g, '')).replace(/—/g, '–').trim();
      if (text && text.length > 3) return text;
    }
  }
  return null;
}

/* ─── main transform ─── */

// Signal used to classify a footer block as "chrome" vs "body tool content".
// If ALL footer blocks in a multi-footer page match this pattern, they are
// chrome and safe to collapse into one canonical footer.
const CHROME_FOOTER_SIGNAL = /AINumbers\.co|Post Oak Labs|CC BY|client-side only|Zero PII/i;

function processFile(filename) {
  const path      = resolve(CG, filename);
  const original  = readFileSync(path, 'utf-8');
  let html        = original;
  const pageClass = classify(filename);

  const breadcrumb = deriveBreadcrumb(filename, html, pageClass);
  if (!breadcrumb) {
    skipped.push({ file: filename, reason: `[${pageClass}] no display_name/<title>/h1 usable for breadcrumb` });
    return;
  }

  // ── guard: exactly one site-chrome <nav> (bare, or with aria-label only) —
  // a class'd <nav class="…"> is in-body content (e.g. a table-of-contents
  // <nav class="toc-hero">), never touched here. ──
  const bareNavOpens = (html.match(/<nav(?![^>]*\bclass=)[^>]*>/g) || []).length;
  if (bareNavOpens !== 1) {
    skipped.push({ file: filename, reason: `bare <nav> count (${bareNavOpens}) — expected exactly 1 site-chrome nav` });
    return;
  }

  // ── REPLACE the site-chrome <nav>…</nav> only (no class= attribute) ──
  html = html.replace(/<nav(?![^>]*\bclass=)[^>]*>[\s\S]*?<\/nav>/, buildNav(breadcrumb));

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

  // ── inject / refresh CSS ──
  // Use </head> injection (new <style> block) to avoid hitting </style> tags inside
  // document.write() calls within <script> blocks (which lastIndexOf would find last).
  if (!html.includes(CSS_MARKER)) {
    const headClose = html.indexOf('</head>');
    if (headClose === -1) {
      skipped.push({ file: filename, reason: 'no </head> tag found' });
      return;
    }
    html = html.slice(0, headClose) + `<style>${CHROME_CSS}\n</style>\n` + html.slice(headClose);
  } else {
    // Marker already present from a prior run — replace ONLY the span from the
    // marker itself through the next </style>, leaving everything before the
    // marker untouched. Some pages carry the chrome CSS in its own <style> tag;
    // others have it appended inside the same <style> tag as the page's own CSS
    // (no tag boundary between them). Slicing from the marker (not from the
    // enclosing <style> open tag) is safe in both layouts — it never risks
    // deleting page-specific CSS that happens to share the tag.
    const markerIdx     = html.indexOf(CSS_MARKER);
    const styleCloseIdx = html.indexOf('</style>', markerIdx);
    if (styleCloseIdx === -1) {
      skipped.push({ file: filename, reason: 'CSS_MARKER present but no following </style> found' });
      return;
    }
    const freshBlock = CHROME_CSS.slice(CHROME_CSS.indexOf(CSS_MARKER));
    html = html.slice(0, markerIdx) + freshBlock + '\n' + html.slice(styleCloseIdx);
  }

  // ── post-transform sanity: counts must still be (1,1) ──
  const navAfter = (html.match(/<nav(?![^>]*\bclass=)[^>]*>/g) || []).length;
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
