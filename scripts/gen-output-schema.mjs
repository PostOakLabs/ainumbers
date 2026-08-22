#!/usr/bin/env node
// gen-output-schema.mjs — CHAIN-FV-L2-G-RESCOPE-3, extended by CHAIN-FV-L2G-GENERATOR-1 (nested-pointer
// resolution, numeric point-value witnessing, null-tolerant enum — see deriveField for the three).
//
// Derives a per-producer OUTPUT-CONTRACT SIDECAR from conformance fixtures for every kernel-class gate
// producer that has no manifest, and writes it to a NEW directory:
//
//     chaingraph/graph/output-schemas/<tool_id>.json
//
// ⛔⛔ WHY A SIDECAR AND NOT THE NODE SHARD (CHAIN-FV-L2-G-RESCOPE-2 was BLOCKED on exactly this).
// Writing `output_schema` into `chaingraph/graph/nodes/<id>.json` propagates verbatim into
// `chaingraph.json` on the next assemble (`assemble-chaingraph.mjs joinShards()` concatenates shard
// raw text), where the v0.4 node object is `additionalProperties: false` and REJECTS it (verified by
// mutation, RESCOPE-2 report §2). The sidecar is READ DIRECTLY by the L2 checker, exactly as manifests
// are — it is never assembled — so there is no `chaingraph.json` write, no v0.4 schema edit, and no
// single-writer lane (SO #35). The sidecar dir is not a shard; the assembler never reads it.
//
// ⛔⛔ A DERIVED DOMAIN IS A WITNESS, NOT A DECLARATION (SO #34, and the RESCOPE-3 semantic).
// Every field carries `x-source.kind: "derived"` with the note `derived from <N> fixtures @ <digest>`.
// The checker treats a derived domain as a WITNESS: it MAY decide an L2G-pass (the corpus positively
// shows the gate value is reachable in the producer's output), but it may NEVER produce a dead-branch
// L2G-fail — an absence or narrowness in a finite fixture sample is not proof the producer cannot emit
// a value. An L2G-fail still requires a DECLARED or CITED domain (a manifest x-source). That rule is
// enforced in the checker's verdict path (check-chain-l2-contracts.mjs checkGateRule), not just here.
//
// ⛔ FIXTURE VECTORS ONLY. No hand-typed schemas, no fabricated fixture values. Types come from the
// observed JS type of each output value; enums from the observed scalar values (low-cardinality only,
// null tolerated as a real member — CHAIN-FV-L2G-GENERATOR-1); minimum/maximum PLUS the exact observed
// point set from the observed numeric range (the point set decides eq/in/neq, the range never does —
// an envelope containing a value is not proof the value was emitted). Object-typed fields recurse into
// nested `properties` so a nested gate pointer resolves. Nothing is invented at any depth.
//
// ⛔ HASH-NEUTRAL by construction: this writes a NEW sidecar file per producer and touches no kernel,
// no fixture, no node shard, and not chaingraph.json — so no `execution_hash` / `kernel_digest`
// preimage can move. The kernel_digest is only READ (from the node shard's compute_proof receipt) to
// stamp the x-source note.
//
// Run:  node scripts/gen-output-schema.mjs            # write/refresh all sidecars
//       node scripts/gen-output-schema.mjs --check    # re-derive, diff against disk, non-zero on drift
//       node scripts/gen-output-schema.mjs --quiet

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CG_PATH = resolve(ROOT, 'chaingraph/chaingraph.json');
const NODES_DIR = resolve(ROOT, 'chaingraph/graph/nodes');
const FIX_DIR = resolve(ROOT, 'chaingraph/kernels/fixtures');
const MAN_DIR = resolve(ROOT, 'manifests');
const OUT_DIR = resolve(ROOT, 'chaingraph/graph/output-schemas');

// A string field with more distinct observed values than this is left as a bare `type: "string"` — an
// enum of hundreds of ids is noise, and a witness domain does not need it. Booleans always enumerate.
const ENUM_CARDINALITY_CAP = 24;

function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }

// The set of producers a sidecar is derived for: every chain step that carries a decision `gate` whose
// tool_id has NO manifest (kernel-class) and has both a node shard and a fixtures file. Computed from
// chaingraph.json directly — the generator does not depend on the L2 checker's worklist.
export function kernelClassGateProducers(cg, { manDir = MAN_DIR, nodesDir = NODES_DIR, fixDir = FIX_DIR } = {}) {
  const manFiles = existsSync(manDir) ? new Set(readdirSync(manDir)) : new Set();
  const nodeFiles = existsSync(nodesDir) ? new Set(readdirSync(nodesDir)) : new Set();
  const fixFiles = existsSync(fixDir) ? new Set(readdirSync(fixDir)) : new Set();
  const ids = new Set();
  for (const chain of (cg.chains || [])) {
    for (const step of (chain.steps || [])) {
      if (!step || !step.gate) continue;
      const id = step.tool_id;
      if (!id) continue;
      if (manFiles.has(`${id}.manifest.json`)) continue;          // manifest-backed → keep manifest site
      if (!nodeFiles.has(`${id}.json`)) continue;                 // no shard → no digest to stamp
      if (!fixFiles.has(`${id}.fixtures.json`)) continue;         // no fixtures → nothing to derive
      ids.add(id);
    }
  }
  return [...ids].sort();
}

