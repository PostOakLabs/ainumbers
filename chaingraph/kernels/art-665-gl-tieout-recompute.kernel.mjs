/**
 * art-665-gl-tieout-recompute.kernel.mjs
 *
 * CORE VERIFY wave (CORE-VERIFY-BUILD-SPEC.md Sec0, Sec6, CORE-VERIFY-GLTIEOUT-1) --
 * independently re-derives subledger-to-GL tie-out totals from a caller-supplied posted
 * ledger and the caller's OWN declared product_code -> gl_account_code chart-of-accounts
 * mapping, then supports two independent recompute modes:
 *
 *   - SINGLE-SOURCE MODE: sums ledger rows per GL account code for the stated period and
 *     diffs the recomputed totals against caller-supplied reported trial-balance figures
 *     (e.g. the core's own GL trial balance).
 *   - DIFF MODE: runs the same per-account-code summation independently over TWO full
 *     ledger sources (e.g. a legacy-core export and a new-core export covering the same
 *     period during a core conversion) and diffs the two recomputed totals against EACH
 *     OTHER. No side is asserted correct -- both figures are independently derived here
 *     and the diff is reported symmetrically, labeled source_a / source_b.
 *
 * POSITIONING (binding, CORE-VERIFY-BUILD-SPEC.md's guardrails). This is an independent
 * recompute-and-receipt tool, never a claim to "find the vendor's bugs" or "audit your
 * vendor", never a core alternative or substitute for any core platform, and never an
 * endorsement claim by or about any core vendor. It makes NO determination of legality or
 * accounting-standard compliance about the chart-of-accounts mapping it is given -- that
 * mapping (which product_code rolls up to which gl_account_code) is a caller-declared
 * input, never chosen or inferred by this kernel. A difference between the recomputed and
 * reported/compared figures is reported as a divergence in the arithmetic, never as an
 * incorrect assessment, an impermissible practice, or an amount owed -- the interpretation
 * of any divergence belongs to the caller.
 *
 * WHY THIS IS AN INDEPENDENT RECOMPUTATION. Every GL account-code total here is derived
 * from the posted ledger rows and the declared chart-of-accounts mapping -- never lifted
 * from a reported trial-balance figure (single-source mode) or from the other source's own
 * total (diff mode). A divergence is therefore a genuine arithmetic finding about the
 * figures supplied, not a re-footing of a published total.
 *
 * INPUT CONTRACT (CORE-VERIFY-BUILD-SPEC.md Sec0). Ledger rows carry the Sec0 shape
 * (account_token, post_date, effective_date, txn_type, amount, running_balance,
 * product_code, description_code); this kernel uses only post_date and product_code plus
 * amount (already an integer number of minor units at this boundary -- see FIXED-POINT
 * MONEY MATH below). The product_code -> gl_account_code mapping is the Sec0
 * "caller-declared mapping" for this chain, supplied once per source as
 * gl_account_mapping. A ledger row whose product_code is absent, or is not present in the
 * declared mapping, is excluded from every GL account-code total and named in
 * rejected_inputs[] -- it is never guessed toward a GL account code.
 *
 * SINGLE-SOURCE MODE. Inputs: period_label, ledger[], gl_account_mapping{}, and
 * reported_trial_balance[] (one row per gl_account_code with the core-reported figure to
 * tie out against). Output: per-account-code computed_total vs reported_total, a delta,
 * and an overall verdict.
 *
 * DIFF MODE. Inputs: period_label, source_a{ label, ledger[], gl_account_mapping{} } and
 * source_b{ label, ledger[], gl_account_mapping{} } -- two full runs over the same stated
 * period (e.g. legacy-core export vs new-core export for conversion balancing). Each
 * source's totals are computed independently from its OWN ledger and its OWN declared
 * mapping (a core conversion may use different chart-of-accounts mappings on each side).
 * Output is symmetric: per_account_deltas rows carry source_a_total_minor_units and
 * source_b_total_minor_units side by side, with no field or verdict asserting which side,
 * if either, is correct.
 *
 * FIXED-POINT MONEY MATH. Every amount crosses the boundary as an INTEGER number of minor
 * units (cents). No floating-point money arithmetic anywhere in compute(); 2dp display
 * strings come from integer division plus string padding, never toFixed() on a float.
 *
 * NEVER GUESS, NEVER DEFAULT (CORE-VERIFY-BUILD-SPEC.md's top-level doctrine). An absent or
 * invalid mode, an unmapped product_code, or a missing comparison side each resolves to
 * verdict INDETERMINATE with the specific missing/invalid input named -- never guessed
 * toward MATCHES or silently treated as zero activity.
 *
 * FINITE GATE. Malformed input (wrong type, missing fields, an unrecognised mode) never
 * throws -- compute() always returns a defined output_payload with the offending field(s)
 * named in rejected_inputs[] and verdict INDETERMINATE where nothing usable was supplied.
 *
 * NOT A COMPLIANCE OR ACCOUNTING-STANDARDS DETERMINATION. This is internal-control
 * arithmetic (summation and diff), not a citation-bearing standards implementation --
 * standards_basis is "not_applicable" in this node's metadata (CORE-VERIFY-BUILD-SPEC.md
 * Sec6: "cite the bank's own chart-of-accounts mapping as the input, not an external
 * standard").
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: CORE-VERIFY-BUILD-SPEC.md Sec0, Sec6.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-665-gl-tieout-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_gl_tieout_recompute',
  mandate_type: 'compliance_control',
  gpu: false,
};

const MODES = ['single', 'diff'];

const NOT_PROVEN = [
  { item: 'Not an accounting-standard or legality determination', detail: 'This kernel recomputes GL tie-out arithmetic given the caller\'s own declared product_code -> gl_account_code mapping. It makes no claim about whether that mapping, the ledger, or the reported/compared figures comply with any accounting standard, GAAP treatment, or regulation.' },
  { item: 'Chart-of-accounts mapping is caller-asserted', detail: 'The product_code -> gl_account_code mapping is a caller-declared chart-of-accounts mapping, never inferred or independently verified against the bank\'s own general-ledger system by this kernel.' },
  { item: 'No per-core export adapter', detail: 'This kernel consumes only the Sec0 generic ledger CSV shape (mapped by the caller to the JSON fields below). It does not read any core\'s native export format (Episys, SilverLake, DNA, Premier, or otherwise) and makes no claim about those formats.' },
  { item: 'Diff mode asserts no correct side', detail: 'In diff mode, a divergence between source_a and source_b is reported symmetrically as a conversion-balancing finding. This kernel does not determine which source, if either, holds the legally or operationally correct figure.' },
  { item: 'Input accuracy', detail: 'The ledger rows, chart-of-accounts mapping, and reported/comparison figures are caller-supplied and asserted, not independently verified against source records.' },
];

const MINOR_UNIT_EXPONENT = 2;
const MINOR_SCALE = 100;

function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function toSignedMinorUnits(v, where, rejected) {
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
function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function isDateStr(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }

/** Normalizes a Sec0-shaped ledger array down to the {post_date, product_code, amount_minor_units} this chain uses. */
function normalizeLedger(raw, prefix, rejected) {
  const present = Array.isArray(raw);
  if (!present) rejected.push({ where: prefix, reason: 'absent or not an array; treated as an empty ledger', supplied: null });
  const rows = present ? raw : [];
  return rows.map((raw0, i) => {
    const r = isPlainObject(raw0) ? raw0 : {};
    const post_date = isDateStr(r.post_date) ? r.post_date : null;
    if (post_date === null) rejected.push({ where: `${prefix}[${i}].post_date`, reason: 'absent or not YYYY-MM-DD', supplied: r.post_date === undefined ? null : String(r.post_date) });
    const product_code_supplied = isNonEmptyString(r.product_code);
    const product_code = product_code_supplied ? r.product_code.trim() : null;
    if (!product_code_supplied) rejected.push({ where: `${prefix}[${i}].product_code`, reason: 'absent; row excluded from tie-out (no GL account-code lookup possible)', supplied: r.product_code === undefined ? null : String(r.product_code) });
    const amount_minor_units = toSignedMinorUnits(r.amount, `${prefix}[${i}].amount`, rejected);
    return { idx: i, post_date, product_code, amount_minor_units };
  });
}

