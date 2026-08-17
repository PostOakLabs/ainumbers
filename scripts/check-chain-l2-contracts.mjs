#!/usr/bin/env node
// check-chain-l2-contracts.mjs — CHAIN-FV-L2-1. Ladder level L2: "edge contracts composed and
// machine-checked (L2: contract composition)".
//
// ⛔ L2 IS NOT "FORMALLY VERIFIED". The ladder level is always named. L2 checks that, per edge, the
// upstream tool's PUBLISHED GUARANTEE (its manifest output_schema, plus any stated x-source-carrying
// range) refines the downstream tool's PUBLISHED ASSUMPTION (its manifest input_schema, plus any
// stated x-source-carrying range) — Pacti's assume-guarantee composition (Incer et al., ACM TCPS
// 9(1), 2025; pacti.org), interval-containment subset only. It proves nothing about kernel BEHAVIOUR
// (no code is ever executed here — see §5 below) and nothing about end-to-end chain properties (L3,
// not built, not specced — research/CHAIN-FV-L2-SPEC-2026-08-17.md §3/§8).
//
// ⛔ EXTENDS check-chain-edge-contracts.mjs BY IMPORT, NEVER FORKS IT (spec §4.4). This file imports
// typesCompatible / schemaFromProperties / induceSchema / chainsContainingBothEndpoints from L1 and
// restates none of them. A fix to L1's type lattice cannot leave L2 on a divergent copy.
//
// ⛔ HONESTY NOTE THAT MUST SURVIVE (spec §2.1): at runtime, `run_chain` (mcp-apps-poc/worker.mjs)
// builds each step's policy_parameters from `inputs[tool_id]` or a fixture, NEVER from the previous
// step's output_payload (`const basePp = callerPp ?? fixturePp ?? {}`). L2 verifies the DECLARED
// composition — what the chain page and manifests tell a human or agent to pipe where, via the
// authored `consumes_from` field map — not an automatic threading the worker performs. Every report
// and every published sentence says which one this is.
//
// WHAT THIS WALKS (all primary sources — nothing reads a verdict an artifact states about itself,
// SO #34 independent derivation):
//   chaingraph/chaingraph.json     chains[].steps[].consumes_from (the authored edge field map,
//                                  additive — spec §2.1) + chains[].steps[].gate (decision gates)
//   manifests/<tool_id>.manifest.json    input_schema (assumption) / output_schema (guarantee),
//                                  read for the numeric/enum vocabulary PLUS the additive x-source /
//                                  x-unit annotation keywords (spec §1.2)
//   research/clause-snapshots/<file>     re-hashed for every x-source of kind "clause" (spec §4.3)
//
// ⛔ READ-ONLY over chaingraph.json and every manifest. This script never writes them.
//
// THE VERDICTS (spec §2.4 — indeterminate is NEVER folded into pass, doctrine §5 don't #4):
//   L2-pass            every mapped field and every gate rule on the edge satisfied §2.2/§2.3 against
//                       DECLARED, x-source-carrying constraints.
//   L2-fail(witness)   ≥1 check failed. Every fail carries a concrete witness value.
//   L2-indeterminate   named reason from the closed set below — coverage, not a verdict on wrongness.
// Chain verdict = L2-fail if any edge fails; else L2-pass if every edge passed; else L2-indeterminate.
// A chain with zero in-scope edges is L2-indeterminate(no-in-scope-edges), never a vacuous pass.
//
// ⛔⛔ THE RULE THAT KEEPS L2a HONEST (spec §2.3): only a DECLARED constraint carrying an x-source may
// produce L2-fail. A constraint observed only from fixture vectors may only ever produce
// L2-indeterminate(insufficient-declared-domain) — a fixture sample is not a domain.
//
// ⛔ SO #34 CLAUSE 34: no code is executed anywhere in this file. L2 is a static composition check
// over declarations (spec §4 item 5) — SO #34's sandbox rider does not bind it, and that is stated
// here (not left as a silent absence) precisely so a later reader does not mistake it for an
// oversight.
//
// ⛔ L2b (linear/affine x-invariant propagation) IS NOT IN THIS FILE (spec §3, §8 item 1). ⛔ No L3.
//
// Run:  node scripts/check-chain-l2-contracts.mjs [--report <ABSOLUTE path>] [--json] [--quiet]
// ⚠ --report takes an ABSOLUTE path only, same reason as L1 (SO #3b). Default: write nothing.

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  typesCompatible, schemaFromProperties, induceSchema, chainsContainingBothEndpoints,
} from './check-chain-edge-contracts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ────────────────────────── JSON Pointer (RFC 6901), the same dialect run_chain's gates use ────── */

