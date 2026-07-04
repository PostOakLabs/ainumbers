// One-shot patch: add W38 nodes + chains + version bump + wave_38 summary.
// Run: node scripts/patch-wave38.mjs
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CJ_PATH = resolve('./chaingraph/chaingraph.json');
const g = JSON.parse(readFileSync(CJ_PATH, 'utf8'));

// ── 1. Bump version ──────────────────────────────────────────────────────────
g.version = '1.47.0';

// ── 2. New nodes ─────────────────────────────────────────────────────────────
const NEW_NODES = [
  {
    tool_id: 'art-221-llpa-stack',
    tool_version: '1.0.0',
    display_name: 'LLPA Stack Calculator',
    mcp_name: 'compute_llpa_stack',
    mandate_type: 'compliance_mandate',
    wave: 38,
    cluster: 21,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-221-llpa-stack.html',
    description: 'Fannie Mae public LLPA (Loan-Level Price Adjustment) matrix calculator. FICO-by-LTV base grid plus feature surcharges: cash-out refinance, second home, investment property, warrantable condo, subordinate financing. Applies FTHB AMI waiver (SEL-2023-07, up to 1.75 pp reduction for first-time buyers at or below 100% AMI). Table version: FNM-LLPA-2025-11-01 (Fannie Mae public publication). Not check_agency_eligibility_matrix (DU/LPA approval grid) or check_conforming_loan_limit (FHFA size limits).',
    input_schema_ref: 'chaingraph/art-221-llpa-stack.html#manifest',
    consumes: ['art-222-agency-eligibility-matrix'],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      {
        system: 'sha256-source',
        image_id: 'sha256:7221a3468182a878ebf517663153a90e4973b4125fe3d77c8a44789898b785ad',
        valid_from: '2026-07-04',
      },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
  {
    tool_id: 'art-222-agency-eligibility-matrix',
    tool_version: '1.0.0',
    display_name: 'Agency Eligibility Matrix',
    mcp_name: 'check_agency_eligibility_matrix',
    mandate_type: 'compliance_mandate',
    wave: 38,
    cluster: 21,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-222-agency-eligibility-matrix.html',
    description: 'Fannie Mae DU and Freddie Mac LPA agency eligibility matrix. Checks DTI caps (DU/LPA: 50%; manual UW: 36% housing / 45% total), LTV/CLTV/HCLTV maximums by occupancy type (primary/second home/investment) and loan purpose (purchase/rate-term/cash-out), and multi-unit property constraints. Returns eligible_flag (ELIGIBLE or INELIGIBLE) and detailed per-check results. Table version: FNM-LPA-ELIGIBILITY-2026-01-01. Not compute_llpa_stack (LLPA pricing surcharges) or check_conforming_loan_limit (FHFA loan size limits).',
    input_schema_ref: 'chaingraph/art-222-agency-eligibility-matrix.html#manifest',
    consumes: ['art-223-conforming-loan-limit'],
    feeds: ['art-221-llpa-stack'],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      {
        system: 'sha256-source',
        image_id: 'sha256:1974e5147a75759c71c8deb05d10e26b2803fb3ce6c5947cabd998c089cf0e49',
        valid_from: '2026-07-04',
      },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
  {
    tool_id: 'art-223-conforming-loan-limit',
    tool_version: '1.0.0',
    display_name: 'Conforming Loan Limit Check',
    mcp_name: 'check_conforming_loan_limit',
    mandate_type: 'compliance_mandate',
    wave: 38,
    cluster: 21,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-223-conforming-loan-limit.html',
    description: 'FHFA annual conforming loan limit classifier. 2026 baseline: $806,500 (1-unit), $1,032,650 (2-unit), $1,248,150 (3-unit), $1,550,400 (4-unit). High-cost county and AK/HI/Guam/USVI ceiling at 150% of baseline. Classifies loans as conforming, super-conforming, or jumbo. Accepts optional county-level limit override from FHFA FullCountyLoanLimitList2026.xlsx. Table version: FHFA-CLL-2026. Not lookup_reg_z_thresholds (Reg Z consumer-protection dollar thresholds) or check_agency_eligibility_matrix (DU/LPA approval parameters).',
    input_schema_ref: 'chaingraph/art-223-conforming-loan-limit.html#manifest',
    consumes: [],
    feeds: ['art-222-agency-eligibility-matrix'],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      {
        system: 'sha256-source',
        image_id: 'sha256:114e209f4a992a5b64a0357a6263fe467420738e6ac70b6c238b17987521fb40',
        valid_from: '2026-07-04',
      },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
  {
    tool_id: 'art-224-fha-mip-eligibility',
    tool_version: '1.0.0',
    display_name: 'FHA MIP Eligibility Calculator',
    mcp_name: 'compute_fha_mip_eligibility',
    mandate_type: 'compliance_mandate',
    wave: 38,
    cluster: 21,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-224-fha-mip-eligibility.html',
    description: 'FHA mortgage insurance premium (MIP) eligibility and cost calculator per HUD Handbook 4000.1. UFMIP: 1.75% of base loan. Annual MIP grid (0.15%-0.75%) by base loan amount vs $726,200 threshold, LTV, and term. MIP duration: 11 years when original LTV at or below 90%; life-of-loan when above 90%. Qualifying ratios: 31% front-end / 43% back-end (compensating factors to 40%/57%). Credit score floors: 580 for 96.5% LTV; 500-579 for 90% max. Table version: HUD-MIP-ML2023-05-ML2024-01 (HUD Mortgagee Letter 2023-05, effective 2023-03-20).',
    input_schema_ref: 'chaingraph/art-224-fha-mip-eligibility.html#manifest',
    consumes: [],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      {
        system: 'sha256-source',
        image_id: 'sha256:0188afefdc40d10dd5d1058b02fdf32126f50994c6cdfc0389f7e1cf93cfe295',
        valid_from: '2026-07-04',
      },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
  {
    tool_id: 'art-225-va-funding-fee-residual',
    tool_version: '1.0.0',
    display_name: 'VA Funding Fee and Residual Income',
    mcp_name: 'compute_va_funding_fee_residual',
    mandate_type: 'compliance_mandate',
    wave: 38,
    cluster: 21,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-225-va-funding-fee-residual.html',
    description: 'VA home loan funding fee (38 USC §3729) and residual income qualification. Funding fee table: first vs subsequent use, down-payment tiers (0%/5-9.99%/10%+), exemptions for service-connected disability/surviving spouse/Purple Heart. IRRRL: 0.50%. Residual income: VA Pamphlet 26-7 Ch.4 Tables 41A/41B by region (Northeast/Midwest/South/West) and family size; $80 per member above five. DTI benchmark: 41% (triggers residual income review when exceeded). Table versions: VA-FF-2025-01-01 (VA Circular 26-25-3); VA-PAMPHLET-26-7-CH4-2024.',
    input_schema_ref: 'chaingraph/art-225-va-funding-fee-residual.html#manifest',
    consumes: [],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      {
        system: 'sha256-source',
        image_id: 'sha256:0a2c6c768159e004a4be516f27462520d1e1459d4323169d1530a336a0172053',
        valid_from: '2026-07-04',
      },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
  {
    tool_id: 'art-226-mismo-uldd-ulad',
    tool_version: '1.0.0',
    display_name: 'ULDD/ULAD Structural Linter',
    mcp_name: 'lint_mismo_uldd_ulad',
    mandate_type: 'compliance_mandate',
    wave: 38,
    cluster: 21,
    gpu: false,
    url: 'https://ainumbers.co/chaingraph/art-226-mismo-uldd-ulad.html',
    description: 'ULDD Phase 5 / ULAD structural lint of required data points, enumerations, and conditionality rules. Checks field presence against ULDD Phase 5 required set, validates enum values from the public Fannie Mae ULDD Phase 5 Data Stencil and Freddie Mac ULAD Data Dictionary v1.3, enforces ARM-conditional fields, range constraints, and indicator consistency. ULDD Phase 5 mandate effective 2025-07-28. Inputs are bounded structural fields only; loan PII never leaves the browser. Lints public ULDD/ULAD data dictionaries only; does not embed or validate against the membership-licensed MISMO v3.x Reference Model schema. Table version: ULDD-PHASE5-ULAD-1.3-2025-07-28.',
    input_schema_ref: 'chaingraph/art-226-mismo-uldd-ulad.html#manifest',
    consumes: [],
    feeds: [],
    status: 'live',
    conformance_fixtures: true,
    compute_capability: 'server',
    compute_images: [
      {
        system: 'sha256-source',
        image_id: 'sha256:5b09063e1cbd268666c288bd86047df127316f8a8e314b985ea89b240bc4ac13',
        valid_from: '2026-07-04',
      },
    ],
    export_capability: ['json'],
    compute_proof_ready: 'deferred',
  },
];

for (const n of NEW_NODES) g.nodes.push(n);

// ── 3. New chains ─────────────────────────────────────────────────────────────
const NEW_CHAINS = [
  {
    name: 'mortgage-agency-pricing-and-eligibility',
    title: 'Mortgage Agency Pricing and Eligibility',
    spec_version: '0.8.0',
    wave: 38,
    description: 'Gated three-step chain: conforming loan limit check feeds agency eligibility matrix (gate: INELIGIBLE routes to non-conforming referral terminal step; ELIGIBLE continues to LLPA pricing stack). Determines agency deliverability and computes the LLPA cost grid for eligible loans. FHFA CLL 2026 + Fannie/Freddie DU/LPA eligibility + LLPA FNM-2025-11-01.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/mortgage-agency-pricing-and-eligibility.html',
    regulatory_refs: [
      '12 USC 1454/1717 (FHFA conforming loan limits)',
      'Fannie Mae Selling Guide B3-2-01 (DU eligibility)',
      'Freddie Mac Guide Ch.5100 (LPA eligibility)',
      'Fannie Mae LLPA Matrix effective 2025-11-01',
      'Fannie Mae Selling Guide B3-4.1-02; SEL-2023-07 FTHB waiver',
    ],
    steps: [
      {
        tool_id: 'art-223-conforming-loan-limit',
        handoff: 'Conforming/super-conforming/jumbo classification feeds Step 2 agency eligibility check',
      },
      {
        tool_id: 'art-222-agency-eligibility-matrix',
        handoff: 'Agency eligibility verdict -- gate routes INELIGIBLE to non-conforming referral, ELIGIBLE to LLPA pricing',
        gate: {
          input: '/eligible_flag',
          rules: [
            { op: 'eq', value: 'INELIGIBLE', next: 'end' },
          ],
          default: 'art-221-llpa-stack',
        },
      },
      {
        tool_id: 'art-221-llpa-stack',
        handoff: 'LLPA pricing stack with table_version binding completes the agency pricing and eligibility report -- final stage',
      },
    ],
  },
  {
    name: 'mortgage-government-loan-fit',
    title: 'Mortgage Government Loan Fit',
    spec_version: '0.8.0',
    wave: 38,
    description: 'Gated two-step government loan program router. First step surfaces the target loan program into output_payload (loan_program field). Gate routes VA program to VA funding fee and residual income calculation; all other programs (FHA and others) continue to FHA MIP eligibility and cost calculation. Both branches are reachable: VA path computes funding fee + 38 USC §3729 table; FHA/default path computes HUD 4000.1 MIP. Total function with mandatory default.',
    composer_url: 'https://ainumbers.co/chaingraph/chains/mortgage-government-loan-fit.html',
    regulatory_refs: [
      '38 USC §3729 (VA funding fee)',
      '38 CFR Part 36 (VA home loans)',
      'VA Pamphlet 26-7 Ch.4 (residual income tables)',
      '12 USC 1709 (FHA §203(b))',
      'HUD Handbook 4000.1 §II.A.8 (MIP)',
      'HUD Mortgagee Letter 2023-05 (annual MIP rates)',
    ],
    steps: [
      {
        tool_id: 'art-223-conforming-loan-limit',
        handoff: 'loan_program field (VA/FHA/Conventional) surfaces into output_payload; gate routes VA to funding-fee path, default to FHA MIP path',
        gate: {
          input: '/loan_program',
          rules: [
            { op: 'eq', value: 'VA', next: 'art-225-va-funding-fee-residual' },
          ],
          default: 'art-224-fha-mip-eligibility',
        },
      },
      {
        tool_id: 'art-225-va-funding-fee-residual',
        handoff: 'VA funding fee (38 USC §3729) and residual income (Pamphlet 26-7 Ch.4) -- VA path final stage',
      },
      {
        tool_id: 'art-224-fha-mip-eligibility',
        handoff: 'FHA MIP eligibility and cost (HUD 4000.1, ML 2023-05) -- FHA/default path final stage',
      },
    ],
  },
];

for (const c of NEW_CHAINS) g.chains.push(c);

// ── 4. wave_38 summary ────────────────────────────────────────────────────────
g.wave_summary.wave_38 = {
  name: 'US Mortgage Agency and Government Loan Pricing',
  shipped: '2026-07-04',
  nodes_live: 6,
  live: [
    'art-221-llpa-stack',
    'art-222-agency-eligibility-matrix',
    'art-223-conforming-loan-limit',
    'art-224-fha-mip-eligibility',
    'art-225-va-funding-fee-residual',
    'art-226-mismo-uldd-ulad',
  ],
  chains_live: 2,
  chains: [
    'mortgage-agency-pricing-and-eligibility',
    'mortgage-government-loan-fit',
  ],
  guide_hub: 'chaingraph/guide-mortgage-compliance.html',
  mcp_tools_added: [
    'compute_llpa_stack',
    'check_agency_eligibility_matrix',
    'check_conforming_loan_limit',
    'compute_fha_mip_eligibility',
    'compute_va_funding_fee_residual',
    'lint_mismo_uldd_ulad',
  ],
  regulatory_refs: [
    'Fannie Mae LLPA Matrix effective 2025-11-01 (public, FNM-LLPA-2025-11-01)',
    'Fannie Mae Selling Guide B3-2-01 / B3-3.1-09 (DU/manual UW eligibility)',
    'Freddie Mac Single-Family Guide Ch.5100 (LPA eligibility)',
    'FHFA 2026 Conforming Loan Limits (FullCountyLoanLimitList2026.xlsx, FHFA-CLL-2026)',
    'HUD Handbook 4000.1 §II.A.8.p-q (FHA MIP)',
    'HUD Mortgagee Letter 2023-05 (reduced annual MIP rates effective 2023-03-20)',
    'HUD Mortgagee Letter 2024-01 (MIP rates 2024-2025)',
    '38 USC §3729(a)(2) (VA funding fee statutory table)',
    'VA Circular 26-25-3 (VA-FF-2025-01-01)',
    'VA Pamphlet 26-7 Ch.4 Tables 41A/41B (residual income, VA-PAMPHLET-26-7-CH4-2024)',
    'Fannie Mae ULDD Phase 5 Data Stencil (public, mandate effective 2025-07-28)',
    'Freddie Mac ULAD Data Dictionary v1.3 (public)',
  ],
  catalysts: [
    'LLPA stack is the highest-table-density build to date: four pinned tables (LLPA, CLL, FHA MIP, VA fee), each version-stamped in output_payload',
    'Agents hallucinate LLPA rates and conforming limits; version-pinned tables with source citations are the moat',
    'ULDD Phase 5 mandate went live 2025-07-28 requiring lender delivery system updates; structural lint gives agents a rerunnable conformance artifact',
    'VA residual income tables are region-and-family-size dependent; deterministic kernel removes manual table lookups from the agent decision path',
    'Government loan routing chain (mortgage-government-loan-fit) uses §21.4 gate to route VA vs FHA programs deterministically',
    'Loan PII (ULDD data) never leaves the browser; all computation is client-side',
  ],
  description: `6 new nodes (art-221..226) + 2 chains extending cluster 21 (US Mortgage Compliance). Fannie Mae LLPA stack (FICO-LTV grid + feature surcharges + FTHB waiver), DU/LPA agency eligibility matrix (DTI/LTV grids by occupancy/purpose), FHFA conforming loan limit classifier (2026 baseline/high-cost/AK-HI), FHA MIP eligibility (HUD 4000.1 UFMIP 1.75% + annual grid + 31/43 ratios), VA funding fee and residual income (38 USC §3729 + Pamphlet 26-7 Ch.4 tables), and ULDD Phase 5 / ULAD structural linter (public data stencils, bounded inputs). Chain 1 (mortgage-agency-pricing-and-eligibility): conforming limit check -> agency eligibility gate (INELIGIBLE exits; ELIGIBLE continues) -> LLPA pricing. Chain 2 (mortgage-government-loan-fit): program router gate (VA path -> funding fee/residual; FHA/default -> MIP). Both §21.4 gated with mandatory defaults. chaingraph.json v1.47.0 (254 nodes, 241 chains).`,
};

// ── 5. Write ──────────────────────────────────────────────────────────────────
writeFileSync(CJ_PATH, JSON.stringify(g, null, 2) + '\n', 'utf8');
console.log('chaingraph.json patched: v1.47.0,', g.nodes.length, 'nodes,', g.chains.length, 'chains');
