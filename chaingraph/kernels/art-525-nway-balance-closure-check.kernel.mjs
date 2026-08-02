import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-525-nway-balance-closure-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_nway_balance_closure',
  mandate_type: 'compliance_control', gpu: false,
};

// N-way balance closure check (art-525).
//
// WHAT IT ENFORCES. Given three or more caller-declared balances for the SAME measure, at the
// SAME as-of moment, across named internal systems, this node evaluates the arithmetic closure
// identity (A-B) + (B-C) = (A-C) against a caller-declared tolerance, for every triple. It
// reports each pairwise difference, the closure residual per triple, and which pair carries the
// break.
//
// THE CLOSURE TEST IS THE PRODUCT. A dashboard renders three pairwise tables and enforces
// nothing across them: the third difference is fully determined by the other two, so a human is
// left doing arithmetic the tool should have done. This kernel is NOT a fourth balance display
// -- it EVALUATES the residual and attributes the break. A result that lists differences without
// a residual verdict would be worthless.
//
// TWO RESIDUAL BASES. When a caller supplies only balances, each leg's difference is derived
// from those balances and the residual is arithmetically bound to zero -- the enforced content
// in that mode is the pairwise tolerance test plus the explicit statement that closure was
// checked. The mode with real teeth is `declared_differences`: a firm that already reconciles
// hop by hop (A to B, then B to C) can declare each hop's own reconciled difference, and this
// node then checks that those independently produced hops CLOSE against the A-to-C hop and
// against the declared balances. Each pair records which basis it used.
//
// CLAUSE. BCBS 239 Principle 2 fn.16 (robust automated reconciliation where multiple models or
// systems are in use) and BCBS 239 SS36(d): reconcile to a DESIGNATED AUTHORITATIVE SOURCE, never
// consumer to consumer. `authoritative_system_id` is therefore a required, caller-declared input;
// every pair records whether it runs against the authoritative system.
//
// SCOPE. Internal, pre-filing system-boundary hops within one firm. Balances are caller-declared
// from the firm's own books; this kernel performs only the closure arithmetic and never derives,
// estimates, sources, or audits a balance.
//
// TOLERANCE IS A DECLARED INPUT, NEVER A DEFAULT. An unstated tolerance would turn every
// rounding difference into a break, so absence emits the did-not-run outcome with a reason
// rather than a silent zero.
//
// MINOR UNITS. Balances, differences and the tolerance are integer minor units (cents, pence),
// so every operation here is exact integer addition and subtraction -- no floating-point
// residue, no rounding policy to argue about, and nothing beyond SPEC.md SS18.5's bit-portable
// operator set. Non-integer input is REJECTED rather than coerced.
//
// Deterministic arithmetic only -- no clock, no randomness, no network, no PII.

const MAX_SYSTEMS = 12;

function s(v) { return String(v == null ? '' : v).trim(); }

function minorInt(v) {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isSafeInteger(n)) return n;
  }
  return null;
}

function abs(n) { return n < 0 ? -n : n; }

function pairKey(a, b) { return a + '|' + b; }

function emptyResult(reason, extra, flags) {
  return {
    output_payload: {
      decision: { gate_policy: 'review_required', execution_state: 'did_not_run', reason },
      measure_label: (extra && extra.measure_label) || '',
      authoritative_system_id: (extra && extra.authoritative_system_id) || '',
      closure_tolerance_minor: (extra && typeof extra.closure_tolerance_minor === 'number') ? extra.closure_tolerance_minor : null,
      system_count: (extra && typeof extra.system_count === 'number') ? extra.system_count : 0,
      as_of_consistent: false,
      as_of_values: [],
      systems: [],
      pairwise: [],
      triples: [],
      triple_count: 0,
      closure_holds: false,
      max_abs_residual_minor: null,
      break_pairs: [],
      suspect_systems: [],
      rejected_inputs: (extra && extra.rejected_inputs) || [],
      scope_note: SCOPE_NOTE,
      boundary_note: BOUNDARY_NOTE,
    },
    compliance_flags: flags,
  };
}

