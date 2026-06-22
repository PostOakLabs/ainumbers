import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-100-mica-casp-authorization-readiness';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'assess_mica_casp_readiness',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const DIM_SCORE = {
  'in-place': 100,
  'dora-aligned': 100,
  'defined': 100,
  'full': 100,
  'partial': 50,
  'none': 0,
};

const GAP_META = {
  governance_board: {
    article: 'Art 68 MiCA',
    remediation: 'Appoint qualified management body',
  },
  fit_and_proper: {
    article: 'Art 62(2)(e) MiCA',
    remediation: 'Document fitness and propriety of all relevant persons',
  },
  internal_controls: {
    article: 'Art 62(2)(c) MiCA',
    remediation: 'Implement internal controls framework',
  },
  custody_segregation: {
    article: 'Art 70 MiCA',
    remediation: 'Implement full client-asset segregation',
  },
  complaints_handling: {
    article: 'Art 71 MiCA',
    remediation: 'Define complaints-handling procedure',
  },
  conflicts_policy: {
    article: 'Art 72 MiCA',
    remediation: 'Define conflicts-of-interest policy',
  },
  ict_resilience: {
    article: 'Art 62(2)(l) MiCA + DORA',
    remediation: 'Align ICT risk framework with DORA',
  },
};

export function compute(pp) {
  const {
    services = [],
    governance_board = 'none',
    fit_and_proper = 'none',
    internal_controls = 'none',
    custody_segregation = 'none',
    complaints_handling = 'none',
    conflicts_policy = 'none',
    ict_resilience = 'none',
  } = pp.inputs ?? pp;

  const dimension_scores = {
    governance_board: DIM_SCORE[governance_board] ?? 0,
    fit_and_proper: DIM_SCORE[fit_and_proper] ?? 0,
    internal_controls: DIM_SCORE[internal_controls] ?? 0,
    custody_segregation: DIM_SCORE[custody_segregation] ?? 0,
    complaints_handling: DIM_SCORE[complaints_handling] ?? 0,
    conflicts_policy: DIM_SCORE[conflicts_policy] ?? 0,
    ict_resilience: DIM_SCORE[ict_resilience] ?? 0,
  };

  const sum = Object.values(dimension_scores).reduce((a, b) => a + b, 0);
  const composite_pct = Math.round(sum / 7);

  const authorization_grade =
    composite_pct >= 88 ? 'A' :
    composite_pct >= 72 ? 'B' :
    composite_pct >= 56 ? 'C' :
    composite_pct >= 40 ? 'D' : 'F';

  const gaps = [];
  for (const [dim, score] of Object.entries(dimension_scores)) {
    if (score < 75) {
      gaps.push({
        area: dim,
        article: GAP_META[dim].article,
        remediation: GAP_META[dim].remediation,
      });
    }
  }

  const compliance_flags = [];
  if (governance_board !== 'in-place' || fit_and_proper !== 'in-place') {
    compliance_flags.push('GOVERNANCE_GAP');
  }
  if (custody_segregation !== 'full') {
    compliance_flags.push('CUSTODY_SEGREGATION_INCOMPLETE');
  }

  const output_payload = {
    authorization_grade,
    composite_pct,
    dimension_scores,
    gaps,
    application_pack_checklist: [
      'Programme of operations (Art 62(2)(a))',
      'Governance arrangements (Art 62(2)(b))',
      'Internal controls description (Art 62(2)(c))',
      'Custody segregation evidence (Art 70)',
      'Complaints procedure (Art 71)',
      'Conflict of interest policy (Art 72)',
      'ICT risk framework (Art 62(2)(l))',
    ],
    notified_body: 'Submit to home-member-state NCA per Art 59',
    reference_version: '2026-06',
    note: 'DECISION-SUPPORT DRAFT. MiCA Arts 59-63 authorization. Verify current NCA requirements.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode: 'server',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    audit_signature: {
      payloadType: 'application/vnd.openchain.graph+json;version=0.4',
      payload: '',
      signatures: [],
    },
  };
}
