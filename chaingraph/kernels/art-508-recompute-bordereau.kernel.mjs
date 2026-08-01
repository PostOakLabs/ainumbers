/**
 * art-508-recompute-bordereau.kernel.mjs
 * Assurance Waves programme (DELEGATED-AUTHORITY-BDX-BUILD-SPEC.md §2/§3, BDX-K-1) — recomputes a
 * delegated-authority bordereau the way the carrier's reviewer does, from the same file the
 * coverholder sent.
 *
 * WHY THE REVIEWER CAN DO THIS AT ALL. A bordereau is the periodic report a coverholder or managing
 * general agent submits to the carrier listing the risks written or the claims incurred. The carrier
 * receives the identical file the coverholder prepared, so both sides hold the same per-line figures.
 * That is what makes an independent recomputation possible rather than a re-reading of somebody
 * else's summary.
 *
 * ⭐ THE FOOTING IS THE WEAK CHECK AND THIS KERNEL SAYS SO. BDX-HANDTEST-1 recomputed a premium
 * bordereau by hand and found exact agreement, which is the expected and uninteresting result: the
 * coverholder footed the same column. The check with real value is AUTHORITY UTILISATION, because the
 * binding authority limit is held by the CARRIER and is NOT on the bordereau. That is why
 * `binding_authority` is a declared caller input here and is never derived from the supplied rows: a
 * limit read out of the document under review would have no independent provenance and the comparison
 * would be tautological.
 *
 * EVERYTHING EXTERNAL IS A CALLER INPUT (spec §1, the maintenance guard). `field_mapping` names which
 * supplied column carries which measure. `standard_label` and `standard_version` are free text, pinned
 * into the artifact and rendered on screen. There is NO shipped Lloyd's field list, no bundled schema,
 * no commission or tax rate table, and no claim anywhere about which version of any standard is
 * current. Market data standards get revised; a shipped field set would be a treadmill and would fail
 * SURVIVES-THE-MAINTAINER. A revision makes an old receipt DATED, never wrong.
 *
 * PII — THIS IS THE HIGHEST-RISK FAMILY IN THE ESTATE AND IS TREATED AS SUCH (spec §3). Real
 * bordereaux carry insured names, addresses and claim narratives. The arithmetic needs none of them.
 * ONLY columns named in `field_mapping` are ever read. Every other column is ignored and can reach
 * neither `output_payload` nor the rationale. Two rules enforce it beyond mere intent. First, a row is
 * never copied — each output object is built field by field from mapped values only. Second, NO
 * REJECTION RECORD EVER ECHOES A SUPPLIED VALUE: a bad cell is reported by column name and JavaScript
 * type alone, because a caller who maps an amount to the wrong column would otherwise put a
 * policyholder's name inside a hashed artifact. Column NAMES are the caller's own headers and are safe;
 * cell CONTENTS are not, and none crosses the boundary.
 *
 * ⚠ THE ONE REMAINING PATH IS THE INPUT ECHO, AND IT IS HANDLED AT THE BOUNDARY, NOT HERE. Every
 * artifact echoes `policy_parameters`. `projectPolicyParameters()` below cuts a row down to its mapped
 * columns and the node page calls it before building an artifact; compute() additionally raises
 * BDX_UNMAPPED_COLUMNS_PRESENT, with a count and never a name, when it is handed unprojected rows.
 * See that function for why the projection is not applied inside buildArtifact.
 *
 * A DIFFERENCE IS A FINDING, NOT AN ACCUSATION. Where the recomputed footing disagrees with
 * `asserted_totals`, the artifact records that the two sides' arithmetic disagrees on the rows
 * supplied. It does not say the coverholder misreported, and it cannot: the rows may be incomplete,
 * the mapping may be wrong, and the asserted figure may be computed on a different basis.
 *
 * RECOMPUTE-ONLY IS ITS OWN STATE. Absent `asserted_totals` the run is reported as `recompute_only`,
 * never as a pass and never folded into "matched". This deliberately mirrors `helm check` exit code 2:
 * a scripted caller must not mistake "nothing to check against" for "checked and passed".
 *
 * FIXED-POINT MONEY MATH. Every amount becomes an INTEGER NUMBER OF MINOR UNITS at the boundary and
 * stays one. Decimal input is parsed from its STRING form by splitting on the point and padding the
 * fraction, never by floating-point multiplication, so 0.1 + 0.2 cannot arise. Totals, differences,
 * utilisation and limit comparisons are integer operations. The 2dp display strings come from integer
 * division plus string padding, never from toFixed() on a float.
 *
 * FINITE GATE. Zero rows, an empty mapping, a zero aggregate limit, an unparseable date and a row
 * whose mapped columns are all absent each resolve to a DEFINED result. No branch can emit NaN,
 * Infinity, null-as-a-number or an undefined state. A cell that is not a usable amount is coerced to 0
 * AND named in `rejected_inputs[]` by column and type, never silently dropped.
 *
 * NO CLOCK. `period_label`, the authority period and every date are caller inputs. compute() never
 * reads a clock, and the artifact carries no `last_reviewed` and no `valid_until` derived from now.
 *
 * NO PINNED CITATIONS, DELIBERATELY. The shared constraints permit §28-pinned citations or none. The
 * arithmetic here is governed by the binding authority agreement between the carrier and the
 * coverholder, which is a private contract rather than a published instrument, so there is no clause
 * with an `in_force_from` this kernel could honestly pin. Emitting a plausible-looking regulatory
 * citation for arithmetic no regulation prescribes would be worse than emitting none.
 *
 * THIS IS NOT AN AUDIT CONCLUSION. The node reports arithmetic and limit facts about the rows
 * supplied. Whether authority was properly exercised is for the delegated authority audit, never for
 * this tool.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: DELEGATED-AUTHORITY-BDX-BUILD-SPEC.md §1/§2/§3/§5 · SAFEGUARDING-CASS15-BUILD-SPEC.md §5.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-508-recompute-bordereau';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'recompute_bordereau', mandate_type: 'analytics_mandate', gpu: false };

/**
 * The measures this kernel can foot. These are CONCEPT KEYS, not field names: the caller says which
 * of their own columns carries each one. Nothing here is a data standard, a schema or a field list,
 * and no revision of any market standard can make this set stale, because it names arithmetic rather
 * than fields.
 */
