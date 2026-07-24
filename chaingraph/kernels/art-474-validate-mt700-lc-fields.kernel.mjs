import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-474-validate-mt700-lc-fields';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_mt700_lc_fields',
  mandate_type: 'compliance_mandate', gpu: false,
};

// SWIFT MT700 Documentary Credit field-format + date-logic conformance, UCP 600 / MT700 mandatory-field
// rules. Provable node counterpart to tools/420-mt700-lc-field-validator.html's `runValidator()` -- ported
// verbatim (same 19 field checks, same weighted score) so tool<->kernel parity is exact. The Presented
// Documents discrepancy check (R01-R14) on that tool page stays browser-only; it depends on a live
// presentation event, not the static MT700 field set this kernel validates.
//
// Deterministic by construction: no wall clock. `as_of_date` (YYMMDD, optional) is a caller-supplied
// policy_parameter for the "issue date in the past" operational check -- if omitted, that one check is
// skipped (status 'skip') rather than reading real time. Pure ECMA-262 date arithmetic on parsed YYMMDD
// values only; no Date.now()/bare new Date()/Math.random(). Finite gate: score is always 0-100.

const ISO_CCY = new Set(['AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNY','COP','CRC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','GBP','GEL','GHS','GMD','GTQ','GYD','HKD','HNL','HRK','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LYD','MAD','MDL','MKD','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLL','SOS','SRD','STN','SVC','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XOF','XPF','YER','ZAR','ZMW']);

function parseYYMMDD(s) {
  if (typeof s !== 'string' || !/^\d{6}$/.test(s)) return null;
  const yy = parseInt(s.slice(0, 2), 10), mm = parseInt(s.slice(2, 4), 10), dd = parseInt(s.slice(4, 6), 10);
  const yr = yy >= 50 ? 1900 + yy : 2000 + yy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(yr, mm - 1, dd);
  if (d.getMonth() !== mm - 1) return null;
  return d;
}

function str(v) { return typeof v === 'string' ? v.trim() : ''; }

