import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-600-lei-relationship-consistency';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_lei_relationship_consistency',
  mandate_type: 'compliance_control', gpu: false,
};

// Four structural invariants over a pasted set of GLEIF Level-2 (relationship) records for one
// subject LEI.
//
// WHAT A VIOLATION MEANS -- and does not: a violation flags a possible inconsistency in GLEIF's
// PUBLISHED Level-2 data for this LEI. It is not an assertion about the entity's actual corporate
// structure and not a finding about the entity itself. Golden-copy data is periodically corrected;
// recheck against a fresh pull before treating any violation as durable.
//
// Records are supplied by the caller, transcribed from the Golden Copy CSV columns or the RR-CDF
// XML elements. Zero network -- this never queries GLEIF and is not a re-implementation of GLEIF's
// own reconciliation service. LEI reference data is PUBLIC registry data; no PII.

// Versioned constant, NOT an inferred or growing list. Verified 2026-08-11 against GLEIF's
// Reporting Exceptions CDF 2.1 (published September 2021). Five reasons are current; five are
// deprecated but still legitimately present in historical records (GLEIF stated they consolidate
// into NON_PUBLIC from 2022-03-01) so they are RECOGNIZED, not flagged as violations. If GLEIF
// publishes a new category, update this constant -- never infer one from an unrecognized string.
// table_version: "GLEIF-REPORTING-EXCEPTIONS-CDF-2.1"
const EXCEPTION_TABLE_VERSION = 'GLEIF-REPORTING-EXCEPTIONS-CDF-2.1';
const EXCEPTION_TABLE_SOURCE = 'GLEIF Level 2 Data: Reporting Exceptions CDF format 2.1 (gleif.org/en/lei-data/access-and-use-lei-data/level-2-data-reporting-exceptions-2-1-format)';
const EXCEPTION_CURRENT = ['NO_LEI', 'NATURAL_PERSONS', 'NON_CONSOLIDATING', 'NO_KNOWN_PERSON', 'NON_PUBLIC'];
const EXCEPTION_DEPRECATED = ['BINDING_LEGAL_COMMITMENTS', 'LEGAL_OBSTACLES', 'DISCLOSURE_DETRIMENTAL', 'DETRIMENT_NOT_EXCLUDED', 'CONSENT_NOT_OBTAINED'];

const DIRECT_PARENT_TYPE = 'IS_DIRECTLY_CONSOLIDATED_BY';

const SCOPE_NOTE = 'This flags a possible inconsistency in GLEIF\'s published Level-2 relationship data for this LEI. It is not an assertion about the entity\'s actual corporate structure, and not a finding about the entity itself. GLEIF golden-copy data is periodically corrected; recheck against a fresh golden-copy pull before treating this as durable.';

