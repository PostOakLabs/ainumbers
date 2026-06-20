// Kernel registry — maps a ChainGraph node tool_id to its pure decision kernel.
// The Worker imports this and dispatches gpu:false nodes to compute server-side.
// generate.mjs (server repo) vendors repo/chaingraph/kernels/ into data/kernels/.
// As each gpu:false node is ported (Workstream A), add one line here.

import * as art02  from './art-02-agent-spend-policy-simulator.kernel.mjs';
import * as art07  from './art-07-basel31-reporting-delta-calculator.kernel.mjs';
import * as art08  from './art-08-en16931-einvoice-batch-validator.kernel.mjs';
import * as art10  from './art-10-amla-transaction-typology-risk-scorer.kernel.mjs';
import * as art01  from './art-01-ap2-mandate-chain-validator.kernel.mjs';
import * as art03  from './art-03-x402-settlement-modeler.kernel.mjs';
import * as art04  from './art-04-agent-identity-attestation-checker.kernel.mjs';
import * as art05  from './art-05-eu-ai-act-credit-scoring-conformity.kernel.mjs';
import * as art06  from './art-06-genius-act-reserve-attestation.kernel.mjs';
import * as art09  from './art-09-dora-incident-classifier.kernel.mjs';
import * as art11  from './art-11-vop-batch-match-rate-analyser.kernel.mjs';
import * as art12  from './art-12-acp-checkout-conformance-validator.kernel.mjs';
import * as art13  from './art-13-eudi-wallet-credential-readiness-checker.kernel.mjs';
import * as art14  from './art-14-psd3-psr-readiness-checker.kernel.mjs';
import * as art19  from './art-19-agentic-checkout-protocol-selector.kernel.mjs';
import * as art20  from './art-20-acp-ucp-product-feed-conformance-auditor.kernel.mjs';
import * as art21  from './art-21-agent-traffic-acceptance-policy-builder.kernel.mjs';
import * as art22  from './art-22-agentic-payments-protocol-comparator.kernel.mjs';
import * as art23  from './art-23-visa-trusted-agent-protocol-inspector.kernel.mjs';
import * as art24  from './art-24-mastercard-agentic-token-builder.kernel.mjs';
import * as art25  from './art-25-a2a-agent-card-validator.kernel.mjs';
import * as art26  from './art-26-x402-payload-decoder-flow-simulator.kernel.mjs';
import * as art27  from './art-27-agentic-readiness-diagnostic.kernel.mjs';
import * as art28  from './art-28-mcp-server-deployability-diagnostic.kernel.mjs';
import * as art29  from './art-29-dora-readiness-diagnostic.kernel.mjs';
import * as art30  from './art-30-agent-commerce-conformance-validator.kernel.mjs';
import * as art31  from './art-31-a2a-x402-extension-mandate-validator.kernel.mjs';
import * as art32  from './art-32-a2a-agent-card-trust-chain-validator.kernel.mjs';
import * as art33  from './art-33-mcp-server-self-attestation-pack.kernel.mjs';
import * as art34  from './art-34-tempo-fit-diagnostic.kernel.mjs';
import * as art35  from './art-35-tempo-payments-business-case.kernel.mjs';
import * as art36  from './art-36-tempo-mpp-agent-mandate.kernel.mjs';
import * as art37  from './art-37-tempo-stablecoin-issuance.kernel.mjs';
import * as art38  from './art-38-tempo-onchain-aml.kernel.mjs';
import * as art39  from './art-39-tempo-zone-disclosure.kernel.mjs';
import * as art40  from './art-40-tempo-agentic-checkout.kernel.mjs';
import * as art41  from './art-41-tempo-validator-readiness.kernel.mjs';
import * as art42  from './art-42-arc-fit-diagnostic.kernel.mjs';
import * as art43  from './art-43-arc-cpn-model.kernel.mjs';
import * as art44  from './art-44-arc-stablefx-model.kernel.mjs';
import * as art45  from './art-45-arc-xreserve-linter.kernel.mjs';
import * as art46  from './art-46-arc-paymaster-model.kernel.mjs';
import * as art47  from './art-47-arc-cctp-transfer.kernel.mjs';
import * as art48  from './art-48-treasury-clearing-fit-diagnostic.kernel.mjs';
import * as art49  from './art-49-clearing-access-model-selector.kernel.mjs';
import * as art50  from './art-50-ficc-margin-netting-estimator.kernel.mjs';
import * as art51  from './art-51-cross-margining-benefit-estimator.kernel.mjs';
// ART Digital Trade / MLETR (wave 12)
import * as art52  from './art-52-digital-trade-fit-diagnostic.kernel.mjs';
import * as art53  from './art-53-mletr-ebl-conformance-validator.kernel.mjs';
import * as art54  from './art-54-digital-trade-rules-checker.kernel.mjs';
import * as art55  from './art-55-trade-document-provenance-verifier.kernel.mjs';
import * as t503   from './503-canton-tokenization-readiness-diagnostic.kernel.mjs';
import * as t504   from './504-settlement-risk-capital-optimizer.kernel.mjs';
import * as t505   from './505-tokenized-collateral-eligibility-checker.kernel.mjs';
import * as t506   from './506-onchain-cash-leg-finality-checker.kernel.mjs';
import * as t507   from './507-canton-dvp-atomicity-validator.kernel.mjs';
import * as t508   from './508-repo-haircut-collateral-calculator.kernel.mjs';
import * as t509   from './509-canton-party-allowlist-validator.kernel.mjs';
import * as t510   from './510-digital-asset-regulatory-classifier.kernel.mjs';
import * as t511   from './511-multi-currency-pvp-validator.kernel.mjs';
import * as t512   from './512-tokenized-security-lifecycle-validator.kernel.mjs';
import * as t513   from './513-margin-call-collateral-mobilizer.kernel.mjs';
import * as t514   from './514-tokenized-fund-collateral-validator.kernel.mjs';
import * as t515   from './515-collateral-swap-eligibility-validator.kernel.mjs';
import * as cry01  from './cry-01-zk-compliance-proof-generator.kernel.mjs';
import * as cry04  from './cry-04-merkle-batch-verifier.kernel.mjs';
import * as cry05  from './cry-05-agent-action-audit-trail-aggregator.kernel.mjs';
import * as ml02   from './ml-02-credit-default-risk-scorer.kernel.mjs';
import * as ml01   from './ml-01-isolation-forest.kernel.mjs';
import * as ml03   from './ml-03-timeseries-anomaly-detector.kernel.mjs';
import * as mms03  from './mms-03-app-fraud-graph.kernel.mjs';
import * as pnr01  from './pnr-01-dora-ict-cascade-simulator.kernel.mjs';
import * as ptg01  from './ptg-01-ap2-prompt-template-generator.kernel.mjs';
import * as qfa01  from './qfa-01-options-greeks.kernel.mjs';
import * as qfa02  from './qfa-02-portfolio-var-engine.kernel.mjs';
import * as qfa03  from './qfa-03-stress-test-engine.kernel.mjs';
import * as qfa04  from './qfa-04-xva-cva-calculator.kernel.mjs';
import * as rca01  from './rca-01-frtb-ima-pre-validator.kernel.mjs';
import * as rca02  from './rca-02-mica-reserve-stress.kernel.mjs';
import * as rca03  from './rca-03-iso20022-address-migration-verifier.kernel.mjs';
import * as sim01  from './sim-01-lcr-nsfr-liquidity-stress-test.kernel.mjs';
import * as sim03  from './sim-03-basel-rwa-scenario-modeler.kernel.mjs';
import * as sim07  from './sim-07-open-banking-consent-flow-stress.kernel.mjs';

