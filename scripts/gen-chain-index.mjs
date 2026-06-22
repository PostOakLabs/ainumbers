import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
const chains = cg.chains || [];

const entries = chains.map(c => {
  let domain = 'Other';
  const n = c.name || '';
  if (n.startsWith('agent-economy-')) domain = 'Agent Economy';
  else if (n.startsWith('ai-governance-')) domain = 'AI Governance';
  else if (n.startsWith('treasury-clearing-')) domain = 'Treasury Clearing';
  else if (n.startsWith('wholesale-settlement-')) domain = 'Wholesale Settlement';
  else if (n.startsWith('settlement-discipline-')) domain = 'Settlement Discipline';
  else if (n.startsWith('digital-trade-')) domain = 'Digital Trade';
  else if (n.startsWith('cbam-')) domain = 'CBAM';
  else if (n.startsWith('sanctions-')) domain = 'Sanctions';
  else if (n.startsWith('export-control-')) domain = 'Export Control';

  const steps = (c.steps || []).length;
  const url = c.composer_url || '';
  let relUrl = url
    .replace('https://ainumbers.co/chaingraph/', '')
    .replace('https://ainumbers.co/', '../');
  if (!relUrl) relUrl = 'chains/' + c.name + '.html';
  const desc = (c.description || '').slice(0, 120);
  const title = c.title || c.name;
  return JSON.stringify({ n: c.name, t: title, d: desc, s: steps, u: relUrl, dom: domain });
});

const jsData = 'var CHAIN_INDEX=' + '[' + entries.join(',') + ']' + ';';
// Write to stdout for embedding
process.stdout.write(jsData);
