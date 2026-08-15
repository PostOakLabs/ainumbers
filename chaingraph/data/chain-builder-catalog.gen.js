// GENERATED FILE — do not hand-edit. Regenerate: node scripts/gen-chainbuilder-catalog.mjs
// Source: chaingraph.json (609 nodes). Loaded via <script src> tag, not runtime
// fetch — see CHAINBUILDER-CATALOG-BUILD-SPEC.md §1 for why (CSP connect-src:'none').
window.CHAINBUILDER_CATALOG = [
  {
    "tool_id": "503-canton-tokenization-readiness-diagnostic",
    "display_name": "Canton Tokenization Readiness Diagnostic",
    "mandate_type": "readiness_diagnostic",
    "url": "https://ainumbers.co/tools/503-canton-tokenization-readiness-diagnostic.html",
    "description": "12-question weighted diagnostic across six readiness domains for Canton Network pilots: settlement ops, custody, cash-leg, privacy, AML/KYA,",
    "consumes": [],
    "feeds": [
      "504-settlement-risk-capital-optimizer"
    ],
    "status": "live"
  },
  {
    "tool_id": "504-settlement-risk-capital-optimizer",
    "display_name": "Settlement-Risk Capital Efficiency Optimizer",
    "mandate_type": "capital_assessment",
    "url": "https://ainumbers.co/tools/504-settlement-risk-capital-optimizer.html",
    "description": "Quantify RWA and capital savings from moving to Canton atomic DvP. Outputs bps-of-notional saved per year under BCBS CRE70/CRE52 SA-CCR. Sta",
    "consumes": [
      "503-canton-tokenization-readiness-diagnostic"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "505-tokenized-collateral-eligibility-checker",
    "display_name": "Tokenized Collateral Eligibility Checker",
    "mandate_type": "collateral_mandate",
    "url": "https://ainumbers.co/tools/505-tokenized-collateral-eligibility-checker.html",
    "description": "Classify tokenized assets for DTC/Fed eligibility and Basel HQLA tier (L1/L2A/L2B/non-HQLA). Shared eligibility layer consumed by DvP, repo,",
    "consumes": [],
    "feeds": [
      "506-onchain-cash-leg-finality-checker",
      "513-margin-call-collateral-mobilizer",
      "514-tokenized-fund-collateral-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "506-onchain-cash-leg-finality-checker",
    "display_name": "On-Chain Cash-Leg Finality Checker",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/tools/506-onchain-cash-leg-finality-checker.html",
    "description": "Validate USDC/deposit-token cash-leg finality, reserve attestation, and GENIUS Act / MiCA compliance for Canton settlement. Emits a finality",
    "consumes": [
      "505-tokenized-collateral-eligibility-checker"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "507-canton-dvp-atomicity-validator",
    "display_name": "Canton DvP Atomicity Validator",
    "mandate_type": "settlement_mandate",
    "url": "https://ainumbers.co/tools/507-canton-dvp-atomicity-validator.html",
    "description": "Validate atomic DvP settlement on Canton Network against PFMI Principle 12. Generate a counterparty-verifiable settlement-readiness attestat",
    "consumes": [],
    "feeds": [
      "505-tokenized-collateral-eligibility-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "508-repo-haircut-collateral-calculator",
    "display_name": "On-Chain Repo Haircut Calculator",
    "mandate_type": "collateral_mandate",
    "url": "https://ainumbers.co/tools/508-repo-haircut-collateral-calculator.html",
    "description": "Compute repo haircut with Canton 24/7 collateral valuation versus legacy weekend gap. Applies Basel CRE22 supervisory haircuts and BCBS d349",
    "consumes": [],
    "feeds": [
      "505-tokenized-collateral-eligibility-checker",
      "506-onchain-cash-leg-finality-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "509-canton-party-allowlist-validator",
    "display_name": "Canton Party Allowlist Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/tools/509-canton-party-allowlist-validator.html",
    "description": "Screen counterparties against FATF Travel Rule, AML/KYA requirements, and canton allowlist rules for Canton Network onboarding. Emits allowl",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "510-digital-asset-regulatory-classifier",
    "display_name": "Digital Asset Regulatory Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/tools/510-digital-asset-regulatory-classifier.html",
    "description": "Classify tokenized assets under GENIUS Act, MiCA, MiFID II, and EU DLT Pilot Regime. Outputs applicable frameworks, MiFID II instrument type",
    "consumes": [],
    "feeds": [
      "512-tokenized-security-lifecycle-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "511-multi-currency-pvp-validator",
    "display_name": "Multi-Currency PvP Validator",
    "mandate_type": "settlement_mandate",
    "url": "https://ainumbers.co/tools/511-multi-currency-pvp-validator.html",
    "description": "Validate atomic cross-currency PvP settlement on Canton to eliminate Herstatt risk in FX and multi-currency repo. Covers PFMI P12 PvP model ",
    "consumes": [
      "507-canton-dvp-atomicity-validator",
      "505-tokenized-collateral-eligibility-checker"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "512-tokenized-security-lifecycle-validator",
    "display_name": "Tokenized Security Lifecycle Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/tools/512-tokenized-security-lifecycle-validator.html",
    "description": "Validate Daml lifecycle coverage for tokenized securities: issuance, coupon/dividend, corporate actions (splits, mergers), and maturity/rede",
    "consumes": [
      "510-digital-asset-regulatory-classifier"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "513-margin-call-collateral-mobilizer",
    "display_name": "Margin Call Collateral Mobilizer",
    "mandate_type": "collateral_mandate",
    "url": "https://ainumbers.co/tools/513-margin-call-collateral-mobilizer.html",
    "description": "Margin computation branched by instrument type: UMR/BCBS d499 for uncleared derivatives; GMRA/BCBS d349 for repo/SFT. Never mixed. Canton 24",
    "consumes": [
      "505-tokenized-collateral-eligibility-checker"
    ],
    "feeds": [
      "506-onchain-cash-leg-finality-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "514-tokenized-fund-collateral-validator",
    "display_name": "Tokenized Fund Collateral Validator",
    "mandate_type": "collateral_mandate",
    "url": "https://ainumbers.co/tools/514-tokenized-fund-collateral-validator.html",
    "description": "Validate MMF/CNAV/LVNAV/VNAV fund shares as collateral against SEC Rule 2a-7 (post-2023 reforms), EU MMFR, and Basel HQLA exclusion criteria",
    "consumes": [
      "505-tokenized-collateral-eligibility-checker"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "515-collateral-swap-eligibility-validator",
    "display_name": "Collateral Swap Eligibility Validator",
    "mandate_type": "collateral_mandate",
    "url": "https://ainumbers.co/tools/515-collateral-swap-eligibility-validator.html",
    "description": "Validate collateral swaps under GMSLA/GMRA with SFTR Article 15 reuse constraints. HQLA upgrade and downgrade impact analysis. Canton settle",
    "consumes": [
      "505-tokenized-collateral-eligibility-checker",
      "507-canton-dvp-atomicity-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-01-ap2-mandate-chain-validator",
    "display_name": "AP2 Mandate-Chain Validator",
    "mandate_type": "payment_mandate",
    "url": "https://ainumbers.co/chaingraph/art-01-ap2-mandate-chain-validator.html",
    "description": "Validates AP2 v0.2 Intent→Cart→Payment mandate trio: signature-chain integrity, scope/limit consistency, TTL/expiry, over-spend detection, H",
    "consumes": [],
    "feeds": [
      "art-02-agent-spend-policy-simulator",
      "art-03-x402-settlement-modeler",
      "art-04-agent-identity-attestation-checker",
      "art-12-acp-checkout-conformance-validator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-02-agent-spend-policy-simulator",
    "display_name": "Agent Spend-Policy Simulator",
    "mandate_type": "payment_policy",
    "url": "https://ainumbers.co/chaingraph/art-02-agent-spend-policy-simulator.html",
    "description": "Simulates thousands of synthetic agent transactions against a user-authored spend policy (per-merchant caps, category allow/deny, velocity l",
    "consumes": [
      "art-01-ap2-mandate-chain-validator",
      "art-04-agent-identity-attestation-checker"
    ],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-03-x402-settlement-modeler",
    "display_name": "x402 Settlement Cost & Finality Modeler",
    "mandate_type": "settlement_mandate",
    "url": "https://ainumbers.co/chaingraph/art-03-x402-settlement-modeler.html",
    "description": "Rail-selection and finality recommendation across x402 (HTTP 402), Stripe USDC, card, ACH, and SWIFT. Per-transaction cost, eligibility scor",
    "consumes": [
      "art-01-ap2-mandate-chain-validator"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-04-agent-identity-attestation-checker",
    "display_name": "Agent Identity & Authorization Attestation Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-04-agent-identity-attestation-checker.html",
    "description": "KYA-OS (DIF Trusted AI Agents WG) credential-chain attestation: delegated-authority credential chain, scope limits, validity windows (max 90",
    "consumes": [
      "art-01-ap2-mandate-chain-validator",
      "art-13-eudi-wallet-credential-readiness-checker"
    ],
    "feeds": [
      "art-02-agent-spend-policy-simulator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-05-eu-ai-act-credit-scoring-conformity",
    "display_name": "EU AI Act Credit-Scoring Conformity Pack",
    "mandate_type": "model_governance",
    "url": "https://ainumbers.co/chaingraph/art-05-eu-ai-act-credit-scoring-conformity.html",
    "description": "Bias testing across protected characteristics (disparate impact ratios, equalized odds gaps), data-quality attestations, Article 11 technica",
    "consumes": [],
    "feeds": [
      "ml-01-isolation-forest",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-06-genius-act-reserve-attestation",
    "display_name": "GENIUS Act Reserve Attestation Pre-Check",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-06-genius-act-reserve-attestation.html",
    "description": "1:1 reserve coverage, reserve-composition eligibility against GENIUS Act permitted-asset classes, monthly reserve-report figures against AIC",
    "consumes": [],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-07-basel31-reporting-delta-calculator",
    "display_name": "Basel 3.1 Reporting Delta Calculator",
    "mandate_type": "capital_assessment",
    "url": "https://ainumbers.co/chaingraph/art-07-basel31-reporting-delta-calculator.html",
    "description": "Per-asset-class RWA delta (current vs Basel 3.1), output-floor binding analysis (72.5%), CET1 before/after, capital shortfall vs 12.5% total",
    "consumes": [],
    "feeds": [
      "sim-03-basel-rwa-scenario-modeler",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-08-en16931-einvoice-batch-validator",
    "display_name": "EN 16931 / Factur-X E-Invoicing Batch Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-08-en16931-einvoice-batch-validator.html",
    "description": "Batch validation of e-invoices against EN 16931 mandatory fields, VAT logic, and country profiles. France mandatory September 2026; SMEs Sep",
    "consumes": [],
    "feeds": [
      "rca-03-iso20022-address-migration-verifier",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-09-dora-incident-classifier",
    "display_name": "DORA Major-Incident Reporting Threshold Classifier",
    "mandate_type": "infrastructure_mandate",
    "url": "https://ainumbers.co/chaingraph/art-09-dora-incident-classifier.html",
    "description": "DORA Article 19/20 reporting determination and reporting-clock start. Clients affected, transaction value, downtime, geographic spread, cros",
    "consumes": [
      "art-29-dora-readiness-diagnostic"
    ],
    "feeds": [
      "pnr-01-dora-ict-cascade-simulator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-10-amla-transaction-typology-risk-scorer",
    "display_name": "AMLA Transaction-Typology Risk Scorer",
    "mandate_type": "risk_control",
    "url": "https://ainumbers.co/chaingraph/art-10-amla-transaction-typology-risk-scorer.html",
    "description": "Scores a synthetic transaction graph against AML typologies and FATF Travel Rule predicates; exports an AML risk determination per account/c",
    "consumes": [],
    "feeds": [
      "cry-01-zk-compliance-proof-generator",
      "art-11-vop-batch-match-rate-analyser",
      "ptg-01-ap2-prompt-template-generator",
      "mms-03-app-fraud-graph",
      "ml-01-isolation-forest"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-100-mica-casp-authorization-readiness",
    "display_name": "CASP Authorization-Readiness Assessor",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-100-mica-casp-authorization-readiness.html",
    "description": "Scores readiness for MiCA CASP authorization (Arts 59-63): service-permission scope, governance/fit-and-proper, custody segregation, complai",
    "consumes": [
      "art-98-mica-casp-fit-diagnostic",
      "art-99-mica-transitional-deadline-router"
    ],
    "feeds": [
      "art-101-mica-art67-own-funds-calculator",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-101-mica-art67-own-funds-calculator",
    "display_name": "Art 67 Own-Funds Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-101-mica-art67-own-funds-calculator.html",
    "description": "Computes MiCA Art 67 required own funds = higher of Annex IV permanent minimum (€50k advisory / €125k trading-platform / €150k custody-excha",
    "consumes": [
      "art-100-mica-casp-authorization-readiness"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-102-crypto-asset-whitepaper-linter",
    "display_name": "Crypto-Asset Whitepaper Linter (iXBRL)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-102-crypto-asset-whitepaper-linter.html",
    "description": "Validates Art 6/8 whitepaper: Annex I section completeness + iXBRL/XHTML well-formedness + ESMA MiCA taxonomy structural conformance (ITS 20",
    "consumes": [
      "art-98-mica-casp-fit-diagnostic"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-103-mar-crypto-surveillance-readiness",
    "display_name": "MAR-Crypto Surveillance-Readiness Assessor",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-103-mar-crypto-surveillance-readiness.html",
    "description": "Scores market-abuse arrangements (Arts 86-92 + Dec-2024 RTS): PPAET (prevention/detection), STOR templates, insider lists, manipulation-patt",
    "consumes": [
      "art-98-mica-casp-fit-diagnostic"
    ],
    "feeds": [
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-104-tfr-travel-rule-batch-validator",
    "display_name": "TFR Travel-Rule Batch Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-104-tfr-travel-rule-batch-validator.html",
    "description": "Validates originator/beneficiary field completeness on synthetic/hashed transfer batches (self-/cross-CASP + unhosted-wallet branches) per T",
    "consumes": [
      "art-98-mica-casp-fit-diagnostic"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-105-mica-token-service-scoper",
    "display_name": "MiCA Token & Service Scoper",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-105-mica-token-service-scoper.html",
    "description": "Disambiguation router classifying a case as ART/EMT-issuer (delegated to existing stablecoin-compliance chains) vs CASP-service (MiCA chains",
    "consumes": [
      "art-98-mica-casp-fit-diagnostic"
    ],
    "feeds": [
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-106-tempo-subscription-reconciler",
    "display_name": "Tempo Subscription & Streaming Settlement Reconciler",
    "mandate_type": "settlement_mandate",
    "url": "https://ainumbers.co/chaingraph/art-106-tempo-subscription-reconciler.html",
    "description": "Reconcile executed MPP recurring/streamed draws against the authorized mandate envelope, prove draw-set integrity via Merkle root, and detec",
    "consumes": [
      "art-36-tempo-mpp-agent-mandate"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-107-tempo-gas-economics",
    "display_name": "Tempo Fee-Sponsorship & Gas-AMM Economics",
    "mandate_type": "treasury_mandate",
    "url": "https://ainumbers.co/chaingraph/art-107-tempo-gas-economics.html",
    "description": "Model Tempo enshrined-AMM gas cost paid in any major stablecoin, server-paid fee sponsorship, and net per-tx saving vs card/SWIFT/ACH baseli",
    "consumes": [
      "art-35-tempo-payments-business-case"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-108-canton-selective-disclosure",
    "display_name": "Canton Selective-Disclosure DvP Reconciliation Attestation",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-108-canton-selective-disclosure.html",
    "description": "Attest that a Canton DvP privacy partition is sound: each counterparty sees only its leg, no cross-leg data leaks, and both views reconcile ",
    "consumes": [
      "507-canton-dvp-atomicity-validator"
    ],
    "feeds": [
      "cry-01-zk-compliance-proof-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-109-dtc-tokenized-treasury",
    "display_name": "DTC-Custodied Tokenized U.S. Treasury Issuance & DvP",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-109-dtc-tokenized-treasury.html",
    "description": "Validate a DTCC/ComposerX tokenized U.S. Treasury for issuance and atomic settlement: DTC-custody linkage, Fed eligibility, ComposerX DAML l",
    "consumes": [
      "510-digital-asset-regulatory-classifier"
    ],
    "feeds": [
      "507-canton-dvp-atomicity-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-11-vop-batch-match-rate-analyser",
    "display_name": "VoP Batch Match-Rate Analyser",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-11-vop-batch-match-rate-analyser.html",
    "description": "Batch IBAN-name matching: match/close-match/no-match classification, configurable strictness (exact/normalized/fuzzy), false-positive vs fal",
    "consumes": [
      "rca-03-iso20022-address-migration-verifier",
      "art-10-amla-transaction-typology-risk-scorer"
    ],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-110-arc-partner-stablecoin-onboarding",
    "display_name": "Arc Partner Stablecoin Onboarding Conformance",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-110-arc-partner-stablecoin-onboarding.html",
    "description": "Score a non-USD stablecoin issuer readiness to join Circle Partner Stablecoins on Arc against technical/operational, reserve-management, and",
    "consumes": [
      "art-42-arc-fit-diagnostic"
    ],
    "feeds": [
      "art-45-arc-xreserve-linter"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-111-arc-corridor-jurisdiction-router",
    "display_name": "Arc Multi-Currency Corridor Jurisdiction Router",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-111-arc-corridor-jurisdiction-router.html",
    "description": "Route each leg of a multi-currency Arc corridor to its per-currency home regime (EURC→MiCA EMT, JPYC→JP FSA, BRLA→Brazil CMN/BCB, MXNB→MX CN",
    "consumes": [],
    "feeds": [
      "511-multi-currency-pvp-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-112-dscsa-transaction-statement-verifier",
    "display_name": "DSCSA Transaction Statement (T3) Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-112-dscsa-transaction-statement-verifier.html",
    "description": "Verify the DSCSA T3 set (Transaction Information + History + Statement) completeness, validate the GS1 SGTIN, and map the EPCIS 2.0 event ty",
    "consumes": [],
    "feeds": [
      "art-113-saleable-returns-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-113-saleable-returns-verifier",
    "display_name": "DSCSA Saleable Returns Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-113-saleable-returns-verifier.html",
    "description": "Match a returned unit SGTIN+lot to its original transaction hash (DSCSA §582(c)(4)(D)). Unauthorized trading partner or mismatched SGTIN/lot",
    "consumes": [
      "art-112-dscsa-transaction-statement-verifier"
    ],
    "feeds": [
      "art-114-suspect-product-quarantine"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-114-suspect-product-quarantine",
    "display_name": "DSCSA Suspect/Illegitimate Product Quarantine Assessor",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-114-suspect-product-quarantine.html",
    "description": "Determine suspect vs illegitimate product status and required actions (quarantine, investigate, 72-hour FDA Form 3911 notification, trading ",
    "consumes": [
      "art-113-saleable-returns-verifier"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-115-dpp-data-carrier-validator",
    "display_name": "EU ESPR Digital Product Passport Data Carrier Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-115-dpp-data-carrier-validator.html",
    "description": "Validate DPP required data elements against the CIRPASS-2 Core Ontology (durability, reparability, recyclability, carbon footprint, substanc",
    "consumes": [],
    "feeds": [
      "art-116-product-lineage-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-116-product-lineage-builder",
    "display_name": "Digital Product Passport Cradle-to-Gate Lineage Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-116-product-lineage-builder.html",
    "description": "Build a cradle-to-gate supplier lineage with hash-only claims per stage (no trade secrets). Each stage carries a supplier_hash anchor, dataV",
    "consumes": [
      "art-115-dpp-data-carrier-validator"
    ],
    "feeds": [
      "art-117-product-authenticity-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-117-product-authenticity-verifier",
    "display_name": "Luxury Goods Product Authenticity Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-117-product-authenticity-verifier.html",
    "description": "Verify that presented lineage hashes chain back to the claimed root and that ownership transfers are continuous. Consumer/resale authenticit",
    "consumes": [
      "art-116-product-lineage-builder"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-118-fsma204-cte-validator",
    "display_name": "FSMA 204 Critical Tracking Event (CTE) Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-118-fsma204-cte-validator.html",
    "description": "Validate required Key Data Elements present for each FDA FSMA 204 Critical Tracking Event (harvesting/cooling/initial packing/shipping/recei",
    "consumes": [],
    "feeds": [
      "art-119-traceability-lot-code-linker"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-119-traceability-lot-code-linker",
    "display_name": "FSMA 204 Traceability Lot Code Chain Linker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-119-traceability-lot-code-linker.html",
    "description": "Link Traceability Lot Codes across CTEs and detect chain breaks. Transformation events mint a new TLC (recorded as new_lot_minted). Feeds th",
    "consumes": [
      "art-118-fsma204-cte-validator"
    ],
    "feeds": [
      "art-120-recall-trace-resolver"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-12-acp-checkout-conformance-validator",
    "display_name": "ACP Checkout Conformance Validator",
    "mandate_type": "payment_mandate",
    "url": "https://ainumbers.co/chaingraph/art-12-acp-checkout-conformance-validator.html",
    "description": "OpenAI/Stripe Agentic Commerce Protocol (ACP): CheckoutRequest/Response field conformance (10 required fields each), Shared Payment Token st",
    "consumes": [
      "art-01-ap2-mandate-chain-validator"
    ],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-120-recall-trace-resolver",
    "display_name": "FSMA 204 Recall Trace Resolver (24-Hour FDA List)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-120-recall-trace-resolver.html",
    "description": "One-up/one-back trace from a contaminated Traceability Lot Code to affected recipients and sources. Emits the data for the FDA 24-hour sorta",
    "consumes": [
      "art-119-traceability-lot-code-linker"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-121-document-integrity-anchor",
    "display_name": "Document Integrity & eIDAS Electronic Timestamp Anchor",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-121-document-integrity-anchor.html",
    "description": "Bind a document SHA-256 and claimed timestamp into an OCG execution_hash that serves as an eIDAS Art.41 / RFC 3161-aligned electronic timest",
    "consumes": [],
    "feeds": [
      "art-122-timestamp-attestation-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-122-timestamp-attestation-verifier",
    "display_name": "Timestamp Attestation Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-122-timestamp-attestation-verifier.html",
    "description": "Recompute the document integrity anchor, confirm the document hash and timestamp claim match and the algorithm is consistent. Terminal stage",
    "consumes": [
      "art-121-document-integrity-anchor"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-123-c2pa-manifest-validator",
    "display_name": "C2PA Content Credential Manifest Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-123-c2pa-manifest-validator.html",
    "description": "Validate a decoded C2PA 2.x manifest: claim well-formedness, hard-binding hash assertion, and claim-signature reference. Feeds the Content C",
    "consumes": [],
    "feeds": [
      "art-124-content-credential-signature-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-124-content-credential-signature-verifier",
    "display_name": "Content Credential Signature Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-124-content-credential-signature-verifier.html",
    "description": "Verify-only node: callable in chains, carrying no compute-proof claim. Verify the COSE_Sign1 claim signature against a caller-supplied signe",
    "consumes": [
      "art-123-c2pa-manifest-validator"
    ],
    "feeds": [
      "art-125-provenance-ingredient-tree-resolver"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-125-provenance-ingredient-tree-resolver",
    "display_name": "Provenance Ingredient Tree Resolver",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-125-provenance-ingredient-tree-resolver.html",
    "description": "Walk the c2pa.ingredient parent-of tree; confirm each ingredient hashed_uri binding and nested manifest hash chains back to the active manif",
    "consumes": [
      "art-124-content-credential-signature-verifier"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-126-ai-act-art50-marking-checker",
    "display_name": "EU AI Act Art. 50 Marking Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-126-ai-act-art50-marking-checker.html",
    "description": "Check c2pa.actions for a c2pa.created action whose IPTC digitalSourceType is in the AI set, and that machine-readable marking is present (Ar",
    "consumes": [],
    "feeds": [
      "art-127-dual-layer-disclosure-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-127-dual-layer-disclosure-verifier",
    "display_name": "Dual-Layer Disclosure Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-127-dual-layer-disclosure-verifier.html",
    "description": "Confirm the EU Commission Code of Practice multi-layer requirement: both C2PA signed metadata and an imperceptible watermark (SynthID / Digi",
    "consumes": [
      "art-126-ai-act-art50-marking-checker"
    ],
    "feeds": [
      "art-128-content-binding-assertion-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-128-content-binding-assertion-validator",
    "display_name": "Content Binding Assertion Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-128-content-binding-assertion-validator.html",
    "description": "Validate hard-binding (c2pa.hash.data/bmff, tamper-evident) vs soft-binding (watermark/fingerprint, survives re-encode). Confirms asset byte",
    "consumes": [
      "art-127-dual-layer-disclosure-verifier"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-129-webbotauth-signature-verifier",
    "display_name": "Web Bot Auth Signature Verifier (RFC 9421)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-129-webbotauth-signature-verifier.html",
    "description": "Reconstruct the RFC 9421 signature base and verify the Ed25519 Web Bot Auth signature against a caller-supplied public key, zero network. Ch",
    "consumes": [],
    "feeds": [
      "art-130-signature-directory-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-13-eudi-wallet-credential-readiness-checker",
    "display_name": "EUDI Wallet Credential-Acceptance Readiness Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-13-eudi-wallet-credential-readiness-checker.html",
    "description": "eIDAS 2.0 verifiable-credential acceptance readiness against EUDI Wallet ARF v1.4 profiles. PID/QEAA/EAA attribute mapping, relying-party ob",
    "consumes": [],
    "feeds": [
      "art-04-agent-identity-attestation-checker",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-130-signature-directory-validator",
    "display_name": "HTTP Signatures Directory Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-130-signature-directory-validator.html",
    "description": "Validate the /.well-known/http-message-signatures-directory JWKS: well-formed, keys are OKP/Ed25519, the keyid from Signature-Input resolves",
    "consumes": [
      "art-129-webbotauth-signature-verifier"
    ],
    "feeds": [
      "art-131-signature-agent-card-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-131-signature-agent-card-validator",
    "display_name": "Signature Agent Card Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-131-signature-agent-card-validator.html",
    "description": "Validate the Signature Agent Card (Cloudflare/Bedrock AgentCore schema): required fields (name, operator, expected request rate, keys) and c",
    "consumes": [
      "art-130-signature-directory-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-132-agent-key-rotation-auditor",
    "display_name": "Agent Key Rotation Auditor",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-132-agent-key-rotation-auditor.html",
    "description": "Audit key freshness and rotation posture: key age vs max-age policy, presence of a next-key and overlap window, algorithm is Ed25519. Emits ",
    "consumes": [],
    "feeds": [
      "art-133-agent-payment-rail-trust-crosswalk"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-133-agent-payment-rail-trust-crosswalk",
    "display_name": "Agent Payment Rail Trust Crosswalk",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-133-agent-payment-rail-trust-crosswalk.html",
    "description": "Crosswalk agent identity posture (alg, directory published, card present, signature verified) to Visa TAP, Mastercard Agent Pay, and Web Bot",
    "consumes": [
      "art-132-agent-key-rotation-auditor"
    ],
    "feeds": [
      "art-134-agent-directory-publish-readiness"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-134-agent-directory-publish-readiness",
    "display_name": "Agent Directory Publish Readiness Diagnostic",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-134-agent-directory-publish-readiness.html",
    "description": "Diagnostic: is the operator ready to publish a verifiable Web Bot Auth identity? Checks well-known path, JWKS reachability flag, card comple",
    "consumes": [
      "art-133-agent-payment-rail-trust-crosswalk"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-135-cyclonedx-sbom-validator",
    "display_name": "CycloneDX SBOM Validator (EU CRA Annex I)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-135-cyclonedx-sbom-validator.html",
    "description": "Validates a CycloneDX SBOM against the EU CRA Annex I machine-readable SBOM requirement: bomFormat=CycloneDX, specVersion in [1.4,1.5,1.6], ",
    "consumes": [],
    "feeds": [
      "art-136-slsa-provenance-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-136-slsa-provenance-verifier",
    "display_name": "SLSA Provenance Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-136-slsa-provenance-verifier.html",
    "description": "Verifies an in-toto SLSA provenance statement: validates _type (in-toto.io/Statement) and predicateType (slsa.dev/provenance), checks subjec",
    "consumes": [
      "art-135-cyclonedx-sbom-validator"
    ],
    "feeds": [
      "art-137-openvex-statement-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-137-openvex-statement-validator",
    "display_name": "OpenVEX Statement Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-137-openvex-statement-validator.html",
    "description": "Validates an OpenVEX document: @context includes openvex.dev, every statement carries vulnerability, products[], status in [not_affected,aff",
    "consumes": [
      "art-136-slsa-provenance-verifier"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-138-spdx-sbom-validator",
    "display_name": "SPDX SBOM Validator (EU CRA Annex I)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-138-spdx-sbom-validator.html",
    "description": "Validates an SPDX SBOM against the EU CRA Annex I machine-readable SBOM requirement: spdxVersion matches SPDX-2.x or SPDX-3.x, SPDXID presen",
    "consumes": [],
    "feeds": [
      "art-139-cra-annex1-completeness-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-139-cra-annex1-completeness-checker",
    "display_name": "CRA Annex I Completeness Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-139-cra-annex1-completeness-checker.html",
    "description": "Checks EU CRA Annex I Part I essential cybersecurity requirements: sbom_present, sbom_machine_readable, top_level_deps_covered, vuln_handlin",
    "consumes": [
      "art-138-spdx-sbom-validator"
    ],
    "feeds": [
      "art-140-cra-vuln-reporting-readiness"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-14-psd3-psr-readiness-checker",
    "display_name": "PSD3 / PSR Readiness Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-14-psd3-psr-readiness-checker.html",
    "description": "Six-domain PSD3/PSR readiness rubric: Open Finance access rights (Art.35/36), TPP categorisation (PISP/AISP/PIISP), SCA exemption alignment ",
    "consumes": [],
    "feeds": [
      "art-04-agent-identity-attestation-checker",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-140-cra-vuln-reporting-readiness",
    "display_name": "CRA Vulnerability Reporting Readiness (Art. 14)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-140-cra-vuln-reporting-readiness.html",
    "description": "Assesses EU CRA Article 14 vulnerability reporting readiness: actively_exploited_detection, 24-hour early_warning_24h_process, 72-hour notif",
    "consumes": [
      "art-139-cra-annex1-completeness-checker"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-141-nis2-entity-scope-classifier",
    "display_name": "NIS2 Entity Scope Classifier (Essential / Important / Out-of-Scope)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-141-nis2-entity-scope-classifier.html",
    "description": "Classify an entity as Essential, Important, or Out-of-Scope under NIS2 Directive 2022/2555 Annex I and II, applying sector codes, employee/t",
    "consumes": [],
    "feeds": [
      "art-142-nis2-art21-gap-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-142-nis2-art21-gap-checker",
    "display_name": "NIS2 Article 21 Gap Checker (Ten Cybersecurity Risk-Management Measures)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-142-nis2-art21-gap-checker.html",
    "description": "Check presence and maturity of all ten NIS2 Article 21(2)(a)–(j) cybersecurity risk-management measures. Derives per-measure maturity (0=abs",
    "consumes": [
      "art-141-nis2-entity-scope-classifier"
    ],
    "feeds": [
      "art-143-nis2-penalty-exposure-calculator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-143-nis2-penalty-exposure-calculator",
    "display_name": "NIS2 Penalty Exposure Calculator (Art. 34)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-143-nis2-penalty-exposure-calculator.html",
    "description": "Calculate maximum NIS2 Art. 34 penalty exposure given entity classification, global annual turnover, and declared infringement types. Essent",
    "consumes": [
      "art-142-nis2-art21-gap-checker"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-144-nis2-incident-significance-scorer",
    "display_name": "NIS2 Incident Significance Scorer (Art. 23 Reporting Threshold)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-144-nis2-incident-significance-scorer.html",
    "description": "Score whether an operational event meets the NIS2 Art. 23 significant-incident threshold (any of: service disruption ≥1h, ≥1,000 affected us",
    "consumes": [],
    "feeds": [
      "art-145-nis2-ict-supply-chain-diligence-scorer"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-145-nis2-ict-supply-chain-diligence-scorer",
    "display_name": "NIS2 ICT Supply-Chain Diligence Scorer (Art. 21(2)(d) / ENISA)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-145-nis2-ict-supply-chain-diligence-scorer.html",
    "description": "Score ICT vendor due-diligence posture against NIS2 Art. 21(2)(d) and ENISA ICT supply-chain risk framework. Seven controls: ISO 27001 certi",
    "consumes": [
      "art-144-nis2-incident-significance-scorer"
    ],
    "feeds": [
      "art-146-nis2-governance-readiness-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-146-nis2-governance-readiness-checker",
    "display_name": "NIS2 Governance Readiness Checker (Art. 20 — Management Body Accountability)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-146-nis2-governance-readiness-checker.html",
    "description": "Assess NIS2 Art. 20 management-body accountability: board approval of Art. 21 measures, quarterly status updates, CISO designation, cybersec",
    "consumes": [
      "art-145-nis2-ict-supply-chain-diligence-scorer"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-147-mcp-server-identity-attestation-validator",
    "display_name": "MCP Server Identity Attestation Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-147-mcp-server-identity-attestation-validator.html",
    "description": "Validate a new-spec MCP server identity document: required claims (subject, issuer, serverInfo), well-known path correctness (/.well-known/m",
    "consumes": [],
    "feeds": [
      "art-148-mcp-authorization-metadata-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-148-mcp-authorization-metadata-validator",
    "display_name": "MCP Authorization Metadata Validator (RFC 9728)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-148-mcp-authorization-metadata-validator.html",
    "description": "Validate OAuth 2.0 Protected Resource Metadata per RFC 9728: resource URI (https-scheme), non-empty authorization_servers, scopes_supported,",
    "consumes": [
      "art-147-mcp-server-identity-attestation-validator"
    ],
    "feeds": [
      "art-149-mcp-registry-entry-conformance"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-149-mcp-registry-entry-conformance",
    "display_name": "MCP Registry Entry Conformance Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-149-mcp-registry-entry-conformance.html",
    "description": "Validate an MCP Registry server.json entry: $schema present, reverse-DNS name format (namespace/name), semver version, and at least one of p",
    "consumes": [
      "art-148-mcp-authorization-metadata-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-15-agentic-mandate-sandbox",
    "display_name": "Agentic Mandate Sandbox",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-15-agentic-mandate-sandbox.html",
    "description": "Builds a deterministic Agent Guardrail Mandate skeleton from declared spend caps, MCC allowlist/blocklist, velocity rules, time windows, and",
    "consumes": [
      "art-27-agentic-readiness-diagnostic"
    ],
    "feeds": [
      "art-16-google-ap2-mandate-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-150-mcp-tool-scope-revocation-auditor",
    "display_name": "MCP Tool Scope & Revocation Auditor",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-150-mcp-tool-scope-revocation-auditor.html",
    "description": "Audit scoped and revocable MCP tool access per the new MCP specification: each granted tool must carry an explicit scope array, a revocation",
    "consumes": [],
    "feeds": [
      "art-151-agent-obo-mandate-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-151-agent-obo-mandate-validator",
    "display_name": "Agent On-Behalf-Of (OBO) Mandate Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-151-agent-obo-mandate-validator.html",
    "description": "Validate an agent on-behalf-of (OBO) mandate: subject (the user being represented), bounded scope array, intent string, and a non-expired va",
    "consumes": [
      "art-150-mcp-tool-scope-revocation-auditor"
    ],
    "feeds": [
      "art-152-mcp-task-lifecycle-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-152-mcp-task-lifecycle-validator",
    "display_name": "MCP Task Lifecycle State Machine Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-152-mcp-task-lifecycle-validator.html",
    "description": "Validate that a long-running MCP task state transitions are legal per the new MCP specification state machine: working to input_required or ",
    "consumes": [
      "art-151-agent-obo-mandate-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-153-emir-trade-report-field-validator",
    "display_name": "EMIR Trade Report Field Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-153-emir-trade-report-field-validator.html",
    "description": "Validate the required-field subset of an EMIR Refit ISO 20022 auth.030 derivative trade report: action type, both counterparty LEIs (20-char",
    "consumes": [],
    "feeds": [
      "art-154-emir-uti-completeness-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-154-emir-uti-completeness-checker",
    "display_name": "EMIR UTI Completeness Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-154-emir-uti-completeness-checker.html",
    "description": "Validate EMIR Refit UTI format (ISO 23897, 52 alphanumeric characters max), generating-party identity, and T+1 sharing timing: UTI must be s",
    "consumes": [
      "art-153-emir-trade-report-field-validator"
    ],
    "feeds": [
      "art-155-emir-upi-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-155-emir-upi-validator",
    "display_name": "EMIR UPI Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-155-emir-upi-validator.html",
    "description": "Validate EMIR Refit UPI format (ISO 4914, 12-character alphanumeric via ANNA Derivatives Service Bureau) and product classification consiste",
    "consumes": [
      "art-154-emir-uti-completeness-checker"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-156-emir-counterparty-pairing-reconciler",
    "display_name": "EMIR Counterparty Pairing Reconciler",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-156-emir-counterparty-pairing-reconciler.html",
    "description": "Pair two counterparties EMIR Refit reports by UTI and reconcile the caller-supplied matching-field set (up to 148 fields per the 2026 escala",
    "consumes": [],
    "feeds": [
      "art-157-emir-lifecycle-event-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-157-emir-lifecycle-event-validator",
    "display_name": "EMIR Lifecycle Event Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-157-emir-lifecycle-event-validator.html",
    "description": "Validate an EMIR Refit action type against the prior reported state of the UTI: New/Position are legal on a previously unreported trade; Mod",
    "consumes": [
      "art-156-emir-counterparty-pairing-reconciler"
    ],
    "feeds": [
      "art-158-emir-reporting-readiness-diagnostic"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-158-emir-reporting-readiness-diagnostic",
    "display_name": "EMIR Reporting Readiness Diagnostic",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-158-emir-reporting-readiness-diagnostic.html",
    "description": "Grade a firm EMIR Refit reporting readiness across five dimensions: ISO 20022 format cutover, UPI sourcing via ANNA DSB, UTI sharing SLA (10",
    "consumes": [
      "art-157-emir-lifecycle-event-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-159-vida-einvoice-en16931-conformance-validator",
    "display_name": "ViDA EN 16931 E-Invoice Conformance Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-159-vida-einvoice-en16931-conformance-validator.html",
    "description": "Validate a structured e-invoice against EN 16931-1:2026 mandatory field requirements for ViDA Digital Reporting Requirements. Checks invoice",
    "consumes": [],
    "feeds": [
      "art-160-vida-drr-transaction-reporter"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-16-google-ap2-mandate-builder",
    "display_name": "Google AP2 Mandate Builder",
    "mandate_type": "payment_policy",
    "url": "https://ainumbers.co/chaingraph/art-16-google-ap2-mandate-builder.html",
    "description": "Builds an illustrative Google AP2 Checkout/Payment Mandate Verifiable Digital Credential (VDC) skeleton from a declared mandate type, stage,",
    "consumes": [
      "art-15-agentic-mandate-sandbox",
      "art-22-agentic-payments-protocol-comparator",
      "art-27-agentic-readiness-diagnostic"
    ],
    "feeds": [
      "art-17-ap2-mcp-policy-validator",
      "art-23-visa-trusted-agent-protocol-inspector"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-160-vida-drr-transaction-reporter",
    "display_name": "ViDA DRR Transaction Reporter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-160-vida-drr-transaction-reporter.html",
    "description": "Assess whether an intra-EU B2B transaction falls within the ViDA Digital Reporting Requirements scope and calculate the 10-calendar-day repo",
    "consumes": [
      "art-159-vida-einvoice-en16931-conformance-validator"
    ],
    "feeds": [
      "art-161-vida-recapitulative-statement-migration-assessor"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-161-vida-recapitulative-statement-migration-assessor",
    "display_name": "ViDA Recapitulative Statement Migration Assessor",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-161-vida-recapitulative-statement-migration-assessor.html",
    "description": "Assess an entity's readiness to migrate from EC Sales List (recapitulative statements) to ViDA Digital Reporting Requirements. Checks presen",
    "consumes": [
      "art-160-vida-drr-transaction-reporter"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-162-vida-platform-deemed-supplier-classifier",
    "display_name": "ViDA Platform Deemed Supplier Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-162-vida-platform-deemed-supplier-classifier.html",
    "description": "Classify a digital platform as a ViDA deemed supplier under Art. 46a (amended VAT Directive): short-term accommodation (≤30 consecutive nigh",
    "consumes": [],
    "feeds": [
      "art-163-vida-oss-registration-router"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-163-vida-oss-registration-router",
    "display_name": "ViDA OSS Registration Router",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-163-vida-oss-registration-router.html",
    "description": "Route a supply to the correct ViDA Single VAT Registration scheme: Union OSS (EU-established supplier, cross-border B2C or stock transfer wi",
    "consumes": [
      "art-162-vida-platform-deemed-supplier-classifier"
    ],
    "feeds": [
      "art-164-vida-compliance-readiness-diagnostic"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-164-vida-compliance-readiness-diagnostic",
    "display_name": "ViDA Compliance Readiness Diagnostic",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-164-vida-compliance-readiness-diagnostic.html",
    "description": "Scored ViDA readiness diagnostic across four dimensions: einvoice (EN 16931-1:2026 ready), drr (DRR reporting pipeline ready), platform (dee",
    "consumes": [
      "art-163-vida-oss-registration-router"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-165-eudr-dds-field-validator",
    "display_name": "EUDR DDS Field Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-165-eudr-dds-field-validator.html",
    "description": "Validate the required-field subset of an EUDR Due Diligence Statement (DDS) before TRACES NT filing: operator name, address, EORI, HS code, ",
    "consumes": [],
    "feeds": [
      "art-166-eudr-geolocation-plot-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-166-eudr-geolocation-plot-validator",
    "display_name": "EUDR Geolocation Plot Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-166-eudr-geolocation-plot-validator.html",
    "description": "Validate GeoJSON plot geolocation for EUDR compliance: geometry type (Point or Polygon), coordinate range validity, EUDR size rule (plots >=",
    "consumes": [
      "art-165-eudr-dds-field-validator"
    ],
    "feeds": [
      "art-167-eudr-commodity-scope-classifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-167-eudr-commodity-scope-classifier",
    "display_name": "EUDR Commodity Scope Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-167-eudr-commodity-scope-classifier.html",
    "description": "Classify an HS code against EUDR Annex I to determine commodity scope (cattle, cocoa, coffee, oil palm, rubber, soya, wood, or out-of-scope)",
    "consumes": [
      "art-166-eudr-geolocation-plot-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-168-eudr-country-benchmark-risk-scorer",
    "display_name": "EUDR Country Benchmark Risk Scorer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-168-eudr-country-benchmark-risk-scorer.html",
    "description": "Score country-of-production against the EUDR benchmark risk classification (low/standard/high per Art. 29): low risk (EU/EEA + strong forest",
    "consumes": [],
    "feeds": [
      "art-169-eudr-supply-chain-traceability-linker"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-169-eudr-supply-chain-traceability-linker",
    "display_name": "EUDR Supply-Chain Traceability Linker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-169-eudr-supply-chain-traceability-linker.html",
    "description": "Validate EUDR single-DDS rule compliance and supply-chain traceability: first operators file the DDS; downstream operators reference upstrea",
    "consumes": [
      "art-168-eudr-country-benchmark-risk-scorer"
    ],
    "feeds": [
      "art-170-eudr-readiness-diagnostic"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-17-ap2-mcp-policy-validator",
    "display_name": "AP2/MCP Policy Validator",
    "mandate_type": "scheme_rule",
    "url": "https://ainumbers.co/chaingraph/art-17-ap2-mcp-policy-validator.html",
    "description": "Validates a caller-supplied payload against the AINumbers Unified Build Contract v1.0 Policy Mandate field set (ap2_version, mandate_id, too",
    "consumes": [
      "art-16-google-ap2-mandate-builder",
      "art-27-agentic-readiness-diagnostic"
    ],
    "feeds": [
      "art-18-mcp-developer-readiness-scorecard"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-170-eudr-readiness-diagnostic",
    "display_name": "EUDR Readiness Diagnostic",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-170-eudr-readiness-diagnostic.html",
    "description": "A-F EUDR readiness diagnostic across six dimensions: scope mapping, geolocation data quality, DDS submission readiness (TRACES NT), country ",
    "consumes": [
      "art-169-eudr-supply-chain-traceability-linker"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-171-iso42001-aims-clause-conformance",
    "display_name": "ISO 42001 AIMS Clause Conformance",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-171-iso42001-aims-clause-conformance.html",
    "description": "Assess ISO/IEC 42001 AIMS conformance across clauses 4-10 (context, leadership, planning, support, operation, evaluation, improvement) and s",
    "consumes": [],
    "feeds": [
      "art-172-ai-risk-impact-assessment-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-172-ai-risk-impact-assessment-validator",
    "display_name": "AI Risk Impact Assessment Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-172-ai-risk-impact-assessment-validator.html",
    "description": "Validate ISO 42005-style AI impact-assessment completeness across seven required elements: intended use, affected stakeholders (>=1), risk t",
    "consumes": [
      "art-171-iso42001-aims-clause-conformance"
    ],
    "feeds": [
      "art-173-ai-system-governance-classifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-173-ai-system-governance-classifier",
    "display_name": "AI System Governance Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-173-ai-system-governance-classifier.html",
    "description": "Classify an AI system to its governance tier across EU AI Act (prohibited/high-risk/limited-risk/minimal-risk), NIST AI RMF profile (T1 basi",
    "consumes": [
      "art-172-ai-risk-impact-assessment-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-174-nist-ai-rmf-function-mapper",
    "display_name": "NIST AI RMF Function Mapper",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-174-nist-ai-rmf-function-mapper.html",
    "description": "Map supplied AI controls and evidence to NIST AI RMF Govern (5 controls), Map (4), Measure (4), and Manage (4) functions: 17 controls total.",
    "consumes": [],
    "feeds": [
      "art-175-gpai-code-of-practice-conformance",
      "art-314-traiga-safe-harbor-pack-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-175-gpai-code-of-practice-conformance",
    "display_name": "GPAI Code of Practice Conformance",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-175-gpai-code-of-practice-conformance.html",
    "description": "Check GPAI provider obligations under EU AI Act Art. 53 (technical documentation, training-data summary, copyright policy, model card, 4 bas",
    "consumes": [
      "art-174-nist-ai-rmf-function-mapper"
    ],
    "feeds": [
      "art-176-ai-governance-readiness-diagnostic"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-176-ai-governance-readiness-diagnostic",
    "display_name": "AI Governance Readiness Diagnostic",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-176-ai-governance-readiness-diagnostic.html",
    "description": "A-F AI governance readiness diagnostic across six dimensions spanning ISO/IEC 42001, NIST AI RMF, and EU AI Act convergence: AIMS documentat",
    "consumes": [
      "art-175-gpai-code-of-practice-conformance"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-177-ifrs17-measurement-model-classifier",
    "display_name": "IFRS 17 Measurement Model Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-177-ifrs17-measurement-model-classifier.html",
    "description": "Classify insurance contracts to their IFRS 17 measurement model: Premium Allocation Approach (PAA) for coverage periods of 12 months or less",
    "consumes": [],
    "feeds": [
      "art-178-ifrs17-csm-rollforward-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-178-ifrs17-csm-rollforward-validator",
    "display_name": "IFRS 17 CSM Roll-Forward Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-178-ifrs17-csm-rollforward-validator.html",
    "description": "Validate IFRS 17 Contractual Service Margin (CSM) roll-forward mechanics: opening CSM + new business + interest accretion + experience adjus",
    "consumes": [
      "art-177-ifrs17-measurement-model-classifier"
    ],
    "feeds": [
      "art-179-ifrs17-risk-adjustment-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-179-ifrs17-risk-adjustment-checker",
    "display_name": "IFRS 17 Risk Adjustment Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-179-ifrs17-risk-adjustment-checker.html",
    "description": "Check IFRS 17 risk-adjustment (RA) disclosure completeness: validates technique (VaR/CTE/CoC/other per IFRS 17 para 119b), confidence-level ",
    "consumes": [
      "art-178-ifrs17-csm-rollforward-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-18-mcp-developer-readiness-scorecard",
    "display_name": "MCP Developer Readiness Scorecard",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-18-mcp-developer-readiness-scorecard.html",
    "description": "Rolls up caller-supplied yes/partial/no answers across six MCP ship-readiness sections (tool definitions, server.json/registry, OAuth 2.1, t",
    "consumes": [
      "art-17-ap2-mcp-policy-validator",
      "art-23-visa-trusted-agent-protocol-inspector",
      "art-24-mastercard-agentic-token-builder",
      "art-25-a2a-agent-card-validator",
      "art-26-x402-payload-decoder-flow-simulator",
      "art-27-agentic-readiness-diagnostic",
      "art-28-mcp-server-deployability-diagnostic"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-180-solvency2-scr-ratio-calculator",
    "display_name": "Solvency II SCR Ratio Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-180-solvency2-scr-ratio-calculator.html",
    "description": "Calculate Solvency II SCR and MCR coverage ratios from eligible own funds and capital requirements. Checks the three own-funds tiering limit",
    "consumes": [],
    "feeds": [
      "art-181-sii-ifrs17-reconciliation-bridger"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-181-sii-ifrs17-reconciliation-bridger",
    "display_name": "SII-IFRS 17 Reconciliation Bridger",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-181-sii-ifrs17-reconciliation-bridger.html",
    "description": "Bridge Solvency II technical provisions (best estimate + risk margin) to IFRS 17 insurance contract liabilities (fulfilment cash flows + ris",
    "consumes": [
      "art-180-solvency2-scr-ratio-calculator"
    ],
    "feeds": [
      "art-182-insurance-reporting-readiness-diagnostic"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-182-insurance-reporting-readiness-diagnostic",
    "display_name": "Insurance Reporting Readiness Diagnostic",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-182-insurance-reporting-readiness-diagnostic.html",
    "description": "A-F insurance reporting readiness diagnostic across six dimensions: IFRS 17 measurement model election, CSM system implementation, risk-adju",
    "consumes": [
      "art-181-sii-ifrs17-reconciliation-bridger"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-183-irrbb-eve-shock-calculator",
    "display_name": "IRRBB EVE Shock Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-183-irrbb-eve-shock-calculator.html",
    "description": "Calculate Delta Economic Value of Equity (EVE) under the 6 BCBS d368 / EBA standardised IRRBB shock scenarios (parallel up, parallel down, s",
    "consumes": [],
    "feeds": [
      "art-184-irrbb-sot-eve-evaluator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-184-irrbb-sot-eve-evaluator",
    "display_name": "IRRBB SOT EVE Evaluator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-184-irrbb-sot-eve-evaluator.html",
    "description": "Evaluate the EBA Supervisory Outlier Test (SOT) on Economic Value of Equity: the worst-case delta EVE decline across the 6 standardised shoc",
    "consumes": [
      "art-183-irrbb-eve-shock-calculator"
    ],
    "feeds": [
      "art-185-irrbb-sot-nii-evaluator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-185-irrbb-sot-nii-evaluator",
    "display_name": "IRRBB SOT NII Evaluator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-185-irrbb-sot-nii-evaluator.html",
    "description": "Evaluate the Net Interest Income (NII) leg of the EBA Supervisory Outlier Test: the worst-case 1-year delta NII under parallel up/down shock",
    "consumes": [
      "art-184-irrbb-sot-eve-evaluator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-186-irrbb-standardised-approach-mapper",
    "display_name": "IRRBB Standardised Approach Mapper",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-186-irrbb-standardised-approach-mapper.html",
    "description": "Map non-maturing deposit (NMD) positions to the EBA standardised / simplified-standardised approach behavioural caps (BCBS d368 para 87 / An",
    "consumes": [],
    "feeds": [
      "art-187-irrbb-csrbb-scope-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-187-irrbb-csrbb-scope-checker",
    "display_name": "IRRBB CSRBB Scope Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-187-irrbb-csrbb-scope-checker.html",
    "description": "Identify Credit Spread Risk in the Banking Book (CSRBB) scope per EBA Guidelines on IRRBB and CSRBB (EBA/GL/2022/14): instruments held at fa",
    "consumes": [
      "art-186-irrbb-standardised-approach-mapper"
    ],
    "feeds": [
      "art-188-irrbb-disclosure-readiness-diagnostic"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-188-irrbb-disclosure-readiness-diagnostic",
    "display_name": "IRRBB Disclosure Readiness Diagnostic",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-188-irrbb-disclosure-readiness-diagnostic.html",
    "description": "A-F IRRBB disclosure readiness diagnostic across five dimensions: EVE shock calculation performed, SOT (EVE + NII) evaluated, standardised a",
    "consumes": [
      "art-187-irrbb-csrbb-scope-checker"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-189-markdown-document-converter",
    "display_name": "Markdown Document Converter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-189-markdown-document-converter.html",
    "description": "Deterministic Markdown to HTML and plain text over a hand-rolled CommonMark subset (headings, bold/italic/code spans, fenced code, blockquot",
    "consumes": [],
    "feeds": [
      "art-191-conversion-receipt-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-19-agentic-checkout-protocol-selector",
    "display_name": "Agentic Checkout Protocol Selector",
    "mandate_type": "routing_policy",
    "url": "https://ainumbers.co/chaingraph/art-19-agentic-checkout-protocol-selector.html",
    "description": "Scores ACP, UCP, x402, and Visa TAP against platform profile (buyer type, AOV, geography, stack capabilities) and returns a ranked protocol ",
    "consumes": [],
    "feeds": [
      "art-20-acp-ucp-product-feed-conformance-auditor",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-190-tabular-data-converter",
    "display_name": "Tabular Data Converter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-190-tabular-data-converter.html",
    "description": "Deterministic conversion across CSV, JSON (array of objects), and GFM pipe tables with RFC 4180 CSV parsing (quoted fields, embedded delimit",
    "consumes": [],
    "feeds": [
      "art-191-conversion-receipt-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-191-conversion-receipt-builder",
    "display_name": "Conversion Receipt Builder",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/art-191-conversion-receipt-builder.html",
    "description": "Binds one file-conversion event into a canonical receipt tying the input digest to the converter identity, the parameters, and the output di",
    "consumes": [],
    "feeds": [
      "art-192-conversion-receipt-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-192-conversion-receipt-verifier",
    "display_name": "Conversion Receipt Verifier",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/art-192-conversion-receipt-verifier.html",
    "description": "Re-verifies a conversion receipt from art-191: recomputes binding_sha256 over the JCS-canonical receipt and compares, checks structure and h",
    "consumes": [
      "art-191-conversion-receipt-builder"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-193-metadata-sanitization-prover",
    "display_name": "Metadata Sanitization Prover",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-193-metadata-sanitization-prover.html",
    "description": "Produces a proof-of-sanitization record binding the original digest to the findings removed, redacted, or retained and to the sanitized dige",
    "consumes": [],
    "feeds": [
      "art-191-conversion-receipt-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-194-digest-manifest-builder",
    "display_name": "Digest Manifest Builder",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/art-194-digest-manifest-builder.html",
    "description": "Binds N file digests into one canonical, hash-anchored manifest. manifest_sha256 is SHA-256 over the JCS-canonical sorted entries array. Thi",
    "consumes": [],
    "feeds": [
      "art-191-conversion-receipt-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-195-creative-commons-license-chooser",
    "display_name": "Creative Commons License Chooser",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-195-creative-commons-license-chooser.html",
    "description": "Deterministic two-question decision tree mapping creator answers (waive all rights, allow commercial, allow adaptations) to the matching Cre",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-196-cant-be-evil-license-selector",
    "display_name": "Can't Be Evil License Selector",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-196-cant-be-evil-license-selector.html",
    "description": "Rights-matrix lookup for a16z's six Can't Be Evil NFT licenses. Maps creator answers (waive all, commercial use, exclusivity, objectionable-",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-197-pil-flavor-mapper",
    "display_name": "Story PIL Flavor Mapper",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-197-pil-flavor-mapper.html",
    "description": "Maps creator answers (commercial use, derivatives allowed, optional minting fee, revenue share percent) to a Story Protocol Programmable IP ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-198-cross-license-rights-comparator",
    "display_name": "Cross-License Rights Comparator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-198-cross-license-rights-comparator.html",
    "description": "Compares any two licenses from the CC, CBE, and PIL families on a 9-dimension rights vector (copy, display, commercial, exclusive, modify, s",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-199-license-election-certifier",
    "display_name": "License Election Certifier",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/art-199-license-election-certifier.html",
    "description": "Binds a license election (family, id, params) to a named asset and licensor DID, producing a deterministic terms_hash via SHA-256 over the J",
    "consumes": [
      "art-197-pil-flavor-mapper",
      "art-196-cant-be-evil-license-selector",
      "art-195-creative-commons-license-chooser"
    ],
    "feeds": [
      "art-200-license-election-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-20-acp-ucp-product-feed-conformance-auditor",
    "display_name": "ACP/UCP Product-Feed Conformance Auditor",
    "mandate_type": "scheme_rule",
    "url": "https://ainumbers.co/chaingraph/art-20-acp-ucp-product-feed-conformance-auditor.html",
    "description": "Validates product/checkout/mandate JSON payloads against ACP or UCP field schemas (5 schema arrays). Identifies missing required fields, typ",
    "consumes": [
      "art-19-agentic-checkout-protocol-selector"
    ],
    "feeds": [
      "art-21-agent-traffic-acceptance-policy-builder",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-200-license-election-verifier",
    "display_name": "License Election Verifier",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/art-200-license-election-verifier.html",
    "description": "Verifies a certificate produced by the License Election Certifier by recomputing the SHA-256 terms_hash over the JCS-canonical election core",
    "consumes": [
      "art-199-license-election-certifier"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-201-iscc-content-code-generator",
    "display_name": "ISCC Content Code Generator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-201-iscc-content-code-generator.html",
    "description": "Generates ISO 24138 ISCC content fingerprints for digital content. Computes Instance-Code (BLAKE3 data integrity), Data-Code (CDC + minhash ",
    "consumes": [],
    "feeds": [
      "art-202-tdmrep-reservation-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-202-tdmrep-reservation-builder",
    "display_name": "TDMRep AI Training Reservation Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-202-tdmrep-reservation-builder.html",
    "description": "Builds W3C TDMRep AI-training rights reservation records from a reservation flag, optional location scope pattern, optional policy URL, and ",
    "consumes": [
      "art-201-iscc-content-code-generator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-203-embedded-license-selector",
    "display_name": "Embedded License Selector",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-203-embedded-license-selector.html",
    "description": "Maps creator answers to the SolSea and ALL.ART 4-tier embedded-license menu: Private/No Commercial, Personal/Public Display/No Commercial, P",
    "consumes": [
      "art-198-cross-license-rights-comparator"
    ],
    "feeds": [
      "art-204-license-compatibility-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-204-license-compatibility-checker",
    "display_name": "License Compatibility Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-204-license-compatibility-checker.html",
    "description": "Checks whether a child license can derive from a parent asset license. Returns compatible flag, reason codes (ND_BLOCKS_DERIVATIVE, SA_REQUI",
    "consumes": [
      "art-203-embedded-license-selector",
      "art-198-cross-license-rights-comparator"
    ],
    "feeds": [
      "art-205-license-terms-assembler"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-205-license-terms-assembler",
    "display_name": "License Terms Assembler",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-205-license-terms-assembler.html",
    "description": "Renders a deterministic license term sheet by substituting field values into a pre-approved template (CC-STANDARD-USE, IP3-RIGHTS-RECORD, NF",
    "consumes": [
      "art-204-license-compatibility-checker"
    ],
    "feeds": [
      "art-206-rights-record-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-206-rights-record-builder",
    "display_name": "Rights Record Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-206-rights-record-builder.html",
    "description": "Builds a normalized IP3-style rights-portfolio row from licensor, licensee, territory, term, rights vector, and renewal fields. Computes a d",
    "consumes": [
      "art-205-license-terms-assembler"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-207-attribution-string-generator",
    "display_name": "Attribution String Generator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-207-attribution-string-generator.html",
    "description": "Generates a human-readable TASL (Title/Author/Source/License) attribution line plus machine-readable ccREL JSON-LD and RDFa blocks for any C",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-208-royalty-split-validator",
    "display_name": "Royalty Split Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-208-royalty-split-validator.html",
    "description": "Validates a royalty-split configuration against ERC-2981 and 0xSplits rules: share sum, per-recipient cap, no duplicate or zero addresses, b",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-209-nft-metadata-validator",
    "display_name": "NFT Metadata Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-209-nft-metadata-validator.html",
    "description": "Validates ERC-721/ERC-1155 and OpenSea NFT metadata JSON against required fields (name, description, image), recommended fields (external_ur",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-21-agent-traffic-acceptance-policy-builder",
    "display_name": "Agent-Traffic Acceptance Policy Builder",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-21-agent-traffic-acceptance-policy-builder.html",
    "description": "Builds a policy mandate governing accepted AI agent types, identity verification level, velocity and value caps, payment rails, refund postu",
    "consumes": [
      "art-20-acp-ucp-product-feed-conformance-auditor"
    ],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-210-ipfs-cid-computer",
    "display_name": "IPFS CID Computer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-210-ipfs-cid-computer.html",
    "description": "Computes a CIDv1 content address for text or metadata using SHA-256 multihash, raw codec (0x55), and base32 lowercase multibase prefix. Use ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-211-prediction-market-analyzer",
    "display_name": "Prediction Market Analyzer",
    "mandate_type": "event_market_pnl",
    "url": "https://ainumbers.co/chaingraph/art-211-prediction-market-analyzer.html",
    "description": "Computes prediction market PnL, implied probability, break-even, no-vig fair value, expected value, Kelly stake, and odds conversion for bin",
    "consumes": [],
    "feeds": [
      "art-212-prediction-market-arbitrage"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-212-prediction-market-arbitrage",
    "display_name": "Prediction Market Arbitrage",
    "mandate_type": "event_market_pnl",
    "url": "https://ainumbers.co/chaingraph/art-212-prediction-market-arbitrage.html",
    "description": "Calculates cross-venue prediction market arbitrage: gross spread, fee-adjusted net edge, required capital, and minimum spread to survive fee",
    "consumes": [
      "art-211-prediction-market-analyzer"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-213-perp-liquidation-calculator",
    "display_name": "Perp Margin and Liquidation Calculator",
    "mandate_type": "derivatives_margin_health",
    "url": "https://ainumbers.co/chaingraph/art-213-perp-liquidation-calculator.html",
    "description": "Computes perp liquidation price, margin health, buffer, and distance to liquidation for isolated and cross-margin modes. Covers Hyperliquid,",
    "consumes": [],
    "feeds": [
      "art-214-perp-position-lifecycle"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-214-perp-position-lifecycle",
    "display_name": "Perp Position Lifecycle",
    "mandate_type": "derivatives_margin_health",
    "url": "https://ainumbers.co/chaingraph/art-214-perp-position-lifecycle.html",
    "description": "Models a full perp position from open to close: liquidation price, realized PnL, cumulative funding over the holding period, taker and maker",
    "consumes": [
      "art-213-perp-liquidation-calculator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-215-reg-z-appendix-j-apr",
    "display_name": "Reg Z Appendix J APR Solver",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-215-reg-z-appendix-j-apr.html",
    "description": "Reg Z Appendix J actuarial APR solver. Bracketed bisection on the general actuarial equation (12 CFR 1026 Appendix J), with the odd-days fra",
    "consumes": [
      "art-332-build-amortization-schedule"
    ],
    "feeds": [
      "art-217-trid-apr-accuracy"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-216-trid-tolerance-cure",
    "display_name": "TRID Fee Tolerance and Cure",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-216-trid-tolerance-cure.html",
    "description": "TRID fee tolerance analysis and cure calculation per Reg Z §1026.19(e)(3). Classifies each closing fee into zero-tolerance, ten-percent cumu",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-217-trid-apr-accuracy",
    "display_name": "TRID APR Accuracy Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-217-trid-apr-accuracy.html",
    "description": "TRID APR accuracy check per Reg Z §1026.22(a). Verifies disclosed APR against actual APR within 1/8 percentage point tolerance for regular t",
    "consumes": [
      "art-215-reg-z-appendix-j-apr"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-218-qm-points-and-fees",
    "display_name": "QM Points and Fees Test",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-218-qm-points-and-fees.html",
    "description": "Qualified Mortgage points-and-fees test per Reg Z §1026.43(e)(3). Applies version-pinned 2021-2026 tier table with Federal Register citation",
    "consumes": [],
    "feeds": [
      "art-219-qm-apr-apor-spread"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-219-qm-apr-apor-spread",
    "display_name": "QM APR-APOR Spread Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-219-qm-apr-apor-spread.html",
    "description": "QM APR-APOR spread test per Reg Z §1026.43(e)(2)(vi) and §1026.43(b)(4). Classifies a loan as general_qm_safe_harbor, general_qm_rebuttable_",
    "consumes": [
      "art-218-qm-points-and-fees"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-22-agentic-payments-protocol-comparator",
    "display_name": "Agentic Payments Protocol Comparator",
    "mandate_type": "routing_policy",
    "url": "https://ainumbers.co/chaingraph/art-22-agentic-payments-protocol-comparator.html",
    "description": "Compares AP2, ACP, x402, Visa TAP, Mastercard Agentic Token, and Tempo MPP (Machine Payments Protocol) across 8 dimensions (backer, artifact",
    "consumes": [],
    "feeds": [
      "art-16-google-ap2-mandate-builder",
      "art-23-visa-trusted-agent-protocol-inspector",
      "art-24-mastercard-agentic-token-builder",
      "art-25-a2a-agent-card-validator",
      "art-26-x402-payload-decoder-flow-simulator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-220-reg-z-threshold-lookup",
    "display_name": "Reg Z Threshold Lookup",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.html",
    "description": "Reg Z version-pinned threshold lookup service. Tables: qm_points_fees, hoepa, hpml, card_penalty. 2021-2026 rows with Federal Register citat",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-221-llpa-stack",
    "display_name": "LLPA Stack Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-221-llpa-stack.html",
    "description": "Fannie Mae public LLPA (Loan-Level Price Adjustment) matrix calculator. FICO-by-LTV base grid plus feature surcharges: cash-out refinance, s",
    "consumes": [
      "art-222-agency-eligibility-matrix"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-222-agency-eligibility-matrix",
    "display_name": "Agency Eligibility Matrix",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-222-agency-eligibility-matrix.html",
    "description": "Fannie Mae DU and Freddie Mac LPA agency eligibility matrix. Checks DTI caps (DU/LPA: 50%; manual UW: 36% housing / 45% total), LTV/CLTV/HCL",
    "consumes": [
      "art-223-conforming-loan-limit"
    ],
    "feeds": [
      "art-221-llpa-stack"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-223-conforming-loan-limit",
    "display_name": "Conforming Loan Limit Check",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-223-conforming-loan-limit.html",
    "description": "FHFA annual conforming loan limit classifier. 2026 baseline: $806,500 (1-unit), $1,032,650 (2-unit), $1,248,150 (3-unit), $1,550,400 (4-unit",
    "consumes": [],
    "feeds": [
      "art-222-agency-eligibility-matrix"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-224-fha-mip-eligibility",
    "display_name": "FHA MIP Eligibility Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-224-fha-mip-eligibility.html",
    "description": "FHA mortgage insurance premium (MIP) eligibility and cost calculator per HUD Handbook 4000.1. UFMIP: 1.75% of base loan. Annual MIP grid (0.",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-225-va-funding-fee-residual",
    "display_name": "VA Funding Fee and Residual Income",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-225-va-funding-fee-residual.html",
    "description": "VA home loan funding fee (38 USC §3729) and residual income qualification. Funding fee table: first vs subsequent use, down-payment tiers (0",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-226-mismo-uldd-ulad",
    "display_name": "ULDD/ULAD Structural Linter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-226-mismo-uldd-ulad.html",
    "description": "ULDD Phase 5 / ULAD structural lint of required data points, enumerations, and conditionality rules. Checks field presence against ULDD Phas",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-227-validate-adverse-action-notice",
    "display_name": "Validate Adverse Action Notice",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-227-validate-adverse-action-notice.html",
    "description": "Validates an adverse action notice against Reg B §1002.9 completeness requirements: reason count (max 4), prohibited vague reason codes (CFP",
    "consumes": [
      "art-228-build-adverse-action-notice"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-228-build-adverse-action-notice",
    "display_name": "Build Adverse Action Notice",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-228-build-adverse-action-notice.html",
    "description": "Assembles an adverse action notice skeleton from SHAP-ranked principal-factor codes (FICO reason codes 01-40, VantageScore VS001-VS015). Res",
    "consumes": [],
    "feeds": [
      "art-227-validate-adverse-action-notice"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-229-compute-disparity-metrics",
    "display_name": "Compute Disparate Impact Metrics",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-229-compute-disparity-metrics.html",
    "description": "Computes three fair lending disparate impact metrics from aggregate lending counts: 4/5ths (80%) rule (adverse_impact_ratio) per EEOC 29 CFR",
    "consumes": [
      "art-230-compute-hmda-rate-spread"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-23-visa-trusted-agent-protocol-inspector",
    "display_name": "Visa Trusted Agent Protocol (TAP) Signature Inspector",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-23-visa-trusted-agent-protocol-inspector.html",
    "description": "Parses and scores Visa TAP Signature-Input / Signature header pairs (RFC 9421 HTTP Message Signatures). Runs a 5-question TAP Readiness Asse",
    "consumes": [
      "art-16-google-ap2-mandate-builder",
      "art-22-agentic-payments-protocol-comparator"
    ],
    "feeds": [
      "art-18-mcp-developer-readiness-scorecard",
      "art-24-mastercard-agentic-token-builder",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-230-compute-hmda-rate-spread",
    "display_name": "Compute HMDA Rate Spread",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-230-compute-hmda-rate-spread.html",
    "description": "Computes the HMDA rate spread (APR minus APOR) per FFIEC methodology and classifies against HMDA reportability thresholds: 1.5 pp (first lie",
    "consumes": [],
    "feeds": [
      "art-229-compute-disparity-metrics"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-231-compute-mla-mapr",
    "display_name": "Compute MLA MAPR",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-231-compute-mla-mapr.html",
    "description": "Computes the Military Annual Percentage Rate (MAPR) per 32 CFR §232.4(c) and checks compliance with the 36% cap. MAPR includes all charges e",
    "consumes": [],
    "feeds": [
      "art-232-compute-scra-rate-cap"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-232-compute-scra-rate-cap",
    "display_name": "Compute SCRA Rate Cap",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-232-compute-scra-rate-cap.html",
    "description": "Computes the SCRA 6% interest rate cap per 50 USC §3937 for pre-service loan obligations. Calculates covered months, excess interest, and fo",
    "consumes": [
      "art-231-compute-mla-mapr"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-233-check-card-act-ability-to-pay",
    "display_name": "Check CARD Act Ability to Pay",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-233-check-card-act-ability-to-pay.html",
    "description": "Evaluates a credit card application against CARD Act §1026.51 ability-to-pay requirements. Computes monthly minimum payment from the request",
    "consumes": [],
    "feeds": [
      "art-228-build-adverse-action-notice"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-234-test-hoepa-high-cost",
    "display_name": "HOEPA High-Cost Mortgage Trigger Test",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-234-test-hoepa-high-cost.html",
    "description": "Tests all three HOEPA high-cost mortgage triggers per Reg Z §1026.32(a)(1): (i) APR trigger (APOR+6.5pp first-lien, APOR+8.5pp subordinate o",
    "consumes": [
      "art-220-reg-z-threshold-lookup"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-235-test-hpml-escrow",
    "display_name": "HPML Definition and Escrow Requirement Test",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-235-test-hpml-escrow.html",
    "description": "Tests whether a loan qualifies as a Higher-Priced Mortgage Loan (HPML) per Reg Z §1026.35(a)(1): APOR+1.5pp first-lien, APOR+2.5pp jumbo, AP",
    "consumes": [
      "art-220-reg-z-threshold-lookup"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-236-build-ai-decision-log-record",
    "display_name": "AI Decision Log Record Builder (EU AI Act Art 12)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-236-build-ai-decision-log-record.html",
    "description": "Builds an EU AI Act Art 12(2)-conformant decision log record for high-risk AI systems in financial services. Computes chain_position (first/",
    "consumes": [],
    "feeds": [
      "art-237-validate-agent-audit-trail",
      "art-238-classify-annex3-decisioning-obligations"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-237-validate-agent-audit-trail",
    "display_name": "Agent Audit Trail Conformance Validator (IETF AAT)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-237-validate-agent-audit-trail.html",
    "description": "Validates agent audit trail records against IETF draft-sharif-agent-audit-trail-00 (AAT, expires Sept 2026). Checks required fields (agent_i",
    "consumes": [
      "art-236-build-ai-decision-log-record"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-238-classify-annex3-decisioning-obligations",
    "display_name": "EU AI Act Annex III FS Decisioning Obligations Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-238-classify-annex3-decisioning-obligations.html",
    "description": "EXTENDS run_ai_act_highrisk_fit (art-64). Resolves financial-services-specific Art 12, 26, and 27 compliance obligations for Annex III 5(b) ",
    "consumes": [
      "art-64-ai-act-highrisk-fit-diagnostic"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-239-test-bifsg-bias-thresholds",
    "display_name": "BIFSG Insurance Proxy Bias Threshold Test (Colorado SB 21-169)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-239-test-bifsg-bias-thresholds.html",
    "description": "Tests BIFSG proxy bias thresholds under Colorado SB 21-169 / Reg. 10-1-1 for insurance AI models. ZERO PII: accepts aggregate regression out",
    "consumes": [],
    "feeds": [
      "art-240-assess-naic-ais-program-readiness"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-24-mastercard-agentic-token-builder",
    "display_name": "Mastercard Agentic Token Scope Builder",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-24-mastercard-agentic-token-builder.html",
    "description": "Builds or lints a Mastercard Agent Pay Agentic Token scope: agent binding, merchant scope, consent policy (limits, expiry, velocity, MCC). T",
    "consumes": [
      "art-22-agentic-payments-protocol-comparator",
      "art-23-visa-trusted-agent-protocol-inspector"
    ],
    "feeds": [
      "art-18-mcp-developer-readiness-scorecard",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-240-assess-naic-ais-program-readiness",
    "display_name": "NAIC AI Systems Program Readiness Assessment",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-240-assess-naic-ais-program-readiness.html",
    "description": "Scores insurance AI program readiness against the NAIC Model Bulletin on the Use of Artificial Intelligence Systems by Insurers (adopted 4 D",
    "consumes": [
      "art-239-test-bifsg-bias-thresholds"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-241-cbpr-structured-address-linter",
    "display_name": "CBPR+ Structured Address Linter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-241-cbpr-structured-address-linter.html",
    "description": "Lints a single pacs.008 PostalAddress24 block against the SWIFT CBPR+ November 2026 mandate. Detects unstructured AdrLine-only addresses (pr",
    "consumes": [],
    "feeds": [
      "art-242-pacs008-party-completeness-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-242-pacs008-party-completeness-validator",
    "display_name": "pacs.008 Party Completeness Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-242-pacs008-party-completeness-validator.html",
    "description": "Validates BIS CPMI d218 harmonised data requirements for a pacs.008 payment instruction: UETR UUIDv4 format, debtor and creditor names, BIC ",
    "consumes": [
      "art-241-cbpr-structured-address-linter"
    ],
    "feeds": [
      "art-246-lei-payment-binding-linter"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-243-purpose-code-requirement-checker",
    "display_name": "ISO 20022 Purpose Code Requirement Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-243-purpose-code-requirement-checker.html",
    "description": "Given a beneficiary country and payment amount, determines whether ExternalPurpose1Code (Purp/Cd) or ExternalCategoryPurpose1Code (CtgyPurp/",
    "consumes": [],
    "feeds": [
      "art-247-prevalidation-readiness-scorer"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-244-gpi-tracker-lifecycle-simulator",
    "display_name": "SWIFT GPI Tracker Lifecycle Simulator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-244-gpi-tracker-lifecycle-simulator.html",
    "description": "Validates SWIFT GPI pacs.002 payment status code transitions against the GPI state machine (PDNG, ACSP, ACSP/ACWC, ACCC, RJCT) and checks th",
    "consumes": [],
    "feeds": [
      "art-245-mt-mx-translation-fidelity-scorer"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-245-mt-mx-translation-fidelity-scorer",
    "display_name": "MT103 to MX Translation Fidelity Scorer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-245-mt-mx-translation-fidelity-scorer.html",
    "description": "Scores ISO 15022 MT103 to ISO 20022 pacs.008 translation fidelity for CBPR+ November 2026 migration. Checks field presence mapping (:20: to ",
    "consumes": [
      "art-244-gpi-tracker-lifecycle-simulator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-246-lei-payment-binding-linter",
    "display_name": "Wolfsberg Payment Transparency & LEI Binding Linter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-246-lei-payment-binding-linter.html",
    "description": "Full ISO 17442 LEI check-digit validation via ISO 7064 Mod 97-10 for originator and beneficiary LEIs in pacs.008. Also scores Wolfsberg Paym",
    "consumes": [
      "art-242-pacs008-party-completeness-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-247-prevalidation-readiness-scorer",
    "display_name": "Cross-Border Payment Prevalidation Readiness Scorer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-247-prevalidation-readiness-scorer.html",
    "description": "Aggregate CBPR+ pre-validation readiness check for a single pacs.008 payment instruction. Combines IBAN mod-97 check (ISO 13616), BIC format",
    "consumes": [
      "art-243-purpose-code-requirement-checker"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-248-compute-remittance-disclosure",
    "display_name": "Remittance Disclosure Calculator (Reg E Subpart B)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-248-compute-remittance-disclosure.html",
    "description": "Computes the required Reg E subpart B (12 CFR 1005.31/1005.32) remittance disclosure fields: transfer_amount_usd (send minus fees), exchange",
    "consumes": [],
    "feeds": [
      "art-249-compare-corridor-cost"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-249-compare-corridor-cost",
    "display_name": "Corridor Cost Comparator (World Bank RPW)",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-249-compare-corridor-cost.html",
    "description": "Benchmarks a remittance corridor total cost (fee % + FX margin %) against the World Bank Remittance Prices Worldwide (RPW) Q1 2026 snapshot ",
    "consumes": [
      "art-248-compute-remittance-disclosure",
      "art-250-model-stablecoin-corridor-economics"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-25-a2a-agent-card-validator",
    "display_name": "A2A Agent Card Validator & Extension Checker",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-25-a2a-agent-card-validator.html",
    "description": "Validates an A2A agent-card.json against the v1.0 shape: identity fields, capabilities, extensions (AP2/x402), input/output modes, skills, p",
    "consumes": [
      "art-22-agentic-payments-protocol-comparator"
    ],
    "feeds": [
      "art-18-mcp-developer-readiness-scorecard",
      "art-26-x402-payload-decoder-flow-simulator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-250-model-stablecoin-corridor-economics",
    "display_name": "Stablecoin Corridor Economics Model",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-250-model-stablecoin-corridor-economics.html",
    "description": "Models the all-in cost of a USDC-based remittance corridor: on-ramp fee, chain gas fee, off-ramp/local-rail fee, FX spread, and pre-funding ",
    "consumes": [],
    "feeds": [
      "art-249-compare-corridor-cost"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-251-compute-parametric-trigger-payout",
    "display_name": "Parametric Trigger Payout Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-251-compute-parametric-trigger-payout.html",
    "description": "Evaluates parametric insurance triggers and computes payout amounts. Supports three trigger types: threshold (binary payout at a threshold i",
    "consumes": [],
    "feeds": [
      "art-252-validate-cat-bond-trigger-terms"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-252-validate-cat-bond-trigger-terms",
    "display_name": "Cat Bond Trigger Terms Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-252-validate-cat-bond-trigger-terms.html",
    "description": "Validates catastrophe bond trigger term structure and computes layer arithmetic: attachment/exhaustion point ordering, pro-rata layer penetr",
    "consumes": [
      "art-251-compute-parametric-trigger-payout"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-253-run-illustration-selfsupport-test",
    "display_name": "Life Illustration Self-Support Test (NAIC Model 582)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-253-run-illustration-selfsupport-test.html",
    "description": "Runs the NAIC Model Regulation 582 §8C self-support test (year 15 and year 20 account value positive) and §8D lapse-support prohibition chec",
    "consumes": [],
    "feeds": [
      "art-254-compute-rbc-action-level"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-254-compute-rbc-action-level",
    "display_name": "NAIC RBC Action Level Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-254-compute-rbc-action-level.html",
    "description": "Computes NAIC Risk-Based Capital (RBC) action level classification for US P&C, life, and health insurers. RBC ratio = TAC / ACL * 100%. Acti",
    "consumes": [
      "art-253-run-illustration-selfsupport-test"
    ],
    "feeds": [
      "art-257-calculate-claims-stp-economics"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-255-compute-lcm-rate-derivation",
    "display_name": "LCM Rate Derivation Calculator",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-255-compute-lcm-rate-derivation.html",
    "description": "Computes the Loss Cost Multiplier (LCM) and indicated insurance rate from user-supplied loss costs and expense/profit loadings. LCM = 1 / (1",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-256-validate-openids-homeowners-record",
    "display_name": "openIDS Homeowners Record Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-256-validate-openids-homeowners-record.html",
    "description": "Validates homeowners insurance data records against the openIDS Homeowners Data Standard v1.0 (AAIS / Linux Foundation, November 2025) -- th",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-257-calculate-claims-stp-economics",
    "display_name": "Claims STP Economics Calculator",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-257-calculate-claims-stp-economics.html",
    "description": "Computes the financial business case for insurance claims Straight-Through Processing (STP) automation. Models handling cost reduction from ",
    "consumes": [
      "art-254-compute-rbc-action-level"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-258-parse-camt053-reconciliation",
    "display_name": "ISO 20022 camt.053 Statement Reconciliation",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-258-parse-camt053-reconciliation.html",
    "description": "Classifies ISO 20022 camt.053 BkTxCd entries by Domain, Family, and SubFamily per the CGI-MP camt.053 Usage Guide v5.0 and the ISO 20022 Ext",
    "consumes": [],
    "feeds": [
      "art-263-score-cash-forecast-accuracy"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-259-compute-multilateral-netting",
    "display_name": "Multilateral Cash Netting",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-259-compute-multilateral-netting.html",
    "description": "Computes N-entity corporate cash netting: gross inter-company positions to net positions to minimum settlement legs using the BIS CPMI greed",
    "consumes": [],
    "feeds": [
      "art-260-allocate-ihb-interest"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-26-x402-payload-decoder-flow-simulator",
    "display_name": "x402 Header Decoder, Payload Linter & 402 Flow Simulator",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-26-x402-payload-decoder-flow-simulator.html",
    "description": "Decodes base64 PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE headers, lints exact-scheme PaymentPayload (EIP-3009 style authorizat",
    "consumes": [
      "art-22-agentic-payments-protocol-comparator",
      "art-25-a2a-agent-card-validator"
    ],
    "feeds": [
      "art-03-x402-settlement-modeler",
      "art-18-mcp-developer-readiness-scorecard",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-260-allocate-ihb-interest",
    "display_name": "IHB Interest Allocation",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-260-allocate-ihb-interest.html",
    "description": "Allocates overnight in-house-bank (IHB) interest across notional pool or ZBA sweep members. OECD Transfer Pricing Guidelines 2022 Chapter X ",
    "consumes": [
      "art-259-compute-multilateral-netting",
      "art-262-validate-ebam-acmt-flow"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-261-test-hedge-effectiveness",
    "display_name": "Hedge Effectiveness Test",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-261-test-hedge-effectiveness.html",
    "description": "ASC 815-20-35 retrospective hedge effectiveness test. Computes dollar-offset ratio (fair-value change of hedging instrument / hedged item, m",
    "consumes": [],
    "feeds": [
      "art-263-score-cash-forecast-accuracy"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-262-validate-ebam-acmt-flow",
    "display_name": "eBAM Account Message Flow Validation",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-262-validate-ebam-acmt-flow.html",
    "description": "Validates the CGI-MP eBAM 2023 account message state machine across acmt.007 (opening request), acmt.010 (opening confirmation), acmt.011 (c",
    "consumes": [],
    "feeds": [
      "art-260-allocate-ihb-interest"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-263-score-cash-forecast-accuracy",
    "display_name": "Cash Forecast Accuracy Scoring",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-263-score-cash-forecast-accuracy.html",
    "description": "Scores treasury cash forecast accuracy per AFP Cash Forecasting Survey 2024 benchmarks. Computes MAPE and directional bias across T+1/T+7/T+",
    "consumes": [
      "art-258-parse-camt053-reconciliation",
      "art-261-test-hedge-effectiveness"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-264-validate-commission-hierarchy",
    "display_name": "Commission Hierarchy Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-264-validate-commission-hierarchy.html",
    "description": "BFS structural validation of multi-level sales commission hierarchies. Detects orphan agents (unreachable from root), circular references (c",
    "consumes": [],
    "feeds": [
      "art-266-reconcile-commission-statement"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-265-amortize-asc606-commissions",
    "display_name": "ASC 340-40 Commission Amortization",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-265-amortize-asc606-commissions.html",
    "description": "Computes ASC 340-40-25-4 practical expedient (contract_term_months <= 12 -> expense immediately, apply_expedient=true) and full straight-lin",
    "consumes": [
      "art-266-reconcile-commission-statement"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-266-reconcile-commission-statement",
    "display_name": "Commission Statement Reconciler",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-266-reconcile-commission-statement.html",
    "description": "Line-item reconciliation of expected vs. received commission payments per contract. Computes variance_amount and variance_pct per line. Sets",
    "consumes": [
      "art-264-validate-commission-hierarchy"
    ],
    "feeds": [
      "art-265-amortize-asc606-commissions"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-267-check-producer-license-reciprocity",
    "display_name": "NAIC Producer License Reciprocity Check",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-267-check-producer-license-reciprocity.html",
    "description": "Checks NAIC producer license reciprocity for non-resident filing across target states per MDL-218 and NIPR Reciprocity Matrix 2024. Returns ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-268-compute-cdd-ownership-25pct",
    "display_name": "FinCEN CDD 25% Beneficial Ownership Attribution",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-268-compute-cdd-ownership-25pct.html",
    "description": "Recursive indirect natural-person beneficial ownership computation via ownership-tier multiplication. 25% threshold per FinCEN CDD Rule 31 C",
    "consumes": [],
    "feeds": [
      "art-269-validate-w8-series-structural"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-269-validate-w8-series-structural",
    "display_name": "W-8 Series Structural Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-269-validate-w8-series-structural.html",
    "description": "Validates W-8 series form structural consistency for withholding tax compliance. Checks: form-type/Chapter 3 status compatibility (FORM_CH3_",
    "consumes": [
      "art-268-compute-cdd-ownership-25pct"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-27-agentic-readiness-diagnostic",
    "display_name": "Agentic Payments Readiness Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-27-agentic-readiness-diagnostic.html",
    "description": "12-question scored diagnostic: graded A–F across policy & mandates, protocol formalisation, financial-crime controls, and MCP runtime operat",
    "consumes": [],
    "feeds": [
      "art-15-agentic-mandate-sandbox",
      "art-16-google-ap2-mandate-builder",
      "art-17-ap2-mcp-policy-validator",
      "art-18-mcp-developer-readiness-scorecard"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-270-perp-funding-carry",
    "display_name": "Perp Funding and Carry Calculator",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-270-perp-funding-carry.html",
    "description": "Computes perpetual futures funding rates, compound annual APR, and cross-venue funding differential arbitrage (Hyperliquid hourly vs Binance",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-271-defi-lending-health",
    "display_name": "DeFi Lending Health and Liquidation Monitor",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-271-defi-lending-health.html",
    "description": "Computes DeFi lending health factor, liquidation price, borrow capacity, and distance to liquidation for Aave v3, Morpho Blue, Fluid, Sky (M",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-272-restaking-risk",
    "display_name": "Restaking Delegation and Slashing Risk Analyzer",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-272-restaking-risk.html",
    "description": "Models restaking delegation rewards, operator fees, AVS yield, and slashing-waterfall risk for EigenLayer and Symbiotic. Computes slashing e",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-273-pendle-yield",
    "display_name": "Pendle Yield Tokenization Analyzer (PT/YT)",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-273-pendle-yield.html",
    "description": "Decomposes Pendle Finance yield tokenization: PT implied fixed yield, YT leverage and break-even APY, PT+YT=1 invariant check, and time-to-m",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-274-compile-work-mandate",
    "display_name": "Work Mandate Compiler",
    "mandate_type": "governance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-274-compile-work-mandate.html",
    "description": "Compiles a §22 Work Mandate document into a deterministic §21.4 gated-chain config. Transforms scope.tool_ids (or scope.chains) into an orde",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-275-genius-reserve-disclosure-checker",
    "display_name": "GENIUS Act Monthly Reserve Disclosure Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-275-genius-reserve-disclosure-checker.html",
    "description": "Lints an extracted monthly reserve disclosure against GENIUS Act S.394 §4: composition-category eligibility, tenor, custody locations, a dua",
    "consumes": [],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-276-mutual-nda-composer",
    "display_name": "Mutual NDA Composer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-276-mutual-nda-composer.html",
    "description": "Assembles a Common Paper Mutual NDA (Version 1.0, CC BY 4.0) from your Cover Page Key Terms: purpose, effective date, MNDA term, term of con",
    "consumes": [],
    "feeds": [
      "art-277-agreement-acceptance-binder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-277-agreement-acceptance-binder",
    "display_name": "Agreement Acceptance Binder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-277-agreement-acceptance-binder.html",
    "description": "Binds a party's acceptance to a specific assembled agreement artifact, referenced by its execution_hash, template_id, and vendored body_sha2",
    "consumes": [
      "art-276-mutual-nda-composer"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-278-reputation-score-aggregator",
    "display_name": "Provable Reputation Score Aggregator",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-278-reputation-score-aggregator.html",
    "description": "Aggregates a set of OCG execution receipts (attestations) into a deterministic, groth16-provable reputation score across competence, integri",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-279-state-proof-verifier",
    "display_name": "State-Proof Verifier",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/art-279-state-proof-verifier.html",
    "description": "Verifies an EIP-1186 (eth_getProof) account and storage Merkle-Patricia-Trie proof against a caller-supplied trusted state root using a pure",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-28-mcp-server-deployability-diagnostic",
    "display_name": "MCP Server Deployability Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-28-mcp-server-deployability-diagnostic.html",
    "description": "12-question scored diagnostic: graded A–F across tool definitions & schemas, transport & auth, security hygiene, and operations. Single-node",
    "consumes": [],
    "feeds": [
      "art-18-mcp-developer-readiness-scorecard"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-280-reserve-proof-verifier",
    "display_name": "Reserve Proof Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-280-reserve-proof-verifier.html",
    "description": "Verifies a Merkle-sum Proof-of-Reserves customer-inclusion proof (OKX, Binance, Gate, Kraken export formats, or a generic canonical shape) a",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-281-sco60-crypto-asset-exposure-classifier",
    "display_name": "SCO60 Crypto-Asset Exposure Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-281-sco60-crypto-asset-exposure-classifier.html",
    "description": "Classifies a crypto-asset position into Basel SCO60 Group 1a, 1b, 2a, or 2b (BCBS d545 Prudential treatment of cryptoasset exposures), appli",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-282-social-security-claiming-optimizer",
    "display_name": "Social Security Claiming-Age Optimizer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-282-social-security-claiming-optimizer.html",
    "description": "Models Social Security claiming-age tradeoffs from a claimant's own PIA/FRA statement figures: early-claim reduction and delayed-retirement-",
    "consumes": [],
    "feeds": [
      "art-283-pension-lump-sum-vs-annuity-decision-engine"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-283-pension-lump-sum-vs-annuity-decision-engine",
    "display_name": "Pension Lump-Sum vs. Annuity Decision Engine",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-283-pension-lump-sum-vs-annuity-decision-engine.html",
    "description": "Compares a defined-benefit pension lump-sum offer against the single-life and joint-survivor annuity streams: present value at the stated di",
    "consumes": [
      "art-282-social-security-claiming-optimizer"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-284-did-webvh-log-verifier",
    "display_name": "did:webvh DID Log Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-284-did-webvh-log-verifier.html",
    "description": "Verifies a did:webvh self-certifying DID log: per-entry self-hash integrity, sequential versionId numbering, update-key-authorized Ed25519 s",
    "consumes": [
      "art-04-agent-identity-attestation-checker"
    ],
    "feeds": [
      "art-285-acdc-delegation-chain-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-285-acdc-delegation-chain-verifier",
    "display_name": "ACDC Delegation Chain Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-285-acdc-delegation-chain-verifier.html",
    "description": "Verifies a chain of Authentic Chained Data Containers (ACDC): per-credential SAID self-addressing integrity, issuer-to-issuee edge linkage b",
    "consumes": [
      "art-284-did-webvh-log-verifier"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-286-anchored-extract-verifier",
    "display_name": "Anchored Extract Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-286-anchored-extract-verifier.html",
    "description": "Verifies an extract's Merkle inclusion against a root only when that root is anchored by a recognized source: a recognized OCG artifact/chai",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-287-revocation-status-verifier",
    "display_name": "Revocation-Status Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-287-revocation-status-verifier.html",
    "description": "Checks a receipt's optional W3C BitstringStatusList credentialStatus reference and reads the revocation bit at statusListIndex from a suppli",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-288-map-iso20022-to-evm-calldata",
    "display_name": "ISO 20022-to-EVM Calldata Mapper",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-288-map-iso20022-to-evm-calldata.html",
    "description": "Deterministic bind of an ISO 20022 pacs.008 (customer credit transfer) or pacs.009 (FI credit transfer) payment message to EVM contract-call",
    "consumes": [],
    "feeds": [
      "art-291-screen-onledger-transfer-batch"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-289-lint-besu-settlement-contract",
    "display_name": "Besu Settlement Contract Linter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-289-lint-besu-settlement-contract.html",
    "description": "Static conformance lint of a permissioned-EVM settlement contract (Solidity source or ABI) against six invariants: atomic PvP/DvP (paired-or",
    "consumes": [],
    "feeds": [
      "art-292-attest-settlement-orchestrator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-29-dora-readiness-diagnostic",
    "display_name": "DORA Readiness Diagnostic",
    "mandate_type": "infrastructure_mandate",
    "url": "https://ainumbers.co/chaingraph/art-29-dora-readiness-diagnostic.html",
    "description": "12-question scored diagnostic across four DORA pillars (ICT risk management, incident classification & reporting, resilience testing, third-",
    "consumes": [],
    "feeds": [
      "art-09-dora-incident-classifier",
      "pnr-01-dora-ict-cascade-simulator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-290-check-linea-l2-finality-window",
    "display_name": "Linea L2 Finality Window Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-290-check-linea-l2-finality-window.html",
    "description": "Classifies a tokenized-deposit transfer’s finality risk given L2-batch to L1-settlement timing: soft (unsubmitted), batched (submitted, not ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-291-screen-onledger-transfer-batch",
    "display_name": "On-Ledger Transfer Batch Screen",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-291-screen-onledger-transfer-batch.html",
    "description": "Batch-level pre-commit sanctions and purpose-code screen for a shared-ledger transfer batch, modeled on the shipped screen_tip20_transfer_ba",
    "consumes": [
      "art-288-map-iso20022-to-evm-calldata"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-292-attest-settlement-orchestrator",
    "display_name": "Settlement Orchestrator Attestation",
    "mandate_type": "infrastructure_mandate",
    "url": "https://ainumbers.co/chaingraph/art-292-attest-settlement-orchestrator.html",
    "description": "Extends the lint_mcp_server_conformance (art-33) self-reported conformance lint to the settlement decision path: checks the off-chain orches",
    "consumes": [
      "art-289-lint-besu-settlement-contract"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-293-einvoice-format-validator",
    "display_name": "E-Invoice Format Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-293-einvoice-format-validator.html",
    "description": "Conformance-validate a structured e-invoice extract against version-pinned Factur-X, XRechnung, PINT-AE, MyInvois, Peppol BIS 3.0/EN 16931 c",
    "consumes": [],
    "feeds": [
      "art-294-einvoice-vat-calc-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-294-einvoice-vat-calc-verifier",
    "display_name": "E-Invoice VAT Calculation Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-294-einvoice-vat-calc-verifier.html",
    "description": "Recompute an e-invoice's line VAT, per-category tax subtotals, tax total, and grand total from its line items under a supplied rounding conv",
    "consumes": [
      "art-293-einvoice-format-validator"
    ],
    "feeds": [
      "art-295-einvoice-jurisdiction-mandate-router"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-295-einvoice-jurisdiction-mandate-router",
    "display_name": "E-Invoice Jurisdiction Mandate Router",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-295-einvoice-jurisdiction-mandate-router.html",
    "description": "Deterministic lookup over a version-pinned mandate table: given supplier/buyer country, transaction type, and transaction date, routes to th",
    "consumes": [
      "art-294-einvoice-vat-calc-verifier"
    ],
    "feeds": [
      "art-296-einvoice-transmission-receipt-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-296-einvoice-transmission-receipt-builder",
    "display_name": "E-Invoice Transmission Receipt Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-296-einvoice-transmission-receipt-builder.html",
    "description": "Build a hash-anchored receipt proving a specific e-invoice's transmitted bytes were format-validated and VAT-arithmetic-checked, with the ro",
    "consumes": [
      "art-295-einvoice-jurisdiction-mandate-router"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-297-agentic-dispute-ce30-linter",
    "display_name": "Agentic Dispute CE3.0 Evidence Linter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-297-agentic-dispute-ce30-linter.html",
    "description": "Deterministic lint of a supplied agentic-dispute evidence bundle against Visa CE3.0 compelling-evidence requirements, agentic-transaction pr",
    "consumes": [
      "art-01-ap2-mandate-chain-validator",
      "art-23-visa-trusted-agent-protocol-inspector",
      "art-24-mastercard-agentic-token-builder",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-298-aca-affordability-safe-harbor",
    "display_name": "ACA Affordability Safe-Harbor Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-298-aca-affordability-safe-harbor.html",
    "description": "Compute the ACA employer-mandate affordability percentage under each of the three IRC 4980H(a)(1)(B) safe harbors (W-2 wages, rate-of-pay, f",
    "consumes": [],
    "feeds": [
      "art-299-aca-esrp-exposure"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-299-aca-esrp-exposure",
    "display_name": "ACA Employer Shared Responsibility Payment Exposure Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-299-aca-esrp-exposure.html",
    "description": "Compute proposed IRC 4980H(a) (\"no offer to 95%\") and 4980H(b) (\"unaffordable / not minimum value\") Employer Shared Responsibility Payment e",
    "consumes": [
      "art-298-aca-affordability-safe-harbor"
    ],
    "feeds": [
      "art-300-aca-226j-response-evidence-pack"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-30-agent-commerce-conformance-validator",
    "display_name": "Agent Commerce Cross-Protocol Conformance Validator",
    "mandate_type": "payment_mandate",
    "url": "https://ainumbers.co/chaingraph/art-30-agent-commerce-conformance-validator.html",
    "description": "The synergy flagship. Validates a single agent purchase end-to-end across up to five protocols: AP2 v0.2 mandate chain (Intent → Cart → Paym",
    "consumes": [
      "art-01-ap2-mandate-chain-validator",
      "art-12-acp-checkout-conformance-validator",
      "art-03-x402-settlement-modeler"
    ],
    "feeds": [
      "cry-05-agent-action-audit-trail-aggregator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-300-aca-226j-response-evidence-pack",
    "display_name": "226J Response Evidence Pack Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-300-aca-226j-response-evidence-pack.html",
    "description": "Terminal node of the aca-226j-response-composer chain: assembles a replayable evidence pack responding to an IRS Letter 226J proposed Employ",
    "consumes": [
      "art-299-aca-esrp-exposure"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-301-section125-ndt",
    "display_name": "§125 Cafeteria Plan Nondiscrimination Tester",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-301-section125-ndt.html",
    "description": "Runs the §125 cafeteria-plan nondiscrimination tests from supplied aggregate participant counts: an eligibility-ratio test and a contributio",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-302-401k-adp-acp-test",
    "display_name": "401(k) ADP/ACP Nondiscrimination Tester",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-302-401k-adp-acp-test.html",
    "description": "Runs the IRC §401(k)(3) Actual Deferral Percentage test and the §401(m)(2) Actual Contribution Percentage test from supplied HCE vs NHCE def",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-303-aiuc1-control-evidence-linter",
    "display_name": "AIUC-1 Control Evidence Linter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-303-aiuc1-control-evidence-linter.html",
    "description": "Lints a supplied control-evidence bundle against the 23 automatable AIUC-1 v2026-Q1 controls (pillars A-F): version-guards the catalog, clas",
    "consumes": [],
    "feeds": [
      "art-304-aiuc1-evidence-pack-assembler"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-304-aiuc1-evidence-pack-assembler",
    "display_name": "AIUC-1 Evidence Pack Assembler",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-304-aiuc1-evidence-pack-assembler.html",
    "description": "Assembles a signed, AIUC-1 control-keyed evidence pack from execution receipts, escalation closures, and work mandates: binds each mapped co",
    "consumes": [
      "art-303-aiuc1-control-evidence-linter",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "feeds": [
      "art-305-aiuc1-evidence-freshness-lint"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-305-aiuc1-evidence-freshness-lint",
    "display_name": "AIUC-1 Evidence Freshness Lint",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-305-aiuc1-evidence-freshness-lint.html",
    "description": "Freshness lint keyed to the AIUC-1 quarterly re-test cadence: flags any control whose newest receipt is more than 90 days old and computes c",
    "consumes": [
      "art-304-aiuc1-evidence-pack-assembler"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-306-agent-insurability-evidence-scorer",
    "display_name": "Agent Insurability Evidence Scorer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-306-agent-insurability-evidence-scorer.html",
    "description": "Scores an agent execution evidence bundle for underwriter-facing evidence completeness across four dimensions (determinism, replayability, o",
    "consumes": [],
    "feeds": [
      "art-307-claim-dispute-bundle-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-307-claim-dispute-bundle-builder",
    "display_name": "Claim Dispute Bundle Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-307-claim-dispute-bundle-builder.html",
    "description": "Assembles a two-sided replay-challenge dossier for a disputed execution_claim: binds the claim digest and challenge to replay instructions a",
    "consumes": [
      "art-306-agent-insurability-evidence-scorer"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-308-pld-disclosure-pack-builder",
    "display_name": "PLD Disclosure Pack Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-308-pld-disclosure-pack-builder.html",
    "description": "Assembles a disclosure/rebuttal pack for a disputed window under EU Product Liability Directive 2024/2853 (transposes 2026-12-09; AI is a \"p",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-309-parametric-index-deriver",
    "display_name": "Parametric Index Deriver",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-309-parametric-index-deriver.html",
    "description": "Deterministically aggregates a named metric (mean, sum, count, max, or min) across a receipt set into a parametric index value: receipts as ",
    "consumes": [],
    "feeds": [
      "art-251-compute-parametric-trigger-payout"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-31-a2a-x402-extension-mandate-validator",
    "display_name": "A2A x402-Extension Mandate Validator",
    "mandate_type": "settlement_mandate",
    "url": "https://ainumbers.co/chaingraph/art-31-a2a-x402-extension-mandate-validator.html",
    "description": "Validates the A2A x402 extension (Coinbase/MetaMask/Ethereum Foundation) that carries crypto-payment authority inside an AP2 mandate: extens",
    "consumes": [
      "art-03-x402-settlement-modeler"
    ],
    "feeds": [
      "art-30-agent-commerce-conformance-validator",
      "cry-05-agent-action-audit-trail-aggregator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-313-traiga-exposure-assessor",
    "display_name": "TRAIGA Exposure Assessor",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-313-traiga-exposure-assessor.html",
    "description": "Assesses supplied Texas AI-deployment attributes and intentional-use assertions against the Texas Responsible AI Governance Act (TRAIGA, HB ",
    "consumes": [],
    "feeds": [
      "art-314-traiga-safe-harbor-pack-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-314-traiga-safe-harbor-pack-builder",
    "display_name": "TRAIGA Safe Harbor Pack Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-314-traiga-safe-harbor-pack-builder.html",
    "description": "Assembles a supplied NIST AI RMF function-mapping result (map_nist_ai_rmf_functions) and TRAIGA exposure-assessment result into an affirmati",
    "consumes": [
      "art-313-traiga-exposure-assessor",
      "art-174-nist-ai-rmf-function-mapper"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-315-ab2013-training-data-disclosure-linter",
    "display_name": "AB 2013 Training Data Disclosure Linter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-315-ab2013-training-data-disclosure-linter.html",
    "description": "Lints a supplied generative-AI training-data disclosure against the 12 datapoint categories required by California AB 2013 (Cal. Bus. & Prof",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-316-sb53-frontier-scope-checker",
    "display_name": "SB 53 Frontier Scope Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-316-sb53-frontier-scope-checker.html",
    "description": "Routes supplied model compute (FLOPs, as a decimal string above the 2^53 safe-integer range) and developer annual revenue through the Califo",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-317-rhc-multiplier-reconciler",
    "display_name": "ERC-8056 Multiplier Reconciler",
    "mandate_type": "collateral_mandate",
    "url": "https://ainumbers.co/chaingraph/art-317-rhc-multiplier-reconciler.html",
    "description": "Reconciles Robinhood Chain stock-token corporate actions against the ERC-8056 scaled UI amount surface. Stock tokens never rebase; splits an",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-318-rhc-regime-mapper",
    "display_name": "Financial-Instrument Regime Mapper",
    "mandate_type": "crypto_regulatory_mandate",
    "url": "https://ainumbers.co/chaingraph/art-318-rhc-regime-mapper.html",
    "description": "Maps the regulatory regime implied by a pasted Robinhood Chain stock-token characterization. The tokens are tokenized debt securities issued",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-319-rhc-valuation-linter",
    "display_name": "Valuation Double-Count / Decimal Linter",
    "mandate_type": "collateral_mandate",
    "url": "https://ainumbers.co/chaingraph/art-319-rhc-valuation-linter.html",
    "description": "Lints Robinhood Chain stock-token USD valuation expressions for the double-count bug: the Chainlink price feed already includes corporate ac",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-32-a2a-agent-card-trust-chain-validator",
    "display_name": "A2A Agent-Card Trust-Chain Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-32-a2a-agent-card-trust-chain-validator.html",
    "description": "The horizontal agent-to-agent trust complement. Validates an A2A v1.0 agent card (schema, signature, extension URIs) then assesses the deleg",
    "consumes": [],
    "feeds": [
      "art-04-agent-identity-attestation-checker",
      "art-02-agent-spend-policy-simulator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-320-rhc-collateral-haircut",
    "display_name": "Halt + Staleness Collateral Haircut",
    "mandate_type": "collateral_mandate",
    "url": "https://ainumbers.co/chaingraph/art-320-rhc-collateral-haircut.html",
    "description": "Layers a feed-staleness, sequencer-downtime, and underlying-halt haircut on top of a base repo haircut for Robinhood Chain stock tokens post",
    "consumes": [
      "505-tokenized-collateral-eligibility-checker",
      "508-repo-haircut-collateral-calculator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-321-rhc-bold-finality-classifier",
    "display_name": "BoLD Challenge-Window Finality Classifier",
    "mandate_type": "settlement_finality_mandate",
    "url": "https://ainumbers.co/chaingraph/art-321-rhc-bold-finality-classifier.html",
    "description": "Classifies a settlement-finality claim on Robinhood Chain, an Arbitrum Orbit dedicated blockchain using BoLD interactive fraud proofs, into ",
    "consumes": [
      "art-59-settlement-asset-finality-classifier"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-322-rhc-ap-redemption-stress",
    "display_name": "AP Concentration + Redemption-Path Stress",
    "mandate_type": "collateral_mandate",
    "url": "https://ainumbers.co/chaingraph/art-322-rhc-ap-redemption-stress.html",
    "description": "Stress-tests the one-token-equals-one-share economic-exposure claim for Robinhood Chain stock tokens against actual redemption reachability.",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-323-rhc-fit-diagnostic",
    "display_name": "Robinhood Chain Fit Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-323-rhc-fit-diagnostic.html",
    "description": "12-question A-F diagnostic grading a firm's Robinhood Chain adoption fit across four paths: stock-token application, collateral/lending venu",
    "consumes": [],
    "feeds": [
      "art-317-rhc-multiplier-reconciler",
      "art-318-rhc-regime-mapper",
      "art-319-rhc-valuation-linter",
      "art-320-rhc-collateral-haircut",
      "art-321-rhc-bold-finality-classifier",
      "art-322-rhc-ap-redemption-stress"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-324-tvm-npv",
    "display_name": "Net Present Value (NPV)",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-324-tvm-npv.html",
    "description": "Net present value of a cash flow series, discounted at a declared periodic rate. Accepts either caller-supplied period offsets or dated cash",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-325-tvm-irr",
    "display_name": "Internal Rate of Return (IRR)",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-325-tvm-irr.html",
    "description": "Internal rate of return for an equal-period cash flow series, solved by deterministic bisection over a declared rate bracket with declared t",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-326-tvm-xirr",
    "display_name": "XIRR (Irregular Dated Cash Flows)",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-326-tvm-xirr.html",
    "description": "Annualized rate of return for irregular-interval dated cash flows, matching Excel XIRR semantics exactly: fixed actual/365 day count, anchor",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-327-tvm-annuity",
    "display_name": "Annuity PV / FV / Payment Solver",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-327-tvm-annuity.html",
    "description": "Solves present value, future value, or payment for an ordinary annuity or annuity-due, given the other two plus rate and number of periods, ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-328-tvm-breakeven",
    "display_name": "Breakeven / CVP Analysis",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-328-tvm-breakeven.html",
    "description": "Standard cost-volume-profit breakeven analysis: breakeven units and revenue from fixed costs, price per unit, and variable cost per unit, pl",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-329-tvm-bond-duration",
    "display_name": "Bond Macaulay / Modified Duration",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-329-tvm-bond-duration.html",
    "description": "Macaulay and modified duration for a standard even-period bullet bond, given face value, coupon rate, yield to maturity, years to maturity, ",
    "consumes": [],
    "feeds": [
      "art-330-tvm-dv01",
      "art-331-tvm-convexity"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-33-mcp-server-self-attestation-pack",
    "display_name": "MCP Server Self-Attestation Pack",
    "mandate_type": "infrastructure_mandate",
    "url": "https://ainumbers.co/chaingraph/art-33-mcp-server-self-attestation-pack.html",
    "description": "Combines the five MCP-dev checks: tool-definition lint (JSON Schema 2020-12), server.json validation (2025-12-11 schema), OAuth 2.1 audit (R",
    "consumes": [],
    "feeds": [
      "cry-05-agent-action-audit-trail-aggregator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-330-tvm-dv01",
    "display_name": "Bond DV01 (Price Value of a Basis Point)",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-330-tvm-dv01.html",
    "description": "DV01 / price value of a basis point for a standard even-period bullet bond, computed by full central-difference reprice at yield plus and mi",
    "consumes": [
      "art-329-tvm-bond-duration"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-331-tvm-convexity",
    "display_name": "Bond Convexity",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-331-tvm-convexity.html",
    "description": "Standard closed-form convexity for a bullet bond, annualized by compounding frequency squared. Second-order complement to modified duration ",
    "consumes": [
      "art-329-tvm-bond-duration"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-332-build-amortization-schedule",
    "display_name": "Amortization Schedule Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-332-build-amortization-schedule.html",
    "description": "Deterministic amortization schedule builder covering level-payment, ARM (index plus margin, periodic and lifetime caps, recast), interest-on",
    "consumes": [],
    "feeds": [
      "art-215-reg-z-appendix-j-apr"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-335-compute-dti-ratios",
    "display_name": "DTI Ratio Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-335-compute-dti-ratios.html",
    "description": "Front-end (housing) and back-end (total) debt-to-income ratios per Fannie Mae Selling Guide B3-6-02 and Freddie Mac Single-Family Seller/Ser",
    "consumes": [],
    "feeds": [
      "art-222-agency-eligibility-matrix"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-336-compute-ltv-ratios",
    "display_name": "LTV/CLTV/HCLTV Ratio Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-336-compute-ltv-ratios.html",
    "description": "Loan-to-value, combined LTV, and home-equity combined LTV per Fannie Mae Selling Guide B2-1.1-03 and Freddie Mac Single-Family Seller/Servic",
    "consumes": [],
    "feeds": [
      "art-222-agency-eligibility-matrix"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-338-compute-federal-withholding",
    "display_name": "Federal Withholding Calculator (Percentage Method)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-338-compute-federal-withholding.html",
    "description": "Federal income tax withholding via the IRS Publication 15-T (2025) percentage method, Worksheet 1A, for a 2020-or-later Form W-4. Supports s",
    "consumes": [],
    "feeds": [
      "art-339-compute-gross-to-net"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-339-compute-gross-to-net",
    "display_name": "Gross-to-Net Payroll Calculator (FICA)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-339-compute-gross-to-net.html",
    "description": "Gross-to-net payroll calculation: FICA (Social Security 6.2% up to the 2025 $176,100 wage base, Medicare 1.45% uncapped, Additional Medicare",
    "consumes": [
      "art-338-compute-federal-withholding"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-34-tempo-fit-diagnostic",
    "display_name": "Tempo Fit Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-34-tempo-fit-diagnostic.html",
    "description": "12-question A–F diagnostic grading an organisation's Tempo adoption fit across four dimensions: Issue (TIP-20/GENIUS PPSI), Payments (cost w",
    "consumes": [],
    "feeds": [
      "art-35-tempo-payments-business-case",
      "art-36-tempo-mpp-agent-mandate",
      "art-37-tempo-stablecoin-issuance",
      "art-40-tempo-agentic-checkout"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-340-compute-flsa-regular-rate",
    "display_name": "FLSA Regular Rate & Overtime Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-340-compute-flsa-regular-rate.html",
    "description": "FLSA regular rate of pay and overtime premium per 29 CFR 778, Subpart C, including nondiscretionary-bonus reallocation into the regular rate",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-342-compute-escrow-analysis",
    "display_name": "RESPA Aggregate Escrow Analysis",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-342-compute-escrow-analysis.html",
    "description": "12 CFR 1024.17 (Reg X) aggregate escrow accounting method: builds a 12-month trial running balance from a starting balance, a monthly escrow",
    "consumes": [
      "art-235-test-hpml-escrow"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-344-compute-mlr-rebate",
    "display_name": "MLR Rebate Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-344-compute-mlr-rebate.html",
    "description": "Medical Loss Ratio numerator/denominator, credibility-adjustment tier, 3-year premium-weighted averaging, and rebate math per 45 CFR 158 (AC",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-346-compute-experience-mod",
    "display_name": "NCCI Experience Modification Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-346-compute-experience-mod.html",
    "description": "Workers'-compensation experience rating modification (NCCI Experience Rating Plan Manual published national formula): per-claim primary/exce",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-348-score-credit-model-quantized",
    "display_name": "Quantized Credit Model Scorer",
    "mandate_type": "credit_assessment",
    "url": "https://ainumbers.co/chaingraph/art-348-score-credit-model-quantized.html",
    "description": "Runs a fixed, int8-quantized logistic-regression-class credit-decisioning model as a pure integer inference kernel and returns the score it ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-349-fedwire-structured-address-linter",
    "display_name": "Fedwire Structured Address Linter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-349-fedwire-structured-address-linter.html",
    "description": "Lints a Fedwire or CHIPS ISO 20022 PostalAddress24 block against the November 2026 structured-address mandate (network param selects fedwire",
    "consumes": [],
    "feeds": [
      "art-350-fedwire-address-sweep"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-35-tempo-payments-business-case",
    "display_name": "Tempo Payments Business Case",
    "mandate_type": "treasury_mandate",
    "url": "https://ainumbers.co/chaingraph/art-35-tempo-payments-business-case.html",
    "description": "CFO-level cost-and-savings model for migrating a payment flow (payroll / remittance / merchant settlement) from card/SWIFT/ACH/SEPA to Tempo",
    "consumes": [
      "art-34-tempo-fit-diagnostic"
    ],
    "feeds": [
      "art-37-tempo-stablecoin-issuance",
      "art-36-tempo-mpp-agent-mandate"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-350-fedwire-address-sweep",
    "display_name": "Fedwire Payment-File Address Sweep",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-350-fedwire-address-sweep.html",
    "description": "Batch-sweeps a Fedwire or CHIPS payment file (CSV, one record per row) through the November 2026 structured-address mandate lint (lint_fedwi",
    "consumes": [
      "art-349-fedwire-structured-address-linter"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-352-etr-control-evidence-checker",
    "display_name": "ETR Singularity & Exclusive-Control Evidence Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-352-etr-control-evidence-checker.html",
    "description": "Checks a supplied electronic transferable record (ETR/eBL) document digest and control-assertion set (platform identity, singularity asserti",
    "consumes": [],
    "feeds": [
      "art-55-trade-document-provenance-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-353-etr-possession-chain-builder",
    "display_name": "ETR Possession-Chain Receipt Builder",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/art-353-etr-possession-chain-builder.html",
    "description": "Builds a hash-chained possession-receipt evidence pack for an electronic transferable record (ETR) under UNCITRAL MLETR Art. 10/11: given th",
    "consumes": [
      "art-352-etr-control-evidence-checker"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-354-mletr-jurisdiction-adoption-lookup",
    "display_name": "MLETR Jurisdiction-Adoption Lookup",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-354-mletr-jurisdiction-adoption-lookup.html",
    "description": "Static citation-table lookup of UNCITRAL MLETR (Model Law on Electronic Transferable Records) adoption status per jurisdiction -- statute, s",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-355-erba-standardized-rwa-calculator",
    "display_name": "ERBA / Standardized RWA Calculator (Basel Endgame 2026)",
    "mandate_type": "capital_assessment",
    "url": "https://ainumbers.co/chaingraph/art-355-erba-standardized-rwa-calculator.html",
    "description": "Credit-risk expanded risk-based approach (ERBA) / standardized-approach RWA calculator per the 2026 Basel Endgame reproposal (BCBS/US NPR, r",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-356-compute-oprisk-sma-2026",
    "display_name": "Basel Operational Risk SMA (2026 Reproposal)",
    "mandate_type": "capital_assessment",
    "url": "https://ainumbers.co/chaingraph/art-356-compute-oprisk-sma-2026.html",
    "description": "Basel Standardized Measurement Approach (SMA) for operational-risk capital per the July 2026 US Basel Endgame reproposal (comment period clo",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-357-basel-2023-vs-2026-capital-delta-comparator",
    "display_name": "Basel 2023-vs-2026 Capital-Delta Comparator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-357-basel-2023-vs-2026-capital-delta-comparator.html",
    "description": "Runs the same portfolio through the 2023 Basel III Endgame NPR risk-weight framework and the 2026 reproposal (2026-03-19, three NPRs) framew",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-358-simulate-output-floor",
    "display_name": "Basel Output-Floor Phase-In Simulator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-358-simulate-output-floor.html",
    "description": "Basel III finalization / 2026 reproposal output-floor simulator: applies the published floor mechanic (applied RWA = max(internal-model RWA,",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-359-idv-session-receipt-builder",
    "display_name": "IDV/KYC Session Evidence Receipt Builder",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-359-idv-session-receipt-builder.html",
    "description": "Hash-chains an identity-verification (IDV/KYC) session's declared results into a tamper-evident session receipt, per attempt: session metada",
    "consumes": [],
    "feeds": [
      "art-418-idv-verification-failure-incident-composer"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-36-tempo-mpp-agent-mandate",
    "display_name": "Tempo MPP Agent Mandate",
    "mandate_type": "payment_mandate",
    "url": "https://ainumbers.co/chaingraph/art-36-tempo-mpp-agent-mandate.html",
    "description": "Parses an MPP (Machine Payments Protocol) session, validates spend cap and session terms, maps HTTP-402 flow to AP2 Intent→Cart→Payment, per",
    "consumes": [
      "art-34-tempo-fit-diagnostic"
    ],
    "feeds": [
      "art-01-ap2-mandate-chain-validator",
      "art-02-agent-spend-policy-simulator",
      "art-04-agent-identity-attestation-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-361-camera-provenance-check",
    "display_name": "Camera-Provenance Check",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-361-camera-provenance-check.html",
    "description": "Structural check on an IDV/KYC capture's C2PA manifest: claim well-formedness, hard-binding hash assertion, and claim-signature reference (a",
    "consumes": [],
    "feeds": [
      "art-359-idv-session-receipt-builder"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-362-compute-raroc-loan-price",
    "display_name": "RAROC Loan Pricing Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-362-compute-raroc-loan-price.html",
    "description": "Risk-Adjusted Return on Capital (RAROC) loan pricing per Basel II BCBS 128 (2006) / Basel III BCBS 189 (2010) simplified public approximatio",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-363-compute-dscr",
    "display_name": "DSCR & Interest Coverage Ratio Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-363-compute-dscr.html",
    "description": "Debt Service Coverage Ratio and Interest Coverage Ratio suite: Basic/Cash/FCF DSCR, Fixed Charge Coverage Ratio (FCCR), EBIT- and EBITDA-bas",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-364-compute-lcr-nsfr-leverage",
    "display_name": "LCR / NSFR / Leverage Ratio Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-364-compute-lcr-nsfr-leverage.html",
    "description": "Basel III Liquidity Coverage Ratio (BCBS 238), Net Stable Funding Ratio (BCBS 295), and Leverage Ratio (BCBS 270, finalized BCBS 360) point-",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-365-compute-globe-topup-tax",
    "display_name": "GloBE Top-Up Tax & QDMTT Allocation Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-365-compute-globe-topup-tax.html",
    "description": "OECD Pillar Two GloBE top-up tax calculator: per-jurisdiction substance-based income exclusion (SBIE), effective tax rate (ETR), and top-up-",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-366-price-embedded-insurance",
    "display_name": "Embedded Insurance Pricing Modeller",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-366-price-embedded-insurance.html",
    "description": "Embedded-insurance unit economics for a platform attaching per-transaction coverage: per-transaction premium, monthly/annual gross written p",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-367-compute-cross-border-fees",
    "display_name": "Cross-Border B2B Fee Calculator",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-367-compute-cross-border-fees.html",
    "description": "Itemizes a single cross-border B2B invoice's total cost stack: FX spread cost, payment-method/correspondent fee, VAT or reverse-charge cost,",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-368-compute-fx-netting-positions",
    "display_name": "Multilateral FX Netting Calculator",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-368-compute-fx-netting-positions.html",
    "description": "Multilateral FX netting across up to 8 currencies: nets each currency's payable/receivable exposures in FCY, converts to USD at a caller-sup",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-369-run-rate-shock-ladder",
    "display_name": "Rate Shock Ladder Replay",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-369-run-rate-shock-ladder.html",
    "description": "US OCC/FDIC interest-rate-risk parallel shock ladder: sweeps four prescribed parallel magnitudes (+/-100/200/300/400bp) over a bucketed repr",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-37-tempo-stablecoin-issuance",
    "display_name": "Tempo Stablecoin Issuance Compliance",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-37-tempo-stablecoin-issuance.html",
    "description": "Dual-jurisdiction TIP-20 token compliance validator. Tab 1: TIP-20 Config Lint: currency code, supply cap, RBAC (ISSUER/PAUSE/BURN_BLOCKED),",
    "consumes": [
      "art-34-tempo-fit-diagnostic"
    ],
    "feeds": [
      "art-06-genius-act-reserve-attestation",
      "art-10-amla-transaction-typology-risk-scorer",
      "art-38-tempo-onchain-aml"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-370-supervisory-scenario-replay",
    "display_name": "Supervisory Scenario Replay (DFAST-lite)",
    "mandate_type": "capital_assessment",
    "url": "https://ainumbers.co/chaingraph/art-370-supervisory-scenario-replay.html",
    "description": "Replays the Fed's published 2026 28-variable supervisory scenario paths (baseline and severely adverse, Q1:2026-Q1:2029) against user-suppli",
    "consumes": [],
    "feeds": [
      "sim-01-lcr-nsfr-liquidity-stress-test",
      "sim-03-basel-rwa-scenario-modeler"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-371-simulate-var-monte-carlo",
    "display_name": "Portfolio VaR — Monte Carlo (Integer PRNG)",
    "mandate_type": "risk_control",
    "url": "https://ainumbers.co/chaingraph/art-371-simulate-var-monte-carlo.html",
    "description": "Monte Carlo portfolio Value-at-Risk and Expected Shortfall over a one-factor correlated-asset model. Integer-only xoshiro256** PRNG and fixe",
    "consumes": [],
    "feeds": [
      "qfa-02-portfolio-var-engine",
      "qfa-03-stress-test-engine"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-373-recompute-fund-nav",
    "display_name": "Recompute Fund NAV",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-373-recompute-fund-nav.html",
    "description": "Recomputes a fund's net-asset-value-per-share from SUPPLIED holdings (quantity x supplied price, multi-currency with supplied FX), accruals ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-374-test-nav-error-materiality",
    "display_name": "Test NAV-Error Materiality",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-374-test-nav-error-materiality.html",
    "description": "Compares an erroneous NAV-per-share against a corrected NAV-per-share against a DECLARED materiality policy (the industry half-cent absolute",
    "consumes": [
      "art-373-recompute-fund-nav"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-375-compute-fund-expense-ratios",
    "display_name": "Compute Fund Expense Ratios",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-375-compute-fund-expense-ratios.html",
    "description": "Computes a fund's gross and net expense ratios and Total Expense Ratio (TER) from SUPPLIED gross expense components (flat amounts or accrual",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-376-score-payee-name-match",
    "display_name": "Payee Name-Match Score (VoP/CoP)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-376-score-payee-name-match.html",
    "description": "Deterministic, versioned single-pair payee name-matching score for Verification-of-Payee / Confirmation-of-Payee evidence. Normalizes (diacr",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-377-build-vop-session-receipt",
    "display_name": "VoP Session Receipt Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-377-build-vop-session-receipt.html",
    "description": "Builds a signed, hash-chained Verification-of-Payee / Confirmation-of-Payee session receipt: binds the declared match result (score, band, a",
    "consumes": [
      "art-376-score-payee-name-match"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-378-quarterly-test-evidence-composer",
    "display_name": "Quarterly Agent Test Evidence Composer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-378-quarterly-test-evidence-composer.html",
    "description": "Composes a quarterly agent testing-evidence pack: test-suite identity and digest, per-test receipts with an honest deterministic/estimated d",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-379-agent-incident-record-composer",
    "display_name": "Agent Incident Record Composer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-379-agent-incident-record-composer.html",
    "description": "Composes a structured agent incident/failure record from caller-declared inputs: agent identity, an optional mandate hash, an incident descr",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-38-tempo-onchain-aml",
    "display_name": "Tempo On-Chain AML & Travel Rule Screener",
    "mandate_type": "aml_rule",
    "url": "https://ainumbers.co/chaingraph/art-38-tempo-onchain-aml.html",
    "description": "Parses a batch of synthetic TIP-20 transfers (with memos), runs OFAC/SDN hit screening, checks FATF Travel Rule field completeness (originat",
    "consumes": [
      "art-37-tempo-stablecoin-issuance"
    ],
    "feeds": [
      "art-39-tempo-zone-disclosure",
      "art-10-amla-transaction-typology-risk-scorer"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-380-build-ai-workpaper-record",
    "display_name": "AI-Tool-Usage Workpaper Record",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-380-build-ai-workpaper-record.html",
    "description": "Composes a documentation-element workpaper record from an existing OCG receipt (tool identity, execution hash, kernel digest), a declared de",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-385-agent-token-scope-checker",
    "display_name": "Agent Token Scope Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-385-agent-token-scope-checker.html",
    "description": "Compares a requested agent action (amount, currency, merchant category, timestamp) against an agent token or mandate's declared scope: spend",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-386-lint-cbom-structure",
    "display_name": "CBOM Structural Lint & CNSA-2.0 Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-386-lint-cbom-structure.html",
    "description": "Validates a pasted CycloneDX 1.6 Cryptography Bill of Materials against a hand-derived field subset (algorithm, key size, certification leve",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-387-pqc-deadline-ladder-calculator",
    "display_name": "CNSA 2.0 Deadline Ladder Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-387-pqc-deadline-ladder-calculator.html",
    "description": "Per-row CNSA 2.0 post-quantum migration deadline for a supplied system inventory (system class, asset type, deployment date): applicable dea",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-388-tempo-fee-amm-converter",
    "display_name": "Tempo Fee-AMM Conversion Calculator",
    "mandate_type": "treasury_mandate",
    "url": "https://ainumbers.co/chaingraph/art-388-tempo-fee-amm-converter.html",
    "description": "Converts a supplied fee-token amount to the validator's token through Tempo's enshrined protocol Fee AMM (Tempo has no native gas token): va",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-389-tempo-mainnet-fee-capacity",
    "display_name": "TIP-1010 Mainnet Fee & Payment-Lane Capacity Calculator",
    "mandate_type": "treasury_mandate",
    "url": "https://ainumbers.co/chaingraph/art-389-tempo-mainnet-fee-capacity.html",
    "description": "Per-tx fee (fee_microusd = ceil(base_fee_attodollars_per_gas x gas_used / 1e12)) and payment-lane TPS headroom for a supplied payment mix, a",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-39-tempo-zone-disclosure",
    "display_name": "Tempo Zone Selective-Disclosure Attestation",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-39-tempo-zone-disclosure.html",
    "description": "Maps a Tempo Zone's party-visibility model (operator-sees-all / users-see-own / outsiders-see-ZK-proofs) against AML/audit/regulator disclos",
    "consumes": [
      "art-38-tempo-onchain-aml"
    ],
    "feeds": [
      "cry-01-zk-compliance-proof-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-390-tip20-memo-commitment-validator",
    "display_name": "TIP-20 Memo/Commitment Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-390-tip20-memo-commitment-validator.html",
    "description": "Validates a TIP-20 TransferWithMemo's 32-byte memo as a hash-or-locator commitment: checks length/hex form, recomputes the SHA-256 commitmen",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-391-compute-canton-traffic-cost",
    "display_name": "Canton Synchronizer Traffic-Cost Calculator",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-391-compute-canton-traffic-cost.html",
    "description": "Computes Canton Network synchronizer traffic cost (CIP-0042/CIP-0084 regime): fee = message megabytes x the Tokenomics-Committee-set USD/MB ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-392-compute-canton-app-reward-estimate",
    "display_name": "Canton App-Reward Estimator (CIP-0104)",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-392-compute-canton-app-reward-estimate.html",
    "description": "Estimates a Canton Network app provider's Canton Coin reward for one round under CIP-0104 (approved 2026-02-12): app rewards are proportiona",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-393-x402-v2-migration-linter",
    "display_name": "x402 v2 Wire-Format Migration Linter",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-393-x402-v2-migration-linter.html",
    "description": "Lints a supplied x402 header set / 402 response body against the Protocol Version 2 wire format: flags deprecated v1 headers (X-PAYMENT, X-P",
    "consumes": [
      "art-26-x402-payload-decoder-flow-simulator"
    ],
    "feeds": [
      "art-61-x402-batch-settlement-reconciler",
      "art-394-x402-deferred-handshake-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-394-x402-deferred-handshake-validator",
    "display_name": "x402 Deferred-Scheme Handshake Validator",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-394-x402-deferred-handshake-validator.html",
    "description": "Validates a Cloudflare `deferred` x402 scheme handshake: 402 offer field shape (scheme:\"deferred\", id, termsUrl), RFC 9421 HTTP Message Sign",
    "consumes": [
      "art-393-x402-v2-migration-linter",
      "art-129-webbotauth-signature-verifier"
    ],
    "feeds": [
      "art-61-x402-batch-settlement-reconciler"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-396-compute-15c3-3-reserve",
    "display_name": "15c3-3 Customer Reserve Formula Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-396-compute-15c3-3-reserve.html",
    "description": "SEC Rule 15c3-3 Exhibit A customer reserve formula: credit items (customer free credit balances, margin credit balances, payables) against a",
    "consumes": [],
    "feeds": [
      "art-397-lint-trace-cat-reports"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-397-lint-trace-cat-reports",
    "display_name": "TRACE / CAT Reporting Lint",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-397-lint-trace-cat-reports.html",
    "description": "TRACE (FINRA Rule 6730) trade-report timeliness lint against a caller-declared trading calendar and hours window, computing the reporting de",
    "consumes": [
      "art-396-compute-15c3-3-reserve"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-398-lint-metro2-record",
    "display_name": "Metro 2 Credit-Reporting Record Lint",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-398-lint-metro2-record.html",
    "description": "Lints a Metro 2 credit-reporting base-segment record from a PUBLIC SUBSET of the format: field presence/format, account-status and payment-r",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-399-lint-x12-claim-records",
    "display_name": "X12 837/835 Healthcare-Claim Records Lint",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-399-lint-x12-claim-records.html",
    "description": "Lints X12 837 (health-care claim) and 835 (claim payment/remittance advice) ENVELOPE control-number continuity (ISA13/IEA02, GS06/GE02, ST02",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-40-tempo-agentic-checkout",
    "display_name": "Tempo Agentic Checkout Settlement Mapper",
    "mandate_type": "settlement_mandate",
    "url": "https://ainumbers.co/chaingraph/art-40-tempo-agentic-checkout.html",
    "description": "Binds an ACP / Visa TAP / ISO 20022 checkout to a TIP-20 settlement. Maps the 32-byte Tempo memo → ISO 20022 remittance_information, sender/",
    "consumes": [
      "art-34-tempo-fit-diagnostic",
      "art-36-tempo-mpp-agent-mandate"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-400-check-official-statement-completeness",
    "display_name": "Municipal Official Statement Completeness Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-400-check-official-statement-completeness.html",
    "description": "Checks a municipal-bond Official Statement disclosure-element checklist (element present, absent, or incomplete) and continuing-disclosure u",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-401-validate-form5500-schedules",
    "display_name": "ERISA Form 5500 Schedule Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-401-validate-form5500-schedules.html",
    "description": "Validates a Form 5500 schedule-applicability matrix (plan type and size determine required schedules H/I/A/C/G/MB/SB/R), a Schedule H cross-",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-402-validate-regf-call-frequency",
    "display_name": "Reg F Call-Frequency Presumption Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-402-validate-regf-call-frequency.html",
    "description": "Checks a declared debt-collection call log against the two 12 CFR 1006.14(b) Regulation F rebuttable presumptions: more than seven telephone",
    "consumes": [],
    "feeds": [
      "art-403-check-debt-validation-notice"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-403-check-debt-validation-notice",
    "display_name": "Debt Validation Notice Completeness Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-403-check-debt-validation-notice.html",
    "description": "Checks a debt-validation-notice content-element checklist against Regulation F 12 CFR 1006.34 (the Model Form B-1 element set) and computes ",
    "consumes": [
      "art-402-validate-regf-call-frequency"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-404-check-retail-installment-disclosures",
    "display_name": "Retail Installment Contract TILA Disclosure Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-404-check-retail-installment-disclosures.html",
    "description": "Ties declared retail-installment-contract Amount Financed, Finance Charge, and Total of Payments (12 CFR 1026.18) against a REUSED amortizat",
    "consumes": [
      "art-332-build-amortization-schedule",
      "art-324-tvm-npv"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-405-check-private-student-loan-disclosures",
    "display_name": "Private Student Loan Disclosure & Rescission Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-405-check-private-student-loan-disclosures.html",
    "description": "Checks a private-education-loan disclosure-element checklist across the three 12 CFR 1026.46-48 stages (application/solicitation, approval, ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-406-cross-venue-margin-estimator",
    "display_name": "Crypto Cross-Venue Margin & Off-Exchange Settlement Estimator",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-406-cross-venue-margin-estimator.html",
    "description": "Estimates the crypto off-exchange settlement / cross-venue margin picture for a book spread across trading venues (the Copper ClearLoop / Fa",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-407-umr-aana-readiness-diagnostic",
    "display_name": "UMR / AANA Readiness Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-407-umr-aana-readiness-diagnostic.html",
    "description": "Determines whether a group's declared AANA (average aggregate notional amount) puts it in scope for the uncleared margin rules (UMR), per AT",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-408-evidence-bundle-tier-labeler",
    "display_name": "Evidence Bundle Tier Labeler",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-408-evidence-bundle-tier-labeler.html",
    "description": "Assembles a shareable evidence bundle around an artifact and stamps the SPEC.md §SIDECAR.1 tiered label it qualifies for: OCG-Verify (envelo",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-409-dpa-art28-completeness-checker",
    "display_name": "DPA Article 28 Completeness Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-409-dpa-art28-completeness-checker.html",
    "description": "Checks a data processing agreement against GDPR Article 28(3)'s 12 mandatory processor clauses -- subject-matter, duration, nature/purpose, ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-41-tempo-validator-readiness",
    "display_name": "Tempo Validator Readiness Scorer",
    "mandate_type": "infrastructure_mandate",
    "url": "https://ainumbers.co/chaingraph/art-41-tempo-validator-readiness.html",
    "description": "12-question readiness scorer for prospective Tempo Network validators across 5 dimensions: hardware (CPU/RAM/NVMe), OS/software (Linux x86_6",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-410-clause-coverage-scorer",
    "display_name": "Clause Coverage Scorer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-410-clause-coverage-scorer.html",
    "description": "Scores an agreement's clause coverage against a named clause taxonomy -- the oneSaaS 52-clause canonical set, the Common Paper Language Libr",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-411-ai-addendum-assembler",
    "display_name": "AI Addendum Assembler",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-411-ai-addendum-assembler.html",
    "description": "Assembles a Common Paper AI Addendum (Version 1.0, CC BY 4.0) from your Cover Page Key Terms: whether Provider may Train Models on Customer ",
    "consumes": [
      "art-412-ai-act-procurement-clause-mapper"
    ],
    "feeds": [
      "art-409-dpa-art28-completeness-checker"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-412-ai-act-procurement-clause-mapper",
    "display_name": "AI Act Procurement Clause Mapper",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-412-ai-act-procurement-clause-mapper.html",
    "description": "Maps an EU AI Act risk tier (derived from an upstream classifier such as the AI Act high-risk fit diagnostic) to the European Commission's M",
    "consumes": [
      "art-64-ai-act-highrisk-fit-diagnostic"
    ],
    "feeds": [
      "art-411-ai-addendum-assembler"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-413-screen-sanctions-private",
    "display_name": "Private-Input Sanctions Screen",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-413-screen-sanctions-private.html",
    "description": "Screens a privately held party/transfer list against a pinned OFAC-SDN-style list version and emits a public verdict (screened, hit count, c",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-414-compute-rbc-action-level-private",
    "display_name": "Private-Input NAIC RBC Action Level",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-414-compute-rbc-action-level-private.html",
    "description": "Computes the NAIC Risk-Based Capital action-level tier from a privately held Total Adjusted Capital and Authorized Control Level RBC, emitti",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-415-check-capital-adequacy-private",
    "display_name": "Private-Input Capital Adequacy Check",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-415-check-capital-adequacy-private.html",
    "description": "Checks a privately held eligible-capital and risk-weighted-assets figure against a pinned regulatory minimum (Basel III/3.1 CET1, or Solvenc",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-418-idv-verification-failure-incident-composer",
    "display_name": "IDV/KYC Verification-Failure Incident Composer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-418-idv-verification-failure-incident-composer.html",
    "description": "Composes a structured verification-failure/fraud-attempt incident record from an IDV/KYC session for fraud teams, regulators, and insurers: ",
    "consumes": [
      "art-359-idv-session-receipt-builder"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-42-arc-fit-diagnostic",
    "display_name": "Arc Fit Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-42-arc-fit-diagnostic.html",
    "description": "12-question A–F diagnostic assessing Arc adoption fit across CPN (Circle Payments Network), StableFX 24/7 FX, DvP atomic settlement, and age",
    "consumes": [],
    "feeds": [
      "art-43-arc-cpn-model",
      "art-44-arc-stablefx-model",
      "art-45-arc-xreserve-linter",
      "art-46-arc-paymaster-model",
      "art-47-arc-cctp-transfer"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-424-witness-cosignature-verifier",
    "display_name": "Witness Cosignature Verifier",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/art-424-witness-cosignature-verifier.html",
    "description": "Verifies a C2SP tlog-checkpoint + witness-cosignature note (SPEC.md §20.2) offline: confirms the note's origin and root match a §20/§20.1 ba",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-425-large-exposures-limit-check",
    "display_name": "Large Exposures Limit Check",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-425-large-exposures-limit-check.html",
    "description": "Basel III large exposures framework (BCBS 283) and U.S. single-counterparty credit limits (Regulation YY, 12 CFR 252 Subpart H) limit check:",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-426-cecl-ecl-calculator",
    "display_name": "CECL Expected Credit Loss & Allowance Calculator",
    "mandate_type": "credit_assessment",
    "url": "https://ainumbers.co/chaingraph/art-426-cecl-ecl-calculator.html",
    "description": "Computes a deterministic CECL (Current Expected Credit Loss, ASC 326) allowance given caller-supplied PD/LGD/EAD curves, segment exposures, ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-427-discount-window-capacity",
    "display_name": "Discount Window Borrowing-Capacity Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-427-discount-window-capacity.html",
    "description": "Federal Reserve Discount Window borrowing-capacity calculator: lendable value = sum of pledged collateral positions x published Fed collater",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-428-cyber-incident-clock",
    "display_name": "Cyber Incident Notification Clock",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-428-cyber-incident-clock.html",
    "description": "Starts three parallel regulatory notification-deadline clocks from one hash-anchored cyber-incident determination timestamp: the 36-hour int",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-429-var-backtest-traffic-light",
    "display_name": "VaR Backtesting Traffic-Light Zone Calculator",
    "mandate_type": "capital_assessment",
    "url": "https://ainumbers.co/chaingraph/art-429-var-backtest-traffic-light.html",
    "description": "Counts Basel VaR backtesting exceptions (actual daily P&L loss exceeding the model's 1-day VaR estimate) over a rolling up-to-250-trading-da",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-43-arc-cpn-model",
    "display_name": "Arc CPN Corridor Economics Model",
    "mandate_type": "treasury_mandate",
    "url": "https://ainumbers.co/chaingraph/art-43-arc-cpn-model.html",
    "description": "Model CPN corridor economics vs SWIFT/ACH/SEPA/card/RTP for cross-border USD flows. Quantifies per-payment cost, FX spread, settlement time,",
    "consumes": [
      "art-42-arc-fit-diagnostic"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-431-fdic-assessment-rate-calculator",
    "display_name": "FDIC Deposit-Insurance Assessment Rate Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-431-fdic-assessment-rate-calculator.html",
    "description": "FDIC deposit-insurance assessment rate calculator (12 CFR 327): looks up the base assessment rate for a supplied composite CAMELS + financia",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-432-call-report-rc-balance-sheet",
    "display_name": "Call Report Schedule RC (Balance Sheet) Mapper",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-432-call-report-rc-balance-sheet.html",
    "description": "Maps caller-declared FFIEC Call Report (FFIEC 031) Schedule RC line items -- cash, securities, loans and leases, other assets; deposits, bor",
    "consumes": [],
    "feeds": [
      "art-434-call-report-edit-check-gate"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-433-call-report-rcr-capital",
    "display_name": "Call Report Schedule RC-R (Regulatory Capital) Mapper",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-433-call-report-rcr-capital.html",
    "description": "Maps caller-declared FFIEC Call Report (FFIEC 031) Schedule RC-R regulatory-capital components -- CET1, additional Tier 1, Tier 2 capital, t",
    "consumes": [],
    "feeds": [
      "art-434-call-report-edit-check-gate"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-434-call-report-edit-check-gate",
    "display_name": "Call Report Published Edit-Check Gate",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-434-call-report-edit-check-gate.html",
    "description": "Runs a curated battery of FFIEC-style published Call Report edit checks -- balance-sheet identity, capital-stack ordering (CET1 <= Tier 1 <=",
    "consumes": [
      "art-432-call-report-rc-balance-sheet",
      "art-433-call-report-rcr-capital"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-435-bhc-schedule-hc-balance-sheet",
    "display_name": "FR Y-9C Schedule HC (Consolidated Balance Sheet) Mapper",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-435-bhc-schedule-hc-balance-sheet.html",
    "description": "Maps caller-declared FR Y-9C (Financial Statements for Holding Companies) Schedule HC line items -- cash, securities, loans and leases, othe",
    "consumes": [],
    "feeds": [
      "art-436-bhc-schedule-hcr-capital"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-436-bhc-schedule-hcr-capital",
    "display_name": "FR Y-9C Schedule HC-R (Regulatory Capital) Calculator",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-436-bhc-schedule-hcr-capital.html",
    "description": "Given caller-supplied CET1/Tier1/Tier2 capital components and risk-weighted assets, computes FR Y-9C Schedule HC-R standard capital ratios p",
    "consumes": [
      "art-435-bhc-schedule-hc-balance-sheet"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-437-fr2052a-inflow-outflow-classifier",
    "display_name": "FR 2052a Inflow/Outflow Bucket Classifier",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-437-fr2052a-inflow-outflow-classifier.html",
    "description": "FR 2052a complex-institution liquidity monitoring filing-layer kernel, scoped to the inflow/outflow section: product/maturity-bucket classif",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-438-eval-attestation-receipt-composer",
    "display_name": "Eval Attestation Receipt Composer",
    "mandate_type": "governance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-438-eval-attestation-receipt-composer.html",
    "description": "Hashes a third-party eval log (e.g. an Inspect AI transcript) and binds it into a receipt that a compiled Work Mandate (art-274) can referen",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-439-y14-capital-worksheet-rollforward",
    "display_name": "FR Y-14 Capital Worksheet Roll-Forward & Cross-Check",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-439-y14-capital-worksheet-rollforward.html",
    "description": "Rolls forward a caller-declared FR Y-14A/Q capital worksheet (CET1, additional Tier 1, Tier 2) from beginning balance through period additio",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-44-arc-stablefx-model",
    "display_name": "Arc StableFX RFQ Economics Model",
    "mandate_type": "treasury_mandate",
    "url": "https://ainumbers.co/chaingraph/art-44-arc-stablefx-model.html",
    "description": "Quantify Herstatt risk elimination and FX spread savings from Arc StableFX 24/7 atomic PvP settlement vs non-CLS bilateral FX. Methodology: ",
    "consumes": [
      "art-42-arc-fit-diagnostic"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-442-nmd-behavioral-repricing-mapper",
    "display_name": "NMD Behavioral Repricing Mapper",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-442-nmd-behavioral-repricing-mapper.html",
    "description": "OCC 2010-1 Interagency Advisory on IRR: maps non-maturity deposit (NMD) segment balances into a bucketed net-repricing-gap schedule using a ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-443-irrbb-basis-risk-nii-shock-calculator",
    "display_name": "IRRBB Basis-Risk NII Shock Calculator",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-443-irrbb-basis-risk-nii-shock-calculator.html",
    "description": "Comptroller's Handbook IRR basis-risk delta-NII calculator: sweeps a single reference-rate shock across multiple priced indices (Prime, SOFR",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-444-collateral-haircut-engine",
    "display_name": "Collateral Haircut Engine (Basel CRE22)",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-444-collateral-haircut-engine.html",
    "description": "Basel CRE22 comprehensive-approach collateral haircut engine for counterparty credit risk: applies a caller-supplied, versioned supervisory ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-445-credit-concentration-topn-sector",
    "display_name": "Credit Concentration Top-N / Sector Checker",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-445-credit-concentration-topn-sector.html",
    "description": "Credit-concentration screen over a flat exposure list (name, sector, amount): returns the top-N single-name exposures by amount, a per-secto",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-446-counterparty-internal-limit-check",
    "display_name": "Counterparty Internal Limit Check",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-446-counterparty-internal-limit-check.html",
    "description": "Counterparty internal credit-limit check: compares each counterparty's caller-supplied current exposure against its board-approved internal ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-447-securitization-risk-retention-check",
    "display_name": "Securitization Risk Retention Check",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-447-securitization-risk-retention-check.html",
    "description": "EU Securitisation Regulation (EU) 2017/2402 Art.6 and U.S. Credit Risk Retention Rule (Dodd-Frank Sec.941, Reg RR, 12 CFR Part 244) 5% risk-",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-448-ifrs17-loss-component-tracker",
    "display_name": "IFRS 17 Loss Component Roll-Forward Tracker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-448-ifrs17-loss-component-tracker.html",
    "description": "Tracks the IFRS 17 para 50 loss-component roll-forward across periods: opening balance, additional loss recognised on new onerous contracts,",
    "consumes": [
      "art-178-ifrs17-csm-rollforward-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-449-solvency2-scr-module-aggregator",
    "display_name": "Solvency II SCR Standard-Formula Module Aggregator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-449-solvency2-scr-module-aggregator.html",
    "description": "Aggregates the five Solvency II standard-formula risk-module capital charges (market, counterparty default, life underwriting, health underw",
    "consumes": [],
    "feeds": [
      "art-180-solvency2-scr-ratio-calculator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-45-arc-xreserve-linter",
    "display_name": "Arc xReserve Config Linter",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-45-arc-xreserve-linter.html",
    "description": "8-check A–F linter for an Arc xReserve / on-chain reserve configuration. Checks: reserve sum=100%, GENIUS Act §4 eligible assets (US issuers",
    "consumes": [
      "art-42-arc-fit-diagnostic"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-450-model-inventory-entry",
    "display_name": "Model Inventory Entry Builder",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-450-model-inventory-entry.html",
    "description": "Builds a single model-inventory record for a bank's SR 26-2 model-risk-management inventory: checks the caller-declared attributes (model na",
    "consumes": [],
    "feeds": [
      "art-451-model-outcome-analysis"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-451-model-outcome-analysis",
    "display_name": "Model Outcome-Analysis Comparison",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-451-model-outcome-analysis.html",
    "description": "SR 26-2 ongoing-monitoring backtest: compares a list of period predicted-vs-actual model outcomes, computes per-period absolute percent erro",
    "consumes": [
      "art-450-model-inventory-entry"
    ],
    "feeds": [
      "art-453-model-validation-status"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-452-build-ai-training-data-lineage-record",
    "display_name": "AI Training-Data Lineage Record",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-452-build-ai-training-data-lineage-record.html",
    "description": "Composes a hash-chained ML training-data lineage record: dataset identity, dataset version, upstream source dataset references, a declared c",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-453-model-validation-status",
    "display_name": "Model Validation Status Assessor",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-453-model-validation-status.html",
    "description": "Determines a model's SR 26-2 validation status by combining its proportionality tier, last-validation date, and most recent outcome-analysis",
    "consumes": [
      "art-451-model-outcome-analysis"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-454-globe-jurisdictional-etr",
    "display_name": "GloBE Jurisdictional ETR Calculator",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-454-globe-jurisdictional-etr.html",
    "description": "Computes a jurisdiction's OECD Pillar Two (GloBE) effective tax rate from caller-declared constituent-entity financial data: sums entity-lev",
    "consumes": [],
    "feeds": [
      "art-455-globe-sbie-topup"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-455-globe-sbie-topup",
    "display_name": "GloBE SBIE & Top-up Tax Calculator",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-455-globe-sbie-topup.html",
    "description": "Computes the OECD Pillar Two substance-based income exclusion (SBIE) for a jurisdiction from a caller-declared payroll-cost figure, tangible",
    "consumes": [
      "art-454-globe-jurisdictional-etr"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-456-globe-safe-harbour-tests",
    "display_name": "GloBE Transitional Safe Harbour Test Evaluator",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-456-globe-safe-harbour-tests.html",
    "description": "Evaluates a jurisdiction against the OECD Pillar Two Transitional CbCR Safe Harbour (Dec 2022 Agreed Administrative Guidance): the de minimi",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-457-globe-gir-composer",
    "display_name": "GloBE Information Return (GIR) Composer",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-457-globe-gir-composer.html",
    "description": "Assembles the OECD GloBE Information Return (GIR) data model for one MNE group / fiscal year by combining the outputs of art-454 (jurisdicti",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-458-attribute-sampling-plan",
    "display_name": "Attribute Sampling Plan Generator",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-458-attribute-sampling-plan.html",
    "description": "Computes a SOX 404 / ICFR attribute-sampling plan from confidence level, tolerable deviation rate, and expected deviation rate (all policy i",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-459-sod-matrix-check",
    "display_name": "Segregation-of-Duties Matrix Checker",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-459-sod-matrix-check.html",
    "description": "Evaluates a caller-declared role-assignment set against a caller-declared SoD conflict ruleset for SOX 404 / ICFR access controls. For every",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-46-arc-paymaster-model",
    "display_name": "Arc Paymaster Economics Model",
    "mandate_type": "treasury_mandate",
    "url": "https://ainumbers.co/chaingraph/art-46-arc-paymaster-model.html",
    "description": "ERC-4337 Paymaster economics model for Arc. Computes gas cost (gasPerUop × gasPriceGwei × 1e-9 × ethPriceUsd), sponsorship break-even, and p",
    "consumes": [
      "art-42-arc-fit-diagnostic"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-460-ipe-integrity-verifier",
    "display_name": "IPE Integrity Verifier",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-460-ipe-integrity-verifier.html",
    "description": "Verifies Information-Produced-by-Entity (IPE) completeness and accuracy for SOX 404 / ICFR control testing -- is this report extract what th",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-461-control-test-evidence-composer",
    "display_name": "Control-Test Evidence Composer",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-461-control-test-evidence-composer.html",
    "description": "Composes a SOX 404 / ICFR control-test evidence artifact: reconciles a caller-declared attribute sample (item ids, e.g. from art-458) agains",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-462-je-ruleset-screen",
    "display_name": "Journal-Entry Ruleset Screen",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-462-je-ruleset-screen.html",
    "description": "Runs a caller-declared, versioned journal-entry testing ruleset over a caller-declared JE extract and flags each entry that trips one or mor",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-463-recalc-suite",
    "display_name": "Audit Recalculation Suite",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-463-recalc-suite.html",
    "description": "Independently recalculates five caller-supplied audit schedule types (straight-line/double-declining-balance/units-of-production depreciatio",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-464-confirmation-matcher",
    "display_name": "Bank/AR Confirmation Matcher",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-464-confirmation-matcher.html",
    "description": "Joins caller-supplied bank and accounts-receivable confirmation responses against caller-supplied ledger balances on (counterparty_id, type)",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-465-workpaper-bundle-composer",
    "display_name": "Workpaper Bundle Composer",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-465-workpaper-bundle-composer.html",
    "description": "Terminal composer for a substantive-procedure evidence bundle: a procedure identifier, a caller-declared population hash, the prior substant",
    "consumes": [
      "art-462-je-ruleset-screen",
      "art-463-recalc-suite",
      "art-464-confirmation-matcher"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-466-dora-roi-builder",
    "display_name": "DORA Register of Information (RoI) Builder & Cross-Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-466-dora-roi-builder.html",
    "description": "Constructs and cross-validates the core Register of Information (RoI) template relationships required under DORA (EU 2022/2554) Art. 28/30: ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-467-dora-incident-classifier",
    "display_name": "DORA ICT Incident Classifier & Reporting Clock",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-467-dora-incident-classifier.html",
    "description": "Classifies an ICT-related incident as major or non-major under DORA (EU 2022/2554) Art. 18, applying the published RTS (EU 2024/1772) numeri",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-47-arc-cctp-transfer",
    "display_name": "Arc CCTP v2 Transfer Validator",
    "mandate_type": "settlement_mandate",
    "url": "https://ainumbers.co/chaingraph/art-47-arc-cctp-transfer.html",
    "description": "Validates a CCTP v2 cross-chain USDC transfer for domain pair eligibility, Fast Transfer 30-second finality risk (LP availability), Hook pay",
    "consumes": [
      "art-42-arc-fit-diagnostic"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-470-lookback-completeness-reconciler",
    "display_name": "AML Lookback Completeness Reconciler",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-470-lookback-completeness-reconciler.html",
    "description": "Reconciles an AML consent-order remediation lookback's order-scope population against the extract actually produced for re-screening, per hi",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-471-disposition-sampling-frame",
    "display_name": "AML Disposition Sampling Frame Builder",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-471-disposition-sampling-frame.html",
    "description": "Builds a deterministic sampling frame over an AML consent-order lookback's historical alert dispositions for independent-validator review, p",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-472-cbcr-builder",
    "display_name": "OECD Country-by-Country Report Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-472-cbcr-builder.html",
    "description": "Builds an OECD BEPS Action 13 Country-by-Country Report XML schema skeleton from a caller-declared Table 1 (jurisdiction revenue/profit/tax/",
    "consumes": [],
    "feeds": [
      "art-473-interquartile-benchmark"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-473-interquartile-benchmark",
    "display_name": "Transfer-Pricing Interquartile Range Benchmark",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-473-interquartile-benchmark.html",
    "description": "OECD Transfer Pricing Guidelines Ch. III §3.57 interquartile-range arithmetic over a caller-declared array of already-selected comparable fi",
    "consumes": [
      "art-472-cbcr-builder"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-474-validate-mt700-lc-fields",
    "display_name": "MT700 LC Field Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-474-validate-mt700-lc-fields.html",
    "description": "Validates SWIFT MT700 Documentary Credit field-format and date-logic conformance against UCP 600 / MT700 mandatory-field rules: DC number, f",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-475-cfpb-1071-coverage-check",
    "display_name": "CFPB 1071 Coverage Check & SBLAR Record Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-475-cfpb-1071-coverage-check.html",
    "description": "CFPB Section 1071 small business lending rule (Regulation B subpart B, revised final rule published 2026-05-01): determines whether a financ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-476-map-agent-payment-mandate",
    "display_name": "Agent Payment Mandate Cross-Protocol Mapper",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-476-map-agent-payment-mandate.html",
    "description": "Translates an agentic-payment mandate declared under one protocol (AP2, x402, or ACP) into the field vocabulary of another, pivoting through",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-477-intraday-liquidity-monitoring",
    "display_name": "BCBS 248 Intraday Liquidity Monitoring Snapshot",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-477-intraday-liquidity-monitoring.html",
    "description": "BCBS 248 \"Monitoring tools for intraday liquidity management\" (Basel Committee, April 2013): computes daily maximum intraday liquidity usage",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-478-analyze-dc-vs-lc-cost-benefit",
    "display_name": "Documentary Collection vs Letter of Credit Cost-Benefit",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-478-analyze-dc-vs-lc-cost-benefit.html",
    "description": "Compares the total cost and risk-adjusted exposure of Documentary Collections (D/P, D/A) against Letters of Credit (Sight, Usance, Confirmed",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-479-compare-receivables-finance-economics",
    "display_name": "Forfaiting vs Factoring vs Invoice Discounting Economics",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-479-compare-receivables-finance-economics.html",
    "description": "Compares net proceeds and effective annual cost across forfaiting (medium/long-term trade receivables, non-recourse PV discount), factoring ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-48-treasury-clearing-fit-diagnostic",
    "display_name": "Treasury Clearing Fit Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-48-treasury-clearing-fit-diagnostic.html",
    "description": "12-question A-F readiness diagnostic for the SEC US Treasury clearing mandate (cash Dec 31 2026 / repo Jun 30 2027). Grades scope, access, m",
    "consumes": [],
    "feeds": [
      "art-49-clearing-access-model-selector",
      "art-50-ficc-margin-netting-estimator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-480-rdarr-aggregation-recompute",
    "display_name": "RDARR Aggregation Recompute",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-480-rdarr-aggregation-recompute.html",
    "description": "Re-derives a stated risk-report figure from a SUPPLIED source extract under a declared aggregation policy (filter set, netting rule, FX rate",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-481-rdarr-quality-scorecard",
    "display_name": "RDARR Quality Scorecard",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-481-rdarr-quality-scorecard.html",
    "description": "Deterministic data-quality metrics over a SUPPLIED risk-data extract, keyed to the measurable RDARR prerequisites: completeness of mandatory",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-482-emir-recon-adjudicator",
    "display_name": "EMIR Trade-Repository Reconciliation Adjudicator",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-482-emir-recon-adjudicator.html",
    "description": "Under EMIR Refit the trade repository (TR) runs the inter-TR reconciliation and returns a daily ISO 20022 response naming matched/unreconcil",
    "consumes": [],
    "feeds": [
      "art-483-emir-break-ageing"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-483-emir-break-ageing",
    "display_name": "EMIR Reconciliation Break Ageing",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-483-emir-break-ageing.html",
    "description": "Diffs a current EMIR reconciliation break set (e.g. from art-482-emir-recon-adjudicator) against the prior cycle's sealed break set by stabl",
    "consumes": [
      "art-482-emir-recon-adjudicator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-484-regrpt-editcheck-runner",
    "display_name": "Published Regulatory Report Edit-Check Runner",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-484-regrpt-editcheck-runner.html",
    "description": "Evaluates a caller-supplied report instance against a caller-supplied published edit-check rule set -- FFIEC Call Report validity and qualit",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-485-regrpt-variance-explainer",
    "display_name": "Regulatory Report Period-over-Period Variance Explainer",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-485-regrpt-variance-explainer.html",
    "description": "Computes period-over-period variance across a regulatory report instance pair -- absolute and relative movement per line item against a poli",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-486-cscf-control-applicability",
    "display_name": "CSCF Control Applicability & Coverage",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-486-cscf-control-applicability.html",
    "description": "Scores a Swift member's declared architecture type and component inventory against a policy-supplied Swift Customer Security Controls Framew",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-487-assessor-independence-check",
    "display_name": "Swift CSP Assessor Independence Eligibility",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-487-assessor-independence-check.html",
    "description": "Checks eligibility of a Swift CSCF Independent Assessment Framework assessment: assessment route (internal 2nd/3rd line vs external) against",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-488-model-replication-diff",
    "display_name": "Model Replication Diff",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-488-model-replication-diff.html",
    "description": "Independently recomputes a model's reported outputs from a declared model specification (version, as-of date, transform, intercept, coeffici",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-489-model-test-battery",
    "display_name": "Model Test Battery",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-489-model-test-battery.html",
    "description": "Runs the deterministic-given-data quantitative model validation battery: discriminatory power (Gini coefficient, Kolmogorov-Smirnov statisti",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-49-clearing-access-model-selector",
    "display_name": "Clearing Access Model Selector",
    "mandate_type": "treasury_mandate",
    "url": "https://ainumbers.co/chaingraph/art-49-clearing-access-model-selector.html",
    "description": "Selects and costs the FICC access model - Direct vs Sponsored (done-with) vs Sponsored/Agent (done-away) - across cost, execution-access, ma",
    "consumes": [
      "art-48-treasury-clearing-fit-diagnostic"
    ],
    "feeds": [
      "504-settlement-risk-capital-optimizer",
      "art-50-ficc-margin-netting-estimator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-490-fatca-crs-submission-check",
    "display_name": "FATCA/CRS Submission Conformance Check",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-490-fatca-crs-submission-check.html",
    "description": "Evaluates a FATCA/CRS submission record set against a policy-supplied schema version and business-rule set: DocTypeIndic sequencing (the pub",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-491-ro-remediation-closure",
    "display_name": "FATCA/CRS RO Remediation Closure Tracker",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-491-ro-remediation-closure.html",
    "description": "Tracks the returned notification set for a FATCA/CRS certification period (ICMM-style error notifications, CRS status messages) against the ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-492-classify-settlement-finality",
    "display_name": "Settlement Finality Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-492-classify-settlement-finality.html",
    "description": "Vendor-neutral settlement-finality classifier covering three settlement models, each on its own ordered tier ladder: an optimistic challenge",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-494-icm-quorum-forgery-classifier",
    "display_name": "ICM Quorum Forgery Classifier",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-494-icm-quorum-forgery-classifier.html",
    "description": "Computes the smallest set of a source Avalanche L1's validators that could jointly sign an Interchain Messaging (ICM / Avalanche Warp Messag",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-495-avax-permissioning-control-classifier",
    "display_name": "Evergreen Permissioning-Control Classifier",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-495-avax-permissioning-control-classifier.html",
    "description": "Classifies six Evergreen supervisory controls -- transaction permissioning, contract deployment permissioning, native asset issuance, fee po",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-496-l1-continuous-fee-runway",
    "display_name": "L1 Continuous-Fee Runway Model",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-496-l1-continuous-fee-runway.html",
    "description": "Avalanche Evergreen L1 continuous-fee TCO and depletion-runway model. ACP-77 replaced the 2000 AVAX stake requirement with a continuous, dyn",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-497-validator-change-control-receipt",
    "display_name": "Validator Change-Control Receipt",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-497-validator-change-control-receipt.html",
    "description": "Turns one permissioned-validator event on an Avalanche Evergreen L1 -- a validator add, remove, or weight change -- into change-control evid",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-498-reward-flow-related-party",
    "display_name": "Consortium Validator Reward-Flow Related-Party Classifier",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-498-reward-flow-related-party.html",
    "description": "Answers the question a consortium controller faces at quarter-end close on a permissioned Avalanche Evergreen L1: are any of the reward-mana",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-499-check-safeguarding-reconciliation",
    "display_name": "CASS 15 Safeguarding Reconciliation Check",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-499-check-safeguarding-reconciliation.html",
    "description": "Compares a UK payment or e-money firm's safeguarding requirement (CASS 15.8.29G) against the components of its safeguarding resource (CASS 1",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-50-ficc-margin-netting-estimator",
    "display_name": "FICC Margin & Netting Estimator",
    "mandate_type": "risk_parameter",
    "url": "https://ainumbers.co/chaingraph/art-50-ficc-margin-netting-estimator.html",
    "description": "DV01-bucket VaR proxy of the FICC VaR-based margin (VBM), the netting benefit of central vs bilateral clearing, cash-vs-repo cross-product n",
    "consumes": [
      "art-48-treasury-clearing-fit-diagnostic",
      "art-49-clearing-access-model-selector"
    ],
    "feeds": [
      "508-repo-haircut-collateral-calculator",
      "qfa-02-portfolio-var-engine"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-500-classify-safeguarding-method",
    "display_name": "CASS 15 Safeguarding Method Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-500-classify-safeguarding-method.html",
    "description": "Classifies each caller-declared funds stream of a UK payment or e-money firm on three questions: whether the funds are relevant funds, wheth",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-501-build-safeguarding-audit-evidence",
    "display_name": "CASS 15 Safeguarding Audit Evidence Pack",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-501-build-safeguarding-audit-evidence.html",
    "description": "Assembles the evidence set a qualified auditor asks a UK payment or e-money firm for at the start of a CASS 15 safeguarding audit: the recon",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-502-bind-attested-subject",
    "display_name": "Attested Artifact Subject Binder",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-502-bind-attested-subject.html",
    "description": "Computes the SPEC.md section 27.4 attested-artifact subject identifier for the sealed output of a pinned non-OCG producer: a spreadsheet, a ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-503-build-dual-control-certification",
    "display_name": "Dual Control Certification Evidence",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-503-build-dual-control-certification.html",
    "description": "Decides whether a required number of distinct named identities have each filed a signed section 27 approval record over one sealed subject i",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-504-classify-carf-reportable",
    "display_name": "CARF / DAC8 Reportable User Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-504-classify-carf-reportable.html",
    "description": "Classifies crypto-asset user records and their transactions for Crypto-Asset Reporting Framework and DAC8 purposes, against a policy set the",
    "consumes": [],
    "feeds": [
      "art-505-dispose-carf-status-message"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-505-dispose-carf-status-message",
    "display_name": "CARF Status Message Disposition",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-505-dispose-carf-status-message.html",
    "description": "Turns a returned Crypto-Asset Reporting Framework or DAC8 status message into a dispositioned break list: every file-level and record-level ",
    "consumes": [
      "art-504-classify-carf-reportable"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-506-classify-t1-posttrade-timing",
    "display_name": "T+1 Post-Trade Timing Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-506-classify-t1-posttrade-timing.html",
    "description": "Classifies the post-trade timings a caller supplies to answer the question a settlement readiness programme is actually trying to answer: wh",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-507-determine-deposit-insurance-coverage",
    "display_name": "Deposit Insurance Coverage Determination",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-507-determine-deposit-insurance-coverage.html",
    "description": "Computes the insured amount and the uninsured remainder for deposit accounts grouped by ownership right and capacity, and reports every acco",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-508-recompute-bordereau",
    "display_name": "Delegated Authority Bordereau Recomputation",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-508-recompute-bordereau.html",
    "description": "Recomputes a delegated authority bordereau the way the carrier reviewer does, from the same file the coverholder sent. It foots gross premiu",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-509-recompute-payment-waterfall",
    "display_name": "Securitisation Payment Waterfall Recomputation",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-509-recompute-payment-waterfall.html",
    "description": "Recomputes a securitisation payment waterfall for one stated period from the aggregate available funds and the priority ladder the investor ",
    "consumes": [],
    "feeds": [
      "art-510-build-art5-diligence-evidence"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-51-cross-margining-benefit-estimator",
    "display_name": "FICC-CME Cross-Margining Estimator",
    "mandate_type": "risk_parameter",
    "url": "https://ainumbers.co/chaingraph/art-51-cross-margining-benefit-estimator.html",
    "description": "Estimates the initial-margin reduction from the FICC-CME cross-margining arrangement (customer expansion per SEC notice published 2025-12-22",
    "consumes": [
      "art-48-treasury-clearing-fit-diagnostic"
    ],
    "feeds": [
      "qfa-02-portfolio-var-engine",
      "qfa-03-stress-test-engine"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-510-build-art5-diligence-evidence",
    "display_name": "Article 5 Due Diligence Evidence Record",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-510-build-art5-diligence-evidence.html",
    "description": "Records, for one securitisation position over one stated period, which Article 5 verification and ongoing monitoring duties an institutional",
    "consumes": [
      "art-509-recompute-payment-waterfall"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-511-recompute-fund-fees",
    "display_name": "Recompute Fund Fees",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-511-recompute-fund-fees.html",
    "description": "Recomputes a fund's management fee and performance fee from the terms the investor already holds (the fee statement and the fund agreement) ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-512-check-mica-reserve-disclosure",
    "display_name": "Check MiCA Reserve Disclosure",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-512-check-mica-reserve-disclosure.html",
    "description": "Checks a token issuer's published reserve disclosure, the amount in circulation and the value and composition of the reserve, against the co",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-513-public-money-settlement-receipt",
    "display_name": "Public-Money Settlement Receipt",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-513-public-money-settlement-receipt.html",
    "description": "Turns one caller-transcribed payment of public money into settlement evidence an audit authority can check with no access to the operator's ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-514-conditional-relief-collateral-receipt",
    "display_name": "Conditional-Relief Collateral Receipt",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-514-conditional-relief-collateral-receipt.html",
    "description": "Shows, per acceptance and per day, that every condition of a conditional regulatory relief -- no-action, exemptive, or comfort-letter -- hel",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-515-build-allocation-decision-receipt",
    "display_name": "Build Allocation Decision Receipt",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-515-build-allocation-decision-receipt.html",
    "description": "Re-derives whether an allocation produced by an optimizer is explained by the objective and inputs that were true when it was made: the elig",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-516-daily-reconciliation-attestation",
    "display_name": "Daily Reconciliation Attestation",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-516-daily-reconciliation-attestation.html",
    "description": "Attests that a daily reconciliation duty was discharged over a caller-declared population, rather than computing the reconciliation match it",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-517-audit-trail-completeness",
    "display_name": "Audit-Trail Completeness Attestation",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-517-audit-trail-completeness.html",
    "description": "Attests that an audit log covering transactions and user activity is complete and gap-free over a caller-declared window, against a caller-d",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-518-bulk-disbursement-integrity",
    "display_name": "Bulk Disbursement Integrity",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-518-bulk-disbursement-integrity.html",
    "description": "Attests that a bulk payment run -- salaries, pensions, social transfers, vendor payments -- is internally consistent and matches its authori",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-519-payment-data-migration-completeness",
    "display_name": "Payment Data Migration Completeness",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-519-payment-data-migration-completeness.html",
    "description": "Verifies that data moved from a legacy system to a successor is complete, value-preserving, and reconcilable, using caller-declared per-part",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-52-digital-trade-fit-diagnostic",
    "display_name": "Digital Trade Corridor Fit Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-52-digital-trade-fit-diagnostic.html",
    "description": "12-question A–F readiness diagnostic for digital trade / electronic trade documents (MLETR). Grades corridor legality, document digitisation",
    "consumes": [],
    "feeds": [
      "art-53-mletr-ebl-conformance-validator",
      "art-54-digital-trade-rules-checker",
      "art-55-trade-document-provenance-verifier",
      "509-canton-party-allowlist-validator",
      "art-10-amla-transaction-typology-risk-scorer",
      "ml-02-credit-default-risk-scorer",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-520-operator-exit-data-portability",
    "display_name": "Operator Exit & Data Portability",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-520-operator-exit-data-portability.html",
    "description": "Evaluates a caller-declared operator-exit and data-portability posture: per data category, whether an export path exists and whether its for",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-521-settlement-asset-backing-invariant",
    "display_name": "Settlement-Asset Backing Invariant",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-521-settlement-asset-backing-invariant.html",
    "description": "Checks whether value held across an issuance topology stays fully backed in aggregate, not merely per account, as balances move between call",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-523-identity-proofing-assurance-level",
    "display_name": "Identity-Proofing Assurance Level Evaluator",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-523-identity-proofing-assurance-level.html",
    "description": "Rates whether a DECLARED identity-evidence set reaches a DECLARED target level of a caller-supplied, versioned assurance-level framework (th",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-524-source-arrival-freshness-register",
    "display_name": "Source Arrival & Freshness Register",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-524-source-arrival-freshness-register.html",
    "description": "Reconciles a caller-declared EXPECTED-source inventory against caller-declared OBSERVED arrivals, per source: arrived, missing, late (arrive",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-525-nway-balance-closure-check",
    "display_name": "N-Way Balance Closure Check",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-525-nway-balance-closure-check.html",
    "description": "Takes three or more caller-declared balances for the same measure, at the same as-of moment, across named internal systems, and ENFORCES the",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-526-report-gl-reconciliation",
    "display_name": "Report-to-General-Ledger Reconciliation",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-526-report-gl-reconciliation.html",
    "description": "Ties a caller-declared reported figure to a caller-declared general-ledger figure, by account -- the only node in this reconciliation progra",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-527-classify-ledger-consensus-finality",
    "display_name": "Ledger Consensus Finality Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-527-classify-ledger-consensus-finality.html",
    "description": "Classifies a ledger-consensus position under a deadline-bounded-inclusion model (XRPL) or a federated-BFT model (Stellar SCP), each expresse",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-528-cross-ccp-pqd-comparator",
    "display_name": "Cross-CCP PQD Comparator",
    "mandate_type": "regulatory_reporting",
    "url": "https://ainumbers.co/chaingraph/art-528-cross-ccp-pqd-comparator.html",
    "description": "Compares a caller-selected set of CPMI-IOSCO public quantitative disclosure (PQD) fields across FICC and ICE using a manually-transcribed, s",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-529-ccp-default-waterfall-recompute",
    "display_name": "CCP Default Waterfall Recomputation",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-529-ccp-default-waterfall-recompute.html",
    "description": "Recomputes the sequential loss-allocation order at a CCP defaulting-member event: defaulter's initial margin, then the defaulter's default-f",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-53-mletr-ebl-conformance-validator",
    "display_name": "MLETR / eBL Conformance & Enforceability Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-53-mletr-ebl-conformance-validator.html",
    "description": "Validates an electronic transferable record (eBL or other ETR) against MLETR functional-equivalence tests (Arts. 10–12: singularity, control",
    "consumes": [
      "art-52-digital-trade-fit-diagnostic"
    ],
    "feeds": [
      "510-digital-asset-regulatory-classifier",
      "cry-04-merkle-batch-verifier",
      "ml-02-credit-default-risk-scorer"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-530-default-fund-cover2-sizing",
    "display_name": "CCP Default Fund Cover-2 Sizing",
    "mandate_type": "risk_parameter",
    "url": "https://ainumbers.co/chaingraph/art-530-default-fund-cover2-sizing.html",
    "description": "Sizes a CCP default fund under the PFMI Principle 4 \"Cover 2\" standard: fund size must be at least the largest plus second-largest clearing-",
    "consumes": [
      "qfa-03-stress-test-engine"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-531-member-margin-call-lifecycle",
    "display_name": "Member Margin Call Lifecycle",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-531-member-margin-call-lifecycle.html",
    "description": "Tracks a clearing member's margin call through its declared lifecycle states -- issued, confirmed, funded, or disputed and escalated as a co",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-532-client-porting-check",
    "display_name": "Client Porting Check",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-532-client-porting-check.html",
    "description": "Checks whether a client's cleared positions and collateral are portable to a backup clearing member under a caller-declared porting window, ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-533-mra-remediation-closure-register",
    "display_name": "Consent-Order / MRA Remediation Closure Register",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-533-mra-remediation-closure-register.html",
    "description": "Registers a firm's consent-order Articles / MRA findings against its own remediation records: per-issue milestone completeness (closed with ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-534-aml-lookback-disposition-rollup",
    "display_name": "AML Lookback Disposition Rollup",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-534-aml-lookback-disposition-rollup.html",
    "description": "Closes the loop art-470 (lookback-completeness-reconciler) and art-471 (disposition-sampling-frame) leave open. Art-470 reconciles that the ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-535-fdic370-output-file-validator",
    "display_name": "FDIC Part 370 Output-File Validator",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-535-fdic370-output-file-validator.html",
    "description": "Validates the shape of the institution's own 12 CFR part 370 deposit-insurance-coverage output file (the section 370.10 coverage summary rep",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-536-reg-w-affiliate-transaction-tester",
    "display_name": "Reg W Affiliate Transaction Tester",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-536-reg-w-affiliate-transaction-tester.html",
    "description": "Tests each caller-declared covered transaction with an affiliate against the Regulation W (12 CFR 223) quantitative limits: the 10% single-a",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-537-qfc-recordkeeping-file-validator",
    "display_name": "QFC Part 371 Recordkeeping File Validator",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-537-qfc-recordkeeping-file-validator.html",
    "description": "Validates the shape of the institution's own 12 CFR part 371 qualified-financial-contract recordkeeping file -- the position, counterparty, ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-538-custody-segregation-ratio",
    "display_name": "Custody Segregation Ratio",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-538-custody-segregation-ratio.html",
    "description": "Generic, jurisdiction-neutral custody-segregation check: segregated_custody_assets_musd / customer_claims_musd, per asset class and rolled u",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-539-asset-liability-coverage",
    "display_name": "Asset/Liability Coverage",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-539-asset-liability-coverage.html",
    "description": "General, jurisdiction-neutral solvency check: total_assets_musd / total_liabilities_musd, plus surplus_shortfall_musd = total_assets_musd - ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-54-digital-trade-rules-checker",
    "display_name": "Digital Trade Rules Compliance Checker",
    "mandate_type": "scheme_rule",
    "url": "https://ainumbers.co/chaingraph/art-54-digital-trade-rules-checker.html",
    "description": "Machine-checks a digital trade presentation (digital LC, collection, or open-account transaction) against the ICC digital rulebooks: eUCP v2",
    "consumes": [
      "art-52-digital-trade-fit-diagnostic"
    ],
    "feeds": [
      "art-08-en16931-einvoice-batch-validator",
      "art-55-trade-document-provenance-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-540-por-liabilities-composer",
    "display_name": "PoR Liabilities Composer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-540-por-liabilities-composer.html",
    "description": "Composes a caller-restated art-280-reserve-proof-verifier inclusion result (soft-dep: inclusion_verified, computed_root.sum) with a caller-s",
    "consumes": [
      "art-280-reserve-proof-verifier"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-541-best-execution-recompute",
    "display_name": "Best-Execution NBBO Recompute",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-541-best-execution-recompute.html",
    "description": "Recomputes, per supplied fill, price improvement in basis points against the NBBO at time of execution -- price_improvement_bps = (nbbo_ask ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-543-csdr-penalty-recompute",
    "display_name": "CSDR Penalty Recompute (Caller Reference Price)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-543-csdr-penalty-recompute.html",
    "description": "Per-ISIN/day CSDR cash-penalty recompute over a caller-declared open-fails set: selects the RTS asset-class/penalty-type daily rate (CSDR-RT",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-544-slate-report-validator",
    "display_name": "SLATE Securities-Loan Report Field Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-544-slate-report-validator.html",
    "description": "Field-level structural validator for a covered-securities-loan report record against the FINRA Rule 6500-series field spec (loan terms, rate",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-545-slate-readiness-diagnostic",
    "display_name": "SLATE Reporting Readiness Diagnostic",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-545-slate-readiness-diagnostic.html",
    "description": "Score a caller-declared covered-securities-loan reporting pipeline against the FINRA Rule 6540 obligation checklist (SEC 10c-1a implementati",
    "consumes": [
      "art-544-slate-report-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-546-dtcc-ca-iso20022-validator",
    "display_name": "DTC Corporate Actions ISO 20022 Message Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-546-dtcc-ca-iso20022-validator.html",
    "description": "Validates the structural message-shape of a single DTC corporate-action event message (notification / election / allocation) against the ISO",
    "consumes": [],
    "feeds": [
      "art-547-corporate-action-entitlement-recompute"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-547-corporate-action-entitlement-recompute",
    "display_name": "Corporate Action Entitlement Recompute",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-547-corporate-action-entitlement-recompute.html",
    "description": "Deterministic dividend/rights/split entitlement math per record date for a single position, under the ISO 20022 corporate-action event field",
    "consumes": [
      "art-546-dtcc-ca-iso20022-validator"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-548-vop-readiness-diagnostic",
    "display_name": "VoP Readiness Diagnostic",
    "mandate_type": "vop_readiness_attestation",
    "url": "https://ainumbers.co/chaingraph/art-548-vop-readiness-diagnostic.html",
    "description": "EU Instant Payments Regulation Verification-of-Payee (VoP) readiness/consistency diagnostic. Deterministically classifies a caller-declared ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-549-g20-corridor-cost-gap",
    "display_name": "G20/FSB Corridor Cost-Gap Calculator",
    "mandate_type": "risk_parameter",
    "url": "https://ainumbers.co/chaingraph/art-549-g20-corridor-cost-gap.html",
    "description": "Recomputes a caller-declared cross-border payment corridor's cost gap against the hardcoded G20/FSB roadmap targets: retail cross-border pay",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-55-trade-document-provenance-verifier",
    "display_name": "Trade Document Provenance & Consistency Verifier",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/art-55-trade-document-provenance-verifier.html",
    "description": "Cross-validates a full trade-document set (eBL, commercial invoice, packing list, certificate of origin, insurance certificate) for internal",
    "consumes": [
      "art-52-digital-trade-fit-diagnostic",
      "art-54-digital-trade-rules-checker"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier",
      "art-10-amla-transaction-typology-risk-scorer",
      "ml-03-timeseries-anomaly-detector"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-550-reg-e-remittance-disclosure-check",
    "display_name": "Reg E Remittance Disclosure Consistency Check",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-550-reg-e-remittance-disclosure-check.html",
    "description": "Deterministic recompute of the Reg E Subpart B (12 CFR 1005.31, implementing Dodd-Frank section 1073) remittance disclosure arithmetic ident",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-551-mt101-coexistence-readiness-diff",
    "display_name": "Swift MT101 Coexistence Readiness Diff",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/tools/577-mt101-coexistence-readiness-diff.html",
    "description": "Evaluates Swift CBPR+ MT101 message-type retirement readiness ahead of the 2026-11-14 coexistence deadline, when FI-to-FI bulk/multiple paym",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-557-record-index-constituents",
    "display_name": "Record Index Constituents",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-557-record-index-constituents.html",
    "description": "Gives an index's constituent set, as of a stated date, its own citable execution_hash -- the BMR/SEBI-shaped starting point ('what was in th",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-558-record-fund-positions",
    "display_name": "Record Fund Positions",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-558-record-fund-positions.html",
    "description": "Gives a fund's declared positions snapshot, as of a stated valuation date, its own citable execution_hash -- the upstream input-receipt that",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-559-attest-calc-agent-independence",
    "display_name": "Calculation-Agent Independence Attestation",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-559-attest-calc-agent-independence.html",
    "description": "Receipts the organizational-independence claim a parametric trigger's neutrality depends on: that the entity whose kernel computed a specifi",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-56-tokenized-settlement-fit-diagnostic",
    "display_name": "Wholesale Tokenized Settlement Fit Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-56-tokenized-settlement-fit-diagnostic.html",
    "description": "12-question A-F readiness diagnostic for wholesale tokenized settlement (tokenized deposits, central bank money, regulated stablecoins as se",
    "consumes": [],
    "feeds": [
      "art-57-deposit-token-compliance-validator",
      "art-58-cross-network-settlement-validator",
      "art-59-settlement-asset-finality-classifier",
      "505-tokenized-collateral-eligibility-checker",
      "509-canton-party-allowlist-validator",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-560-oracle-price-aggregation",
    "display_name": "Oracle Price Aggregation",
    "mandate_type": "oracle_price_aggregation",
    "url": "https://ainumbers.co/chaingraph/art-560-oracle-price-aggregation.html",
    "description": "Computes the aggregate price a decentralized oracle network would publish from a set of individual submissions, and gives that print its own",
    "consumes": [],
    "feeds": [
      "art-561-currency-basket-index"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-561-currency-basket-index",
    "display_name": "Currency Basket Index",
    "mandate_type": "currency_basket_index",
    "url": "https://ainumbers.co/chaingraph/art-561-currency-basket-index.html",
    "description": "Values a currency basket by the fixed-amount method, where currency amounts are fixed at a rebase date and the live weights float daily with",
    "consumes": [
      "art-560-oracle-price-aggregation"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-562-compile-model-risk-lineage-pack",
    "display_name": "Compile Model Risk Lineage Pack",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-562-compile-model-risk-lineage-pack.html",
    "description": "Compiles a model's current model-passport-lifecycle (art-450-model-inventory-entry, art-451-model-outcome-analysis, art-453-model-validation",
    "consumes": [
      "art-450-model-inventory-entry",
      "art-451-model-outcome-analysis",
      "art-453-model-validation-status",
      "art-488-model-replication-diff",
      "art-489-model-test-battery"
    ],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-563-mt9xx-camt-statement-migration-mapper",
    "display_name": "Swift MT9xx to camt Statement Migration Mapper",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-563-mt9xx-camt-statement-migration-mapper.html",
    "description": "Maps a pasted Swift MT900/910/940/942/950 statement or notification message to a camt.052/053/054-shaped JSON mapping object, plus a fidelit",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-564-ucp-checkout-payload-lint",
    "display_name": "UCP Checkout Payload Lint",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-564-ucp-checkout-payload-lint.html",
    "description": "Deterministic, verify-only structural lint of a caller-supplied Universal Commerce Protocol (UCP; Google + Shopify, announced NRF 2026-01-11",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-565-kya-x402-scope-verifier",
    "display_name": "KYA Credential x x402 Payload Scope Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-565-kya-x402-scope-verifier.html",
    "description": "Cross-checks a declared KYA (Know Your Agent) credential's scope against a declared x402 PaymentPayload: amount vs the credential's spend ca",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-566-iolta-three-way-reconciliation",
    "display_name": "IOLTA Three-Way Trust Reconciliation",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-566-iolta-three-way-reconciliation.html",
    "description": "Recomputes the monthly IOLTA/client-trust three-way close every small law firm already does by hand in a spreadsheet: the bank statement (ad",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-567-pe-waterfall-lp-recompute",
    "display_name": "PE Distribution Waterfall LP-Side Recompute",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-567-pe-waterfall-lp-recompute.html",
    "description": "Recomputes a standard 4-tier PE distribution waterfall (return of capital, preferred return, GP catch-up, residual carry split) from caller-",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-568-securitization-trustee-report-recompute",
    "display_name": "Securitization Trustee-Report Waterfall Recomputation",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-568-securitization-trustee-report-recompute.html",
    "description": "Recomputes a securitization priority-of-payments waterfall for one stated distribution period from a caller-declared tier list and the perio",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-569-muni-arbitrage-spending-exception-checker",
    "display_name": "Muni Arbitrage Spending-Exception Checker",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-569-muni-arbitrage-spending-exception-checker.html",
    "description": "Tests whether a tax-exempt bond issue's declared expenditure schedule satisfies one of the three IRC section 148 arbitrage-rebate spending e",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-57-deposit-token-compliance-validator",
    "display_name": "Deposit-Token Compliance Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-57-deposit-token-compliance-validator.html",
    "description": "3-test validator distinguishing a bank-liability deposit token (JPMD/RLN model: at-par-on-demand, on-balance-sheet, allowlisted-wholesale) f",
    "consumes": [
      "art-56-tokenized-settlement-fit-diagnostic"
    ],
    "feeds": [
      "510-digital-asset-regulatory-classifier",
      "cry-04-merkle-batch-verifier",
      "art-59-settlement-asset-finality-classifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-570-ucp600-document-examination-assembler",
    "display_name": "UCP 600 / ISBP 745 Document Examination Assembler",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-570-ucp600-document-examination-assembler.html",
    "description": "Recomputes the letter-of-credit document examination a checker already works from a paper checklist inside the 5-banking-day window, from st",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-571-lease-schedule-recompute-asc842-ifrs16",
    "display_name": "Lease Schedule Recompute — ASC 842 / IFRS 16",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-571-lease-schedule-recompute-asc842-ifrs16.html",
    "description": "Recomputes the present value of a declared lease payment schedule and the full effective-interest amortization -- liability and right-of-use",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-572-multi-garnishment-stacking-recompute",
    "display_name": "Multi-Garnishment Stacking Recomputation",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-572-multi-garnishment-stacking-recompute.html",
    "description": "Recomputes, for one stated pay period, how much of an employee's disposable earnings each order in a caller-declared garnishment stack may l",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-573-section16b-short-swing-profit-recompute",
    "display_name": "Section 16(b) Short-Swing Profit Recomputation",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-573-section16b-short-swing-profit-recompute.html",
    "description": "Recomputes an Exchange Act Section 16(b) short-swing profit figure from a caller-declared list of an insider's own transactions in the issue",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-574-certified-payroll-prevailing-wage-recompute",
    "display_name": "Certified Payroll / Prevailing Wage Recomputation",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-574-certified-payroll-prevailing-wage-recompute.html",
    "description": "Recomputes, for one stated certified-payroll week, whether each worker on a caller-declared payroll was paid at or above the wage-determinat",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-575-tmpg-fails-charge-recompute",
    "display_name": "TMPG Fails-Charge Recompute",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-575-tmpg-fails-charge-recompute.html",
    "description": "Recomputes the NY Fed Treasury Market Practices Group fails-charge claim a buyer presents to a failing seller on a UST, agency, or agency-MB",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-576-emir3-active-account-representativeness-classifier",
    "display_name": "EMIR 3.0 Active Account Representativeness Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-576-emir3-active-account-representativeness-classifier.html",
    "description": "Classifies an EU counterparty's posture under EMIR Article 7a (the Active Account Requirement, inserted by Regulation (EU) 2024/2987) across",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-577-exchange-fee-tier-recompute",
    "display_name": "Exchange Access-Fee / Maker-Taker Tier Recompute",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-577-exchange-fee-tier-recompute.html",
    "description": "Recomputes a monthly exchange maker-taker invoice from a caller-pasted fee schedule: resolves the firm's active tier from its declared prior",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-578-etf-pcf-basket-verification",
    "display_name": "ETF PCF Create/Redeem Basket Verification",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-578-etf-pcf-basket-verification.html",
    "description": "Recomputes what an authorized participant's assembled ETF create/redeem basket should contain against the fund's daily Portfolio Composition",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-579-stock-loan-rebate-recompute",
    "display_name": "Stock-Loan Rebate/Fee Recompute",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-579-stock-loan-rebate-recompute.html",
    "description": "Recomputes the periodic rebate or fee bill on an open securities loan that a borrower or beneficial owner receives from an agent lender or p",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-58-cross-network-settlement-validator",
    "display_name": "Cross-Network Atomic Settlement Validator",
    "mandate_type": "settlement_mandate",
    "url": "https://ainumbers.co/chaingraph/art-58-cross-network-settlement-validator.html",
    "description": "Validates atomic settlement across two or more networks: cash leg final on the money ledger, asset leg delivered on the asset ledger, FX leg",
    "consumes": [
      "art-56-tokenized-settlement-fit-diagnostic",
      "art-59-settlement-asset-finality-classifier"
    ],
    "feeds": [
      "507-canton-dvp-atomicity-validator",
      "511-multi-currency-pvp-validator",
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-580-15c3-3a-note-h-margin-debit",
    "display_name": "15c3-3a Note H Margin-Debit Computation",
    "mandate_type": "analytics_mandate",
    "url": "https://ainumbers.co/chaingraph/art-580-15c3-3a-note-h-margin-debit.html",
    "description": "Recomputes whether a margin debit related to a broker-dealer's customer transactions in U.S. Treasury securities qualifies for inclusion in ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-581-emir3-simm-approval-scope-classifier",
    "display_name": "EMIR 3 SIMM Approval-Scope Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-581-emir3-simm-approval-scope-classifier.html",
    "description": "Classifies which EMIR 3 initial-margin model-approval obligations apply to a caller-declared counterparty profile across four items: prior c",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-582-genius-reserve-disclosure-conformance-monitor",
    "display_name": "GENIUS Act Reserve-Disclosure Conformance Monitor",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-582-genius-reserve-disclosure-conformance-monitor.html",
    "description": "Checks a monthly PPSI reserve disclosure against two statute-derived GENIUS Act S.394 §4 requirements: 1:1 reserve coverage arithmetic and a",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-583-beacon-seeded-fair-sampling-deriver",
    "display_name": "Beacon-Seeded Fair-Sampling Deriver",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-583-beacon-seeded-fair-sampling-deriver.html",
    "description": "Derives a deterministic, offline-replayable audit sample by HMAC-DRBG (SHA-256) seeded from a caller-pasted public randomness beacon pulse (",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-584-proof-of-reserves-verifier",
    "display_name": "Proof-of-Reserves Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-584-proof-of-reserves-verifier.html",
    "description": "Independently recomputes an exchange or custodian's published Proof-of-Reserves data: a single-leaf Merkle-sum inclusion path, a liability-s",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-585-sanctions-screening-evidence-pack",
    "display_name": "Sanctions Screening Evidence Pack",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-585-sanctions-screening-evidence-pack.html",
    "description": "Binds a caller-declared sanctions-screening decision (query, match count, decision) to the EXACT versioned dataset it was screened against, ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-587-finp2p-ledger-proof-verifier",
    "display_name": "FinP2P Ledger Proof Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-587-finp2p-ledger-proof-verifier.html",
    "description": "Verifies a FinP2P Ledger Proof in Hashlist mode against a caller-supplied secp256k1 public key. Recomputes the FinP2P Hashlist digest (fixed",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-588-docket-deadline-sweep",
    "display_name": "Docket Deadline Sweep",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-588-docket-deadline-sweep.html",
    "description": "Sweeps a caller-declared docket -- a flat list of {date, action, type, source, done} deadline records, the structured shape practitioners al",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-589-redline-round-classifier",
    "display_name": "Redline Round Classifier",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-589-redline-round-classifier.html",
    "description": "Classifies per-segment changes between two negotiation rounds of the same document (paragraph or clause-segmented structured text, pasted or",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-59-settlement-asset-finality-classifier",
    "display_name": "Settlement-Asset & Legal-Finality Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-59-settlement-asset-finality-classifier.html",
    "description": "Classifies the settlement asset (CBM token / tokenized commercial bank deposit / regulated stablecoin / e-money token) against its legal-fin",
    "consumes": [
      "art-56-tokenized-settlement-fit-diagnostic"
    ],
    "feeds": [
      "art-58-cross-network-settlement-validator",
      "506-onchain-cash-leg-finality-checker",
      "510-digital-asset-regulatory-classifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-590-x402-eip712-digest-recomputer",
    "display_name": "x402 EIP-712 Digest Recomputer",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-590-x402-eip712-digest-recomputer.html",
    "description": "Recomputes the EIP-712 typed-data digest for an EIP-3009 TransferWithAuthorization struct (the x402 payments rail's underlying authorization",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-591-x402-signer-recovery-verifier",
    "display_name": "x402 Signer Recovery Verifier",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-591-x402-signer-recovery-verifier.html",
    "description": "Recovers the ECDSA signer address from a caller-supplied EIP-712 digest (the sibling art-590-x402-eip712-digest-recomputer's output) and a s",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-592-x402-domain-nonce-window-checker",
    "display_name": "x402 Domain & Nonce Window Checker",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-592-x402-domain-nonce-window-checker.html",
    "description": "Checks an EIP-3009 TransferWithAuthorization's domain separation and replay-defense-adjacent fields against caller-supplied expectations. Ta",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-593-webbotauth-nonce-replay-check",
    "display_name": "Web Bot Auth Nonce & Replay-Window Checker",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-593-webbotauth-nonce-replay-check.html",
    "description": "Checks a Visa TAP-shaped nonce for format (minimum entropy, base64url), freshness against a caller-supplied now_unix (created/expires spread",
    "consumes": [],
    "feeds": [
      "art-130-signature-directory-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-594-tempo-mpp-voucher-receipt-verifier",
    "display_name": "Tempo MPP Voucher & Receipt Verifier",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-594-tempo-mpp-voucher-receipt-verifier.html",
    "description": "Verifies a Tempo Machine Payments Protocol cumulative EIP-712 session voucher offline (ecrecover, no RPC or database lookup), validates a TI",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-595-ap2-cartmandate-hashchain-builder",
    "display_name": "AP2 CartMandate Hash-Chain Builder",
    "mandate_type": "payment_policy",
    "url": "https://ainumbers.co/chaingraph/art-595-ap2-cartmandate-hashchain-builder.html",
    "description": "Builds an illustrative Google AP2 CartMandate Verifiable Digital Credential (VDC) skeleton whose credentialSubject carries a deterministic h",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-597-c2pa-aiml-assertion-decoder",
    "display_name": "C2PA AI/ML Assertion Decoder",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-597-c2pa-aiml-assertion-decoder.html",
    "description": "Decodes AI/ML provenance assertions off a C2PA manifest's assertion array: ALL entries in every c2pa.actions/c2pa.actions.v2 assertion (a ma",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-598-input-attestation-verifier",
    "display_name": "Input Attestation Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-598-input-attestation-verifier.html",
    "description": "Verify SPEC.md §23 input_attestations entries -- vc-2.0, c2pa-manifest, rfc3161-snapshot, zktls -- against a target artifact's policy_parame",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-599-gleif-snapshot-digest",
    "display_name": "GLEIF Snapshot Digest",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/art-599-gleif-snapshot-digest.html",
    "description": "Hash-pins a pasted GLEIF Golden Copy record or file segment as of a caller-stated capture time, so a later reader can tell whether the entit",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-60-agent-economy-runtime-fit-diagnostic",
    "display_name": "Agent Economy Runtime Fit Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-60-agent-economy-runtime-fit-diagnostic.html",
    "description": "12-question A-F readiness diagnostic for the agent-economy runtime / post-trade layer (x402 V2 batch settlement, AP2 PaymentReceipt, Human-N",
    "consumes": [],
    "feeds": [
      "art-61-x402-batch-settlement-reconciler",
      "art-62-ap2-payment-receipt-verifier",
      "art-63-agent-service-metering-modeler",
      "art-02-agent-spend-policy-simulator",
      "mms-03-app-fraud-graph",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-600-lei-relationship-consistency",
    "display_name": "LEI Relationship Consistency Checker",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-600-lei-relationship-consistency.html",
    "description": "Checks four structural invariants over a pasted set of GLEIF Level-2 relationship records for one subject LEI: every startNode and endNode i",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-602-mica-register-presence-check",
    "display_name": "MiCA Register Presence Check",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-602-mica-register-presence-check.html",
    "description": "Answers one question about a pasted extract of an ESMA MiCA public register: was a named entity present in that snapshot on the date the rea",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-603-stablecoin-reserve-3source-recompute",
    "display_name": "Stablecoin Reserve 3-Source Recompute",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-603-stablecoin-reserve-3source-recompute.html",
    "description": "Recomputes reserve ratio, weighted-average maturity (WAM), and per-holding GENIUS eligible-asset match from three independently-sourced, cal",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-604-erc8004-registry-entry-verifier",
    "display_name": "ERC-8004 Registry Entry Verifier",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-604-erc8004-registry-entry-verifier.html",
    "description": "Checks whether a caller-supplied claimed ERC-8004 agent registry entry (Identity, Reputation, or Validation registry) and a caller-supplied ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-605-merkle-airdrop-proof-verifier",
    "display_name": "Merkle Airdrop-Proof Verifier",
    "mandate_type": "payment_policy",
    "url": "https://ainumbers.co/chaingraph/art-605-merkle-airdrop-proof-verifier.html",
    "description": "Recomputes a Merkle airdrop-claim proof from caller-declared leaf fields (address, uint256 amount, encoding_variant) and a sibling path, Ope",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-606-erc165-interface-id-verifier",
    "display_name": "ERC-165 Interface ID Verifier",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-606-erc165-interface-id-verifier.html",
    "description": "Recomputes an ERC-165 interfaceId as the XOR of 4-byte function selectors (the first 4 bytes of keccak256 of each canonical Solidity signatu",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-607-erc1967-proxy-slot-classifier",
    "display_name": "ERC-1967 Proxy Slot Classifier",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-607-erc1967-proxy-slot-classifier.html",
    "description": "Recomputes the four canonical EIP-1967 storage slots (bytes32(uint256(keccak256(label)) - 1) for the implementation, admin, beacon, and roll",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-608-erc2981-royalty-calculator",
    "display_name": "ERC-2981 Royalty Calculator",
    "mandate_type": "payment_policy",
    "url": "https://ainumbers.co/chaingraph/art-608-erc2981-royalty-calculator.html",
    "description": "Recomputes an ERC-2981 royalty amount as floor(sale_price * royalty_fraction_bps / 10000) -- the same integer-division convention the OpenZe",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-609-jwks-pinned-directory-check",
    "display_name": "JWKS Pinned-Directory Check",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-609-jwks-pinned-directory-check.html",
    "description": "Confirm a caller-supplied JWKS directory document matches a caller-pinned SHA-256 digest (sha256(canonicalize(directory_jwks)) === pinned_di",
    "consumes": [
      "art-129-webbotauth-signature-verifier"
    ],
    "feeds": [
      "art-130-signature-directory-validator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-61-x402-batch-settlement-reconciler",
    "display_name": "x402 V2 Batch-Settlement Reconciler",
    "mandate_type": "settlement_mandate",
    "url": "https://ainumbers.co/chaingraph/art-61-x402-batch-settlement-reconciler.html",
    "description": "Reconciles an x402 V2 batch settlement (off-chain payment vouchers vs onchain batch total), verifying recon verdict, per-voucher amounts, se",
    "consumes": [
      "art-60-agent-economy-runtime-fit-diagnostic"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-610-erc4626-vault-share-math",
    "display_name": "ERC-4626 Vault Share Math",
    "mandate_type": "payment_policy",
    "url": "https://ainumbers.co/chaingraph/art-610-erc4626-vault-share-math.html",
    "description": "Recomputes ERC-4626 tokenized-vault share and asset conversions from caller-declared vault state (total_assets, total_supply, optional virtu",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-611-erc7540-async-vault-request-accounting",
    "display_name": "ERC-7540 Async-Vault Request Accounting",
    "mandate_type": "payment_policy",
    "url": "https://ainumbers.co/chaingraph/art-611-erc7540-async-vault-request-accounting.html",
    "description": "Recomputes ERC-7540 asynchronous-vault request accounting from caller-declared request state. ERC-7540 (Final, Created 2023-10-18, CC0-1.0) ",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-613-erc4337-userop-math",
    "display_name": "ERC-4337 UserOperation Math",
    "mandate_type": "payment_policy",
    "url": "https://ainumbers.co/chaingraph/art-613-erc4337-userop-math.html",
    "description": "Recomputes the ERC-4337 account-abstraction userOpHash from a caller-supplied UserOperation, computes the EntryPoint's required prefund from",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-614-eip7702-authorization-tuple-decoder",
    "display_name": "EIP-7702 Authorization-Tuple Decoder",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-614-eip7702-authorization-tuple-decoder.html",
    "description": "Recomputes the EIP-7702 authorization-tuple hash (keccak256(0x05 || rlp([chain_id, address, nonce])), the 'Set EOA account code' standard li",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-615-mla-charge-inclusion-classifier",
    "display_name": "MLA Charge-Inclusion Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-615-mla-charge-inclusion-classifier.html",
    "description": "Closed-set lookup of whether a charge type must be included in the Military Lending Act MAPR under 32 CFR 232.4(c) and 232.4(d), returning i",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-616-mla-mapr-actuarial-recompute",
    "display_name": "MLA MAPR Actuarial Recompute",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-616-mla-mapr-actuarial-recompute.html",
    "description": "Recomputes a Military Lending Act MAPR for closed-end credit by the Regulation Z actuarial method, from caller-supplied cash flows and charg",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-618-naic-clo-rbc-factor-calculator",
    "display_name": "NAIC CLO/CBO/CDO Tranche RBC Factor Calculator",
    "mandate_type": "compliance_control",
    "url": "https://ainumbers.co/chaingraph/art-618-naic-clo-rbc-factor-calculator.html",
    "description": "Recomputes the NAIC Life RBC per-tranche capital charge for CLO/CBO/CDO bond tranches against the LR002 Column (2) factor grid adopted by th",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-619-ccd2-aprc-annex3-recompute",
    "display_name": "CCD2 Annex III APRC Recompute",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-619-ccd2-aprc-annex3-recompute.html",
    "description": "Recomputes the EU Directive (EU) 2023/2225 (CCD2) annual percentage rate of charge (APRC) from a caller-supplied drawdown/repayment schedule",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-62-ap2-payment-receipt-verifier",
    "display_name": "AP2 PaymentReceipt Verifier & HNP Guardrail",
    "mandate_type": "attestation_mandate",
    "url": "https://ainumbers.co/chaingraph/art-62-ap2-payment-receipt-verifier.html",
    "description": "Verifies an AP2 v0.2 PaymentReceipt against its signed Intent/Cart/Payment mandate chain, and applies the Human-Not-Present (HNP) autonomy g",
    "consumes": [
      "art-60-agent-economy-runtime-fit-diagnostic"
    ],
    "feeds": [
      "art-01-ap2-mandate-chain-validator",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-620-summa-mst-inclusion-checker",
    "display_name": "Summa MST Inclusion Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-620-summa-mst-inclusion-checker.html",
    "description": "Paste a published Merkle-sum-tree root (hash + sum) and an inclusion proof for one leaf; verifies membership AND local balance-sum-chain con",
    "consumes": [],
    "feeds": [],
    "status": "live"
  },
  {
    "tool_id": "art-63-agent-service-metering-modeler",
    "display_name": "Agent-Service Metering & Marketplace Economics Modeler",
    "mandate_type": "payment_policy",
    "url": "https://ainumbers.co/chaingraph/art-63-agent-service-metering-modeler.html",
    "description": "Educational unit-economics modeler for agent-service micropayment marketplaces: per-call pricing, x402 V2 batch-settlement savings, marketpl",
    "consumes": [
      "art-60-agent-economy-runtime-fit-diagnostic"
    ],
    "feeds": [
      "art-03-x402-settlement-modeler",
      "ml-03-timeseries-anomaly-detector"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-64-ai-act-highrisk-fit-diagnostic",
    "display_name": "EU AI Act High-Risk Fit & Classification Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-64-ai-act-highrisk-fit-diagnostic.html",
    "description": "12-question A-F diagnostic that screens in-force obligations first (Art 5 prohibited practices, Art 4 AI literacy, GPAI) then classifies fin",
    "consumes": [],
    "feeds": [
      "art-65-ai-conformity-pack-builder",
      "art-66-fria-postmarket-monitoring-builder",
      "art-67-agentic-ai-risk-classifier",
      "art-05-eu-ai-act-credit-scoring-conformity",
      "452-fair-lending-ai-bias-assessment",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-65-ai-conformity-pack-builder",
    "display_name": "AI Act Conformity Pack Builder",
    "mandate_type": "model_governance",
    "url": "https://ainumbers.co/chaingraph/art-65-ai-conformity-pack-builder.html",
    "description": "Assembles an EU AI Act Annex IV technical documentation pack, validates the conformity-assessment route (internal control vs notified body),",
    "consumes": [
      "art-64-ai-act-highrisk-fit-diagnostic"
    ],
    "feeds": [
      "333-eu-ai-act-article9-risk-mgmt-builder",
      "art-05-eu-ai-act-credit-scoring-conformity",
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-66-fria-postmarket-monitoring-builder",
    "display_name": "FRIA & Post-Market Monitoring Plan Builder",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-66-fria-postmarket-monitoring-builder.html",
    "description": "Builds an Art 27 Fundamental Rights Impact Assessment (FRIA) + Art 72 post-market monitoring plan + Art 12 logging + Art 14 human-oversight ",
    "consumes": [
      "art-64-ai-act-highrisk-fit-diagnostic"
    ],
    "feeds": [
      "451-sr11-7-model-risk-management-gap-assessor",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-67-agentic-ai-risk-classifier",
    "display_name": "Agentic AI Risk & GPAI Governance Classifier",
    "mandate_type": "model_governance",
    "url": "https://ainumbers.co/chaingraph/art-67-agentic-ai-risk-classifier.html",
    "description": "Co-flagship and strongest in-force anchor: classifies autonomy tier and GPAI/systemic-risk obligations (Arts 53-55, IN FORCE since 2 Aug 202",
    "consumes": [
      "art-64-ai-act-highrisk-fit-diagnostic"
    ],
    "feeds": [
      "art-04-agent-identity-attestation-checker",
      "art-33-mcp-server-self-attestation-pack",
      "art-62-ap2-payment-receipt-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-68-carbon-compliance-fit-diagnostic",
    "display_name": "Carbon & Climate Compliance Fit Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-68-carbon-compliance-fit-diagnostic.html",
    "description": "12-question A-F diagnostic that classifies which carbon/climate obligations bind a firm (CBAM authorised-declarant duty, EU Taxonomy alignme",
    "consumes": [],
    "feeds": [
      "art-69-cbam-embedded-emissions-calculator",
      "art-72-cbam-precursor-emissions-aggregator",
      "art-73-taxonomy-alignment-scorer",
      "art-75-eugb-factsheet-validator",
      "art-76-climate-scenario-applicator",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-69-cbam-embedded-emissions-calculator",
    "display_name": "CBAM Embedded-Emissions Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-69-cbam-embedded-emissions-calculator.html",
    "description": "Flagship importer tool. Computes embedded emissions (direct + indirect, tCO2e) for a consignment of CBAM goods from actual installation data",
    "consumes": [
      "art-68-carbon-compliance-fit-diagnostic",
      "art-70-cbam-default-value-resolver",
      "art-72-cbam-precursor-emissions-aggregator"
    ],
    "feeds": [
      "art-71-cbam-certificate-cost-engine",
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-70-cbam-default-value-resolver",
    "display_name": "CBAM Default-Value Resolver",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-70-cbam-default-value-resolver.html",
    "description": "Resolves the Commission default embedded-emissions value for a (CN code x country-of-origin) pair, applies the year-dependent markup vs the ",
    "consumes": [
      "art-68-carbon-compliance-fit-diagnostic"
    ],
    "feeds": [
      "art-69-cbam-embedded-emissions-calculator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-71-cbam-certificate-cost-engine",
    "display_name": "CBAM Certificate Cost & Free-Allocation Engine",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-71-cbam-certificate-cost-engine.html",
    "description": "Converts embedded emissions into a CBAM certificate liability: applies the CBAM factor (free-allocation phase-out 2.5% 2026 to 100% 2034), d",
    "consumes": [
      "art-69-cbam-embedded-emissions-calculator"
    ],
    "feeds": [
      "cry-05-agent-action-audit-trail-aggregator",
      "art-76-climate-scenario-applicator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-72-cbam-precursor-emissions-aggregator",
    "display_name": "CBAM Precursor-Emissions Aggregator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-72-cbam-precursor-emissions-aggregator.html",
    "description": "Rolls up embedded emissions across precursors in a steel/aluminium value chain (incl. the 2028 pre-consumer-scrap rule) so a producer can su",
    "consumes": [
      "art-68-carbon-compliance-fit-diagnostic"
    ],
    "feeds": [
      "art-69-cbam-embedded-emissions-calculator",
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-73-taxonomy-alignment-scorer",
    "display_name": "EU Taxonomy Alignment Scorer",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-73-taxonomy-alignment-scorer.html",
    "description": "Scores an economic activity against an environmental objective: substantial-contribution technical-screening criteria + DNSH across the othe",
    "consumes": [
      "art-68-carbon-compliance-fit-diagnostic"
    ],
    "feeds": [
      "art-74-taxonomy-kpi-gar-aggregator",
      "art-75-eugb-factsheet-validator",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-74-taxonomy-kpi-gar-aggregator",
    "display_name": "Taxonomy KPI & Green Asset Ratio Aggregator",
    "mandate_type": "model_governance",
    "url": "https://ainumbers.co/chaingraph/art-74-taxonomy-kpi-gar-aggregator.html",
    "description": "Rolls activity-level Taxonomy alignment (from ART-73) into entity KPIs: revenue/CapEx/OpEx aligned proportions and, for financial undertakin",
    "consumes": [
      "art-73-taxonomy-alignment-scorer"
    ],
    "feeds": [
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-75-eugb-factsheet-validator",
    "display_name": "EU Green Bond Factsheet & Allocation Validator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-75-eugb-factsheet-validator.html",
    "description": "Validates an EuGB factsheet (Annex I) + allocation report (Annex II) for completeness and the 100% Taxonomy-aligned proceeds threshold, cros",
    "consumes": [
      "art-68-carbon-compliance-fit-diagnostic",
      "art-73-taxonomy-alignment-scorer"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-76-climate-scenario-applicator",
    "display_name": "Climate Scenario Applicator (NGFS / Fit-for-55)",
    "mandate_type": "model_governance",
    "url": "https://ainumbers.co/chaingraph/art-76-climate-scenario-applicator.html",
    "description": "Applies a climate scenario path (NGFS Phase V orderly/disorderly/hot-house, Fit-for-55 supervisory; reference_version NGFS-Phase-V-2025) to ",
    "consumes": [
      "art-68-carbon-compliance-fit-diagnostic",
      "art-71-cbam-certificate-cost-engine"
    ],
    "feeds": [
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-77-t1-settlement-readiness-diagnostic",
    "display_name": "T+1 Settlement Readiness Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-77-t1-settlement-readiness-diagnostic.html",
    "description": "12-question A-F diagnostic scoring a firm's readiness for the coordinated EU/UK/CH T+1 move (11 Oct 2027) against the Industry Roadmap phase",
    "consumes": [],
    "feeds": [
      "art-78-csdr-penalty-calculator",
      "art-79-settlement-fail-predictor",
      "art-80-ssi-conformance-checker",
      "art-81-allocation-affirmation-conformance",
      "art-82-securities-settlement-message-linter",
      "art-83-buy-in-exposure-modeler",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-78-csdr-penalty-calculator",
    "display_name": "CSDR Cash-Penalty Calculator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-78-csdr-penalty-calculator.html",
    "description": "Flagship. Computes the CSDR cash penalty for a settlement fail: selects the asset-class daily rate (incl. Oct-2025 RTS increases: equities 1",
    "consumes": [
      "art-77-t1-settlement-readiness-diagnostic"
    ],
    "feeds": [
      "art-83-buy-in-exposure-modeler",
      "art-84-settlement-efficiency-kpi",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-79-settlement-fail-predictor",
    "display_name": "Settlement-Fail Predictor",
    "mandate_type": "model_governance",
    "url": "https://ainumbers.co/chaingraph/art-79-settlement-fail-predictor.html",
    "description": "Scores a trade's fail probability from anonymized configuration features (SSI match status, instrument liquidity tier, counterparty fail-his",
    "consumes": [
      "art-77-t1-settlement-readiness-diagnostic",
      "art-80-ssi-conformance-checker"
    ],
    "feeds": [
      "art-84-settlement-efficiency-kpi",
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-80-ssi-conformance-checker",
    "display_name": "SSI Conformance Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-80-ssi-conformance-checker.html",
    "description": "Lints standing settlement instructions for completeness, staleness, and format (~30%-of-fails root cause). BIC validated per ISO 9362. Stale",
    "consumes": [
      "art-77-t1-settlement-readiness-diagnostic"
    ],
    "feeds": [
      "art-79-settlement-fail-predictor",
      "art-84-settlement-efficiency-kpi"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-81-allocation-affirmation-conformance",
    "display_name": "Allocation/Affirmation Conformance Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-81-allocation-affirmation-conformance.html",
    "description": "Checks allocation and confirmation/affirmation events against the ESMA CSDR SDR RTS 23:00 CET trade-date rule and the machine-readable-forma",
    "consumes": [
      "art-77-t1-settlement-readiness-diagnostic"
    ],
    "feeds": [
      "art-82-securities-settlement-message-linter",
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-82-securities-settlement-message-linter",
    "display_name": "Securities-Settlement Message Linter (ISO 20022 sese/semt)",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-82-securities-settlement-message-linter.html",
    "description": "Validates ISO 20022 securities-settlement messages (sese.023 instruction, sese.024 status advice, semt.044 account statement) for schema con",
    "consumes": [
      "art-81-allocation-affirmation-conformance"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-83-buy-in-exposure-modeler",
    "display_name": "Buy-In Exposure Modeler",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-83-buy-in-exposure-modeler.html",
    "description": "Models CSDR Refit last-resort mandatory buy-in exposure: eligible trigger date per asset class, extension period (liquid equity ~7 cal days,",
    "consumes": [
      "art-78-csdr-penalty-calculator"
    ],
    "feeds": [
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-84-settlement-efficiency-kpi",
    "display_name": "Settlement Efficiency KPI Engine",
    "mandate_type": "model_governance",
    "url": "https://ainumbers.co/chaingraph/art-84-settlement-efficiency-kpi.html",
    "description": "Aggregates batch settlement data into CSDR/T+1-relevant KPIs: settlement rate, fail rate, total CSDR penalty cost, on-time allocation rate, ",
    "consumes": [
      "art-78-csdr-penalty-calculator",
      "art-80-ssi-conformance-checker",
      "art-79-settlement-fail-predictor"
    ],
    "feeds": [
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-85-pqc-timeline-fit-diagnostic",
    "display_name": "PQC Timeline & Migration Fit Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-85-pqc-timeline-fit-diagnostic.html",
    "description": "12-dimension A-F diagnostic mapping an organisation's cryptographic estate and sector to the CNSA 2.0 / EU-2030 / G7 / DORA post-quantum mil",
    "consumes": [],
    "feeds": [
      "art-86-tls-pki-migration-planner",
      "art-87-iso20022-pqc-readiness-checker",
      "art-88-fido-pqc-conformance-checker",
      "art-89-blockchain-quantum-risk-classifier",
      "499-crypto-asset-inventory-classifier",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-86-tls-pki-migration-planner",
    "display_name": "TLS / X.509 PKI Migration Planner",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-86-tls-pki-migration-planner.html",
    "description": "Sequences TLS and X.509 PKI migration from RSA/ECDSA to post-quantum algorithms (ML-KEM/ML-DSA per NIST FIPS 203/204 Aug 2024). Builds a pha",
    "consumes": [
      "art-85-pqc-timeline-fit-diagnostic",
      "499-crypto-asset-inventory-classifier"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-87-iso20022-pqc-readiness-checker",
    "display_name": "SWIFT / ISO 20022 PQC Readiness Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-87-iso20022-pqc-readiness-checker.html",
    "description": "Scores SWIFT/ISO 20022 PQC readiness with BAH signature-bloat sizing per the BIS Project Leap Phase 2 model (ML-DSA ~12.9x RSA payload at BA",
    "consumes": [
      "art-85-pqc-timeline-fit-diagnostic",
      "500-hndl-quantum-risk-scorer"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-88-fido-pqc-conformance-checker",
    "display_name": "FIDO2 / WebAuthn PQC Conformance Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-88-fido-pqc-conformance-checker.html",
    "description": "Validates FIDO2/WebAuthn authenticator ML-DSA conformance vs IANA COSE algorithm registry identifiers and CTAP2.3 minimum version. Checks CO",
    "consumes": [
      "art-85-pqc-timeline-fit-diagnostic"
    ],
    "feeds": [
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-89-blockchain-quantum-risk-classifier",
    "display_name": "Blockchain / Stablecoin Quantum-Risk Classifier",
    "mandate_type": "model_governance",
    "url": "https://ainumbers.co/chaingraph/art-89-blockchain-quantum-risk-classifier.html",
    "description": "Classifies quantum-exposure risk for blockchain/stablecoin assets: exposed public-key percentage, address reuse, and migration-path maturity",
    "consumes": [
      "art-85-pqc-timeline-fit-diagnostic",
      "499-crypto-asset-inventory-classifier"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-90-sanctions-screening-fit-diagnostic",
    "display_name": "Sanctions & Export-Control Screening Fit Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-90-sanctions-screening-fit-diagnostic.html",
    "description": "12-param A-F diagnostic scoping a firm's sanctions/export-control screening program (50%-rule ownership, list coverage, fuzzy-match calibrat",
    "consumes": [],
    "feeds": [
      "art-91-ownership-50pct-aggregator",
      "art-92-screening-list-coverage-checker",
      "art-93-fuzzy-match-calibration-scorer",
      "art-94-eccn-dual-use-classifier",
      "art-95-circumvention-diligence-assessor",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-91-ownership-50pct-aggregator",
    "display_name": "Ownership 50%-Rule Aggregator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-91-ownership-50pct-aggregator.html",
    "description": "Walks a synthetic ownership graph; computes direct + indirect + aggregate listed stakes per node; applies OFAC, EU, and BIS Affiliates Rule ",
    "consumes": [
      "art-90-sanctions-screening-fit-diagnostic"
    ],
    "feeds": [
      "art-92-screening-list-coverage-checker",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-92-screening-list-coverage-checker",
    "display_name": "Screening List-Coverage Checker",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-92-screening-list-coverage-checker.html",
    "description": "Conformance check: validates a screening config against the required-coverage matrix for EU consolidated + UN + UK Sanctions List (post-OFSI",
    "consumes": [
      "art-90-sanctions-screening-fit-diagnostic",
      "art-91-ownership-50pct-aggregator"
    ],
    "feeds": [
      "art-97-sanctions-screening-quality-scorer",
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-93-fuzzy-match-calibration-scorer",
    "display_name": "Fuzzy-Match Calibration Scorer",
    "mandate_type": "model_governance",
    "url": "https://ainumbers.co/chaingraph/art-93-fuzzy-match-calibration-scorer.html",
    "description": "Given a config (algorithm, threshold) and a synthetic labelled name-pair set, computes FPR/recall/F1, scores threshold quality, and recommen",
    "consumes": [
      "art-90-sanctions-screening-fit-diagnostic"
    ],
    "feeds": [
      "art-97-sanctions-screening-quality-scorer",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-94-eccn-dual-use-classifier",
    "display_name": "ECCN / Dual-Use Classifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-94-eccn-dual-use-classifier.html",
    "description": "Decision-tree from product attributes to ECCN (EAR) + EU Annex I category + controlling regime (Wassenaar/MTCR/AG/NSG) + licence-requirement",
    "consumes": [
      "art-90-sanctions-screening-fit-diagnostic"
    ],
    "feeds": [
      "art-95-circumvention-diligence-assessor",
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-95-circumvention-diligence-assessor",
    "display_name": "Circumvention Diligence Assessor",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-95-circumvention-diligence-assessor.html",
    "description": "Scores a transaction/contract config vs the EU 20th-package (23 Apr 2026) no-Russia clause + anti-circumvention due-diligence, emitting a li",
    "consumes": [
      "art-94-eccn-dual-use-classifier"
    ],
    "feeds": [
      "art-96-no-russia-clause-pack-builder",
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-96-no-russia-clause-pack-builder",
    "display_name": "No-Russia-Clause Pack Builder",
    "mandate_type": "disclosure_template",
    "url": "https://ainumbers.co/chaingraph/art-96-no-russia-clause-pack-builder.html",
    "description": "Generates the contractual no-Russia clause + DD-evidence checklist conformance artifact for the EU 20th-package seller-liability-shift safe ",
    "consumes": [
      "art-95-circumvention-diligence-assessor"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-97-sanctions-screening-quality-scorer",
    "display_name": "Sanctions Screening-Program Quality Scorer",
    "mandate_type": "model_governance",
    "url": "https://ainumbers.co/chaingraph/art-97-sanctions-screening-quality-scorer.html",
    "description": "Wolfsberg-aligned screening-program quality scorecard: list coverage + match calibration + alert tuning + escalation workflow + model valida",
    "consumes": [
      "art-92-screening-list-coverage-checker",
      "art-93-fuzzy-match-calibration-scorer"
    ],
    "feeds": [
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-98-mica-casp-fit-diagnostic",
    "display_name": "MiCA CASP Fit Diagnostic",
    "mandate_type": "agent_guardrail_mandate",
    "url": "https://ainumbers.co/chaingraph/art-98-mica-casp-fit-diagnostic.html",
    "description": "12-question A-F diagnostic scoping a crypto-asset service provider's MiCA Title-V lifecycle readiness (authorization, Art 67 own-funds, whit",
    "consumes": [],
    "feeds": [
      "art-99-mica-transitional-deadline-router",
      "art-100-mica-casp-authorization-readiness",
      "art-102-crypto-asset-whitepaper-linter",
      "art-103-mar-crypto-surveillance-readiness",
      "art-104-tfr-travel-rule-batch-validator",
      "art-105-mica-token-service-scoper",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "art-99-mica-transitional-deadline-router",
    "display_name": "MiCA Transitional-Deadline Router",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/art-99-mica-transitional-deadline-router.html",
    "description": "Member-state transitional-deadline routing per Art 143(3) incl. the 30 Jun 2026 cliff (16 EU states). Emits exact end-date, window months, f",
    "consumes": [
      "art-98-mica-casp-fit-diagnostic"
    ],
    "feeds": [
      "art-100-mica-casp-authorization-readiness",
      "cry-05-agent-action-audit-trail-aggregator"
    ],
    "status": "live"
  },
  {
    "tool_id": "cry-01-zk-compliance-proof-generator",
    "display_name": "ZK Compliance Proof Generator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/cry-01-zk-compliance-proof-generator.html",
    "description": "Synthetic ZK compliance proof token for AML/Travel Rule predicates (amount threshold, sanctions clear, KYC complete, velocity normal, source",
    "consumes": [
      "art-10-amla-transaction-typology-risk-scorer"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "cry-04-merkle-batch-verifier",
    "display_name": "Merkle Batch Verifier",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/cry-04-merkle-batch-verifier.html",
    "description": "Batch-verifies Merkle inclusion proofs using SHA-256 over payment batches, settlement message sets, and ISO 20022 sets. Zero-egress, browser",
    "consumes": [
      "rca-02-mica-reserve-stress",
      "pnr-01-dora-ict-cascade-simulator"
    ],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "cry-05-agent-action-audit-trail-aggregator",
    "display_name": "Agent-Action Audit-Trail Aggregator",
    "mandate_type": "cryptographic_mandate",
    "url": "https://ainumbers.co/chaingraph/cry-05-agent-action-audit-trail-aggregator.html",
    "description": "The regulatory receipt. Aggregates N execution_hashes from an agent session into one SHA-256 Merkle-root session receipt with per-leaf inclu",
    "consumes": [
      "art-30-agent-commerce-conformance-validator",
      "art-31-a2a-x402-extension-mandate-validator",
      "art-33-mcp-server-self-attestation-pack"
    ],
    "feeds": [
      "cry-04-merkle-batch-verifier",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "ml-01-isolation-forest",
    "display_name": "Isolation Forest Transaction Anomaly Detector",
    "mandate_type": "risk_control",
    "url": "https://ainumbers.co/chaingraph/ml-01-isolation-forest.html",
    "description": "Native-JS Isolation Forest anomaly detection on synthetic transaction batches. 10-tree forest, 4-feature scoring (amount, hour, counterparty",
    "consumes": [
      "art-05-eu-ai-act-credit-scoring-conformity",
      "art-10-amla-transaction-typology-risk-scorer"
    ],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "ml-02-credit-default-risk-scorer",
    "display_name": "Credit Default Risk Scorer",
    "mandate_type": "credit_assessment",
    "url": "https://ainumbers.co/chaingraph/ml-02-credit-default-risk-scorer.html",
    "description": "Logistic regression PD scorer on synthetic loan portfolio with Basel 3.1 F-IRB / A-IRB / SA RWA comparison (BCBS d424 formula, Φ⁻¹ Horner ra",
    "consumes": [
      "art-05-eu-ai-act-credit-scoring-conformity"
    ],
    "feeds": [
      "sim-03-basel-rwa-scenario-modeler",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "ml-03-timeseries-anomaly-detector",
    "display_name": "Time-Series Anomaly Detector",
    "mandate_type": "risk_control",
    "url": "https://ainumbers.co/chaingraph/ml-03-timeseries-anomaly-detector.html",
    "description": "Rolling-window z-score and STL-style seasonal decomposition anomaly detection on synthetic payment volume time series. Control chart (UCL/LC",
    "consumes": [
      "sim-03-basel-rwa-scenario-modeler"
    ],
    "feeds": [
      "rca-01-frtb-ima-pre-validator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "mms-03-app-fraud-graph",
    "display_name": "APP Fraud Graph Simulator",
    "mandate_type": "aml_rule",
    "url": "https://ainumbers.co/chaingraph/mms-03-app-fraud-graph.html",
    "description": "Monte Carlo BFS simulation of Authorised Push Payment (APP) fraud propagation across a payment-account graph. UK PSR reimbursement framing. ",
    "consumes": [
      "art-09-dora-incident-classifier",
      "art-10-amla-transaction-typology-risk-scorer"
    ],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "pnr-01-dora-ict-cascade-simulator",
    "display_name": "DORA ICT Cascade Simulator",
    "mandate_type": "infrastructure_mandate",
    "url": "https://ainumbers.co/chaingraph/pnr-01-dora-ict-cascade-simulator.html",
    "description": "Monte Carlo cascade simulation of ICT incident propagation across a financial-institution dependency graph under DORA (EU) 2022/2554. 500 st",
    "consumes": [
      "art-09-dora-incident-classifier"
    ],
    "feeds": [
      "sim-07-open-banking-consent-flow-stress",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "ptg-01-ap2-prompt-template-generator",
    "display_name": "AP2 Prompt Template Generator",
    "mandate_type": "prompt_template",
    "url": "https://ainumbers.co/chaingraph/ptg-01-ap2-prompt-template-generator.html",
    "description": "Transforms any ChainGraph artifact JSON into a structured, regulator-framed prompt for any external LLM. Template registry v1.0.0: one entry",
    "consumes": [],
    "feeds": [
      "ALL"
    ],
    "status": "live"
  },
  {
    "tool_id": "qfa-01-options-greeks",
    "display_name": "Options Greeks Calculator",
    "mandate_type": "risk_parameter",
    "url": "https://ainumbers.co/chaingraph/qfa-01-options-greeks.html",
    "description": "Black-Scholes options pricer with full Greeks (delta, gamma, theta, vega, rho). Equity, FX and rate presets; payoff profile and sensitivity ",
    "consumes": [],
    "feeds": [
      "qfa-04-xva-cva-calculator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "qfa-02-portfolio-var-engine",
    "display_name": "Portfolio Covariance & VaR Engine",
    "mandate_type": "risk_control",
    "url": "https://ainumbers.co/chaingraph/qfa-02-portfolio-var-engine.html",
    "description": "VaR and Expected Shortfall: Historical Simulation, Parametric (variance-covariance), and Monte Carlo with Cholesky 2-factor correlation stru",
    "consumes": [
      "sim-03-basel-rwa-scenario-modeler"
    ],
    "feeds": [
      "qfa-03-stress-test-engine",
      "rca-01-frtb-ima-pre-validator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "qfa-03-stress-test-engine",
    "display_name": "Stress Test Engine",
    "mandate_type": "risk_parameter",
    "url": "https://ainumbers.co/chaingraph/qfa-03-stress-test-engine.html",
    "description": "Multi-scenario stress testing across 6 historical crisis scenarios (GFC 2008, COVID Mar 2020, Dot-com Bust, Lehman Week, Rate Shock 2022, SV",
    "consumes": [
      "qfa-02-portfolio-var-engine"
    ],
    "feeds": [
      "rca-01-frtb-ima-pre-validator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "qfa-04-xva-cva-calculator",
    "display_name": "XVA / CVA Calculator",
    "mandate_type": "risk_parameter",
    "url": "https://ainumbers.co/chaingraph/qfa-04-xva-cva-calculator.html",
    "description": "Monte Carlo XVA/CVA calculator. Simulates expected-exposure profiles for IRS, FX forwards, and CDS; computes CVA, DVA, FVA via discounted ex",
    "consumes": [
      "qfa-01-options-greeks"
    ],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "rca-01-frtb-ima-pre-validator",
    "display_name": "FRTB IMA Expected Shortfall Pre-Validator",
    "mandate_type": "risk_parameter",
    "url": "https://ainumbers.co/chaingraph/rca-01-frtb-ima-pre-validator.html",
    "description": "FRTB IMA Expected Shortfall pre-validation: MC simulation across liquidity horizons LH1–LH5 (10/20/40/60/120 days), NMRF surcharge estimatio",
    "consumes": [
      "qfa-02-portfolio-var-engine",
      "sim-03-basel-rwa-scenario-modeler"
    ],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "rca-02-mica-reserve-stress",
    "display_name": "MiCA Stablecoin Reserve Stress Simulator",
    "mandate_type": "liquidity_mandate",
    "url": "https://ainumbers.co/chaingraph/rca-02-mica-reserve-stress.html",
    "description": "Monte Carlo simulation of stablecoin reserve portfolios under MiCA Article 36 redemption stress and asset price shocks. 1,000 paths × 90-day",
    "consumes": [
      "art-06-genius-act-reserve-attestation",
      "sim-01-lcr-nsfr-liquidity-stress-test"
    ],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator",
      "cry-04-merkle-batch-verifier"
    ],
    "status": "live"
  },
  {
    "tool_id": "rca-03-iso20022-address-migration-verifier",
    "display_name": "ISO 20022 Structured-Address Migration Batch Verifier",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/rca-03-iso20022-address-migration-verifier.html",
    "description": "GPU-parallel validation of PostalAddress24 fields across pacs.008 messages (up to 500k). Country-specific rules (UK postcode, DE Postleitzah",
    "consumes": [],
    "feeds": [
      "art-11-vop-batch-match-rate-analyser",
      "art-08-en16931-einvoice-batch-validator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "sim-01-lcr-nsfr-liquidity-stress-test",
    "display_name": "Liquidity Stress Test Simulator (LCR/NSFR)",
    "mandate_type": "liquidity_mandate",
    "url": "https://ainumbers.co/chaingraph/sim-01-lcr-nsfr-liquidity-stress-test.html",
    "description": "Monte Carlo simulation of LCR and NSFR under Basel III stress (CRR Art. 412/428, EBA GL/2017/01). 1,000 paths × 250 time steps. P5–P95 perce",
    "consumes": [],
    "feeds": [
      "rca-02-mica-reserve-stress",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "sim-03-basel-rwa-scenario-modeler",
    "display_name": "Basel RWA Scenario Modeler",
    "mandate_type": "capital_assessment",
    "url": "https://ainumbers.co/chaingraph/sim-03-basel-rwa-scenario-modeler.html",
    "description": "SA-CR / F-IRB / A-IRB RWA in parallel with output-floor comparison (72.5% §CAP30). BCBS d424 IRB capital formula with Φ⁻¹ rational approxima",
    "consumes": [
      "art-07-basel31-reporting-delta-calculator"
    ],
    "feeds": [
      "ml-03-timeseries-anomaly-detector",
      "qfa-02-portfolio-var-engine",
      "rca-01-frtb-ima-pre-validator",
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  },
  {
    "tool_id": "sim-07-open-banking-consent-flow-stress",
    "display_name": "Open Banking Consent Flow Stress Simulator",
    "mandate_type": "compliance_mandate",
    "url": "https://ainumbers.co/chaingraph/sim-07-open-banking-consent-flow-stress.html",
    "description": "Monte Carlo stress simulation of PSD2/FAPI 2.0/CDR consent lifecycle FSM (INIT→REDIRECT→AUTH→AUTHORIZED→ACTIVE→FAILED/EXPIRED/REVOKED). Conf",
    "consumes": [
      "pnr-01-dora-ict-cascade-simulator"
    ],
    "feeds": [
      "ptg-01-ap2-prompt-template-generator"
    ],
    "status": "live"
  }
];
