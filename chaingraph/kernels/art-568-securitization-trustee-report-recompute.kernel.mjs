/**
 * art-568-securitization-trustee-report-recompute.kernel.mjs
 *
 * RECOMP wave (RECOMP-WAVE-BUILD-SPEC.md §3, RECOMP-TRUSTEE-1) — recomputes a
 * securitization priority-of-payments waterfall for ONE STATED PERIOD from a
 * caller-declared tier list and the period's collections/balances, then
 * compares the recomputed distribution against what the monthly trustee
 * report says was distributed.
 *
 * WHY THIS IS AN INDEPENDENT RECOMPUTATION. The left-hand side of every
 * comparison is derived HERE by allocating the period's collections down the
 * tier list in the order supplied, honouring every declared cap. It is never
 * lifted from the trustee report. A difference against the report is
 * therefore a genuine arithmetic finding, not a re-footing of a published
 * column.
 *
 * EVERYTHING EXTERNAL IS A CALLER INPUT. The tier list, its priority order,
 * caps, and trigger references all come from the deal's own indenture. There
 * is no shipped deal library and no bundled tier list. The indenture
 * reference the caller pins is echoed into the artifact, so a later
 * amendment dates an old receipt rather than falsifying it.
 *
 * TRIGGER STATES ARE CALLER-DECLARED BOOLEANS, NEVER COMPUTED FROM MARKET
 * DATA (spec §3, keeps this deterministic and zero-egress). A trigger is
 * supplied as { trigger_id, breached: true|false } by the caller; this
 * kernel never evaluates a coverage ratio, a delinquency rate, or any other
 * market figure to decide whether a trigger is breached. A tier that names a
 * trigger_id is skipped (paid zero, funds pass through) exactly when the
 * caller declares that trigger breached, and for no other reason.
 *
 * INDETERMINATE ON MISSING TIER DEFINITIONS (spec §3), and equally whenever
 * the trustee-reported distribution needed for the comparison is absent
 * (Common wave doctrine: "INDETERMINATE whenever a required input is
 * absent -- never guess, never default"). A reader holding only the
 * artifact can distinguish "we recomputed and it agreed", "we recomputed
 * and it diverged", and "there was nothing usable to recompute against".
 *
 * FIXED-POINT MONEY MATH. Every amount crosses the boundary as an INTEGER
 * NUMBER OF MINOR UNITS. Allocation, capping, shortfall and residual are
 * integer operations; the 2dp display strings come from integer division
 * plus string padding, never from toFixed() on a float.
 *
 * FINITE GATE. Zero collections, an empty tier list, and a tier naming a
 * collection type that was not supplied each resolve to a DEFINED result.
 * No branch can emit NaN, Infinity, or an undefined state. A value that is
 * not a usable integer amount is coerced to 0 AND named in
 * rejected_inputs[], never silently dropped.
 *
 * THIS IS NOT A COMPLIANCE DETERMINATION OR AN ACCOUNTING OPINION. A
 * divergence against the trustee report is an arithmetic finding about the
 * tier list and figures supplied here. The deal's indenture governs, never
 * this kernel.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Note on design lineage: this kernel shares a tier-engine SHAPE with
 * art-509-recompute-payment-waterfall (RECOMP-WATERFALL-1's securitization
 * sibling) -- both allocate a caller-declared priority list down available
 * funds -- but it is an INDEPENDENT implementation, imports nothing from
 * art-509, and answers a different vocabulary (trustee report vs. investor
 * report, tiers with a declared type vs. undifferentiated steps, boolean
 * triggers vs. measured ratio/amount tests).
 *
 * Spec: RECOMP-WAVE-BUILD-SPEC.md §3, §Common.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-568-securitization-trustee-report-recompute';
const TOOL_VERSION = '1.0.0';
export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_trustee_report_waterfall',
  mandate_type: 'analytics_mandate',
  gpu: false,
};

const TIER_TYPES = ['fees', 'interest', 'principal', 'reserve', 'residual'];

const CITATIONS = {
  mechanics_reference: {
    source: 'OCC Comptroller\'s Handbook -- Asset Securitization',
    detail: 'Referenced as a mechanics description of priority-of-payments structures, not as the governing document.',
  },
  governing_document: {
    source: 'The deal\'s own indenture / pooling and servicing agreement',
    detail: 'The tier list, priority order, caps and trigger definitions used by this kernel are taken from the indenture the caller pins in indenture_ref. The indenture governs; this kernel does not.',
  },
};

const NOT_PROVEN = [
  { item: 'Compliance or audit opinion', detail: 'This kernel recomputes an arithmetic allocation from a caller-declared tier list and caller-supplied collections. It is never a compliance determination, never an audit opinion, and never a finding that the deal was administered correctly.' },
  { item: 'Trigger accuracy', detail: 'Trigger states are caller-declared booleans, never computed here from market data, collateral performance, or any other source. This kernel attests only that the declared state was applied to the tier list as declared.' },
  { item: 'Tier-list completeness', detail: 'The tier list, caps and trigger references are caller-supplied from the indenture. This kernel does not verify that the supplied list matches the indenture, only that the arithmetic over the supplied list is correct.' },
  { item: 'Collections accuracy', detail: 'Period collections and balances are caller-supplied and asserted, not independently verified against servicer records or any external source.' },
];

const MINOR_UNIT_EXPONENT = 2;
const MINOR_SCALE = 100;

function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function toMinorUnits(v, where, rejected) {
  if (isSafeIntAmount(v)) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return 0; }
  rejected.push({
    where,
    reason: typeof v === 'number' ? 'not a safe integer number of minor units' : `expected an integer number of minor units, got ${typeof v}`,
    supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v),
  });
  return 0;
}
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / MINOR_SCALE);
  const frac = abs - whole * MINOR_SCALE;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(MINOR_UNIT_EXPONENT, '0');
}
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const deal_ref = str(pp.deal_ref, 'UNSTATED');
  const period_label = str(pp.period_label, 'UNSTATED');
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';

  const indentureRefIn = obj(pp.indenture_ref);
  const indenture_ref = {
    document_ref: str(indentureRefIn.document_ref, 'UNSTATED'),
    section_ref: str(indentureRefIn.section_ref, 'UNSTATED'),
    version: str(indentureRefIn.version, 'UNSTATED'),
    dated: str(indentureRefIn.dated, 'UNSTATED'),
    supplied: pp.indenture_ref !== undefined && pp.indenture_ref !== null,
  };

  // ── Period collections / balances by declared collection_type. ─────────────
  const suppliedCollections = arr(pp.period_collections);
  const pools = {};
  const collectionTypes = [];
  for (let i = 0; i < suppliedCollections.length; i++) {
    const c = obj(suppliedCollections[i]);
    const collection_type = str(c.collection_type, `POOL-${i + 1}`);
    const amount = toMinorUnits(
      c.amount_minor_units,
      `period_collections[${i}].amount_minor_units`,
      rejected_inputs,
    );
    if (pools[collection_type] === undefined) { pools[collection_type] = 0; collectionTypes.push(collection_type); }
    pools[collection_type] += amount;
  }
  if (collectionTypes.length === 0) {
    rejected_inputs.push({ where: 'period_collections', reason: 'absent', supplied: null });
  }
  const default_pool = collectionTypes.length > 0 ? collectionTypes[0] : 'combined';
  if (collectionTypes.length === 0) { pools[default_pool] = 0; collectionTypes.push(default_pool); }
  const opening_pools = {};
  for (const t of collectionTypes) opening_pools[t] = pools[t];
  let total_collections_minor_units = 0;
  for (const t of collectionTypes) total_collections_minor_units += pools[t];

  // ── Triggers: caller-declared booleans only. ────────────────────────────────
  const triggers_by_id = {};
  const triggers_evaluated = arr(pp.triggers).map((raw, i) => {
    const t = obj(raw);
    const trigger_id = str(t.trigger_id, `TRIGGER-${i + 1}`);
    const breached = t.breached === true;
    triggers_by_id[trigger_id] = breached;
    return {
      trigger_id,
      label: str(t.label, trigger_id),
      breached,
      basis: str(t.basis, 'Declared by the caller from the indenture; never computed from market data by this kernel.'),
    };
  });

  // ── Tier list, allocated in the order supplied (priority order). ───────────
  const tiersIn = arr(pp.tiers);
  const tiers = [];
  let first_unfunded_tier = null;

  for (let i = 0; i < tiersIn.length; i++) {
    const t = obj(tiersIn[i]);
    const tier_id = str(t.tier_id, `TIER-${i + 1}`);
    const typeSupplied = str(t.type, '');
    const type = TIER_TYPES.indexOf(typeSupplied) !== -1 ? typeSupplied : null;
    if (type === null) {
      rejected_inputs.push({
        where: `tiers[${i}].type`,
        reason: typeSupplied === '' ? 'absent' : 'not one of fees, interest, principal, reserve, residual',
        supplied: typeSupplied === '' ? null : typeSupplied,
      });
    }
    const collection_type = str(t.collection_type, default_pool);
    const pool_known = Object.prototype.hasOwnProperty.call(pools, collection_type);
    if (!pool_known) {
      rejected_inputs.push({
        where: `tiers[${i}].collection_type`,
        reason: 'names a collection_type that was not supplied in period_collections, so its pool is zero',
        supplied: collection_type,
      });
    }

    const claim_minor_units = toMinorUnits(
      t.amount_due_minor_units,
      `tiers[${i}].amount_due_minor_units`,
      rejected_inputs,
    );
    const capSupplied = t.cap_minor_units !== undefined && t.cap_minor_units !== null;
    const cap_minor_units = capSupplied ? toMinorUnits(t.cap_minor_units, `tiers[${i}].cap_minor_units`, rejected_inputs) : null;
    const cap_applied = capSupplied && cap_minor_units < claim_minor_units;
    const due_minor_units = cap_applied ? cap_minor_units : claim_minor_units;

    const trigger_id = t.trigger_id !== undefined && t.trigger_id !== null ? str(t.trigger_id, null) : null;
    const trigger_declared = trigger_id !== null && Object.prototype.hasOwnProperty.call(triggers_by_id, trigger_id);
    if (trigger_id !== null && !trigger_declared) {
      rejected_inputs.push({
        where: `tiers[${i}].trigger_id`,
        reason: 'names a trigger_id that was not declared in triggers[], so it is treated as not breached',
        supplied: trigger_id,
      });
    }
    const skipped_by_trigger = trigger_declared && triggers_by_id[trigger_id] === true ? trigger_id : null;

    const available = pool_known ? pools[collection_type] : 0;
    const payable = due_minor_units > 0 ? due_minor_units : 0;
    const paid_minor_units = skipped_by_trigger !== null ? 0 : (available < payable ? (available > 0 ? available : 0) : payable);
    const shortfall_minor_units = skipped_by_trigger !== null ? 0 : payable - paid_minor_units;
    if (pool_known) pools[collection_type] = available - paid_minor_units;

    if (first_unfunded_tier === null && shortfall_minor_units > 0) first_unfunded_tier = tier_id;

    tiers.push({
      tier_id,
      label: str(t.label, tier_id),
      type,
      basis: str(t.basis, 'Declared by the caller from the deal indenture.'),
      collection_type,
      collection_type_supplied: pool_known,
      position: i + 1,
      claim_minor_units,
      claim_display: display(claim_minor_units),
      cap_minor_units,
      cap_display: cap_minor_units === null ? null : display(cap_minor_units),
      cap_applied,
      due_minor_units: payable,
      due_display: display(payable),
      trigger_id,
      skipped_by_trigger,
      paid_minor_units,
      paid_display: display(paid_minor_units),
      shortfall_minor_units,
      shortfall_display: display(shortfall_minor_units),
      fully_paid: skipped_by_trigger === null && shortfall_minor_units === 0,
    });
  }

  const residual_by_type = collectionTypes.map((t) => ({
    collection_type: t,
    opening_minor_units: opening_pools[t],
    opening_display: display(opening_pools[t]),
    residual_minor_units: pools[t],
    residual_display: display(pools[t]),
  }));
  let residual_minor_units = 0;
  for (const r of residual_by_type) residual_minor_units += r.residual_minor_units;

  let total_paid_minor_units = 0;
  let total_shortfall_minor_units = 0;
  for (const t of tiers) { total_paid_minor_units += t.paid_minor_units; total_shortfall_minor_units += t.shortfall_minor_units; }

  const skipped_tier_count = tiers.filter((t) => t.skipped_by_trigger !== null).length;

  // ── Comparison against the trustee-reported distribution. ──────────────────
  const trusteeSupplied = pp.trustee_reported_distribution !== undefined && pp.trustee_reported_distribution !== null
    && arr(pp.trustee_reported_distribution).length > 0;
  const diff = [];
  if (trusteeSupplied) {
    const reportedRows = arr(pp.trustee_reported_distribution);
    const seen = [];
    for (let i = 0; i < reportedRows.length; i++) {
      const r = obj(reportedRows[i]);
      const tier_id = str(r.tier_id, `REPORTED-${i + 1}`);
      seen.push(tier_id);
      const reported_minor_units = toMinorUnits(r.amount_minor_units, `trustee_reported_distribution[${i}].amount_minor_units`, rejected_inputs);
      const match = tiers.filter((t) => t.tier_id === tier_id)[0];
      if (match === undefined) {
        diff.push({
          tier_id, in_tier_list: false,
          recomputed_minor_units: null, recomputed_display: null,
          reported_minor_units, reported_display: display(reported_minor_units),
          difference_minor_units: null, difference_display: null, agrees: false,
          detail: 'The trustee report names a distribution for a tier that is not in the tier list supplied. It is carried here rather than dropped; the tier list may be incomplete.',
        });
      } else {
        const difference_minor_units = match.paid_minor_units - reported_minor_units;
        diff.push({
          tier_id, in_tier_list: true,
          recomputed_minor_units: match.paid_minor_units, recomputed_display: match.paid_display,
          reported_minor_units, reported_display: display(reported_minor_units),
          difference_minor_units, difference_display: display(difference_minor_units),
          agrees: difference_minor_units === 0,
          detail: difference_minor_units === 0
            ? 'The independently recomputed distribution equals the amount the trustee report states for this tier.'
            : 'The independently recomputed distribution differs from the amount the trustee report states for this tier.',
        });
      }
    }
    for (const t of tiers) {
      if (seen.indexOf(t.tier_id) === -1) {
        diff.push({
          tier_id: t.tier_id, in_tier_list: true,
          recomputed_minor_units: t.paid_minor_units, recomputed_display: t.paid_display,
          reported_minor_units: null, reported_display: null,
          difference_minor_units: null, difference_display: null, agrees: false,
          detail: 'The tier list has this tier but the trustee report names no figure for it, so there is nothing to compare against.',
        });
      }
    }
  }

  const disagreeing = diff.filter((d) => !d.agrees);

  // ── Verdict. INDETERMINATE takes priority over MATCHES/DIVERGES whenever a
  //    required input is absent -- never guessed, never defaulted. ───────────
  let verdict;
  let indeterminate_reason;
  if (tiers.length === 0) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No tier definitions were supplied, so no waterfall could be recomputed.';
  } else if (!trusteeSupplied) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No trustee-reported distribution was supplied, so the recomputed allocation has nothing to compare against.';
  } else {
    verdict = disagreeing.length === 0 ? 'MATCHES' : 'DIVERGES';
    indeterminate_reason = null;
  }

  // ── Rationale. ───────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Waterfall recomputed for period ${period_label} on deal reference ${deal_ref}, against the tier list pinned as ${indenture_ref.document_ref} ${indenture_ref.section_ref} version ${indenture_ref.version} dated ${indenture_ref.dated}.`);
  if (!indenture_ref.supplied) {
    rationale.push('No indenture reference was supplied, so the artifact cannot say which version of the governing document this recomputation followed. A receipt without that pin cannot be dated against a later amendment.');
  }
  rationale.push(`Total period collections of ${display(total_collections_minor_units)} ${currency} across ${collectionTypes.length} collection type${collectionTypes.length === 1 ? '' : 's'} were allocated down ${tiers.length} tier${tiers.length === 1 ? '' : 's'} in the order supplied, honouring every declared cap.`);
  if (triggers_evaluated.length === 0) {
    rationale.push('No triggers were declared, so no tier was skipped for a trigger reason.');
  } else {
    const breachedCount = triggers_evaluated.filter((t) => t.breached).length;
    rationale.push(`${triggers_evaluated.length} trigger${triggers_evaluated.length === 1 ? '' : 's'} declared, ${breachedCount} reported breached. Trigger states are caller-declared booleans only -- this kernel computes none of them from market or collateral data.`);
    if (skipped_tier_count > 0) {
      rationale.push(`${skipped_tier_count} tier${skipped_tier_count === 1 ? '' : 's'} skipped because the trigger named against ${skipped_tier_count === 1 ? 'it' : 'them'} was declared breached; the funds due passed through to the next tier in order.`);
    }
  }
  rationale.push(first_unfunded_tier === null
    ? 'Every tier was met in full from the collections available, so no tier ran out of money.'
    : `Collections ran out at tier ${first_unfunded_tier}, the first tier whose claim could not be met in full. Total shortfall across the tier list is ${display(total_shortfall_minor_units)} ${currency}.`);
  rationale.push(`Residual after the tier list is ${display(residual_minor_units)} ${currency}.`);
  rationale.push(verdict === 'INDETERMINATE'
    ? `Verdict is INDETERMINATE: ${indeterminate_reason}`
    : verdict === 'MATCHES'
      ? `The independently recomputed distribution agrees with every one of the ${diff.length} tier${diff.length === 1 ? '' : 's'} the trustee report states a figure for. The left-hand side was computed here from the tier list, not lifted from the report.`
      : `The independently recomputed distribution diverges from the trustee report on ${disagreeing.length} of ${diff.length} tier${diff.length === 1 ? '' : 's'}. Each difference is listed with both figures. A divergence is an arithmetic finding about the tier list and figures supplied here, not a determination that the deal was administered incorrectly.`);
  if (rejected_inputs.length > 0) {
    rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable and ${rejected_inputs.length === 1 ? 'was' : 'were'} treated as zero, ignored, or unevaluable. Each one is named in rejected_inputs rather than silently dropped.`);
  }
  rationale.push('The deal\'s indenture governs the priority of payments; this kernel recomputes the arithmetic over the tier list the caller declared from it, and makes no assertion that the deal complies with anything.');

  // ── Flags. ───────────────────────────────────────────────────────────────
  const compliance_flags = ['TRUSTEE_WFALL_RECOMPUTED'];
  compliance_flags.push(verdict === 'INDETERMINATE' ? 'TRUSTEE_WFALL_INDETERMINATE' : verdict === 'MATCHES' ? 'TRUSTEE_WFALL_MATCHES' : 'TRUSTEE_WFALL_DIVERGES');
  if (total_shortfall_minor_units > 0) compliance_flags.push('TRUSTEE_WFALL_SHORTFALL');
  if (verdict === 'DIVERGES' || total_shortfall_minor_units > 0) compliance_flags.push('ESCALATION_RAISED');
  if (skipped_tier_count > 0) compliance_flags.push('TRUSTEE_WFALL_TRIGGER_SKIP_APPLIED');
  if (!indenture_ref.supplied) compliance_flags.push('TRUSTEE_WFALL_INDENTURE_REF_ABSENT');
  if (tiers.length === 0) compliance_flags.push('TRUSTEE_WFALL_TIER_LIST_EMPTY');
  if (total_collections_minor_units === 0) compliance_flags.push('TRUSTEE_WFALL_NO_COLLECTIONS');
  if (rejected_inputs.length > 0) compliance_flags.push('TRUSTEE_WFALL_INPUTS_REJECTED');

  const output_payload = {
    deal_ref,
    period_label,
    currency,
    minor_unit_exponent: MINOR_UNIT_EXPONENT,
    indenture_ref,
    collections_by_type: collectionTypes.map((t) => ({ collection_type: t, opening_minor_units: opening_pools[t], opening_display: display(opening_pools[t]) })),
    total_collections_minor_units,
    total_collections_display: display(total_collections_minor_units),
    tier_count: tiers.length,
    skipped_tier_count,
    tiers,
    first_unfunded_tier,
    total_paid_minor_units,
    total_paid_display: display(total_paid_minor_units),
    total_shortfall_minor_units,
    total_shortfall_display: display(total_shortfall_minor_units),
    residual_by_type,
    residual_minor_units,
    residual_display: display(residual_minor_units),
    triggers_evaluated,
    trustee_reported_supplied: trusteeSupplied,
    comparison_basis: 'The recomputed side of every comparison is derived here by allocating the caller-supplied period collections down the caller-declared tier list. It is not read from the trustee report. A comparison is only meaningful because the two sides have independent provenance.',
    diff,
    verdict,
    indeterminate_reason,
    rejected_inputs,
    citations: CITATIONS,
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'Trigger states are caller-declared booleans, never computed from market or collateral data. This kernel recomputes the arithmetic of a priority-of-payments waterfall over a caller-declared tier list and caller-supplied period collections, and compares it against the trustee-reported distribution where supplied. It is never a compliance determination, never an audit opinion, and never advice. The deal indenture governs.',
    note: 'Deterministic securitization trustee-report waterfall recomputation for one stated period. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It forecasts nothing, models no scenario, performs no credit or rating analysis, and makes no assertion about the compliance status of the deal.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
