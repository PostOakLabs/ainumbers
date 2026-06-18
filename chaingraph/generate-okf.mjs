#!/usr/bin/env node
/**
 * generate-okf.mjs — OpenChainGraph v0.3 OKF companion-bundle generator.
 *
 * Reads chaingraph.json (the DCAT Graph Index) and emits an Open Knowledge
 * Format (OKF v0.1) bundle under ./okf/ — one markdown "concept" per live
 * node, with YAML frontmatter and markdown links mirroring the consumes/feeds
 * edges. Run in CI on every chaingraph.json change so the bundle never drifts.
 *
 * OKF concepts are KNOWLEDGE, never decision artifacts: they carry NO
 * execution_hash and NO audit_signature. Nothing in OpenChainGraph's
 * verification path depends on this bundle — it is a discovery surface only.
 *
 * Usage:  node generate-okf.mjs
 * Output: ./okf/{index.md, log.md, tools/*.md, mandate-types/*.md}
 *
 * Zero dependencies (Node 18+ ESM).
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(HERE, 'chaingraph.json');
const OUT = resolve(HERE, 'okf');

const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
const live = idx.nodes.filter((n) => n.status === 'live');
const byId = new Map(live.map((n) => [n.tool_id, n]));
const now = new Date().toISOString();

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
      'iso20022:pacs.008-subset': 'https://openchain.graph/profiles/iso20022/pacs.008-subset',
      'iso20022:party-identification': 'https://openchain.graph/profiles/iso20022/party-identification',
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

// --- write bundle --------------------------------------------------------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(resolve(OUT, 'tools'), { recursive: true });
mkdirSync(resolve(OUT, 'mandate-types'), { recursive: true });

// one concept per live tool
for (const n of live) {
  writeFileSync(resolve(OUT, 'tools', fileFor(n.tool_id)), `${frontmatter(n)}\n\n${conceptBody(n)}`);
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
  writeFileSync(resolve(OUT, 'mandate-types', `${type}.md`), `${fm}\n\n${body}`);
}

// mandate-types/index.md
writeFileSync(
  resolve(OUT, 'mandate-types', 'index.md'),
  [
    '---',
    'type: Index',
    'title: "Mandate types"',
    `timestamp: ${now}`,
    '---',
    '',
    '# Mandate types',
    '',
    ...[...groups.keys()].sort().map((t) => `- [${t}](./${t}.md) (${groups.get(t).length})`),
    '',
  ].join('\n'),
);

// tools/index.md
writeFileSync(
  resolve(OUT, 'tools', 'index.md'),
  [
    '---',
    'type: Index',
    'title: "Tools"',
    `timestamp: ${now}`,
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
writeFileSync(
  resolve(OUT, 'index.md'),
  [
    '---',
    'type: Index',
    'title: "AINumbers OpenChainGraph Suite"',
    `description: ${JSON.stringify(idx.suite_claim ?? '')}`,
    `resource: ${idx.hub_url}`,
    `tags: ["openchaingraph", "okf", "spec-${idx.spec_version ?? '0.3'}"]`,
    `timestamp: ${now}`,
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

// log.md (chronological history — append-style; regenerated here for simplicity)
writeFileSync(
  resolve(OUT, 'log.md'),
  [
    '---',
    'type: Log',
    'title: "Generation log"',
    `timestamp: ${now}`,
    '---',
    '',
    '# Generation log',
    '',
    `- ${now} — generated ${live.length} concepts across ${groups.size} mandate types from chaingraph.json v${idx.version} (spec v${idx.spec_version ?? '0.3'}).`,
    '',
  ].join('\n'),
);

console.log(`OKF bundle written to ${OUT}: ${live.length} tool concepts, ${groups.size} mandate-type groups.`);
