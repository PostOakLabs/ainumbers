// check-chain-domain.mjs — every chaingraph.json chains[] entry MUST carry a "domain" field
// from a fixed enum.
//
// WHY: chaingraph-hub.html's domain tag used to be derived by domainOf(name) in
// gen-chain-index.mjs — a hardcoded 9-prefix name-guess that silently dumped anything not
// matching a magic prefix into "Other" (229/290 = 79% by the time the corpus grew, see
// CHAINDOMAIN-1-BUILD-SPEC.md §D1). "domain" is now an authored field on every chain object
// (§D2 Part 2). This gate is the durable fix: a chain missing/mis-valued "domain" fails the
// build, converting silent drift into "author must declare a real category or the push is
// rejected." Enum-constrains the same way schema-validate.mjs enum-constrains other fields,
// but lives here (not in openchain-graph-v0.4.schema.json) because "domain" is site-only
// chain metadata, not part of the normative v0.4 node/artifact envelope — this avoids adding
// a non-normative field to the Lane-0 SSOT schema.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

// Fixed enum — the CHAINDOMAIN-1 human-curated taxonomy (§D2 Part 1). Adding a new chain in a
// genuinely new category requires adding its domain here first (same convention as node
// mandate_type).
const DOMAIN_ENUM = new Set([
  'Agent Economy',
  'AI Governance',
  'AI & Agent Governance',
  'BaaS & Embedded Finance',
  'Bank Capital & Credit Risk',
  'CBAM',
  'Card & Payment Economics',
  'Climate & Sustainable Finance',
  'Consumer & Wealth Compliance',
  'Consumer Lending & Fair Lending',
  'Corporate Treasury & FX',
  'Cross-Border & Instant Payments',
  'Digital Trade',
  'Digital-Asset Rails',
  'DORA / NIS2 / ICT Resilience',
  'Document & Content Provenance',
  'EMIR',
  'EU Digital ID & Consumer Credit',
  'EUDR',
  'Export Control',
  'Financial Crime & KYC',
  'Fraud & Dispute',
  'HR & Benefits Compliance',
  'IRRBB',
  'Insurance & Reinsurance',
  'Open Banking / Open Finance',
  'Post-Quantum Cryptography',
  'SME & Commercial Finance',
  'Sanctions',
  'Securities Settlement',
  'Settlement Discipline',
  'Supply-Chain Traceability',
  'Treasury Clearing',
  'ViDA / E-Invoicing',
  'Verification & Proof Receipts',
  'Wholesale Settlement',
]);

const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
const chains = cg.chains || [];

const bad = chains.filter((c) => !c.domain || !DOMAIN_ENUM.has(c.domain));

if (bad.length) {
  console.error(`✗ chain-domain FAILED — ${bad.length} chain(s) missing/invalid "domain":`);
  for (const c of bad) console.error(`  • ${c.name} -> domain=${JSON.stringify(c.domain)}`);
  console.error(`\nEvery chains[] entry needs a "domain" string from the fixed enum in scripts/check-chain-domain.mjs (${DOMAIN_ENUM.size} values). Add a new enum value there first if a genuinely new category is needed.`);
  process.exit(1);
}

// No-bucket-too-large soft guard (§D4.1 target: no bucket over ~20%, misc under ~10%) — the
// enum has no explicit misc/"Other" bucket, so this only re-flags a single bucket ballooning.
const counts = {};
for (const c of chains) counts[c.domain] = (counts[c.domain] || 0) + 1;
const total = chains.length;
const [topDomain, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
const topPct = (100 * topCount) / total;
if (topPct > 25) {
  console.error(`✗ chain-domain FAILED — "${topDomain}" holds ${topCount}/${total} chains (${topPct.toFixed(1)}%), over the 25% concentration ceiling. Split it.`);
  process.exit(1);
}

console.log(`✓ chain-domain clean — all ${total} chains carry a valid domain across ${Object.keys(counts).length} buckets (largest: "${topDomain}" ${topCount}/${total} = ${topPct.toFixed(1)}%).`);
