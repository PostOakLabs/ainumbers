import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-578-etf-pcf-basket-verification';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_etf_pcf_basket',
  mandate_type: 'compliance_control', gpu: false,
};

// ETF create/redeem basket verification against the daily Portfolio Composition File (art-578).
//
// WHAT IT ENFORCES. An authorized participant (AP) assembles an in-kind basket of securities
// (plus a cash balancing amount, and sometimes cash-in-lieu substitutions for lines it cannot
// deliver) to create or redeem creation units of an ETF, against the fund's daily Portfolio
// Composition File (PCF) published by the issuer/custodian. This kernel recomputes what the
// assembled basket for N creation units SHOULD contain -- per-line quantity, cash-in-lieu
// substitution value, and total cash -- and diffs it against what the AP actually assembled.
//
// THREE CHECKS. (a) per-line match: every PCF line's expected quantity (its per-unit quantity
// times units_requested) must be delivered by the basket, either in kind or via a declared
// cash-in-lieu substitution covering exactly the shortfall -- never a silent gap. (b) balancing-
// amount arithmetic: the PCF's declared per-unit balancing amount times units_requested, plus
// the total cash-in-lieu substitution value, must equal the cash the AP actually deposited,
// within a declared tolerance. (c) creation-unit math: units_requested must be a positive
// integer and every PCF per-unit quantity a positive integer, so per-line expected quantities
// are exact integer multiples -- no fractional shares.
//
// SCOPE. This kernel performs arithmetic only over a caller-declared PCF and a caller-declared
// assembled basket. It does not source, derive, or independently verify the PCF itself, does not
// price securities, and does not determine which lines are eligible for cash-in-lieu -- the
// caller declares the substitution price per line, the same way a custodian's basket-composition
// worksheet already does.
//
// CLAUSE. DTCC's ETF Processing service (Fund/SERV, operating over NSCC) settles AP creation and
// redemption orders against the fund's daily PCF; this kernel performs the reconciliation an AP
// or its custodian already runs to check a proposed or executed basket against that PCF before
// or after settlement. No DTCC endorsement of this tool is implied or claimed.
//
// TOLERANCE IS A DECLARED INPUT, NEVER A DEFAULT. An unstated cash tolerance would turn every
// rounding difference into a break, so absence emits the did-not-run outcome with a reason.
//
// MINOR UNITS. Every cash figure is an integer minor unit (cents); every quantity is an integer
// share count. Non-integer input is REJECTED rather than coerced.
//
// Deterministic arithmetic only -- no clock, no randomness, no network, no PII.

const MAX_LINES = 100;
const MAX_CIL = 50;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function s(v) { return String(v == null ? '' : v).trim(); }

function safeInt(v) {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isSafeInteger(n)) return n;
  }
  return null;
}

function posInt(v) { const n = safeInt(v); return n !== null && n > 0 ? n : null; }
function abs(n) { return n < 0 ? -n : n; }
function isDate(v) { return typeof v === 'string' && DATE_RE.test(v); }

const SCOPE_NOTE = 'Performs arithmetic only over a caller-declared Portfolio Composition File and a caller-declared assembled basket. Does not source, derive, or independently verify the PCF, does not price securities, and does not determine which lines are cash-in-lieu-eligible.';
const CLAUSE_NOTE = "DTCC's ETF Processing service (Fund/SERV, over NSCC) settles authorized-participant creation/redemption baskets against the fund's daily Portfolio Composition File. This kernel performs the per-line and balancing-amount reconciliation an AP or its custodian already runs against that PCF. No DTCC endorsement of this tool is implied or claimed.";

