// One-shot script: add RHC-WAVE.a nodes (RHC-1..RHC-6) + chains to chaingraph.json.
// See RHC-WAVE-BUILD-SPEC.md. Proofs deferred; a later Opus land session proves+wires §18.
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const cgPath = resolve('chaingraph/chaingraph.json');
const g = JSON.parse(readFileSync(cgPath, 'utf8'));

g.version = '1.65.0';

const WAVE = 56;
const DOMAIN = 'Digital-Asset Rails';

const newNodes = [
  {
    tool_id: 'art-317-rhc-multiplier-reconciler',
    tool_version: '1.0.0',
    display_name: 'ERC-8056 Multiplier Reconciler',
    mcp_name: 'reconcile_erc8056_multiplier',
    mandate_type: 'collateral_mandate',
    wave: WAVE,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-317-rhc-multiplier-reconciler.html',
    description: 'Reconciles Robinhood Chain stock-token corporate actions against the ERC-8056 scaled UI amount surface. Stock tokens never rebase; splits and dividends land as a uiMultiplier() change plus a UIMultiplierUpdated event while raw balanceOf stays static until redemption. Checks declared corporate-action ratio against the multiplier transition, monotonic event sequencing, and raw-balance invariance. First tooling anywhere for ERC-8056 reconciliation. Zero network, zero PII.',
    input_schema_ref: 'chaingraph/art-317-rhc-multiplier-reconciler.html#manifest',
    consumes: [],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-16' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
    deferred_reason: 'awaiting section-18 groth16 proof, Opus land session',
  },
  {
    tool_id: 'art-318-rhc-regime-mapper',
    tool_version: '1.0.0',
    display_name: 'Financial-Instrument Regime Mapper',
    mcp_name: 'map_robinhood_chain_regime',
    mandate_type: 'crypto_regulatory_mandate',
    wave: WAVE,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-318-rhc-regime-mapper.html',
    description: 'Maps the regulatory regime implied by a pasted Robinhood Chain stock-token characterization. The tokens are tokenized debt securities issued by Robinhood Assets (Jersey) Limited, which puts them inside the MiCA Article 2(4)(a) financial-instrument carve-out, the inverse of the MiCA/GENIUS crypto-asset regime that applies to Tempo and Arc. Flags MiFID II transferable-security classification, prospectus exposure, the no-US-persons gate, and SPV voting-rights disclosure. Never asserts a legal conclusion, only the regime the given characterization implies. Zero network, zero PII.',
    input_schema_ref: 'chaingraph/art-318-rhc-regime-mapper.html#manifest',
    consumes: [],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-16' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
    deferred_reason: 'awaiting section-18 groth16 proof, Opus land session',
  },
  {
    tool_id: 'art-319-rhc-valuation-linter',
    tool_version: '1.0.0',
    display_name: 'Valuation Double-Count / Decimal Linter',
    mcp_name: 'lint_stock_token_valuation',
    mandate_type: 'collateral_mandate',
    wave: WAVE,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-319-rhc-valuation-linter.html',
    description: 'Lints Robinhood Chain stock-token USD valuation expressions for the double-count bug: the Chainlink price feed already includes corporate actions, so multiplying raw balance by price and then by uiMultiplier applies the same corporate action twice. Compares the tested valuation against the correct expression and flags the double-count when present, with the corrected formula returned. High hit-rate node for any developer writing a valuation path against 18-decimal stock tokens and an 8-decimal feed. Zero network, zero PII.',
    input_schema_ref: 'chaingraph/art-319-rhc-valuation-linter.html#manifest',
    consumes: [],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-16' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
    deferred_reason: 'awaiting section-18 groth16 proof, Opus land session',
  },
  {
    tool_id: 'art-320-rhc-collateral-haircut',
    tool_version: '1.0.0',
    display_name: 'Halt + Staleness Collateral Haircut',
    mcp_name: 'compute_stock_token_collateral_haircut',
    mandate_type: 'collateral_mandate',
    wave: WAVE,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-320-rhc-collateral-haircut.html',
    description: 'Layers a feed-staleness, sequencer-downtime, and underlying-halt haircut on top of a base repo haircut for Robinhood Chain stock tokens posted as collateral. 46 percent of first-week stock-token transfers settled outside NYSE hours, and the docs name Chainlink staleness checks plus Arbitrum sequencer-uptime validation as required practice. Downstream of check_tokenized_collateral_eligibility and calculate_repo_haircut in the collateral-haircut chain. Returns a liquidation-risk classification: normal, elevated, or blocked. Zero network, zero PII.',
    input_schema_ref: 'chaingraph/art-320-rhc-collateral-haircut.html#manifest',
    consumes: ['505-tokenized-collateral-eligibility-checker', '508-repo-haircut-collateral-calculator'],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-16' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
    deferred_reason: 'awaiting section-18 groth16 proof, Opus land session',
  },
  {
    tool_id: 'art-321-rhc-bold-finality-classifier',
    tool_version: '1.0.0',
    display_name: 'BoLD Challenge-Window Finality Classifier',
    mcp_name: 'classify_bold_challenge_finality',
    mandate_type: 'settlement_finality_mandate',
    wave: WAVE,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-321-rhc-bold-finality-classifier.html',
    description: 'Classifies a settlement-finality claim on Robinhood Chain, an Arbitrum Orbit dedicated blockchain using BoLD interactive fraud proofs, into soft, posted, challengeable, or final. Onchain settlement inside the roughly week-long BoLD challenge window is optimistic, not final, and a claim asserting final finality inside that window is flagged as overstated. Downstream of classify_settlement_asset_finality in the finality-classification chain; follows the check_linea_l2_finality_window shape as a precedent only, since the proof system differs. Zero network, zero PII.',
    input_schema_ref: 'chaingraph/art-321-rhc-bold-finality-classifier.html#manifest',
    consumes: ['art-59-settlement-asset-finality-classifier'],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-16' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
    deferred_reason: 'awaiting section-18 groth16 proof, Opus land session',
  },
  {
    tool_id: 'art-322-rhc-ap-redemption-stress',
    tool_version: '1.0.0',
    display_name: 'AP Concentration + Redemption-Path Stress',
    mcp_name: 'stress_test_ap_redemption_path',
    mandate_type: 'collateral_mandate',
    wave: WAVE,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-322-rhc-ap-redemption-stress.html',
    description: 'Stress-tests the one-token-equals-one-share economic-exposure claim for Robinhood Chain stock tokens against actual redemption reachability. BBVI is the sole Authorised Participant at issuance; only Authorised Participants may subscribe or redeem directly from Robinhood Assets (Jersey) Limited after KYB, everyone else is secondary-market-only. Enumerates AP concentration, premium/discount exposure if the sole AP stops market-making, and issuer-credit exposure distinct from the underlying equity. Verify-only; never recommends a position. Zero network, zero PII.',
    input_schema_ref: 'chaingraph/art-322-rhc-ap-redemption-stress.html#manifest',
    consumes: [],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-16' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
    deferred_reason: 'awaiting section-18 groth16 proof, Opus land session',
  },
];

