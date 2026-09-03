/**
 * art-667-isa530-audit-sampling-mus.kernel.mjs
 *
 * ISA530-BUILD-1 (ISA530-SAMPLING-BUILD-SPEC.md) -- deterministic audit-sampling arithmetic:
 * monetary unit sampling (MUS) sizing, tainting-method misstatement projection, and a Benford
 * first-digit screen. Three caller-declared functions dispatched on pp.method:
 *
 *   1. monetary_unit_sampling -- sample size n = ceil(book_value * confidence_factor /
 *      (performance_materiality - expected_misstatement)); sampling interval =
 *      round(book_value / n), round-half-up. Fails closed when expected_misstatement >=
 *      performance_materiality (the sizing denominator is not positive).
 *   2. misstatement_projection -- tainting method over caller-supplied sampled items:
 *      per item, taint = (book - audited) / book; projected misstatement = sum over items of
 *      taint * sampling_interval; basic precision = confidence_factor * sampling_interval.
 *   3. benford_screen -- observed first-digit distribution of caller-supplied positive amounts
 *      vs the Benford expected proportions, chi-square deviation flag against the 5%-level
 *      critical value with 8 degrees of freedom (15.507).
 *
 * POSITIONING (binding). This kernel computes the ARITHMETIC of the audit-sampling method whose
 * source standard is linked from this node's page and metadata. It never certifies compliance
 * with any standard, never opines on audit sufficiency, and never selects sample items: where a
 * selection start point exists at all it is a caller-declared input, never generated here. No
 * randomness of any kind.
 *
 * NEVER GUESS, NEVER DEFAULT. An absent, non-numeric, or out-of-domain input resolves to
 * overall INPUT_REJECTED with the specific field named in trace and a warnings[] entry --
 * never guessed toward a computed verdict, never silently defaulted.
 *
 * FIXED-POINT DISCIPLINE. Sizing uses exact integer ceiling/half-up division whenever the
 * operands are safe integers (the worked example's inputs are); a relative-epsilon float path
 * covers non-integer operands. Projection and Benford round their outputs to a declared number
 * of decimals; every intermediate follows one fixed operation order so the float results are
 * reproducible bit-for-bit.
 *
 * FLAG-MIRROR DOCTRINE (AUTHORING-STANDARD.md section 2). compliance_flags vary with the run
 * (sized / projected / screened / rejected states), so every caveat-carrying output_payload
 * also carries warnings[] -- truthy exactly when a conditional flag is present. Clean success
 * payloads (the worked-example shape pinned by the build spec) carry no warnings member.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: ISA530-SAMPLING-BUILD-SPEC.md (Functions, Worked example, Constraints).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-667-isa530-audit-sampling-mus';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_isa530_audit_sampling_mus',
  mandate_type: 'compliance_control',
  gpu: false,
};

const METHODS = ['monetary_unit_sampling', 'misstatement_projection', 'benford_screen'];

// Benford expected first-digit proportions log10(1 + 1/d), embedded at full double precision so
// compute() performs no transcendental call (GPU-CYCLE-PREFLIGHT-1's static pre-screen).
const BENFORD_P = {
  1: 0.30102999566398120,
  2: 0.17609125905568124,
  3: 0.12493873660829992,
  4: 0.096910013008056420,
  5: 0.079181246047624818,
  6: 0.066946789630613221,
  7: 0.057991946977686733,
  8: 0.051152522447381291,
  9: 0.045757490560675143,
};
// Chi-square upper-tail critical value at the 5% level with 8 degrees of freedom (9 first-digit
// cells minus 1). A mathematical constant of the chi-square distribution, not a standard citation.
const CHI2_CRIT_8DF_5PCT = 15.507;
// Below this usable-count the smallest expected cell falls under 5 and the chi-square screen
// loses discriminative power; the trace says so rather than suppressing the statistic.
const BENFORD_MIN_EXPECTED_CELL = 110;

// ---------- shared helpers ----------

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function isPos(v) { return isNum(v) && v > 0; }
function isNonNeg(v) { return isNum(v) && v >= 0; }

/** Round-half-up to 2 decimals. One fixed operation order, deterministic bit-for-bit. */
function r2(x) { return Math.round(x * 100) / 100; }
/** Round-half-up to 6 decimals (chi-square statistic presentation). */
function r6(x) { return Math.round(x * 1000000) / 1000000; }

/**
 * Exact ceiling division num/den for num >= 0, den > 0.
 * Integer path (both safe integers) is exact by construction: q is corrected so q*den <= num,
 * then the remainder decides the +1. Float path subtracts a relative epsilon before ceil so a
 * quotient that is mathematically an integer but lands a hair above it in IEEE arithmetic does
 * not round up.
 */
