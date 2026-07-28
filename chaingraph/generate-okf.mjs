#!/usr/bin/env node
/**
 * generate-okf.mjs — OpenChainGraph v0.3 OKF companion-bundle generator.
 *
 * Reads chaingraph.json (the DCAT Graph Index) and emits an Open Knowledge
 * Format (OKF v0.2) bundle under ./okf/ — one markdown "concept" per live
 * node, with YAML frontmatter and markdown links mirroring the consumes/feeds
 * edges. Wired into `scripts/preflight.mjs` + CI via `--check` (same freshness-gate
 * pattern as gen-chain-index.mjs / gen-llms-full.mjs) so the bundle never drifts.
 *
 * v0.2 migration (OKFV2-1): adds `generated:{by,at}` and `status: stable`
 * alongside the legacy `timestamp` (kept — v0.1 consumers still read it), and
 * `sources:` per tool concept (shard + public page). Deliberately omits
 * `stale_after` (a date promise nobody owns) and `verified:` (no verification
 * event occurs here — that's a checker's job, not a generator's).
 *
 * OKF concepts are KNOWLEDGE, never decision artifacts: they carry NO
 * execution_hash and NO audit_signature. Nothing in OpenChainGraph's
 * verification path depends on this bundle — it is a discovery surface only.
 *
 * The frontmatter `timestamp` is derived from chaingraph.json's own `updated`
 * date field, NOT wall-clock time — a wall-clock timestamp would make every
 * `--check` run report stale regardless of content, since it differs on every
 * invocation even when nothing changed.
 *
 * Usage:
 *   node generate-okf.mjs          # write ./okf/{index.md, log.md, tools/*.md, mandate-types/*.md}
 *   node generate-okf.mjs --check  # freshness gate (exit 1 if okf/ doesn't match chaingraph.json)
 *
 * Zero dependencies (Node 18+ ESM).
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(HERE, 'chaingraph.json');
const OUT = resolve(HERE, 'okf');
const CHECK = process.argv.includes('--check');

const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
const live = idx.nodes.filter((n) => n.status === 'live');
const byId = new Map(live.map((n) => [n.tool_id, n]));
const now = idx.updated ?? new Date().toISOString().slice(0, 10);
// files: relative-path (posix, from OUT) -> content. Built up-front so --check
// can diff against disk without ever touching the filesystem.
const files = new Map();
const write = (relPath, content) => files.set(relPath, content);

// --- helpers -------------------------------------------------------------
const fileFor = (id) => `${id}.md`;
const title = (id) => byId.get(id)?.display_name ?? id;
// link from a /tools/ concept to a sibling concept (or to the index for "ALL")
const toolLink = (id) =>
  id === 'ALL'
    ? '[every tool in the suite](./index.md)'
    : byId.has(id)
      ? `[${title(id)}](./${fileFor(id)})`
      : `\`${id}\` _(not live)_`;

const yamlList = (arr) => `[${arr.map((s) => JSON.stringify(s)).join(', ')}]`;
// v0.2 §5.2/§5.4 trust+lifecycle lines, shared by every generated concept.
const genLine = () => `generated: { by: "ainumbers/generate-okf", at: ${JSON.stringify(now)} }`;

// v0.2 §5.1 sources: resolvable shard (DCAT record) + public page, per tool concept.
const SHARD_BASE = 'https://ainumbers.co/chaingraph/graph/nodes';
function sourcesBlock(n) {
  const entries = [
    { resource: `${SHARD_BASE}/${n.tool_id}.json`, title: 'chaingraph.json shard entry' },
    { resource: n.url, title: 'public tool page' },
  ];
  const lines = ['sources:'];
  for (const e of entries) {
    lines.push(`  - resource: ${e.resource}`);
    lines.push(`    title: ${JSON.stringify(e.title)}`);
  }
  return lines.join('\n');
}

function frontmatter(n) {
  const tags = [n.mandate_type, `wave-${n.wave}`, `mcp:${n.mcp_name}`];
  if (n.semantic_profile) tags.push(n.semantic_profile);
  return [
    '---',
    'type: DecisionTool',
    `title: ${JSON.stringify(n.display_name)}`,
    `description: ${JSON.stringify(n.description ?? '')}`,
    `resource: ${n.url}`,
    `tags: ${yamlList(tags)}`,
    `timestamp: ${now}`,
    genLine(),
    'status: stable',
    sourcesBlock(n),
    '---',
  ].join('\n');
}

function conceptBody(n) {
  const consumes = (n.consumes ?? []);
  const feeds = (n.feeds ?? []);
  const lines = [];
  lines.push(`# ${n.display_name}`, '');
  lines.push(`> Exports a decision via MCP \`${n.mcp_name}\` — mandate type \`${n.mandate_type}\`.`, '');
  if (n.deadline) lines.push(`**Deadline:** ${n.deadline}${n.deadline_note ? ` — ${n.deadline_note}` : ''}`, '');
  else if (n.deadline_note) lines.push(`**Context:** ${n.deadline_note}`, '');
  if (n.semantic_profile) {
    // v0.3.1: surface the resolvable profile URI (dct:conformsTo) the token aliases to.
    const PROFILE_URIS = {
      'iso20022:pacs.008-subset': 'https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld',
      'iso20022:party-identification': 'https://ainumbers.co/chaingraph/profiles/iso20022/party-identification.jsonld',
    };
    const uri = PROFILE_URIS[n.semantic_profile];
    lines.push(`**Semantic profile:** \`${n.semantic_profile}\` (ISO 20022-aligned)`, '');
    if (uri) lines.push(`**Conforms to (\`dct:conformsTo\`):** <${uri}>`, '');
  }
  lines.push('## Inputs', '', `Typed \`inputSchema\` — see [tool page](${n.url}).`, '');
  lines.push('## Outputs', '', 'A hash-anchored OpenChainGraph artifact (decision, not context).', '');
  lines.push('## Chains', '');
  lines.push('**Consumes:** ' + (consumes.length ? consumes.map(toolLink).join(', ') : '_none (root node)_'));
  lines.push('');
  lines.push('**Feeds:** ' + (feeds.length ? feeds.map(toolLink).join(', ') : '_terminal node_'));
  lines.push('');
  return lines.join('\n');
}

// --- build bundle (in-memory; see finalize step below for write vs --check) --
// one concept per live tool
for (const n of live) {
  write(`tools/${fileFor(n.tool_id)}`, `${frontmatter(n)}\n\n${conceptBody(n)}`);
}

// group by mandate_type
const groups = new Map();
for (const n of live) {
  if (!groups.has(n.mandate_type)) groups.set(n.mandate_type, []);
  groups.get(n.mandate_type).push(n);
}

// mandate-types/<type>.md
for (const [type, members] of groups) {
  const fm = [
    '---',
    'type: MandateTypeGroup',
    `title: ${JSON.stringify(type)}`,
    `description: ${JSON.stringify(`OpenChainGraph tools whose decisions carry mandate_type "${type}".`)}`,
    `tags: ${yamlList([type, `count-${members.length}`])}`,
    `timestamp: ${now}`,
    genLine(),
    'status: stable',
    '---',
  ].join('\n');
  const body = [
    `# ${type}`,
    '',
    `${members.length} tool(s) in this mandate-type group:`,
    '',
    ...members.map((n) => `- [${n.display_name}](../tools/${fileFor(n.tool_id)})`),
    '',
  ].join('\n');
  write(`mandate-types/${type}.md`, `${fm}\n\n${body}`);
}

// mandate-types/index.md
write(
  'mandate-types/index.md',
  [
    '---',
    'type: Index',
    'title: "Mandate types"',
    `timestamp: ${now}`,
    genLine(),
    'status: stable',
    '---',
    '',
    '# Mandate types',
    '',
    ...[...groups.keys()].sort().map((t) => `- [${t}](./${t}.md) (${groups.get(t).length})`),
    '',
  ].join('\n'),
);

// tools/index.md
write(
  'tools/index.md',
  [
    '---',
    'type: Index',
    'title: "Tools"',
    `timestamp: ${now}`,
    genLine(),
    'status: stable',
    '---',
    '',
    '# Tools',
    '',
    ...live
      .slice()
      .sort((a, b) => a.tool_id.localeCompare(b.tool_id))
      .map((n) => `- [${n.display_name}](./${fileFor(n.tool_id)}) — \`${n.mcp_name}\``),
    '',
  ].join('\n'),
);

// root index.md (progressive disclosure)
write(
  'index.md',
  [
    '---',
    'type: Index',
    'title: "AINumbers OpenChainGraph Suite"',
    `description: ${JSON.stringify(idx.suite_claim ?? '')}`,
    `resource: ${idx.hub_url}`,
    `tags: ["openchaingraph", "okf-v0.2", "spec-${idx.spec_version ?? '0.3'}"]`,
    `timestamp: ${now}`,
    genLine(),
    'status: stable',
    '---',
    '',
    '# AINumbers OpenChainGraph Suite',
    '',
    `> ${idx.suite_claim ?? ''}`,
    '',
    'This OKF bundle is the **narrative knowledge layer** for the suite — auto-generated from',
    '`chaingraph.json` (the DCAT Graph Index). It is *context to read before acting*; the tools',
    'themselves emit *provenance artifacts to verify after acting*. OKF concepts are knowledge,',
    'never decision artifacts — they carry no `execution_hash`.',
    '',
    '## Browse',
    '',
    `- [All tools](tools/index.md) (${live.length})`,
    `- [By mandate type](mandate-types/index.md) (${groups.size})`,
    '',
    '## Call',
    '',
    `- MCP endpoint: \`${idx.mcp_server}\``,
    `- Machine catalog (DCAT): [chaingraph.json](${idx.hub_url.replace('chaingraph-hub.html', 'chaingraph.json')})`,
    '',
  ].join('\n'),
);

// log.md (regenerated deterministically from chaingraph.json state, not an append log —
// same content every run for the same chaingraph.json, so --check stays meaningful)
write(
  'log.md',
  [
    '---',
    'type: Log',
    'title: "Generation log"',
    `timestamp: ${now}`,
    genLine(),
    'status: stable',
    '---',
    '',
    '# Generation log',
    '',
    `- ${now} — generated ${live.length} concepts across ${groups.size} mandate types from chaingraph.json v${idx.version} (spec v${idx.spec_version ?? '0.3'}).`,
    '',
  ].join('\n'),
);

// --- finalize: write to disk, or diff against disk for --check -------------
function listExistingFiles(dir, base = dir) {
  let out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(listExistingFiles(full, base));
    else out.push(full.slice(base.length + 1).split('\\').join('/'));
  }
  return out;
}

if (CHECK) {
  const problems = [];
  for (const [relPath, content] of files) {
    let current = null;
    try { current = readFileSync(resolve(OUT, relPath), 'utf8'); } catch { /* missing */ }
    if (current !== content) problems.push(current === null ? `missing: ${relPath}` : `stale: ${relPath}`);
  }
  let existing = [];
  try { existing = listExistingFiles(OUT); } catch { /* okf/ doesn't exist yet */ }
  for (const relPath of existing) {
    if (!files.has(relPath)) problems.push(`orphaned (no longer generated): ${relPath}`);
  }
  if (problems.length) {
    console.error(`generate-okf --check: okf/ is out of sync with chaingraph.json (${problems.length} issue(s)):`);
    for (const p of problems.slice(0, 20)) console.error(`  - ${p}`);
    if (problems.length > 20) console.error(`  ...and ${problems.length - 20} more`);
    console.error('Run `node chaingraph/generate-okf.mjs` to regenerate.');
    process.exit(1);
  }
  console.log(`generate-okf --check: okf/ is fresh (${files.size} files match chaingraph.json).`);
} else {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(resolve(OUT, 'tools'), { recursive: true });
  mkdirSync(resolve(OUT, 'mandate-types'), { recursive: true });
  for (const [relPath, content] of files) {
    writeFileSync(resolve(OUT, relPath), content);
  }
  console.log(`OKF bundle written to ${OUT}: ${live.length} tool concepts, ${groups.size} mandate-type groups.`);
}