/** Normalizes a caller-declared product_code -> gl_account_code mapping object. */
function normalizeMapping(raw, prefix, rejected) {
  const mapping = {};
  if (!isPlainObject(raw)) {
    rejected.push({ where: prefix, reason: 'absent or not an object; no product_code -> gl_account_code mapping usable', supplied: null });
    return { mapping, valid: false };
  }
  let any = false;
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    if (isNonEmptyString(v)) { mapping[k] = v.trim(); any = true; }
    else rejected.push({ where: `${prefix}.${k}`, reason: 'gl_account_code must be a non-empty string', supplied: v === undefined ? null : v });
  }
  if (!any && Object.keys(raw).length === 0) rejected.push({ where: prefix, reason: 'declared but empty; no product_code -> gl_account_code mapping usable', supplied: null });
  return { mapping, valid: any };
}

/** Sums a normalized ledger into GL-account-code buckets under a normalized mapping. Unmapped rows are excluded and named. */
function sumByAccount(ledgerRows, mapping, prefix, rejected) {
  const buckets = {};
  let mappedCount = 0;
  for (const row of ledgerRows) {
    if (row.product_code === null) continue; // already named in rejected_inputs by normalizeLedger
    const gl = mapping[row.product_code];
    if (!gl) {
      rejected.push({ where: `${prefix}[${row.idx}].product_code`, reason: `"${row.product_code}" is not present in the declared gl_account_mapping; row excluded from the tie-out`, supplied: row.product_code });
      continue;
    }
    buckets[gl] = (buckets[gl] || 0) + row.amount_minor_units;
    mappedCount += 1;
  }
  return { buckets, mappedCount };
}

