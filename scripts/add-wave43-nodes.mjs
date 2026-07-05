// One-shot script: add Wave 43 insurance STP nodes + chains + wave_summary to chaingraph.json
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const cgPath = resolve('chaingraph/chaingraph.json');
const g = JSON.parse(readFileSync(cgPath, 'utf8'));

// Bump version
g.version = '1.53.0';

// 7 new nodes
const newNodes = [
  {
    tool_id: 'art-251-compute-parametric-trigger-payout',
    tool_version: '1.0.0',
    display_name: 'Parametric Trigger Payout Calculator',
    mcp_name: 'compute_parametric_trigger_payout',
    mandate_type: 'compliance_mandate',
    wave: 43,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-251-compute-parametric-trigger-payout.html',
    description: 'Evaluates parametric insurance triggers and computes payout amounts. Supports three trigger types: threshold (binary payout at a threshold index level), tiered (step-based payout tiers), and linear_index (proportional payout between threshold and exhaustion). Produces a tamper-evident trigger receipt suitable for anchoring at anchor.ainumbers.co/mcp as a neutral dispute artifact per IAIS ICP 19. Use in parametric-trigger-adjudication chain (gated) or cat-bond-trigger-validation chain (linear). ZERO PII: index values, thresholds, and coverage amounts only.',
    input_schema_ref: 'chaingraph/art-251-compute-parametric-trigger-payout.html#manifest',
    consumes: [],
    feeds: ['art-252-validate-cat-bond-trigger-terms'],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-05' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
  {
    tool_id: 'art-252-validate-cat-bond-trigger-terms',
    tool_version: '1.0.0',
    display_name: 'Cat Bond Trigger Terms Validator',
    mcp_name: 'validate_cat_bond_trigger_terms',
    mandate_type: 'compliance_mandate',
    wave: 43,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-252-validate-cat-bond-trigger-terms.html',
    description: 'Validates catastrophe bond trigger term structure and computes layer arithmetic: attachment/exhaustion point ordering, pro-rata layer penetration factor, payout amount, and layer position (BELOW_ATTACHMENT / WITHIN_LAYER / ABOVE_EXHAUSTION). Cat bonds outstanding $63.9B Q1 2026 (record $25.6B issuance 2025). Validates ISDA/IAIS trigger term constraints including attachment > 0 and exhaustion > attachment. Use in parametric-trigger-adjudication chain downstream of trigger evaluation, or standalone in cat-bond-trigger-validation chain. ZERO PII.',
    input_schema_ref: 'chaingraph/art-252-validate-cat-bond-trigger-terms.html#manifest',
    consumes: ['art-251-compute-parametric-trigger-payout'],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-05' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
  {
    tool_id: 'art-253-run-illustration-selfsupport-test',
    tool_version: '1.0.0',
    display_name: 'Life Illustration Self-Support Test (NAIC Model 582)',
    mcp_name: 'run_illustration_selfsupport_test',
    mandate_type: 'compliance_mandate',
    wave: 43,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-253-run-illustration-selfsupport-test.html',
    description: 'Runs the NAIC Model Regulation 582 §8C self-support test (year 15 and year 20 account value positive) and §8D lapse-support prohibition check for life insurance illustrations. ASOP 24 compliant. Inputs: projected account values, premium payments, cost of insurance, expense charges, credited interest, and optional lapse rates per policy year. Outputs: self_support_pass (both year-15 and year-20), lapse_support_flag, and illustration_valid. Use in life-illustration-self-support-test linear chain. ZERO PII: projected cash flows and policy mechanics only.',
    input_schema_ref: 'chaingraph/art-253-run-illustration-selfsupport-test.html#manifest',
    consumes: [],
    feeds: ['art-254-compute-rbc-action-level'],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-05' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
  {
    tool_id: 'art-254-compute-rbc-action-level',
    tool_version: '1.0.0',
    display_name: 'NAIC RBC Action Level Calculator',
    mcp_name: 'compute_rbc_action_level',
    mandate_type: 'compliance_mandate',
    wave: 43,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-254-compute-rbc-action-level.html',
    description: 'Computes NAIC Risk-Based Capital (RBC) action level classification for US P&C, life, and health insurers. RBC ratio = TAC / ACL * 100%. Action levels: NO_ACTION (>=200%), COMPANY_ACTION (150-200%), REGULATORY_ACTION (100-150%), AUTHORIZED_CONTROL (70-100%), MANDATORY_CONTROL (<70%). Also runs the NAIC trend test (10+ ppt decline two consecutive years with ratio <250%) when prior-year data supplied. Applies NAIC RBC Model Laws #312 (life), #315 (P&C), #315H (health). Use in insurer-rbc-action-level chain (gated on NO_ACTION). ZERO PII: capital totals only.',
    input_schema_ref: 'chaingraph/art-254-compute-rbc-action-level.html#manifest',
    consumes: ['art-253-run-illustration-selfsupport-test'],
    feeds: ['art-257-calculate-claims-stp-economics'],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-05' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
  {
    tool_id: 'art-255-compute-lcm-rate-derivation',
    tool_version: '1.0.0',
    display_name: 'LCM Rate Derivation Calculator',
    mcp_name: 'compute_lcm_rate_derivation',
    mandate_type: 'analytics_mandate',
    wave: 43,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-255-compute-lcm-rate-derivation.html',
    description: 'Computes the Loss Cost Multiplier (LCM) and indicated insurance rate from user-supplied loss costs and expense/profit loadings. LCM = 1 / (1 - LAE% - fixed_exp% - variable_exp% - profit%). Indicated rate = loss_cost * LCM. Supports credibility-weighted blending of user\'s own loss costs with a complement. PROPRIETARY-DATA: this kernel performs LCM decomposition arithmetic ONLY on user-supplied loss costs -- it NEVER embeds, redistributes, or references ISO/Verisk advisory loss cost rate pages (Verisk-proprietary). ASOP 25 compliant. ZERO PII: aggregate rate components only.',
    input_schema_ref: 'chaingraph/art-255-compute-lcm-rate-derivation.html#manifest',
    consumes: [],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-05' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
  {
    tool_id: 'art-256-validate-openids-homeowners-record',
    tool_version: '1.0.0',
    display_name: 'openIDS Homeowners Record Validator',
    mcp_name: 'validate_openids_homeowners_record',
    mandate_type: 'compliance_mandate',
    wave: 43,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-256-validate-openids-homeowners-record.html',
    description: 'Validates homeowners insurance data records against the openIDS Homeowners Data Standard v1.0 (AAIS / Linux Foundation, November 2025) -- the first free open (Apache-2.0) insurance data standard. Checks required sections (policy, insured_location, coverage, premium), required fields per section, policy type (HO-1..HO-8, DP-1..DP-3), date ordering, payment plan, construction type, coverage limit positivity, and PII field detection. NOT an ACORD validator -- ACORD XML/AL3 is membership-licensed and is not referenced or reproduced here. ZERO PII: structural/field validation only.',
    input_schema_ref: 'chaingraph/art-256-validate-openids-homeowners-record.html#manifest',
    consumes: [],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-05' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
  {
    tool_id: 'art-257-calculate-claims-stp-economics',
    tool_version: '1.0.0',
    display_name: 'Claims STP Economics Calculator',
    mcp_name: 'calculate_claims_stp_economics',
    mandate_type: 'analytics_mandate',
    wave: 43,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-257-calculate-claims-stp-economics.html',
    description: 'Computes the financial business case for insurance claims Straight-Through Processing (STP) automation. Models handling cost reduction from current to target STP rates, leakage delta (change in claim payment leakage from automated vs manual handling), net annual benefit, NPV over a configurable projection horizon, IRR, and per-claim cost reduction. Covers industry benchmarks from McKinsey Insurance 2024, Accenture Claims Transformation 2025, and Majesco Claims Technology Survey 2024. Use in insurer-rbc-action-level chain (downstream when capital below 200% ACL triggers corrective action). ZERO PII: aggregate portfolio metrics only.',
    input_schema_ref: 'chaingraph/art-257-calculate-claims-stp-economics.html#manifest',
    consumes: ['art-254-compute-rbc-action-level'],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      { system: 'sha256-source', image_id: 'sha256:PLACEHOLDER', valid_from: '2026-07-05' },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
];

// Append nodes
g.nodes.push(...newNodes);

// 4 new chains
const newChains = [
  {
    name: 'parametric-trigger-adjudication',
    title: 'Parametric Trigger Adjudication',
    spec_version: '0.8.0',
    wave: 43,
    description: 'Gated two-step chain for parametric insurance trigger adjudication and cat bond term validation. Step 1 evaluates the parametric trigger (threshold / tiered / linear_index) and emits trigger_hit and payout_amount. Gate on /trigger_hit: if false (trigger not fired), the chain ends -- no payout, no bond validation needed. If true (default), Step 2 validates the cat bond trigger terms (attachment/exhaustion ordering, pro-rata arithmetic, layer position). Outputs a tamper-evident trigger receipt anchored at anchor.ainumbers.co/mcp for neutral dispute adjudication per IAIS ICP 19. ZERO PII BY CONSTRUCTION.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/parametric-trigger-adjudication.html',
    regulatory_refs: [
      'ISO 11116:2023 (parametric insurance trigger methodology)',
      'ISDA/IAIS cat bond trigger definitions',
      'Swiss Re sigma 1/2024 (cat bond trigger types)',
      'IAIS ICP 19 (claims handling, neutral adjudication)',
      'NAIC catastrophe bond guidelines',
    ],
    steps: [
      {
        tool_id: 'art-251-compute-parametric-trigger-payout',
        handoff: 'Trigger evaluation result including trigger_hit boolean, payout_amount, trigger_fraction, and trigger_receipt. Gate on /trigger_hit: false exits -- no payout triggered. Default (true): proceed to cat bond term validation.',
        gate: {
          input: '/trigger_hit',
          rules: [{ op: 'eq', value: false, next: 'end' }],
          default: 'art-252-validate-cat-bond-trigger-terms',
        },
      },
      {
        tool_id: 'art-252-validate-cat-bond-trigger-terms',
        handoff: 'Cat bond layer position (BELOW_ATTACHMENT / WITHIN_LAYER / ABOVE_EXHAUSTION), pro-rata factor, and payout_amount. Final stage -- anchor both execution_hashes for a two-node trigger receipt.',
      },
    ],
  },
  {
    name: 'insurer-rbc-action-level',
    title: 'Insurer RBC Action Level Assessment',
    spec_version: '0.8.0',
    wave: 43,
    description: 'Gated two-step chain for NAIC RBC capital adequacy assessment and claims STP economics. Step 1 computes the RBC action level (TAC/ACL ratio) and classifies into NO_ACTION / COMPANY_ACTION / REGULATORY_ACTION / AUTHORIZED_CONTROL / MANDATORY_CONTROL per NAIC Model Laws #312/#315/#315H. Gate on /action_level_code: if NO_ACTION (above 200% ACL), the chain ends -- insurer is well-capitalised and no corrective action is required. Default (below 200% ACL): Step 2 computes claims STP economics to model the financial impact of automation investment as a capital restoration pathway. ZERO PII BY CONSTRUCTION.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/insurer-rbc-action-level.html',
    regulatory_refs: [
      'NAIC RBC Model Law #312 (Life Insurance RBC)',
      'NAIC RBC Model Law #315 (P&C RBC)',
      'NAIC RBC Model Law #315H (Health RBC)',
      'NAIC RBC Instructions 2024 edition (LR023, Exhibit 1, HR-1)',
      'IAIS ComFrame (proportionality in claims governance)',
    ],
    steps: [
      {
        tool_id: 'art-254-compute-rbc-action-level',
        handoff: 'RBC ratio (TAC/ACL%), action_level_code, and headroom_to_next_level_pct. Gate on /action_level_code: NO_ACTION exits (well-capitalised). Default (below 200% ACL): proceed to claims STP economics model.',
        gate: {
          input: '/action_level_code',
          rules: [{ op: 'eq', value: 'NO_ACTION', next: 'end' }],
          default: 'art-257-calculate-claims-stp-economics',
        },
      },
      {
        tool_id: 'art-257-calculate-claims-stp-economics',
        handoff: 'Claims STP ROI: NPV, IRR, payback_years, net_annual_benefit, and per-claim cost reduction. Final stage -- models automation investment as capital improvement lever.',
      },
    ],
  },
  {
    name: 'cat-bond-trigger-validation',
    title: 'Cat Bond Trigger Validation',
    spec_version: '0.8.0',
    wave: 43,
    description: 'Linear two-step chain for cat bond due diligence: validate trigger terms before running the trigger evaluation. Step 1 validates the attachment/exhaustion point structure and pro-rata arithmetic (cat bond terms). Step 2 evaluates the parametric trigger against the validated structure and computes payout. Designed for pre-issuance term review and post-event payout calculation where bond terms must be validated first. ZERO PII BY CONSTRUCTION.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/cat-bond-trigger-validation.html',
    regulatory_refs: [
      'ISDA/IAIS cat bond trigger definitions',
      'Swiss Re sigma 1/2024 (cat bond market data)',
      'NAIC catastrophe bond guidelines',
      'IAIS ICP 13 (reinsurance principles)',
    ],
    steps: [
      {
        tool_id: 'art-252-validate-cat-bond-trigger-terms',
        handoff: 'Validated layer structure: attachment/exhaustion ordering, layer_width, terms_valid. Passes to trigger evaluation.',
      },
      {
        tool_id: 'art-251-compute-parametric-trigger-payout',
        handoff: 'Trigger evaluation: trigger_hit, payout_amount, trigger_fraction, trigger_receipt. Final stage.',
      },
    ],
  },
  {
    name: 'life-illustration-self-support-test',
    title: 'Life Illustration Self-Support Test',
    spec_version: '0.8.0',
    wave: 43,
    description: 'Linear two-step chain for life insurance illustration compliance and insurer capital review. Step 1 runs the NAIC Model 582 §8C self-support test (year 15 and year 20) and §8D lapse-support check per ASOP 24 -- certifies the illustration is not lapse-supported and maintains a non-negative account value. Step 2 computes the RBC action level for the issuing insurer to confirm adequate capital supports the product offering. ZERO PII BY CONSTRUCTION.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/life-illustration-self-support-test.html',
    regulatory_refs: [
      'NAIC Model Regulation 582 §8C (Life Insurance Self-Support Test)',
      'NAIC Model Regulation 582 §8D (Lapse-Support Prohibition)',
      'ASOP 24 (Actuarial Standard of Practice for Illustrations)',
      'NAIC RBC Model Laws #312/#315/#315H',
    ],
    steps: [
      {
        tool_id: 'art-253-run-illustration-selfsupport-test',
        handoff: 'Illustration validity: self_support_pass (yr15+yr20), lapse_support_flag, and issues list. Passes to RBC capital review.',
      },
      {
        tool_id: 'art-254-compute-rbc-action-level',
        handoff: 'RBC action level classification (NO_ACTION / COMPANY_ACTION / REGULATORY_ACTION / AUTHORIZED_CONTROL / MANDATORY_CONTROL). Final stage.',
      },
    ],
  },
];

// Append chains
g.chains.push(...newChains);

// wave_summary
if (!g.wave_summary) g.wave_summary = {};
g.wave_summary['wave_43'] = {
  name: 'Insurance Underwriting and Claims STP',
  shipped: '2026-07-05',
  nodes_live: 7,
  live: [
    'art-251-compute-parametric-trigger-payout',
    'art-252-validate-cat-bond-trigger-terms',
    'art-253-run-illustration-selfsupport-test',
    'art-254-compute-rbc-action-level',
    'art-255-compute-lcm-rate-derivation',
    'art-256-validate-openids-homeowners-record',
    'art-257-calculate-claims-stp-economics',
  ],
  chains_live: 4,
  chains: [
    'parametric-trigger-adjudication',
    'insurer-rbc-action-level',
    'cat-bond-trigger-validation',
    'life-illustration-self-support-test',
  ],
  guide_hub: 'chaingraph/guide-insurance-stp.html',
  mcp_tools_added: [
    'compute_parametric_trigger_payout',
    'validate_cat_bond_trigger_terms',
    'run_illustration_selfsupport_test',
    'compute_rbc_action_level',
    'compute_lcm_rate_derivation',
    'validate_openids_homeowners_record',
    'calculate_claims_stp_economics',
  ],
  regulatory_refs: [
    'ISO 11116:2023 (parametric insurance trigger methodology)',
    'ISDA/IAIS cat bond trigger definitions; Swiss Re sigma 1/2024',
    'NAIC Model Regulation 582 §8C/§8D (Life Insurance Illustrations)',
    'ASOP 24 (Actuarial Standard of Practice for Illustrations)',
    'NAIC RBC Model Laws #312 (life), #315 (P&C), #315H (health)',
    'ASOP 25 (Premium Calculations); SERFF rate filing regulations',
    'openIDS Homeowners Data Standard v1.0 (AAIS/Linux Foundation, Nov 2025)',
    'IAIS ICP 13 (reinsurance), ICP 19 (claims handling)',
    'McKinsey Insurance 2024; Majesco Claims Technology Survey 2024',
  ],
  catalysts: [
    'Cat bond market at $63.9B outstanding Q1 2026 (record $25.6B issuance 2025) -- parametric trigger adjudication is the highest-value automation target: anchor.ainumbers.co/mcp creates a neutral trigger receipt neither party controls',
    'NAIC Model 582 self-support test is required for all life insurance illustrations in 50 states -- illustration_valid=false is a direct regulatory deficiency',
    'NAIC RBC action levels affect 20% of US P&C insurers in any given year -- gated chain routes only sub-200% ACL carriers to STP investment economics (proportionality)',
    'openIDS Homeowners v1.0 (AAIS/Linux Foundation, Nov 2025) is the first free open insurance data standard -- direct displacement of membership-gated ACORD XML/AL3 for homeowners data exchange',
    'LCM decomposition is the core actuarial pricing step in every US P&C rate filing -- kernel uses user-supplied loss costs exclusively, never ISO/Verisk advisory rates (proprietary)',
    'Claims STP ROI model: industry benchmarks 40-60% cost reduction per claim (McKinsey 2024); NPV positive within 12 months for high-volume insurers',
  ],
  description: '7 new nodes (art-251..257) + 4 chains for insurance underwriting and claims STP. Parametric trigger payout (art-251): threshold/tiered/linear_index triggers, tamper-evident trigger receipt for anchor.ainumbers.co/mcp dispute adjudication. Cat bond trigger validation (art-252): attachment/exhaustion arithmetic, pro-rata layer computation, ISDA/IAIS terms. NAIC Model 582 illustration self-support (art-253): §8C year-15/20 tests + §8D lapse-support prohibition, ASOP 24. NAIC RBC action level (art-254): 200/150/100/70% ACL ladder, trend test, all insurer types. LCM rate derivation (art-255): user-supplied loss costs ONLY -- never ISO/Verisk (proprietary). openIDS Homeowners v1.0 validation (art-256): first free open insurance data standard, NOT ACORD. Claims STP economics (art-257): NPV/IRR/payback for automation investment. 2 gated chains: parametric-trigger-adjudication (gate trigger_hit=false), insurer-rbc-action-level (gate NO_ACTION). 2 linear chains: cat-bond-trigger-validation, life-illustration-self-support-test. Proofs deferred (baseline 1->8). chaingraph.json v1.53.0.',
};

// Write back with trailing newline
writeFileSync(cgPath, JSON.stringify(g, null, 2) + '\n', 'utf8');
console.log('Done. version:', g.version, 'nodes:', g.nodes.length, 'chains:', g.chains.length);
