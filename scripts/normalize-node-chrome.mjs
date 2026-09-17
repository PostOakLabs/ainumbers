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
 *   node scripts/normalize-node-chrome.mjs --only <filenames…> --apply  # named pages, write
 *   node scripts/normalize-node-chrome.mjs --apply --footer-only  # footer region only
 *
 * PHASE 0 GUARDS (FOOTER-CHROME-REMEDIATION-PLAN-v2, PHASE0-NORMALIZER-GUARDS-1):
 *   1. footer-in-script — if ANY <footer…> open tag sits inside a <script> span,
 *      the page is pushed to `skipped` with reason `footer-in-script` (mixed
 *      pages name the in-script count). Script text is NEVER edited: the old
 *      tool rewrote print-template footers inside JS strings (K4: art-139
 *      bytes 77663→77944, exit 0).
 *   2. page CSS after chrome marker — before rewriting the marker..</style>
 *      span, its selectors are parsed; any selector not present in CHROME_CSS
 *      skips the page with reason `page CSS after chrome marker`. The old tool
 *      deleted art-593's whole base stylesheet this way (K3: css-after-marker
 *      9565→2712 chars, `:root{` 1→0, exit 0).
 *   3. Fail loud — `--apply` exits 1 when any page was skipped. `--dry-run` and
 *      `--sample` may exit 0 but always print the skip list.
 *   4. EXEMPT honours named lists — `--only` and `--sample` both apply the
 *      CHROME_EXEMPT filter (K11: `--sample` used to bypass it); an exempt name
 *      is pushed to `skipped` with the EXEMPT reason and never processed.
 *   5. Scope report — every changed file reports which regions changed
 *      (nav / footer / css), and `--footer-only` touches ONLY the footer so
 *      link-refresh rows produce footer-only diffs.
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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildNav, FOOTER, CHROME_CSS, CSS_MARKER, CHROME_EXEMPT } from '../chaingraph/_page-chrome.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(__dir, '..');
const CG    = resolve(REPO, 'chaingraph');

const SAMPLE_MODE  = process.argv.includes('--sample');
const APPLY_MODE   = process.argv.includes('--apply');
// --skip-art: exclude true art-NN-*.html filenames (the pre-existing, separately-
// gated node-page class) from this run. Used by GUIDE-CHROME-AUDIT-1 to scope a
// run to the newly-covered classes without re-touching pages already governed by
// this SSOT — art-*.html footer content can drift from FOOTER independently
// (e.g. a new footer link added to _page-chrome.mjs) and that drift is a
// separate, already-in-scope-elsewhere concern, not this flag's job to fix.
const SKIP_ART_MODE = process.argv.includes('--skip-art');
// --footer-only: touch ONLY the footer region (nav and CSS left byte-identical)
// so link-refresh rows produce footer-only diffs (plan v2 Phase 0 item 5).
const FOOTER_ONLY_MODE = process.argv.includes('--footer-only');
// --only <filenames…>: named target list that WRITES under --apply (unlike
// --sample, which is always a dry-run preview). Both honour EXEMPT.
const ONLY_MODE = process.argv.includes('--only');
// --dir <path>: target chaingraph directory override (sandbox/testing hook; the
// CLI defaults to the repo's own chaingraph/).
const DIR_OVERRIDE = (() => {
  const i = process.argv.indexOf('--dir');
  return (i !== -1 && process.argv[i + 1]) ? resolve(process.argv[i + 1]) : null;
})();
const CG_DIR = DIR_OVERRIDE || CG;

const EXEMPT = CHROME_EXEMPT;

// Build display_name map from chaingraph.json (of the TARGET dir)
const chaingraphJson = JSON.parse(readFileSync(resolve(CG_DIR, 'chaingraph.json'), 'utf-8'));
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

// In --sample / --only mode, filenames come after the flag on the CLI.
// Collection stops at the NEXT '-'-prefixed token (so a trailing --dir value,
// --apply, --footer-only, … is never swallowed as a filename).
function namedFilesAfter(flag) {
  if (!process.argv.includes(flag)) return [];
  const out = [];
  for (const a of process.argv.slice(process.argv.indexOf(flag) + 1)) {
    if (a.startsWith('-')) break;
    out.push(a);
  }
  return out;
}
const sampleFiles = namedFilesAfter('--sample');
const onlyFiles   = namedFilesAfter('--only');

/* ─── guards: detection helpers (exported for the test) ─── */

