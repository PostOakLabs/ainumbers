#!/usr/bin/env node
// gen-helm-openclaw-snippets.mjs — HELM-OPENCLAW-PAGE-1.
//
// Fills the six HELMKIT marker regions in helm-openclaw.html from the committed
// vendor copy in data/helm-kit/ (pre-kit: authored verbatim from
// HELM-MAINTENANCE-BUILD-SPEC §3.1) plus, for the prompts region, the live
// mcp/showcase-prompts.json by id (render only the ids present; a prompt body
// is never hand-typed into the page).
//
// Marker shape (byte-exact pairs, one each):
//   <!--HELMKIT:openclaw-mcp-->…<!--/HELMKIT:openclaw-mcp-->
//   <!--HELMKIT:exec-allowlist-->…<!--/HELMKIT:exec-allowlist-->
//   <!--HELMKIT:cron-->…<!--/HELMKIT:cron-->
//   <!--HELMKIT:autoclaw-install-->…<!--/HELMKIT:autoclaw-install-->
//   <!--HELMKIT:trust-endpoints-->…<!--/HELMKIT:trust-endpoints-->
//   <!--HELMKIT:prompts-->…<!--/HELMKIT:prompts-->
//
// Modes:
//   node scripts/gen-helm-openclaw-snippets.mjs            write: splice + save when changed
//   node scripts/gen-helm-openclaw-snippets.mjs --check    compare only; exit 1 on drift
//
// TODO-KIT: while data/helm-kit/manifest.json carries "todoKit": true (pre-kit),
// each rendered region prints "ADVISORY: TODO-KIT <region>" — the content is
// still asserted byte-fresh against the vendor copy, only its PROVENANCE is
// pre-kit. When HELM-AGENT-KIT-1 lands, its PR replaces the vendor copy and the
// advisories disappear; the same command then asserts kit freshness for real.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PAGE_PATH = resolve(REPO, 'helm-openclaw.html');
const KIT = resolve(REPO, 'data', 'helm-kit');
const PROMPTS_PATH = resolve(REPO, 'mcp', 'showcase-prompts.json');

