#!/usr/bin/env node
/**
 * scripts/gen-manifest-examples.mjs — MANIFEST-EXAMPLES-ANNOTATIONS-1.
 *
 * ONE writer (SO #47) for five additive, self-descriptive manifest keys that every
 * neighbouring standard requires and this estate had zero of:
 *
 *   input_example           — fixture vector[0] `policy_parameters`, copied verbatim
 *   output_example          — the SAME vector's `output_payload`, copied verbatim
 *   example_execution_hash  — the SAME vector's pinned `golden_hash`, so the pair above
 *                             is VERIFIABLE (`verify_execution_hash`) rather than decorative
 *   author                  — "PostOakLabs" (organization; ⛔ never a person or an address)
 *   license                 — "CC-BY-4.0" (repo-wide, CONTRACT.md §0)
 *
 * plus `mcp_tool_definition.annotations` (MCP 2026-07-28 reviewed-risk vocabulary), and a
 * fixture-derived `output_schema` for manifests that declare none.
 *
 * ⛔ NOTHING HERE IS INVENTED. An example exists only where a committed fixture vector
 * supplies it; a manifest with no fixture gets NO example keys at all and is COUNTED as
 * absent (SO #34c — absence is a distinct state, never dressed up as coverage). The
 * example bytes are a verbatim structural copy of the fixture's own values, so
 * `example_execution_hash` is the hash of exactly the pair printed next to it.
 *
 * ── WHY THESE FIELDS (measured, 2026-09-17 recipe-schema survey) ──────────────────────
 * Bazantic's recipe format REQUIRES `input_example` / `output_example`; JSON Schema
 * 2020-12 `examples`, OpenAPI 3.1 `examples` and A2A skill `examples` are the same
 * convention; MCP 2026-07-28 defines the four tool `annotations` hints. The AuthZEN
 * recipe's `output_example` already carries an Execution Hash column — after this
 * generator, `example_execution_hash` is the field a recipe author copies.
 *
 * ── ANNOTATIONS: THE DERIVATION, NOT A VIBE ──────────────────────────────────────────
 * `{ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }`
 * is declared for a tool iff ALL of these hold, each from a published, gated signal:
 *   (a) the tool is a chaingraph.json node with `status: "live"`  — it is a real surface;
 *   (b) that node has `gpu: false`                                — SPEC.md §18.6 makes exactly
 *       this the determinism/cost boundary ("the published, gated signal for 'kernel runs as
 *       a small deterministic server compute'"), so idempotentHint follows from the standard's
 *       own class rather than from a fresh judgement here;
 *   (c) a kernel exists at chaingraph/kernels/<tool_id>.kernel.mjs — kernels are pure
 *       `compute(policy_parameters) -> output_payload` modules that may import `_hash.mjs`
 *       and nothing else (CONTRACT.md §0 / SPEC.md §12): no network, no filesystem, no
 *       mutation of anything outside the return value. readOnlyHint / destructiveHint /
 *       openWorldHint are all decided by that one structural fact.
 * A tool failing ANY of (a)-(c) gets NO annotations and is listed by reason. ⛔ The four
 * hints are a reviewed risk vocabulary; a tool we cannot derive them for gets silence.
 *
 * ── OUTPUT-SCHEMA GAP ────────────────────────────────────────────────────────────────
 * Manifests with no `output_schema` get one derived from their fixture `output_payload`s by
 * check-output-schema-coverage.mjs's OWN exported `deriveSchema()` (AGENT-REACH §3.10) — one
 * derivation, imported rather than re-implemented, so the gate and the writer cannot drift.
 * The written schema carries `"x-derived-from": "fixture"`, which is BOTH the provenance mark
 * and this generator's ownership mark: a hand-authored `output_schema` has no such mark and is
 * never read, compared or overwritten here. A derived schema is written only if it validates
 * every one of that tool's fixture `output_payload`s (same validator the coverage gate uses) —
 * a schema that would red the gate is skipped and listed instead.
 *
 * ── ROLLOUT / THE RATCHET ────────────────────────────────────────────────────────────
 * The corpus lands in batches of at most 125 manifests per PR (row rail 6), so `--check` is a
 * DOWN-ONLY ratchet, not a cliff: manifests still pending are pinned in
 * scripts/manifest-examples-baseline.json and the pending count may only fall. What is HARD in
 * every context, baseline or not: any manifest that already carries a generated key whose value
 * drifts from a fresh derivation, and any manifest carrying an example with no fixture behind it.
 *
 * Modes:
 *   node scripts/gen-manifest-examples.mjs                    report (no writes) + census
 *   node scripts/gen-manifest-examples.mjs --write [--limit N] [--only id1,id2]
 *   node scripts/gen-manifest-examples.mjs --check            drift gate + pending ratchet
 *   node scripts/gen-manifest-examples.mjs --update-baseline  re-pin the pending ceiling (writer)
 *   node scripts/gen-manifest-examples.mjs --self-test        in-memory RED/GREEN controls
 *
 * ⛔ Fence: manifests' additive keys + this file + its preflight wiring. Zero kernel bytes,
 *   chaingraph.json is READ and never written, no page edits, no derived artifacts (SO #35).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCases } from '../chaingraph/kernels/_shape.mjs';
import { deriveSchema, validateSubset } from './check-output-schema-coverage.mjs';
import { loadRatchetBaselineOrExit, readBaselineForUpdate } from './ratchet-baseline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const MAN_DIR = resolve(REPO, 'manifests');
const FIX_DIR = resolve(REPO, 'chaingraph', 'kernels', 'fixtures');
const KERNEL_DIR = resolve(REPO, 'chaingraph', 'kernels');
const CG_PATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
const BASELINE_PATH = resolve(HERE, 'manifest-examples-baseline.json');

export const AUTHOR = 'PostOakLabs';
export const LICENSE = 'CC-BY-4.0';
export const DERIVED_FROM_FIXTURE = 'fixture';

/** MCP 2026-07-28 tool annotations for the pure/local/deterministic class (see header). */
export const ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

