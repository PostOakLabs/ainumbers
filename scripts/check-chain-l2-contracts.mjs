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
// ⛔⛔ THE 2026-08-18 RE-SCOPE (CHAIN-FV-L2-RESCOPE-1, spec §1.4/§2.6). CHAIN-FV-L2-PREMISE-1 measured
// the field-map model at ZERO authorable edges estate-wide: `grep -c consumes_from chaingraph.json`
// = 0, and `run_chain` never threads an output field into a later input, so there is nothing for a
// per-field producer→consumer map to describe. ⛔ That model is NOT rescued by changing `run_chain`
// (a redesign of what a chain is, and nobody asked). It is marked DORMANT: `consumes_from` stays in
// the schema for a future pipeline redesign, `checkMappedField` stays live and correct for the day an
// instance appears, and an edge with no field map and no gate now reports
// L2-not-applicable(`chain-steps-independently-parameterised`) — ⛔ never `indeterminate` ×363, which
// read as 363 unfinished chores for work that does not exist.
//
// L2 is now the two couplings this estate actually has:
//   L2-G  GATE CONTRACTS — a step's decision gate reads a JSON Pointer into its OWN output; the
//         producer must publish that field in output_schema with an x-source-carrying domain the gate
//         rule is decidable against. This is real assume-guarantee: producer guarantee ⊑ consumer
//         assumption, with the assumption written literally in chaingraph.json. `checkGateRule`.
//   L2-S  SHARED-INPUT COHERENCE — for each chain, every input field name ≥2 steps accept, intersect
//         those steps' DECLARED input_schema domains. An EMPTY intersection means no single value of
//         that field can be carried through the workflow: L2S-fail with the offending domains as the
//         witness. `checkSharedInputs`.
//   L2-P  PROVENANCE THREADING — mandate_hash presence/shape where a chain declares a mandate.
//         `parent_hashes` integrity is what the execution_hash receipts already prove; L2 REFERENCES
//         that, it does not re-check it (SO #34: never re-derive a proof another gate owns).
//
// ⛔⛔ WHY L2-S DOES NOT REQUIRE AN x-source, AND WHY THAT IS NOT A HOLE IN THE HONESTY RULE.
// The x-source rule (spec §1.2/§2.3) exists because L2-G compares a declared bound against an
// EXTERNAL AUTHORITY's threshold — an unsourced number there is one somebody typed, and convicting on
// it would be validating a claim the artifact makes about itself (SO #34). L2-S asserts nothing about
// any authority. It compares TWO OF OUR OWN PUBLISHED MANIFESTS AGAINST EACH OTHER and reports a
// CONTRADICTION BETWEEN THEM. The evidence is complete and internal: both enums are published, both
// are the exact bytes an MCP agent reads as `inputSchema`, and a disjoint pair means the chain has no
// runnable value for that field no matter which outside authority is right. ⛔ A contradiction needs
// no citation — only that both sides are DECLARED. A domain a step does NOT declare is never
// convicted on (L2S-indeterminate(no-domain:<step>.<field>)), and ⛔ a domain induced from fixture
// vectors is never read here at all, so the "a fixture sample is not a domain" rule is untouched.
//
// THE VERDICTS (spec §2.4 — indeterminate is NEVER folded into pass, doctrine §5 don't #4):
//   L2-pass            every mapped field and every gate rule on the edge satisfied §2.2/§2.3 against
//                       DECLARED, x-source-carrying constraints.
//   L2-fail(witness)   ≥1 check failed. Every fail carries a concrete witness value.
//   L2-indeterminate   named reason from the closed set below — coverage, not a verdict on wrongness.
//   L2-not-applicable  the check has no instances to run on, for a STRUCTURAL reason that is named.
//                       ⛔ Distinct from both pass and indeterminate (SO #34c: absence is not a pass,
//                       and it is not an unfinished chore either). Excluded from every denominator,
//                       counted out loud.
// Chain verdict = L2-fail if any edge fails; else L2-pass if every in-scope edge passed; else
// L2-indeterminate; else L2-not-applicable when nothing was in scope for a named structural reason.
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

  const undecidedReasons = [...new Set(undecided)].sort();
  return {
    gate_input: gate.input, op: rule.op, value: rule.value, next: rule.next,
    decided: checksRun.length > 0,
    checks_run: checksRun,
    findings,
    undecided_reasons: undecidedReasons,
    // ⛔ RESCOPE-1: an undecided gate now carries what to author to decide it. An indeterminate with
    // no instruction is a number; an indeterminate with one is a work item.
    authoring: undecidedReasons.length ? gateAuthoringInstruction(gate, rule, producerId, ctx) : null,
  };
}

