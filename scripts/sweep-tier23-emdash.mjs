#!/usr/bin/env node
/**
 * sweep-tier23-emdash.mjs — mechanical Tier-2/3 em-dash sweep for tools/ + guides/.
 *
 * Scope (COPY-SWEEP WU fence): tools/*.html + guides/*.html COPY only.
 * Never touches chaingraph.json, count sentinels, or generated index blocks.
 *
 * Substitution rules (CONTRACT §1.4 style: "em-dashes become colon/comma/period
 * by context"), applied outside <script>/<style> blocks only:
 *   1. " — " (space-em-dash-space)      -> ": "   (dominant explanatory-clause use)
 *   2. "word—word" (no surrounding space) -> "-"   (ranges/compounds, e.g. 2020—2026)
 *   3. any remaining "—"                  -> ", "  (rare stray cases)
 *
 * PII banner (CONTRACT §1.3, contains a mandated em-dash) is exempted verbatim.
 *
 * Usage: node scripts/sweep-tier23-emdash.mjs [--dirs=tools,guides] [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const dirsArg = process.argv.find(a => a.startsWith('--dirs='));
const DIRS = dirsArg ? dirsArg.slice('--dirs='.length).split(',') : ['tools', 'guides'];

const PII_BANNER = '🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.';
const PII_PLACEHOLDER = ' PII_BANNER ';

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) htmlFiles(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

function sweep(html) {
  let changed = 0;
  const withPlaceholder = html.split(PII_BANNER).join(PII_PLACEHOLDER);

  const protectedBlocks = [];
  const protectedText = withPlaceholder.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (m) => {
    protectedBlocks.push(m);
    return `BLOCK${protectedBlocks.length - 1}`;
  });

  let out = protectedText;
  out = out.replace(/ — /g, () => { changed++; return ': '; });
  out = out.replace(/(\S)—(\S)/g, (_, a, b) => { changed++; return `${a}-${b}`; });
  out = out.replace(/—/g, () => { changed++; return ', '; });

  out = out.replace(/BLOCK(\d+)/g, (_, i) => protectedBlocks[Number(i)]);
  out = out.split(PII_PLACEHOLDER).join(PII_BANNER);
  return { out, changed };
}

let totalFiles = 0, totalChanged = 0, filesChanged = 0;
for (const d of DIRS) {
  const dir = resolve(REPO, d);
  let files;
  try { files = htmlFiles(dir); } catch { continue; }
  for (const f of files) {
    totalFiles++;
    const html = readFileSync(f, 'utf8');
    const { out, changed } = sweep(html);
    if (changed) {
      totalChanged += changed;
      filesChanged++;
      if (!DRY) writeFileSync(f, out);
    }
  }
}
console.log(`sweep-tier23-emdash: ${DRY ? '[dry-run] ' : ''}${filesChanged}/${totalFiles} file(s) touched, ${totalChanged} em-dash(es) replaced across ${DIRS.join(', ')}.`);