function kernelDigestOf(id, nodesDir = NODES_DIR) {
  const shard = readJson(resolve(nodesDir, `${id}.json`));
  return (shard && shard.compute_proof && shard.compute_proof.journal && shard.compute_proof.journal.kernel_digest) || null;
}

function outputVectors(id, fixDir = FIX_DIR) {
  const fx = readJson(resolve(fixDir, `${id}.fixtures.json`));
  return ((fx && fx.vectors) || []).map((v) => v && v.output_payload).filter((p) => p && typeof p === 'object' && !Array.isArray(p));
}

// Nested-object recursion depth cap. The deepest live gate pointer is 3 segments
// (`/session/injection_detection/verdict`, CHAIN-FV-L2G-GENERATOR-1) — 4 leaves headroom without
// walking into arbitrary depth on a malformed vector.
const MAX_NEST_DEPTH = 4;

// Derive one field's witness schema from the values observed across every vector. Pure — the array of
// observed values is all it sees, so the selftest drives it with no filesystem.
//
// ⛔⛔ CHAIN-FV-L2G-GENERATOR-1 — three algorithm extensions over the RESCOPE-3 shape, all still WITNESS
// not declaration (SO #34, spec'd in the RESCOPE-3 report §3):
//   (a) OBJECT-TYPED FIELDS RECURSE into `properties`, so a nested gate pointer (e.g.
//       `/ratios/total_capital_pass`) resolves against a real sub-schema instead of stopping at `type:
//       "object"` with no properties. Depth-capped at MAX_NEST_DEPTH.
//   (b) NUMBER FIELDS also carry `x-observed-values` — the exact distinct numeric values seen, ALONGSIDE
//       minimum/maximum, never instead of them. This is NOT an `enum` (a range stays the honest witness
//       for containment/interval checks) — it exists solely so an eq/in/neq gate can be decided against
//       an exact observed POINT, never a min/max envelope (an envelope containing a value is not proof
//       the value itself was ever emitted — FIXTURES-1 already ruled this over-claims).
//   (c) NULL-TOLERANT ENUM: a string field that also observes `null` now still enumerates — the null is
//       recorded as a real member of the set (`[...strings, null]`), not silently dropped. Previously any
//       null presence blocked enum derivation entirely, even when the non-null values were low-cardinality
//       and genuinely decidable.
// `xsource`, when supplied, is stamped onto this property AND every recursively derived nested property —
// the RESCOPE-3 witness note is unchanged by depth, it always cites the same fixture corpus + digest.
export function deriveField(values, xsource = null, depth = 0) {
  const jsType = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  const types = [...new Set(values.map(jsType))].sort();
  const scalarTypes = types.filter((t) => t === 'string' || t === 'number' || t === 'boolean');
  const prop = {};

  // JSON-Schema `type`: map observed JS types. A field seen as more than one type keeps them all.
  const schemaTypes = [...new Set(types.map((t) => (t === 'array' ? 'array' : t === 'object' ? 'object' : t)))];
  prop.type = schemaTypes.length === 1 ? schemaTypes[0] : schemaTypes.sort();

  const nonArrayObject = !types.includes('array') && !types.includes('object');

  // Booleans always enumerate; strings (± null) enumerate under the cardinality cap; numbers never
  // enumerate (a range is the honest witness) but do carry the exact observed point values as a
  // separate witness field. A field of mixed scalar type (e.g. string+number) gets no enum/range.
  if (scalarTypes.length === 1 && scalarTypes[0] === 'boolean' && nonArrayObject) {
    prop.enum = [...new Set(values.filter((v) => typeof v === 'boolean'))].sort();
  } else if (nonArrayObject && (scalarTypes.length === 0 || (scalarTypes.length === 1 && scalarTypes[0] === 'string'))) {
    // (c) null-tolerant enum: string values (any subset), optionally mixed with null. A field observed
    // as null-only still gets `enum:[null]` — a genuine, if narrow, witnessed member set.
    const distinctStrings = [...new Set(values.filter((v) => typeof v === 'string'))].sort();
    const hasNull = types.includes('null');
    const distinct = hasNull ? [...distinctStrings, null] : distinctStrings;
    if (distinct.length && distinct.length <= ENUM_CARDINALITY_CAP + (hasNull ? 1 : 0)) prop.enum = distinct;
  } else if (scalarTypes.length === 1 && scalarTypes[0] === 'number' && nonArrayObject && !types.includes('null')) {
    const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (nums.length) {
      prop.minimum = Math.min(...nums);
      prop.maximum = Math.max(...nums);
      // (b) exact observed points — a witness for eq/in/neq gates, never for interval containment.
      prop['x-observed-values'] = [...new Set(nums)].sort((a, b) => a - b);
    }
  } else if (types.length === 1 && types[0] === 'object' && depth < MAX_NEST_DEPTH) {
    // (a) recurse: derive a nested sidecar schema from the sub-fields observed across every object value.
    const objValues = values.filter((v) => v && typeof v === 'object' && !Array.isArray(v));
    const subNames = new Set();
    for (const v of objValues) for (const k of Object.keys(v)) subNames.add(k);
    if (subNames.size) {
      const properties = {};
      for (const name of [...subNames].sort()) {
        const subValues = objValues.filter((v) => Object.prototype.hasOwnProperty.call(v, name)).map((v) => v[name]);
        properties[name] = deriveField(subValues, xsource, depth + 1);
      }
      prop.properties = properties;
    }
  }

  if (xsource) prop['x-source'] = { ...xsource };
  return prop;
}