export const KERNELS = {
  // ART series — agent / agentic payments / compliance
  'art-02-agent-spend-policy-simulator':             art02,
  'art-07-basel31-reporting-delta-calculator':       art07,
  'art-08-en16931-einvoice-batch-validator':         art08,
  'art-10-amla-transaction-typology-risk-scorer':    art10,
  'art-01-ap2-mandate-chain-validator':              art01,
  'art-03-x402-settlement-modeler':                  art03,
  'art-04-agent-identity-attestation-checker':       art04,
  'art-05-eu-ai-act-credit-scoring-conformity':      art05,
  'art-06-genius-act-reserve-attestation':           art06,
  'art-09-dora-incident-classifier':                 art09,
  'art-11-vop-batch-match-rate-analyser':            art11,
  'art-12-acp-checkout-conformance-validator':       art12,
  'art-13-eudi-wallet-credential-readiness-checker': art13,
  'art-14-psd3-psr-readiness-checker':               art14,
  'art-19-agentic-checkout-protocol-selector':       art19,
  'art-20-acp-ucp-product-feed-conformance-auditor': art20,
  'art-21-agent-traffic-acceptance-policy-builder':  art21,
  'art-22-agentic-payments-protocol-comparator':     art22,
  'art-23-visa-trusted-agent-protocol-inspector':    art23,
  'art-24-mastercard-agentic-token-builder':         art24,
  'art-25-a2a-agent-card-validator':                 art25,
  'art-26-x402-payload-decoder-flow-simulator':      art26,
  'art-27-agentic-readiness-diagnostic':             art27,
  'art-28-mcp-server-deployability-diagnostic':      art28,
  'art-29-dora-readiness-diagnostic':                art29,
  'art-30-agent-commerce-conformance-validator':     art30,
  'art-31-a2a-x402-extension-mandate-validator':     art31,
  'art-32-a2a-agent-card-trust-chain-validator':     art32,
  'art-33-mcp-server-self-attestation-pack':         art33,
  // ART Tempo series (waves 8–9)
  'art-34-tempo-fit-diagnostic':                     art34,
  'art-35-tempo-payments-business-case':             art35,
  'art-36-tempo-mpp-agent-mandate':                  art36,
  'art-37-tempo-stablecoin-issuance':                art37,
  'art-38-tempo-onchain-aml':                        art38,
  'art-39-tempo-zone-disclosure':                    art39,
  'art-40-tempo-agentic-checkout':                   art40,
  'art-41-tempo-validator-readiness':                art41,
  // ART Arc Network (wave 10)
  'art-42-arc-fit-diagnostic':                      art42,
  'art-43-arc-cpn-model':                           art43,
  'art-44-arc-stablefx-model':                      art44,
  'art-45-arc-xreserve-linter':                     art45,
  'art-46-arc-paymaster-model':                     art46,
  'art-47-arc-cctp-transfer':                       art47,
  // ART Treasury Clearing / FICC (wave 11)
  'art-48-treasury-clearing-fit-diagnostic':        art48,
  'art-49-clearing-access-model-selector':          art49,
  'art-50-ficc-margin-netting-estimator':           art50,
  'art-51-cross-margining-benefit-estimator':       art51,
  // ART Digital Trade / MLETR (wave 12)
  'art-52-digital-trade-fit-diagnostic':            art52,
  'art-53-mletr-ebl-conformance-validator':         art53,
  'art-54-digital-trade-rules-checker':             art54,
  'art-55-trade-document-provenance-verifier':      art55,
  // T-series — capital markets / tokenization
  '503-canton-tokenization-readiness-diagnostic':    t503,
  '504-settlement-risk-capital-optimizer':           t504,
  '505-tokenized-collateral-eligibility-checker':    t505,
  '506-onchain-cash-leg-finality-checker':           t506,
  '507-canton-dvp-atomicity-validator':              t507,
  '508-repo-haircut-collateral-calculator':          t508,
  '509-canton-party-allowlist-validator':            t509,
  '510-digital-asset-regulatory-classifier':         t510,
  '511-multi-currency-pvp-validator':                t511,
  '512-tokenized-security-lifecycle-validator':      t512,
  '513-margin-call-collateral-mobilizer':            t513,
  '514-tokenized-fund-collateral-validator':         t514,
  '515-collateral-swap-eligibility-validator':       t515,
  // CRY / ML / MMS / PNR / PTG / QFA / RCA / SIM prefixes
  'cry-01-zk-compliance-proof-generator':            cry01,
  'cry-04-merkle-batch-verifier':                    cry04,
  'cry-05-agent-action-audit-trail-aggregator':      cry05,
  'ml-01-isolation-forest':                          ml01,
  'ml-02-credit-default-risk-scorer':                ml02,
  'ml-03-timeseries-anomaly-detector':               ml03,
  'mms-03-app-fraud-graph':                          mms03,
  'pnr-01-dora-ict-cascade-simulator':               pnr01,
  'ptg-01-ap2-prompt-template-generator':            ptg01,
  'qfa-01-options-greeks':                           qfa01,
  'qfa-02-portfolio-var-engine':                     qfa02,
  'qfa-03-stress-test-engine':                       qfa03,
  'qfa-04-xva-cva-calculator':                       qfa04,
  'rca-01-frtb-ima-pre-validator':                   rca01,
  'rca-02-mica-reserve-stress':                      rca02,
  'rca-03-iso20022-address-migration-verifier':      rca03,
  'sim-01-lcr-nsfr-liquidity-stress-test':           sim01,
  'sim-03-basel-rwa-scenario-modeler':               sim03,
  'sim-07-open-banking-consent-flow-stress':         sim07,
};

export function getKernel(tool_id) {
  return KERNELS[tool_id] ?? null;
}