/** The top-level keys this generator owns. Nothing else in a manifest is its business. */
export const OWNED_TOP_LEVEL_KEYS = ['author', 'license', 'input_example', 'output_example', 'example_execution_hash'];

const BASELINE_REQUIRED_KEYS = ['pending_count', { key: 'pending_ids', type: 'name-list' }];
const REPIN_COMMAND = 'node scripts/gen-manifest-examples.mjs --update-baseline';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const deepEqual = (a, b) => JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));

function canonicalize(v) {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonicalize(v[k]);
    return out;
  }
  return v;
}

// ── corpus indexing ──────────────────────────────────────────────────────────
export function loadContext(repoRoot = REPO) {
  const cg = readJson(resolve(repoRoot, 'chaingraph', 'chaingraph.json'));
  const nodes = new Map();
  for (const n of cg.nodes || []) if (n.tool_id) nodes.set(n.tool_id, n);
  return { nodes, repoRoot };
}

/** The fixture id a manifest pairs with: its declared tool_id first, its filename second. */
export function fixtureIdFor(fileId, manifest, hasFixture) {
  if (manifest?.tool_id && hasFixture(manifest.tool_id)) return manifest.tool_id;
  if (hasFixture(fileId)) return fileId;
  return null;
}

/**
 * The annotation derivation (header (a)-(c)). Pure: takes the already-resolved node record
 * and a kernel-existence predicate, so the self-test drives every branch in memory.
 * Returns { qualifies: true } or { qualifies: false, reason }.
 */
export function annotationVerdict(toolId, node, hasKernel) {
  if (!node) return { qualifies: false, reason: 'no chaingraph.json node (page-only or utility tool) — no published status/gpu signal to derive the hints from' };
  if (node.status !== 'live') return { qualifies: false, reason: `node status is ${JSON.stringify(node.status ?? null)}, not "live"` };
  if (node.gpu !== false) return { qualifies: false, reason: 'gpu is not false — SPEC.md §18.6 puts gpu:true nodes OUT OF SCOPE of the deterministic class, so idempotentHint is not derivable' };
  if (!hasKernel(toolId)) return { qualifies: false, reason: 'no chaingraph/kernels/<tool_id>.kernel.mjs — purity (no network, no side effects) is not structurally established' };
  return { qualifies: true };
}