export const REGIONS = [
  'openclaw-mcp',
  'exec-allowlist',
  'cron',
  'autoclaw-install',
  'trust-endpoints',
  'prompts',
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loadJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

// Pretty JSON with the _source/_comment provenance keys stripped (the page
// shows the artifact a user pastes, the manifest carries the provenance).
function cleanJson(obj) {
  const { _source, _comment, ...rest } = obj;
  return JSON.stringify(rest, null, 2);
}

function jsonBlock(obj) {
  return `<pre><code>${esc(cleanJson(obj))}</code></pre>`;
}

const manifest = loadJson(resolve(KIT, 'manifest.json'));
const todoKit = Boolean(manifest.todoKit);

// ── Region renderers ────────────────────────────────────────────────────────

function renderOpenclawMcp() {
  const frag = loadJson(resolve(KIT, 'openclaw', 'mcp-servers.fragment.json'));
  const originNote = todoKit
    ? '<p>The <code>Origin</code> header line is required today: helmd&rsquo;s origin gate accepts a request only when it carries an exact matching <code>Origin</code> (or a same-origin fetch marker a non-browser client cannot send). The header is dropped automatically once the helm side accepts an absent Origin on <code>/mcp</code>.</p>'
    : '';
  return [
    '<p>Paste this block into <code>openclaw.json</code> (OpenClaw reads <code>mcp.servers</code>):</p>',
    jsonBlock(frag),
    originNote,
    '<p>The default <code>toolFilter</code> excludes <code>workflow.run</code> and <code>evidence.export</code>: your agent can check, verify, and read evidence, but a real run and an evidence export stay human decisions.</p>',
    '<p>Save the file, restart the gateway, and run the smoke test: <code>openclaw mcp probe helm</code>.</p>',
  ].join('\n');
}

function renderExecAllowlist() {
  const frag = loadJson(resolve(KIT, 'openclaw', 'exec-allowlist.fragment.json'));
  return [
    '<p>Allow your agent to run exactly these helmd commands, and nothing else:</p>',
    jsonBlock(frag),
  ].join('\n');
}

function renderCron() {
  const frag = loadJson(resolve(KIT, 'openclaw', 'cron.fragment.json'));
  return [
    '<p>A nightly recompute plus an hourly heartbeat, as OpenClaw automations:</p>',
    jsonBlock(frag),
  ].join('\n');
}

function renderAutoclawInstall() {
  const frag = loadJson(resolve(KIT, 'openclaw', 'autoclaw-install.fragment.json'));
  return [
    '<p>One command (or the UI path; AutoClaw cannot edit <code>openclaw.json</code>):</p>',
    `<pre><code>${esc(frag.command)}</code></pre>`,
    `<p>Then confirm it landed: <code>${esc(frag.verifyCommand)}</code></p>`,
    `<p>In the AutoClaw UI: ${esc(frag.uiPath)}.</p>`,
    `<p>The zip URL is <a href="${esc(frag.installZipUrl)}" rel="noopener">${esc(frag.installZipUrl)}</a>. It 404s until the helm agent kit lands; that is expected and tracked in the site&rsquo;s dead-link baseline.</p>`,
    `<!-- dead-link baseline row id: HELM-OPENCLAW-PAGE-1; remove the baseline line in the kit row's PR -->`,
  ].join('\n');
}

function renderTrustEndpoints() {
  const t = loadJson(resolve(KIT, 'TRUST-endpoints.json'));
  const rows = t.endpoints.map((e) => {
    const dis = e.disable
      ? `<td>${esc(e.disable)}</td>`
      : '<td>nothing to disable (no call is made)</td>';
    return [
      `<tr><td>${e.n}</td>`,
      `<td><code>${esc(e.endpoint)}</code></td>`,
      `<td>${esc(e.trigger)}</td>`,
      `<td>${esc(e.payload)}</td>`,
      dis,
      '</tr>',
    ].join('');
  });
  return [
    `<p>Every outbound call helmd can make, copied from the helm repo&rsquo;s <code>docs/TRUST.md</code> &sect;1 (vendor copy: <code>data/helm-kit/TRUST-endpoints.json</code>):</p>`,
    '<div class="tablewrap"><table>',
    '<thead><tr><th>#</th><th>Endpoint</th><th>When</th><th>Payload</th><th>Switch off</th></tr></thead>',
    `<tbody>${rows.join('')}</tbody>`,
    '</table></div>',
    '<p>No telemetry, analytics, or crash-reporting library exists in the helm repo. Exporting evidence needs a human consent ticket the agent cannot mint, and the export tier is unreachable from MCP <code>tools/call</code>.</p>',
  ].join('\n');
}

function renderPrompts() {
  const prompts = JSON.parse(readFileSync(PROMPTS_PATH, 'utf8'));
  const out = [];
  for (const id of manifest.promptIds) {
    const p = prompts.find((x) => x.id === id);
    if (!p) {
      out.push(`<!-- prompt ${esc(id)} not present in showcase-prompts.json yet: rendered only when the id exists -->`);
      continue;
    }
    out.push([
      '<div class="try-card">',
      `<div class="try-head"><span class="try-title">${esc(p.title)}</span>`,
      `<button class="try-copy" type="button" data-copy="prompt-${esc(id)}">Copy prompt</button></div>`,
      `<p class="try-one">${esc(p.one_line)}</p>`,
      `<p class="try-req">Prerequisites: doorways ${esc(p.doorways.join(', '))}; needs Helm (${esc(p.requires.join(', '))}); audience: ${esc(p.audience)}.</p>`,
      `<pre class="try-body" id="prompt-${esc(id)}">${esc(p.body)}</pre>`,
      '</div>',
    ].join('\n'));
  }
  return out.join('\n');
}

// ── Splice / compare ────────────────────────────────────────────────────────

export function renderRegion(id) {
  switch (id) {
    case 'openclaw-mcp': return renderOpenclawMcp();
    case 'exec-allowlist': return renderExecAllowlist();
    case 'cron': return renderCron();
    case 'autoclaw-install': return renderAutoclawInstall();
    case 'trust-endpoints': return renderTrustEndpoints();
    case 'prompts': return renderPrompts();
    default: throw new Error(`unknown region ${id}`);
  }
}

export function splice(html, id, content) {
  const open = `<!--HELMKIT:${id}-->`;
  const close = `<!--/HELMKIT:${id}-->`;
  const re = new RegExp(`${open.replace(/[-/]/g, (c) => `\\${c}`)}[\\s\\S]*?${close.replace(/[-/]/g, (c) => `\\${c}`)}`);
  if (!re.test(html)) throw new Error(`marker region ${id} not found (or open/close pair broken)`);
  return html.replace(re, `${open}\n${content}\n${close}`);
}

export function regionContent(html, id) {
  const open = `<!--HELMKIT:${id}-->`;
  const close = `<!--/HELMKIT:${id}-->`;
  const i = html.indexOf(open);
  const j = html.indexOf(close);
  if (i === -1 || j === -1 || j < i) return null;
  return html.slice(i + open.length, j).trim();
}

function main() {
  const CHECK = process.argv.includes('--check');
  const html = readFileSync(PAGE_PATH, 'utf8');
  let drifted = 0;
  const lines = [];
  for (const id of REGIONS) {
    const want = renderRegion(id);
    const have = regionContent(html, id);
    const same = have !== null && have.trim() === want.trim();
    if (todoKit) lines.push(`ADVISORY: TODO-KIT ${id} (source: ${manifest.source})`);
    if (same) {
      lines.push(`OK ${id}`);
    } else {
      drifted++;
      lines.push(`DRIFT ${id}${CHECK ? ' (run: node scripts/gen-helm-openclaw-snippets.mjs)' : ' (fixed)'}`);
    }
    if (!CHECK && !same) {
      // Write mode: splice region by region so one bad marker cannot eat the others.
    }
  }
  if (!CHECK) {
    let next = html;
    for (const id of REGIONS) {
      const want = renderRegion(id);
      const have = regionContent(next, id);
      if (have === null || have.trim() !== want.trim()) next = splice(next, id, want);
    }
    if (next !== html) {
      writeFileSync(PAGE_PATH, next);
      console.log('gen-helm-openclaw-snippets: page updated.');
    } else {
      console.log('gen-helm-openclaw-snippets: page already current.');
    }
  }
  console.log(lines.join('\n'));
  if (CHECK && drifted) {
    console.error(`gen-helm-openclaw-snippets --check: ${drifted} region(s) drifted from data/helm-kit/ — run node scripts/gen-helm-openclaw-snippets.mjs and commit.`);
    process.exit(1);
  }
  if (CHECK) console.log('gen-helm-openclaw-snippets --check: all six regions byte-fresh.');
}

if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  main();
}
