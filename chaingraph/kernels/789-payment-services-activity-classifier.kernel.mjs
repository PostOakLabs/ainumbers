import { executionHash } from './_hash.mjs';

// 789-payment-services-activity-classifier — classify a declared business model's payment
// activities into the licence classes of a pinned payment-services regime profile, with
// exclusions considered, transition notes and a not-legal-advice marker. Regime profile
// data is embedded below as pure data (mirrored, with source cites, in the fixtures
// directory profile files and in node metadata — citations never live in kernel comments).
// DETERMINISM: compute() is a pure function of pp — no Date.now()/Math.random(), no
// network, no filesystem, no guest builtins. The scaffold's utf8ToBytes helper was deleted
// per scaffold guidance: this compute() never encodes UTF-8.

const TOOL_ID = '789-payment-services-activity-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_payment_services',
  mandate_type: 'compliance_control', gpu: false,
};

// Closed enum of declared activity facts this kernel accepts.
const ACTIVITY_FACTS = [
  'holds_customer_funds', 'executes_transfers', 'issues_payment_instruments',
  'acquires_transactions', 'money_remittance',
  'initiates_payments_without_holding_funds', 'provides_account_information',
  'technical_service_only', 'operates_stored_value_wallet',
  'commercial_agent_for_one_side', 'limited_network',
];

// Facts that a funds-holding class reading treats as payment-flow participation.
const FLOW_FACTS = ['holds_customer_funds', 'executes_transfers', 'issues_payment_instruments', 'acquires_transactions', 'money_remittance'];

// Regime profiles: pure data. Each class maps to the facts that trigger it; each
// exclusion states its availability and blocking condition; transition entries map a
// declared current licence to a transition note. Source cites for every item live in the
// fixtures-directory profile files and node metadata, not here.
const PROFILES = {
  bermuda_psa: {
    regime_status: 'proposed',
    classes: {
      payment_handling_provider: ['holds_customer_funds', 'executes_transfers', 'issues_payment_instruments', 'acquires_transactions', 'money_remittance'],
      payment_technology_provider: ['initiates_payments_without_holding_funds', 'provides_account_information'],
      digital_facility_provider: ['operates_stored_value_wallet'],
    },
    exclusions: {
      technical_service_only: { available: true, blocked_by: ['holds_customer_funds', 'initiates_payments_without_holding_funds'], reason_applied: 'sole technical or connectivity infrastructure outside the payment flow; the refined definition excludes the sole provision of communication or messaging infrastructure', reason_blocked: 'the exclusion cannot hold while the provider participates in the payment flow or holds customer funds; third-party-asset custody remains under the parallel digital-assets regime' },
      commercial_agent_for_one_side: { available: false, reason_blocked: 'no commercial-agent exclusion is recorded in the proposed regime text; consultation respondents sought closed-loop and intra-group exclusions and the Authority deferred final perimeter drafting' },
      limited_network: { available: false, reason_blocked: 'no limited-network exclusion is recorded in the proposed regime text; consultation respondents sought closed-loop exclusions and the perimeter drafting continues' },
    },
    transition: {
      msb_2016: 'existing money service businesses are expected to transition to the proposed Act, with a one-year transition period recorded in the consultation response; the proposed Act replaces the Money Service Business Act 2016',
    },
    conflicts: {
      digital_facility_provider: { blocked_by: ['holds_customer_funds'], id: 'DFP_CUSTODY_LIMIT_EXCEEDED', reason: 'the permitted custody for this class is limited to the provider\u2019s own stablecoins and does not extend to other stablecoins, unrelated digital assets or third-party customer funds' },
    },
  },
  eu_psd2: {
    regime_status: 'enacted',
    classes: {
      payment_handling: ['holds_customer_funds'],
      execution_of_payment_transactions: ['executes_transfers'],
      issuing_or_acquiring_payment_instruments: ['issues_payment_instruments', 'acquires_transactions'],
      money_remittance: ['money_remittance'],
      payment_initiation_service: ['initiates_payments_without_holding_funds'],
      account_information_service: ['provides_account_information'],
    },
    exclusions: {
      technical_service_only: { available: true, blocked_by: ['holds_customer_funds', 'initiates_payments_without_holding_funds', 'provides_account_information'], reason_applied: 'technical service providers support the provision of payment services without entering at any time into possession of the funds to be transferred', reason_blocked: 'the exclusion expressly does not cover payment initiation or account information services, and cannot hold where the provider enters into possession of the funds' },
      commercial_agent_for_one_side: { available: true, blocked_by: FLOW_FACTS, reason_applied: 'payment transactions between payer and payee through a commercial agent authorised to negotiate or conclude the sale or purchase on behalf of either the payer or the payee but not both are excluded', reason_blocked: 'an exclusion can only be read where the declared activity set is that of a one-sided commercial agent; the declared facts include payment-flow participation' },
      limited_network: { available: true, blocked_by: ['holds_customer_funds', 'money_remittance'], reason_applied: 'services based on specific payment instruments usable only in a limited way, on the issuer\u2019s premises, in a limited network of service providers with direct commercial agreements, or for a very limited range of goods or services, are excluded', reason_blocked: 'the limited-way instrument exclusion does not carry general funds handling or money remittance' },
    },
    transition: {},
    conflicts: {},
  },
  uk_psrs: {
    regime_status: 'enacted',
    classes: {
      payment_handling: ['holds_customer_funds'],
      execution_of_payment_transactions: ['executes_transfers'],
      issuing_or_acquiring_payment_instruments: ['issues_payment_instruments', 'acquires_transactions'],
      money_remittance: ['money_remittance'],
      payment_initiation_service: ['initiates_payments_without_holding_funds'],
      account_information_service: ['provides_account_information'],
    },
    exclusions: {
      technical_service_only: { available: true, blocked_by: ['holds_customer_funds', 'initiates_payments_without_holding_funds', 'provides_account_information'], reason_applied: 'technical service providers support the provision of payment services without the provider entering at any time into possession of the funds to be transferred', reason_blocked: 'the exclusion expressly excludes payment initiation and account information services, and cannot hold where the provider is in possession of the funds' },
      commercial_agent_for_one_side: { available: true, blocked_by: FLOW_FACTS, reason_applied: 'payment transactions between the payer and the payee through a commercial agent authorised in an agreement to negotiate or conclude the sale or purchase on behalf of either the payer or the payee but not both do not constitute payment services', reason_blocked: 'an exclusion can only be read where the declared activity set is that of a one-sided commercial agent; the declared facts include payment-flow participation' },
      limited_network: { available: true, blocked_by: ['holds_customer_funds', 'money_remittance'], reason_applied: 'services based on specific payment instruments that can be used only in a limited way, including instruments limited to the issuer\u2019s premises, a limited network of service providers with direct commercial agreements, or a very limited range of goods or services, are excluded', reason_blocked: 'the limited-way instrument exclusion does not carry general funds handling or money remittance' },
    },
    transition: {},
    conflicts: {},
  },
};