/**
 * Plan one manifest. Pure with respect to disk apart from the injected readers, so the
 * self-test exercises the same function the writer and the gate both use.
 *
 * @returns {{ toolId:string, set:object, annotations:object|null, outputSchema:object|null,
 *             skips:string[], changed:boolean }}
 */
export function planManifest(fileId, manifest, io) {
  const { readFixture, hasFixture, node, hasKernel } = io;
  const set = { author: AUTHOR, license: LICENSE };
  const skips = [];
  const toolId = manifest?.tool_id || fileId;

  // ── examples (fixture or nothing) ──
  const fixId = fixtureIdFor(fileId, manifest, hasFixture);
  let cases = null;
  if (!fixId) {
    skips.push('no committed fixture file — no example written (absent, never invented)');
  } else {
    let fx;
    try { fx = readFixture(fixId); } catch (e) { fx = null; skips.push(`fixture unreadable: ${e.message}`); }
    if (fx) {
      try { cases = readCases(fx, `${fixId}.fixtures.json`); } catch (e) { skips.push(`fixture shape unreadable: ${e.message}`); }
    }
    const v0 = cases && cases[0];
    if (!v0) {
      if (cases) skips.push('fixture carries no vectors — no example written');
    } else if (v0.policy_parameters === undefined || v0.output_payload === undefined || typeof v0.golden_hash !== 'string') {
      // ⛔ all three or none: an example without its pinned hash is unverifiable, which is
      // the exact decorative-example failure this row exists to avoid.
      skips.push('fixture vector[0] lacks one of policy_parameters / output_payload / golden_hash — no example written');
    } else {
      set.input_example = v0.policy_parameters;
      set.output_example = v0.output_payload;
      set.example_execution_hash = v0.golden_hash;
    }
  }

  // ── annotations ──
  const verdict = annotationVerdict(toolId, node, hasKernel);
  let annotations = null;
  if (verdict.qualifies) annotations = { ...ANNOTATIONS };
  else skips.push(`no annotations: ${verdict.reason}`);

  // ── output_schema gap (only where the manifest declares none) ──
  let outputSchema = null;
  const ownsExisting = isOwnedSchema(manifest?.output_schema);
  if (!manifest?.output_schema || ownsExisting) {
    if (!cases) {
      if (!manifest?.output_schema) skips.push('output_schema gap not closed: no fixture to derive an honest schema from');
    } else {
      try {
        const derived = deriveSchema({ vectors: cases });
        const payloads = cases.map((c) => c.output_payload).filter((p) => p !== undefined);
        const errs = [];
        payloads.forEach((p, i) => validateSubset(derived, p, `output_payload#${i}`, errs));
        if (errs.length) {
          skips.push(`output_schema gap not closed: the fixture-derived schema does not validate its own fixtures (${errs[0]})`);
        } else {
          outputSchema = { ...derived, 'x-derived-from': DERIVED_FROM_FIXTURE };
        }
      } catch (e) {
        skips.push(`output_schema gap not closed: derivation failed (${e.message})`);
      }
    }
  }

  const changed = !satisfies(manifest, set, annotations, outputSchema);
  return { toolId, set, annotations, outputSchema, skips, changed };
}

/** A manifest carries an OWNED (generated) output_schema iff it bears the provenance mark. */
export function isOwnedSchema(schema) {
  return !!schema && typeof schema === 'object' && schema['x-derived-from'] === DERIVED_FROM_FIXTURE;
}

/** Does the on-disk manifest already carry exactly what the plan says it should? */
export function satisfies(manifest, set, annotations, outputSchema) {
  for (const k of OWNED_TOP_LEVEL_KEYS) {
    const want = Object.prototype.hasOwnProperty.call(set, k) ? set[k] : undefined;
    const got = manifest?.[k];
    if (want === undefined) { if (got !== undefined) return false; continue; }
    if (got === undefined || !deepEqual(got, want)) return false;
  }
  const gotAnn = manifest?.mcp_tool_definition?.annotations;
  if (annotations === null) { if (gotAnn !== undefined) return false; }
  else if (!gotAnn || !deepEqual(gotAnn, annotations)) return false;
  if (outputSchema !== null && !deepEqual(manifest?.output_schema, outputSchema)) return false;
  return true;
}