const MONEY_MEASURES = ['gross_premium', 'brokerage', 'coverholder_commission', 'ceded', 'net'];
/** Deductions netted off gross premium when the recomputed net is derived. */
const DEDUCTION_MEASURES = ['brokerage', 'coverholder_commission', 'ceded'];

const BASIS = {
  basis_id: 'CALLER-SUPPLIED-MAPPING',
  basis_label: 'Column mapping, standard label and standard version as declared by the caller',
  mapping_source: 'caller_declared',
  shipped_field_list: false,
  shipped_rate_table: false,
  standard_conformance_checked: false,
  standard_note: 'No market data standard is bundled, read, validated or asserted here. The caller names which of their own columns carries each measure, and the standard label and version they pin are echoed so a later revision dates an old receipt rather than falsifying it.',
  field_set_version: '1.0.0',
};

const MINOR_UNIT_EXPONENT = 2;
const MINOR_SCALE = 100;
const DECIMAL_RE = /^-?\d+(\.\d{1,2})?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Marker written in place of a mapped money cell that is not a usable amount. See the projection. */
const REDACTED_PREFIX = '[redacted:';

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

/** 2dp display string from an integer minor-unit amount. Integer division only, no floats. */
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / MINOR_SCALE);
  const frac = abs - whole * MINOR_SCALE;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(MINOR_UNIT_EXPONENT, '0');
}

/**
 * Parse one supplied cell into integer minor units. Two modes, both exact.
 *
 * `minor_units` — the cell must already be a safe integer number of minor units.
 * `major_units`  — the cell is read as a DECIMAL STRING and split on the point. This is the whole
 *                  reason no floating-point arithmetic occurs: "1234.56" becomes 123456 by string
 *                  handling, never by multiplying a float by 100.
 *
 * Returns `{ ok, minor, reason }`. It NEVER returns or records the supplied value: see the PII note
 * in the header. A caller who maps a money measure to a name column gets a typed rejection, not their
 * policyholder's name echoed back inside a hashed artifact.
 */
function parseAmount(v, mode) {
  // A cell the projection redacted. The ORIGINAL type travels inside the token so the diagnosis a
  // reviewer sees is identical to the one an unprojected run would have produced, while the cell
  // contents themselves never crossed the boundary.
  if (typeof v === 'string' && v.indexOf(REDACTED_PREFIX) === 0) {
    const t = v.slice(REDACTED_PREFIX.length, v.length - 1);
    return {
      ok: false, minor: 0, value_type: t,
      reason: mode === 'minor_units'
        ? 'expected a safe integer number of minor units'
        : (t === 'string' || t === 'number')
          ? 'not a decimal amount with at most two decimal places'
          : 'expected a decimal amount, got ' + t,
    };
  }
  if (v === undefined || v === null || v === '') return { ok: false, minor: 0, reason: 'absent', value_type: typeof v };
  if (mode === 'minor_units') {
    if (typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v)) return { ok: true, minor: v, reason: null, value_type: typeof v };
    return { ok: false, minor: 0, reason: 'expected a safe integer number of minor units', value_type: typeof v };
  }
  if (typeof v !== 'number' && typeof v !== 'string') return { ok: false, minor: 0, reason: 'expected a decimal amount, got ' + typeof v, value_type: typeof v };
  if (typeof v === 'number' && !Number.isFinite(v)) return { ok: false, minor: 0, reason: 'not a finite number', value_type: 'number' };
  const s = String(v).trim().replace(/[, ]/g, '');
  if (s === '') return { ok: false, minor: 0, reason: 'absent', value_type: typeof v };
  if (!DECIMAL_RE.test(s)) return { ok: false, minor: 0, reason: 'not a decimal amount with at most two decimal places', value_type: typeof v };
  const neg = s.charAt(0) === '-';
  const body = neg ? s.slice(1) : s;
  const point = body.indexOf('.');
  const whole = point === -1 ? body : body.slice(0, point);
  const fracRaw = point === -1 ? '' : body.slice(point + 1);
  const frac = fracRaw.length === 0 ? '00' : fracRaw.length === 1 ? fracRaw + '0' : fracRaw;
  const wholeN = Number(whole);
  if (!Number.isSafeInteger(wholeN)) return { ok: false, minor: 0, reason: 'exceeds the safe integer range', value_type: typeof v };
  const minor = wholeN * MINOR_SCALE + Number(frac);
  if (!Number.isSafeInteger(minor)) return { ok: false, minor: 0, reason: 'exceeds the safe integer range in minor units', value_type: typeof v };
  return { ok: true, minor: neg ? -minor : minor, reason: null, value_type: typeof v };
}

/** The column names the caller mapped. Shared by compute() and the projection below so the set that
 *  is READ and the set that is KEPT can never drift apart. */
function mappedColumnsOf(pp) {
  const mappingIn = obj((pp || {}).field_mapping);
  const cols = [];
  for (const key of MONEY_MEASURES.concat(['policy_ref', 'period', 'inception_date', 'currency', 'sum_insured'])) {
    if (isNonEmptyString(mappingIn[key])) cols.push(mappingIn[key].trim());
  }
  const taxRaw = mappingIn.taxes;
  if (isNonEmptyString(taxRaw)) cols.push(taxRaw.trim());
  else for (const t of arr(taxRaw)) if (isNonEmptyString(t)) cols.push(t.trim());
  return cols;
}

