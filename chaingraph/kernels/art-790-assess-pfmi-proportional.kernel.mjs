import { executionHash } from './_hash.mjs';

// art-790-assess-pfmi-proportional — scores a payment system operator's or overseer's self-assessment
// against the CPMI-IOSCO Principles for Financial Market Infrastructures (Apr 2012) using the
// assessment methodology's four-level rating scale (Dec 2012, paras 3.18/3.21), with this tool's
// own ILLUSTRATIVE proportional tiers (systemic / prominent / small — not a CPMI-IOSCO
// classification) and an optional linked-FPS governance module (CPMI Oct 2024 report, s4).
// Behaviour only — citations live in the node shard (KERNEL-CITATION-CLASS-1). Primary text is
// pinned under workspace research/clause-snapshots/pfmi/ (PFMI-PIN-2026-10-29.md).

const TOOL_ID = 'art-790-assess-pfmi-proportional';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_pfmi_proportional',
  mandate_type: 'compliance_control', gpu: false,
};

// ---- Tier map: config embedded here is the single generator; the expanded DATA file lives at
// chaingraph/kernels/fixtures/art-790-assess-pfmi-proportional.tier-map.json and the proptest asserts
// deep equality between buildTierMap() and that file, so the two cannot drift.

const PRINCIPLE_TITLES = {
  p01: 'Legal basis', p02: 'Governance', p03: 'Framework for the comprehensive management of risks',
  p04: 'Credit risk', p05: 'Collateral', p06: 'Margin', p07: 'Liquidity risk',
  p08: 'Settlement finality', p09: 'Money settlements', p10: 'Physical deliveries',
  p11: 'Central securities depositories', p12: 'Exchange-of-value settlement systems',
  p13: 'Participant-default rules and procedures', p14: 'Segregation and portability',
  p15: 'General business risk', p16: 'Custody and investment risks', p17: 'Operational risk',
  p18: 'Access and participation requirements', p19: 'Tiered participation arrangements',
  p20: 'FMI links', p21: 'Efficiency and effectiveness', p22: 'Communication procedures and standards',
  p23: 'Disclosure of rules, key procedures, and market data', p24: 'Disclosure of market data by trade repositories',
};
const PRINCIPLE_PAGE = { p01: 1, p02: 1, p03: 1, p04: 1, p05: 2, p06: 2, p07: 2, p08: 2, p09: 2, p10: 2, p11: 2, p12: 2, p13: 2, p14: 2, p15: 3, p16: 3, p17: 3, p18: 3, p19: 3, p20: 3, p21: 3, p22: 3, p23: 4, p24: 4 };
const NOT_APPLICABLE_BY_SYSTEM = ['p06', 'p10', 'p11', 'p12', 'p14', 'p24']; // CCP-, CSD-, exchange-of-value-, physical-delivery- and TR-only principles
const REQUIRED_FOR_TIERS = {
  p01: ['systemic', 'prominent', 'small'], p02: ['systemic', 'prominent', 'small'], p03: [],
  p04: ['systemic'], p05: [], p07: ['systemic'], p08: ['systemic', 'prominent', 'small'],
  p09: ['systemic'], p13: ['prominent'], p15: ['systemic'], p16: [],
  p17: ['systemic', 'prominent', 'small'], p18: ['prominent'],
  p19: [], p20: [], p21: [], p22: [], p23: ['systemic', 'prominent', 'small'],
};
const SYSTEMS = ['payment_system', 'fast_payment_system', 'rtgs'];
const TIERS = ['systemic', 'prominent', 'small'];
const AUTHORITY_TITLES = {
  ra: 'Regulation, supervision, and oversight of FMIs',
  rb: 'Regulatory, supervisory, and oversight powers and resources',
  rc: 'Disclosure of policies with respect to FMIs',
  rd: 'Application of the principles for FMIs',
  re: 'Cooperation with other authorities',
};
const LINKED_FPS = {
  fps_legal_setup: ['Legal setup of the interlinking arrangement', 's4.2.1'],
  fps_ownership: ['Ownership structure of the interlinking arrangement', 's4.2.2'],
  fps_governance_bodies: ['Governance bodies of the interlinking arrangement', 's4.3.1'],
  fps_conduct_of_operations: ['Conduct of operations of the interlinking arrangement', 's4.3.2'],
  fps_risk_management: ['Risk management of the interlinking arrangement', 's4.3.3'],
};