/** Apply a plan to a parsed manifest object, in place, and return it. */
export function applyPlan(manifest, plan) {
  for (const k of OWNED_TOP_LEVEL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(plan.set, k)) manifest[k] = plan.set[k];
    else delete manifest[k]; // an example whose fixture disappeared is removed, never left stale
  }
  if (plan.annotations) {
    if (!manifest.mcp_tool_definition) manifest.mcp_tool_definition = {};
    manifest.mcp_tool_definition.annotations = plan.annotations;
  } else if (manifest.mcp_tool_definition) {
    delete manifest.mcp_tool_definition.annotations;
  }
  if (plan.outputSchema) manifest.output_schema = plan.outputSchema;
  return manifest;
}

// ── corpus walk ──────────────────────────────────────────────────────────────
export function walk(repoRoot = REPO) {
  const ctx = loadContext(repoRoot);
  const manDir = resolve(repoRoot, 'manifests');
  const fixDir = resolve(repoRoot, 'chaingraph', 'kernels', 'fixtures');
  const kernelDir = resolve(repoRoot, 'chaingraph', 'kernels');
  const files = readdirSync(manDir).filter((f) => f.endsWith('.manifest.json')).sort();
  const io = {
    readFixture: (id) => readJson(resolve(fixDir, `${id}.fixtures.json`)),
    hasFixture: (id) => existsSync(resolve(fixDir, `${id}.fixtures.json`)),
    hasKernel: (id) => existsSync(resolve(kernelDir, `${id}.kernel.mjs`)),
  };
  const rows = [];
  for (const f of files) {
    const fileId = f.replace(/\.manifest\.json$/, '');
    let m;
    try { m = readJson(resolve(manDir, f)); } catch (e) {
      rows.push({ file: f, fileId, error: `invalid JSON: ${e.message}` });
      continue;
    }
    const node = ctx.nodes.get(m.tool_id) || ctx.nodes.get(fileId) || null;
    const plan = planManifest(fileId, m, { ...io, node });
    rows.push({ file: f, fileId, manifest: m, plan });
  }
  return rows;
}

function census(rows) {
  const c = {
    manifests: rows.length,
    errors: rows.filter((r) => r.error).length,
    withExamples: 0, withoutExamples: 0, withAnnotations: 0, withoutAnnotations: 0,
    outputSchemaClosed: 0, pending: [], exampleBytes: 0,
  };
  for (const r of rows) {
    if (!r.plan) continue;
    if (r.plan.set.input_example !== undefined) {
      c.withExamples++;
      c.exampleBytes += JSON.stringify(r.plan.set.input_example).length + JSON.stringify(r.plan.set.output_example).length;
    } else c.withoutExamples++;
    if (r.plan.annotations) c.withAnnotations++; else c.withoutAnnotations++;
    if (r.plan.outputSchema) c.outputSchemaClosed++;
    if (r.plan.changed) c.pending.push(r.fileId);
  }
  return c;
}