function emptyResult(reason, extra, flags) {
  return {
    output_payload: {
      decision: { gate_policy: 'review_required', execution_state: 'did_not_run', reason },
      verdict: 'INDETERMINATE',
      transaction_type: (extra && extra.transaction_type) || null,
      units_requested: (extra && extra.units_requested) || null,
      creation_unit_size: (extra && extra.creation_unit_size) || null,
      pcf_as_of: (extra && extra.pcf_as_of) || null,
      cash_tolerance_minor: (extra && typeof extra.cash_tolerance_minor === 'number') ? extra.cash_tolerance_minor : null,
      line_count: (extra && typeof extra.line_count === 'number') ? extra.line_count : 0,
      line_results: [],
      cash_in_lieu_total_minor: null,
      expected_cash_minor: null,
      cash_deposited_minor: (extra && typeof extra.cash_deposited_minor === 'number') ? extra.cash_deposited_minor : null,
      cash_delta_minor: null,
      cash_matches: null,
      findings: [],
      rejected_inputs: (extra && extra.rejected_inputs) || [],
      scope_note: SCOPE_NOTE,
      clause_note: CLAUSE_NOTE,
    },
    compliance_flags: flags,
  };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  // -- Cash tolerance: declared or nothing.
  const tolDeclared = pp.cash_tolerance_minor !== undefined && pp.cash_tolerance_minor !== null && pp.cash_tolerance_minor !== '';
  const cash_tolerance_minor = tolDeclared ? safeInt(pp.cash_tolerance_minor) : null;
  if (!tolDeclared) {
    rejected_inputs.push({ where: 'cash_tolerance_minor', reason: 'absent -- a cash tolerance must be declared, never defaulted', supplied: null });
    return emptyResult('cash_tolerance_not_declared', { rejected_inputs }, ['ETFPCF_TOLERANCE_NOT_DECLARED']);
  }
  if (cash_tolerance_minor === null || cash_tolerance_minor < 0) {
    rejected_inputs.push({ where: 'cash_tolerance_minor', reason: 'not a non-negative safe integer number of minor units', supplied: typeof pp.cash_tolerance_minor === 'number' ? pp.cash_tolerance_minor : s(pp.cash_tolerance_minor) });
    return emptyResult('cash_tolerance_not_declared', { rejected_inputs }, ['ETFPCF_TOLERANCE_NOT_DECLARED']);
  }

  // -- Transaction type + units + creation-unit size.
  const transaction_type = (pp.transaction_type === 'create' || pp.transaction_type === 'redeem') ? pp.transaction_type : null;
  if (!transaction_type) rejected_inputs.push({ where: 'transaction_type', reason: "must be 'create' or 'redeem'", supplied: pp.transaction_type === undefined ? null : s(pp.transaction_type) });

  const units_requested = posInt(pp.units_requested);
  if (units_requested === null) rejected_inputs.push({ where: 'units_requested', reason: 'absent or not a positive safe integer', supplied: pp.units_requested === undefined ? null : s(pp.units_requested) });

  const creation_unit_size = posInt(pp.creation_unit_size);
  if (creation_unit_size === null) rejected_inputs.push({ where: 'creation_unit_size', reason: 'absent or not a positive safe integer', supplied: pp.creation_unit_size === undefined ? null : s(pp.creation_unit_size) });

  // -- PCF.
  const pcfIn = (pp.pcf && typeof pp.pcf === 'object') ? pp.pcf : {};
  const pcf_as_of = isDate(pcfIn.as_of) ? pcfIn.as_of : null;
  if (!pcf_as_of) rejected_inputs.push({ where: 'pcf.as_of', reason: 'absent or not YYYY-MM-DD', supplied: pcfIn.as_of === undefined ? null : s(pcfIn.as_of) });

  const balancing_amount_per_unit_minor = safeInt(pcfIn.balancing_amount_per_unit_minor);
  if (balancing_amount_per_unit_minor === null) rejected_inputs.push({ where: 'pcf.balancing_amount_per_unit_minor', reason: 'absent or not an integer number of minor units', supplied: null });

  const pcfLinesIn = Array.isArray(pcfIn.lines) ? pcfIn.lines.slice(0, MAX_LINES) : [];
  const pcfLines = [];
  const seenSec = new Map();
  for (let i = 0; i < pcfLinesIn.length; i++) {
    const row = pcfLinesIn[i] || {};
    const security_id = s(row.security_id);
    const name = s(row.name);
    const quantity_per_unit = posInt(row.quantity_per_unit);
    if (!security_id) { rejected_inputs.push({ where: 'pcf.lines[' + i + '].security_id', reason: 'absent', supplied: null }); continue; }
    if (seenSec.has(security_id)) { rejected_inputs.push({ where: 'pcf.lines[' + i + '].security_id', reason: 'duplicate security_id', supplied: security_id }); continue; }
    if (quantity_per_unit === null) { rejected_inputs.push({ where: 'pcf.lines[' + i + '].quantity_per_unit', reason: 'absent or not a positive safe integer', supplied: security_id }); continue; }
    seenSec.set(security_id, true);
    pcfLines.push({ security_id, name, quantity_per_unit });
  }
  if (pcfLinesIn.length > MAX_LINES) rejected_inputs.push({ where: 'pcf.lines', reason: 'more than ' + MAX_LINES + ' PCF lines supplied', supplied: pcfLinesIn.length });
  if (pcfLines.length === 0) rejected_inputs.push({ where: 'pcf.lines', reason: 'absent or empty -- at least one PCF line is required', supplied: null });

  // -- Basket.
  const basketIn = (pp.basket && typeof pp.basket === 'object') ? pp.basket : {};
  const cash_deposited_minor = safeInt(basketIn.cash_deposited_minor);
  if (cash_deposited_minor === null) rejected_inputs.push({ where: 'basket.cash_deposited_minor', reason: 'absent or not an integer number of minor units', supplied: null });

  const basketLinesIn = Array.isArray(basketIn.lines) ? basketIn.lines.slice(0, MAX_LINES) : [];
  const basketQty = new Map();
  const basketExtras = [];
  const basketSeen = new Map();
  for (let i = 0; i < basketLinesIn.length; i++) {
    const row = basketLinesIn[i] || {};
    const security_id = s(row.security_id);
    const quantity = safeInt(row.quantity);
    if (!security_id || quantity === null || quantity < 0) {
      rejected_inputs.push({ where: 'basket.lines[' + i + ']', reason: 'security_id required, quantity a non-negative integer', supplied: security_id || null });
      continue;
    }
    if (basketSeen.has(security_id)) { rejected_inputs.push({ where: 'basket.lines[' + i + '].security_id', reason: 'duplicate security_id', supplied: security_id }); continue; }
    basketSeen.set(security_id, true);
    basketQty.set(security_id, quantity);
    if (!seenSec.has(security_id)) basketExtras.push(security_id);
  }

  const cilIn = Array.isArray(basketIn.cash_in_lieu) ? basketIn.cash_in_lieu.slice(0, MAX_CIL) : [];
  const cilBySecurity = new Map();
  const cilRows = [];
  for (let i = 0; i < cilIn.length; i++) {
    const row = cilIn[i] || {};
    const security_id = s(row.security_id);
    const shortfall_quantity = safeInt(row.shortfall_quantity);
    const substitution_price_minor = safeInt(row.substitution_price_minor);
    if (!security_id || shortfall_quantity === null || shortfall_quantity <= 0 || substitution_price_minor === null || substitution_price_minor < 0) {
      rejected_inputs.push({ where: 'basket.cash_in_lieu[' + i + ']', reason: 'security_id required, shortfall_quantity a positive integer, substitution_price_minor a non-negative integer', supplied: security_id || null });
      continue;
    }
    if (cilBySecurity.has(security_id)) { rejected_inputs.push({ where: 'basket.cash_in_lieu[' + i + '].security_id', reason: 'duplicate security_id', supplied: security_id }); continue; }
    const value_minor = shortfall_quantity * substitution_price_minor;
    cilBySecurity.set(security_id, { shortfall_quantity, substitution_price_minor, value_minor });
    cilRows.push({ security_id, shortfall_quantity, substitution_price_minor, value_minor });
  }
  if (cilIn.length > MAX_CIL) rejected_inputs.push({ where: 'basket.cash_in_lieu', reason: 'more than ' + MAX_CIL + ' cash-in-lieu rows supplied', supplied: cilIn.length });

  const requiredMissing = !transaction_type || units_requested === null || creation_unit_size === null
    || !pcf_as_of || balancing_amount_per_unit_minor === null || pcfLines.length === 0 || cash_deposited_minor === null;
  if (requiredMissing) {
    return emptyResult('required_inputs_incomplete', {
      transaction_type, units_requested, creation_unit_size, pcf_as_of, cash_tolerance_minor,
      line_count: pcfLines.length, cash_deposited_minor, rejected_inputs,
    }, ['ETFPCF_REQUIRED_INPUTS_INCOMPLETE']);
  }

  // -- (a) per-line match.
  const line_results = [];
  const findings = [];
  let cash_in_lieu_total_minor = 0;

  for (const line of pcfLines) {
    const expected_quantity = line.quantity_per_unit * units_requested;
    const delivered_quantity = basketQty.has(line.security_id) ? basketQty.get(line.security_id) : 0;
    const cil = cilBySecurity.get(line.security_id) || null;
    const substituted_quantity = cil ? cil.shortfall_quantity : 0;
    const covered_quantity = delivered_quantity + substituted_quantity;
    const line_matches = covered_quantity === expected_quantity;
    if (cil) cash_in_lieu_total_minor += cil.value_minor;

    if (!line_matches) {
      findings.push({
        code: 'LINE_QUANTITY_MISMATCH', severity: 'high', security_id: line.security_id,
        message: 'Security ' + line.security_id + ' expected ' + expected_quantity + ' (delivered ' + delivered_quantity + ' + cash-in-lieu ' + substituted_quantity + ' = ' + covered_quantity + ').',
      });
    } else if (cil && delivered_quantity + substituted_quantity === expected_quantity && substituted_quantity > 0 && delivered_quantity === expected_quantity) {
      // Declared a cash-in-lieu substitution the basket didn't actually need -- flag as an
      // informational inconsistency rather than a quantity break (the line still matches).
      findings.push({ code: 'CASH_IN_LIEU_UNNEEDED', severity: 'warning', security_id: line.security_id, message: 'Security ' + line.security_id + ' was fully delivered in kind; the declared cash-in-lieu substitution was not needed.' });
    }

    line_results.push({
      security_id: line.security_id, name: line.name,
      expected_quantity, delivered_quantity, substituted_quantity, covered_quantity, matches: line_matches,
      cash_in_lieu_value_minor: cil ? cil.value_minor : 0,
    });
  }

  for (const extraId of basketExtras) {
    findings.push({ code: 'LINE_EXTRA_IN_BASKET', severity: 'high', security_id: extraId, message: 'Security ' + extraId + ' was delivered in the basket but is not a PCF line.' });
  }
  for (const cilRow of cilRows) {
    if (!seenSec.has(cilRow.security_id)) {
      findings.push({ code: 'CASH_IN_LIEU_NOT_A_PCF_LINE', severity: 'high', security_id: cilRow.security_id, message: 'Cash-in-lieu declared for ' + cilRow.security_id + ', which is not a PCF line.' });
    }
  }

  // -- (b) balancing-amount arithmetic.
  const expected_balancing_total_minor = balancing_amount_per_unit_minor * units_requested;
  const expected_cash_minor = expected_balancing_total_minor + cash_in_lieu_total_minor;
  const cash_delta_minor = cash_deposited_minor - expected_cash_minor;
  const cash_matches = abs(cash_delta_minor) <= cash_tolerance_minor;
  if (!cash_matches) {
    findings.push({
      code: 'BALANCING_CASH_MISMATCH', severity: 'high',
      message: 'Expected cash ' + expected_cash_minor + ' minor units (balancing ' + expected_balancing_total_minor + ' + cash-in-lieu ' + cash_in_lieu_total_minor + '); deposited ' + cash_deposited_minor + '; delta ' + cash_delta_minor + '.',
    });
  }

  const hasHigh = findings.some((f) => f.severity === 'high');
  const verdict = hasHigh ? 'DIVERGES' : 'MATCHES';
  const gate_policy = hasHigh ? 'review_required' : 'auto_pass';

  const compliance_flags = ['ETFPCF_BASKET_EVALUATED'];
  if (findings.some((f) => f.code === 'LINE_QUANTITY_MISMATCH')) compliance_flags.push('ETFPCF_LINE_QUANTITY_MISMATCH');
  if (findings.some((f) => f.code === 'LINE_EXTRA_IN_BASKET')) compliance_flags.push('ETFPCF_LINE_EXTRA_IN_BASKET');
  if (!cash_matches) compliance_flags.push('ETFPCF_BALANCING_CASH_MISMATCH');
  if (cash_in_lieu_total_minor > 0) compliance_flags.push('ETFPCF_CASH_IN_LIEU_APPLIED');
  if (rejected_inputs.length > 0) compliance_flags.push('ETFPCF_INPUTS_REJECTED');

  return {
    output_payload: {
      decision: { gate_policy, execution_state: 'ran', reason: null },
      verdict, transaction_type, units_requested, creation_unit_size, pcf_as_of, cash_tolerance_minor,
      line_count: pcfLines.length, line_results,
      cash_in_lieu_total_minor, expected_cash_minor, cash_deposited_minor, cash_delta_minor, cash_matches,
      findings, rejected_inputs,
      scope_note: SCOPE_NOTE, clause_note: CLAUSE_NOTE,
    },
    compliance_flags,
  };
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
