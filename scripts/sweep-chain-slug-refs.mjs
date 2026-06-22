// sweep-chain-slug-refs.mjs — replace old slug refs with new slugs in all HTML/txt/xml files
// Targets: mcp.html, llms.txt, sitemap.xml, index.html, sitemap.html,
//          chaingraph/guide-*.html, guides/tool-chains.html, guides/*-hub.html,
//          scattered tools/*.html with chain links.
//
// Usage:
//   node scripts/sweep-chain-slug-refs.mjs         # dry run (counts replacements)
//   node scripts/sweep-chain-slug-refs.mjs --write  # apply replacements in-place

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const WRITE = process.argv.includes('--write');

// Same rename map as rename-chain-slugs.mjs
const RENAME_MAP = {
  'aer-audit-pack':           'agent-economy-audit-pack',
  'aer-autonomous-guardrail': 'agent-economy-autonomous-guardrail',
  'aer-batch-settlement':     'agent-economy-batch-settlement',
  'aer-fit':                  'agent-economy-fit',
  'aer-fraud-runtime':        'agent-economy-fraud-runtime',
  'aer-marketplace':          'agent-economy-marketplace',
  'aer-metering':             'agent-economy-metering',
  'aer-payment-receipt':      'agent-economy-payment-receipt',
  'aig-audit-pack':           'ai-governance-audit-pack',
  'aig-conformity':           'ai-governance-conformity',
  'aig-credit-ai-conformity': 'ai-governance-credit-ai-conformity',
  'aig-fairness-bias':        'ai-governance-fairness-bias',
  'aig-fit':                  'ai-governance-fit',
  'aig-fria-monitoring':      'ai-governance-fria-monitoring',
  'aig-gpai-agentic':         'ai-governance-gpai-agentic',
  'aig-resilience-overlap':   'ai-governance-resilience-overlap',
  'tcm-access-model':         'treasury-clearing-access-model',
  'tcm-capital-relief':       'treasury-clearing-capital-relief',
  'tcm-collateral':           'treasury-clearing-collateral',
  'tcm-cross-margin':         'treasury-clearing-cross-margin',
  'tcm-fit':                  'treasury-clearing-fit',
  'tcm-liquidity':            'treasury-clearing-liquidity',
  'tcm-onboarding':           'treasury-clearing-onboarding',
  'tcm-repo-margin':          'treasury-clearing-repo-margin',
  'tcm-settlement-integrity': 'treasury-clearing-settlement-integrity',
  'wts-audit-pack':             'wholesale-settlement-audit-pack',
  'wts-collateral-mobility':    'wholesale-settlement-collateral-mobility',
  'wts-cross-network-dvp':      'wholesale-settlement-cross-network-dvp',
  'wts-deposit-token':          'wholesale-settlement-deposit-token',
  'wts-fit':                    'wholesale-settlement-fit',
  'wts-intraday-liquidity':     'wholesale-settlement-intraday-liquidity',
  'wts-participant-onboarding': 'wholesale-settlement-participant-onboarding',
  'wts-settlement-asset':       'wholesale-settlement-settlement-asset',
  'sd-alloc-affirm':        'settlement-discipline-alloc-affirm',
  'sd-audit-pack':          'settlement-discipline-audit-pack',
  'sd-buyin':               'settlement-discipline-buyin',
  'sd-failpredict':         'settlement-discipline-failpredict',
  'sd-fit':                 'settlement-discipline-fit',
  'sd-message-conformance': 'settlement-discipline-message-conformance',
  'sd-penalty':             'settlement-discipline-penalty',
  'sd-ssi-hygiene':         'settlement-discipline-ssi-hygiene',
  'dtc-audit-pack':          'digital-trade-audit-pack',
  'dtc-counterparty-aml':    'digital-trade-counterparty-aml',
  'dtc-digital-lc':          'digital-trade-letter-of-credit',
  'dtc-doc-integrity':       'digital-trade-doc-integrity',
  'dtc-ebl-enforceability':  'digital-trade-ebl-enforceability',
  'dtc-fit':                 'digital-trade-fit',
  'dtc-tbml-surveillance':   'digital-trade-tbml-surveillance',
  'dtc-trade-finance':       'digital-trade-finance',
  'cbm-fit':       'cbam-fit',
  'cbm-liability': 'cbam-liability',
  'cbm-precursor': 'cbam-precursor',
  'sanc-audit-pack':        'sanctions-audit-pack',
  'sanc-fit':               'sanctions-fit',
  'sanc-fuzzy-calibration': 'sanctions-fuzzy-calibration',
  'sanc-list-coverage':     'sanctions-list-coverage',
  'sanc-ownership':         'sanctions-ownership',
  'sanc-screening-quality': 'sanctions-screening-quality',
  'ec-circumvention':  'export-control-circumvention',
  'ec-eccn-classify':  'export-control-eccn',
};