// ── --check ──────────────────────────────────────────────────────────────────
export function checkCorpus(rows, baseline) {
  const drift = [];
  const pending = [];
  for (const r of rows) {
    if (r.error) { drift.push(`${r.file}: ${r.error}`); continue; }
    const { manifest, plan } = r;
    // HARD in every context: a key that exists but disagrees with a fresh derivation.
    for (const k of OWNED_TOP_LEVEL_KEYS) {
      const got = manifest[k];
      const want = Object.prototype.hasOwnProperty.call(plan.set, k) ? plan.set[k] : undefined;
      if (got === undefined) continue;
      if (want === undefined) {
        drift.push(`${r.file}: carries ${k} with no fixture behind it — an example must be a verbatim fixture copy or absent (⛔ never invented)`);
      } else if (!deepEqual(got, want)) {
        drift.push(`${r.file}: ${k} drifted from a fresh derivation — regenerate with node scripts/gen-manifest-examples.mjs --write --only ${r.fileId}`);
      }
    }
    const gotAnn = manifest.mcp_tool_definition?.annotations;
    if (gotAnn !== undefined) {
      if (!plan.annotations) drift.push(`${r.file}: declares mcp_tool_definition.annotations but does not qualify (${plan.skips.find((s) => s.startsWith('no annotations')) || 'unqualified'})`);
      else if (!deepEqual(gotAnn, plan.annotations)) drift.push(`${r.file}: mcp_tool_definition.annotations drifted from the derived hint set`);
    }
    if (isOwnedSchema(manifest.output_schema) && plan.outputSchema && !deepEqual(manifest.output_schema, plan.outputSchema)) {
      drift.push(`${r.file}: derived output_schema drifted from a fresh fixture derivation`);
    }
    if (plan.changed) pending.push(r.fileId);
  }
  const newPending = pending.filter((id) => !baseline.pending_ids.includes(id));
  return { drift, pending, newPending };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--self-test')) { selfTest(); return; }

  const rows = walk(REPO);

  if (args.includes('--update-baseline')) {
    const prev = readBaselineForUpdate(BASELINE_PATH, BASELINE_REQUIRED_KEYS, { label: 'manifest-examples-baseline', repinCommand: REPIN_COMMAND });
    const pending = rows.filter((r) => r.plan?.changed).map((r) => r.fileId).sort();
    if (prev && pending.length > prev.pending_count) {
      console.error(`✗ refusing to raise the manifest-examples baseline: pending ${prev.pending_count} → ${pending.length}. The ratchet only goes down.`);
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify({
      _comment: 'Down-only ratchet for MANIFEST-EXAMPLES-ANNOTATIONS-1 — manifests that do not yet carry the generated example/annotation/author/license keys. The corpus lands at <=125 manifests per PR, so this ceiling falls every batch and never rises. Regenerate with: ' + REPIN_COMMAND,
      pending_count: pending.length,
      pending_ids: pending,
    }, null, 2) + '\n');
    console.log(`✓ manifest-examples baseline updated — ${pending.length} manifest(s) still pending.`);
    return;
  }

  if (args.includes('--check')) {
    const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_REQUIRED_KEYS, {
      label: 'manifest-examples-baseline', repinCommand: REPIN_COMMAND,
    });
    const { drift, pending, newPending } = checkCorpus(rows, baseline);
    const lines = [];
    if (drift.length) {
      lines.push(`✗ ${drift.length} generated-key drift(s):`);
      drift.slice(0, 25).forEach((d) => lines.push('  • ' + d));
      if (drift.length > 25) lines.push(`  … +${drift.length - 25} more`);
    }
    if (pending.length > baseline.pending_count) {
      lines.push(`✗ pending regressed: ${pending.length} manifest(s) lack the generated keys vs baseline ceiling ${baseline.pending_count}`);
    }
    if (newPending.length) {
      lines.push(`✗ ${newPending.length} manifest(s) newly missing the generated keys (not in the baseline): ${newPending.slice(0, 15).join(', ')}${newPending.length > 15 ? ', …' : ''}`);
    }
    if (lines.length) {
      console.error(lines.join('\n'));
      console.error(`\nRun: node scripts/gen-manifest-examples.mjs --write --limit 125   (then ${REPIN_COMMAND})`);
      process.exit(1);
    }
    const c = census(rows);
    console.log(`✓ manifest examples/annotations clean — ${c.manifests} manifests, ${c.withExamples} carry fixture-backed input/output examples + example_execution_hash, ${c.withoutExamples} have no fixture (absent, not invented), ${c.withAnnotations} carry MCP annotations, ${pending.length} pending (ceiling ${baseline.pending_count}), 0 drift.`);
    return;
  }

  if (args.includes('--write')) {
    const onlyIdx = args.indexOf('--only');
    const only = onlyIdx !== -1 ? args[onlyIdx + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
    const limIdx = args.indexOf('--limit');
    const limit = limIdx !== -1 ? Number(args[limIdx + 1]) : Infinity;
    if (limIdx !== -1 && (!Number.isFinite(limit) || limit <= 0)) { console.error('--limit needs a positive number'); process.exit(2); }
    let written = 0;
    for (const r of rows) {
      if (r.error || !r.plan.changed) continue;
      if (only && !only.includes(r.fileId)) continue;
      if (written >= limit) break;
      const out = applyPlan(r.manifest, r.plan);
      writeFileSync(resolve(MAN_DIR, r.file), JSON.stringify(out, null, 2) + '\n', 'utf8');
      written++;
    }
    const remaining = walk(REPO).filter((r) => r.plan?.changed).length;
    console.log(`✓ wrote ${written} manifest(s); ${remaining} still pending. Re-pin the ratchet with: ${REPIN_COMMAND}`);
    return;
  }

  // ── report ──
  const c = census(rows);
  console.log(`manifests            ${c.manifests} (${c.errors} unparseable)`);
  console.log(`fixture-backed       ${c.withExamples} would carry input_example + output_example + example_execution_hash`);
  console.log(`no fixture           ${c.withoutExamples} get NO example (absent, never invented)`);
  console.log(`annotations          ${c.withAnnotations} qualify, ${c.withoutAnnotations} do not`);
  console.log(`output_schema closed ${c.outputSchemaClosed} fixture-derived schema(s) would be written`);
  console.log(`example bytes        ${c.exampleBytes} across the corpus (describe_tool, not the list projection)`);
  console.log(`pending              ${c.pending.length}`);
  // SO #34c: the fixture corpus is LARGER than the set this generator can reach. A fixture
  // whose tool has no manifest file is not an example we declined to write — it is a manifest
  // that does not exist (NODE-COMPLETENESS-GATE-1's debt), and it must be counted, not elided.
  const manIds = new Set(rows.map((r) => r.fileId).concat(rows.map((r) => r.manifest?.tool_id).filter(Boolean)));
  const orphanFixtures = readdirSync(FIX_DIR)
    .filter((f) => f.endsWith('.fixtures.json'))
    .map((f) => f.replace(/\.fixtures\.json$/, ''))
    .filter((id) => !manIds.has(id));
  console.log(`orphan fixtures      ${orphanFixtures.length} fixture file(s) whose tool has no manifest (out of this row's reach)`);
  const reasons = new Map();
  for (const r of rows) for (const s of r.plan?.skips || []) {
    const key = s.split(' — ')[0].split(' (')[0];
    reasons.set(key, (reasons.get(key) || 0) + 1);
  }
  console.log('\nskip reasons:');
  for (const [k, v] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);
}