/* ────────────────────────── §2.6 L2-G authoring instructions ────────────────────────────────── */

/**
 * For a gate rule that did NOT decide, say exactly what a `CHAIN-FV-L2-G-BATCH-n` row must author to
 * make it decide. This is the whole difference between "74 indeterminate" (a number nobody can act
 * on) and "74 authorable" (74 named manifest properties with a stated required shape).
 *
 * ⛔ The instruction ALWAYS points at the producer's manifest/shard, NEVER at kernel bytes — sealed
 * kernels are SO #36 territory, and a declared output domain is not a behaviour change.
 * ⛔ `fixture_observed_values` are CANDIDATES to look at, never a citation (spec §1.2's proptest
 * doctrine, same shape): a fixture sample is not a domain, and authoring one still needs an x-source.
 */
export function gateAuthoringInstruction(gate, rule, producerId, ctx) {
  const top = typeof gate.input === 'string' && gate.input.startsWith('/')
    ? gate.input.slice(1).split('/')[0].replace(/~1/g, '/').replace(/~0/g, '~')
    : gate.input;
  let required;
  if (EQ_OPS.has(rule.op)) {
    required = {
      shape: 'enum',
      detail: `output_schema.properties.${top} needs an "enum" (or "const") whose membership decides ${rule.op} ${JSON.stringify(rule.value)}`,
      must_be_decidable_for: rule.value,
    };
  } else if (NUMERIC_OPS.has(rule.op)) {
    required = {
      shape: 'numeric-range',
      detail: `output_schema.properties.${top} needs "minimum" and/or "maximum" (plus "x-unit" if not dimensionless) positioned so that ${rule.op} ${JSON.stringify(rule.value)} is neither a dead nor an always-taken branch`,
      must_be_decidable_for: rule.value,
    };
  } else {
    required = {
      shape: 'unsupported-op',
      detail: `gate op "${rule.op}" is outside L2's decidable set {eq,ne,lt,lte,gt,gte} — this rule is not authorable into a decision without a spec amendment`,
      must_be_decidable_for: rule.value,
    };
  }
  const observed = (ctx.fixtureObservedValues ? ctx.fixtureObservedValues(producerId, gate.input) : []) || [];
  return {
    producer: producerId,
    field: top,
    pointer: gate.input,
    author_in: `manifests/${producerId}.manifest.json → output_schema.properties.${top}`,
    gate_rule: { op: rule.op, value: rule.value },
    required,
    x_source_required: true,
    x_source_note: 'every constraint keyword needs an x-source (spec §1.2). Without one this stays indeterminate(constraint-without-x-source) — authoring the bound alone does not close it.',
    fixture_observed_values: observed,
    fixture_note: '⛔ CANDIDATES ONLY — a fixture sample is not a domain and is not a citation (spec §1.2, §2.3). Look here, then cite the authority.',
    never_author_in: 'the kernel — kernel bytes are sealed (SO #36); a declared output domain belongs in the manifest/shard.',
  };
}

/* ────────────────────────── §2.7 L2-S shared-input coherence ────────────────────────────────── */

/** Intersect the declared enums of the participants that declare one. Null when fewer than 2 do. */
function enumIntersection(participants) {
  const withEnum = participants.filter((p) => p.constraint && p.constraint.enum && p.constraint.enum.length);
  if (withEnum.length < 2) return null;
  let inter = withEnum[0].constraint.enum.slice();
  for (const p of withEnum.slice(1)) inter = inter.filter((v) => p.constraint.enum.includes(v));
  return { participants: withEnum, intersection: inter };
}

/**
 * Check ONE input field name that ≥2 steps of a chain accept.
 *
 * ✅ The claim: "these published input contracts contradict each other, so this chain has no runnable
 *    value for this field." Evidence is entirely internal — see the header note on why this needs no
 *    x-source and why that does not weaken the honesty rule.
 * ⛔ A step that declares NO domain for the field is never convicted on — it is named in an
 *    indeterminate reason so a batch row knows exactly which manifest property is missing.
 * ⛔ Unequal-but-overlapping domains are a PASS, not a fail: each step may legitimately accept a
 *    superset. Only an EMPTY intersection is a defect. The narrowed intersection is published as the
 *    chain's effective domain — useful and true, without convicting anyone.
 */
