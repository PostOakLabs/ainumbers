#!/usr/bin/env node
/**
 * scripts/gen-page-md-twins.mjs — PAGE-MD-TWINS-1 (AGENT-REACH-BUILD-SPEC §2 wave 2)
 *
 * For every GENERATED node page and chain page, emit the token-cheap markdown
 * twin `<same path>.md`: title, description, typed inputs, typed outputs
 * (output_schema), the declared sample (fixture vector 0), the verify step, the
 * page URL, and the WebMCP tool name when registered.
 *
 * ⛔ NEVER scraped from HTML. Every byte below is derived from the SSOT set:
 *   chaingraph/chaingraph.json (live nodes + chains)
 *   manifests/<tool_id>.manifest.json (inputSchema / output_schema)
 *   chaingraph/kernels/fixtures/<tool_id>.fixtures.json (vector 0 sample)
 *
 * Also stamps each twin's page head with the canonical
 * <link rel="alternate" type="text/markdown" href="…"> (template exported from
 * chaingraph/_page-chrome.mjs, the shared chrome — single link-tag source).
 *
 * Derived-artifact posture: COVERED entry id 'page-md-twins' in
 * scripts/derived-artifacts.mjs — SO #35 single-writer; derived-artifacts-regen.yml
 * owns the writes on main, PRs must not commit twins or head-link edits.
 *
 * Copy posture: reader-facing prose rules (CONTRACT §1.4) — em-dashes are
 * humanized to " - " (same transform gen-llms-full.mjs uses) and the boilerplate
 * below is written to pass check-copy-hallmarks (no AI-tell phrasing, no absolutes).
 *
 * Usage:
 *   node scripts/gen-page-md-twins.mjs          # write twins + head links
 *   node scripts/gen-page-md-twins.mjs --check  # freshness gate (exit 1 if stale)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMarkdownAlternateLink, MD_TWIN_LINK_REL } from '../chaingraph/_page-chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const CHECK = process.argv.includes('--check');

/** The one prose transform (same semantics as gen-llms-full.mjs's humanize): */
function humanize(s) {
  if (!s) return '';
  return String(s)
    .replace(/—/g, ' - ')
    .replace(/&mdash;/gi, ' - ')
    .replace(/ -- /g, ' - ')
    .replace(/&amp;/g, '&')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function pageRelFromUrl(url) {
  const p = decodeURIComponent(new URL(url).pathname).replace(/^\//, '');
  if (!p || !p.endsWith('.html')) throw new Error(`unexpected page URL: ${url}`);
  return p;
}

/**
 * Twins cover the generated node/chain page trees only (tools/ + chaingraph/).
 * A live node whose URL is a root-level hub surface (e.g. the MCP server card
 * mcp.html) is a hand-authored hub page, not a generated page — skipped, and
 * counted as such in the run summary.
 */
function isTwinScope(pageRel) {
  return pageRel.startsWith('tools/') || pageRel.startsWith('chaingraph/');
}

function relToAbs(rel) { return resolve(REPO, rel); }

function typeLabel(schemaType) {
  return schemaType || 'any';
}

/**
 * Pure collector: every twin target. Exported so gen-llms-full.mjs lists the
 * twin paths from the SAME walk (one source, no second enumeration to drift).
 * Returns [{ kind:'node'|'chain', pageRel, twinRel, pageUrl, title, ... }].
 */
export function collectTwinTargets(repo) {
  const cg = JSON.parse(readFileSync(resolve(repo, 'chaingraph', 'chaingraph.json'), 'utf8'));
  const targets = [];

  for (const n of cg.nodes ?? []) {
    if (n.status !== 'live') continue;
    const pageRel = pageRelFromUrl(n.url);
    if (!isTwinScope(pageRel)) continue;
    if (!existsRaw(resolve(repo, pageRel))) continue;
    const twinRel = pageRel.replace(/\.html$/, '.md');
    const rec = {
      kind: 'node',
      toolId: n.tool_id,
      pageRel,
      twinRel,
      pageUrl: n.url,
      twinUrl: n.url.replace(/\.html$/, '.md'),
      title: humanize(n.display_name || n.tool_id),
      description: humanize(n.description || ''),
      mcpName: n.mcp_name || null,
      inputs: null,
      outputs: null,
      sample: null,
    };
    const manifestPath = resolve(repo, 'manifests', `${n.tool_id}.manifest.json`);
    try {
      const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const ins = m?.mcp_tool_definition?.inputSchema;
      if (ins && ins.properties) {
        const required = new Set(ins.required ?? []);
        rec.inputs = Object.entries(ins.properties).map(([name, p]) => ({
          name,
          type: typeLabel(p?.type),
          required: required.has(name),
          description: humanize(p?.description || ''),
        }));
      }
      const outs = m?.output_schema;
      if (outs && outs.properties) {
        const required = new Set(outs.required ?? []);
        rec.outputs = Object.entries(outs.properties).map(([name, p]) => ({
          name,
          type: typeLabel(p?.type),
          required: required.has(name),
        }));
      }
    } catch { /* no manifest for this node — graph-only twin */ }
    const fixturesPath = resolve(repo, 'chaingraph', 'kernels', 'fixtures', `${n.tool_id}.fixtures.json`);
    try {
      const f = JSON.parse(readFileSync(fixturesPath, 'utf8'));
      const v = (f.vectors ?? [])[0];
      if (v && v.policy_parameters) rec.sample = v.policy_parameters;
    } catch { /* no fixture — sample omitted */ }
    targets.push(rec);
  }

  const chainsByPage = new Map();
  for (const c of cg.chains ?? []) {
    const pageRel = pageRelFromUrl(c.composer_url);
    if (!existsRaw(resolve(repo, pageRel))) continue;
    const rec = {
      chainId: c.name,
      title: humanize(c.title || c.name),
      description: humanize(c.description || ''),
      domain: humanize(c.domain || ''),
      steps: (c.steps ?? []).map((s) => ({
        toolId: s.tool_id,
        handoff: humanize(s.handoff || ''),
      })),
    };
    if (!chainsByPage.has(pageRel)) chainsByPage.set(pageRel, []);
    chainsByPage.get(pageRel).push(rec);
  }

  // A composer_url can resolve to a NODE page (single-node chains reuse it) or
  // to a page two chains share. Two twins on one path would overwrite each
  // other every run, so every chain is MERGED onto its page's twin: under a
  // node twin as a "## Workflow chain" section, or inside one composite
  // chain twin when the page has no node of its own.
  for (const [pageRel, chainRecs] of chainsByPage) {
    const first = chainRecs[0];
    const host = targets.find((t) => t.pageRel === pageRel);
    if (host) { host.chains = chainRecs; continue; }
    const composerUrl = new URL(decodeURIComponent(pageRel), 'https://ainumbers.co/').href;
    targets.push({
      kind: 'chain',
      pageRel,
      twinRel: pageRel.replace(/\.html$/, '.md'),
      pageUrl: composerUrl,
      twinUrl: composerUrl.replace(/\.html$/, '.md'),
      title: first.title,
      description: first.description,
      chains: chainRecs,
    });
  }

  targets.sort((a, b) => a.twinRel.localeCompare(b.twinRel));
  return targets;
}

/** Live nodes whose page sits outside the twin scope, with the reason. */
export function outOfScopeNodes(repo) {
  const cg = JSON.parse(readFileSync(resolve(repo, 'chaingraph', 'chaingraph.json'), 'utf8'));
  const out = [];
  for (const n of cg.nodes ?? []) {
    if (n.status !== 'live') continue;
    const pageRel = pageRelFromUrl(n.url);
    if (!isTwinScope(pageRel)) out.push({ toolId: n.tool_id, pageRel, url: n.url });
  }
  return out;
}

// tiny existsSync wrapper (imported lazily so the top import list stays honest)
import { existsSync as existsRaw } from 'node:fs';

/** Render the twin markdown for one target. PURE: same input, same bytes. */
export function renderTwinMd(t) {
  const L = [];
  L.push(`# ${t.title}`);
  L.push('');
  if (t.description) { L.push(t.description); L.push(''); }
  L.push(`- Page: ${t.pageUrl}`);
  L.push(`- Markdown twin: ${t.twinUrl}`);
  if (t.kind === 'node') {
    if (t.mcpName) L.push(`- MCP tool: ${t.mcpName} (endpoint https://mcp.ainumbers.co/mcp)`);
    if (t.inputs?.length) {
      L.push('');
      L.push('## Inputs');
      L.push('');
      for (const i of t.inputs) {
        const req = i.required ? 'required' : 'optional';
        const d = i.description ? `: ${i.description}` : '';
        L.push(`- ${i.name} (${i.type}, ${req})${d}`);
      }
    }
    if (t.outputs?.length) {
      L.push('');
      L.push('## Outputs');
      L.push('');
      for (const o of t.outputs) {
        const req = o.required ? 'required' : 'optional';
        L.push(`- ${o.name} (${o.type}, ${req})`);
      }
    }
    if (t.sample) {
      L.push('');
      L.push('## Sample');
      L.push('');
      L.push('```json');
      L.push(JSON.stringify(t.sample, null, 2));
      L.push('```');
    }
    L.push('');
    L.push('## Verify');
    L.push('');
    if (t.mcpName) {
      L.push(`Run the sample policy_parameters through MCP tool \`${t.mcpName}\` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.`);
    } else {
      L.push('Use synthetic inputs only; never send real personal data. Any published receipt can be checked against the ledger at https://ledger.ainumbers.co/.');
    }
  }
  for (const c of t.chains ?? []) {
    L.push('');
    L.push(`## Workflow chain: ${c.title}`);
    L.push('');
    if (c.description) { L.push(c.description); L.push(''); }
    if (c.domain) L.push(`Domain: ${c.domain}`);
    L.push('');
    L.push('### Steps');
    L.push('');
    c.steps.forEach((s, idx) => {
      L.push(`${idx + 1}. ${s.toolId}`);
      if (s.handoff) L.push(`   ${s.handoff}`);
    });
    L.push('');
    L.push('### Chain verify');
    L.push('');
    L.push('Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt\'s execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.');
  }
  return L.join('\n') + '\n';
}

/** Insert or refresh the canonical alternate link in one page's <head>. PURE. */
export function withAlternateLink(html, pageUrl) {
  const want = buildMarkdownAlternateLink(pageUrl);
  const lines = html.split('\n');
  const idx = lines.findIndex((l) => l.includes(MD_TWIN_LINK_REL));
  if (idx !== -1) {
    if (lines[idx].trim() === want) return null; // already exact — no write
    lines[idx] = want;
    return lines.join('\n');
  }
  const canon = lines.findIndex((l) => /<link rel="canonical"/.test(l));
  if (canon !== -1) { lines.splice(canon + 1, 0, want); return lines.join('\n'); }
  const desc = lines.findIndex((l) => /<meta name="description"/.test(l));
  if (desc === -1) throw new Error(`no canonical or description line in head for ${pageUrl}`);
  lines.splice(desc + 1, 0, want);
  return lines.join('\n');
}

function main() {
  const targets = collectTwinTargets(REPO);
  const summary = { twins: 0, twinsWritten: 0, heads: 0, headsWritten: 0, skipped: 0 };
  const reds = [];

  for (const t of targets) {
    const twinAbs = relToAbs(t.twinRel);
    const pageAbs = relToAbs(t.pageRel);
    let pageHtml;
    try { pageHtml = readFileSync(pageAbs, 'utf8'); } catch {
      reds.push(`page missing on disk: ${t.pageRel}`);
      continue;
    }
    const md = renderTwinMd(t);
    if (CHECK) {
      let current = '';
      try { current = readFileSync(twinAbs, 'utf8'); } catch { /* absent */ }
      if (current !== md) reds.push(`twin stale/absent: ${t.twinRel}`);
      const patched = withAlternateLink(pageHtml, t.pageUrl);
      if (patched !== null) reds.push(`head link missing/drifted: ${t.pageRel}`);
      summary.twins++; summary.heads++;
      continue;
    }
    if (writeIfChanged(twinAbs, md)) summary.twinsWritten++;
    summary.twins++;
    const patched = withAlternateLink(pageHtml, t.pageUrl);
    if (patched !== null) { writeIfChanged(pageAbs, patched); summary.headsWritten++; }
    summary.heads++;
  }

  if (reds.length) {
    console.error(`gen-page-md-twins --check FAIL (${reds.length} finding(s)) — run: node scripts/gen-page-md-twins.mjs`);
    for (const r of reds.slice(0, 20)) console.error(`  ${r}`);
    if (reds.length > 20) console.error(`  … and ${reds.length - 20} more`);
    process.exit(1);
  }
  const mode = CHECK ? '--check: fresh' : 'written';
  const oos = outOfScopeNodes(REPO).map((n) => `${n.toolId} (${n.pageRel})`).join(', ');
  const oosNote = oos ? `; out of scope: ${oos} (root-level hub page, not a generated node page)` : '';
  console.log(`gen-page-md-twins ${mode}: ${summary.twins} twins (${targets.filter((t) => t.kind === 'node').length} node pages, ${targets.filter((t) => t.kind === 'chain').length} chain pages), ${summary.heads} head links${CHECK ? '' : ` (${summary.twinsWritten} twin writes, ${summary.headsWritten} head writes)`}${oosNote}.`);
}

function writeIfChanged(absPath, next) {
  let current = '';
  try { current = readFileSync(absPath, 'utf8'); } catch { /* new file */ }
  if (current === next) return false;
  writeFileSync(absPath, next, 'utf8');
  return true;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