// Section-level source cite per class, per profile (full citations live in node metadata
// and the fixture profile files; these travel with the output payload).
const SOURCES = {
  bermuda_psa: {
    payment_handling_provider: 'consultation response section IV (proposed Payment Handling Provider definition)',
    payment_technology_provider: 'consultation response section V (refined Payment Technology Provider definition)',
    digital_facility_provider: 'consultation response sections I and III (Digital Facility Provider custody scope)',
  },
  eu_psd2: {
    payment_handling: 'Annex I Part A service categories, read with Article 3(1) exclusions',
    execution_of_payment_transactions: 'Annex I Part A item 3',
    issuing_or_acquiring_payment_instruments: 'Annex I Part A item 5',
    money_remittance: 'Annex I Part A item 6',
    payment_initiation_service: 'Annex I Part A item 7',
    account_information_service: 'Annex I Part A item 8',
  },
  uk_psrs: {
    payment_handling: 'Schedule 1 Part 1 paragraph 1, read with Part 2 exclusions',
    execution_of_payment_transactions: 'Schedule 1 Part 1 paragraph 1(c)',
    issuing_or_acquiring_payment_instruments: 'Schedule 1 Part 1 paragraph 1(e)',
    money_remittance: 'Schedule 1 Part 1 paragraph 1(f)',
    payment_initiation_service: 'Schedule 1 Part 1 paragraph 1(g)',
    account_information_service: 'Schedule 1 Part 1 paragraph 1(h)',
  },
};

function readFacts(activities, rejected) {
  const facts = {};
  for (const f of ACTIVITY_FACTS) {
    const v = activities ? activities[f] : undefined;
    if (v === undefined || v === null) { facts[f] = false; continue; }
    if (typeof v !== 'boolean') { rejected.push({ where: `activities.${f}`, reason: 'not_a_boolean', supplied: String(v).slice(0, 40) }); facts[f] = false; continue; }
    facts[f] = v;
  }
  return facts;
}

