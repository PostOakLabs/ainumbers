// One-shot script: add RHC-WAVE.b (art-323 fit diagnostic + rhc-fit chain) to chaingraph.json.
// See RHC-WAVE-BUILD-SPEC.md §RHC-0. Proof deferred; RHC-WAVE.land proves it together with .a's six.
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';

const cgPath = resolve('chaingraph/chaingraph.json');
const g = JSON.parse(readFileSync(cgPath, 'utf8'));

g.version = '1.66.0';

const WAVE = 56;
const DOMAIN = 'Digital-Asset Rails';

const htmlPath = resolve('chaingraph/art-323-rhc-fit-diagnostic.html');
const htmlBytes = readFileSync(htmlPath);
const sourceHash = 'sha256:' + createHash('sha256').update(htmlBytes).digest('hex');

const newNode = {
  tool_id: 'art-323-rhc-fit-diagnostic',
  tool_version: '1.0.0',
  display_name: 'Robinhood Chain Fit Diagnostic',
  mcp_name: 'run_robinhood_chain_fit_diagnostic',
  mandate_type: 'agent_guardrail_mandate',
  wave: WAVE,
  gpu: false,
  url: 'https://ainumbers.co/chaingraph/art-323-rhc-fit-diagnostic.html',
  description: '12-question A-F diagnostic grading a firm\'s Robinhood Chain adoption fit across four paths: stock-token application, collateral/lending venue, index/basket product, and agent-settlement automation. Routes to the reconciliation, regime-mapping, valuation-lint, collateral-haircut, BoLD-finality, and AP-redemption-stress workflows. Deliberately does not reuse the MiCA/GENIUS question set from the Tempo and Arc diagnostics, since Robinhood Chain stock tokens sit in the opposite regulatory carve-out. Zero network, zero PII.',
  input_schema_ref: 'chaingraph/art-323-rhc-fit-diagnostic.html#manifest',
  consumes: [],
  feeds: [
    'art-317-rhc-multiplier-reconciler',
    'art-318-rhc-regime-mapper',
    'art-319-rhc-valuation-linter',
    'art-320-rhc-collateral-haircut',
    'art-321-rhc-bold-finality-classifier',
    'art-322-rhc-ap-redemption-stress',
  ],
  status: 'live',
  conformance_fixtures: true,
  compute_capability: 'server',
  compute_images: [
    { system: 'sha256-source', image_id: sourceHash, valid_from: '2026-07-16' },
  ],
  export_capability: ['json'],
  compute_proof_ready: 'deferred',
  deferred_reason: 'awaiting section-18 groth16 proof, Opus land session',
};

g.nodes.push(newNode);

const newChain = {
  name: 'rhc-fit',
  domain: DOMAIN,
  title: 'Robinhood Chain Fit Diagnostic',
  spec_version: '0.8.0',
  wave: WAVE,
  description: 'Single-node entry-point diagnostic grading a firm A-F across four Robinhood Chain adoption paths (stock-token application, collateral venue, index/basket, agent-settlement) and routing to the relevant RHC verification chains.',
  composer_url: 'https://ainumbers.co/chaingraph/chains/rhc-fit.html',
  regulatory_refs: ['docs.robinhood.com/chain/stock-tokens', 'docs.robinhood.com/chain/building-with-stock-tokens'],
  steps: [
    {
      tool_id: 'art-323-rhc-fit-diagnostic',
      handoff: 'path_scores and routed_workflows route to rhc-multiplier-reconciliation / rhc-regime-mapping / rhc-valuation-lint / rhc-collateral-haircut / rhc-bold-finality-classification / rhc-ap-redemption-stress chains',
    },
  ],
};

g.chains.push(newChain);

const wave56 = g.wave_summary.wave_56;
wave56.nodes_live = 7;
wave56.live = [...wave56.live, newNode.tool_id];
wave56.chains_live = 7;
wave56.chains = [...wave56.chains, newChain.name];
wave56.mcp_tools_added = [...wave56.mcp_tools_added, newNode.mcp_name];
wave56.description = '7 new nodes (art-317..323) plus 7 chains for Robinhood Chain stock-token verification, shipped across RHC-WAVE.a (the 6 verification workflows: ERC-8056 multiplier reconciliation, financial-instrument regime mapping, valuation double-count linting, halt/staleness collateral haircut, BoLD challenge-window finality classification, AP concentration/redemption-path stress) and RHC-WAVE.b (RHC-0 fit diagnostic entry point + guide-robinhood.html network guide). Proofs deferred pending the section-18 land session for all 7 nodes. chaingraph.json v1.66.0.';

g.wave_summary.version = '1.66.0';

writeFileSync(cgPath, JSON.stringify(g, null, 2) + '\n', 'utf8');
console.log('Done. version:', g.version, 'nodes:', g.nodes.length, 'chains:', g.chains.length, 'sourceHash:', sourceHash);
