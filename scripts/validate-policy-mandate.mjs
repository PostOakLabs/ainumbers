#!/usr/bin/env node
/**
 * validate-policy-mandate.mjs — the reference validator for the AINumbers
 * Policy Mandate, v1.1 (MANDATE-V11-CAVEATS-1).
 *
 * WHAT v1.1 IS. v1.1 = v1.0 (CONTRACT.md §3.1) PLUS one optional top-level
 * member, `caveats`, PLUS the §3.3 intake passthrough duty. Nothing else
 * moves. There is no in-band schema-version field to bump: `ap2_version` was
 * retired at v0.4 and `chaingraph_version` is the ChainGraph envelope's
 * version, not the mandate's. "v1.1" is therefore a CONTRACT version, and a
 * v1.1 document is structurally indistinguishable from a v1.0 document that
 * happens to carry `caveats`. That is deliberate: it is what makes the change
 * additive by construction rather than by promise.
 *
 * WHY IT EXISTS (0xAlpha/audits/2026-08-23-flag-blind-consumers-audit.md
 * FB-03, Tier A rec 3). Caveat text rides Policy Mandate exports today by
 * accident: no schema member, no intake contract. So nothing downstream may
 * rely on it and nothing upstream is obliged to keep it. This module turns
 * that accident into a contract.
 *
 * ── THE ADDITIVITY GUARANTEE, AND HOW IT IS ENFORCED ──────────────────────
 * A v1.1 validator that rejects a v1.0 document has broken every shipped
 * exporter. The guarantee here is structural, not aspirational:
 *
 *   ERROR_CONDITIONS(v1.1) = ERROR_CONDITIONS(v1.0-floor) ∪ CAVEATS_RULES
 *
 * where `v1.0-floor` is the WEAKEST rule set any shipped `AP2Schema.validate`
 * enforces (object shape, an identity field, a non-empty `mandate_type`, and
 * array-ness of the array members), and `CAVEATS_RULES` constrains only a
 * member that no v1.0 document has. Anything a shipped validator checks and
 * this one does not is emitted as a WARNING, never an error — v1.1 tightens
 * nothing. Because the shipped validators are heterogeneous across the
 * estate (three distinct `AP2Schema` generations are live), taking the floor
 * rather than any one page's rule set is what makes "every existing v1.0
 * export still validates" true for all of them and not just for the page a
 * test happened to sample.
 *
 * `scripts/validate-policy-mandate.test.mjs` proves this DIFFERENTIALLY: it
 * lifts a shipped `AP2Schema` out of a tracked tool page at run time and uses
 * it as the oracle, asserting `oracle accepts ⇒ this validator accepts`.
 *
 * ── THE MALFORMED-`caveats` RULING: REJECT THE DOCUMENT ───────────────────
 * Three options existed. The document is rejected. Reasoning:
 *   · Silent acceptance is not an option (row RAILS, and it is the exact
 *     failure this row exists to end).
 *   · Rejecting only the MEMBER — validating the document while dropping
 *     `caveats` — reproduces FB-03 one level up: a consumer receives a valid
 *     document whose caveats have silently vanished, which is strictly worse
 *     than an error, because the loss is invisible at exactly the moment
 *     someone was relying on it.
 *   · Rejecting the DOCUMENT cannot break a v1.0 exporter, because a v1.0
 *     document has no `caveats` member to malform. The blast radius of the
 *     strict ruling is confined to documents that opted in to v1.1.
 * So the strictness is free, and the leniency is spent where it is load
 * bearing: on ABSENCE. Absent `caveats` is valid, with no error and no
 * warning. Absence is not a defect, and an empty array is not an assertion
 * that no caveats exist (see EMPTY_ARRAY_SEMANTICS below).
 *
 * Usage:
 *   import { validate, VERSION, CAVEATS_MEMBER } from './validate-policy-mandate.mjs';
 *   const { valid, errors, warnings } = validate(doc);
 */

export const VERSION = '1.1';
export const CAVEATS_MEMBER = 'caveats';

/**
 * EMPTY_ARRAY_SEMANTICS. `caveats: []` is VALID and carries NO assertion.
 * It does not mean "this assessment has no caveats" — it means the exporter
 * supplied none. The distinction is the whole lesson of the same audit's
 * FB-05/FB-01: two chain runners publish `compliance_flags: []` and thereby
 * certify the absence of flags they never collected. A consumer MUST NOT
 * read `[]` as a clean bill of health, and this validator therefore never
 * treats `[]` as evidence of anything.
 */
export const EMPTY_ARRAY_SEMANTICS = 'no-assertion';

const RE_UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RE_ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const RE_VER = /^\d+\.\d+(\.\d+)?(-[\w.]+)?$/;
const RE_ISO3166 = /^[A-Z]{2}$/;

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The v1.0 FLOOR. Every condition here is enforced by every shipped
 * `AP2Schema.validate` generation in the estate, so a document that fails one
 * of these could never have been produced by a shipped exporter in the first
 * place — checking them cannot reject a real v1.0 export.
 *
 * ⛔ Do not add a rule here because "the schema says so". §3.1 documents the
 * canonical SHAPE; this function encodes the INTEROPERABLE FLOOR. A rule that
 * some shipped generation does not enforce belongs in floorWarnings(), or a
 * v1.0 export from that generation stops validating and the row's central
 * guarantee is broken.
 */