function ceilDiv(num, den) {
  if (Number.isSafeInteger(num) && Number.isSafeInteger(den)) {
    let q = Math.floor(num / den);
    while (q * den > num) q -= 1;
    let r = num - q * den;
    while (r < 0) { q -= 1; r = num - q * den; }
    return r > 0 ? q + 1 : q;
  }
  const qf = num / den;
  return Math.ceil(qf - Math.abs(qf) * 1e-12);
}

/** Round-half-up division num/den for num >= 0, den > 0, exact on the integer path. */
function roundDiv(num, den) {
  if (Number.isSafeInteger(num) && Number.isSafeInteger(den)) {
    let q = Math.floor(num / den);
    while (q * den > num) q -= 1;
    const r = num - q * den;
    return 2 * r >= den ? q + 1 : q;
  }
  const qf = num / den;
  const adj = qf - Math.abs(qf) * 1e-12;
  return Math.round(adj);
}

/** First significant digit of a positive finite number, from its shortest decimal string. */
function firstSignificantDigit(v) {
  const s = String(Math.abs(v));
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 49 && c <= 57) return c - 48; // '1'..'9'
  }
  return null; // no significant digit (0, or a degenerate string)
}

// ---------- 1. MUS sizing ----------

function computeSizing(pp, rejected) {
  const bv = pp.book_value;
  const pm = pp.performance_materiality;
  const em = pp.expected_misstatement;
  const cf = pp.confidence_factor;

  if (!isPos(bv)) rejected.push({ field: 'book_value', reason: 'absent or not a positive finite number', supplied: isNum(bv) ? bv : null });
  if (!isPos(pm)) rejected.push({ field: 'performance_materiality', reason: 'absent or not a positive finite number', supplied: isNum(pm) ? pm : null });
  if (!isNonNeg(em)) rejected.push({ field: 'expected_misstatement', reason: 'absent or not a non-negative finite number', supplied: isNum(em) ? em : null });
  if (!isPos(cf)) rejected.push({ field: 'confidence_factor', reason: 'absent or not a positive finite number', supplied: isNum(cf) ? cf : null });

  const failClosed = isNum(em) && isNum(pm) && em >= pm;

  if (rejected.length > 0 || failClosed) {
    if (failClosed) rejected.push({ field: 'expected_misstatement', reason: 'expected_misstatement >= performance_materiality leaves no positive sizing denominator (fail closed)', supplied: isNum(em) ? em : null });
    // FLAGS-COMPUTED-LINT-1 shape: empty array + branch-earned pushes, never an unconditional literal.
    const compliance_flags = [];
    compliance_flags.push('MUS_INPUT_REJECTED');
    if (failClosed) compliance_flags.push('MUS_EXPECTED_NOT_BELOW_MATERIALITY');
    return {
      output_payload: {
        sample_size: null,
        sampling_interval: null,
        tolerable_misstatement: isNum(pm) && pm > 0 ? pm : null,
        trace: failClosed && rejected.length === 1
          ? 'sizing refused: expected_misstatement ' + em + ' is not below performance_materiality ' + pm + ', so the denominator performance_materiality - expected_misstatement is not positive'
          : 'sizing refused: ' + rejected.map((r) => r.field + ' ' + r.reason).join('; '),
        overall: 'INPUT_REJECTED',
        warnings: rejected.map((r) => r.field + ': ' + r.reason),
      },
      compliance_flags,
    };
  }

  const denominator = pm - em;
  const numerator = bv * cf;
  const n = ceilDiv(numerator, denominator);
  const interval = roundDiv(bv, n);

  // FLAGS-COMPUTED-LINT-1 shape: the computed flag is earned by the branch that produced n.
  const compliance_flags = [];
  if (n >= 1) compliance_flags.push('MUS_SAMPLE_COMPUTED');

  return {
    output_payload: {
      sample_size: n,
      sampling_interval: interval,
      tolerable_misstatement: pm,
      trace: bv + ' * ' + cf + ' / ' + denominator + ' = ' + n + '; interval = round(' + bv + ' / ' + n + ') = ' + interval,
      overall: 'SAMPLE_COMPUTED',
    },
    compliance_flags,
  };
}

// ---------- 2. tainting-method projection ----------