// ── self-test (SO #40b: the checker must be shown RED, not merely read green) ──
function selfTest() {
  const failures = [];
  const ok = (name, cond, detail) => { if (!cond) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };

  const FIXTURE = {
    tool_id: 'art-test',
    vectors: [
      { name: 'a', policy_parameters: { amount_usd: 100, mode: 'strict' }, output_payload: { verdict: 'PASS', score: 10 }, golden_hash: 'a'.repeat(64) },
      { name: 'b', policy_parameters: { amount_usd: 5, mode: 'lenient' }, output_payload: { verdict: 'FAIL', score: 1 }, golden_hash: 'b'.repeat(64) },
    ],
  };
  const io = {
    readFixture: (id) => { if (id !== 'art-test') throw new Error('no such fixture'); return FIXTURE; },
    hasFixture: (id) => id === 'art-test',
    hasKernel: (id) => id === 'art-test',
    node: { tool_id: 'art-test', status: 'live', gpu: false },
  };
  const base = () => ({ tool_id: 'art-test', mcp_tool_definition: { name: 'x', description: 'y', inputSchema: { type: 'object' } } });

  // GREEN 1 — a fixture-backed live gpu:false node gets examples, the pinned hash, and annotations.
  const p1 = planManifest('art-test', base(), io);
  ok('examples derived', deepEqual(p1.set.input_example, FIXTURE.vectors[0].policy_parameters), JSON.stringify(p1.set.input_example));
  ok('output example derived', deepEqual(p1.set.output_example, FIXTURE.vectors[0].output_payload));
  ok('example hash is the vector golden_hash', p1.set.example_execution_hash === FIXTURE.vectors[0].golden_hash);
  ok('author/license set', p1.set.author === AUTHOR && p1.set.license === LICENSE);
  ok('annotations derived', deepEqual(p1.annotations, ANNOTATIONS), JSON.stringify(p1.annotations));
  ok('output_schema derived for a gap', !!p1.outputSchema && p1.outputSchema['x-derived-from'] === 'fixture');
  ok('plan reports change', p1.plan !== false && p1.changed === true);

  // GREEN 2 — applying the plan makes satisfies() true, i.e. --write is idempotent.
  const applied = applyPlan(base(), p1);
  const p1b = planManifest('art-test', applied, io);
  ok('write is idempotent', p1b.changed === false, JSON.stringify(p1b.skips));

  // RED 1 — an invented example (no fixture) must be caught as drift, never silently accepted.
  const noFix = { ...base(), tool_id: 'art-nofixture', input_example: { invented: true }, output_example: {}, example_execution_hash: 'c'.repeat(64) };
  const pNo = planManifest('art-nofixture', noFix, { ...io, node: null });
  ok('no fixture → no example planned', pNo.set.input_example === undefined);
  const rowsNo = [{ file: 'art-nofixture.manifest.json', fileId: 'art-nofixture', manifest: noFix, plan: pNo }];
  const dNo = checkCorpus(rowsNo, { pending_count: 99, pending_ids: ['art-nofixture'] });
  ok('RED: invented example is drift', dNo.drift.some((d) => /no fixture behind it/.test(d)), JSON.stringify(dNo.drift));

  // RED 2 — a mutated example byte must red the gate (the mutation control).
  const mutated = applyPlan(base(), p1);
  mutated.output_example = { ...mutated.output_example, score: 999 };
  const rowsMut = [{ file: 'art-test.manifest.json', fileId: 'art-test', manifest: mutated, plan: planManifest('art-test', mutated, io) }];
  const dMut = checkCorpus(rowsMut, { pending_count: 99, pending_ids: [] });
  ok('RED: mutated output_example is drift', dMut.drift.some((d) => /output_example drifted/.test(d)), JSON.stringify(dMut.drift));

  // RED 3 — a GREEN corpus must produce zero drift (the control that RED 1/2 are not vacuous).
  const cleanRow = [{ file: 'art-test.manifest.json', fileId: 'art-test', manifest: applied, plan: planManifest('art-test', applied, io) }];
  const dClean = checkCorpus(cleanRow, { pending_count: 0, pending_ids: [] });
  ok('GREEN: clean corpus has no drift', dClean.drift.length === 0, JSON.stringify(dClean.drift));
  ok('GREEN: clean corpus has no pending', dClean.pending.length === 0);

  // Annotation derivation, every branch.
  ok('gpu:true does not qualify', annotationVerdict('t', { status: 'live', gpu: true }, () => true).qualifies === false);
  ok('non-live does not qualify', annotationVerdict('t', { status: 'draft', gpu: false }, () => true).qualifies === false);
  ok('kernel-less does not qualify', annotationVerdict('t', { status: 'live', gpu: false }, () => false).qualifies === false);
  ok('no node does not qualify', annotationVerdict('t', null, () => true).qualifies === false);
  ok('live+gpu:false+kernel qualifies', annotationVerdict('t', { status: 'live', gpu: false }, () => true).qualifies === true);

  // RED 4 — annotations on an unqualified tool are drift.
  const unqual = applyPlan(base(), p1);
  const pUnq = planManifest('art-test', unqual, { ...io, node: { status: 'live', gpu: true } });
  const dUnq = checkCorpus([{ file: 'art-test.manifest.json', fileId: 'art-test', manifest: unqual, plan: pUnq }], { pending_count: 9, pending_ids: ['art-test'] });
  ok('RED: annotations on an unqualified tool are drift', dUnq.drift.some((d) => /does not qualify/.test(d)), JSON.stringify(dUnq.drift));

  // RED 5 — a hand-authored output_schema (no provenance mark) is never touched or compared.
  const hand = { ...base(), output_schema: { type: 'object', properties: { verdict: { type: 'string' } } } };
  const pHand = planManifest('art-test', hand, io);
  ok('hand-authored output_schema untouched', pHand.outputSchema === null, JSON.stringify(pHand.outputSchema));

  if (failures.length) {
    console.error(`✗ gen-manifest-examples self-test FAILED — ${failures.length} control(s):`);
    failures.forEach((f) => console.error('  • ' + f));
    process.exit(1);
  }
  console.log('✓ gen-manifest-examples self-test clean — 18 controls (fixture-copy, hash pin, idempotence, annotation branches, hand-schema immunity) incl. 5 RED mutation controls.');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('gen-manifest-examples.mjs')) main();
