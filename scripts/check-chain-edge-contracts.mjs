#!/usr/bin/env node
// check-chain-edge-contracts.mjs — CHAIN-FV-L1-1. Ladder level L1: "edge contracts machine-checked".
//
// ⛔ L1 IS NOT "FORMALLY VERIFIED". The ladder level is always named. L1 checks that each chain's
// step-to-step edges are consistent with the graph's own declared dataflow and with the producer/
// consumer schemas. It proves nothing about kernel behaviour (that is L2 contract composition) and
// nothing about end-to-end chain properties (L3). Never publish an L1 verdict as "formally verified".
//
// WHAT THIS WALKS (all primary sources — nothing reads a verdict an artifact states about itself,
// SO #34 independent derivation):
//   chaingraph/chaingraph.json   chains[].steps[] (the composition) + nodes[].consumes/feeds
//                                (the declared dataflow map — SPEC.md §"ocg:consumes and ocg:feeds
//                                edges are the machine-readable map agents use to plan a full chain")
//   manifests/<tool_id>.manifest.json         declared input_schema / output_schema (JSON Schema)
//   chaingraph/kernels/fixtures/<id>.fixtures.json
//                                vectors[].policy_parameters / .output_payload — schema INDUCED from
//                                executable ground truth, used where no manifest schema exists.
//
// ⛔ READ-ONLY over chaingraph.json. This script never writes it, never mutates it, never assembles.
//
// THE THREE VERDICTS (honest labelling — an indeterminate is NEVER folded into a pass):
//   L1-fail          ≥1 edge carries a hard finding (see below).
//   L1-pass          every edge was DECIDABLE and clean.
//   L1-indeterminate no findings, but ≥1 edge could not be decided from available data, OR the chain
//                    has no edges at all. Every such chain names its reasons. A chain nothing was
//                    actually checked on must never be counted as verified.
//
// HARD FINDINGS (only these fail a chain — each is a contradiction between two independent
// declarations, never an absence of evidence):
//   edge-inverted   the chain runs A→B while the node adjacency asserts B→A (B.feeds ∋ A, or
//                   A.consumes ∋ B) and does NOT assert A→B. The chain runs a consumer before its
//                   producer. Measured live on canton-margin-call: 513.consumes=[505] and
//                   505.feeds=[513] both say 505→513, but the chain runs 513→505.
//   type-conflict   a field name present in BOTH the producer's output schema and the consumer's
//                   input schema has disjoint, incompatible types.
//
// ⛔ DELIBERATELY NOT A FINDING — absence of evidence is not a failure (the mirror of SO #34c's
// "absence is not a pass"):
//   * an edge the adjacency map simply does not mention (adjacency lists are curated and partial —
//     123 live edges, measured);
//   * handoff prose whose snake_case words do not resolve to output fields. Handoff strings are
//     DESCRIPTIVE: only 16.3% of their identifiers name a real producer output field (843 checked
//     live). Failing on them would measure prose vocabulary, not wiring. Reported as an advisory
//     metric only, never a verdict input.
//
// ADVISORY BY DESIGN: always exits 0. Promotion to a hard gate is a separate later decision, to be
// taken once this baseline is triaged. Zero-dep, deterministic, offline. No network, no LLM.
//
// Run:  node scripts/check-chain-edge-contracts.mjs [--report <ABSOLUTE path>] [--json] [--quiet]
// ⚠ --report takes an ABSOLUTE path. By default this script writes NOTHING — the report belongs at
//   workspace-root research/, which is OUTSIDE this repo (SO #3b: a bare `research/` resolves against
//   cwd and has already misfiled internal docs into the public repo). Refusing to guess is the point.
//
// ── MEASURED PRECISION (CHAIN-FV-L1-PRECISION-1) ────────────────────────────────────────────────
// A red here is a LEAD, not a defect — SO #25 confirm/deny pair before any fix. Every one of this
// checker's hard findings has now been through at least one such pair; see PRECISION below (derived
// at run time from ADJUDICATED_EDGES, never hardcoded — grep that constant for the sourcing).
//
// DATA-COUPLED vs NAME-ONLY: a hard finding is further classified by whether the consumer kernel's
// own source demonstrably reads the ONE field the live chain executor (`run_chain` in
// mcp-apps-poc/worker.mjs) actually threads from one step's output into the next — `execution_hash`,
// via `parent_hashes` (chain-of-custody, the OCG "consumes ANY ChainGraph artifact" pattern). Every
// other same-named field is supplied by the caller independently per step (`run_chain` builds each
// step's policy_parameters from `inputs[tool_id]` / a fixture, NEVER from the previous step's
// output_payload — read it yourself, that line has no exception) — so a shared field name that is
// not `execution_hash` was never actually delivered producer-to-consumer by anything in this estate,
// no matter how the consumer's own code happens to use its own caller-supplied value of the same
// name. A NAME-ONLY finding downgrades to INFO (still reported, never dropped — SO #34c's "absence
// is not a pass" mirrored: an unclassifiable edge, kernel source missing, stays a HARD finding).
// See classifyCoupling() below.
//
// ── SCOPE CORRECTION (CHAIN-FV-L1-PRECISION-2, Cluster A) ──────────────────────────────────────
// The execution_hash read-check answers ONE question: "was THIS shared field actually delivered
// producer-to-consumer?" That question is well-formed only for a `type-conflict` finding, which is
// literally about a shared field. It is a CATEGORY MISMATCH for an `edge-inverted` finding, which
// asserts something about chain COMPOSITION ORDER vs. the graph's own declared adjacency — no
// specific field's delivery is in question at all. Measured live: with the downgrade applied
// uniformly, every edge-inverted finding in the estate — including edge #4 (art-12↔art-01), a
// CONFIRMED + NOT-REFUTED true positive per CLUSTERA-AP2-CONFIRM-1/-DENY-1 — silently disappeared
// into INFO, because no downstream kernel in an edge-inverted pair happens to read execution_hash
// UNLESS the defect is also (coincidentally, as with cry-05) an envelope-coupling one. A classifier
// that downgrades a confirmed true positive is worse than none (the row's own words). ⇒ The
// DATA-COUPLED/NAME-ONLY downgrade now applies ONLY to `type-conflict` findings. An `edge-inverted`
// finding is NEVER eligible for the downgrade — its coupling tag is still computed and reported for
// transparency, but it stays a HARD finding regardless of the tag. See classifyChainFindings() below.

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ────────────────────────── schema primitives ────────────────────────── */