// Sort by old name length descending so longer slugs are replaced first (avoids partial-match issues)
const sortedRenames = Object.entries(RENAME_MAP).sort((a, b) => b[0].length - a[0].length);

function applyRenames(content) {
  let result = content;
  let count = 0;
  for (const [oldSlug, newSlug] of sortedRenames) {
    // Match the slug in URL contexts: chains/old-slug.html, chains/old-slug", chains/old-slug', chains/old-slug/
    // Also match plain text occurrences in llms.txt / llms.txt descriptions
    const patterns = [
      // URL path with .html extension
      { from: new RegExp(`chains/${escapeRegex(oldSlug)}\\.html`, 'g'), to: `chains/${newSlug}.html` },
      // URL path without extension (trailing slash, quote, or newline)
      { from: new RegExp(`chains/${escapeRegex(oldSlug)}(?=["'/\\s])`, 'g'), to: `chains/${newSlug}` },
      // Bare slug (for llms.txt description lines that may reference the slug directly)
      { from: new RegExp(`\\b${escapeRegex(oldSlug)}\\b`, 'g'), to: newSlug },
    ];
    for (const p of patterns) {
      const replaced = result.replace(p.from, p.to);
      if (replaced !== result) count += (result.match(p.from) || []).length;
      result = replaced;
    }
  }
  return { result, count };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Collect target files
function collectFiles(dir, patterns) {
  const files = [];
  try {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) continue;
        if (patterns.some(p => p instanceof RegExp ? p.test(name) : name === p)) {
          files.push(full);
        }
      } catch (_) {}
    }
  } catch (_) {}
  return files;
}

const targets = [
  // Root files
  join(REPO, 'mcp.html'),
  join(REPO, 'llms.txt'),
  join(REPO, 'sitemap.xml'),
  join(REPO, 'index.html'),
  join(REPO, 'sitemap.html'),
  // Guide hubs
  ...collectFiles(join(REPO, 'chaingraph'), [/^guide-.*\.html$/, /^chaingraph-hub\.html$/]),
  ...collectFiles(join(REPO, 'guides'), [/.*-hub\.html$/, 'tool-chains.html']),
  // art-* pages (chaingraph/)
  ...collectFiles(join(REPO, 'chaingraph'), [/^art-.*\.html$/]),
];

let totalChanged = 0;
let filesChanged = 0;

for (const filepath of targets) {
  let content;
  try { content = readFileSync(filepath, 'utf8'); } catch (_) { continue; }
  const { result, count } = applyRenames(content);
  if (count > 0) {
    filesChanged++;
    totalChanged += count;
    const relPath = filepath.replace(REPO + '\\', '').replace(REPO + '/', '');
    console.log(`${WRITE ? 'updated' : 'would update'}  ${relPath}  (${count} replacement${count !== 1 ? 's' : ''})`);
    if (WRITE) writeFileSync(filepath, result, 'utf8');
  }
}

console.log(`\n${WRITE ? 'Done' : 'Dry run'} — ${totalChanged} replacement${totalChanged !== 1 ? 's' : ''} in ${filesChanged} file${filesChanged !== 1 ? 's' : ''}.${WRITE ? '' : ' Re-run with --write to apply.'}`);