/** Normalizes a reported-trial-balance array ({gl_account_code, amount_minor_units} rows) into GL-account-code buckets. */
function normalizeReported(raw, prefix, rejected) {
  const present = Array.isArray(raw) && raw.length > 0;
  if (!Array.isArray(raw)) rejected.push({ where: prefix, reason: 'absent or not an array; treated as no reported figures supplied', supplied: null });
  const rows = Array.isArray(raw) ? raw : [];
  const buckets = {};
  rows.forEach((raw0, i) => {
    const r = isPlainObject(raw0) ? raw0 : {};
    const codeSupplied = isNonEmptyString(r.gl_account_code);
    const code = codeSupplied ? r.gl_account_code.trim() : null;
    if (!codeSupplied) { rejected.push({ where: `${prefix}[${i}].gl_account_code`, reason: 'absent; row excluded', supplied: r.gl_account_code === undefined ? null : String(r.gl_account_code) }); return; }
    const amt = toSignedMinorUnits(r.amount_minor_units, `${prefix}[${i}].amount_minor_units`, rejected);
    buckets[code] = (buckets[code] || 0) + amt;
  });
  return { buckets, present };
}

function buildSingleDeltas(computed, reported) {
  const codes = Array.from(new Set([...Object.keys(computed), ...Object.keys(reported)])).sort();
  return codes.map((code) => {
    const c = computed[code] || 0;
    const r = reported[code] || 0;
    const delta = c - r;
    return {
      gl_account_code: code,
      computed_total_minor_units: c, computed_total_display: display(c),
      reported_total_minor_units: r, reported_total_display: display(r),
      delta_minor_units: delta, delta_display: display(delta),
      agrees: delta === 0,
    };
  });
}