export function resolvePointer(obj, pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return { found: false, value: undefined };
  const parts = pointer.slice(1).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return { found: false, value: undefined };
    if (!(p in cur)) return { found: false, value: undefined };
    cur = cur[p];
  }
  return { found: true, value: cur };
}

// A pointer "resolves in a schema" when its top-level property name (the only depth L2 maps into —
// consumes_from's `from` is documented as a pointer into output_payload, but every real target in
// scope is a top-level field; a nested pointer that cannot be resolved against `properties` is
// reported as not-found, never guessed at) is declared in that schema's properties.
function pointerResolvesInSchema(pointer, schema) {
  if (!schema || typeof pointer !== 'string' || !pointer.startsWith('/')) return false;
  const top = pointer.slice(1).split('/')[0].replace(/~1/g, '/').replace(/~0/g, '~');
  return Object.prototype.hasOwnProperty.call(schema.fields, top);
}

/* ────────────────────────── constraint extraction (with x-source) ───────────────────────────── */

// A "declared constraint" is a numeric/enum/multipleOf bound on a manifest property that carries an
// x-source. Anything without x-source is NOT a contract (spec §1.2) — extracted separately so the
// checker can distinguish "no bound" from "bound with no source" (constraint-without-x-source).
export function extractConstraint(propSchema) {
  if (!propSchema || typeof propSchema !== 'object') return null;
  const hasBound = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'enum', 'const']
    .some((k) => propSchema[k] !== undefined);
  if (!hasBound) return null;
  const c = {
    minimum: propSchema.minimum,
    maximum: propSchema.maximum,
    exclusiveMinimum: propSchema.exclusiveMinimum,
    exclusiveMaximum: propSchema.exclusiveMaximum,
    multipleOf: propSchema.multipleOf,
    enum: propSchema.const !== undefined ? [propSchema.const] : propSchema.enum,
    unit: propSchema['x-unit'],
    source: propSchema['x-source'] || null,
  };
  return c;
}

/* ────────────────────────── §2.2 refinement check, per mapped field ─────────────────────────── */

// An absent bound on the guarantee side is ±∞ (spec §2.2 item 1) — never contained by a finite
// assumption bound. Represented as null here; helpers below treat null as unbounded on that side.
function guaranteeLow(c) { return c.exclusiveMinimum !== undefined ? c.exclusiveMinimum : (c.minimum !== undefined ? c.minimum : null); }
function guaranteeHigh(c) { return c.exclusiveMaximum !== undefined ? c.exclusiveMaximum : (c.maximum !== undefined ? c.maximum : null); }
function guaranteeLowExclusive(c) { return c.exclusiveMinimum !== undefined; }
function guaranteeHighExclusive(c) { return c.exclusiveMaximum !== undefined; }

// Containment of [gLo,gHi] in [aLo,aHi]. An exclusive producer bound is contained by an inclusive
// consumer bound at the same value; the reverse is not (spec §2.2 item 1).
function intervalContained(g, a) {
  const gLo = guaranteeLow(g), gHi = guaranteeHigh(g);
  const aLo = guaranteeLow(a), aHi = guaranteeHigh(a);
  if (gLo === null || gHi === null) return false; // ±∞ on the guarantee side, never contained
  if (aLo !== null) {
    if (gLo < aLo) return false;
    if (gLo === aLo && guaranteeLowExclusive(a) && !guaranteeLowExclusive(g)) return false;
  }
  if (aHi !== null) {
    if (gHi > aHi) return false;
    if (gHi === aHi && guaranteeHighExclusive(a) && !guaranteeHighExclusive(g)) return false;
  }
  return true;
}

// A concrete value INSIDE the producer's guarantee and OUTSIDE the consumer's assumption (spec §2.4:
// "a fail must carry a witness ... a concrete value inside the producer's guarantee and outside the
// consumer's assumption"). Where the guarantee's high side overshoots, the witness is the midpoint of
// the overshoot band [aHi, gHi] — a value strictly greater than what the consumer accepts and no
// greater than what the producer promises. Mirrors low-side overshoot symmetrically.
function nearestExcludedBound(g, a) {
  const gLo = guaranteeLow(g), gHi = guaranteeHigh(g);
  const aLo = guaranteeLow(a), aHi = guaranteeHigh(a);
  if (gLo === null || gHi === null) return gLo === null ? '-Infinity' : `${gHi}`;
  if (aHi !== null && gHi > aHi) return `${(aHi + gHi) / 2}`;
  if (aLo !== null && gLo < aLo) return `${(aLo + gLo) / 2}`;
  return `${gLo}`;
}

