/**
 * bootstrap-fixtures.mjs — generate minimal fixture stubs for all 45 remediated gpu:false kernels.
 *
 * For each kernel listed here:
 *   1. Calls compute(sample_pp) with a minimal valid input
 *   2. Writes fixtures/<tool_id>.fixtures.json with ONE vector (name: "minimal")
 *   3. Skips any fixture file that already has vectors (never overwrites existing good fixtures)
 *
 * golden_hash is left as "" — run `node golden-parity.test.mjs --update` to fill it in.
 *
 * Usage: node bootstrap-fixtures.mjs
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(HERE, 'fixtures');
if (!existsSync(FIXTURES_DIR)) mkdirSync(FIXTURES_DIR, { recursive: true });

// ──────────────────────────────────────────────────────────────────────────────
// Sample inputs per kernel
// ──────────────────────────────────────────────────────────────────────────────
const SAMPLES = {
  'art-13-eudi-wallet-credential-readiness-checker': {
    credential_type: 'eaa', format: 'sd_jwt_vc', issuer_country: 'DE', sd: true, pop: true, rev: true,
  },
  'art-14-psd3-psr-readiness-checker': {
    instType: 'payment_institution', jurisdiction: 'eu_single', psd2Status: 'mostly_compliant',
    openBankingLevel: 'ob_testing', tppTypes: ['tpp_pisp'], scaExemptions: ['sca_low_value'],
    consentMaturity: 'standard', openFinance: ['of_none'], fraudLiability: 'shared', baasScope: 'none',
  },
  'art-19-agentic-checkout-protocol-selector': {
    platform: 'custom', buyer_type: 'agent', aov: 'mid', agent_appetite: 'high', geo: 'global',
    tech_cap: 'api', stack_card: false, stack_crypto: false,
  },
  'art-20-acp-ucp-product-feed-conformance-auditor': {
    payload: { product_id: 'p-001', name: 'Widget', price: 9.99, currency: 'USD', merchant_id: 'm-001' },
    payload_type: 'product', audit_target: 'acp',
  },
  'art-21-agent-traffic-acceptance-policy-builder': {
    agent_types: ['openai'], verification_level: 'ap2_vdc', max_tx_per_min: 60, max_tx_per_day: 5000,
    max_single_val_usd: 100, max_daily_val_usd: 1000, rails: ['acp', 'x402'],
    refund_posture: 'standard', retry_policy: 'retry_1x', block_rules: ['block_burst', 'block_anon_high'],
  },
  'art-22-agentic-payments-protocol-comparator': {
    protocols: ['ap2', 'acp'], scenario: 'cross_merchant',
  },
  'art-23-visa-trusted-agent-protocol-inspector': {
    signature_input: 'sig1=("@method" "@target-uri");created=1750000000;expires=1750003600;nonce=abc123;keyid=agent-key-1;alg=ed25519;tag=trusted-agent',
    signature: 'sig1=:abc123base64=:',
  },
  'art-24-mastercard-agentic-token-builder': {
    token_scope: {
      agentId: 'agent:test:v1',
      merchantScope: ['merchant-001'],
      consentPolicy: { perTransactionLimit: 50, totalLimit: 500, expiresAt: 1780000000 },
    },
  },
  'art-25-a2a-agent-card-validator': {
    agent_card: {
      name: 'Test Agent', description: 'A test payment agent', url: 'https://agent.example.com', version: '1.0',
      protocolVersion: '1.0', capabilities: { streaming: false, pushNotifications: false, extensions: [] },
      defaultInputModes: ['text/plain'], defaultOutputModes: ['application/json'],
      skills: [{ id: 'pay', name: 'Payment', description: 'Execute payments', tags: ['payment'] }],
    },
  },
  'art-26-x402-payload-decoder-flow-simulator': {
    header_or_payload: '{"scheme":"exact","network":"base-sepolia","payload":{"signature":"0xabc123"}}',
  },
  'art-27-agentic-readiness-diagnostic': {
    q1: 'yes', q2: 'yes', q3: 'yes', q4: 'yes', q5: 'yes', q6: 'yes',
    q7: 'yes', q8: 'yes', q9: 'yes', q10: 'yes', q11: 'yes', q12: 'yes',
  },
  'art-28-mcp-server-deployability-diagnostic': {
    q1: 'yes', q2: 'yes', q3: 'yes', q4: 'yes', q5: 'yes', q6: 'yes',
    q7: 'yes', q8: 'yes', q9: 'yes', q10: 'yes', q11: 'yes', q12: 'yes',
  },
  'art-30-agent-commerce-conformance-validator': {
    ap2_mandate_trio: {
      intent: {
        mandate_type: 'intent', mandate_id: 'intent-001', expires_at: '2026-12-31T00:00:00Z',
        scope: { merchant_ids: ['merchant-001'], currency: 'USD', max_amount: 500 },
        human_not_present: true, issuer_id: 'issuer:test',
      },
      payment: {
        mandate_type: 'payment', mandate_id: 'pay-001', parent_mandate_id: 'intent-001',
        parent_hash: 'a'.repeat(64), amount: 100, currency: 'USD',
        human_not_present: true, payment_method: 'card',
      },
    },
  },
  'art-31-a2a-x402-extension-mandate-validator': {
    agent_card: {
      capabilities: {
        extensions: [{
          uri: 'https://ainumbers.co/x402/v1',
          params: {
            payment_authority: { scope: ['payment'], max_amount: 1000, asset: 'USDC' },
            settlement_rail: { scheme: 'exact', network: 'base-sepolia', asset: 'USDC' },
          },
        }],
      },
    },
    payment_payload: {
      scheme: 'exact', network: 'base-sepolia', maxAmountRequired: '500',
      resource: 'https://api.example.com/pay', payTo: '0xabc123', asset: 'USDC',
    },
    mandate_cap: { max_amount: 1000, asset: 'USDC' },
  },
  'art-32-a2a-agent-card-trust-chain-validator': {
    agent_card: {
      name: 'Test Agent', url: 'https://agent.example.com', version: '1.0', protocolVersion: '1.0',
      capabilities: { streaming: false },
      skills: [{ id: 'pay', name: 'Payment' }],
      signatures: [{ protected: 'eyJhbGciOiJFZERTQSJ9', signature: 'abc123' }],
    },
    delegation_chain: [],
    spend_policy: { per_tx_cap: 100, daily_cap: 1000 },
  },
  'art-33-mcp-server-self-attestation-pack': {
    tool_definition: {
      name: 'test_tool',
      description: 'Do not use this unless you need to test the attestation pack. Only for testing.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The query to process' } },
      },
      annotations: { readOnlyHint: true },
    },
    server_json: {
      $schema: 'https://json.schemastore.org/mcp-server.schema.json',
      name: 'com.example.test-server',
      version: '1.0.0',
      remotes: [{ url: 'https://mcp.example.com/mcp', type: 'sse' }],
    },
    oauth_flags: { has_prm: true, audience_bound: true, pkce: true, https_only: true },
    security_flags: { read_only_hints: true, input_schemas_typed: true, no_secrets_in_descriptions: true },
  },
  'art-34-tempo-fit-diagnostic': {
    q1_regulatory_approval: 'yes', q2_reserve_management: 'yes', q3_attestation_readiness: 'yes',
    q4_payment_volume: 'no', q5_cross_border_volume: 'no', q6_settlement_latency_requirement: 'no',
    q7_agent_payments_live: 'no', q8_mpp_integration: 'no', q9_api_key_management: 'no',
    q10_merchant_acceptance: 'no', q11_checkout_flow: 'no', q12_refund_handling: 'no',
  },
  'art-35-tempo-payments-business-case': {
    rail: 'swift', stablecoin: 'usdc', tx_amount_usd: 10000, monthly_volume: 500, impl_months: 3,
  },
  'art-36-tempo-mpp-agent-mandate': {
    agentDid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
    merchant: 'merchant-001', spendCap: 25, duration: '8h',
    rail: 'tempo_stablecoin', stablecoin: 'USDC', cadence: 'per-request',
  },
  'art-37-tempo-stablecoin-issuance': {
    tokenName: 'TestUSD', currencyCode: 'USD', supplyCap: 1000000,
    issuerLei: 'TEST0000000000000000', memoPolicy: 'required',
    roleIssuer: true, rolePause: true, roleBurnBlocked: true,
    yieldEnabled: false, allowlistEnabled: true, blocklistEnabled: true,
    freezeEnabled: true, ofacEnabled: true,
  },
  'art-38-tempo-onchain-aml': {
    transfers: [
      {
        tx_ref: 'tx-001', amount_usd: 1000, originator_name: 'Alice Corp',
        originator_vasp: 'vasp-001', beneficiary_name: 'Bob Ltd',
        beneficiary_vasp: 'vasp-002', memo: 'Invoice INV-001',
      },
    ],
    tr_threshold: 3000, sar_threshold: 5000,
  },
  'art-39-tempo-zone-disclosure': {
    opSeesAll: true, userSeesOwn: true, outsidersZK: true,
    tip403Allow: true, tip403Block: true, tip403Freeze: true, tip403Mainnet: true,
    amlTravel: true, amlSAR: true, amlOFAC: true, amlAudit: true,
    operatorName: 'Test Operator', useCase: 'payments',
  },
  'art-40-tempo-agentic-checkout': {
    protocol: 'ACP', rawRef: 'ORD-TEST-001', senderName: 'Alice', receiverName: 'Bob',
    amount: 500, stablecoin: 'USDC',
  },
  'art-41-tempo-validator-readiness': {
    q1_cpu_cores: 'yes', q2_ram_gb: 'yes', q3_nvme_1gbps: 'yes',
    q4_linux_glibc: 'yes', q5_ntp_chrony: 'yes', q6_ports_open: 'yes',
    q7_ed25519_keypair: 'yes', q8_key_tempo_contact: 'yes',
    q9_port9000_scraping: 'yes', q10_alerting: 'yes',
    q11_7day_sla: 'yes', q12_runbook: 'yes',
  },
  '503-canton-tokenization-readiness-diagnostic': {
    q1: 'yes', q2: 'yes', q3: 'no', q4: 'no', q5: 'no', q6: 'no',
    q7: 'no', q8: 'no', q9: 'no', q10: 'no', q11: 'no', q12: 'no',
  },
  '504-settlement-risk-capital-optimizer': {
    positions: [
      { instrument: 'IR Swap 5Y', notional_usd: 10000000, rating: 'aaa', settlement_type: 't0' },
    ],
    cet1_ratio: 0.125, cost_of_capital: 0.10,
  },
  '505-tokenized-collateral-eligibility-checker': {
    asset_type: 'ust', notional: 1000000,
    transfer_restrictions: {}, custody_linkage: 'dtc',
  },
  '506-onchain-cash-leg-finality-checker': {
    finality_model: 'atomic_dvp_bound', jurisdiction: 'us',
    reserve_attestation: true, cash_pct: 60, tbills_pct: 35, repo_pct: 5,
    depeg_bps: 2, redemption_window: 't0',
  },
  '507-canton-dvp-atomicity-validator': {
    settlement_mechanism: 'atomic_dvp', platform: 'canton_daml',
    finality_type: 'irrevocable_realtime', unwind_protection: true,
    cash_type: 'cbdc', settlement_amount: 1000000, currency: 'USD',
  },
  '508-repo-haircut-collateral-calculator': {
    collateral_type: 'ust_10y', notional_usd: 10000000,
    tenor: 'overnight', cross_border: false, counterparty_type: 'bank',
    canton247: true, concentration_pct: 10,
  },
  '509-canton-party-allowlist-validator': {
    parties: [
      {
        party_name: 'Test Bank Ltd', lei: 'TEST0000000000000001',
        daml_party_id: 'TestBank::AAAA', daml_party_id_known: true,
        fatf_status: 'clean', pep: false, adverse_media: false, canton_access: 'granted',
      },
    ],
  },
  '510-digital-asset-regulatory-classifier': {
    asset_type: 'stablecoin_usd', issuer_jurisdiction: 'us', issuer_type: 'bank',
    transfer_value: true, redeemable_par: true, economic_rights: false,
    market_cap_eur: null, on_dlt: true,
  },
  '511-multi-currency-pvp-validator': {
    legs: [{ ccy_sold: 'USD', ccy_bought: 'EUR', notional: 1000000, implied_rate: 0.92 }],
    atomicity_type: 'atomic_pvp', finality_type: 'irrevocable_realtime',
    has_unwind_procedure: true, canton_leg: true,
  },
  '512-tokenized-security-lifecycle-validator': {
    security_type: 'ust', jurisdiction: 'us', issuance_amount: 1000000,
    isin_assigned: true, daml_lifecycle_defined: true, custodian_type: 'qualified_custodian',
    covered_events: ['issuance', 'coupon_payment', 'maturity_redemption'], prospectus_filed: false,
  },
  '513-margin-call-collateral-mobilizer': {
    instrument_type: 'interest_rate_swap', portfolio_mtm: -500000,
    aana: 500000000, ccp_cleared: false, mta: 500000,
    collateral_rows: [
      { asset_type: 'ust', notional: 2000000, already_posted: false },
    ],
    on_chain: false,
  },
  '514-tokenized-fund-collateral-validator': {
    fund_type: 'sec_govt_mmf', total_fund_value: 1000000,
    daily_liquid_assets_pct: 30, weekly_liquid_assets_pct: 60, nav: 1.0,
    collateral_use: 'lender_collateral', platform: 'canton_benji',
    sftr_consent: true, reuse_flag: false, provider_informed: true,
    cp_jurisdiction: 'us',
  },
  '515-collateral-swap-eligibility-validator': {
    asset_a: 'ig_corp_bond', asset_b: 'ust',
    notional_a: 1000000, notional_b: 950000,
    haircut_a: 50, haircut_b: 0,
    declared_direction: 'UPGRADE',
    governing_agreement: 'gmra', reuse_flag: false,
    sftr_consent: false, provider_informed: false,
    counterparty_jurisdiction: 'us',
  },
  'cry-04-merkle-batch-verifier': {
    proof_entries: [],
    merkle_root: '0000000000000000000000000000000000000000000000000000000000000000',
  },
  'cry-05-agent-action-audit-trail-aggregator': {
    artifacts: [],
  },
  'ml-01-isolation-forest': {
    n_transactions: 200, contamination_rate: 0.05, seed: 42, n_trees: 5,
    subsample_size: 64, threshold: 0.60,
  },
  'ml-03-timeseries-anomaly-detector': {
    nPeriods: 90, seasonPeriod: 7, windowSize: 14, zThreshold: 3.0,
    nAnomalies: 2, trendType: 'flat', seed: 42,
  },
  'ptg-01-ap2-prompt-template-generator': {
    artifact_json: null, task: 'plain_english_summary', audience: 'board',
    tone: 'formal', include_citations: true,
  },
  'qfa-01-options-greeks': {
    spot: 100, strike: 100, expiry_days: 90, vol: 20, rate: 5, div_yield: 0, type: 'call',
  },
  'rca-01-frtb-ima-pre-validator': {
    nPositions: 20, nScenarios: 500, confidenceLevel: 0.975,
    nRiskClasses: 3, nmrfRate: 0.05, seed: 42,
  },
  'sim-07-open-banking-consent-flow-stress': {
    nConsents: 500, seed: 42, regime: 'psd2',
    pRedirectFail: 0.03, pAuthFail: 0.08, pTokenFail: 0.02, pExpiry: 0.05, pRevoke: 0.04,
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Kernel imports
// ──────────────────────────────────────────────────────────────────────────────
const KERNEL_FILES = {
  'art-13-eudi-wallet-credential-readiness-checker':    './art-13-eudi-wallet-credential-readiness-checker.kernel.mjs',
  'art-14-psd3-psr-readiness-checker':                  './art-14-psd3-psr-readiness-checker.kernel.mjs',
  'art-19-agentic-checkout-protocol-selector':          './art-19-agentic-checkout-protocol-selector.kernel.mjs',
  'art-20-acp-ucp-product-feed-conformance-auditor':    './art-20-acp-ucp-product-feed-conformance-auditor.kernel.mjs',
  'art-21-agent-traffic-acceptance-policy-builder':     './art-21-agent-traffic-acceptance-policy-builder.kernel.mjs',
  'art-22-agentic-payments-protocol-comparator':        './art-22-agentic-payments-protocol-comparator.kernel.mjs',
  'art-23-visa-trusted-agent-protocol-inspector':       './art-23-visa-trusted-agent-protocol-inspector.kernel.mjs',
  'art-24-mastercard-agentic-token-builder':            './art-24-mastercard-agentic-token-builder.kernel.mjs',
  'art-25-a2a-agent-card-validator':                    './art-25-a2a-agent-card-validator.kernel.mjs',
  'art-26-x402-payload-decoder-flow-simulator':         './art-26-x402-payload-decoder-flow-simulator.kernel.mjs',
  'art-27-agentic-readiness-diagnostic':                './art-27-agentic-readiness-diagnostic.kernel.mjs',
  'art-28-mcp-server-deployability-diagnostic':         './art-28-mcp-server-deployability-diagnostic.kernel.mjs',
  'art-30-agent-commerce-conformance-validator':        './art-30-agent-commerce-conformance-validator.kernel.mjs',
  'art-31-a2a-x402-extension-mandate-validator':        './art-31-a2a-x402-extension-mandate-validator.kernel.mjs',
  'art-32-a2a-agent-card-trust-chain-validator':        './art-32-a2a-agent-card-trust-chain-validator.kernel.mjs',
  'art-33-mcp-server-self-attestation-pack':            './art-33-mcp-server-self-attestation-pack.kernel.mjs',
  'art-34-tempo-fit-diagnostic':                        './art-34-tempo-fit-diagnostic.kernel.mjs',
  'art-35-tempo-payments-business-case':                './art-35-tempo-payments-business-case.kernel.mjs',
  'art-36-tempo-mpp-agent-mandate':                     './art-36-tempo-mpp-agent-mandate.kernel.mjs',
  'art-37-tempo-stablecoin-issuance':                   './art-37-tempo-stablecoin-issuance.kernel.mjs',
  'art-38-tempo-onchain-aml':                           './art-38-tempo-onchain-aml.kernel.mjs',
  'art-39-tempo-zone-disclosure':                       './art-39-tempo-zone-disclosure.kernel.mjs',
  'art-40-tempo-agentic-checkout':                      './art-40-tempo-agentic-checkout.kernel.mjs',
  'art-41-tempo-validator-readiness':                   './art-41-tempo-validator-readiness.kernel.mjs',
  '503-canton-tokenization-readiness-diagnostic':       './503-canton-tokenization-readiness-diagnostic.kernel.mjs',
  '504-settlement-risk-capital-optimizer':              './504-settlement-risk-capital-optimizer.kernel.mjs',
  '505-tokenized-collateral-eligibility-checker':       './505-tokenized-collateral-eligibility-checker.kernel.mjs',
  '506-onchain-cash-leg-finality-checker':              './506-onchain-cash-leg-finality-checker.kernel.mjs',
  '507-canton-dvp-atomicity-validator':                 './507-canton-dvp-atomicity-validator.kernel.mjs',
  '508-repo-haircut-collateral-calculator':             './508-repo-haircut-collateral-calculator.kernel.mjs',
  '509-canton-party-allowlist-validator':               './509-canton-party-allowlist-validator.kernel.mjs',
  '510-digital-asset-regulatory-classifier':            './510-digital-asset-regulatory-classifier.kernel.mjs',
  '511-multi-currency-pvp-validator':                   './511-multi-currency-pvp-validator.kernel.mjs',
  '512-tokenized-security-lifecycle-validator':         './512-tokenized-security-lifecycle-validator.kernel.mjs',
  '513-margin-call-collateral-mobilizer':               './513-margin-call-collateral-mobilizer.kernel.mjs',
  '514-tokenized-fund-collateral-validator':            './514-tokenized-fund-collateral-validator.kernel.mjs',
  '515-collateral-swap-eligibility-validator':          './515-collateral-swap-eligibility-validator.kernel.mjs',
  'cry-04-merkle-batch-verifier':                       './cry-04-merkle-batch-verifier.kernel.mjs',
  'cry-05-agent-action-audit-trail-aggregator':         './cry-05-agent-action-audit-trail-aggregator.kernel.mjs',
  'ml-01-isolation-forest':                             './ml-01-isolation-forest.kernel.mjs',
  'ml-03-timeseries-anomaly-detector':                  './ml-03-timeseries-anomaly-detector.kernel.mjs',
  'ptg-01-ap2-prompt-template-generator':               './ptg-01-ap2-prompt-template-generator.kernel.mjs',
  'qfa-01-options-greeks':                              './qfa-01-options-greeks.kernel.mjs',
  'rca-01-frtb-ima-pre-validator':                      './rca-01-frtb-ima-pre-validator.kernel.mjs',
  'sim-07-open-banking-consent-flow-stress':            './sim-07-open-banking-consent-flow-stress.kernel.mjs',
};

let written = 0, skipped = 0, errored = 0;

for (const [toolId, kernelPath] of Object.entries(KERNEL_FILES)) {
  const fixtureFile = resolve(FIXTURES_DIR, `${toolId}.fixtures.json`);

  // Skip if fixture already has vectors
  if (existsSync(fixtureFile)) {
    try {
      const existing = JSON.parse(readFileSync(fixtureFile, 'utf8'));
      if (Array.isArray(existing.vectors) && existing.vectors.length > 0) {
        console.log(`⏭  ${toolId} — fixture already has ${existing.vectors.length} vector(s), skipping`);
        skipped++;
        continue;
      }
    } catch { /* file exists but invalid JSON — overwrite */ }
  }

  const samplePp = SAMPLES[toolId];
  if (!samplePp) {
    console.warn(`⚠  ${toolId} — no sample input defined, skipping`);
    skipped++;
    continue;
  }

  try {
    const mod = await import(kernelPath);
    const result = mod.compute(samplePp);

    // result should be { output_payload, compliance_flags }
    const outputPayload = result.output_payload ?? result;

    const fixture = {
      tool_id: toolId,
      note: 'golden_hash is empty until first `node golden-parity.test.mjs --update`.',
      vectors: [
        {
          name: 'minimal',
          policy_parameters: samplePp,
          output_payload: outputPayload,
          golden_hash: '',
        },
      ],
    };

    writeFileSync(fixtureFile, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
    console.log(`✓  ${toolId}`);
    written++;
  } catch (err) {
    console.error(`✗  ${toolId} — ${err.message}`);
    errored++;
  }
}

console.log(`\nDone: ${written} written, ${skipped} skipped, ${errored} errored.`);
if (errored) process.exit(1);