function buildDiffDeltas(totalsA, totalsB) {
  const codes = Array.from(new Set([...Object.keys(totalsA), ...Object.keys(totalsB)])).sort();
  return codes.map((code) => {
    const a = totalsA[code] || 0;
    const b = totalsB[code] || 0;
    const delta = a - b;
    return {
      gl_account_code: code,
      source_a_total_minor_units: a, source_a_total_display: display(a),
      source_b_total_minor_units: b, source_b_total_display: display(b),
      delta_minor_units: delta, delta_display: display(delta),
      agrees: delta === 0,
    };
  });
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const period_label = str(pp.period_label, 'UNSTATED');
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';

  const modeSupplied = isNonEmptyString(pp.mode);
  const mode = modeSupplied && MODES.indexOf(pp.mode.trim()) !== -1 ? pp.mode.trim() : null;
  if (!mode) rejected_inputs.push({ where: 'mode', reason: `absent or not one of ${MODES.join(', ')}; no recompute is possible without a declared mode`, supplied: modeSupplied ? pp.mode : null });

  let single_source = null;
  let diff_sources = null;
  let verdict, indeterminate_reason;
  const rationale = [];

  if (mode === 'single') {
    const ledger = normalizeLedger(pp.ledger, 'ledger', rejected_inputs);
    const { mapping, valid: mappingValid } = normalizeMapping(pp.gl_account_mapping, 'gl_account_mapping', rejected_inputs);
    const { buckets: computed, mappedCount } = sumByAccount(ledger, mapping, 'ledger', rejected_inputs);
    const { buckets: reported, present: reportedSupplied } = normalizeReported(pp.reported_trial_balance, 'reported_trial_balance', rejected_inputs);
    const per_account_deltas = buildSingleDeltas(computed, reported);
    const disagreeing = per_account_deltas.filter((d) => !d.agrees);

    if (ledger.length === 0) {
      verdict = 'INDETERMINATE';
      indeterminate_reason = 'No usable ledger rows were supplied, so no GL account-code totals could be recomputed.';
    } else if (!mappingValid) {
      verdict = 'INDETERMINATE';
      indeterminate_reason = 'No usable product_code -> gl_account_code mapping was declared, so no ledger row could be attributed to a GL account.';
    } else if (mappedCount === 0) {
      verdict = 'INDETERMINATE';
      indeterminate_reason = 'None of the supplied ledger rows\' product_code values matched an entry in the declared gl_account_mapping.';
    } else if (!reportedSupplied) {
      verdict = 'INDETERMINATE';
      indeterminate_reason = 'No reported trial-balance figures were supplied, so the recomputed totals have nothing to tie out against.';
    } else {
      verdict = disagreeing.length === 0 ? 'MATCHES' : 'DIVERGES';
      indeterminate_reason = null;
    }

    single_source = {
      gl_account_mapping: mapping,
      ledger_row_count: ledger.length,
      mapped_row_count: mappedCount,
      computed_totals: Object.keys(computed).sort().map((code) => ({ gl_account_code: code, computed_total_minor_units: computed[code], computed_total_display: display(computed[code]) })),
      reported_trial_balance_supplied: reportedSupplied,
      reported_totals: Object.keys(reported).sort().map((code) => ({ gl_account_code: code, reported_total_minor_units: reported[code], reported_total_display: display(reported[code]) })),
      comparison_basis: 'The computed side of every account-code row is derived here by summing the supplied ledger rows under the declared product_code -> gl_account_code mapping. It is not read from the reported trial-balance figures.',
      per_account_deltas,
    };

    rationale.push(`GL tie-out recomputed for period ${period_label}, currency ${currency}, single-source mode.`);
    rationale.push(`${ledger.length} ledger row${ledger.length === 1 ? '' : 's'} were supplied; ${mappedCount} were attributable to a GL account code under the declared product_code -> gl_account_code mapping.`);
    rationale.push(`Computed totals span ${single_source.computed_totals.length} GL account code${single_source.computed_totals.length === 1 ? '' : 's'}; reported trial-balance figures were supplied for ${single_source.reported_totals.length} account code${single_source.reported_totals.length === 1 ? '' : 's'}.`);
    rationale.push(verdict === 'INDETERMINATE'
      ? `Verdict is INDETERMINATE: ${indeterminate_reason}`
      : verdict === 'MATCHES'
        ? `The independently recomputed GL totals agree with the reported trial-balance figures on every one of the ${per_account_deltas.length} account code${per_account_deltas.length === 1 ? '' : 's'} compared.`
        : `The independently recomputed GL totals diverge from the reported trial-balance figures on ${disagreeing.length} of ${per_account_deltas.length} account code${per_account_deltas.length === 1 ? '' : 's'}. Each divergence is listed with both figures.`);
  } else if (mode === 'diff') {
    const aSupplied = isPlainObject(pp.source_a);
    const bSupplied = isPlainObject(pp.source_b);
    if (!aSupplied) rejected_inputs.push({ where: 'source_a', reason: 'absent or not an object', supplied: null });
    if (!bSupplied) rejected_inputs.push({ where: 'source_b', reason: 'absent or not an object', supplied: null });
    const a = aSupplied ? pp.source_a : {};
    const b = bSupplied ? pp.source_b : {};

    const labelA = str(a.label, 'SOURCE_A');
    const labelB = str(b.label, 'SOURCE_B');
    const ledgerA = normalizeLedger(a.ledger, 'source_a.ledger', rejected_inputs);
    const ledgerB = normalizeLedger(b.ledger, 'source_b.ledger', rejected_inputs);
    const { mapping: mappingA, valid: mappingAValid } = normalizeMapping(a.gl_account_mapping, 'source_a.gl_account_mapping', rejected_inputs);
    const { mapping: mappingB, valid: mappingBValid } = normalizeMapping(b.gl_account_mapping, 'source_b.gl_account_mapping', rejected_inputs);
    const { buckets: totalsA, mappedCount: mappedA } = sumByAccount(ledgerA, mappingA, 'source_a.ledger', rejected_inputs);
    const { buckets: totalsB, mappedCount: mappedB } = sumByAccount(ledgerB, mappingB, 'source_b.ledger', rejected_inputs);
    const per_account_deltas = buildDiffDeltas(totalsA, totalsB);
    const disagreeing = per_account_deltas.filter((d) => !d.agrees);

    if (ledgerA.length === 0 || ledgerB.length === 0) {
      verdict = 'INDETERMINATE';
      indeterminate_reason = 'One or both sources supplied no usable ledger rows, so no conversion-balancing diff could be recomputed.';
    } else if (!mappingAValid || !mappingBValid) {
      verdict = 'INDETERMINATE';
      indeterminate_reason = 'One or both sources declared no usable product_code -> gl_account_code mapping.';
    } else if (mappedA === 0 || mappedB === 0) {
      verdict = 'INDETERMINATE';
      indeterminate_reason = 'One or both sources had no ledger row whose product_code matched its own declared gl_account_mapping.';
    } else {
      verdict = disagreeing.length === 0 ? 'MATCHES' : 'DIVERGES';
      indeterminate_reason = null;
    }

    diff_sources = {
      source_a: { label: labelA, gl_account_mapping: mappingA, ledger_row_count: ledgerA.length, mapped_row_count: mappedA, totals: Object.keys(totalsA).sort().map((code) => ({ gl_account_code: code, total_minor_units: totalsA[code], total_display: display(totalsA[code]) })) },
      source_b: { label: labelB, gl_account_mapping: mappingB, ledger_row_count: ledgerB.length, mapped_row_count: mappedB, totals: Object.keys(totalsB).sort().map((code) => ({ gl_account_code: code, total_minor_units: totalsB[code], total_display: display(totalsB[code]) })) },
      comparison_basis: 'Both sides are derived here from their own supplied ledger rows and their own declared product_code -> gl_account_code mapping. Neither side is treated as the correct figure -- a difference is reported symmetrically as a conversion-balancing finding.',
      per_account_deltas,
    };

    rationale.push(`GL tie-out recomputed for period ${period_label}, currency ${currency}, diff mode -- ${labelA} versus ${labelB}.`);
    rationale.push(`${labelA}: ${ledgerA.length} ledger row${ledgerA.length === 1 ? '' : 's'} supplied, ${mappedA} attributable to a GL account code. ${labelB}: ${ledgerB.length} ledger row${ledgerB.length === 1 ? '' : 's'} supplied, ${mappedB} attributable to a GL account code.`);
    rationale.push(`The diff spans ${per_account_deltas.length} GL account code${per_account_deltas.length === 1 ? '' : 's'} across both sources; no side is asserted correct.`);
    rationale.push(verdict === 'INDETERMINATE'
      ? `Verdict is INDETERMINATE: ${indeterminate_reason}`
      : verdict === 'MATCHES'
        ? `${labelA} and ${labelB} agree on every one of the ${per_account_deltas.length} account code${per_account_deltas.length === 1 ? '' : 's'} compared.`
        : `${labelA} and ${labelB} diverge on ${disagreeing.length} of ${per_account_deltas.length} account code${per_account_deltas.length === 1 ? '' : 's'}. Each divergence is listed with both figures, symmetrically, with no side asserted correct.`);
  } else {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'mode was not declared, or was not one of "single" or "diff"; no recompute is possible without it.';
    rationale.push(`Verdict is INDETERMINATE: ${indeterminate_reason}`);
  }

  if (rejected_inputs.length > 0) rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable and ${rejected_inputs.length === 1 ? 'was' : 'were'} excluded or treated as zero. Each one is named in rejected_inputs rather than silently dropped.`);
  rationale.push('This tool independently recomputes and receipts GL tie-out arithmetic given the caller\'s own declared chart-of-accounts mapping. It is not a core alternative, does not audit or find bugs in any vendor\'s system, and makes no claim of endorsement by or determination of legality or accounting-standard compliance about any core platform, mapping, or figure.');

  const compliance_flags = ['GLTIEOUT_RECOMPUTED'];
  compliance_flags.push(mode ? `GLTIEOUT_MODE_${mode.toUpperCase()}` : 'GLTIEOUT_MODE_NOT_DECLARED');
  compliance_flags.push(verdict === 'INDETERMINATE' ? 'GLTIEOUT_INDETERMINATE' : verdict === 'MATCHES' ? 'GLTIEOUT_MATCHES' : 'GLTIEOUT_DIVERGES');
  if (verdict === 'DIVERGES') compliance_flags.push('ESCALATION_RAISED');
  if (rejected_inputs.some((r) => /is not present in the declared gl_account_mapping/.test(r.reason))) compliance_flags.push('GLTIEOUT_UNMAPPED_PRODUCT_CODE');
  if (rejected_inputs.length > 0) compliance_flags.push('GLTIEOUT_INPUTS_REJECTED');

  const output_payload = {
    mode,
    period_label,
    currency,
    minor_unit_exponent: MINOR_UNIT_EXPONENT,
    single_source,
    diff_sources,
    verdict,
    indeterminate_reason,
    rejected_inputs,
    citations: {},
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'This is an independent recompute and receipt, not a core alternative, not a vendor audit, and not an endorsement claim by any core vendor or platform. The chart-of-accounts mapping is a caller-declared input, never chosen or inferred. A divergence is an arithmetic finding, never a determination that a figure is incorrect or that funds are owed -- interpretation belongs to the caller. Diff mode asserts no correct side between the two sources compared.',
    note: 'Deterministic GL tie-out recomputation for one stated period, in either single-source mode (recompute vs a reported trial balance) or diff mode (two full sources diffed against each other for conversion balancing). Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It performs no core posting integration of any kind (batch, caller-pasted export only).',
  };

  return { output_payload, compliance_flags };
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