g.nodes.push(...newNodes);

const newChains = [
  {
    name: 'rhc-multiplier-reconciliation',
    domain: DOMAIN,
    title: 'Robinhood Chain Multiplier Reconciliation',
    spec_version: '0.8.0',
    wave: WAVE,
    description: 'Single-step chain reconciling a declared Robinhood Chain stock-token corporate action against its ERC-8056 uiMultiplier transition, event log, and raw-balance invariance.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/rhc-multiplier-reconciliation.html',
    regulatory_refs: ['ERC-8056 (scaled UI amount)', 'docs.robinhood.com/chain/stock-tokens'],
    steps: [
      { tool_id: 'art-317-rhc-multiplier-reconciler', handoff: 'verdict, ratio_match, raw_balance_invariant, and discrepancies feed the reconciliation record.' },
    ],
  },
  {
    name: 'rhc-regime-mapping',
    domain: DOMAIN,
    title: 'Robinhood Chain Regime Mapping',
    spec_version: '0.8.0',
    wave: WAVE,
    description: 'Single-step chain mapping the regulatory regime implied by a Robinhood Chain stock-token characterization, inverting the MiCA/GENIUS assumption that applies to the estate\'s other digital-asset-rail chains.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/rhc-regime-mapping.html',
    regulatory_refs: ['MiCA Art. 2(4)(a)', 'MiFID II transferable securities', 'Jersey company law'],
    steps: [
      { tool_id: 'art-318-rhc-regime-mapper', handoff: 'regime_tree, mica_carveout_applies, and us_persons_gate_violated feed the regime record.' },
    ],
  },
  {
    name: 'rhc-valuation-lint',
    domain: DOMAIN,
    title: 'Robinhood Chain Valuation Lint',
    spec_version: '0.8.0',
    wave: WAVE,
    description: 'Single-step chain linting a Robinhood Chain stock-token USD valuation expression for the corporate-action double-count bug against the Chainlink 8-decimal feed.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/rhc-valuation-lint.html',
    regulatory_refs: ['Chainlink AggregatorV3Interface', 'docs.robinhood.com/chain/building-with-stock-tokens'],
    steps: [
      { tool_id: 'art-319-rhc-valuation-linter', handoff: 'verdict, correct_value, and corrected_expression feed the lint record.' },
    ],
  },
  {
    name: 'rhc-collateral-haircut',
    domain: DOMAIN,
    title: 'Robinhood Chain Collateral Haircut',
    spec_version: '0.8.0',
    wave: WAVE,
    description: 'Gated three-step chain for accepting Robinhood Chain stock tokens as collateral. Step 1 checks tokenized-collateral eligibility, step 2 computes the base repo haircut, step 3 layers the feed-staleness, sequencer-downtime, and underlying-halt haircut. Gate on /liquidation_risk: blocked halts the chain at the liquidation-risk verdict, default proceeds to the adjusted collateral value.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/rhc-collateral-haircut.html',
    regulatory_refs: ['BCBS d349/SCO60 (HQLA)', 'Chainlink staleness + Arbitrum sequencer-uptime best practice'],
    steps: [
      { tool_id: '505-tokenized-collateral-eligibility-checker', handoff: 'DTC/Fed eligibility and Basel HQLA tier feed the repo haircut base.' },
      { tool_id: '508-repo-haircut-collateral-calculator', handoff: 'base_haircut feeds the staleness/halt haircut layer.' },
      {
        tool_id: 'art-320-rhc-collateral-haircut',
        handoff: 'final_haircut, adjusted_collateral_value, and liquidation_risk are the chain output.',
        gate: {
          input: '/liquidation_risk',
          rules: [{ op: 'eq', value: 'blocked', next: 'end' }],
          default: 'end',
        },
      },
    ],
  },
  {
    name: 'rhc-bold-finality-classification',
    domain: DOMAIN,
    title: 'Robinhood Chain BoLD Finality Classification',
    spec_version: '0.8.0',
    wave: WAVE,
    description: 'Gated two-step chain classifying settlement finality on Robinhood Chain. Step 1 classifies the underlying settlement asset finality, step 2 classifies the BoLD challenge-window state. Gate on /claim_verdict: overstated routes to a false-finality-claim flag, default proceeds to the finality class record.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/rhc-bold-finality-classification.html',
    regulatory_refs: ['Arbitrum BoLD (interactive fraud proofs)', 'Arbitrum Orbit dedicated blockchain'],
    steps: [
      { tool_id: 'art-59-settlement-asset-finality-classifier', handoff: 'settlement asset finality classification feeds the BoLD challenge-window check.' },
      {
        tool_id: 'art-321-rhc-bold-finality-classifier',
        handoff: 'finality_class, earliest_final_at, and claim_verdict are the chain output.',
        gate: {
          input: '/claim_verdict',
          rules: [{ op: 'eq', value: 'OVERSTATED', next: 'end' }],
          default: 'end',
        },
      },
    ],
  },
  {
    name: 'rhc-ap-redemption-stress',
    domain: DOMAIN,
    title: 'Robinhood Chain AP Redemption Stress',
    spec_version: '0.8.0',
    wave: WAVE,
    description: 'Single-step chain stress-testing the economic-exposure claim for Robinhood Chain stock tokens against Authorised Participant concentration and redemption-path reachability.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/rhc-ap-redemption-stress.html',
    regulatory_refs: ['docs.robinhood.com/chain/stock-tokens (Authorised Participant / KYB)'],
    steps: [
      { tool_id: 'art-322-rhc-ap-redemption-stress', handoff: 'concentration_risk, redemption_path, and structural_dependencies feed the stress record.' },
    ],
  },
];