/**
 * Check one authored field mapping (a `consumes_from` entry) against the producer's and consumer's
 * declared constraints. Pure — ctx supplies everything so the selftest never touches live data.
 *
 * ctx = {
 *   outConstraint(tool_id, field) -> constraint|null|'undeclared',
 *   inConstraint(tool_id, field)  -> constraint|null|'undeclared',
 *   outSchema(tool_id) -> {fields,required}|null,
 *   inSchema(tool_id)  -> {fields,required}|null,
 *   consumerRequired(tool_id, field) -> boolean,
 *   verifySource(source) -> {ok:boolean, reason?:string},  // x-source digest re-verification (§4.3)
 * }
 */
export function checkMappedField(mapping, producerId, consumerId, ctx) {
  const findings = [];
  const undecided = [];
  const checksRun = [];

  const from = mapping.from, to = mapping.to;

  // ── Check 5: required-field presence ──
  const outSchema = ctx.outSchema(producerId);
  const pointerResolves = pointerResolvesInSchema(from, outSchema);
  if (ctx.consumerRequired(consumerId, to) && !pointerResolves) {
    undecided.push('pointer-resolves-in-fixtures-only');
  } else {
    checksRun.push('required-presence');
  }

  const G = ctx.outConstraint(producerId, from);
  const A = ctx.inConstraint(consumerId, to);

  const gMissing = G === null;
  const aMissing = A === null;

  if (gMissing && aMissing) {
    undecided.push('no-declared-constraint-producer', 'no-declared-constraint-consumer');
    return finish();
  }
  if (gMissing) { undecided.push('no-declared-constraint-producer'); return finish(); }
  if (aMissing) { undecided.push('no-declared-constraint-consumer'); return finish(); }

  // Both sides carry SOME bound. Verify x-source on each before trusting either.
  const gSrcOk = G.source && ctx.verifySource(G.source).ok;
  const aSrcOk = A.source && ctx.verifySource(A.source).ok;
  if (!G.source || !gSrcOk) undecided.push('constraint-without-x-source');
  if (!A.source || !aSrcOk) undecided.push('constraint-without-x-source');
  if (G.source && !gSrcOk && ctx.verifySource(G.source).reason === 'digest-stale') undecided.push('x-source-digest-stale');
  if (A.source && !aSrcOk && ctx.verifySource(A.source).reason === 'digest-stale') undecided.push('x-source-digest-stale');
  if (undecided.length) return finish();

  // ── Check 4: unit equality — no conversion, ever ──
  if (G.unit || A.unit) {
    if (!G.unit || !A.unit) {
      undecided.push(!G.unit && !A.unit ? 'no-unit-declared' : 'unit-declared-one-side');
    } else if (G.unit !== A.unit) {
      findings.push({ code: 'unit-mismatch', field: to, detail: `unit "${G.unit}" (producer) vs "${A.unit}" (consumer)`, witness: `${G.unit} != ${A.unit}` });
      checksRun.push('unit');
    } else {
      checksRun.push('unit');
    }
  }

  // ── Check 3: enum subset ──
  if (A.enum && A.enum.length) {
    checksRun.push('enum');
    if (!G.enum || !G.enum.length) {
      findings.push({ code: 'enum-not-subset', field: to, detail: `consumer declares enum [${A.enum.join(',')}] but producer declares none`, witness: 'producer enum undeclared' });
    } else {
      const extra = G.enum.filter((v) => !A.enum.includes(v));
      if (extra.length) {
        findings.push({ code: 'enum-not-subset', field: to, detail: `producer enum member "${extra[0]}" not in consumer enum [${A.enum.join(',')}]`, witness: `${extra[0]}` });
      }
    }
  }

  // ── Check 2: multipleOf divisibility ──
  if (A.multipleOf !== undefined) {
    checksRun.push('multipleOf');
    if (G.multipleOf === undefined) {
      findings.push({ code: 'multipleOf-not-guaranteed', field: to, detail: `consumer requires multipleOf ${A.multipleOf}, producer states none`, witness: 'producer multipleOf undeclared' });
    } else if (G.multipleOf % A.multipleOf !== 0) {
      findings.push({ code: 'multipleOf-not-guaranteed', field: to, detail: `producer multipleOf ${G.multipleOf} is not an integer multiple of consumer's ${A.multipleOf}`, witness: `${G.multipleOf} % ${A.multipleOf} != 0` });
    }
  }

  // ── Check 1: numeric interval containment ──
  const gHasNumeric = G.minimum !== undefined || G.maximum !== undefined || G.exclusiveMinimum !== undefined || G.exclusiveMaximum !== undefined;
  const aHasNumeric = A.minimum !== undefined || A.maximum !== undefined || A.exclusiveMinimum !== undefined || A.exclusiveMaximum !== undefined;
  if (aHasNumeric) {
    checksRun.push('interval');
    if (!gHasNumeric) {
      findings.push({ code: 'interval-not-contained', field: to, detail: 'consumer declares a numeric range, producer declares none (unbounded, treated as ±Infinity)', witness: 'producer range undeclared' });
    } else if (!intervalContained(G, A)) {
      findings.push({ code: 'interval-not-contained', field: to, detail: `producer [${guaranteeLow(G)},${guaranteeHigh(G)}] not contained in consumer [${guaranteeLow(A)},${guaranteeHigh(A)}]`, witness: nearestExcludedBound(G, A) });
    }
  }

  return finish();

  function finish() {
    return {
      from, to, producer: producerId, consumer: consumerId,
      decided: checksRun.length > 0 && (findings.length > 0 || undecided.length === 0),
      checks_run: checksRun,
      findings,
      undecided_reasons: [...new Set(undecided)].sort(),
    };
  }
}