function floorErrors(m) {
  const errors = [];
  if (!isPlainObject(m)) {
    errors.push('mandate must be a plain object');
    return errors;
  }
  if (typeof m.tool_id !== 'string' && typeof m.mandate_id !== 'string') {
    errors.push('missing identity field (tool_id or mandate_id)');
  }
  if (typeof m.mandate_type !== 'string' || !m.mandate_type) {
    errors.push('missing required field: mandate_type');
  }
  for (const key of ['jurisdiction', 'regulatory_frameworks', 'regulatory_citations', 'agent_instructions']) {
    if (key in m && !Array.isArray(m[key])) errors.push(`"${key}" must be an array`);
  }
  for (const key of ['payload', 'policy_parameters', 'output_payload', 'source_tool_inputs', 'audit_metadata']) {
    if (key in m && !isPlainObject(m[key])) errors.push(`"${key}" must be an object`);
  }
  return errors;
}

/**
 * Rules a SOME-but-not-ALL shipped generation enforces. Reported as warnings
 * so the validator stays lenient while still telling a caller what a stricter
 * shipped exporter would have refused to emit.
 */
function floorWarnings(m) {
  const warnings = [];
  if (!isPlainObject(m)) return warnings;
  if ('mandate_id' in m && (typeof m.mandate_id !== 'string' || !RE_UUID4.test(m.mandate_id))) {
    warnings.push('"mandate_id" is not a UUIDv4 (§3.1 canonical shape; some shipped exporters emit a composed id instead)');
  }
  if ('tool_version' in m && (typeof m.tool_version !== 'string' || !RE_VER.test(m.tool_version))) {
    warnings.push('"tool_version" is not semver');
  }
  if ('jurisdiction' in m && Array.isArray(m.jurisdiction)) {
    m.jurisdiction.forEach((item, i) => {
      if (typeof item !== 'string' || !RE_ISO3166.test(item)) warnings.push(`"jurisdiction[${i}]" is not ISO 3166-1 alpha-2`);
    });
  }
  for (const key of ['issued_at', 'generated_at', 'last_reviewed', 'valid_from', 'valid_until']) {
    if (key in m && (typeof m[key] !== 'string' || !RE_ISO.test(m[key]))) warnings.push(`"${key}" is not ISO-8601`);
  }
  if (!('issued_by' in m) || m.issued_by !== 'ainumbers.co') warnings.push('issued_by should be "ainumbers.co"');
  return warnings;
}

/**
 * CAVEATS_RULES — the only NEW error surface in v1.1, and it can only ever
 * fire on a document that opted in.
 *
 * Shape: an array of non-empty strings. The array-of-strings shape is not
 * arbitrary: it is exactly the shape of the ChainGraph envelope's
 * `compliance_flags` (openchain-graph-v0.4.schema.json: array/items/string),
 * so a kernel's flags can be carried into a mandate verbatim, with no lossy
 * remapping at the boundary. That is the FB-03 path this member exists to open.
 */
export function caveatsErrors(m) {
  const errors = [];
  if (!isPlainObject(m)) return errors;
  if (!(CAVEATS_MEMBER in m)) return errors; // ABSENT IS VALID. Not an error, not a warning.
  const c = m[CAVEATS_MEMBER];
  if (!Array.isArray(c)) {
    errors.push('"caveats" must be an array of non-empty strings (document rejected: a malformed caveats member is never silently dropped)');
    return errors;
  }
  c.forEach((item, i) => {
    if (typeof item !== 'string') {
      errors.push(`"caveats[${i}]" must be a string, got ${Array.isArray(item) ? 'array' : typeof item}`);
    } else if (!item.trim()) {
      errors.push(`"caveats[${i}]" must be a non-empty string`);
    }
  });
  return errors;
}

/**
 * Validate a Policy Mandate document against v1.1.
 * Returns { valid, errors, warnings } and never throws on a malformed input:
 * a validator that throws is a validator a caller routes around.
 */
export function validate(doc) {
  const errors = [...floorErrors(doc), ...caveatsErrors(doc)];
  const warnings = floorWarnings(doc);
  return { valid: errors.length === 0, errors, warnings, version: VERSION };
}

/**
 * §3.3 INTAKE PASSTHROUGH (reference implementation).
 *
 * §3.3 maps `payload` and `source_tool_inputs` keys onto element IDs. `caveats`
 * is NOT input data and MUST NOT be mapped onto a field: it is provenance that
 * travels with the artifact. The intake duty is therefore a CARRY duty — a tool
 * that ingests a mandate and later re-exports one carries the incoming
 * `caveats` forward BYTE-INTACT, appending its own rather than replacing them.
 *
 * Byte-intact is the load-bearing word. Re-ordering, de-duplicating,
 * re-wrapping or summarising the incoming strings all destroy the property
 * that made the member worth adding: that a caveat which entered the chain can
 * be found, unaltered, at the far end of it.
 */
export function carryCaveats(incoming, outgoing, own = []) {
  const prior = isPlainObject(incoming) && Array.isArray(incoming[CAVEATS_MEMBER])
    ? incoming[CAVEATS_MEMBER].slice()
    : [];
  const carried = prior.concat(own);
  if (carried.length === 0) return outgoing; // absent stays absent; never synthesise an empty array
  return { ...outgoing, [CAVEATS_MEMBER]: carried };
}

export default validate;