/** Byte spans of every <script …>…</script> block in the document. */
export function scriptSpans(html) {
  return [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)]
    .map(m => [m.index, m.index + m[0].length]);
}

/** Footer-open matches whose index falls inside a <script> span. */
export function footersInsideScript(html) {
  const spans = scriptSpans(html);
  const opens = [...html.matchAll(/<footer\b[^>]*>/gi)];
  return opens.filter(m => spans.some(([a, b]) => m.index > a && m.index < b));
}

/**
 * Selectors declared in a CSS fragment. Comments stripped; every text run
 * preceding a '{' (any brace depth, so @media conditions and nested selectors
 * are collected uniformly) is a selector. Normalized: whitespace collapsed,
 * lowercased, deduplicated. Comparison uses the same parser on both sides
 * (span vs CHROME_CSS) so the classification is consistent by construction.
 */
export function extractSelectors(cssText) {
  const noComments = cssText.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const sels = [];
  let buf = '';
  let depth = 0;
  for (const ch of noComments) {
    if (ch === '{') {
      if (depth >= 0) {
        const s = buf.replace(/\s+/g, ' ').trim().toLowerCase();
        if (s) sels.push(s);
      }
      buf = '';
      depth++;
    } else if (ch === '}') {
      buf = '';
      depth--;
    } else if (ch === ';') {
      buf = '';
    } else {
      buf += ch;
    }
  }
  return [...new Set(sels)];
}

/* ─── region extractors for the per-file scope report ─── */

function navRegion(html) {
  const m = html.match(/<nav(?![^>]*\bclass=)[^>]*>[\s\S]*?<\/nav>/);
  return m ? m[0] : null;
}
function footerRegion(html) {
  return [...html.matchAll(/<footer[^>]*>[\s\S]*?<\/footer>/g)].map(m => m[0]).join('\n');
}
function cssRegion(html) {
  const i = html.indexOf(CSS_MARKER);
  if (i === -1) return null;
  const j = html.indexOf('</style>', i);
  return j === -1 ? null : html.slice(i, j);
}

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

const FOOTER_IN_SCRIPT = 'footer-in-script';
const PAGE_CSS_AFTER_MARKER = 'page CSS after chrome marker';

/**
 * Transform one page. Returns one of:
 *   { status: 'skipped',   file, reason }
 *   { status: 'unchanged', file }
 *   { status: 'changed',   file, breadcrumb, regions: {nav,footer,css}, wrote }
 * Writes ONLY when opts.apply is true (and never for skipped pages).
 */