/* ────────────────────────── §2.3 decision gates ──────────────────────────────────────────────── */

const NUMERIC_OPS = new Set(['lt', 'lte', 'gt', 'gte']);
const EQ_OPS = new Set(['eq', 'ne']);

export function checkGateRule(gate, rule, producerId, chainToolIds, ctx) {
  const findings = [];
  const undecided = [];
  const checksRun = [];

  const outSchema = ctx.outSchema(producerId);
  const resolves = pointerResolvesInSchema(gate.input, outSchema);
  if (!resolves) {
    // §2.3's honesty rule generalises here: a pointer failing to resolve is a witness-producible
    // fail ONLY when the producer has PUBLISHED an output_schema that positively omits the field —
    // a declared contradiction, same shape as §2.2 check 2's multipleOf-absent fail. When the
    // producer has published no output_schema at all there is no declared surface to contradict, so
    // this is absence of evidence, never a finding (spec §5.2: both day-one gate-pointer-unresolved
    // leads — adverse-action-notice-compliance, card-act-ability-to-pay — have NO manifest at all
    // and are L2-indeterminate, never a fail).
    if (ctx.pointerResolvesInFixturesOnly && ctx.pointerResolvesInFixturesOnly(producerId, gate.input)) {
      undecided.push('pointer-resolves-in-fixtures-only');
    } else if (outSchema) {
      findings.push({ code: 'gate-pointer-unresolved', detail: `gate input "${gate.input}" does not resolve in ${producerId}'s published output_schema`, witness: gate.input });
    } else {
      undecided.push('insufficient-declared-domain');
    }
  } else {
    checksRun.push('gate-pointer');
    const top = gate.input.slice(1).split('/')[0];
    const G = ctx.outConstraint(producerId, `/${top}`);
    if (G && G.source && ctx.verifySource(G.source).ok) {
      checksRun.push('gate-value');
      if (EQ_OPS.has(rule.op)) {
        if (!G.enum || !G.enum.length) {
          undecided.push('insufficient-declared-domain');
        } else if (rule.op === 'eq' && !G.enum.includes(rule.value)) {
          findings.push({ code: 'gate-value-outside-guarantee', detail: `eq ${JSON.stringify(rule.value)} not in producer enum [${G.enum.join(',')}]`, witness: `${rule.value}` });
        } else if (rule.op === 'ne' && G.enum.length === 1 && G.enum[0] === rule.value) {
          findings.push({ code: 'gate-value-outside-guarantee', detail: `ne ${JSON.stringify(rule.value)} — producer enum is the singleton [${rule.value}], branch is dead`, witness: `${rule.value}` });
        }
      } else if (NUMERIC_OPS.has(rule.op)) {
        const lo = guaranteeLow(G), hi = guaranteeHigh(G);
        if (lo === null && hi === null) {
          undecided.push('insufficient-declared-domain');
        } else {
          const v = rule.value;
          let dead = false, always = false;
          if (rule.op === 'lt' || rule.op === 'lte') {
            if (lo !== null && (rule.op === 'lt' ? v <= lo : v < lo)) dead = true;
            if (hi !== null && (rule.op === 'lt' ? v > hi : v >= hi)) always = true;
          } else {
            if (hi !== null && (rule.op === 'gt' ? v >= hi : v > hi)) dead = true;
            if (lo !== null && (rule.op === 'gt' ? v < lo : v <= lo)) always = true;
          }
          if (dead) findings.push({ code: 'gate-value-outside-guarantee', detail: `${rule.op} ${v} is a DEAD branch — never satisfiable over producer range [${lo},${hi}]`, witness: `${v}` });
          else if (always) findings.push({ code: 'gate-value-outside-guarantee', detail: `${rule.op} ${v} is an ALWAYS-TAKEN branch over producer range [${lo},${hi}]`, witness: `${v}` });
        }
      } else {
        undecided.push('insufficient-declared-domain');
      }
    } else {
      undecided.push('insufficient-declared-domain');
    }
  }

  const target = rule.next;
  const validTargets = new Set(['end', 'escalate', ...chainToolIds]);
  if (target !== undefined && !validTargets.has(target)) {
    findings.push({ code: 'gate-route-target-not-a-step', detail: `gate rule "next" = "${target}" names neither end, escalate, nor a step in this chain`, witness: `${target}` });
  } else if (target !== undefined) {
    checksRun.push('gate-route');
  }

  return {
    gate_input: gate.input, op: rule.op, value: rule.value, next: rule.next,
    decided: checksRun.length > 0,
    checks_run: checksRun,
    findings,
    undecided_reasons: [...new Set(undecided)].sort(),
  };
}