function tierCell(id, systemType, tier) {
  const n = Number(id.slice(1));
  const title = PRINCIPLE_TITLES[id];
  const value = NOT_APPLICABLE_BY_SYSTEM.includes(id) ? 'not_applicable'
    : (REQUIRED_FOR_TIERS[id].includes(tier) ? 'required' : 'proportional');
  const sourceCite = 'PFMI Principle ' + n + ' (' + title + ', Apr 2012 overview, report p. '
    + PRINCIPLE_PAGE[id] + '); applicability scoping per assessment methodology s3.21; tier cell is '
    + 'this tool\u2019s illustrative proportional design, not a CPMI-IOSCO classification '
    + '(PFMI-PIN-2026-10-29)';
  return { value, source_cite: sourceCite };
}

/** Rebuild the tier map DATA from the embedded config. Exported so the proptest can assert deep
 * equality with chaingraph/kernels/fixtures/art-790-assess-pfmi-proportional.tier-map.json. */
export function buildTierMap() {
  const principles = {};
  for (const id of Object.keys(PRINCIPLE_TITLES)) {
    const cells = {};
    for (const st of SYSTEMS) { cells[st] = {}; for (const t of TIERS) cells[st][t] = tierCell(id, st, t); }
    principles[id] = { title: PRINCIPLE_TITLES[id], cells };
  }
  const authorities = {};
  for (const id of Object.keys(AUTHORITY_TITLES)) {
    authorities[id] = {
      title: AUTHORITY_TITLES[id],
      cell: {
        value: 'required',
        source_cite: 'PFMI Responsibility ' + id.slice(1).toUpperCase() + ' (' + AUTHORITY_TITLES[id]
          + ', Apr 2012 overview, report p. 4); responsibilities are not tiered; rating per assessment '
          + 'methodology s4.0 Step 4',
      },
    };
  }
  const linkedFpsModule = {};
  for (const id of Object.keys(LINKED_FPS)) {
    linkedFpsModule[id] = {
      title: LINKED_FPS[id][0],
      cell: {
        value: 'proportional',
        source_cite: 'CPMI, Linking fast payment systems across borders: governance and oversight, '
          + 'final report (Oct 2024) ' + LINKED_FPS[id][1]
          + '; module inclusion is this tool\u2019s illustrative design',
      },
    };
  }
  return {
    _note: 'Tier map DATA for node art-790-assess-pfmi-proportional. The systemic/prominent/small '
      + 'proportional tiers are the tool\u2019s illustrative design, labelled as such and NOT a '
      + 'CPMI-IOSCO classification. Every cell carries a source cite to the pinned primary text '
      + '(research/clause-snapshots/pfmi/, PFMI-PIN-2026-10-29.md). The kernel rebuilds this map '
      + 'from the same config and the proptest asserts deep equality.',
    schema: 'art-790-assess-pfmi-proportional.tier-map/1',
    systems: SYSTEMS, tiers: TIERS,
    principles, authorities, linked_fps_module: linkedFpsModule,
  };
}

// ---- Rating scale (methodology s3.18 four levels + s3.21 not applicable)

const RATING_SCALE = ['observed', 'broadly_observed', 'partly_observed', 'not_observed', 'not_applicable'];
const GAP_SEVERITY = { not_observed: 'critical', partly_observed: 'high', broadly_observed: 'moderate' };
const SEVERITY_RANK = { violation: 0, critical: 1, high: 2, moderate: 3 };
const GAP_REASON = {
  broadly_observed: 'Broadly observed: one or more issues of concern that the entity should address '
    + 'and follow up on in a defined timeline (assessment methodology s3.18).',
  partly_observed: 'Partly observed: one or more issues of concern that could become serious if not '
    + 'addressed promptly; high priority (assessment methodology s3.18).',
  not_observed: 'Not observed: one or more serious issues of concern warranting immediate action; '
    + 'highest priority (assessment methodology s3.18).',
};
const TIER_NOTE = 'The proportional tiers (systemic, prominent, small) are this tool\u2019s '
  + 'illustrative design for adapting the principles to system size and criticality; they are NOT a '
  + 'CPMI-IOSCO classification, and national authorities may adapt the principles per the assessment '
  + 'methodology.';