export function jsonType(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v; // string | number | boolean | object
}

// A producer type and a consumer type are compatible when they can denote the same JSON value.
// 'unknown' is a wildcard (a schema that declared no type tells us nothing — it cannot convict).
export function typesCompatible(pTypes, cTypes) {
  const num = (t) => t === 'number' || t === 'integer';
  // 'null' on the producer side means "nullable", not "wrongly typed" — JSON nullability is
  // ubiquitous and induced fixture schemas under-sample it. Judge on the non-null types.
  const p = pTypes.filter((t) => t !== 'null');
  if (!p.length) return true; // producer only ever observed null → nothing to convict on
  const c = cTypes.length ? cTypes : ['unknown'];
  return p.some((a) => c.some((b) =>
    a === b || a === 'unknown' || b === 'unknown' || (num(a) && num(b))));
}

// Induce a field→types map from concrete JSON values (fixture vectors). Top level only: an edge
// contract is about the fields handed across, not about nested record internals.
export function induceSchema(samples) {
  const acc = new Map();
  for (const s of samples) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) continue;
    for (const [k, v] of Object.entries(s)) {
      if (!acc.has(k)) acc.set(k, new Set());
      acc.get(k).add(jsonType(v));
    }
  }
  const fields = {};
  for (const k of [...acc.keys()].sort()) fields[k] = [...acc.get(k)].sort();
  return { fields, required: [] };
}

// Flatten a JSON Schema `properties` block to field→types. Union `type` arrays are preserved.
export function schemaFromProperties(schema) {
  if (!schema || !schema.properties || typeof schema.properties !== 'object') return null;
  const fields = {};
  for (const k of Object.keys(schema.properties).sort()) {
    const v = schema.properties[k] || {};
    const t = Array.isArray(v.type) ? v.type.slice().sort() : (v.type ? [v.type] : ['unknown']);
    fields[k] = t;
  }
  return { fields, required: Array.isArray(schema.required) ? schema.required.slice().sort() : [] };
}

/* ────────────────────────── the L1 edge check ────────────────────────── */

/**
 * Check one chain edge. Pure — every input arrives through `ctx`, so the selftest drives this with
 * in-memory fixture graphs and never touches live chaingraph.json.
 *
 * ctx = {
 *   adjacency: Map<tool_id, {consumes:string[], feeds:string[]}>,  // graph nodes only
 *   outSchema(tool_id) -> {fields,required}|null,
 *   inSchema(tool_id)  -> {fields,required}|null,
 * }
 */