function processFile(filename, opts) {
  const { dir, apply, footerOnly } = opts;
  const path      = resolve(dir, filename);
  const original  = readFileSync(path, 'utf-8');
  let html        = original;
  const pageClass = classify(filename);

  const breadcrumb = deriveBreadcrumb(filename, html, pageClass);
  if (!breadcrumb) {
    return { status: 'skipped', file: filename, reason: `[${pageClass}] no display_name/<title>/h1 usable for breadcrumb` };
  }

  // ── guard: exactly one site-chrome <nav> (bare, or with aria-label only) —
  // a class'd <nav class="…"> is in-body content (e.g. a table-of-contents
  // <nav class="toc-hero">), never touched here. Skipped in footer-only mode
  // (the nav is not this mode's concern and must stay byte-identical). ──
  const bareNavOpens = (html.match(/<nav(?![^>]*\bclass=)[^>]*>/g) || []).length;
  if (!footerOnly && bareNavOpens !== 1) {
    return { status: 'skipped', file: filename, reason: `bare <nav> count (${bareNavOpens}) — expected exactly 1 site-chrome nav` };
  }

  // ── REPLACE the site-chrome <nav>…</nav> only (no class= attribute) ──
  if (!footerOnly) {
    html = html.replace(/<nav(?![^>]*\bclass=)[^>]*>[\s\S]*?<\/nav>/, buildNav(breadcrumb));
  }

  // ── handle footer: 1 footer → replace; N footers (all chrome) → collapse → insert ──
  const ftrOpens  = (html.match(/<footer[^>]*>/g) || []).length;
  const ftrCloses = (html.match(/<\/footer>/g) || []).length;

  if (ftrOpens !== ftrCloses) {
    return { status: 'skipped', file: filename, reason: `footer count asymmetric (${ftrOpens}/${ftrCloses})` };
  }

  // ── GUARD (K4): a <footer> inside a <script> span is template-literal text,
  // not page chrome. Editing it rewrites JS source (measured: art-139's print
  // template grew 77663→77944 bytes, exit 0). Refuse the page outright. ──
  const inScriptFooters = footersInsideScript(html);
  if (inScriptFooters.length > 0) {
    const reason = inScriptFooters.length === ftrOpens
      ? FOOTER_IN_SCRIPT
      : `${FOOTER_IN_SCRIPT} (mixed: ${inScriptFooters.length} of ${ftrOpens} footers inside <script>)`;
    return { status: 'skipped', file: filename, reason };
  }

  if (ftrOpens === 1) {
    // Standard single-footer replacement
    html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/, FOOTER);
  } else if (ftrOpens > 1) {
    // Multiple footers: safe to collapse only if every block is chrome-type
    const blocks = [...html.matchAll(/<footer[^>]*>[\s\S]*?<\/footer>/g)].map(m => m[0]);
    const allChrome = blocks.every(b => CHROME_FOOTER_SIGNAL.test(b));
    if (!allChrome) {
      return { status: 'skipped', file: filename, reason: `footer count (${ftrOpens}/${ftrCloses}) — non-chrome footer detected, scope fence` };
    }
    // Strip all footer blocks, then insert canonical before </body>
    html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/g, '');
    if (!html.includes('</body>')) {
      return { status: 'skipped', file: filename, reason: 'no </body> after footer collapse' };
    }
    html = html.replace('</body>', `\n${FOOTER}\n</body>`);
  } else {
    // Zero footers — insert before </body>
    if (!html.includes('</body>')) {
      return { status: 'skipped', file: filename, reason: 'no footer and no </body>' };
    }
    html = html.replace('</body>', `\n${FOOTER}\n</body>`);
  }

  // ── inject / refresh CSS (skipped entirely in footer-only mode) ──
  // Use </head> injection (new <style> block) to avoid hitting </style> tags inside
  // document.write() calls within <script> blocks (which lastIndexOf would find last).
  if (!footerOnly) {
    if (!html.includes(CSS_MARKER)) {
      const headClose = html.indexOf('</head>');
      if (headClose === -1) {
        return { status: 'skipped', file: filename, reason: 'no </head> tag found' };
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
        return { status: 'skipped', file: filename, reason: 'CSS_MARKER present but no following </style> found' };
      }
      // ── GUARD (K3): the span may hold PAGE css after the chrome block
      // (measured: art-593's base stylesheet was destroyed this way —
      // css-after-marker 9565→2712 chars, `:root{` 1→0, exit 0). Parse the
      // span's selectors; anything not in CHROME_CSS means the rewrite would
      // delete page CSS → refuse. ──
      const spanSels   = extractSelectors(html.slice(markerIdx, styleCloseIdx));
      const chromeSels = new Set(extractSelectors(CHROME_CSS));
      const unknown    = spanSels.filter(s => !chromeSels.has(s));
      if (unknown.length > 0) {
        const shown = unknown.slice(0, 4).join(', ');
        return {
          status: 'skipped',
          file: filename,
          reason: `${PAGE_CSS_AFTER_MARKER} (${unknown.length} selector(s) not in CHROME_CSS: ${shown}${unknown.length > 4 ? ', …' : ''})`,
        };
      }
      const freshBlock = CHROME_CSS.slice(CHROME_CSS.indexOf(CSS_MARKER));
      html = html.slice(0, markerIdx) + freshBlock + '\n' + html.slice(styleCloseIdx);
    }
  }

  // ── post-transform sanity: counts must still be (1,1) ──
  const navAfter = (html.match(/<nav(?![^>]*\bclass=)[^>]*>/g) || []).length;
  const ftrAfter = (html.match(/<footer[^>]*>/g) || []).length;
  if ((navAfter !== 1 && !footerOnly) || ftrAfter !== 1) {
    // Should never happen, but guard anyway
    return { status: 'skipped', file: filename, reason: `post-transform count error nav=${navAfter} footer=${ftrAfter}` };
  }

  if (html === original) return { status: 'unchanged', file: filename }; // already canonical

  const regions = {
    nav:    !footerOnly && navRegion(original) !== navRegion(html),
    footer: footerRegion(original) !== footerRegion(html),
    css:    !footerOnly && cssRegion(original) !== cssRegion(html),
  };

  if (apply) {
    writeFileSync(path, html, 'utf-8');
  }
  return { status: 'changed', file: filename, breadcrumb, regions, wrote: !!apply };
}