export function checkSharedInputField(field, participants) {
  const findings = [];
  const undecided = [];

  // ── Type conflict (L1's lattice, imported — never restated) ──
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const a = participants[i], b = participants[j];
      if (!typesCompatible(a.types || ['unknown'], b.types || ['unknown'])) {
        findings.push({
          code: 'shared-input-type-conflict', field,
          detail: `${a.step} declares ${field}: ${(a.types || []).join('|')} but ${b.step} declares ${field}: ${(b.types || []).join('|')} — one value cannot satisfy both`,
          witness: `${a.step}:${(a.types || []).join('|')} vs ${b.step}:${(b.types || []).join('|')}`,
        });
      }
    }
  }

  // ── Unit conflict — exact UCUM strings, ⛔ no conversion, ever (spec §2.2 check 4) ──
  const units = participants.filter((p) => p.constraint && p.constraint.unit);
  const distinctUnits = [...new Set(units.map((p) => p.constraint.unit))];
  if (distinctUnits.length > 1) {
    const a = units.find((p) => p.constraint.unit === distinctUnits[0]);
    const b = units.find((p) => p.constraint.unit === distinctUnits[1]);
    findings.push({
      code: 'shared-input-unit-conflict', field,
      detail: `${a.step} declares x-unit "${a.constraint.unit}" but ${b.step} declares x-unit "${b.constraint.unit}" for the same field`,
      witness: `${a.constraint.unit} != ${b.constraint.unit}`,
    });
  } else if (units.length && units.length < participants.length) {
    undecided.push(`unit-declared-one-side:${field}`);
  }

  // ── Enum intersection ──
  let effectiveDomain = null;
  const en = enumIntersection(participants);
  if (en) {
    if (en.intersection.length === 0) {
      // Concrete witness: a value one step accepts that another positively rejects.
      const a = en.participants[0];
      const rejecter = en.participants.find((p) => p !== a && !p.constraint.enum.includes(a.constraint.enum[0]));
      findings.push({
        code: 'shared-input-domain-disjoint', field,
        detail: `no value of "${field}" satisfies every step: ${en.participants.map((p) => `${p.step} accepts [${p.constraint.enum.join(',')}]`).join('; ')}`,
        witness: rejecter
          ? `"${a.constraint.enum[0]}" is accepted by ${a.step} and rejected by ${rejecter.step}`
          : `the intersection of ${en.participants.length} declared enums is empty`,
      });
    } else {
      effectiveDomain = { kind: 'enum', values: en.intersection };
    }
  }

  // ── Numeric range intersection ──
  const nums = participants.filter((p) => p.constraint && (guaranteeLow(p.constraint) !== null || guaranteeHigh(p.constraint) !== null));
  if (nums.length >= 2) {
    let lo = null, hi = null, loStep = null, hiStep = null;
    for (const p of nums) {
      const l = guaranteeLow(p.constraint), h = guaranteeHigh(p.constraint);
      if (l !== null && (lo === null || l > lo)) { lo = l; loStep = p.step; }
      if (h !== null && (hi === null || h < hi)) { hi = h; hiStep = p.step; }
    }
    if (lo !== null && hi !== null && lo > hi) {
      findings.push({
        code: 'shared-input-range-disjoint', field,
        detail: `no value of "${field}" satisfies every step: ${loStep} requires >= ${lo} while ${hiStep} requires <= ${hi}`,
        witness: `[${lo},${hi}] is empty`,
      });
    } else if (lo !== null && hi !== null && !effectiveDomain) {
      effectiveDomain = { kind: 'range', minimum: lo, maximum: hi };
    }
  }

  // ── Coverage: which participants declared nothing at all ──
  for (const p of participants) {
    if (!p.constraint) undecided.push(`no-domain:${p.step}.${field}`);
  }

  const declaredCount = participants.filter((p) => p.constraint).length;
  let verdict;
  if (findings.length) verdict = 'L2S-fail';
  else if (declaredCount < 2 || undecided.length) verdict = 'L2S-indeterminate';
  else verdict = 'L2S-pass';

  return {
    field,
    steps: participants.map((p) => p.step),
    verdict,
    effective_domain: effectiveDomain,
    findings,
    undecided_reasons: [...new Set(undecided)].sort(),
  };
}