export function checkEdge(fromId, toId, ctx) {
  const findings = [];
  const undecided = [];
  const checksRun = [];

  const A = ctx.adjacency.get(fromId);
  const B = ctx.adjacency.get(toId);

  // ── Check 1: adjacency direction ──
  if (!A || !B) {
    undecided.push(!A && !B ? 'both-endpoints-not-graph-nodes'
      : (!A ? 'producer-not-graph-node' : 'consumer-not-graph-node'));
  } else {
    const forward = (A.feeds || []).includes(toId) || (B.consumes || []).includes(fromId);
    const reverse = (B.feeds || []).includes(fromId) || (A.consumes || []).includes(toId);
    if (reverse && !forward) {
      findings.push({
        code: 'edge-inverted',
        detail: `chain runs ${fromId} -> ${toId}, but node adjacency declares ${toId} -> ${fromId}`
          + ` (${(A.consumes || []).includes(toId) ? `${fromId}.consumes includes ${toId}` : `${toId}.feeds includes ${fromId}`})`
          + ' — the chain runs a consumer before its producer',
      });
      checksRun.push('adjacency');
    } else if (forward) {
      checksRun.push('adjacency');
    } else if (!(A.feeds || []).length && !(A.consumes || []).length
      && !(B.feeds || []).length && !(B.consumes || []).length) {
      undecided.push('no-adjacency-declared-either-endpoint');
    } else {
      undecided.push('edge-absent-from-adjacency-map');
    }
  }

  // ── Check 2: schema type compatibility on shared field names ──
  const P = ctx.outSchema(fromId);
  const C = ctx.inSchema(toId);
  if (!P || !C) {
    undecided.push(!P && !C ? 'no-schema-either-endpoint'
      : (!P ? 'no-producer-output-schema' : 'no-consumer-input-schema'));
  } else {
    const shared = Object.keys(P.fields).filter((k) => C.fields[k]).sort();
    if (!shared.length) {
      undecided.push('no-shared-field-names-between-schemas');
    } else {
      let typed = 0;
      for (const k of shared) {
        const pt = P.fields[k],ct = C.fields[k];
        if (!typesCompatible(pt, ct)) {
          findings.push({
            code: 'type-conflict',
            field: k,
            detail: `field "${k}": ${fromId} emits [${pt.join('|')}], ${toId} expects [${ct.join('|')}]`,
          });
        }
        // A field typed 'unknown' on both sides was compared but decided nothing.
        if (!(pt.every((t) => t === 'unknown') || ct.every((t) => t === 'unknown'))) typed++;
      }
      if (typed) checksRun.push('schema-types');
      else undecided.push('shared-fields-carry-no-declared-types');
    }
  }

  return {
    from: fromId,
    to: toId,
    decided: checksRun.length > 0,
    checks_run: checksRun,
    findings,
    undecided_reasons: [...new Set(undecided)].sort(),
  };
}

/** Check one chain. Pure, same ctx contract as checkEdge. */
export function checkChain(chain, ctx) {
  const steps = (chain.steps || []).map((s) => s.tool_id);
  const edges = [];
  for (let i = 0; i + 1 < steps.length; i++) edges.push(checkEdge(steps[i], steps[i + 1], ctx));

  const findings = edges.flatMap((e) => e.findings.map((f) => ({ from: e.from, to: e.to, ...f })));
  const undecidedEdges = edges.filter((e) => !e.decided);

  let verdict, reasons;
  if (findings.length) {
    verdict = 'L1-fail';
    reasons = [...new Set(findings.map((f) => f.code))].sort();
  } else if (!edges.length) {
    // Nothing to check. Vacuous truth is not verification — never counted as a pass.
    verdict = 'L1-indeterminate';
    reasons = ['no-edges-single-step-chain'];
  } else if (undecidedEdges.length) {
    verdict = 'L1-indeterminate';
    reasons = [...new Set(undecidedEdges.flatMap((e) => e.undecided_reasons))].sort();
  } else {
    verdict = 'L1-pass';
    reasons = [];
  }

  return {
    name: chain.name,
    domain: chain.domain || null,
    step_count: steps.length,
    edge_count: edges.length,
    verdict,
    reasons,
    decided_edges: edges.length - undecidedEdges.length,
    findings,
    edges,
  };
}

/* ─────────────── DATA-COUPLED vs NAME-ONLY classifier (CHAIN-FV-L1-PRECISION-1) ─────────────── */
//
// ⛔ HEURISTIC PROXY for Tim's by-hand semantic judgement, NOT a re-adjudication — SO #25 confirm/
// deny pairs stay the ground truth for any specific edge. This exists to encode, mechanically, the
// ONE real distinguishing fact both settled false-positive verdicts rested on: the field never
// actually arrived from the producer. See the file-header note for the run_chain evidence.
//
// DELIBERATELY CONSERVATIVE (mirrors SO #34c "absence is not a pass"): a finding classifies
// NAME-ONLY only on POSITIVE evidence (kernel source read, no execution_hash access found). No
// kernel source available at all → UNCLASSIFIED, and UNCLASSIFIED stays a HARD finding, exactly
// like DATA-COUPLED — it is never silently downgraded for lack of evidence.