/**
 * Programmatic entry (used by normalize-node-chrome.test.mjs):
 *   dir        — target chaingraph directory (contains *.html + chaingraph.json)
 *   targets    — explicit filename list, or null to scan `dir` (EXEMPT-filtered)
 *   apply      — write changed pages (default false = dry-run)
 *   footerOnly — touch only the footer region
 *   skipArt    — exclude true art-NN-*.html filenames from the auto-scan
 * Named `targets` always pass the EXEMPT filter (K11): an exempt name lands in
 * `skipped` with the EXEMPT reason and is never processed.
 */
export function normalizeChrome({ dir = CG, targets = null, apply = false, footerOnly = false, skipArt = false } = {}) {
  const skipped = [];
  let list;
  if (targets !== null) {
    list = [];
    for (const f of targets) {
      if (EXEMPT.has(f)) {
        skipped.push({ file: f, reason: `EXEMPT (this normalizer is barred from the page): ${EXEMPT.get(f)}` });
      } else {
        list.push(f);
      }
    }
  } else {
    list = readdirSync(dir)
      .filter(f => /\.html$/.test(f))
      .filter(f => !EXEMPT.has(f))
      .filter(f => !(skipArt && /^art-\d+/.test(f)))
      .sort();
  }

  const changed = [];
  const unchanged = [];
  const opts = { dir, apply, footerOnly };
  for (const f of list) {
    try {
      const r = processFile(f, opts);
      if (r.status === 'changed') changed.push(r);
      else if (r.status === 'unchanged') unchanged.push(r);
      else skipped.push({ file: r.file, reason: r.reason });
    } catch (e) {
      skipped.push({ file: f, reason: `exception: ${e.message}` });
    }
  }
  return { targets: list, changed, unchanged, skipped, apply: !!apply, footerOnly: !!footerOnly };
}

/* ─── CLI run (no side effects on import) ─── */

function main() {
  const targets = SAMPLE_MODE ? sampleFiles : (ONLY_MODE ? onlyFiles : null);
  const result = normalizeChrome({
    dir: CG_DIR,
    targets,
    apply: APPLY_MODE && !SAMPLE_MODE,
    footerOnly: FOOTER_ONLY_MODE,
    skipArt: SKIP_ART_MODE,
  });
  const { changed, skipped } = result;
  const wrote = APPLY_MODE && !SAMPLE_MODE;

  console.log('\n=== normalize-node-chrome ===');
  if (SAMPLE_MODE) {
    console.log('Mode: SAMPLE (dry-run, no files written)');
  } else if (APPLY_MODE && ONLY_MODE) {
    console.log(`Mode: APPLY --only (${result.targets.length} named page(s) written)`);
  } else if (APPLY_MODE) {
    console.log('Mode: APPLY (all pages written)');
  } else {
    console.log('Mode: DRY-RUN (no files written)');
  }
  if (FOOTER_ONLY_MODE) console.log('Scope: FOOTER-ONLY (nav and CSS untouched)');
  if (DIR_OVERRIDE) console.log(`Target dir override: ${CG_DIR}`);

  console.log(`\nTarget pages : ${result.targets.length}`);
  console.log(`Would change : ${changed.length}`);
  console.log(`Skipped      : ${skipped.length}`);

  if (changed.length) {
    const label = wrote ? 'Written' : 'Would write / Sample';
    console.log(`\n${label}:`);
    changed.forEach(c => {
      const scope = ['nav', 'footer', 'css'].filter(k => c.regions[k]).join('+') || 'none';
      console.log(`  ✓ ${c.file}  breadcrumb="${c.breadcrumb}"  scope: ${scope}${c.wrote ? '' : ' (dry-run)'}`);
    });
  }

  if (skipped.length) {
    console.log('\nSkipped (manual follow-up):');
    skipped.forEach(s => console.log(`  SKIP ${s.file}: ${s.reason}`));
  }

  if (!wrote && changed.length > 0) {
    console.log('\nRun with --apply to write all changes.');
  }

  // Fail loud (plan v2 Phase 0 item 3): an --apply run that skipped pages exits 1.
  // --dry-run and --sample stay exit 0 but always print the skip list above.
  if (wrote && skipped.length > 0) {
    console.log(`\n--apply REFUSED: ${skipped.length} page(s) skipped (listed above) — exit 1. Nothing was written to skipped pages; inspect with --dry-run and fix by hand.`);
    process.exitCode = 1;
  }
}

const IS_CLI = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (IS_CLI) main();