/* ────────────────────────── §2.5 scope: which edges are even in play ────────────────────────── */

export function isEdgeInScope(mapping) {
  return true; // consumes_from entries are authored maps; scope exclusion (execution_hash-only,
  // NAME-ONLY, no field map) is applied at the edge level in checkEdge below.
}

/* ────────────────────────── per-edge / per-chain composition (§2.4) ─────────────────────────── */

/**
 * Check one chain edge (fromId -> toId). `consumesFrom` is the consumer step's authored array
 * (may be empty/absent). `gate` is the FROM step's gate object, if any (a gate reads its OWN step's
 * output, per spec §2.3, so it is associated with the producer/from step here).
 */
export function checkL2Edge(fromId, toId, consumesFrom, gate, chainToolIds, ctx) {
  const mappings = (consumesFrom || []).filter((m) => m.from_step === fromId);
  const fieldResults = mappings.map((m) => checkMappedField(m, fromId, toId, ctx));

  const gateRules = gate && Array.isArray(gate.rules) ? gate.rules : [];
  const gateResults = gateRules.map((r) => checkGateRule(gate, r, fromId, chainToolIds, ctx));

  const findings = [
    ...fieldResults.flatMap((r) => r.findings.map((f) => ({ from: fromId, to: toId, ...f }))),
    ...gateResults.flatMap((r) => r.findings.map((f) => ({ from: fromId, to: toId, ...f }))),
  ];

  const allUndecided = [
    ...fieldResults.flatMap((r) => r.undecided_reasons),
    ...gateResults.flatMap((r) => r.undecided_reasons),
  ];

  if (!mappings.length && !gateRules.length) {
    return {
      from: fromId, to: toId, verdict: 'L2-indeterminate', reasons: ['no-field-map-authored'],
      field_results: [], gate_results: [], findings: [],
    };
  }

  let verdict, reasons;
  if (findings.length) {
    verdict = 'L2-fail';
    reasons = [...new Set(findings.map((f) => f.code))].sort();
  } else if (allUndecided.length) {
    verdict = 'L2-indeterminate';
    reasons = [...new Set(allUndecided)].sort();
  } else {
    verdict = 'L2-pass';
    reasons = [];
  }

  return { from: fromId, to: toId, verdict, reasons, field_results: fieldResults, gate_results: gateResults, findings };
}

/** Check one chain. Pure. */
export function checkL2Chain(chain, ctx) {
  const steps = (chain.steps || []);
  const toolIds = steps.map((s) => s.tool_id);
  const edges = [];
  for (let i = 0; i + 1 < steps.length; i++) {
    const fromId = toolIds[i], toId = toolIds[i + 1];
    const consumesFrom = steps[i + 1].consumes_from;
    const gate = steps[i].gate;
    edges.push(checkL2Edge(fromId, toId, consumesFrom, gate, toolIds, ctx));
  }
  // Gates on the LAST step (no downstream chain step) still get checked — they route to end/escalate.
  const lastStep = steps[steps.length - 1];
  let lastGateEdge = null;
  if (lastStep && lastStep.gate && steps.length >= 1) {
    const gateResults = (lastStep.gate.rules || []).map((r) => checkGateRule(lastStep.gate, r, lastStep.tool_id, toolIds, ctx));
    const findings = gateResults.flatMap((r) => r.findings.map((f) => ({ from: lastStep.tool_id, to: '(terminal)', ...f })));
    const undecided = gateResults.flatMap((r) => r.undecided_reasons);
    if (gateResults.length) {
      lastGateEdge = {
        from: lastStep.tool_id, to: '(terminal)',
        verdict: findings.length ? 'L2-fail' : (undecided.length ? 'L2-indeterminate' : 'L2-pass'),
        reasons: findings.length ? [...new Set(findings.map((f) => f.code))].sort() : [...new Set(undecided)].sort(),
        field_results: [], gate_results: gateResults, findings,
      };
      edges.push(lastGateEdge);
    }
  }

  const findings = edges.flatMap((e) => e.findings);
  const inScope = edges; // execution_hash-only exclusion happens upstream (chain assembly never
  // authors a consumes_from for it — measured: 0 manifests declare execution_hash in input_schema).

  let verdict, reasons;
  if (findings.length) {
    verdict = 'L2-fail';
    reasons = [...new Set(findings.map((f) => f.code))].sort();
  } else if (!inScope.length) {
    verdict = 'L2-indeterminate';
    reasons = ['no-in-scope-edges'];
  } else if (inScope.every((e) => e.verdict === 'L2-pass')) {
    verdict = 'L2-pass';
    reasons = [];
  } else {
    verdict = 'L2-indeterminate';
    reasons = [...new Set(inScope.filter((e) => e.verdict !== 'L2-pass').flatMap((e) => e.reasons))].sort();
  }

  return {
    name: chain.name, domain: chain.domain || null,
    step_count: steps.length, edge_count: edges.length,
    verdict, reasons, findings, edges,
  };
}