function computeProjection(pp, rejected) {
  const interval = pp.sampling_interval;
  const cf = pp.confidence_factor;
  const items = pp.sampled_items;

  if (!isPos(interval) || !Number.isSafeInteger(interval)) rejected.push({ field: 'sampling_interval', reason: 'absent or not a positive integer', supplied: isNum(interval) ? interval : null });
  if (!isPos(cf)) rejected.push({ field: 'confidence_factor', reason: 'absent or not a positive finite number', supplied: isNum(cf) ? cf : null });
  if (!Array.isArray(items) || items.length === 0) rejected.push({ field: 'sampled_items', reason: 'absent, not an array, or empty', supplied: null });

  if (rejected.length > 0) {
    return {
      output_payload: {
        sampling_interval: null,
        confidence_factor: null,
        item_count: Array.isArray(items) ? items.length : 0,
        usable_item_count: 0,
        per_item: [],
        projected_misstatement: null,
        basic_precision: null,
        basic_precision_note: 'basic precision = confidence_factor * sampling_interval, the zero-misstatement reliability allowance; not computable on rejected input',
        trace: 'projection refused: ' + rejected.map((r) => r.field + ' ' + r.reason).join('; '),
        overall: 'INPUT_REJECTED',
        warnings: rejected.map((r) => r.field + ': ' + r.reason),
      },
      compliance_flags: ['MISSTATEMENT_INPUT_REJECTED'],
    };
  }

  const per_item = [];
  const itemRejects = [];
  let projectedRaw = 0;
  items.forEach((raw, i) => {
    const it = raw && typeof raw === 'object' ? raw : {};
    const book = it.book_amount;
    const audited = it.audited_amount;
    if (!isPos(book) || !isNonNeg(audited)) {
      itemRejects.push({ index: i, reason: 'book_amount must be a positive number and audited_amount a non-negative number' });
      return;
    }
    const num = book - audited; // taint numerator (overstatement when positive)
    const itemProjectionRaw = num * interval / book;
    projectedRaw += itemProjectionRaw;
    per_item.push({
      seq: i + 1,
      book_amount: book,
      audited_amount: audited,
      taint_percent: r2(100 * num / book),
      projected_amount: r2(itemProjectionRaw),
    });
  });

  if (per_item.length === 0) {
    return {
      output_payload: {
        sampling_interval: interval,
        confidence_factor: cf,
        item_count: items.length,
        usable_item_count: 0,
        per_item: [],
        projected_misstatement: null,
        basic_precision: r2(cf * interval),
        basic_precision_note: 'basic precision = confidence_factor * sampling_interval, the zero-misstatement reliability allowance',
        trace: 'projection refused: every sampled item was rejected (book_amount must be positive, audited_amount non-negative); nothing to project',
        overall: 'INPUT_REJECTED',
        warnings: itemRejects.map((r) => 'sampled_items[' + r.index + ']: ' + r.reason),
      },
      compliance_flags: ['MISSTATEMENT_INPUT_REJECTED', 'MISSTATEMENT_ITEMS_REJECTED'],
    };
  }

  const basicPrecision = r2(cf * interval);
  const projected = r2(projectedRaw);
  const warnings = itemRejects.map((r) => 'sampled_items[' + r.index + ']: ' + r.reason);
  // FLAGS-COMPUTED-LINT-1 shape: each flag is earned by the branch that produced it.
  const compliance_flags = [];
  if (per_item.length > 0) compliance_flags.push('MISSTATEMENT_PROJECTED');
  if (itemRejects.length > 0) compliance_flags.push('MISSTATEMENT_ITEMS_REJECTED');

  const payload = {
    sampling_interval: interval,
    confidence_factor: cf,
    item_count: items.length,
    usable_item_count: per_item.length,
    per_item,
    projected_misstatement: projected,
    basic_precision: basicPrecision,
    basic_precision_note: 'basic precision = confidence_factor * sampling_interval, the zero-misstatement reliability allowance added to the projected misstatement before comparison to tolerable misstatement',
    trace: per_item.length + ' of ' + items.length + ' sampled item(s) usable; projected misstatement = sum(taint * interval) = ' + projected + '; basic precision = ' + cf + ' * ' + interval + ' = ' + basicPrecision,
    overall: 'PROJECTED',
  };
  if (warnings.length > 0) payload.warnings = warnings;
  return { output_payload: payload, compliance_flags };
}

// ---------- 3. Benford first-digit screen ----------

