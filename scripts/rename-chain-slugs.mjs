// rename-chain-slugs.mjs — apply the slug rename map to chaingraph.json
// Updates chain `name` and `composer_url` for the 9 cryptic families.
// Naming convention: <domain-word>-<specifics>, lowercase-kebab, spelled-out domain.
// mcp_names and page titles are NOT changed (they're already plain English).
//
// Usage:
//   node scripts/rename-chain-slugs.mjs         # dry run (shows changes)
//   node scripts/rename-chain-slugs.mjs --write  # writes chaingraph.json + prints git mv cmds

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_PATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
const WRITE = process.argv.includes('--write');

// Complete old → new slug map (60 chains)
// Rule: <prefix> → <new-prefix> + same suffix, except where spec gives explicit rename
const RENAME_MAP = {
  // aer- → agent-economy-
  'aer-audit-pack':           'agent-economy-audit-pack',
  'aer-autonomous-guardrail': 'agent-economy-autonomous-guardrail',
  'aer-batch-settlement':     'agent-economy-batch-settlement',
  'aer-fit':                  'agent-economy-fit',
  'aer-fraud-runtime':        'agent-economy-fraud-runtime',
  'aer-marketplace':          'agent-economy-marketplace',
  'aer-metering':             'agent-economy-metering',
  'aer-payment-receipt':      'agent-economy-payment-receipt',
  // aig- → ai-governance-
  'aig-audit-pack':           'ai-governance-audit-pack',
  'aig-conformity':           'ai-governance-conformity',
  'aig-credit-ai-conformity': 'ai-governance-credit-ai-conformity',
  'aig-fairness-bias':        'ai-governance-fairness-bias',
  'aig-fit':                  'ai-governance-fit',
  'aig-fria-monitoring':      'ai-governance-fria-monitoring',
  'aig-gpai-agentic':         'ai-governance-gpai-agentic',
  'aig-resilience-overlap':   'ai-governance-resilience-overlap',
  // tcm- → treasury-clearing-
  'tcm-access-model':         'treasury-clearing-access-model',
  'tcm-capital-relief':       'treasury-clearing-capital-relief',
  'tcm-collateral':           'treasury-clearing-collateral',
  'tcm-cross-margin':         'treasury-clearing-cross-margin',
  'tcm-fit':                  'treasury-clearing-fit',
  'tcm-liquidity':            'treasury-clearing-liquidity',
  'tcm-onboarding':           'treasury-clearing-onboarding',
  'tcm-repo-margin':          'treasury-clearing-repo-margin',
  'tcm-settlement-integrity': 'treasury-clearing-settlement-integrity',
  // wts- → wholesale-settlement-
  'wts-audit-pack':             'wholesale-settlement-audit-pack',
  'wts-collateral-mobility':    'wholesale-settlement-collateral-mobility',
  'wts-cross-network-dvp':      'wholesale-settlement-cross-network-dvp',
  'wts-deposit-token':          'wholesale-settlement-deposit-token',
  'wts-fit':                    'wholesale-settlement-fit',
  'wts-intraday-liquidity':     'wholesale-settlement-intraday-liquidity',
  'wts-participant-onboarding': 'wholesale-settlement-participant-onboarding',
  'wts-settlement-asset':       'wholesale-settlement-settlement-asset',
  // sd- → settlement-discipline-
  'sd-alloc-affirm':        'settlement-discipline-alloc-affirm',
  'sd-audit-pack':          'settlement-discipline-audit-pack',
  'sd-buyin':               'settlement-discipline-buyin',
  'sd-failpredict':         'settlement-discipline-failpredict',
  'sd-fit':                 'settlement-discipline-fit',
  'sd-message-conformance': 'settlement-discipline-message-conformance',
  'sd-penalty':             'settlement-discipline-penalty',
  'sd-ssi-hygiene':         'settlement-discipline-ssi-hygiene',
  // dtc- → digital-trade-  (dtc-digital-lc → letter-of-credit per spec; dtc-trade-finance → digital-trade-finance)
  'dtc-audit-pack':          'digital-trade-audit-pack',
  'dtc-counterparty-aml':    'digital-trade-counterparty-aml',
  'dtc-digital-lc':          'digital-trade-letter-of-credit',
  'dtc-doc-integrity':       'digital-trade-doc-integrity',
  'dtc-ebl-enforceability':  'digital-trade-ebl-enforceability',
  'dtc-fit':                 'digital-trade-fit',
  'dtc-tbml-surveillance':   'digital-trade-tbml-surveillance',
  'dtc-trade-finance':       'digital-trade-finance',
  // cbm- → cbam-
  'cbm-fit':       'cbam-fit',
  'cbm-liability': 'cbam-liability',
  'cbm-precursor': 'cbam-precursor',
  // sanc- → sanctions-
  'sanc-audit-pack':        'sanctions-audit-pack',
  'sanc-fit':               'sanctions-fit',
  'sanc-fuzzy-calibration': 'sanctions-fuzzy-calibration',
  'sanc-list-coverage':     'sanctions-list-coverage',
  'sanc-ownership':         'sanctions-ownership',
  'sanc-screening-quality': 'sanctions-screening-quality',
  // ec- → export-control-  (ec-eccn-classify → export-control-eccn per spec)
  'ec-circumvention':  'export-control-circumvention',
  'ec-eccn-classify':  'export-control-eccn',
};

const BASE_URL = 'https://ainumbers.co/chaingraph/chains/';

const cg = JSON.parse(readFileSync(CG_PATH, 'utf8'));

let changed = 0;
const gitMvCmds = [];

for (const chain of (cg.chains ?? [])) {
  const newName = RENAME_MAP[chain.name];
  if (!newName) continue;

  const oldName = chain.name;
  const oldUrl = `${BASE_URL}${oldName}.html`;
  const newUrl = `${BASE_URL}${newName}.html`;

  if (!WRITE) {
    console.log(`  ${oldName}  →  ${newName}`);
  }

  chain.name = newName;
  // Only update composer_url if it currently points to the old URL
  if (chain.composer_url === oldUrl) {
    chain.composer_url = newUrl;
  }
  gitMvCmds.push(`git -C "${REPO.replace(/\\/g, '/')}" mv "chaingraph/chains/${oldName}.html" "chaingraph/chains/${newName}.html"`);
  changed++;
}

if (WRITE) {
  writeFileSync(CG_PATH, JSON.stringify(cg, null, 2) + '\n', 'utf8');
  console.log(`Updated chaingraph.json — ${changed} chains renamed.`);
  console.log('\n# git mv commands (run these after updating chaingraph.json):');
  gitMvCmds.forEach(cmd => console.log(cmd));
} else {
  console.log(`\nDry run — ${changed} chains would be renamed. Re-run with --write to apply.`);
  console.log('\n# git mv commands that would be needed:');
  gitMvCmds.forEach(cmd => console.log(cmd));
}