/* ────────────────────────── §5.1 fixture set is in the selftest, not here ───────────────────── */

/* ────────────────────────── §5 precision protocol ────────────────────────────────────────────── */
// L2 has produced zero adjudicated edges as of this row (§5.2: 7 leads, all L2-indeterminate, none
// a fail — they are FINDINGS-HELD lines, never fixtures for a precision ratio yet). measuredPrecision
// mirrors L1's shape so a future row can populate ADJUDICATED_L2_EDGES without touching the formula.
export const ADJUDICATED_L2_EDGES = [];

export function measuredL2Precision(fixtures = ADJUDICATED_L2_EDGES) {
  const adjudicatedEdges = fixtures.reduce((s, f) => s + f.edge_count, 0);
  const genuineDefects = fixtures.filter((f) => f.verdict === 'TP').reduce((s, f) => s + f.edge_count, 0);
  return {
    genuine_defects: genuineDefects,
    adjudicated_edges: adjudicatedEdges,
    ratio: adjudicatedEdges ? `${genuineDefects}/${adjudicatedEdges}` : 'no adjudicated L2 edges yet',
    pairs: fixtures.map((f) => ({ id: f.id, edge_count: f.edge_count, verdict: f.verdict, source: f.source })),
  };
}

/* ────────────────────────── live-estate wiring ───────────────────────────────────────────────── */

// §0 target set: L1-pass chains with spec_fraction === 1 from the L1 checker's OWN live computation
// — re-derived every run, never read from a prior report (spec §4 item 2).
function computeTargetSet(l1Report) {
  return new Set(
    l1Report.l2_readiness.ranking
      .filter((r) => r.spec_fraction === 1)
      .map((r) => r.chain),
  );
}