export const ENVELOPE_COUPLING_FIELD = 'execution_hash';

// A real property access or destructure of `execution_hash` — `.execution_hash`, `['execution_hash']`,
// or `{ ...execution_hash... } = `. Source-text heuristic (this whole checker is one); false positives
// inside a comment/string are accepted the same way the rest of this file accepts them.
const EXECUTION_HASH_READ_RE = /\.\s*execution_hash\b|\[\s*['"]execution_hash['"]\s*\]|\{[^{}]*\bexecution_hash\b[^{}]*\}\s*=/;

/** Classify a single finding's coupling from the CONSUMER's kernel source text (or null = unavailable). */
export function classifyCoupling(consumerKernelSource) {
  if (consumerKernelSource == null) return 'UNCLASSIFIED';
  return EXECUTION_HASH_READ_RE.test(consumerKernelSource) ? 'DATA-COUPLED' : 'NAME-ONLY';
}

/**
 * Re-derive a checkChain() result's verdict after classifying each finding. Pure — takes the
 * ALREADY-COMPUTED chain result (from checkChain) plus a `kernelSourceOf(toolId) -> string|null`
 * accessor, so the selftest can drive it with synthetic source text and never touch a real kernel.
 * checkChain/checkEdge themselves are UNCHANGED by this — every existing control on them still
 * proves what it proved before.
 */
// A finding is only eligible for the NAME-ONLY downgrade when it is literally about a shared
// field's delivery — see the SCOPE CORRECTION note above. `edge-inverted` is a composition-order
// claim, not a field-delivery claim, and is never eligible.
const NAME_ONLY_ELIGIBLE_CODES = new Set(['type-conflict']);

export function classifyChainFindings(chainResult, kernelSourceOf) {
  const findings = chainResult.findings.map((f) => ({
    ...f,
    coupling: classifyCoupling(kernelSourceOf ? kernelSourceOf(f.to) : null),
  }));
  const isDowngraded = (f) => NAME_ONLY_ELIGIBLE_CODES.has(f.code) && f.coupling === 'NAME-ONLY';
  const hard = findings.filter((f) => !isDowngraded(f));
  const info = findings.filter(isDowngraded);
  const undecidedEdges = chainResult.edges.filter((e) => !e.decided);

  let verdict, reasons;
  if (hard.length) {
    verdict = 'L1-fail';
    reasons = [...new Set(hard.map((f) => f.code))].sort();
  } else if (!chainResult.edges.length) {
    verdict = 'L1-indeterminate';
    reasons = ['no-edges-single-step-chain'];
  } else if (undecidedEdges.length) {
    verdict = 'L1-indeterminate';
    reasons = [...new Set(undecidedEdges.flatMap((e) => e.undecided_reasons))].sort();
  } else {
    verdict = 'L1-pass';
    reasons = [];
  }

  return { ...chainResult, verdict, reasons, findings: hard, info_findings: info };
}

/* ─────────────── measured precision (CHAIN-FV-L1-PRECISION-1 + -PRECISION-2) ─────────────── */
//
// The SO #25 confirm/deny pairs settled so far (board/done/*), including Cluster A
// (CLUSTERA-AP2-CONFIRM-1 / CLUSTERA-AP2-DENY-1, both landed 2026-08-16, folded in by
// CHAIN-FV-L1-PRECISION-2). Do not re-adjudicate any of these — this file ENCODES settled
// verdicts, it does not decide them.
//
// ⛔ These are OUTCOMES, not re-adjudications — each cites the settled board rows it encodes.
export const ADJUDICATED_EDGES = [
  {
    id: 'cry-04-merkle-batch-verifier -> cry-05-agent-action-audit-trail-aggregator',
    edge_count: 1,
    verdict: 'TP',
    source: 'CRY-EDGE-CONFIRM-1 (CONFIRMED) + CRY-EDGE-DENY-1 (NOT-REFUTED) + CRY-EDGE-FEEDS-LAND-1 (fixed, PR #1305)',
  },
  {
    id: 'edge #6: art-497-validator-change-control-receipt.as_of -> art-496-l1-continuous-fee-runway.as_of',
    edge_count: 1,
    verdict: 'FP',
    source: 'EDGE6-TYPECONFLICT-CONFIRM-1 (CONFIRMED type conflict but DENIED as runtime break) + EDGE6-TYPECONFLICT-DENY-1 (REFUTED)',
  },
  {
    id: 'Cluster B: 505-tokenized-collateral-eligibility-checker hub (#7, #8, #9, #13)',
    edge_count: 4,
    verdict: 'FP-hub',
    source: 'CLUSTERB-505-CONFIRM-1 (INDETERMINATE, no consistent reading) + CLUSTERB-505-DENY-1 (REFUTED all 4, hub hypothesis)',
  },
  // ── Cluster A (art-01/art-32 hub reconciliation), CHAIN-FV-L1-PRECISION-2 ──
  {
    id: 'Cluster A edge #4: art-12-acp-checkout-conformance-validator -> art-01-ap2-mandate-chain-validator',
    edge_count: 1,
    verdict: 'TP',
    source: 'CLUSTERA-AP2-CONFIRM-1 (CONFIRMED — art-12 hero prose + agentic-commerce-convergence real chain order agree, art-01 silent not contradicting) + CLUSTERA-AP2-DENY-1 (NOT-REFUTED — strongest of the 5, no counter-evidence found)',
  },
  {
    id: 'Cluster A edge #2 (CONFIRM-ONLY false positive): art-01-ap2-mandate-chain-validator -> art-62-ap2-payment-receipt-verifier',
    edge_count: 1,
    verdict: 'FP-confirm-only',
    source: 'CLUSTERA-AP2-CONFIRM-1 (CONFIRMED — art-62 hero states an explicit pre-trade/post-trade order) + CLUSTERA-AP2-DENY-1 (REFUTED — that temporal prose is scoped to one composition; a second named composition, agent-economy-payment-receipt, deliberately instantiates the reverse). A single-CONFIRM row would have shipped a fix here; the pair is what caught it.',
  },
  {
    id: 'Cluster A edge #1: art-02-agent-spend-policy-simulator <-> art-01-ap2-mandate-chain-validator',
    edge_count: 1,
    verdict: 'INDETERMINATE',
    source: 'CLUSTERA-AP2-CONFIRM-1 (PARTIALLY CONFIRMED, genuinely two-sided — both nodes self-declare and disagree) + CLUSTERA-AP2-DENY-1 (INDETERMINATE — genuine 1-1 tie in both prose and instantiation)',
  },
  {
    id: 'Cluster A edge #3 (prose-may-be-wrong caveat): art-04-agent-identity-attestation-checker <-> art-32-a2a-agent-card-trust-chain-validator',
    edge_count: 1,
    verdict: 'INDETERMINATE',
    source: 'CLUSTERA-AP2-CONFIRM-1 (INDETERMINATE, leans against the claim) + CLUSTERA-AP2-DENY-1 (INDETERMINATE — art-32\'s OWN hero prose textually claims the map\'s direction, directly contradicting an earlier reading that found "no direct textual match" for this edge; see PROSE_ORACLE_CAVEAT below)',
  },
  {
    id: 'Cluster A edge #14 (outside claim mechanism): art-02-agent-spend-policy-simulator <-> art-04-agent-identity-attestation-checker',
    edge_count: 1,
    verdict: 'INDETERMINATE',
    source: 'CLUSTERA-AP2-CONFIRM-1 (INDETERMINATE — outside the claim\'s mechanism, neither endpoint is a hub) + CLUSTERA-AP2-DENY-1 (INDETERMINATE, same reason — the proposed single mechanism structurally cannot reach this edge)',
  },
];

/* ─────────────── prose-is-evidence-not-an-oracle caveat (CHAIN-FV-L1-PRECISION-2) ─────────────── */
//
// This checker never treats hero/handoff prose as ground truth (see the handoff-prose advisory
// metric above) — but CLUSTERA-AP2-DENY-1 surfaced a sharper case than "prose is merely descriptive
// vocabulary": on Cluster A edge #3, art-32's OWN hero prose textually asserts the SAME direction
// the declared chaingraph.json map already asserts, directly contradicting an earlier reading of
// that same edge that found no textual match at all. Two independent readers of the identical prose
// disagreed about what it says. ⇒ Prose is EVIDENCE for a human adjudicator to weigh, never an
// ORACLE this or any automated checker can read as settled fact — this checker's own verdicts are
// derived ONLY from chaingraph.json adjacency + schema/kernel-source read-checks, never from a
// node's self-description, precisely because a node's own prose can itself be the thing that is
// wrong, or be read two different ways by two careful readers.
export const PROSE_ORACLE_CAVEAT = {
  note: 'Handoff/hero prose is EVIDENCE, never an ORACLE. This checker\'s verdicts never read a node\'s own prose as ground truth — only declared chaingraph.json adjacency and schema/kernel-source read-checks decide a finding.',
  worked_example: 'Cluster A edge #3 (art-04-agent-identity-attestation-checker <-> art-32-a2a-agent-card-trust-chain-validator): art-32\'s own hero prose textually claims the map\'s direction, contradicting an earlier reading of the SAME prose that reported no textual match for this edge at all.',
  source: 'CLUSTERA-AP2-DENY-1 (research/CLUSTERA-AP2-DENY-2026-08-15.md, refutation case 5) vs. the earlier CLUSTERA-AP2-CONFIRM-1 reading it corrects',
};

/** Ratio derived from ADJUDICATED_EDGES — never hardcoded, so it moves when a fixture is added/changed. */
export function measuredPrecision(fixtures = ADJUDICATED_EDGES) {
  const adjudicatedEdges = fixtures.reduce((s, f) => s + f.edge_count, 0);
  const genuineDefects = fixtures.filter((f) => f.verdict === 'TP').reduce((s, f) => s + f.edge_count, 0);
  return {
    genuine_defects: genuineDefects,
    adjudicated_edges: adjudicatedEdges,
    ratio: `${genuineDefects}/${adjudicatedEdges}`,
    pairs: fixtures.map((f) => ({ id: f.id, edge_count: f.edge_count, verdict: f.verdict, source: f.source })),
  };
}

/* ────────────────────────── live-estate wiring ────────────────────────── */

function loadEstate(root) {
  const cgPath = resolve(root, 'chaingraph/chaingraph.json');
  const raw = readFileSync(cgPath, 'utf8');
  const cg = JSON.parse(raw);

  const adjacency = new Map();
  for (const n of cg.nodes || []) {
    adjacency.set(n.tool_id, { consumes: n.consumes || [], feeds: n.feeds || [] });
  }

  const manDir = resolve(root, 'manifests');
  const fixDir = resolve(root, 'chaingraph/kernels/fixtures');
  const propDir = resolve(root, 'chaingraph/kernels/__proptests__');
  const has = (d) => (existsSync(d) ? new Set(readdirSync(d)) : new Set());
  const manFiles = has(manDir), fixFiles = has(fixDir), propFiles = has(propDir);

  const cacheOut = new Map(), cacheIn = new Map();
  const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

  function manifestOf(id) {
    const f = `${id}.manifest.json`;
    return manFiles.has(f) ? readJson(resolve(manDir, f)) : null;
  }
  function fixturesOf(id) {
    const f = `${id}.fixtures.json`;
    return fixFiles.has(f) ? readJson(resolve(fixDir, f)) : null;
  }

  function outSchema(id) {
    if (cacheOut.has(id)) return cacheOut.get(id);
    let s = null;
    const m = manifestOf(id);
    if (m) s = schemaFromProperties(m.output_schema);
    if (!s) {
      const fx = fixturesOf(id);
      const vecs = ((fx && fx.vectors) || []).map((v) => v.output_payload).filter(Boolean);
      if (vecs.length) s = induceSchema(vecs);
    }
    cacheOut.set(id, s);
    return s;
  }
  function inSchema(id) {
    if (cacheIn.has(id)) return cacheIn.get(id);
    let s = null;
    const m = manifestOf(id);
    if (m) s = schemaFromProperties(m.input_schema);
    if (!s) {
      const fx = fixturesOf(id);
      const vecs = ((fx && fx.vectors) || []).map((v) => v.policy_parameters).filter(Boolean);
      if (vecs.length) s = induceSchema(vecs);
    }
    cacheIn.set(id, s);
    return s;
  }

  // L2 readiness: a member kernel is "spec-bearing" when it ships a property-test floor file
  // (chaingraph/kernels/__proptests__/<tool_id>.proptest.mjs) — the estate's PBT-floor tier, which
  // is where stated ranges/boundaries/invariants actually live (FV-PBT-FLOOR-BUILD-SPEC.md).
  const hasSpecFile = (id) => propFiles.has(`${id}.proptest.mjs`);
  const hasFixtures = (id) => fixFiles.has(`${id}.fixtures.json`);

  // CHAIN-FV-L1-PRECISION-1: real kernel source, for the DATA-COUPLED vs NAME-ONLY read-check.
  // Read-only — never executed, only scanned as text. Missing file → null → classifyCoupling()
  // reports UNCLASSIFIED, which stays a hard finding (never a silent downgrade).
  const kernelDir = resolve(root, 'chaingraph/kernels');
  const cacheKernelSrc = new Map();
  function kernelSource(id) {
    if (cacheKernelSrc.has(id)) return cacheKernelSrc.get(id);
    let s = null;
    try { s = readFileSync(resolve(kernelDir, `${id}.kernel.mjs`), 'utf8'); } catch { s = null; }
    cacheKernelSrc.set(id, s);
    return s;
  }

  return {
    chaingraph: cg,
    sourceDigest: 'sha256:' + createHash('sha256').update(raw).digest('hex'),
    ctx: { adjacency, outSchema, inSchema },
    hasSpecFile,
    hasFixtures,
    kernelSource,
  };
}

// Advisory metric only — NEVER a verdict input. See the header note on handoff prose.
const IDENT_RE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
function handoffMetric(chains, ctx) {
  let named = 0, resolved = 0;
  for (const c of chains) {
    const st = c.steps || [];
    for (let i = 0; i + 1 < st.length; i++) {
      const ids = [...new Set((st[i].handoff || '').match(IDENT_RE) || [])];
      const P = ctx.outSchema(st[i].tool_id);
      if (!P) continue;
      for (const id of ids) { named++; if (P.fields[id]) resolved++; }
    }
  }
  return { identifiers_named: named, identifiers_resolving_to_output_field: resolved };
}

export function buildReport(root = ROOT) {
  const { chaingraph, sourceDigest, ctx, hasSpecFile, hasFixtures, kernelSource } = loadEstate(root);
  const chains = chaingraph.chains || [];

  const results = chains
    .map((c) => checkChain(c, ctx))
    .map((r) => classifyChainFindings(r, kernelSource))
    .sort((a, b) => a.name.localeCompare(b.name));

  const summary = { total_chains: chains.length, 'L1-pass': 0, 'L1-fail': 0, 'L1-indeterminate': 0 };
  const indeterminateReasons = {}, failCodes = {};
  const couplingCounts = { 'DATA-COUPLED': 0, 'NAME-ONLY': 0, UNCLASSIFIED: 0 };
  let edgesTotal = 0, edgesDecided = 0, infoFindingsTotal = 0;
  for (const r of results) {
    summary[r.verdict]++;
    edgesTotal += r.edge_count; edgesDecided += r.decided_edges;
    if (r.verdict === 'L1-indeterminate') for (const x of r.reasons) indeterminateReasons[x] = (indeterminateReasons[x] || 0) + 1;
    if (r.verdict === 'L1-fail') for (const f of r.findings) failCodes[f.code] = (failCodes[f.code] || 0) + 1;
    for (const f of r.findings) couplingCounts[f.coupling] = (couplingCounts[f.coupling] || 0) + 1;
    for (const f of r.info_findings) { couplingCounts[f.coupling] = (couplingCounts[f.coupling] || 0) + 1; infoFindingsTotal++; }
  }

  // L2-readiness ranking: fraction of a chain's distinct member kernels carrying a spec file.
  const l2 = results.map((r) => {
    const c = chains.find((x) => x.name === r.name);
    const members = [...new Set((c.steps || []).map((s) => s.tool_id))].sort();
    const withSpec = members.filter(hasSpecFile);
    const withFix = members.filter(hasFixtures);
    return {
      chain: r.name,
      l1_verdict: r.verdict,
      member_kernels: members.length,
      members_with_spec_file: withSpec.length,
      members_with_fixtures: withFix.length,
      spec_fraction: members.length ? Number((withSpec.length / members.length).toFixed(4)) : 0,
      members_missing_spec_file: members.filter((m) => !hasSpecFile(m)),
    };
  }).sort((a, b) => b.spec_fraction - a.spec_fraction
    || b.member_kernels - a.member_kernels
    || a.chain.localeCompare(b.chain));

  const fullyReady = l2.filter((x) => x.spec_fraction === 1);
  const precision = measuredPrecision();

  return {
    report: 'chain-fv-l1',
    ladder_level: 'L1',
    ladder_claim: 'edge contracts machine-checked',
    not_a_claim_of: 'formal verification — L1 checks edge consistency only; L2 (contract composition) and L3 (end-to-end property) are separate, unbuilt levels',
    advisory: true,
    chaingraph_version: chaingraph.version || null,
    chaingraph_source_digest: sourceDigest,
    precision: {
      note: 'a red is a lead, not a defect — SO #25 pair before any fix',
      measured_as_of: '2026-08-16',
      ratio: precision.ratio,
      genuine_defects: precision.genuine_defects,
      adjudicated_edges: precision.adjudicated_edges,
      cluster_a_landed: true,
      cluster_a_note: 'CLUSTERA-AP2-CONFIRM-1 / CLUSTERA-AP2-DENY-1 landed 2026-08-16 and are folded in (CHAIN-FV-L1-PRECISION-2): edge #4 TP, edge #2 a second CONFIRM-ONLY false positive, edges #1/#3/#14 INDETERMINATE.',
      pairs: precision.pairs,
    },
    coupling_classification: {
      note: 'DATA-COUPLED = consumer kernel demonstrably reads execution_hash (the one field run_chain actually threads step-to-step). NAME-ONLY = a matching field name never actually delivered producer-to-consumer — ONLY eligible to downgrade a type-conflict finding to INFO (never edge-inverted, a composition-order claim the field-delivery question cannot address — CHAIN-FV-L1-PRECISION-2). UNCLASSIFIED = kernel source unavailable, stays a HARD finding (absence of evidence is not a downgrade).',
      counts: couplingCounts,
      info_findings_total: infoFindingsTotal,
    },
    prose_oracle_caveat: PROSE_ORACLE_CAVEAT,
    summary: {
      ...summary,
      edges_total: edgesTotal,
      edges_decided: edgesDecided,
      chains_walked: results.length,
      chains_skipped: 0,
    },
    indeterminate_reason_counts: Object.fromEntries(Object.entries(indeterminateReasons).sort((a, b) => b[1] - a[1])),
    fail_code_counts: Object.fromEntries(Object.entries(failCodes).sort((a, b) => b[1] - a[1])),
    handoff_prose_advisory: {
      note: 'informational only — handoff strings are descriptive prose, never a verdict input',
      ...handoffMetric(chains, ctx),
    },
    l2_readiness: {
      spec_file_definition: 'chaingraph/kernels/__proptests__/<tool_id>.proptest.mjs (PBT floor — stated ranges/boundaries)',
      chains_fully_spec_backed: fullyReady.length,
      ranking: l2,
    },
    chains: results.map((r) => ({
      name: r.name, domain: r.domain, verdict: r.verdict, reasons: r.reasons,
      step_count: r.step_count, edge_count: r.edge_count, decided_edges: r.decided_edges,
      findings: r.findings,
      info_findings: r.info_findings,
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

  const rep = buildReport();

  if (asJson) {
    process.stdout.write(JSON.stringify(rep, null, 2) + '\n');
  } else if (!quiet) {
    const s = rep.summary, p = rep.precision, cc = rep.coupling_classification;
    console.log('L1 chain edge-contract check (ADVISORY — ladder level L1, "edge contracts machine-checked")');
    console.log(`  measured precision : ${p.ratio} genuine defects among SO #25-adjudicated edges (as of ${p.measured_as_of}${p.cluster_a_landed ? ', Cluster A folded in' : ', Cluster A not yet landed'}${reportPath ? `, report: ${reportPath}` : ''})`);
    console.log(`  ${p.note}`);
    console.log(`  prose caveat       : ${rep.prose_oracle_caveat.note}`);
    console.log(`  chains walked      : ${s.chains_walked}/${s.total_chains} (skipped ${s.chains_skipped})`);
    console.log(`  L1-pass            : ${s['L1-pass']}`);
    console.log(`  L1-fail            : ${s['L1-fail']}`);
    console.log(`  L1-indeterminate   : ${s['L1-indeterminate']}  (never folded into pass)`);
    console.log(`  edges              : ${s.edges_decided}/${s.edges_total} decided`);
    console.log(`  coupling           : DATA-COUPLED ${cc.counts['DATA-COUPLED']} / NAME-ONLY (INFO) ${cc.counts['NAME-ONLY']} / UNCLASSIFIED ${cc.counts.UNCLASSIFIED}`);
    if (Object.keys(rep.fail_code_counts).length) {
      console.log('  findings by code   :');
      for (const [k, v] of Object.entries(rep.fail_code_counts)) console.log(`      ${k}: ${v}`);
    }
    console.log('  top indeterminate reasons:');
    for (const [k, v] of Object.entries(rep.indeterminate_reason_counts).slice(0, 6)) console.log(`      ${k}: ${v}`);
    console.log(`  L2-ready chains (all members spec-backed): ${rep.l2_readiness.chains_fully_spec_backed}`);
    for (const c of rep.chains.filter((c) => c.verdict === 'L1-fail').slice(0, 10)) {
      console.log(`  ⚠ ${c.name}: ${c.findings.map((f) => f.code).join(', ')}`);
    }
  }

  if (reportPath) {
    if (!isAbsolute(reportPath)) {
      console.error('✗ --report requires an ABSOLUTE path (SO #3b: a bare research/ resolves against cwd '
        + 'and has misfiled internal docs into the public repo). Refusing to guess.');
      process.exit(1);
    }
    writeFileSync(reportPath, JSON.stringify(rep, null, 2) + '\n');
    if (!quiet) console.log(`  report written: ${reportPath}`);
  }

  // ADVISORY: always exit 0. Hard-gate promotion is a separate, later decision.
  process.exit(0);
}