g.chains.push(...newChains);

if (!g.wave_summary) g.wave_summary = {};
g.wave_summary['wave_56'] = {
  name: 'Robinhood Chain tokenized-equity verification (RHC-WAVE.a)',
  shipped: '2026-07-16',
  nodes_live: 6,
  live: newNodes.map(n => n.tool_id),
  chains_live: 6,
  chains: newChains.map(c => c.name),
  guide_hub: 'chaingraph/guide-robinhood.html',
  mcp_tools_added: newNodes.map(n => n.mcp_name),
  regulatory_refs: [
    'ERC-8056 (scaled UI amount)',
    'MiCA Art. 2(4)(a) financial-instrument carve-out',
    'MiFID II transferable securities',
    'BCBS d349/SCO60 (HQLA)',
    'Arbitrum BoLD (interactive fraud proofs)',
  ],
  catalysts: [
    'Robinhood Chain mainnet live 2026-07-01, ~95 tokenized stocks at launch, Robinhood Wallet access in 120+ countries',
    'No tooling anywhere for ERC-8056 multiplier reconciliation before this wave',
    'MiCA carve-out inverts the estate default regime tree for the first time (tokenized debt security, not a crypto-asset)',
  ],
  description: '6 new nodes (art-317..322) plus 6 chains for Robinhood Chain stock-token verification: ERC-8056 multiplier reconciliation, financial-instrument regime mapping, valuation double-count linting, halt/staleness collateral haircut, BoLD challenge-window finality classification, and AP concentration/redemption-path stress. Proofs deferred pending the section-18 land session. RHC-0 fit diagnostic and the guide-robinhood.html network guide ship in RHC-WAVE.b. chaingraph.json v1.65.0.',
};

writeFileSync(cgPath, JSON.stringify(g, null, 2) + '\n', 'utf8');
console.log('Done. version:', g.version, 'nodes:', g.nodes.length, 'chains:', g.chains.length);