function refusal(code, detail) {
  const flags = [];
  if (code) flags.push('INPUT_REFUSED');
  return {
    output_payload: {
      error: code.toLowerCase(), detail,
      domain_errors: [{ code, text: detail }],
      principles_in_scope: [], rated_count: 0, gap_register: [], action_plan: [],
      summary_by_rating: {}, coverage_pct: 0, tier_note: TIER_NOTE,
    },
    compliance_flags: flags,
  };
}

/**
 * compute(pp) — pure PFMI self-assessment scorer (values only; nothing external is read).
 * pp: {
 *   role: 'operator' | 'authority',
 *   tier: 'systemic' | 'prominent' | 'small',        // operator role only (authority is not tiered)
 *   system_type: 'payment_system' | 'fast_payment_system' | 'rtgs',  // operator role only
 *   linked_system: boolean (optional, operator role) // adds the linked-FPS governance module
 *   ratings: [ { id, rating, evidence_ref?, target_date? } ]  // ids per role; rating per methodology s3.18/3.21
 * }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const map = buildTierMap();

  if (pp.role !== 'operator' && pp.role !== 'authority') {
    return refusal('ROLE_INVALID', 'role must be "operator" or "authority"; got ' + JSON.stringify(pp.role ?? null) + '.');
  }
  if (!Array.isArray(pp.ratings) || pp.ratings.length === 0) {
    return refusal('RATINGS_MISSING', 'ratings must be a non-empty array of { id, rating } entries; got ' + JSON.stringify(pp.ratings ?? null) + '.');
  }

  let inScopeIds;
  if (pp.role === 'operator') {
    if (!TIERS.includes(pp.tier)) {
      return refusal('TIER_INVALID', 'tier must be one of ' + JSON.stringify(TIERS) + '; got ' + JSON.stringify(pp.tier ?? null) + '.');
    }
    if (!SYSTEMS.includes(pp.system_type)) {
      return refusal('SYSTEM_TYPE_INVALID', 'system_type must be one of ' + JSON.stringify(SYSTEMS) + '; got ' + JSON.stringify(pp.system_type ?? null) + '.');
    }
    inScopeIds = Object.keys(map.principles)
      .filter((id) => map.principles[id].cells[pp.system_type][pp.tier].value !== 'not_applicable');
    if (pp.linked_system === true) inScopeIds = inScopeIds.concat(Object.keys(map.linked_fps_module));
  } else {
    inScopeIds = Object.keys(map.authorities);
  }
  const scopeSet = new Set(inScopeIds);

  const seen = new Set();
  const ratingById = new Map();
  for (let i = 0; i < pp.ratings.length; i++) {
    const entry = pp.ratings[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return refusal('RATING_ENTRY_MALFORMED', 'ratings[' + i + '] must be an object { id, rating }; got ' + JSON.stringify(entry ?? null) + '.');
    }
    if (typeof entry.id !== 'string' || !scopeSet.has(entry.id)) {
      return refusal('RATING_ID_UNKNOWN', 'ratings[' + i + '].id ' + JSON.stringify(entry.id ?? null)
        + ' is not an id in scope for role ' + pp.role + (pp.role === 'operator' ? ' at tier ' + pp.tier + ' and system_type ' + pp.system_type : '')
        + '; every rating id must name a principle, responsibility or module item in the declared scope.');
    }
    if (!RATING_SCALE.includes(entry.rating)) {
      return refusal('RATING_INVALID', 'ratings[' + i + '].rating must be one of ' + JSON.stringify(RATING_SCALE)
        + ' (assessment methodology s3.18/s3.21); got ' + JSON.stringify(entry.rating ?? null) + '.');
    }
    if (entry.target_date !== undefined && entry.target_date !== null
      && !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.target_date))) {
      return refusal('TARGET_DATE_INVALID', 'ratings[' + i + '].target_date must be a YYYY-MM-DD date string; got ' + JSON.stringify(entry.target_date) + '.');
    }
    if (seen.has(entry.id)) {
      return refusal('RATING_DUPLICATE', 'ratings[' + i + '] repeats id ' + entry.id + '; each id may be rated at most once.');
    }
    seen.add(entry.id);
    ratingById.set(entry.id, entry);
  }

  // Score
  const gapRegister = [];
  const summary = { observed: 0, broadly_observed: 0, partly_observed: 0, not_observed: 0, not_applicable: 0, unrated: 0 };
  let rated = 0;
  const flags = [];
  for (const id of inScopeIds) {
    const entry = ratingById.get(id);
    if (!entry) { summary.unrated += 1; continue; }
    const cell = pp.role === 'operator'
      ? (map.linked_fps_module[id] ? map.linked_fps_module[id].cell : map.principles[id].cells[pp.system_type][pp.tier])
      : map.authorities[id].cell;
    if (entry.rating === 'not_applicable' && cell.value === 'required') {
      gapRegister.push({ id, rating: entry.rating, severity: 'violation', reason: 'Rated not_applicable but the tier map marks this '
        + (map.principles[id] ? 'principle' : 'module item') + ' required at tier ' + pp.tier + ' for ' + pp.system_type
        + '; source: ' + cell.source_cite });
      summary.not_applicable += 1;
      continue;
    }
    if (entry.rating === 'not_applicable') { summary.not_applicable += 1; continue; }
    rated += 1;
    summary[entry.rating] += 1;
    const severity = GAP_SEVERITY[entry.rating];
    if (severity) {
      gapRegister.push({ id, rating: entry.rating, severity, reason: GAP_REASON[entry.rating] + ' Source: ' + cell.source_cite });
    }
  }

  gapRegister.sort((a, b) => (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const actionPlan = gapRegister
    .filter((g) => {
      const entry = ratingById.get(g.id);
      return entry && typeof entry.target_date === 'string';
    })
    .map((g) => {
      const entry = ratingById.get(g.id);
      return { id: g.id, severity: g.severity, target_date: entry.target_date, action: 'Remediate to at least broadly_observed per the action-plan duty of assessment methodology s3.23-s3.26.' };
    })
    .sort((a, b) => (a.target_date < b.target_date ? -1 : a.target_date > b.target_date ? 1 : (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) || (a.id < b.id ? -1 : 1)));

  const coveragePct = inScopeIds.length === 0 ? 0
    : Math.round((rated / inScopeIds.length) * 1000) / 10;

  if (gapRegister.some((g) => g.severity === 'violation')) flags.push('PFMI_REQUIRED_MARKED_NOT_APPLICABLE');
  if (gapRegister.length > 0) flags.push('PFMI_GAPS_PRESENT');
  if (summary.unrated > 0) flags.push('PFMI_RATINGS_INCOMPLETE');
  if (pp.role === 'operator' && pp.linked_system === true) flags.push('PFMI_LINKED_FPS_MODULE_ASSESSED');

  const output = {
    role: pp.role,
    tier: pp.role === 'operator' ? pp.tier : null,
    system_type: pp.role === 'operator' ? pp.system_type : null,
    linked_system: pp.role === 'operator' ? pp.linked_system === true : false,
    principles_in_scope: inScopeIds,
    rated_count: rated,
    gap_register: gapRegister,
    action_plan: actionPlan,
    summary_by_rating: summary,
    coverage_pct: coveragePct,
    tier_note: TIER_NOTE,
    tier_map_cite: 'chaingraph/kernels/fixtures/art-790-assess-pfmi-proportional.tier-map.json (data beside the kernel; source cite per cell)',
  };
  return { output_payload: output, compliance_flags: flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
