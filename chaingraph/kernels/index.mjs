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
// ART Wholesale Tokenized Settlement (wave 13)
import * as art56  from './art-56-tokenized-settlement-fit-diagnostic.kernel.mjs';
import * as art57  from './art-57-deposit-token-compliance-validator.kernel.mjs';
import * as art58  from './art-58-cross-network-settlement-validator.kernel.mjs';
import * as art59  from './art-59-settlement-asset-finality-classifier.kernel.mjs';
// ART Agent Economy Runtime (wave 14)
import * as art60  from './art-60-agent-economy-runtime-fit-diagnostic.kernel.mjs';
import * as art61  from './art-61-x402-batch-settlement-reconciler.kernel.mjs';
import * as art62  from './art-62-ap2-payment-receipt-verifier.kernel.mjs';
import * as art63  from './art-63-agent-service-metering-modeler.kernel.mjs';
// ART AI Governance & Conformity (wave 15)
import * as art64  from './art-64-ai-act-highrisk-fit-diagnostic.kernel.mjs';
import * as art65  from './art-65-ai-conformity-pack-builder.kernel.mjs';
import * as art66  from './art-66-fria-postmarket-monitoring-builder.kernel.mjs';
import * as art67  from './art-67-agentic-ai-risk-classifier.kernel.mjs';
// ART Carbon & Climate Compliance (wave 16)
import * as art68  from './art-68-carbon-compliance-fit-diagnostic.kernel.mjs';
import * as art69  from './art-69-cbam-embedded-emissions-calculator.kernel.mjs';
import * as art70  from './art-70-cbam-default-value-resolver.kernel.mjs';
import * as art71  from './art-71-cbam-certificate-cost-engine.kernel.mjs';
import * as art72  from './art-72-cbam-precursor-emissions-aggregator.kernel.mjs';
import * as art73  from './art-73-taxonomy-alignment-scorer.kernel.mjs';
import * as art74  from './art-74-taxonomy-kpi-gar-aggregator.kernel.mjs';
import * as art75  from './art-75-eugb-factsheet-validator.kernel.mjs';
import * as art76  from './art-76-climate-scenario-applicator.kernel.mjs';
// ART T+1 & CSDR Settlement Discipline (wave 17)
import * as art77  from './art-77-t1-settlement-readiness-diagnostic.kernel.mjs';
import * as art78  from './art-78-csdr-penalty-calculator.kernel.mjs';
import * as art79  from './art-79-settlement-fail-predictor.kernel.mjs';
import * as art80  from './art-80-ssi-conformance-checker.kernel.mjs';
import * as art81  from './art-81-allocation-affirmation-conformance.kernel.mjs';
import * as art82  from './art-82-securities-settlement-message-linter.kernel.mjs';
import * as art83  from './art-83-buy-in-exposure-modeler.kernel.mjs';
import * as art84  from './art-84-settlement-efficiency-kpi.kernel.mjs';
// ART Post-Quantum Cryptography — Protocol Migration (wave 18)
import * as art85  from './art-85-pqc-timeline-fit-diagnostic.kernel.mjs';
import * as art86  from './art-86-tls-pki-migration-planner.kernel.mjs';
import * as art87  from './art-87-iso20022-pqc-readiness-checker.kernel.mjs';
import * as art88  from './art-88-fido-pqc-conformance-checker.kernel.mjs';
import * as art89  from './art-89-blockchain-quantum-risk-classifier.kernel.mjs';
// ART Sanctions & Export-Control Screening Conformance (wave 19)
import * as art90  from './art-90-sanctions-screening-fit-diagnostic.kernel.mjs';
import * as art91  from './art-91-ownership-50pct-aggregator.kernel.mjs';
import * as art92  from './art-92-screening-list-coverage-checker.kernel.mjs';
import * as art93  from './art-93-fuzzy-match-calibration-scorer.kernel.mjs';
import * as art94  from './art-94-eccn-dual-use-classifier.kernel.mjs';
import * as art95  from './art-95-circumvention-diligence-assessor.kernel.mjs';
import * as art96  from './art-96-no-russia-clause-pack-builder.kernel.mjs';
import * as art97  from './art-97-sanctions-screening-quality-scorer.kernel.mjs';
// ART MiCA CASP Lifecycle (wave 20)
import * as art98  from './art-98-mica-casp-fit-diagnostic.kernel.mjs';
import * as art99  from './art-99-mica-transitional-deadline-router.kernel.mjs';
import * as art100 from './art-100-mica-casp-authorization-readiness.kernel.mjs';
import * as art101 from './art-101-mica-art67-own-funds-calculator.kernel.mjs';
import * as art102 from './art-102-crypto-asset-whitepaper-linter.kernel.mjs';
import * as art103 from './art-103-mar-crypto-surveillance-readiness.kernel.mjs';
import * as art104 from './art-104-tfr-travel-rule-batch-validator.kernel.mjs';
import * as art105 from './art-105-mica-token-service-scoper.kernel.mjs';
// ART Tempo / Canton / Arc Extension (wave 21)
import * as art106 from './art-106-tempo-subscription-reconciler.kernel.mjs';
import * as art107 from './art-107-tempo-gas-economics.kernel.mjs';
import * as art108 from './art-108-canton-selective-disclosure.kernel.mjs';
import * as art109 from './art-109-dtc-tokenized-treasury.kernel.mjs';
import * as art110 from './art-110-arc-partner-stablecoin-onboarding.kernel.mjs';
import * as art111 from './art-111-arc-corridor-jurisdiction-router.kernel.mjs';
// ART Provenance Wave (wave 22)
import * as art112 from './art-112-dscsa-transaction-statement-verifier.kernel.mjs';
import * as art113 from './art-113-saleable-returns-verifier.kernel.mjs';
import * as art114 from './art-114-suspect-product-quarantine.kernel.mjs';
import * as art115 from './art-115-dpp-data-carrier-validator.kernel.mjs';
import * as art116 from './art-116-product-lineage-builder.kernel.mjs';
import * as art117 from './art-117-product-authenticity-verifier.kernel.mjs';
import * as art118 from './art-118-fsma204-cte-validator.kernel.mjs';
import * as art119 from './art-119-traceability-lot-code-linker.kernel.mjs';
import * as art120 from './art-120-recall-trace-resolver.kernel.mjs';
import * as art121 from './art-121-document-integrity-anchor.kernel.mjs';
import * as art122 from './art-122-timestamp-attestation-verifier.kernel.mjs';
import * as art123 from './art-123-c2pa-manifest-validator.kernel.mjs';
import * as art124 from './art-124-content-credential-signature-verifier.kernel.mjs';
import * as art125 from './art-125-provenance-ingredient-tree-resolver.kernel.mjs';
import * as art126 from './art-126-ai-act-art50-marking-checker.kernel.mjs';
import * as art127 from './art-127-dual-layer-disclosure-verifier.kernel.mjs';
import * as art128 from './art-128-content-binding-assertion-validator.kernel.mjs';
// ART EU CRA / SBOM / SLSA / OpenVEX (wave 25)
import * as art135 from './art-135-cyclonedx-sbom-validator.kernel.mjs';
import * as art136 from './art-136-slsa-provenance-verifier.kernel.mjs';
import * as art137 from './art-137-openvex-statement-validator.kernel.mjs';
import * as art138 from './art-138-spdx-sbom-validator.kernel.mjs';
import * as art139 from './art-139-cra-annex1-completeness-checker.kernel.mjs';
import * as art140 from './art-140-cra-vuln-reporting-readiness.kernel.mjs';
// ART Web Bot Auth & Agent Identity (wave 24)
import * as art129 from './art-129-webbotauth-signature-verifier.kernel.mjs';
import * as art130 from './art-130-signature-directory-validator.kernel.mjs';
import * as art131 from './art-131-signature-agent-card-validator.kernel.mjs';
import * as art132 from './art-132-agent-key-rotation-auditor.kernel.mjs';
import * as art133 from './art-133-agent-payment-rail-trust-crosswalk.kernel.mjs';
import * as art134 from './art-134-agent-directory-publish-readiness.kernel.mjs';
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
  // ART Wholesale Tokenized Settlement (wave 13)
  'art-56-tokenized-settlement-fit-diagnostic':     art56,
  'art-57-deposit-token-compliance-validator':      art57,
  'art-58-cross-network-settlement-validator':      art58,
  'art-59-settlement-asset-finality-classifier':    art59,
  // ART Agent Economy Runtime (wave 14)
  'art-60-agent-economy-runtime-fit-diagnostic':    art60,
  'art-61-x402-batch-settlement-reconciler':        art61,
  'art-62-ap2-payment-receipt-verifier':            art62,
  'art-63-agent-service-metering-modeler':          art63,
  // ART AI Governance & Conformity (wave 15)
  'art-64-ai-act-highrisk-fit-diagnostic':          art64,
  'art-65-ai-conformity-pack-builder':              art65,
  'art-66-fria-postmarket-monitoring-builder':      art66,
  'art-67-agentic-ai-risk-classifier':              art67,
  // ART Carbon & Climate Compliance (wave 16)
  'art-68-carbon-compliance-fit-diagnostic':        art68,
  'art-69-cbam-embedded-emissions-calculator':      art69,
  'art-70-cbam-default-value-resolver':             art70,
  'art-71-cbam-certificate-cost-engine':            art71,
  'art-72-cbam-precursor-emissions-aggregator':     art72,
  'art-73-taxonomy-alignment-scorer':               art73,
  'art-74-taxonomy-kpi-gar-aggregator':             art74,
  'art-75-eugb-factsheet-validator':                art75,
  'art-76-climate-scenario-applicator':             art76,
  // ART T+1 & CSDR Settlement Discipline (wave 17)
  'art-77-t1-settlement-readiness-diagnostic':      art77,
  'art-78-csdr-penalty-calculator':                 art78,
  'art-79-settlement-fail-predictor':               art79,
  'art-80-ssi-conformance-checker':                 art80,
  'art-81-allocation-affirmation-conformance':      art81,
  'art-82-securities-settlement-message-linter':    art82,
  'art-83-buy-in-exposure-modeler':                 art83,
  'art-84-settlement-efficiency-kpi':               art84,
  // ART Post-Quantum Cryptography — Protocol Migration (wave 18)
  'art-85-pqc-timeline-fit-diagnostic':             art85,
  'art-86-tls-pki-migration-planner':               art86,
  'art-87-iso20022-pqc-readiness-checker':          art87,
  'art-88-fido-pqc-conformance-checker':            art88,
  'art-89-blockchain-quantum-risk-classifier':      art89,
  // ART Sanctions & Export-Control Screening Conformance (wave 19)
  'art-90-sanctions-screening-fit-diagnostic':      art90,
  'art-91-ownership-50pct-aggregator':              art91,
  'art-92-screening-list-coverage-checker':         art92,
  'art-93-fuzzy-match-calibration-scorer':          art93,
  'art-94-eccn-dual-use-classifier':                art94,
  'art-95-circumvention-diligence-assessor':        art95,
  'art-96-no-russia-clause-pack-builder':           art96,
  'art-97-sanctions-screening-quality-scorer':      art97,
  // ART MiCA CASP Lifecycle (wave 20)
  'art-98-mica-casp-fit-diagnostic':              art98,
  'art-99-mica-transitional-deadline-router':     art99,
  'art-100-mica-casp-authorization-readiness':    art100,
  'art-101-mica-art67-own-funds-calculator':      art101,
  'art-102-crypto-asset-whitepaper-linter':       art102,
  'art-103-mar-crypto-surveillance-readiness':    art103,
  'art-104-tfr-travel-rule-batch-validator':      art104,
  'art-105-mica-token-service-scoper':            art105,
  // ART Tempo / Canton / Arc Extension (wave 21)
  'art-106-tempo-subscription-reconciler':        art106,
  'art-107-tempo-gas-economics':                  art107,
  'art-108-canton-selective-disclosure':          art108,
  'art-109-dtc-tokenized-treasury':               art109,
  'art-110-arc-partner-stablecoin-onboarding':    art110,
  'art-111-arc-corridor-jurisdiction-router':     art111,
  // ART Provenance Wave (wave 22)
  'art-112-dscsa-transaction-statement-verifier': art112,
  'art-113-saleable-returns-verifier':            art113,
  'art-114-suspect-product-quarantine':           art114,
  'art-115-dpp-data-carrier-validator':           art115,
  'art-116-product-lineage-builder':              art116,
  'art-117-product-authenticity-verifier':        art117,
  'art-118-fsma204-cte-validator':                art118,
  'art-119-traceability-lot-code-linker':         art119,
  'art-120-recall-trace-resolver':                art120,
  'art-121-document-integrity-anchor':            art121,
  'art-122-timestamp-attestation-verifier':       art122,
  // ART C2PA / AI Content Integrity (wave 23)
  'art-123-c2pa-manifest-validator':              art123,
  'art-124-content-credential-signature-verifier': art124,
  'art-125-provenance-ingredient-tree-resolver':  art125,
  'art-126-ai-act-art50-marking-checker':         art126,
  'art-127-dual-layer-disclosure-verifier':       art127,
  'art-128-content-binding-assertion-validator':  art128,
  // ART EU CRA / SBOM / SLSA / OpenVEX (wave 25)
  'art-135-cyclonedx-sbom-validator':             art135,
  'art-136-slsa-provenance-verifier':             art136,
  'art-137-openvex-statement-validator':          art137,
  'art-138-spdx-sbom-validator':                  art138,
  'art-139-cra-annex1-completeness-checker':      art139,
  'art-140-cra-vuln-reporting-readiness':         art140,
  // ART Web Bot Auth & Agent Identity (wave 24)
  'art-129-webbotauth-signature-verifier':        art129,
  'art-130-signature-directory-validator':        art130,
  'art-131-signature-agent-card-validator':       art131,
  'art-132-agent-key-rotation-auditor':           art132,
  'art-133-agent-payment-rail-trust-crosswalk':   art133,
  'art-134-agent-directory-publish-readiness':    art134,
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
