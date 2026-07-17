#!/usr/bin/env node
/**
 * scripts/gen-llms-full.mjs — MCP-500-2 §M2.3
 *
 * Generates llms-full.txt: the expanded companion to llms.txt — a full tool + workflow
 * inventory, one line each, entirely generator-sourced from chaingraph.json + manifests/*
 * (never hand-typed — mirrors the §A5.3 doctrine already used for llms.txt's count sentinels,
 * gen-chain-index.mjs, and gen-estate-map.mjs). Copy-humanized inline: em-dashes normalized to
 * " - ", "chain" -> "workflow" in the generated prose (the underlying chaingraph.json `chains[]`
 * key name is a code identifier, untouched).
 *
 * Usage:
 *   node scripts/gen-llms-full.mjs          # write llms-full.txt
 *   node scripts/gen-llms-full.mjs --check  # freshness gate (exit 1 if stale)
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveCounts } from './counts.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const OUT_PATH = resolve(REPO, 'llms-full.txt');

function humanize(s) {
  if (!s) return '';
  return String(s)
    .replace(/—/g, ' - ')
    .replace(/\bWave\s+\d+\b/gi, '')
    .replace(/\bnamed chain\b/gi, 'workflow')
    .replace(/\bchains\b/gi, 'workflows')
    .replace(/\bchain\b/gi, 'workflow')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function truncate(s, n) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}

function extractTitle(html, fallback) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!m) return fallback;
  return m[1].split('|')[0].trim();
}

function extractDesc(html) {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m ? m[1].trim() : '';
}

function collectGuides(repo) {
  return readdirSync(resolve(repo, 'guides'))
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => {
      const html = readFileSync(resolve(repo, 'guides', f), 'utf8');
      const name = f.replace(/\.html$/, '');
      return { name, title: extractTitle(html, name), desc: humanize(truncate(extractDesc(html), 160)) };
    });
}

function renderBody() {
  const counts = deriveCounts();
  const chaingraph = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
  const liveNodes = (chaingraph.nodes ?? []).filter((n) => n.status === 'live');
  const chains = chaingraph.chains ?? [];

  const manifestFiles = readdirSync(resolve(REPO, 'manifests'))
    .filter((f) => f.endsWith('.manifest.json') && !f.includes('DELETE'))
    .sort();
  const browserTools = [];
  for (const file of manifestFiles) {
    let m;
    try { m = JSON.parse(readFileSync(resolve(REPO, 'manifests', file), 'utf8')); } catch { continue; }
    const name = m?.mcp_tool_definition?.name || m?.tool_id;
    const title = m?.title || m?.tool_id;
    const desc = humanize(truncate(m?.description || m?.mcp_tool_definition?.description || '', 160));
    if (name) browserTools.push({ name, title, desc });
  }

  const workflowNodes = liveNodes
    .filter((n) => n.mcp_name)
    .map((n) => ({ name: n.mcp_name, title: n.display_name || n.mcp_name, desc: humanize(truncate(n.description || '', 160)) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const guides = collectGuides(REPO);

  const lines = [];
  lines.push('# AINumbers.co - Full Tool & Workflow Inventory (llms-full.txt)');
  lines.push('');
  lines.push('Expanded companion to llms.txt: one line per registered browser tool and per named');
  lines.push('workflow, generator-sourced from chaingraph.json + manifests/ (never hand-typed).');
  lines.push(`Generated from ${counts.manifests} manifests, ${counts['mcp.live']} live MCP tools, ${counts.chains} workflows, ${guides.length} guides.`);
  lines.push('MCP server: https://mcp.ainumbers.co/mcp (use find_tool / find_chain to discover by task).');
  lines.push('');
  lines.push('## Browser tools (' + browserTools.length + ')');
  lines.push('');
  for (const t of browserTools) lines.push(`- ${t.name} :: ${t.title} - ${t.desc}`);
  lines.push('');
  lines.push('## Workflows (' + chains.length + ')');
  lines.push('');
  for (const c of chains) {
    const desc = humanize(truncate(c.description || '', 160));
    lines.push(`- ${c.name} :: ${humanize(c.title || c.name)} - ${desc}`);
  }
  lines.push('');
  lines.push('## Live MCP tool names (' + workflowNodes.length + ')');
  lines.push('');
  for (const n of workflowNodes) lines.push(`- ${n.name} :: ${n.title} - ${n.desc}`);
  lines.push('');
  lines.push('## Guides (' + guides.length + ')');
  lines.push('');
  for (const g of guides) lines.push(`- guides/${g.name}.html :: ${g.title} - ${g.desc}`);
  lines.push('');
  return lines.join('\n') + '\n';
}

function main() {
  const check = process.argv.includes('--check');
  const next = renderBody();
  if (check) {
    let current = '';
    try { current = readFileSync(OUT_PATH, 'utf8'); } catch { /* not written yet */ }
    if (current !== next) {
      console.error('gen-llms-full --check: llms-full.txt is stale. Run `node scripts/gen-llms-full.mjs`.');
      process.exit(1);
    }
    console.log('gen-llms-full --check: llms-full.txt is fresh.');
    return;
  }
  writeFileSync(OUT_PATH, next);
  console.log('gen-llms-full: llms-full.txt regenerated (' + next.split('\n').length + ' lines).');
}

main();
