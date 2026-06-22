#!/usr/bin/env node
/**
 * scripts/sync-stats.mjs — stat drift gate
 *
 * Counts actual DOM elements in key pages and compares them to the static
 * fallback numbers embedded in the HTML. Exits 1 on any mismatch (check mode)
 * or patches the HTML files in place (--fix mode).
 *
 * Usage:
 *   node scripts/sync-stats.mjs          # check — exits 1 if any stat drifted
 *   node scripts/sync-stats.mjs --fix    # patch static fallbacks to match DOM
 *
 * Add to Wave Completion Checklist (CLAUDE.md step 7) after regen_sitemap.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const fix = process.argv.includes('--fix');

const read  = rel => readFileSync(resolve(root, rel), 'utf8');
const write = (rel, txt) => writeFileSync(resolve(root, rel), txt, 'utf8');

// ── counters ──────────────────────────────────────────────────────────────────

function countWorkflowRows(html) {
  // Extract the workflows section (between id="workflows" and its closing </table>).
  const start = html.indexOf('id="workflows"');
  const end   = html.indexOf('</table>', start);
  if (start === -1 || end === -1) throw new Error('mcp.html: workflows table not found');
  const section = html.slice(start, end);
  // Data rows open with <tr><td> — group headers use <tr class=, thead uses <tr><th>
  return (section.match(/<tr><td>/g) || []).length;
}

function countCardNames(html) {
  return (html.match(/class="card-name"/g) || []).length;
}

// ── patch helpers ─────────────────────────────────────────────────────────────

function getById(html, id) {
  const m = html.match(new RegExp(`id="${id}"[^>]*>(\\d+)<`));
  return m ? parseInt(m[1], 10) : null;
}

function setById(html, id, n) {
  return html.replace(new RegExp(`(id="${id}"[^>]*>)\\d+(<)`), `$1${n}$2`);
}

// ── check/patch one file ──────────────────────────────────────────────────────

function checkFile(relPath, checks) {
  let html = read(relPath);
  let fileDrifted = 0;

  for (const { id, actual, label } of checks) {
    const stated = getById(html, id);
    if (stated === null) {
      console.error(`MISSING  ${relPath}  id="${id}" not found — runtime JS may not be wired up`);
      fileDrifted++;
      continue;
    }
    if (stated !== actual) {
      console.log(`DRIFT    ${relPath}  ${label}: static=${stated}  actual=${actual}`);
      fileDrifted++;
      if (fix) html = setById(html, id, actual);
    } else {
      console.log(`OK       ${relPath}  ${label}: ${actual}`);
    }
  }

  if (fix && fileDrifted > 0) {
    write(relPath, html);
    console.log(`WROTE    ${relPath}`);
  }

  return fileDrifted;
}

// ── main ──────────────────────────────────────────────────────────────────────

let drifted = 0;

// mcp.html — workflow recipe count
const mcpHtml  = read('mcp.html');
const wfCount  = countWorkflowRows(mcpHtml);
drifted += checkFile('mcp.html', [
  { id: 'wf-count-n',     actual: wfCount, label: 'workflow recipes (hero stat)'      },
  { id: 'wf-count-head',  actual: wfCount, label: 'workflow recipes (section heading)' },
  { id: 'wf-count-prose', actual: wfCount, label: 'workflow recipes (prose)'           },
]);

// chaingraph/chaingraph-hub.html — OCG tool count
const hubHtml   = read('chaingraph/chaingraph-hub.html');
const toolCount = countCardNames(hubHtml);
drifted += checkFile('chaingraph/chaingraph-hub.html', [
  { id: 'hub-total-n',   actual: toolCount, label: 'tools shipped (hero stat)'  },
  { id: 'hub-mcp-n',     actual: toolCount, label: 'tools MCP-exposed (hero)'   },
  { id: 'hub-eyebrow-n', actual: toolCount, label: 'tools live (hero eyebrow)'  },
]);

// ── result ────────────────────────────────────────────────────────────────────

if (drifted === 0) {
  console.log('\nAll stats in sync.');
  process.exit(0);
} else if (fix) {
  console.log(`\nPatched ${drifted} stat(s).`);
  process.exit(0);
} else {
  console.log(`\n${drifted} stat(s) drifted. Run with --fix to patch.`);
  process.exit(1);
}