/**
 * ⭐ CUT A ROW DOWN TO THE MAPPED COLUMNS. CALL THIS AT THE INPUT BOUNDARY, BEFORE buildArtifact.
 *
 * compute() reads only mapped columns, so `output_payload` and the rationale can never carry an
 * unmapped value. That is NOT the whole story: an OpenChainGraph artifact also echoes
 * `policy_parameters`, and the receipt is hashed. A caller who pastes a whole real bordereau would
 * therefore write insured names, addresses and claim narratives into a hashed artifact through the
 * INPUT ECHO, even though the arithmetic never touched them.
 *
 * This helper removes that risk by dropping unmapped columns before the artifact is built. The node
 * page calls it on every run, which is the surface where a real file actually gets pasted.
 *
 * ⚠ IT IS DELIBERATELY NOT CALLED INSIDE buildArtifact. The estate-wide kernel contract requires
 * `artifact.policy_parameters` to equal the input it was handed (kernel-contract.test.mjs), so that a
 * third party can replay the artifact. Projecting inside buildArtifact would break that invariant for
 * this one kernel and create a second canon. The sanctioned way to exclude input from a receipt is the
 * §25 `ocg-private-input@1` profile, which is a larger envelope change than this node.
 *
 * ⇒ RESIDUAL, STATED PLAINLY: an MCP caller that passes unmapped columns straight to buildArtifact
 * gets them echoed in `policy_parameters`. compute() detects that case and raises
 * BDX_UNMAPPED_COLUMNS_PRESENT with a COUNT ONLY, never a name or a value, so the caller is told
 * rather than left to discover it.
 *
 * Amounts are handled specially: a mapped MONEY column whose cell is not a usable amount is a
 * mis-mapping, and a mis-mapping is exactly how a name reaches a money field. Those cells are replaced
 * by a marker carrying their TYPE and nothing else, which is all the diagnosis needs. The substitution
 * is output-neutral: the rejection reason and type a reviewer sees are identical either way.
 */