const SCOPE_NOTE = 'Scoped to internal system-boundary hops inside one firm, ahead of any filing. Balances are caller-declared from the firm\'s own systems.';
const BOUNDARY_NOTE = 'This kernel performs only the closure arithmetic over caller-declared integer minor-unit balances and caller-declared hop differences. It does not source, derive, estimate, or audit any balance, and it does not decide which system is authoritative -- that designation is a caller input per BCBS 239 SS36(d).';

export function compute(pp) {
  pp = pp || {};

  const measure_label = s(pp.measure_label);
  const authoritative_system_id = s(pp.authoritative_system_id);
  const rejected_inputs = [];

  // -- Tolerance: declared or nothing. Never defaulted, never inferred.
  const toleranceDeclared = pp.closure_tolerance_minor !== undefined && pp.closure_tolerance_minor !== null && pp.closure_tolerance_minor !== '';
  const closure_tolerance_minor = toleranceDeclared ? minorInt(pp.closure_tolerance_minor) : null;
  if (!toleranceDeclared) {
    rejected_inputs.push({ where: 'closure_tolerance_minor', reason: 'absent -- a tolerance must be declared, never defaulted', supplied: null });
    return emptyResult('closure_tolerance_not_declared', { measure_label, authoritative_system_id, rejected_inputs },
      ['NWAY_CLOSURE_TOLERANCE_NOT_DECLARED']);
  }
  if (closure_tolerance_minor === null || closure_tolerance_minor < 0) {
    rejected_inputs.push({ where: 'closure_tolerance_minor', reason: 'not a non-negative safe integer number of minor units', supplied: typeof pp.closure_tolerance_minor === 'number' ? pp.closure_tolerance_minor : s(pp.closure_tolerance_minor) });
    return emptyResult('closure_tolerance_not_declared', { measure_label, authoritative_system_id, rejected_inputs },
      ['NWAY_CLOSURE_TOLERANCE_NOT_DECLARED']);
  }

  // -- Systems.
  const systemsIn = Array.isArray(pp.systems) ? pp.systems : [];
  const systems = [];
  const seen = new Map();
  let duplicate = false;
  for (let i = 0; i < systemsIn.length; i++) {
    const row = systemsIn[i] || {};
    const system_id = s(row.system_id);
    const balance_minor = minorInt(row.balance_minor);
    const as_of = s(row.as_of);
    if (!system_id) { rejected_inputs.push({ where: 'systems[' + i + '].system_id', reason: 'absent', supplied: null }); continue; }
    if (balance_minor === null) { rejected_inputs.push({ where: 'systems[' + i + '].balance_minor', reason: 'expected an integer number of minor units', supplied: system_id }); continue; }
    if (seen.has(system_id)) { duplicate = true; rejected_inputs.push({ where: 'systems[' + i + '].system_id', reason: 'duplicate system_id', supplied: system_id }); continue; }
    seen.set(system_id, true);
    systems.push({ system_id, balance_minor, as_of, is_authoritative: system_id === authoritative_system_id });
  }

  const base = { measure_label, authoritative_system_id, closure_tolerance_minor, system_count: systems.length, rejected_inputs };

  if (duplicate) {
    return emptyResult('duplicate_system_ids_supplied', base, ['NWAY_DUPLICATE_SYSTEM_IDS']);
  }
  if (systems.length < 3) {
    return emptyResult('fewer_than_three_systems_supplied', base, ['NWAY_FEWER_THAN_THREE_SYSTEMS']);
  }
  if (systems.length > MAX_SYSTEMS) {
    rejected_inputs.push({ where: 'systems', reason: 'more than ' + MAX_SYSTEMS + ' systems supplied -- triple enumeration is bounded', supplied: systems.length });
    return emptyResult('too_many_systems_supplied', base, ['NWAY_TOO_MANY_SYSTEMS']);
  }
  if (!authoritative_system_id || !seen.has(authoritative_system_id)) {
    rejected_inputs.push({ where: 'authoritative_system_id', reason: 'absent from, or not present in, the supplied systems -- BCBS 239 SS36(d) requires a designated authoritative source, never a consumer-to-consumer reconciliation', supplied: authoritative_system_id || null });
    return emptyResult('authoritative_system_not_designated', base, ['NWAY_AUTHORITATIVE_SOURCE_NOT_DESIGNATED']);
  }

  // -- Declared hop differences (optional). Direction-aware: a declared from->to difference is
  // negated when the pair is walked in the other direction.
  const declaredByPair = new Map();
  const declaredIn = Array.isArray(pp.declared_differences) ? pp.declared_differences : [];
  for (let i = 0; i < declaredIn.length; i++) {
    const row = declaredIn[i] || {};
    const from_system_id = s(row.from_system_id);
    const to_system_id = s(row.to_system_id);
    const difference_minor = minorInt(row.difference_minor);
    if (!seen.has(from_system_id) || !seen.has(to_system_id) || from_system_id === to_system_id) {
      rejected_inputs.push({ where: 'declared_differences[' + i + ']', reason: 'from/to system_id must name two distinct supplied systems', supplied: from_system_id + '->' + to_system_id });
      continue;
    }
    if (difference_minor === null) {
      rejected_inputs.push({ where: 'declared_differences[' + i + '].difference_minor', reason: 'expected an integer number of minor units', supplied: from_system_id + '->' + to_system_id });
      continue;
    }
    declaredByPair.set(pairKey(from_system_id, to_system_id), difference_minor);
    declaredByPair.set(pairKey(to_system_id, from_system_id), -difference_minor);
  }

  // -- As-of consistency. A closure test only means anything at one moment.
  const as_of_values = [];
  for (const sys of systems) if (as_of_values.indexOf(sys.as_of) === -1) as_of_values.push(sys.as_of);
  const anyAsOfMissing = systems.some((sys) => sys.as_of === '');
  const as_of_consistent = !anyAsOfMissing && as_of_values.length === 1;

  // -- Pairwise differences.
  const byId = new Map();
  for (const sys of systems) byId.set(sys.system_id, sys);

  function diffFor(aId, bId) {
    const balance_difference_minor = byId.get(aId).balance_minor - byId.get(bId).balance_minor;
    const key = pairKey(aId, bId);
    const hasDeclared = declaredByPair.has(key);
    const declared_difference_minor = hasDeclared ? declaredByPair.get(key) : null;
    return {
      balance_difference_minor,
      declared_difference_minor,
      difference_minor: hasDeclared ? declared_difference_minor : balance_difference_minor,
      difference_basis: hasDeclared ? 'declared' : 'balances',
    };
  }

  const pairwise = [];
  for (let i = 0; i < systems.length; i++) {
    for (let j = i + 1; j < systems.length; j++) {
      const a = systems[i].system_id, b = systems[j].system_id;
      const d = diffFor(a, b);
      // A declared hop that disagrees with the declared balances is itself a finding: the two
      // independent statements about the same boundary do not agree.
      const declared_vs_balance_delta_minor = d.declared_difference_minor === null
        ? null : d.declared_difference_minor - d.balance_difference_minor;
      pairwise.push({
        pair: a + ' -> ' + b,
        system_a: a,
        system_b: b,
        against_authoritative: a === authoritative_system_id || b === authoritative_system_id,
        balance_difference_minor: d.balance_difference_minor,
        declared_difference_minor: d.declared_difference_minor,
        difference_minor: d.difference_minor,
        difference_basis: d.difference_basis,
        declared_vs_balance_delta_minor,
        declared_agrees_with_balances: declared_vs_balance_delta_minor === null
          ? null : abs(declared_vs_balance_delta_minor) <= closure_tolerance_minor,
        within_tolerance: abs(d.difference_minor) <= closure_tolerance_minor,
      });
    }
  }

  // -- Closure residual per triple: (A-B) + (B-C) - (A-C). THE test, not a display.
  const triples = [];
  let max_abs_residual_minor = 0;
  for (let i = 0; i < systems.length; i++) {
    for (let j = i + 1; j < systems.length; j++) {
      for (let k = j + 1; k < systems.length; k++) {
        const a = systems[i].system_id, b = systems[j].system_id, c = systems[k].system_id;
        const ab = diffFor(a, b), bc = diffFor(b, c), ac = diffFor(a, c);
        const residual_minor = (ab.difference_minor + bc.difference_minor) - ac.difference_minor;
        const bases = [ab.difference_basis, bc.difference_basis, ac.difference_basis];
        const allDeclared = bases[0] === 'declared' && bases[1] === 'declared' && bases[2] === 'declared';
        const allBalances = bases[0] === 'balances' && bases[1] === 'balances' && bases[2] === 'balances';
        const residual_basis = allDeclared ? 'declared' : (allBalances ? 'balances' : 'mixed');
        const within_tolerance = abs(residual_minor) <= closure_tolerance_minor;
        if (abs(residual_minor) > max_abs_residual_minor) max_abs_residual_minor = abs(residual_minor);
        triples.push({
          triple: a + ', ' + b + ', ' + c,
          systems: [a, b, c],
          leg_ab_minor: ab.difference_minor,
          leg_bc_minor: bc.difference_minor,
          leg_ac_minor: ac.difference_minor,
          residual_minor,
          residual_basis,
          within_tolerance,
        });
      }
    }
  }

  const closure_holds = triples.every((t) => t.within_tolerance);
  const break_pairs = pairwise.filter((p) => !p.within_tolerance).map((p) => p.pair);
  const declared_disagreements = pairwise
    .filter((p) => p.declared_agrees_with_balances === false).map((p) => p.pair);

  // Which system carries the break: a system appearing in EVERY breaking pair is the single
  // consistent explanation for all of them.
  const breaking = pairwise.filter((p) => !p.within_tolerance);
  const suspect_systems = breaking.length === 0 ? [] : systems
    .filter((sys) => breaking.every((p) => p.system_a === sys.system_id || p.system_b === sys.system_id))
    .map((sys) => sys.system_id);

  const compliance_flags = ['NWAY_BALANCE_CLOSURE_EVALUATED'];
  if (!closure_holds) compliance_flags.push('NWAY_CLOSURE_RESIDUAL_OUTSIDE_TOLERANCE');
  if (break_pairs.length > 0) compliance_flags.push('NWAY_PAIRWISE_BREAK_DETECTED');
  if (declared_disagreements.length > 0) compliance_flags.push('NWAY_DECLARED_HOP_DISAGREES_WITH_BALANCES');

  let execution_state = 'ran';
  let reason = null;
  if (!as_of_consistent) {
    // Balances stated at differing (or undeclared) as-of moments. The arithmetic still runs and
    // is still reported, but it was run against input known to be inconsistent in time, which is
    // a control-EXECUTION state (SPEC.md SS2.2) rather than a human-accountability one.
    execution_state = 'ran_stale';
    reason = anyAsOfMissing ? 'as_of_not_declared_for_every_system' : 'balances_supplied_at_differing_as_of_moments';
    compliance_flags.push('NWAY_AS_OF_INCONSISTENT');
  }

  // SS27.4 vocabulary only, and only these two values: this node never blocks. `review_required`
  // is a SS21.4 ROUTING outcome to an exception-handling step, never a human-in-the-loop halt.
  const gate_policy = (execution_state === 'ran' && closure_holds && break_pairs.length === 0 && declared_disagreements.length === 0)
    ? 'auto_pass' : 'review_required';

  return {
    output_payload: {
      decision: { gate_policy, execution_state, reason },
      measure_label,
      authoritative_system_id,
      closure_tolerance_minor,
      system_count: systems.length,
      as_of_consistent,
      as_of_values,
      systems,
      pairwise,
      triples,
      triple_count: triples.length,
      closure_holds,
      max_abs_residual_minor,
      break_pairs,
      declared_disagreements,
      suspect_systems,
      rejected_inputs,
      scope_note: SCOPE_NOTE,
      boundary_note: BOUNDARY_NOTE,
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