/**
 * L2-S for one chain. Pure — ctx supplies inSchema/inConstraint, exactly as the edge checks do.
 * ⛔ Reads manifest input_schemas only. Never a fixture vector, never a kernel.
 */
export function checkSharedInputs(chain, ctx) {
  const seen = new Set();
  const byField = new Map();
  for (const s of (chain.steps || [])) {
    const id = s.tool_id;
    if (seen.has(id)) continue; // a chain may name a tool twice; one contract per tool
    seen.add(id);
    const sch = ctx.inSchema(id);
    if (!sch || !sch.fields) continue;
    for (const f of Object.keys(sch.fields)) {
      if (!byField.has(f)) byField.set(f, []);
      byField.get(f).push({ step: id, types: sch.fields[f], constraint: ctx.inConstraint(id, f) });
    }
  }

  const fields = [];
  for (const [field, participants] of [...byField.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (participants.length < 2) continue;
    fields.push(checkSharedInputField(field, participants));
  }

  const findings = fields.flatMap((f) => f.findings);
  let verdict, reasons;
  if (!fields.length) {
    verdict = 'L2S-not-applicable';
    reasons = ['no-shared-input-fields'];
  } else if (findings.length) {
    verdict = 'L2S-fail';
    reasons = [...new Set(findings.map((f) => f.code))].sort();
  } else if (fields.every((f) => f.verdict === 'L2S-pass')) {
    verdict = 'L2S-pass';
    reasons = [];
  } else {
    verdict = 'L2S-indeterminate';
    reasons = [...new Set(fields.filter((f) => f.verdict !== 'L2S-pass').flatMap((f) => f.undecided_reasons))].sort();
  }

  return { verdict, reasons, shared_field_count: fields.length, fields, findings };
}

/* ────────────────────────── §2.8 L2-P provenance threading ──────────────────────────────────── */

/**
 * L2-P is deliberately THIN, and that is a finding, not a shortfall.
 *
 * `parent_hashes` / `parent_tool_ids` integrity is exactly what the execution_hash receipts already
 * prove, and SO #34 forbids a second checker re-deriving a proof another gate owns — so L2-P
 * REFERENCES that and re-checks nothing. What is left is the one declared thing: `run_chain` injects
 * `mandate_hash` into every step's policy_parameters when, and only when, the chain declares a
 * mandate. A chain that declares one whose step does not accept it is a declared/threaded mismatch —
 * checkable from chaingraph.json + manifests, with nothing executed.
 */
export function checkProvenanceThreading(chain, ctx) {
  const declaresMandate = !!(chain.mandate || chain.mandate_hash || chain.requires_mandate);
  const HASH_NOTE = 'parent_hashes integrity is proven by the execution_hash receipts, not re-derived here (SO #34).';
  if (!declaresMandate) {
    return { verdict: 'L2P-not-applicable', reasons: ['chain-declares-no-mandate'], hash_chain_note: HASH_NOTE, findings: [] };
  }
  const findings = [];
  const missing = [];
  for (const s of (chain.steps || [])) {
    const sch = ctx.inSchema(s.tool_id);
    if (!sch || !sch.fields) { missing.push(s.tool_id); continue; }
    if (!Object.prototype.hasOwnProperty.call(sch.fields, 'mandate_hash')) {
      findings.push({
        code: 'mandate-hash-not-accepted',
        detail: `chain declares a mandate, so run_chain injects mandate_hash into every step's policy_parameters, but ${s.tool_id}'s input_schema does not declare it`,
        witness: `${s.tool_id}.input_schema has no mandate_hash property`,
      });
    }
  }
  return {
    verdict: findings.length ? 'L2P-fail' : (missing.length ? 'L2P-indeterminate' : 'L2P-pass'),
    reasons: findings.length
      ? [...new Set(findings.map((f) => f.code))].sort()
      : (missing.length ? [...new Set(missing.map((m) => `no-manifest:${m}`))].sort() : []),
    hash_chain_note: HASH_NOTE,
    findings,
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
    // ⛔⛔ RESCOPE-1 (spec §1.4/§2.6). This was `L2-indeterminate(no-field-map-authored)` × 363, which
    // read as 363 unfinished chores. CHAIN-FV-L2-PREMISE-1 measured that there is nothing to author:
    // 0 consumes_from entries exist estate-wide, and `run_chain` never threads an output field into a
    // later input, so chain steps are independently parameterised by construction. Absence for a
    // STRUCTURAL reason is not a coverage gap. ⛔ It is not a pass either (SO #34c) — hence a third
    // verdict, excluded from every denominator and counted out loud.
    return {
      from: fromId, to: toId, verdict: 'L2-not-applicable',
      reasons: ['chain-steps-independently-parameterised'],
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

/**
 * Check one chain. Pure.
 *
 * ⛔⛔ THE TWO SCOPES ARE DIFFERENT, DELIBERATELY, AND THE DIFFERENCE IS MEASURED (RESCOPE-1).
 * L2-G is confined to the §0 target set (L1-pass, fully spec-backed) because it convicts against an
 * x-source-carrying domain, and that grade of claim needs the spec backing. **L2-S and L2-P have no
 * such dependency** — they compare our own published manifests against each other and against
 * chaingraph.json, so neither L1's edge-ordering verdict nor a chain's spec_fraction is evidence
 * about them. Confining them to the same set would have been a silent scope error: measured
 * 2026-08-18, BOTH chains carrying a real disjoint-domain defect (`dora-operational-resilience`,
 * `rtp-participation`) sit OUTSIDE the target set. L2-S therefore runs estate-wide, and every
 * published count says which scope it came from.
 */
export function checkL2Chain(chain, ctx, { gateScope = true } = {}) {
  const steps = (chain.steps || []);
  const toolIds = steps.map((s) => s.tool_id);
  const edges = [];
  for (let i = 0; gateScope && i + 1 < steps.length; i++) {
    const fromId = toolIds[i], toId = toolIds[i + 1];
    const consumesFrom = steps[i + 1].consumes_from;
    const gate = steps[i].gate;
    edges.push(checkL2Edge(fromId, toId, consumesFrom, gate, toolIds, ctx));
  }
  // Gates on the LAST step (no downstream chain step) still get checked — they route to end/escalate.
  const lastStep = steps[steps.length - 1];
  let lastGateEdge = null;
  if (gateScope && lastStep && lastStep.gate && steps.length >= 1) {
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

  // ⛔ RESCOPE-1: not-applicable edges are excluded from the denominator, and counted out loud.
  const inScope = edges.filter((e) => e.verdict !== 'L2-not-applicable');
  const notApplicable = edges.filter((e) => e.verdict === 'L2-not-applicable');

  // The two other couplings, computed per chain rather than per edge (§2.7, §2.8).
  const shared = checkSharedInputs(chain, ctx);
  const provenance = checkProvenanceThreading(chain, ctx);

  const findings = [
    ...edges.flatMap((e) => e.findings),
    ...shared.findings.map((f) => ({ scope: 'L2-S', chain: chain.name, ...f })),
    ...provenance.findings.map((f) => ({ scope: 'L2-P', chain: chain.name, ...f })),
  ];

  // Chain verdict composes all three couplings: fail beats indeterminate beats pass beats
  // not-applicable. A coupling that is not-applicable contributes nothing in either direction — it
  // can neither rescue a chain into a pass nor drag one into an indeterminate.
  const contributions = [
    ...inScope.map((e) => e.verdict),
    shared.verdict.replace('L2S-', 'L2-'),
    provenance.verdict.replace('L2P-', 'L2-'),
  ].filter((v) => v !== 'L2-not-applicable');

  let verdict, reasons;
  if (findings.length) {
    verdict = 'L2-fail';
    reasons = [...new Set(findings.map((f) => f.code))].sort();
  } else if (!contributions.length) {
    // Nothing in scope anywhere. Say WHICH structural reason, never a bare indeterminate and never a
    // vacuous pass. A chain with edges that are all not-applicable is a different state from a
    // single-step chain with no edges at all.
    verdict = 'L2-not-applicable';
    reasons = notApplicable.length
      ? ['chain-steps-independently-parameterised', ...(shared.shared_field_count ? [] : ['no-shared-input-fields'])].sort()
      : (gateScope ? ['no-in-scope-edges'] : ['outside-L2G-target-set', ...(shared.shared_field_count ? [] : ['no-shared-input-fields'])].sort());
  } else if (contributions.every((v) => v === 'L2-pass')) {
    verdict = 'L2-pass';
    reasons = [];
  } else {
    verdict = 'L2-indeterminate';
    reasons = [...new Set([
      ...inScope.filter((e) => e.verdict === 'L2-indeterminate').flatMap((e) => e.reasons),
      ...(shared.verdict === 'L2S-indeterminate' ? shared.reasons : []),
      ...(provenance.verdict === 'L2P-indeterminate' ? provenance.reasons : []),
    ])].sort();
  }

  return {
    name: chain.name, domain: chain.domain || null,
    step_count: steps.length, edge_count: edges.length,
    in_scope_edge_count: inScope.length,
    not_applicable_edge_count: notApplicable.length,
    verdict, reasons, findings, edges,
    gate_scope: gateScope,
    shared_inputs: shared,
    provenance,
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
  // ⛔ CANDIDATES for an authoring row to LOOK at, never evidence and never a citation (spec §1.2).
  // Nothing in the verdict path may ever call this — it feeds gateAuthoringInstruction alone.
  function fixtureObservedValues(id, pointer) {
    const top = pointer.startsWith('/') ? pointer.slice(1).split('/')[0] : pointer;
    const fx = fixturesOf(id);
    const seen = [];
    for (const v of ((fx && fx.vectors) || [])) {
      const op = v && v.output_payload;
      if (op && Object.prototype.hasOwnProperty.call(op, top)) {
        const val = op[top];
        if (val === null || typeof val !== 'object') { if (!seen.includes(val)) seen.push(val); }
      }
    }
    return seen.slice(0, 12);
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
      pointerResolvesInFixturesOnly, fixtureObservedValues, verifySource,
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
  // L2-G walks the target set; L2-S / L2-P walk the whole estate (see checkL2Chain's scope note).
  const results = chains
    .map((c) => checkL2Chain(c, ctx, { gateScope: targetNames.has(c.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const summary = { total_target_chains: targetChains.length, 'L2-pass': 0, 'L2-fail': 0, 'L2-indeterminate': 0, 'L2-not-applicable': 0 };
  const indeterminateReasons = {}, failCodes = {};
  let edgesTotal = 0, edgesPass = 0, edgesFail = 0, edgesIndeterminate = 0, edgesNotApplicable = 0, gatesTotal = 0;
  // L2-S roll-up + the authoring worklist that re-sizes the batch plan (§7).
  const sVerdicts = { 'L2S-pass': 0, 'L2S-fail': 0, 'L2S-indeterminate': 0, 'L2S-not-applicable': 0 };
  const pVerdicts = { 'L2P-pass': 0, 'L2P-fail': 0, 'L2P-indeterminate': 0, 'L2P-not-applicable': 0 };
  let sharedFieldsTotal = 0;
  const authoring = [];
  const authoringSeen = new Set();
  for (const r of results) {
    if (r.gate_scope) summary[r.verdict]++; // chain-level L2-G verdict counts stay on the target set
    sVerdicts[r.shared_inputs.verdict]++;
    pVerdicts[r.provenance.verdict]++;
    sharedFieldsTotal += r.shared_inputs.shared_field_count;
    for (const e of r.edges) {
      edgesTotal++;
      if (e.verdict === 'L2-pass') edgesPass++;
      else if (e.verdict === 'L2-fail') edgesFail++;
      else if (e.verdict === 'L2-not-applicable') edgesNotApplicable++;
      else edgesIndeterminate++;
      if (e.verdict === 'L2-indeterminate') for (const x of e.reasons) indeterminateReasons[x] = (indeterminateReasons[x] || 0) + 1;
      if (e.verdict === 'L2-fail') for (const f of e.findings) failCodes[f.code] = (failCodes[f.code] || 0) + 1;
      gatesTotal += (e.gate_results || []).length;
      for (const g of (e.gate_results || [])) {
        if (!g.authoring) continue;
        // One work item per (producer, field) — that is the unit a batch row authors once and every
        // gate reading it closes. Chains that share a producer are recorded on the same item.
        const key = `${g.authoring.producer}::${g.authoring.field}`;
        if (authoringSeen.has(key)) {
          const item = authoring.find((a) => a.producer === g.authoring.producer && a.field === g.authoring.field);
          if (!item.chains.includes(r.name)) item.chains.push(r.name);
          item.gate_rule_count++;
          continue;
        }
        authoringSeen.add(key);
        authoring.push({ ...g.authoring, domain: r.domain || null, chains: [r.name], gate_rule_count: 1 });
      }
    }
  }
  authoring.sort((a, b) => (a.producer.localeCompare(b.producer) || a.field.localeCompare(b.field)));
  for (const a of authoring) a.chains.sort();

  // Batch sizing, DERIVED — ⛔ never a hardcoded batch count (SO #34: recompute, don't restate).
  // §7.1's cost driver is kernels, capped at ≤20 per session; the unit here is the producer whose
  // manifest a row must author, so batches = ceil(distinct producers / 20).
  const KERNELS_PER_BATCH = 20;
  const distinctProducers = [...new Set(authoring.map((a) => a.producer))];
  const byDomain = {};
  for (const a of authoring) {
    const d = a.domain || '(no domain)';
    if (!byDomain[d]) byDomain[d] = new Set();
    byDomain[d].add(a.producer);
  }

  const precision = measuredL2Precision();

  return {
    report: 'chain-fv-l2',
    ladder_level: 'L2',
    ladder_claim: 'edge contracts composed and machine-checked (L2: contract composition)',
    not_a_claim_of: 'formal verification — L2 checks declared assume-guarantee composition only; no kernel is ever executed (SO #34\'s sandbox rider does not apply, since no code runs here); L3 end-to-end properties are separate and unbuilt',
    dataflow_honesty_note: 'run_chain (mcp-apps-poc/worker.mjs) builds each step\'s policy_parameters from inputs[tool_id] or a fixture, NEVER from the previous step\'s output_payload. Chains are provenance-linked bundles of independently-parameterised kernels, not data pipelines. L2 therefore checks the couplings that exist — gate contracts (L2-G), shared-input coherence (L2-S), provenance threading (L2-P) — and NOT a producer-to-consumer field map, which CHAIN-FV-L2-PREMISE-1 measured at zero instances estate-wide.',
    field_map_model: {
      status: 'dormant',
      reason: 'CHAIN-FV-L2-PREMISE-1 (2026-08-18) measured 0 consumes_from entries estate-wide and read run_chain directly: no output field flows into a later step\'s input. The five §2.2 refinement checks have no instances in this estate.',
      retained: 'consumes_from stays optional in the schema and checkMappedField stays live and correct, so a future pipeline redesign inherits a working checker rather than a rewrite.',
      not_rescued_by: '⛔ changing run_chain to pipe outputs into inputs — that redesigns what a chain is, and was explicitly ruled out of scope (CHAIN-FV-L2-RESCOPE-1).',
    },
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
      edges_not_applicable: edgesNotApplicable,
      edges_in_scope: edgesTotal - edgesNotApplicable,
      gates_checked: gatesTotal,
    },
    l2s: {
      what: 'shared-input coherence — for each chain, every input field name ≥2 steps accept, intersected across those steps\' DECLARED manifest input_schema domains.',
      scope: `estate-wide — all ${results.length} chains, NOT the ${targetChains.length}-chain L2-G target set. L2-S compares our own manifests against each other, so neither L1's edge-ordering verdict nor a chain's spec_fraction is evidence about it. Measured 2026-08-18: both chains carrying a disjoint-domain defect sit outside the target set, so confining L2-S to it would have hidden every finding it has.`,
      needs_no_x_source_because: 'L2-S reports a CONTRADICTION BETWEEN TWO OF OUR OWN PUBLISHED MANIFESTS, not agreement with an outside authority. Both enums are the exact bytes an agent reads as inputSchema, so the evidence is complete and internal. A step that declares nothing is never convicted on, and no fixture-induced domain is read here at all.',
      empty_intersection_is_the_defect: 'unequal-but-overlapping domains are a PASS — a step may legitimately accept a superset. Only an EMPTY intersection means the chain has no runnable value for that field.',
      shared_fields_examined: sharedFieldsTotal,
      ...sVerdicts,
    },
    l2p: {
      what: 'provenance threading — mandate_hash acceptance where a chain declares a mandate.',
      hash_chain_note: 'parent_hashes / parent_tool_ids integrity is what the execution_hash receipts already prove. L2-P references that and re-derives none of it (SO #34).',
      ...pVerdicts,
    },
    l2g_authoring: {
      what: 'one work item per (producer, field) an undecided gate reads. This is what re-sizes the batch plan: the unit of work is the producer manifest a row authors once, not the edge.',
      author_in: 'the producer\'s manifest/shard. ⛔ NEVER kernel bytes (sealed, SO #36).',
      open_gate_edges: gatesTotal ? authoring.reduce((s, a) => s + a.gate_rule_count, 0) : 0,
      distinct_producers: distinctProducers.length,
      kernels_per_batch_cap: KERNELS_PER_BATCH,
      batches_required: Math.ceil(distinctProducers.length / KERNELS_PER_BATCH),
      producers_by_domain: Object.fromEntries(
        Object.entries(byDomain).map(([d, set]) => [d, set.size]).sort((a, b) => b[1] - a[1]),
      ),
      items: authoring,
    },
    indeterminate_reason_counts: Object.fromEntries(Object.entries(indeterminateReasons).sort((a, b) => b[1] - a[1])),
    fail_code_counts: Object.fromEntries(Object.entries(failCodes).sort((a, b) => b[1] - a[1])),
    chains: results.map((r) => ({
      name: r.name, domain: r.domain, verdict: r.verdict, reasons: r.reasons,
      gate_scope: r.gate_scope,
      step_count: r.step_count, edge_count: r.edge_count,
      in_scope_edge_count: r.in_scope_edge_count,
      not_applicable_edge_count: r.not_applicable_edge_count,
      findings: r.findings,
      edges: r.edges.map((e) => ({ from: e.from, to: e.to, verdict: e.verdict, reasons: e.reasons, findings: e.findings })),
      shared_inputs: {
        verdict: r.shared_inputs.verdict,
        reasons: r.shared_inputs.reasons,
        shared_field_count: r.shared_inputs.shared_field_count,
        fields: r.shared_inputs.fields.map((f) => ({
          field: f.field, steps: f.steps, verdict: f.verdict,
          effective_domain: f.effective_domain, findings: f.findings,
          undecided_reasons: f.undecided_reasons,
        })),
      },
      provenance: { verdict: r.provenance.verdict, reasons: r.provenance.reasons, findings: r.provenance.findings },
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
    console.log(`  L2-G target set    : ${rep.target_set_size} chains (L1-pass, fully spec-backed)`);
    console.log(`  L2-S / L2-P scope  : ${rep.chains.length} chains (estate-wide — see l2s.scope)`);
    console.log(`  L2-pass            : ${s['L2-pass']}`);
    console.log(`  L2-fail            : ${s['L2-fail']}`);
    console.log(`  L2-indeterminate   : ${s['L2-indeterminate']}  (never folded into pass)`);
    console.log(`  L2-not-applicable  : ${s['L2-not-applicable']}  (structural absence — ⛔ not a pass, ⛔ not a chore)`);
    console.log(`  edges              : ${s.edges_pass} pass / ${s.edges_fail} fail / ${s.edges_indeterminate} indeterminate of ${s.edges_in_scope} in scope`);
    console.log(`                       + ${s.edges_not_applicable} not-applicable (field-map model dormant — see field_map_model)`);
    console.log(`  gates checked      : ${s.gates_checked}`);
    if (Object.keys(rep.fail_code_counts).length) {
      console.log('  findings by code   :');
      for (const [k, v] of Object.entries(rep.fail_code_counts)) console.log(`      ${k}: ${v}`);
    }
    console.log('  top indeterminate reasons:');
    for (const [k, v] of Object.entries(rep.indeterminate_reason_counts).slice(0, 6)) console.log(`      ${k}: ${v}`);
    console.log('  L2-S shared-input coherence:');
    console.log(`      ${rep.l2s['L2S-pass']} pass / ${rep.l2s['L2S-fail']} fail / ${rep.l2s['L2S-indeterminate']} indeterminate / ${rep.l2s['L2S-not-applicable']} not-applicable`);
    console.log(`      shared input fields examined: ${rep.l2s.shared_fields_examined}`);
    console.log('  L2-P provenance threading:');
    console.log(`      ${rep.l2p['L2P-pass']} pass / ${rep.l2p['L2P-fail']} fail / ${rep.l2p['L2P-indeterminate']} indeterminate / ${rep.l2p['L2P-not-applicable']} not-applicable`);
    console.log('  L2-G authoring worklist (what re-sizes the batch plan):');
    console.log(`      ${rep.l2g_authoring.open_gate_edges} open gate rules over ${rep.l2g_authoring.distinct_producers} distinct producer manifests`);
    console.log(`      ⇒ ${rep.l2g_authoring.batches_required} batches at the §7.1 cap of ${rep.l2g_authoring.kernels_per_batch_cap} kernels/session`);
    for (const [d, n] of Object.entries(rep.l2g_authoring.producers_by_domain).slice(0, 8)) console.log(`      ${d}: ${n} producers`);
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