export function projectPolicyParameters(pp) {
  pp = pp || {};
  const cols = mappedColumnsOf(pp);
  const mappingIn = obj(pp.field_mapping);
  const mode = pp.amounts_in === 'minor_units' ? 'minor_units' : 'major_units';

  // Columns the caller declared as MONEY. A cell in one of these is only ever a figure, so anything
  // that is not a usable amount is a mis-mapping, and a mis-mapping is precisely how a policyholder
  // name would otherwise reach the receipt. Those cells are replaced by a marker carrying their TYPE
  // and nothing else, which is all the diagnosis needs.
  const moneyCols = [];
  for (const key of MONEY_MEASURES.concat(['sum_insured'])) {
    if (isNonEmptyString(mappingIn[key])) moneyCols.push(mappingIn[key].trim());
  }
  const taxRaw = mappingIn.taxes;
  if (isNonEmptyString(taxRaw)) moneyCols.push(taxRaw.trim());
  else for (const t of arr(taxRaw)) if (isNonEmptyString(t)) moneyCols.push(t.trim());

  const projected = {};
  for (const k of Object.keys(pp)) if (k !== 'rows') projected[k] = pp[k];
  projected.rows = arr(pp.rows).map((raw) => {
    const row = obj(raw);
    const kept = {};
    for (const c of cols) {
      if (!Object.prototype.hasOwnProperty.call(row, c)) continue;
      const v = row[c];
      if (moneyCols.indexOf(c) === -1) { kept[c] = v; continue; }
      const parsed = parseAmount(v, mode);
      // An absent cell stays absent so the diagnosis still reads "absent" rather than "unusable".
      kept[c] = parsed.ok || parsed.reason === 'absent' ? v : REDACTED_PREFIX + typeof v + ']';
    }
    return kept;
  });
  return projected;
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const period_label = str(pp.period_label, 'UNSTATED');
  const bordereau_class = str(pp.bordereau_class, 'UNSTATED');
  const amounts_in = pp.amounts_in === 'minor_units' ? 'minor_units' : 'major_units';
  const default_currency = isNonEmptyString(pp.default_currency) ? pp.default_currency.trim().toUpperCase() : 'UNSTATED';

  // ── The standard the caller pins. Free text, echoed, never checked against a shipped list. ──────
  const standard_label = str(pp.standard_label, 'UNSTATED');
  const standard_version = str(pp.standard_version, 'UNSTATED');
  const standard_pinned = isNonEmptyString(pp.standard_label) && isNonEmptyString(pp.standard_version);

  // ── The mapping. Only these columns are ever read from a row. ───────────────────────────────────
  const mappingIn = obj(pp.field_mapping);
  const mapping = {};
  for (const key of MONEY_MEASURES.concat(['policy_ref', 'period', 'inception_date', 'currency', 'sum_insured'])) {
    const col = str(mappingIn[key], null);
    if (col !== null) mapping[key] = col;
  }
  const taxColumns = [];
  const taxRaw = mappingIn.taxes;
  if (isNonEmptyString(taxRaw)) taxColumns.push(taxRaw.trim());
  else for (const t of arr(taxRaw)) if (isNonEmptyString(t)) taxColumns.push(t.trim());
  const mapped_columns = Object.keys(mapping).map((k) => mapping[k]).concat(taxColumns);
  const mapping_supplied = Object.keys(mapping).length > 0 || taxColumns.length > 0;
  if (!mapping_supplied) {
    rejected_inputs.push({ where: 'field_mapping', column: null, reason: 'absent, so no column could be read and every measure foots to zero', value_type: 'undefined' });
  }

  /** Read one mapped cell. Unmapped measure returns a defined "not mapped" result and reads nothing. */
  function cell(row, key, line) {
    const col = mapping[key];
    if (col === undefined) return { mapped: false, ok: false, minor: 0 };
    const parsed = parseAmount(row[col], amounts_in);
    if (!parsed.ok) {
      rejected_inputs.push({ where: 'rows[' + line + '].' + key, column: col, reason: parsed.reason, value_type: parsed.value_type });
    }
    return { mapped: true, ok: parsed.ok, minor: parsed.minor };
  }

  const suppliedRows = arr(pp.rows);

  // ── Per-currency footing. Built field by field from mapped values; a row is never copied. ───────
  const currencyOrder = [];
  const byCurrency = {};
  function bucket(ccy) {
    if (byCurrency[ccy] === undefined) {
      const b = { currency: ccy, line_count: 0, taxes_by_column: {} };
      for (const m of MONEY_MEASURES) b[m] = 0;
      b.taxes = 0;
      byCurrency[ccy] = b;
      currencyOrder.push(ccy);
    }
    return byCurrency[ccy];
  }

  // Cells the caller supplied that no mapping names. Counted so an unprojected caller is TOLD their
  // receipt will echo columns this tool never read. The count only: never a column name, never a value.
  let unmapped_column_cells = 0;
  const duplicateIndex = {};
  const lines_with_absent_mapped_fields = [];
  const out_of_scope_lines = [];
  const observedPeriods = [];
  const per_risk_measures = [];

  const authorityIn = obj(pp.binding_authority);
  const authority_supplied = pp.binding_authority !== undefined && pp.binding_authority !== null && Object.keys(authorityIn).length > 0;
  const period_start = str(authorityIn.period_start, null);
  const period_end = str(authorityIn.period_end, null);
  const permitted_currencies = arr(authorityIn.permitted_currencies).map((c) => (isNonEmptyString(c) ? c.trim().toUpperCase() : null)).filter((c) => c !== null);
  const aggregate_basis = str(authorityIn.aggregate_basis, 'gross_premium');
  const per_risk_basis = str(authorityIn.per_risk_basis, mapping.sum_insured !== undefined ? 'sum_insured' : 'gross_premium');
  const aggParsed = parseAmount(authorityIn.aggregate_limit, amounts_in);
  if (authority_supplied && authorityIn.aggregate_limit !== undefined && authorityIn.aggregate_limit !== null && !aggParsed.ok) {
    rejected_inputs.push({ where: 'binding_authority.aggregate_limit', column: null, reason: aggParsed.reason, value_type: aggParsed.value_type });
  }
  const perRiskParsed = parseAmount(authorityIn.per_risk_limit, amounts_in);
  if (authority_supplied && authorityIn.per_risk_limit !== undefined && authorityIn.per_risk_limit !== null && !perRiskParsed.ok) {
    rejected_inputs.push({ where: 'binding_authority.per_risk_limit', column: null, reason: perRiskParsed.reason, value_type: perRiskParsed.value_type });
  }
  const aggregate_limit_minor_units = aggParsed.ok ? aggParsed.minor : null;
  const per_risk_limit_minor_units = perRiskParsed.ok ? perRiskParsed.minor : null;
  const limit_currency = isNonEmptyString(authorityIn.limit_currency) ? authorityIn.limit_currency.trim().toUpperCase() : null;

  const limit_breaches = [];

  for (let i = 0; i < suppliedRows.length; i++) {
    const row = obj(suppliedRows[i]);
    const line = i + 1;
    for (const k of Object.keys(row)) if (mapped_columns.indexOf(k) === -1) unmapped_column_cells += 1;

    const ccyCol = mapping.currency;
    const ccyRaw = ccyCol === undefined ? null : row[ccyCol];
    const currency = isNonEmptyString(ccyRaw) ? ccyRaw.trim().toUpperCase() : default_currency;
    const b = bucket(currency);
    b.line_count += 1;

    const absent = [];
    const values = {};
    for (const m of MONEY_MEASURES) {
      const c = cell(row, m, line);
      values[m] = c.minor;
      if (c.mapped) { b[m] += c.minor; if (!c.ok) absent.push(m); }
    }
    let rowTaxes = 0;
    for (const tcol of taxColumns) {
      const parsed = parseAmount(row[tcol], amounts_in);
      if (!parsed.ok) {
        rejected_inputs.push({ where: 'rows[' + line + '].taxes', column: tcol, reason: parsed.reason, value_type: parsed.value_type });
        absent.push('taxes:' + tcol);
      }
      rowTaxes += parsed.minor;
      b.taxes_by_column[tcol] = (b.taxes_by_column[tcol] === undefined ? 0 : b.taxes_by_column[tcol]) + parsed.minor;
    }
    b.taxes += rowTaxes;

    const sumInsuredCell = cell(row, 'sum_insured', line);
    values.sum_insured = sumInsuredCell.minor;
    if (sumInsuredCell.mapped && !sumInsuredCell.ok) absent.push('sum_insured');

    // ── Population integrity. Reference values only; no cell contents beyond mapped fields. ──────
    const refCol = mapping.policy_ref;
    const policy_ref = refCol !== undefined && isNonEmptyString(row[refCol]) ? String(row[refCol]).trim() : null;
    if (refCol !== undefined) {
      if (policy_ref === null) absent.push('policy_ref');
      else {
        if (duplicateIndex[policy_ref] === undefined) duplicateIndex[policy_ref] = [];
        duplicateIndex[policy_ref].push(line);
      }
    }

    const perCol = mapping.period;
    const periodValue = perCol !== undefined && isNonEmptyString(row[perCol]) ? String(row[perCol]).trim() : null;
    if (perCol !== undefined) {
      if (periodValue === null) absent.push('period');
      else if (observedPeriods.indexOf(periodValue) === -1) observedPeriods.push(periodValue);
    }

    const incCol = mapping.inception_date;
    const incRaw = incCol !== undefined && isNonEmptyString(row[incCol]) ? String(row[incCol]).trim() : null;
    if (incCol !== undefined && incRaw === null) absent.push('inception_date');

    if (absent.length > 0) lines_with_absent_mapped_fields.push({ line, policy_ref, absent_measures: absent.slice() });

    // ── Scope: currency permitted, inception inside the authority period. ────────────────────────
    if (permitted_currencies.length > 0 && permitted_currencies.indexOf(currency) === -1) {
      out_of_scope_lines.push({ line, policy_ref, reason: 'currency_not_permitted', currency, detail: 'The currency on this line is not in the list of currencies the caller declared the binding authority permits.' });
    }
    if (incCol !== undefined && incRaw !== null) {
      if (!ISO_DATE_RE.test(incRaw)) {
        rejected_inputs.push({ where: 'rows[' + line + '].inception_date', column: incCol, reason: 'not an ISO calendar date of the form YYYY-MM-DD, so it could not be compared against the authority period', value_type: typeof row[incCol] });
      } else {
        // ISO calendar dates of identical form compare correctly as strings. No date object, no clock.
        if (period_start !== null && incRaw < period_start) {
          out_of_scope_lines.push({ line, policy_ref, reason: 'before_authority_period', currency, inception_date: incRaw, detail: 'The inception date on this line falls before the authority period start the caller declared.' });
        } else if (period_end !== null && incRaw > period_end) {
          out_of_scope_lines.push({ line, policy_ref, reason: 'after_authority_period', currency, inception_date: incRaw, detail: 'The inception date on this line falls after the authority period end the caller declared.' });
        }
      }
    }

    // ── Per-risk limit. The limit is CARRIER-HELD and declared; it is never read from the file. ──
    const perRiskValue = per_risk_basis === 'sum_insured' ? values.sum_insured : (values[per_risk_basis] !== undefined ? values[per_risk_basis] : 0);
    per_risk_measures.push(perRiskValue);
    if (per_risk_limit_minor_units !== null && perRiskValue > per_risk_limit_minor_units) {
      limit_breaches.push({
        scope: 'per_risk',
        line,
        policy_ref,
        currency,
        basis: per_risk_basis,
        measured_minor_units: perRiskValue,
        measured_display: display(perRiskValue),
        limit_minor_units: per_risk_limit_minor_units,
        limit_display: display(per_risk_limit_minor_units),
        excess_minor_units: perRiskValue - per_risk_limit_minor_units,
        excess_display: display(perRiskValue - per_risk_limit_minor_units),
        detail: 'This line exceeds the per risk limit the caller declared from the binding authority. The limit is held by the carrier and is not read from the bordereau, which is what gives the comparison independent provenance.',
      });
    }
  }

  // ── Close the footing: derived net, and the internal check against a mapped net column. ─────────
  const currencies = currencyOrder.map((ccy) => {
    const b = byCurrency[ccy];
    let deductions = 0;
    for (const d of DEDUCTION_MEASURES) deductions += b[d];
    deductions += b.taxes;
    const net_recomputed = b.gross_premium - deductions;
    const net_mapped = mapping.net !== undefined ? b.net : null;
    const net_internal_difference = net_mapped === null ? null : net_mapped - net_recomputed;
    const taxes_by_column = Object.keys(b.taxes_by_column).sort().map((col) => ({
      column: col,
      total_minor_units: b.taxes_by_column[col],
      total_display: display(b.taxes_by_column[col]),
    }));
    return {
      currency: ccy,
      line_count: b.line_count,
      gross_premium_minor_units: b.gross_premium,
      gross_premium_display: display(b.gross_premium),
      brokerage_minor_units: b.brokerage,
      brokerage_display: display(b.brokerage),
      coverholder_commission_minor_units: b.coverholder_commission,
      coverholder_commission_display: display(b.coverholder_commission),
      taxes_minor_units: b.taxes,
      taxes_display: display(b.taxes),
      taxes_by_column,
      ceded_minor_units: b.ceded,
      ceded_display: display(b.ceded),
      net_recomputed_minor_units: net_recomputed,
      net_recomputed_display: display(net_recomputed),
      net_as_mapped_minor_units: net_mapped,
      net_as_mapped_display: net_mapped === null ? null : display(net_mapped),
      net_internal_difference_minor_units: net_internal_difference,
      net_internal_difference_display: net_internal_difference === null ? null : display(net_internal_difference),
      net_agrees_internally: net_internal_difference === null ? null : net_internal_difference === 0,
    };
  });

  const measures_mapped = {};
  for (const m of MONEY_MEASURES) measures_mapped[m] = mapping[m] !== undefined;
  measures_mapped.taxes = taxColumns.length > 0;
  measures_mapped.sum_insured = mapping.sum_insured !== undefined;
  measures_mapped.policy_ref = mapping.policy_ref !== undefined;
  measures_mapped.period = mapping.period !== undefined;
  measures_mapped.inception_date = mapping.inception_date !== undefined;
  measures_mapped.currency = mapping.currency !== undefined;
  const unmapped_measures = Object.keys(measures_mapped).filter((k) => !measures_mapped[k]).sort();

  // ── Aggregate authority utilisation, against the CARRIER-HELD limit the caller declared. ───────
  let aggregate_utilisation = {
    assessed: false,
    reason: 'No aggregate limit was supplied, so utilisation of the binding authority could not be assessed. The limit is held by the carrier and is deliberately not derived from the bordereau.',
    basis: aggregate_basis,
    limit_currency,
    limit_minor_units: aggregate_limit_minor_units,
    limit_display: aggregate_limit_minor_units === null ? null : display(aggregate_limit_minor_units),
    consumed_minor_units: null,
    consumed_display: null,
    utilisation_basis_points: null,
    utilisation_display: null,
    headroom_minor_units: null,
    headroom_display: null,
    breached: false,
  };
  if (aggregate_limit_minor_units !== null) {
    const ccyForLimit = limit_currency !== null ? limit_currency : (currencyOrder.length === 1 ? currencyOrder[0] : null);
    if (ccyForLimit === null) {
      aggregate_utilisation.reason = 'An aggregate limit was supplied but the currency it applies to was not, and the rows carry more than one currency. Utilisation is reported as not assessed rather than summed across currencies, which would not be a meaningful figure.';
    } else {
      const b = byCurrency[ccyForLimit];
      const consumed = b === undefined ? 0 : (aggregate_basis === 'taxes' ? b.taxes : (b[aggregate_basis] !== undefined ? b[aggregate_basis] : 0));
      const product = consumed * 10000;
      const bp = aggregate_limit_minor_units > 0 && Number.isSafeInteger(product) ? Math.trunc(product / aggregate_limit_minor_units) : null;
      aggregate_utilisation = {
        assessed: true,
        reason: b === undefined
          ? 'The aggregate limit names a currency that appears on none of the rows supplied, so nothing was consumed against it.'
          : 'Utilisation is the recomputed total for the declared basis, measured against the aggregate limit the caller declared from the binding authority. The limit is carrier held and is never read from the bordereau.',
        basis: aggregate_basis,
        limit_currency: ccyForLimit,
        limit_minor_units: aggregate_limit_minor_units,
        limit_display: display(aggregate_limit_minor_units),
        consumed_minor_units: consumed,
        consumed_display: display(consumed),
        utilisation_basis_points: bp,
        utilisation_display: bp === null ? null : display(bp) + ' percent',
        headroom_minor_units: aggregate_limit_minor_units - consumed,
        headroom_display: display(aggregate_limit_minor_units - consumed),
        breached: consumed > aggregate_limit_minor_units,
      };
      if (aggregate_utilisation.breached) {
        limit_breaches.push({
          scope: 'aggregate',
          line: null,
          policy_ref: null,
          currency: ccyForLimit,
          basis: aggregate_basis,
          measured_minor_units: consumed,
          measured_display: display(consumed),
          limit_minor_units: aggregate_limit_minor_units,
          limit_display: display(aggregate_limit_minor_units),
          excess_minor_units: consumed - aggregate_limit_minor_units,
          excess_display: display(consumed - aggregate_limit_minor_units),
          detail: 'The recomputed total for the declared basis exceeds the aggregate limit the caller declared from the binding authority.',
        });
      }
    }
  }

  // ── Population integrity. ───────────────────────────────────────────────────────────────────────
  const duplicates = Object.keys(duplicateIndex).sort().filter((ref) => duplicateIndex[ref].length > 1).map((ref) => ({
    policy_ref: ref,
    occurrences: duplicateIndex[ref].length,
    lines: duplicateIndex[ref],
    detail: 'This policy reference appears on more than one line. That may be a genuine endorsement or instalment rather than a duplicate, which is why it is reported as a population observation and not as an error.',
  }));
  const expected_periods = arr(pp.expected_periods).map((p) => (isNonEmptyString(p) ? p.trim() : null)).filter((p) => p !== null);
  const missing_periods = expected_periods.filter((p) => observedPeriods.indexOf(p) === -1);
  const unexpected_periods = expected_periods.length > 0 ? observedPeriods.filter((p) => expected_periods.indexOf(p) === -1) : [];
  const population_defect = duplicates.length > 0 || missing_periods.length > 0 || lines_with_absent_mapped_fields.length > 0;

  // ── Diff against what the coverholder asserts, field by field, per currency. ────────────────────
  const assertedSupplied = pp.asserted_totals !== undefined && pp.asserted_totals !== null;
  const diff = [];
  if (assertedSupplied) {
    const rawAsserted = Array.isArray(pp.asserted_totals) ? pp.asserted_totals : [pp.asserted_totals];
    const seenCcy = [];
    for (let i = 0; i < rawAsserted.length; i++) {
      const a = obj(rawAsserted[i]);
      const ccy = isNonEmptyString(a.currency) ? a.currency.trim().toUpperCase() : (currencyOrder.length === 1 ? currencyOrder[0] : default_currency);
      seenCcy.push(ccy);
      const recomputedRow = currencies.filter((c) => c.currency === ccy)[0];
      for (const m of MONEY_MEASURES.concat(['taxes'])) {
        if (a[m] === undefined || a[m] === null) continue;
        const parsed = parseAmount(a[m], amounts_in);
        if (!parsed.ok) {
          rejected_inputs.push({ where: 'asserted_totals[' + i + '].' + m, column: null, reason: parsed.reason, value_type: parsed.value_type });
        }
        const asserted_minor_units = parsed.minor;
        let recomputed_minor_units;
        if (recomputedRow === undefined) recomputed_minor_units = 0;
        else if (m === 'net') recomputed_minor_units = recomputedRow.net_recomputed_minor_units;
        else recomputed_minor_units = recomputedRow[m + '_minor_units'];
        const difference_minor_units = recomputed_minor_units - asserted_minor_units;
        diff.push({
          currency: ccy,
          measure: m,
          in_rows: recomputedRow !== undefined,
          recomputed_minor_units,
          recomputed_display: display(recomputed_minor_units),
          asserted_minor_units,
          asserted_display: display(asserted_minor_units),
          difference_minor_units,
          difference_display: display(difference_minor_units),
          agrees: difference_minor_units === 0,
          detail: difference_minor_units === 0
            ? 'The total footed from the rows supplied equals the total asserted for this measure.'
            : 'The total footed from the rows supplied differs from the total asserted for this measure. That is a difference between the two arithmetics on these rows, not a finding that the asserted figure was misreported.',
        });
      }
    }
    for (const c of currencies) {
      if (seenCcy.indexOf(c.currency) === -1) {
        diff.push({
          currency: c.currency,
          measure: null,
          in_rows: true,
          recomputed_minor_units: c.gross_premium_minor_units,
          recomputed_display: c.gross_premium_display,
          asserted_minor_units: null,
          asserted_display: null,
          difference_minor_units: null,
          difference_display: null,
          agrees: false,
          detail: 'The rows carry this currency but the asserted totals name no figures for it, so there is nothing to compare against.',
        });
      }
    }
  }

  const comparableDiff = diff.filter((d) => d.difference_minor_units !== null);
  const disagreeing = diff.filter((d) => !d.agrees);
  const comparison_state = !assertedSupplied
    ? 'recompute_only'
    : disagreeing.length === 0 && comparableDiff.length > 0
      ? 'matches'
      : 'differs';

  // ── Rationale. ─────────────────────────────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push('Bordereau recomputed for period ' + period_label + ' over ' + suppliedRows.length + ' supplied line' + (suppliedRows.length === 1 ? '' : 's') + ', class ' + bordereau_class + ', against the column mapping the caller declared and the standard pinned as ' + standard_label + ' version ' + standard_version + '.');
  if (!standard_pinned) {
    rationale.push('No standard label and version were pinned, so the artifact cannot say which revision of a data standard these columns were laid out under. A receipt without that pin cannot be dated against a later revision.');
  }
  rationale.push('Only the columns named in the mapping were read. Every other column was ignored and appears nowhere in these results, which is what keeps insured names, addresses and claim narratives out of the computed output. Where a mapped cell was unusable it is named by column and type, and the cell contents are never echoed.');
  if (unmapped_column_cells > 0) {
    rationale.push(unmapped_column_cells + ' supplied cell' + (unmapped_column_cells === 1 ? '' : 's') + ' sat in columns the mapping does not name. Nothing was read from them and none reached these results. They are counted rather than listed, because listing them would be the leak this tool exists to avoid. If these rows were handed straight to the artifact builder without being cut down to the mapped columns first, those cells will still appear in the echoed input parameters, so cut the file down to the mapped columns before building a receipt from it.');
  }
  if (!mapping_supplied) {
    rationale.push('No field mapping was supplied, so no column could be read and every measure foots to zero. That is a defined result on an empty mapping, not a finding that the bordereau is empty.');
  }
  if (unmapped_measures.length > 0) {
    rationale.push('These measures were not mapped and therefore contribute nothing: ' + unmapped_measures.join(', ') + '. An unmapped measure foots to zero because nothing was read for it, which is not the same as a measure that was read and found to be zero.');
  }
  rationale.push(currencies.length === 0
    ? 'No rows were supplied, so there is nothing to foot. Every total is zero by construction.'
    : 'Footing produced totals in ' + currencies.length + ' currenc' + (currencies.length === 1 ? 'y' : 'ies') + ': ' + currencies.map((c) => c.currency + ' gross premium ' + c.gross_premium_display + ', net recomputed ' + c.net_recomputed_display).join('; ') + '. Net is derived as gross premium less brokerage, coverholder commission, mapped taxes and ceded premium.');
  const internalMismatch = currencies.filter((c) => c.net_agrees_internally === false);
  if (internalMismatch.length > 0) {
    rationale.push('In ' + internalMismatch.length + ' currenc' + (internalMismatch.length === 1 ? 'y' : 'ies') + ' the net column as mapped does not equal net derived from the components on the same rows. That is an internal inconsistency in the file itself, before any comparison against an asserted total.');
  }
  rationale.push('Exact agreement on a footing is a weak result and is reported as such: the coverholder footed the same column, so agreement is expected. The check that carries weight is utilisation of the binding authority, because that limit is held by the carrier and is not on the bordereau. It is a declared input here and is never derived from the file under review.');
  rationale.push(aggregate_utilisation.assessed
    ? 'Aggregate utilisation on basis ' + aggregate_utilisation.basis + ' is ' + aggregate_utilisation.consumed_display + ' of a declared limit of ' + aggregate_utilisation.limit_display + ' ' + aggregate_utilisation.limit_currency + ', leaving headroom of ' + aggregate_utilisation.headroom_display + '.'
    : aggregate_utilisation.reason);
  rationale.push(limit_breaches.length === 0
    ? 'No line and no aggregate exceeded a limit the caller declared.'
    : limit_breaches.length + ' limit observation' + (limit_breaches.length === 1 ? '' : 's') + ' were raised against the limits the caller declared. Each names the measured figure, the declared limit and the excess. Whether authority was properly exercised is for the delegated authority audit, not for this tool.');
  if (out_of_scope_lines.length > 0) {
    rationale.push(out_of_scope_lines.length + ' line' + (out_of_scope_lines.length === 1 ? '' : 's') + ' fall outside the period or the currency list the caller declared. They remain in the footing above and are listed separately, because removing them would change a total the reviewer is trying to reconcile.');
  }
  rationale.push(population_defect
    ? 'Population observations: ' + duplicates.length + ' repeated policy reference' + (duplicates.length === 1 ? '' : 's') + ', ' + missing_periods.length + ' expected period' + (missing_periods.length === 1 ? '' : 's') + ' absent, ' + lines_with_absent_mapped_fields.length + ' line' + (lines_with_absent_mapped_fields.length === 1 ? '' : 's') + ' with an absent or unusable mapped field. Each is a fact about the population supplied.'
    : 'No repeated policy reference, no absent expected period and no line with an unusable mapped field were found in the population supplied.');
  rationale.push(comparison_state === 'recompute_only'
    ? 'No asserted totals were supplied, so this run is RECOMPUTE ONLY. It states what the supplied rows foot to. It is not agreement with anything, because nothing was given to compare against.'
    : comparison_state === 'matches'
      ? 'The footing agrees with every one of the ' + comparableDiff.length + ' asserted figure' + (comparableDiff.length === 1 ? '' : 's') + ' supplied. Agreement on a footing means both sides added the same column the same way.'
      : 'The footing differs from the asserted totals on ' + disagreeing.length + ' figure' + (disagreeing.length === 1 ? '' : 's') + '. Each difference is listed with both sides. A difference means the two arithmetics disagree on the rows supplied, which can equally be an incomplete extract or a wrong mapping, and it is not a finding that the coverholder misreported.');
  if (rejected_inputs.length > 0) {
    rationale.push(rejected_inputs.length + ' supplied value' + (rejected_inputs.length === 1 ? ' was' : 's were') + ' not usable and ' + (rejected_inputs.length === 1 ? 'was' : 'were') + ' treated as zero. Each is named by column and type rather than silently dropped, and no cell contents were echoed.');
  }
  rationale.push('No data standard field list, schema, rate table or commission table is held in this tool, and nothing here claims which revision of any standard is current. A later revision makes this receipt dated, not wrong.');

  // ── Flags. ─────────────────────────────────────────────────────────────────────────────────────
  const compliance_flags = ['BDX_RECOMPUTED'];
  compliance_flags.push(comparison_state === 'recompute_only' ? 'BDX_RECOMPUTE_ONLY' : comparison_state === 'matches' ? 'BDX_TOTALS_MATCH' : 'BDX_TOTALS_DIFFER');
  if (limit_breaches.length > 0) compliance_flags.push('BDX_AUTHORITY_BREACH');
  if (population_defect) compliance_flags.push('BDX_POPULATION_DEFECT');
  if (out_of_scope_lines.length > 0) compliance_flags.push('BDX_OUT_OF_SCOPE_LINES');
  if (internalMismatch.length > 0) compliance_flags.push('BDX_NET_INTERNAL_MISMATCH');
  if (!authority_supplied) compliance_flags.push('BDX_AUTHORITY_NOT_SUPPLIED');
  if (!standard_pinned) compliance_flags.push('BDX_STANDARD_NOT_PINNED');
  if (!mapping_supplied) compliance_flags.push('BDX_MAPPING_ABSENT');
  if (suppliedRows.length === 0) compliance_flags.push('BDX_NO_ROWS');
  if (rejected_inputs.length > 0) compliance_flags.push('BDX_INPUTS_REJECTED');
  if (unmapped_column_cells > 0) compliance_flags.push('BDX_UNMAPPED_COLUMNS_PRESENT');
  if (limit_breaches.length > 0 || population_defect || comparison_state === 'differs' || internalMismatch.length > 0) compliance_flags.push('ESCALATION_RAISED');

  const output_payload = {
    basis: BASIS,
    period_label,
    bordereau_class,
    standard_label,
    standard_version,
    standard_pinned,
    amounts_in,
    minor_unit_exponent: MINOR_UNIT_EXPONENT,
    mapped_columns: mapped_columns.slice().sort(),
    measures_mapped,
    unmapped_measures,
    line_count: suppliedRows.length,
    unmapped_column_cells_ignored: unmapped_column_cells,
    currencies,
    aggregate_utilisation,
    per_risk_limit_minor_units,
    per_risk_limit_display: per_risk_limit_minor_units === null ? null : display(per_risk_limit_minor_units),
    per_risk_basis,
    limit_breaches,
    out_of_scope_lines,
    duplicates,
    observed_periods: observedPeriods,
    expected_periods,
    missing_periods,
    unexpected_periods,
    lines_with_absent_mapped_fields,
    population_defect,
    comparison_state,
    comparison_basis: 'The recomputed side of every comparison is footed here from the rows supplied. The authority limits on the other side are carrier held and are declared by the caller, never derived from the bordereau, which is what gives that comparison independent provenance. Exact agreement on a footing is a weak result because both sides added the same column.',
    diff,
    rejected_inputs,
    rationale,
    recompute_only_note: 'Where comparison_state is recompute_only, no asserted totals were supplied and this artifact records what the rows foot to, never agreement. A scripted caller must not read it as a pass.',
    pii_note: 'Only columns named in field_mapping are read. Unmapped columns are ignored and appear nowhere in this artifact, and no rejection record echoes a supplied cell value. Inputs should be anonymised or synthetic.',
    no_standard_claim: 'This tool bundles no data standard field list, no schema and no rate or commission table, reads none, and asserts conformance with none. The mapping and the standard version are the caller declaration.',
    note: 'Deterministic delegated authority bordereau recomputation for one stated period. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It foots the rows supplied, compares them against asserted totals where given, and measures utilisation against binding authority limits the caller declares. It makes no assertion that authority was properly exercised, performs no data standard conformance validation, no sanctions or terms of business screening, and no reserving or pricing adequacy assessment. It is not a regulatory filing and not legal advice.',
  };

  return { output_payload, compliance_flags };
}

/**
 * §1.4 clause-binding pointers. DELIBERATELY EMPTY: the arithmetic here is governed by a private
 * binding authority agreement rather than by a published instrument, so there is no clause with an
 * honest `in_force_from` to pin. The shared constraints permit pinned citations or none.
 */
export const CLAUSE_BINDING_POINTERS = [];

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    clause_bindings: CLAUSE_BINDING_POINTERS,
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