export function compute(pp) {
  pp = pp || {};
  const f = pp.fields || {};
  const v = {
    f20: str(f.field_20), f40a: str(f.field_40A),
    f31c: str(f.field_31C), f31d_date: str(f.field_31D_date), f31d_place: str(f.field_31D_place),
    f32b: str(f.field_32B),
    f41_bank: str(f.field_41_bank), f41_by: str(f.field_41_by),
    f42: str(f.field_42), f43p: str(f.field_43P), f43t: str(f.field_43T),
    f44a: str(f.field_44A), f44b: str(f.field_44B), f44c: str(f.field_44C),
    f45a: str(f.field_45A), f46a: str(f.field_46A),
    f48: str(f.field_48), f49: str(f.field_49), f50: str(f.field_50), f59: str(f.field_59),
  };
  const asOfDate = pp.as_of_date != null ? parseYYMMDD(str(pp.as_of_date)) : null;

  const errors = [], warnings = [], field_results = [];
  let totalPoints = 0, earnedPoints = 0;

  function check(field, label, value, weight, status, rule, issue) {
    totalPoints += weight;
    if (status === 'ok') earnedPoints += weight;
    else if (status === 'warn') earnedPoints += weight * 0.5;
    field_results.push({ field, label, value: value || '(empty)', status, rule, issue: issue || '' });
  }

  // Field 20 -- DC Number
  const f20Ok = /^[A-Z0-9/-]{1,16}$/.test(v.f20.toUpperCase());
  if (!v.f20) { errors.push({ field: '20', message: 'Field 20 (DC Number) is missing.', citation: 'UCP 600 Art.1 / MT700 mandatory' }); check('20', 'DC Number', '', 10, 'err', 'Max 16 chars, A-Z 0-9 / -', 'Missing mandatory field'); }
  else if (!f20Ok) { errors.push({ field: '20', message: `Field 20 contains invalid characters or exceeds 16 chars: "${v.f20}"`, citation: 'SWIFT MT700 Field 20 spec' }); check('20', 'DC Number', v.f20, 10, 'err', 'Max 16 chars, A-Z 0-9 / -', 'Invalid format'); }
  else { check('20', 'DC Number', v.f20, 10, 'ok', 'Max 16 chars, A-Z 0-9 / -', ''); }

  // Field 40A -- Form of DC
  if (!v.f40a) { errors.push({ field: '40A', message: 'Field 40A (Form of DC) is missing.', citation: 'UCP 600 Art.3 / MT700 mandatory' }); check('40A', 'Form of DC', '', 8, 'err', 'IRREVOCABLE | IRREVOCABLE TRANSFERABLE | IRREVOCABLE STANDBY', 'Missing'); }
  else { check('40A', 'Form of DC', v.f40a, 8, 'ok', 'ICC-recognised form', ''); }

  // Field 31C -- Date of Issue
  const issueDate = parseYYMMDD(v.f31c);
  if (!v.f31c) { errors.push({ field: '31C', message: 'Field 31C (Date of Issue) is missing.', citation: 'MT700 mandatory' }); check('31C', 'Date of Issue', '', 8, 'err', 'YYMMDD format', 'Missing'); }
  else if (!issueDate) { errors.push({ field: '31C', message: `Field 31C: "${v.f31c}" is not a valid YYMMDD date.`, citation: 'MT700 date format' }); check('31C', 'Date of Issue', v.f31c, 8, 'err', 'YYMMDD format', 'Invalid date'); }
  else if (asOfDate && issueDate < asOfDate) { warnings.push({ field: '31C', message: `Field 31C: Issue date ${v.f31c} appears to be in the past.`, citation: 'Operational check' }); check('31C', 'Date of Issue', v.f31c, 8, 'warn', 'Date must be today or future', 'Date in past'); }
  else if (!asOfDate) { check('31C', 'Date of Issue', v.f31c, 8, 'skip', 'Valid YYMMDD (past-date check needs as_of_date)', ''); }
  else { check('31C', 'Date of Issue', v.f31c, 8, 'ok', 'Valid YYMMDD', ''); }

  // Field 31D -- Date + Place of Expiry
  const expiryDate = parseYYMMDD(v.f31d_date);
  if (!v.f31d_date) { errors.push({ field: '31D Date', message: 'Field 31D (Date of Expiry) is missing.', citation: 'UCP 600 Art.6(a) / MT700 mandatory' }); check('31D Date', 'Date of Expiry', '', 9, 'err', 'YYMMDD, after issue date', 'Missing'); }
  else if (!expiryDate) { errors.push({ field: '31D Date', message: `Field 31D date "${v.f31d_date}" is not a valid YYMMDD date.`, citation: 'UCP 600 Art.6' }); check('31D Date', 'Date of Expiry', v.f31d_date, 9, 'err', 'Valid YYMMDD', 'Invalid date'); }
  else if (issueDate && expiryDate <= issueDate) { errors.push({ field: '31D Date', message: 'Field 31D: Expiry date must be after the issue date (Field 31C).', citation: 'UCP 600 Art.6(a)' }); check('31D Date', 'Date of Expiry', v.f31d_date, 9, 'err', 'Must be after Field 31C', 'Expiry <= Issue date'); }
  else { check('31D Date', 'Date of Expiry', v.f31d_date, 9, 'ok', 'After issue date', ''); }
  if (!v.f31d_place) { errors.push({ field: '31D Place', message: 'Field 31D: Place of Expiry is required.', citation: 'UCP 600 Art.6(a)(ii)' }); check('31D Place', 'Place of Expiry', '', 5, 'err', 'Place text required', 'Missing'); }
  else { check('31D Place', 'Place of Expiry', v.f31d_place, 5, 'ok', 'Place specified', ''); }

  // Field 32B -- Currency / Amount
  if (!v.f32b) { errors.push({ field: '32B', message: 'Field 32B (Currency/Amount) is missing.', citation: 'MT700 mandatory' }); check('32B', 'Currency/Amount', '', 8, 'err', 'ISO 4217 + numeric amount', 'Missing'); }
  else {
    const parts = v.f32b.split(/\s+/);
    const ccy = (parts[0] || '').toUpperCase();
    const amt = parseFloat(parts[1]);
    if (!ISO_CCY.has(ccy)) { errors.push({ field: '32B', message: `Field 32B: "${ccy}" is not a recognised ISO 4217 currency code.`, citation: 'ISO 4217' }); check('32B', 'Currency/Amount', v.f32b, 8, 'err', 'Valid ISO 4217 code', 'Unknown currency'); }
    else if (!Number.isFinite(amt) || amt <= 0) { errors.push({ field: '32B', message: 'Field 32B: Amount is missing or non-positive.', citation: 'MT700 spec' }); check('32B', 'Currency/Amount', v.f32b, 8, 'err', 'Positive numeric amount', 'Invalid amount'); }
    else { check('32B', 'Currency/Amount', v.f32b, 8, 'ok', 'Valid CCY + amount', ''); }
  }

  // Field 41 -- Available With / By
  if (!v.f41_bank) { errors.push({ field: '41 Bank', message: 'Field 41: Available With (bank) is missing.', citation: 'UCP 600 Art.6(b)' }); check('41 Bank', 'Available With', '', 6, 'err', 'Bank name or ANY BANK', 'Missing'); }
  else { check('41 Bank', 'Available With', v.f41_bank, 6, 'ok', 'Bank specified', ''); }
  if (!v.f41_by) { errors.push({ field: '41 By', message: 'Field 41: Available By (payment method) is missing.', citation: 'UCP 600 Art.6(b)' }); check('41 By', 'Available By', '', 6, 'err', 'BY PAYMENT/ACCEPTANCE/NEGOTIATION/DEF PAYMENT', 'Missing'); }
  else if (v.f41_by === 'BY NEGOTIATION' && v.f41_bank && v.f41_bank.toUpperCase() !== 'ANY BANK' && v.f41_bank.trim() === '') { warnings.push({ field: '41 By', message: 'Field 41: Credit available by negotiation -- typically available with ANY BANK or a named bank.', citation: 'UCP 600 Art.6(b)' }); check('41 By', 'Available By', v.f41_by, 6, 'warn', 'By Negotiation -- bank should be specified', 'Review'); }
  else { check('41 By', 'Available By', v.f41_by, 6, 'ok', 'Valid payment method', ''); }

  // Field 42 -- Drafts At
  if ((v.f41_by === 'BY ACCEPTANCE' || v.f41_by === 'BY DEF PAYMENT') && !v.f42) { errors.push({ field: '42', message: 'Field 42: Drafts At is required when Available By Acceptance or Def Payment.', citation: 'UCP 600 Art.6 / MT700 conditional' }); check('42', 'Drafts At', '', 5, 'err', 'Required for Acceptance/Def Payment', 'Missing tenor'); }
  else if (v.f42) { check('42', 'Drafts At', v.f42, 5, 'ok', 'Tenor specified', ''); }
  else { check('42', 'Drafts At', '(not required)', 5, 'skip', 'N/A for Payment/Negotiation', ''); }

  // Field 43P / 43T
  if (!v.f43p) { warnings.push({ field: '43P', message: 'Field 43P (Partial Shipments) not specified -- defaults to ALLOWED under UCP 600.', citation: 'UCP 600 Art.31(a)' }); check('43P', 'Partial Shipments', '', 4, 'warn', 'ALLOWED | NOT ALLOWED', 'Not specified'); }
  else { check('43P', 'Partial Shipments', v.f43p, 4, 'ok', 'Valid value', ''); }
  if (!v.f43t) { warnings.push({ field: '43T', message: 'Field 43T (Transhipment) not specified -- defaults to ALLOWED under UCP 600 Art.19-25.', citation: 'UCP 600 Art.20(c)' }); check('43T', 'Transhipment', '', 4, 'warn', 'ALLOWED | NOT ALLOWED', 'Not specified'); }
  else { check('43T', 'Transhipment', v.f43t, 4, 'ok', 'Valid value', ''); }

  // Field 44A / 44B -- Ports
  if (!v.f44a) { warnings.push({ field: '44A', message: 'Field 44A (Port of Loading) not specified.', citation: 'ISBP 821 / operational best practice' }); check('44A', 'Port of Loading', '', 3, 'warn', 'Recommended', 'Not specified'); }
  else { check('44A', 'Port of Loading', v.f44a, 3, 'ok', 'Specified', ''); }
  if (!v.f44b) { warnings.push({ field: '44B', message: 'Field 44B (Port of Discharge) not specified.', citation: 'ISBP 821 / operational best practice' }); check('44B', 'Port of Discharge', '', 3, 'warn', 'Recommended', 'Not specified'); }
  else { check('44B', 'Port of Discharge', v.f44b, 3, 'ok', 'Specified', ''); }

  // Field 44C -- Latest Shipment Date
  if (v.f44c) {
    const shipDate = parseYYMMDD(v.f44c);
    if (!shipDate) { errors.push({ field: '44C', message: `Field 44C: "${v.f44c}" is not a valid YYMMDD date.`, citation: 'MT700 spec' }); check('44C', 'Latest Shipment', '', 5, 'err', 'Valid YYMMDD', 'Invalid date'); }
    else if (expiryDate && shipDate > expiryDate) { errors.push({ field: '44C', message: 'Field 44C: Latest Shipment date is after the Expiry date -- impossible.', citation: 'UCP 600 Art.6 / operational' }); check('44C', 'Latest Shipment', v.f44c, 5, 'err', 'Must be before expiry (31D)', 'After expiry'); }
    else if (issueDate && shipDate < issueDate) { errors.push({ field: '44C', message: 'Field 44C: Latest Shipment date is before the Issue date.', citation: 'Operational check' }); check('44C', 'Latest Shipment', v.f44c, 5, 'err', 'Must be after issue (31C)', 'Before issue date'); }
    else { check('44C', 'Latest Shipment', v.f44c, 5, 'ok', 'Valid date sequence', ''); }
  } else { check('44C', 'Latest Shipment', '(not specified)', 5, 'skip', 'Optional -- may use 44D period instead', ''); }

  // Field 45A -- Description of Goods
  if (!v.f45a) { errors.push({ field: '45A', message: 'Field 45A (Description of Goods) is missing.', citation: 'UCP 600 Art.18(a)(iii) / MT700 mandatory' }); check('45A', 'Description of Goods', '', 7, 'err', 'Required -- describe goods clearly', 'Missing'); }
  else {
    const incoRx = /\b(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)\b/i;
    if (!incoRx.test(v.f45a)) { warnings.push({ field: '45A', message: 'Field 45A: No Incoterm detected. Consider specifying trade terms (e.g. CIF, FOB) for clarity.', citation: 'ISBP 821 / ICC guidance' }); check('45A', 'Description of Goods', v.f45a.slice(0, 40) + '...', 7, 'warn', 'Incoterm recommended', 'No Incoterm detected'); }
    else { check('45A', 'Description of Goods', v.f45a.slice(0, 40) + '...', 7, 'ok', 'Goods described with Incoterm', ''); }
  }

  // Field 46A -- Documents Required
  if (!v.f46a) { errors.push({ field: '46A', message: 'Field 46A (Documents Required) is missing.', citation: 'UCP 600 Art.18 / MT700 mandatory' }); check('46A', 'Documents Required', '', 8, 'err', 'Required', 'Missing'); }
  else {
    const docText = v.f46a.toUpperCase();
    const hasInvoice = /INVOICE/.test(docText);
    const hasTransport = /BILL OF LADING|AIRWAY BILL|AWB|SEA WAYBILL|TRANSPORT DOCUMENT|MULTIMODAL/.test(docText);
    const hasPacking = /PACKING/.test(docText);
    if (!hasInvoice) warnings.push({ field: '46A', message: 'Field 46A: Commercial Invoice not detected -- typically required under UCP 600.', citation: 'UCP 600 Art.18' });
    if (!hasTransport) warnings.push({ field: '46A', message: 'Field 46A: Transport document (B/L, AWB) not detected -- typically required.', citation: 'UCP 600 Art.19-25' });
    if (!hasPacking) warnings.push({ field: '46A', message: 'Field 46A: Packing List not detected -- commonly required.', citation: 'ISBP 821 best practice' });
    const missingDocs = (hasInvoice ? 0 : 1) + (hasTransport ? 0 : 1) + (hasPacking ? 0 : 1);
    check('46A', 'Documents Required', v.f46a.slice(0, 50) + '...', 8, missingDocs > 1 ? 'warn' : 'ok', 'Invoice + transport doc + packing list expected', missingDocs > 0 ? `${missingDocs} common doc(s) not detected` : '');
  }

  // Field 48 -- Presentation Period
  const presDay = parseInt(v.f48, 10);
  if (!Number.isFinite(presDay) || presDay < 1) { errors.push({ field: '48', message: 'Field 48: Presentation period must be a positive number of days.', citation: 'UCP 600 Art.14(c)' }); check('48', 'Presentation Period', v.f48, 5, 'err', 'Positive integer', 'Invalid value'); }
  else if (presDay > 21) { warnings.push({ field: '48', message: `Field 48: Presentation period is ${presDay} days -- UCP 600 Art.14(c) sets a maximum of 21 days. Presentation after 21 days may be rejected.`, citation: 'UCP 600 Art.14(c)' }); check('48', 'Presentation Period', String(presDay) + ' days', 5, 'warn', 'UCP 600 max is 21 days', 'Exceeds 21-day rule'); }
  else { check('48', 'Presentation Period', String(presDay) + ' days', 5, 'ok', 'Within UCP 600 Art.14(c) limit', ''); }

  // Field 49 -- Confirmation Instructions
  if (!v.f49) { errors.push({ field: '49', message: 'Field 49 (Confirmation Instructions) is missing.', citation: 'MT700 mandatory / UCP 600 Art.8' }); check('49', 'Confirmation', '', 5, 'err', 'CONFIRM | MAY ADD | WITHOUT', 'Missing'); }
  else { check('49', 'Confirmation', v.f49, 5, 'ok', 'Valid instruction', ''); }

  // Field 50 / 59 -- Applicant / Beneficiary
  if (!v.f50) { errors.push({ field: '50', message: 'Field 50 (Applicant) is missing.', citation: 'MT700 mandatory' }); check('50', 'Applicant', '', 5, 'err', 'Required', 'Missing'); }
  else { check('50', 'Applicant', v.f50, 5, 'ok', 'Specified', ''); }
  if (!v.f59) { errors.push({ field: '59', message: 'Field 59 (Beneficiary) is missing.', citation: 'MT700 mandatory' }); check('59', 'Beneficiary', '', 5, 'err', 'Required', 'Missing'); }
  else { check('59', 'Beneficiary', v.f59, 5, 'ok', 'Specified', ''); }

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const compliant = score >= 80;
  const verdict = score >= 80 ? 'compliant' : score >= 60 ? 'marginal' : 'non_compliant';

  const compliance_flags = [];
  compliance_flags.push('MT700_FIELD_VALIDATION_ASSESSED');
  compliance_flags.push(compliant ? 'MT700_COMPLIANT' : errors.length > 0 ? 'MT700_CRITICAL_ERRORS' : 'MT700_MARGINAL_REVIEW_WARNINGS');

  return {
    output_payload: {
      score, verdict, compliant,
      error_count: errors.length, warning_count: warnings.length,
      errors, warnings, field_results,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