function computeBenford(pp, rejected) {
  const amounts = pp.amounts;
  if (!Array.isArray(amounts) || amounts.length === 0) rejected.push({ field: 'amounts', reason: 'absent, not an array, or empty', supplied: null });

  if (rejected.length > 0) {
    return {
      output_payload: {
        item_count: Array.isArray(amounts) ? amounts.length : 0,
        usable_count: 0,
        first_digit_counts: null,
        chi_square_statistic: null,
        critical_value: CHI2_CRIT_8DF_5PCT,
        deviation_flag: null,
        trace: 'screen refused: ' + rejected.map((r) => r.field + ' ' + r.reason).join('; '),
        overall: 'INPUT_REJECTED',
        warnings: rejected.map((r) => r.field + ': ' + r.reason),
      },
      compliance_flags: ['BENFORD_INPUT_REJECTED'],
    };
  }

  const counts = {};
  for (let d = 1; d <= 9; d++) counts[d] = 0;
  let usable = 0;
  let rejectedAmounts = 0;
  for (const v of amounts) {
    if (!isPos(v)) { rejectedAmounts += 1; continue; }
    const d = firstSignificantDigit(v);
    if (d === null) { rejectedAmounts += 1; continue; }
    counts[d] += 1;
    usable += 1;
  }

  if (usable === 0) {
    return {
      output_payload: {
        item_count: amounts.length,
        usable_count: 0,
        first_digit_counts: counts,
        chi_square_statistic: null,
        critical_value: CHI2_CRIT_8DF_5PCT,
        deviation_flag: null,
        trace: 'screen refused: no supplied amount yielded a usable first significant digit (all zero, negative, or non-numeric)',
        overall: 'INPUT_REJECTED',
        warnings: ['amounts: no usable positive amount with a first significant digit'],
      },
      compliance_flags: ['BENFORD_INPUT_REJECTED'],
    };
  }

  let chi2 = 0;
  for (let d = 1; d <= 9; d++) {
    const expected = usable * BENFORD_P[d];
    const diff = counts[d] - expected;
    chi2 += diff * diff / expected;
  }
  const statistic = r6(chi2);
  const deviation = statistic > CHI2_CRIT_8DF_5PCT;

  const compliance_flags = [deviation ? 'BENFORD_SCREENED_DEVIATES' : 'BENFORD_SCREENED_CONSISTENT'];
  const payload = {
    item_count: amounts.length,
    usable_count: usable,
    first_digit_counts: counts,
    chi_square_statistic: statistic,
    critical_value: CHI2_CRIT_8DF_5PCT,
    deviation_flag: deviation,
    trace: usable + ' of ' + amounts.length + ' amount(s) usable; chi-square = ' + statistic + ' vs ' + CHI2_CRIT_8DF_5PCT + ' (8 degrees of freedom, 5% level); observed first digits ' + (deviation ? 'DEVIATE from' : 'are CONSISTENT with') + ' the Benford distribution'
      + (usable < BENFORD_MIN_EXPECTED_CELL ? '; small sample: fewer than ' + BENFORD_MIN_EXPECTED_CELL + ' usable amounts leave every expected cell below 5, weakening the screen' : ''),
    overall: deviation ? 'SCREENED_DEVIATES' : 'SCREENED_CONSISTENT',
  };
  if (usable < BENFORD_MIN_EXPECTED_CELL) compliance_flags.push('BENFORD_SMALL_SAMPLE');
  const warnings = [];
  if (rejectedAmounts > 0) warnings.push('amounts: ' + rejectedAmounts + ' supplied value(s) were zero, negative, or non-numeric and were excluded from the digit counts');
  if (warnings.length > 0) payload.warnings = warnings;
  if (rejectedAmounts > 0) compliance_flags.push('BENFORD_AMOUNTS_EXCLUDED');
  return { output_payload: payload, compliance_flags };
}

// ---------- dispatch ----------

export function compute(pp) {
  pp = pp || {};
  const methodRaw = typeof pp.method === 'string' ? pp.method.trim() : null;
  const method = methodRaw && METHODS.indexOf(methodRaw) !== -1 ? methodRaw : null;

  if (!method) {
    return {
      output_payload: {
        sample_size: null,
        sampling_interval: null,
        tolerable_misstatement: null,
        trace: 'method absent or not one of ' + METHODS.join(', ') + '; nothing to compute',
        overall: 'INPUT_REJECTED',
        warnings: ['method: absent or not one of ' + METHODS.join(', ')],
      },
      compliance_flags: ['METHOD_NOT_RECOGNIZED'],
    };
  }

  const rejected = [];
  if (method === 'monetary_unit_sampling') return computeSizing(pp, rejected);
  if (method === 'misstatement_projection') return computeProjection(pp, rejected);
  return computeBenford(pp, rejected);
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