/**
 * compute(pp) — classify declared payment activities against a regime profile.
 * @param {object} pp { profile, activities, current_licence? }
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];
  const profile_id = pp.profile;
  const profile = PROFILES[profile_id];

  // Refusal branch 1: an unknown profile cannot be classified at all. Reachable, fixture-covered.
  if (!profile) {
    return {
      output_payload: {
        refused: true,
        reason: 'unknown_profile',
        accepted_profiles: Object.keys(PROFILES),
        classes_triggered: [],
        exclusions_applied: [],
        conflicts: [],
        transition_note: null,
        regime_status: null,
        not_legal_advice: true,
      },
      compliance_flags: ['PSA_REFUSED_UNKNOWN_PROFILE'],
    };
  }

  // Refusal branch 2: missing or non-object activities. Reachable, fixture-covered.
  const activities = (pp.activities != null && typeof pp.activities === 'object' && !Array.isArray(pp.activities))
    ? pp.activities
    : null;
  if (activities == null) {
    return {
      output_payload: {
        refused: true,
        reason: 'missing_or_invalid_activities',
        accepted_profiles: Object.keys(PROFILES),
        classes_triggered: [],
        exclusions_applied: [],
        conflicts: [],
        transition_note: null,
        regime_status: profile.regime_status,
        not_legal_advice: true,
      },
      compliance_flags: ['PSA_REFUSED_MISSING_ACTIVITIES'],
    };
  }

  const facts = readFacts(activities, rejected_inputs);

  // Classes triggered: aggregate the triggering facts per class.
  /** @type {{class_id: string, triggered_by: string[], source: string|null, suppressed_by_exclusion?: boolean}[]} */
  const classes_triggered = [];
  for (const [class_id, triggers] of Object.entries(profile.classes)) {
    const triggered_by = triggers.filter((t) => facts[t]);
    if (triggered_by.length > 0) {
      classes_triggered.push({ class_id, triggered_by, source: SOURCES[profile_id][class_id] || null });
    }
  }

  // Exclusions considered: recorded per declared exclusion fact; applied only when the
  // profile makes it available and none of its blocking facts fire.
  const exclusions_applied = [];
  for (const [ex_id, rule] of Object.entries(profile.exclusions)) {
    if (facts[ex_id] !== true) continue;
    if (!rule.available) {
      exclusions_applied.push({ exclusion_id: ex_id, applied: false, reason: rule.reason_blocked });
      continue;
    }
    const blocked = rule.blocked_by.some((b) => facts[b]);
    exclusions_applied.push({
      exclusion_id: ex_id,
      applied: !blocked,
      reason: blocked ? rule.reason_blocked : rule.reason_applied,
    });
  }

  // An applied one-sided-agent or limited-network exclusion suppresses the classes the
  // same declared model would otherwise trigger (the model reads as excluded, not licensed).
  const suppressed = new Set();
  for (const ex of exclusions_applied) {
    if (!ex.applied) continue;
    if (ex.exclusion_id === 'commercial_agent_for_one_side') {
      for (const c of Object.keys(profile.classes)) suppressed.add(c);
    }
    if (ex.exclusion_id === 'limited_network') {
      suppressed.add('payment_handling');
      suppressed.add('digital_facility_provider');
    }
  }
  for (const c of classes_triggered) if (suppressed.has(c.class_id)) c.suppressed_by_exclusion = true;

  // Conflicts.
  const conflicts = [];
  if (facts.technical_service_only && facts.holds_customer_funds) {
    conflicts.push({
      conflict_id: 'TECH_CLASS_BUT_HOLDS_FUNDS',
      detail: 'the firm declares a technology-only model while also holding customer funds; the technical-service exclusion cannot hold while the provider is in possession of the funds, so a funds-handling reading applies',
    });
  }
  for (const [class_id, rule] of Object.entries(profile.conflicts)) {
    if (classes_triggered.some((c) => c.class_id === class_id) && rule.blocked_by.some((b) => facts[b])) {
      conflicts.push({ conflict_id: rule.id, detail: rule.reason });
    }
  }

  // Transition note.
  let transition_note = null;
  if (pp.current_licence != null && profile.transition[String(pp.current_licence)]) {
    transition_note = profile.transition[String(pp.current_licence)];
  } else if (profile.regime_status === 'proposed') {
    transition_note = 'the regime is proposed, not enacted: the licence classes, perimeter and transition arrangements remain subject to the Bill\u2019s drafting; no firm may treat this reading as an enacted licence determination';
  }

  const compliance_flags = [];
  if (conflicts.some((c) => c.conflict_id === 'TECH_CLASS_BUT_HOLDS_FUNDS')) compliance_flags.push('PSA_CONFLICT_TECH_CLASS_BUT_HOLDS_FUNDS');
  if (conflicts.some((c) => c.conflict_id === 'DFP_CUSTODY_LIMIT_EXCEEDED')) compliance_flags.push('PSA_CONFLICT_DFP_CUSTODY_LIMIT_EXCEEDED');
  if (profile.regime_status === 'proposed') compliance_flags.push('PSA_REGIME_PROPOSED_NOT_ENACTED');
  if (transition_note != null && pp.current_licence != null) compliance_flags.push('PSA_TRANSITION_NOTE_ISSUED');
  if (rejected_inputs.length > 0) compliance_flags.push('PSA_INPUTS_REJECTED_RECORDED');
  if (classes_triggered.length > 0 && classes_triggered.every((c) => c.suppressed_by_exclusion)) compliance_flags.push('PSA_ALL_CLASSES_SUPPRESSED_BY_EXCLUSION');

  return {
    output_payload: {
      refused: false,
      rejected_inputs,
      profile: profile_id,
      classes_triggered,
      exclusions_applied,
      conflicts,
      transition_note,
      regime_status: profile.regime_status,
      not_legal_advice: true,
    },
    compliance_flags,
  };
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