// --- ISO 17442 LEI check-digit validation ------------------------------------------------------
// Reused verbatim from art-246-lei-payment-binding-linter (ISO 7064 Mod 97-10), the same check
// art-599 carries. Kernels are self-contained by construction (the zkVM guest has no module graph
// beyond _hash.mjs), so reuse here means the identical proven implementation, not a second
// algorithm. Do not re-derive it.
function charToDigits(c) {
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) return c;                 // '0'..'9'
  if (code >= 65 && code <= 90) return String(code - 55); // 'A'=10..'Z'=35
  return '';
}
function mod97(numStr) {
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + Number(numStr[i])) % 97;
  }
  return remainder;
}
function leiValid(lei) {
  const clean = String(lei || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{20}$/.test(clean)) return false;
  return mod97(clean.split('').map(charToDigits).join('')) === 1;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const upper = (v) => str(v).toUpperCase();

// Date comparison on ISO-8601-prefixed strings only. A non-parseable date is treated as UNBOUNDED
// on that side and recorded as such -- never silently coerced to a number, which would make two
// unrelated malformed dates compare equal and manufacture a false overlap.
function dayKey(v) {
  const s = str(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// Half-open interval overlap on [start, end). Missing start = open at the beginning,
// missing end = still open (GLEIF's own convention for a live relationship period).
function periodsOverlap(aStart, aEnd, bStart, bEnd) {
  const aS = aStart === null ? '0000-00-00' : aStart;
  const aE = aEnd === null ? '9999-99-99' : aEnd;
  const bS = bStart === null ? '0000-00-00' : bStart;
  const bE = bEnd === null ? '9999-99-99' : bEnd;
  return aS < bE && bS < aE;
}

export function compute(pp) {
  pp = pp || {};

  const subject_lei = upper(pp.subject_lei);
  const recordsIn = Array.isArray(pp.relationships) ? pp.relationships : [];

  const records = recordsIn.map((r, i) => {
    r = r || {};
    return {
      index: i + 1,
      start_node_lei: upper(r.start_node_lei),
      end_node_lei: upper(r.end_node_lei),
      relationship_type: upper(r.relationship_type),
      relationship_status: upper(r.relationship_status),
      start_date: dayKey(r.start_date),
      end_date: dayKey(r.end_date),
      exception_code: upper(r.exception_code),
    };
  });

  const violations = [];
  const push = (code, detail, record_index) => violations.push({ code, detail, record_index });

  // --- Invariant 1: node validity -------------------------------------------------------------
  const invalid_node_leis = [];
  const subject_lei_valid = subject_lei.length > 0 ? leiValid(subject_lei) : null;
  if (subject_lei_valid === false) {
    invalid_node_leis.push(subject_lei);
    push('INVALID_NODE_LEI', 'Subject LEI ' + subject_lei + ' fails the ISO 17442 mod-97 check.', null);
  }
  records.forEach((r) => {
    [['startNode', r.start_node_lei], ['endNode', r.end_node_lei]].forEach(([side, val]) => {
      if (val.length === 0) {
        invalid_node_leis.push('(empty)');
        push('INVALID_NODE_LEI', 'Record ' + r.index + ' ' + side + '.nodeId is empty.', r.index);
      } else if (!leiValid(val)) {
        invalid_node_leis.push(val);
        push('INVALID_NODE_LEI', 'Record ' + r.index + ' ' + side + '.nodeId ' + val + ' fails the ISO 17442 mod-97 check.', r.index);
      }
    });
  });

  // --- Invariant 2: no direct-parent cycle ----------------------------------------------------
  // Walk IS_DIRECTLY_CONSOLIDATED_BY edges from the subject LEI. Revisiting a node already on the
  // CURRENT walk path is a cycle. Only ACTIVE edges are walked: an ended relationship legitimately
  // points the other way in a later period and is not a cycle in the live graph.
  const parentEdges = {};
  records.forEach((r) => {
    if (r.relationship_type !== DIRECT_PARENT_TYPE) return;
    if (r.relationship_status === 'INACTIVE') return;
    if (!parentEdges[r.start_node_lei]) parentEdges[r.start_node_lei] = [];
    parentEdges[r.start_node_lei].push({ to: r.end_node_lei, index: r.index });
  });

  let cycle_path = null;
  const walkFrom = (origin) => {
    const stack = [{ node: origin, path: [origin] }];
    while (stack.length > 0 && cycle_path === null) {
      const { node, path } = stack.pop();
      const edges = parentEdges[node] || [];
      for (let i = 0; i < edges.length; i++) {
        const next = edges[i].to;
        if (path.indexOf(next) >= 0) {
          cycle_path = path.concat([next]);
          push('PARENT_CYCLE_DETECTED', 'Walking ' + DIRECT_PARENT_TYPE + ' edges revisits ' + next + ': ' + cycle_path.join(' -> '), edges[i].index);
          return;
        }
        stack.push({ node: next, path: path.concat([next]) });
      }
    }
  };
  if (subject_lei.length > 0) walkFrom(subject_lei);
  // Records may describe a component that does not hang off the subject; check every start node too.
  Object.keys(parentEdges).sort().forEach((origin) => { if (cycle_path === null) walkFrom(origin); });

  // --- Invariant 3: exception-code well-formedness --------------------------------------------
  const unrecognized_exception_codes = [];
  const deprecated_exception_codes = [];
  records.forEach((r) => {
    if (r.exception_code.length === 0) return;
    if (EXCEPTION_CURRENT.indexOf(r.exception_code) >= 0) return;
    if (EXCEPTION_DEPRECATED.indexOf(r.exception_code) >= 0) {
      deprecated_exception_codes.push(r.exception_code);
      return;
    }
    unrecognized_exception_codes.push(r.exception_code);
    push('UNRECOGNIZED_EXCEPTION_CODE', 'Record ' + r.index + ' carries exception code "' + r.exception_code + '", which is not a published GLEIF category in ' + EXCEPTION_TABLE_VERSION + '.', r.index);
  });

  // --- Invariant 4: no overlapping duplicate active edges -------------------------------------
  const active = records.filter((r) => r.relationship_status === 'ACTIVE');
  const duplicate_active_triples = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      if (a.start_node_lei !== b.start_node_lei) continue;
      if (a.end_node_lei !== b.end_node_lei) continue;
      if (a.relationship_type !== b.relationship_type) continue;
      if (!periodsOverlap(a.start_date, a.end_date, b.start_date, b.end_date)) continue;
      const triple = a.start_node_lei + ' -> ' + a.end_node_lei + ' (' + a.relationship_type + ')';
      duplicate_active_triples.push(triple);
      push('DUPLICATE_ACTIVE_RELATIONSHIP', 'Records ' + a.index + ' and ' + b.index + ' are both ACTIVE for ' + triple + ' with overlapping validity periods.', b.index);
    }
  }

  const violation_count = violations.length;
  // An EMPTY record set is not evidence of consistency. Returning true here would let a caller who
  // pasted nothing show a clean pass, which is exactly the over-claim this suite refuses to make:
  // consistent is null when there was nothing to assess, and the clean-pass flag does not fire.
  const records_assessed = records.length > 0;
  const consistent = records_assessed ? violation_count === 0 : null;

  const invariant_results = [
    { invariant: 'node_lei_validity', code: 'INVALID_NODE_LEI', pass: !violations.some((v) => v.code === 'INVALID_NODE_LEI'), detail: 'Every startNode/endNode LEI passes the ISO 17442 mod-97 check.' },
    { invariant: 'no_direct_parent_cycle', code: 'PARENT_CYCLE_DETECTED', pass: cycle_path === null, detail: 'Walking ' + DIRECT_PARENT_TYPE + ' edges never revisits a node on the current path.' },
    { invariant: 'exception_code_well_formed', code: 'UNRECOGNIZED_EXCEPTION_CODE', pass: unrecognized_exception_codes.length === 0, detail: 'Every exception code is a published GLEIF category in ' + EXCEPTION_TABLE_VERSION + '.' },
    { invariant: 'no_overlapping_active_duplicates', code: 'DUPLICATE_ACTIVE_RELATIONSHIP', pass: duplicate_active_triples.length === 0, detail: 'No (startNode, endNode, relationshipType) triple has two ACTIVE records with overlapping validity periods.' },
  ];

  const output_payload = {
    subject_lei: subject_lei.length > 0 ? subject_lei : null,
    subject_lei_valid,
    record_count: records.length,
    records_assessed,
    consistent,
    violation_count,
    violations,
    invariant_results,
    invalid_node_leis,
    cycle_path,
    unrecognized_exception_codes,
    deprecated_exception_codes,
    duplicate_active_triples,
    exception_table_version: EXCEPTION_TABLE_VERSION,
    exception_table_source: EXCEPTION_TABLE_SOURCE,
    recognized_exception_codes_current: EXCEPTION_CURRENT,
    recognized_exception_codes_deprecated: EXCEPTION_DEPRECATED,
    scope_note: SCOPE_NOTE,
    pii_note: 'LEI reference data is PUBLIC registry data (GLEIF, gleif.org). Relationship records are processed structurally only. No PII processed -- use synthetic or public registry data only.',
  };

  const compliance_flags = [];
  if (violations.some((v) => v.code === 'INVALID_NODE_LEI')) compliance_flags.push('INVALID_NODE_LEI');
  if (cycle_path !== null) compliance_flags.push('PARENT_CYCLE_DETECTED');
  if (unrecognized_exception_codes.length > 0) compliance_flags.push('UNRECOGNIZED_EXCEPTION_CODE');
  if (duplicate_active_triples.length > 0) compliance_flags.push('DUPLICATE_ACTIVE_RELATIONSHIP');
  if (consistent === true) compliance_flags.push('LEI_RELATIONSHIP_CONSISTENT');

  return { output_payload, compliance_flags };
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