function loadEstate(root) {
  const cgPath = resolve(root, 'chaingraph/chaingraph.json');
  const raw = readFileSync(cgPath, 'utf8');
  const cg = JSON.parse(raw);

  const manDir = resolve(root, 'manifests');
  const fixDir = resolve(root, 'chaingraph/kernels/fixtures');
  const has = (d) => (existsSync(d) ? new Set(readdirSync(d)) : new Set());
  const manFiles = has(manDir), fixFiles = has(fixDir);
  const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
  const cacheMan = new Map();
  function manifestOf(id) {
    if (cacheMan.has(id)) return cacheMan.get(id);
    const f = `${id}.manifest.json`;
    const m = manFiles.has(f) ? readJson(resolve(manDir, f)) : null;
    cacheMan.set(id, m);
    return m;
  }
  function fixturesOf(id) {
    const f = `${id}.fixtures.json`;
    return fixFiles.has(f) ? readJson(resolve(fixDir, f)) : null;
  }

  const cacheOut = new Map(), cacheIn = new Map();
  function outSchema(id) {
    if (cacheOut.has(id)) return cacheOut.get(id);
    const m = manifestOf(id);
    const s = m ? schemaFromProperties(m.output_schema) : null;
    cacheOut.set(id, s);
    return s;
  }
  function inSchema(id) {
    if (cacheIn.has(id)) return cacheIn.get(id);
    const m = manifestOf(id);
    const s = m ? schemaFromProperties(m.input_schema) : null;
    cacheIn.set(id, s);
    return s;
  }

  function constraintOf(id, pointer, side) {
    const m = manifestOf(id);
    const schema = side === 'out' ? (m && m.output_schema) : (m && m.input_schema);
    if (!schema || !schema.properties) return null;
    const top = typeof pointer === 'string' && pointer.startsWith('/') ? pointer.slice(1).split('/')[0] : pointer;
    const prop = schema.properties[top];
    return extractConstraint(prop);
  }
  function outConstraint(id, pointer) { return constraintOf(id, pointer, 'out'); }
  function inConstraint(id, field) {
    const norm = field.startsWith('/') ? field : `/${field}`;
    return constraintOf(id, norm, 'in');
  }
  function consumerRequired(id, field) {
    const m = manifestOf(id);
    return !!(m && m.input_schema && Array.isArray(m.input_schema.required) && m.input_schema.required.includes(field));
  }
  function pointerResolvesInFixturesOnly(id, pointer) {
    const top = pointer.startsWith('/') ? pointer.slice(1).split('/')[0] : pointer;
    const fx = fixturesOf(id);
    const vecs = ((fx && fx.vectors) || []).map((v) => v.output_payload).filter(Boolean);
    return vecs.some((v) => v && Object.prototype.hasOwnProperty.call(v, top));
  }

  // §4 item 3: x-source digest re-verification. kind:clause re-hashes the pinned snapshot; every
  // other kind is trusted as declared (manifest/spec/issuer-example carry no digest to re-check).
  const snapshotDir = resolve(root, '..', 'research', 'clause-snapshots');
  const digestCache = new Map();
  function verifySource(source) {
    if (!source || typeof source !== 'object' || !source.kind) return { ok: false, reason: 'missing-source' };
    if (source.kind !== 'clause') return { ok: true };
    if (!source.ref || !source.digest) return { ok: false, reason: 'missing-digest' };
    const file = source.ref.split(/[#§ ]/)[0].trim();
    const p = resolve(snapshotDir, file);
    if (digestCache.has(p)) return digestCache.get(p) === source.digest ? { ok: true } : { ok: false, reason: 'digest-stale' };
    let actual = null;
    try { actual = 'sha256:' + createHash('sha256').update(readFileSync(p)).digest('hex'); } catch { actual = null; }
    digestCache.set(p, actual);
    return actual === source.digest ? { ok: true } : { ok: false, reason: 'digest-stale' };
  }

  return {
    chaingraph: cg,
    sourceDigest: 'sha256:' + createHash('sha256').update(raw).digest('hex'),
    ctx: {
      outSchema, inSchema, outConstraint, inConstraint, consumerRequired,
      pointerResolvesInFixturesOnly, verifySource,
    },
  };
}

// `l1Report` is REQUIRED — callers derive it fresh from L1's own buildReport() every run (spec §4
// item 2). Not optional and not read from a file: passing a stale or synthetic report is exactly how
// the selftest drives this function without touching live chaingraph.json.
export function buildReport(root = ROOT, l1Report) {
  if (!l1Report) throw new Error('buildReport(root, l1Report): l1Report is required — derive it fresh from check-chain-edge-contracts.mjs buildReport(), never omit it (spec §4 item 2)');
  const { chaingraph, sourceDigest, ctx } = loadEstate(root);
  const chains = chaingraph.chains || [];
  const targetNames = computeTargetSet(l1Report);

  const targetChains = chains.filter((c) => targetNames.has(c.name));
  const results = targetChains
    .map((c) => checkL2Chain(c, ctx))
    .sort((a, b) => a.name.localeCompare(b.name));

  const summary = { total_target_chains: targetChains.length, 'L2-pass': 0, 'L2-fail': 0, 'L2-indeterminate': 0 };
  const indeterminateReasons = {}, failCodes = {};
  let edgesTotal = 0, edgesPass = 0, edgesFail = 0, edgesIndeterminate = 0, gatesTotal = 0;
  for (const r of results) {
    summary[r.verdict]++;
    for (const e of r.edges) {
      edgesTotal++;
      if (e.verdict === 'L2-pass') edgesPass++;
      else if (e.verdict === 'L2-fail') edgesFail++;
      else edgesIndeterminate++;
      if (e.verdict === 'L2-indeterminate') for (const x of e.reasons) indeterminateReasons[x] = (indeterminateReasons[x] || 0) + 1;
      if (e.verdict === 'L2-fail') for (const f of e.findings) failCodes[f.code] = (failCodes[f.code] || 0) + 1;
      gatesTotal += (e.gate_results || []).length;
    }
  }

  const precision = measuredL2Precision();

  return {
    report: 'chain-fv-l2',
    ladder_level: 'L2',
    ladder_claim: 'edge contracts composed and machine-checked (L2: contract composition)',
    not_a_claim_of: 'formal verification — L2 checks declared assume-guarantee composition only; no kernel is ever executed (SO #34\'s sandbox rider does not apply, since no code runs here); L3 end-to-end properties are separate and unbuilt',
    dataflow_honesty_note: 'run_chain (mcp-apps-poc/worker.mjs) builds each step\'s policy_parameters from inputs[tool_id] or a fixture, NEVER from the previous step\'s output_payload. L2 verifies the DECLARED composition authored in consumes_from — what the chain page and manifests tell a human or agent to pipe where — not automatic threading the worker performs.',
    advisory: true,
    chaingraph_version: chaingraph.version || null,
    chaingraph_source_digest: sourceDigest,
    target_set_size: targetChains.length,
    precision: {
      note: 'a red is a LEAD, not a defect — SO #25 confirm/deny pair before any fix. Zero L2 edges adjudicated as of this row (spec §5.2: 7 leads recorded, all L2-indeterminate).',
      ratio: precision.ratio,
      genuine_defects: precision.genuine_defects,
      adjudicated_edges: precision.adjudicated_edges,
      pairs: precision.pairs,
    },
    summary: {
      ...summary,
      edges_total: edgesTotal,
      edges_pass: edgesPass,
      edges_fail: edgesFail,
      edges_indeterminate: edgesIndeterminate,
      gates_checked: gatesTotal,
    },
    indeterminate_reason_counts: Object.fromEntries(Object.entries(indeterminateReasons).sort((a, b) => b[1] - a[1])),
    fail_code_counts: Object.fromEntries(Object.entries(failCodes).sort((a, b) => b[1] - a[1])),
    chains: results.map((r) => ({
      name: r.name, domain: r.domain, verdict: r.verdict, reasons: r.reasons,
      step_count: r.step_count, edge_count: r.edge_count,
      findings: r.findings,
      edges: r.edges.map((e) => ({ from: e.from, to: e.to, verdict: e.verdict, reasons: e.reasons, findings: e.findings })),
    })),
  };
}

/* ────────────────────────── CLI ────────────────────────── */

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const argv = process.argv.slice(2);
  const quiet = argv.includes('--quiet');
  const asJson = argv.includes('--json');
  const ri = argv.indexOf('--report');
  const reportPath = ri !== -1 ? argv[ri + 1] : null;

  // Import L1's live report generator directly — this is the ONE place L2 depends on L1's output,
  // and it is recomputed fresh every run (spec §4 item 2), never read from a file.
  const { buildReport: buildL1Report } = await import('./check-chain-edge-contracts.mjs');
  const l1Report = buildL1Report(ROOT);
  const rep = buildReport(ROOT, l1Report);

  if (asJson) {
    process.stdout.write(JSON.stringify(rep, null, 2) + '\n');
  } else if (!quiet) {
    const s = rep.summary;
    console.log('L2 chain contract-composition check (ADVISORY on existing chains, HARD on new/changed — ladder level L2, "contract composition")');
    console.log(`  target set         : ${rep.target_set_size} chains (L1-pass, fully spec-backed)`);
    console.log(`  L2-pass            : ${s['L2-pass']}`);
    console.log(`  L2-fail            : ${s['L2-fail']}`);
    console.log(`  L2-indeterminate   : ${s['L2-indeterminate']}  (never folded into pass)`);
    console.log(`  edges              : ${s.edges_pass} pass / ${s.edges_fail} fail / ${s.edges_indeterminate} indeterminate of ${s.edges_total}`);
    console.log(`  gates checked      : ${s.gates_checked}`);
    if (Object.keys(rep.fail_code_counts).length) {
      console.log('  findings by code   :');
      for (const [k, v] of Object.entries(rep.fail_code_counts)) console.log(`      ${k}: ${v}`);
    }
    console.log('  top indeterminate reasons:');
    for (const [k, v] of Object.entries(rep.indeterminate_reason_counts).slice(0, 6)) console.log(`      ${k}: ${v}`);
  }

  if (reportPath) {
    if (!isAbsolute(reportPath)) {
      console.error('✗ --report requires an ABSOLUTE path (SO #3b). Refusing to guess.');
      process.exit(1);
    }
    writeFileSync(reportPath, JSON.stringify(rep, null, 2) + '\n');
    if (!quiet) console.log(`  report written: ${reportPath}`);
  }

  // ADVISORY on existing chains, HARD on new/changed (spec §6.1) — that split is enforced by
  // preflight.mjs's own diff-of-touched-chains logic, not by this script's exit code, which stays
  // 0 always (mirrors L1's exit contract, and keeps this CLI usable standalone).
  process.exit(0);
}