// Build the full sidecar object for one producer. Pure given (id, digest, vectors).
export function deriveSidecar(id, kernelDigest, vectors) {
  const fieldNames = new Set();
  for (const v of vectors) for (const k of Object.keys(v)) fieldNames.add(k);

  const n = vectors.length;
  const xsource = {
    kind: 'derived',
    note: `derived from ${n} fixtures @ ${kernelDigest}`,
    vectors: n,
    from: 'conformance_fixtures',
    generator: 'scripts/gen-output-schema.mjs',
  };

  const properties = {};
  for (const name of [...fieldNames].sort()) {
    const values = vectors.filter((v) => Object.prototype.hasOwnProperty.call(v, name)).map((v) => v[name]);
    properties[name] = deriveField(values, xsource);
  }

  return {
    $comment: 'DERIVED OUTPUT-CONTRACT SIDECAR — a WITNESS domain from fixtures, never a declaration. May decide L2G-pass; may NEVER produce a dead-branch L2G-fail. Generated by scripts/gen-output-schema.mjs (CHAIN-FV-L2-G-RESCOPE-3). ⛔ Do not hand-edit — run the generator.',
    producer: id,
    kernel_digest: kernelDigest,
    'x-derivation': { from: 'conformance_fixtures', vectors: n, generator: 'scripts/gen-output-schema.mjs' },
    output_schema: { type: 'object', properties },
  };
}

// Deterministic serialization: object keys sorted, so the on-disk bytes are a pure function of the
// fixtures + digest and `--check` can byte-compare. Arrays keep their (already-sorted) order.
function stableStringify(obj) {
  return JSON.stringify(sortKeys(obj), null, 2) + '\n';
  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
      return out;
    }
    return v;
  }
}

export function buildAll(root = ROOT) {
  const cg = readJson(resolve(root, 'chaingraph/chaingraph.json'));
  if (!cg) throw new Error(`cannot read ${CG_PATH}`);
  const nodesDir = resolve(root, 'chaingraph/graph/nodes');
  const fixDir = resolve(root, 'chaingraph/kernels/fixtures');
  const manDir = resolve(root, 'manifests');
  const ids = kernelClassGateProducers(cg, { manDir, nodesDir, fixDir });
  const out = [];
  for (const id of ids) {
    const digest = kernelDigestOf(id, nodesDir);
    const vectors = outputVectors(id, fixDir);
    out.push({ id, sidecar: deriveSidecar(id, digest, vectors), digest, vectorCount: vectors.length });
  }
  return out;
}

/* ────────────────────────── CLI ────────────────────────── */

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const quiet = argv.includes('--quiet');

  const built = buildAll(ROOT);
  if (!existsSync(OUT_DIR)) { if (!check) mkdirSync(OUT_DIR, { recursive: true }); }

  let drift = 0, written = 0;
  const missingDigest = [];
  for (const { id, sidecar, digest } of built) {
    if (!digest) missingDigest.push(id);
    const path = resolve(OUT_DIR, `${id}.json`);
    const next = stableStringify(sidecar);
    const cur = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (cur === next) continue;
    if (check) {
      drift++;
      if (!quiet) console.error(`✗ drift: ${id}.json ${cur === null ? '(missing on disk)' : '(content differs)'}`);
    } else {
      writeFileSync(path, next);
      written++;
    }
  }

  if (missingDigest.length && !quiet) {
    console.error(`⚠ ${missingDigest.length} producer(s) had no compute_proof.journal.kernel_digest: ${missingDigest.join(', ')}`);
  }

  if (check) {
    if (drift) { console.error(`gen-output-schema --check: ${drift} sidecar(s) drifted from the fixtures — run \`node scripts/gen-output-schema.mjs\` and commit.`); process.exit(1); }
    if (!quiet) console.log(`✓ gen-output-schema --check: ${built.length} sidecars in sync with fixtures.`);
    process.exit(0);
  }

  if (!quiet) console.log(`gen-output-schema: ${built.length} producers, ${written} sidecar(s) written/updated → chaingraph/graph/output-schemas/`);
  process.exit(0);
}
