#!/usr/bin/env node
/**
 * scripts/gen-declared-outputs.mjs — DECLARED-OUTPUTS-SYNC-1.
 *
 * THE SINGLE WRITER for `output_schema` in repo/manifests/*.manifest.json.
 *
 * ⛔ THE DEFECT THIS CLOSES. A manifest's `output_schema` is the ONLY surface that
 * tells an MCP client what a node's `structuredContent` contains (CONTRACT §2.7 —
 * the worker's generate.mjs projects it verbatim). It was hand-typed, so it drifted:
 * OUTPUTSCHEMA-GAP-1's own baseline pinned 16 live-node manifests with no
 * `output_schema` at all and 265 whose declared schema its fixtures no longer
 * satisfy. Every one of those is an agent-facing lie — a promised key the node
 * never emits, or an emitted key the client was never told about.
 *
 * ⭐ THE SSOT IS THE FIXTURES, NEVER A HAND-TYPED LIST. A node's declared outputs
 * are DERIVED from the `output_payload` of its pinned conformance vectors — the
 * same bytes `golden-parity.test.mjs` hashes, so an output_payload that is not what
 * the kernel actually emits is already a RED gate before this generator ever runs.
 * That is why the derivation is honest without executing the kernel here: the
 * corpus is pinned to executed output by a hard gate one layer down.
 *
 * ⛔ NO SECOND CANON (SO #34, and CONTRACT's one-hash-path precedent). The
 * derivation function is IMPORTED from scripts/check-output-schema-coverage.mjs —
 * the AGENT-REACH-BUILD-SPEC §3.10 deriver that already backs that gate's
 * `--derive` advice line. Writer and checker therefore cannot drift: the gate that
 * validates the schema and the generator that writes it compute it with the same
 * code. Re-implementing §3.10's enum/required rules here is exactly the
 * two-implementations-of-one-rule shape those orders forbid.
 *
 * ⚖ SCOPE — live nodes (status==='live' && mcp_name && tool_id, the worker's own
 * predicate) that have BOTH a manifest and a fixtures file. Out of scope, each
 * reported and owned elsewhere:
 *   · live node with no manifest        → NODE-COMPLETENESS-GATE-1 / MFSTGEN-1
 *                                         (scripts/generate-node-manifest.mjs)
 *   · manifest with no fixtures         → nothing to derive FROM. It is marked
 *                                         `declared_outputs_status: "no-fixtures"`
 *                                         by the manifest generator so the gap stays
 *                                         visible; ⛔ never given a fabricated schema.
 *
 * ⛔ RED BEFORE GREEN (SO #34c / #40(b)). `--check` was observed RED on a fresh
 * origin/main worktree BEFORE the first `--write`; the failing run is quoted in the
 * PR body. A gate only ever seen green has not been observed at all.
 *
 * Usage:
 *   node scripts/gen-declared-outputs.mjs --check   # gate: exit 1 on any drift
 *   node scripts/gen-declared-outputs.mjs --write   # refresh every in-scope manifest
 *   node scripts/gen-declared-outputs.mjs --list    # print the drifting tool_ids
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSchema, liveNodes } from './check-output-schema-coverage.mjs';
import { assertDenominatorOrExit } from './denominator-sentinel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_PATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
const MAN_DIR = resolve(REPO, 'manifests');
const FIX_DIR = resolve(REPO, 'chaingraph', 'kernels', 'fixtures');

// The floor the scope guarantees. Live nodes carrying both a manifest and a
// fixtures file are the estate's overwhelming majority; if this population
// collapses, the generator would silently rewrite nothing and report success
// (DENOMINATOR-SENTINEL-1's "0 of 0 passed"). Derived floors are preferred, but
// there is no primary source for "nodes with both artifacts" that is not this same
// walk, so the floor is pinned CONSERVATIVELY LOW — it catches a scope collapse
// (a moved manifests/ dir, a renamed fixtures/ dir, a chaingraph.json that stopped
// parsing) without pretending to ratchet the population.
const SCOPE_FLOOR = 400;

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const stable = (v) => JSON.stringify(v);

/**
 * The in-scope population, resolved once and shared by every mode so `--check`
 * and `--write` can never disagree about what they cover.
 * Returns { covered: [{tool_id, manPath, fixPath}], noFixtures: [id], noManifest: [id] }.
 */
export function population({ cg, manDir = MAN_DIR, fixDir = FIX_DIR } = {}) {
  const covered = [], noFixtures = [], noManifest = [];
  for (const n of liveNodes(cg)) {
    const manPath = resolve(manDir, n.tool_id + '.manifest.json');
    const fixPath = resolve(fixDir, n.tool_id + '.fixtures.json');
    if (!existsSync(manPath)) { noManifest.push(n.tool_id); continue; }
    if (!existsSync(fixPath)) { noFixtures.push(n.tool_id); continue; }
    covered.push({ tool_id: n.tool_id, manPath, fixPath });
  }
  return { covered, noFixtures: noFixtures.sort(), noManifest: noManifest.sort() };
}

/**
 * Rewrite a manifest object's `output_schema` IN PLACE in key order.
 * ⛔ Never `{...m, output_schema}` — that moves the member to the end of the file
 * and turns a one-key semantic change into a whole-file reorder in review. A NEW
 * member lands immediately after `input_schema` (the template's position), falling
 * back to just before `mcp_tool_definition`, then to the end.
 */
export function withOutputSchema(manifest, schema) {
  const out = {};
  const keys = Object.keys(manifest);
  if (keys.includes('output_schema')) {
    for (const k of keys) out[k] = k === 'output_schema' ? schema : manifest[k];
    return out;
  }
  const anchor = keys.includes('input_schema') ? 'input_schema'
    : keys.includes('mcp_tool_definition') ? 'mcp_tool_definition'
      : null;
  let placed = false;
  for (const k of keys) {
    if (k === 'mcp_tool_definition' && anchor === 'mcp_tool_definition' && !placed) {
      out.output_schema = schema; placed = true;
    }
    out[k] = manifest[k];
    if (k === 'input_schema' && anchor === 'input_schema' && !placed) {
      out.output_schema = schema; placed = true;
    }
  }
  if (!placed) out.output_schema = schema;
  return out;
}

/** Per-node verdict: null when the declared schema already equals the derived one. */
function driftOf({ tool_id, manPath, fixPath }) {
  let manifest, fixtures;
  try { manifest = readJson(manPath); } catch (e) { return { tool_id, reason: `manifest does not parse: ${e.message}` }; }
  try { fixtures = readJson(fixPath); } catch (e) { return { tool_id, reason: `fixtures do not parse: ${e.message}` }; }
  let derived;
  try { derived = deriveSchema(fixtures); } catch (e) { return { tool_id, reason: `cannot derive: ${e.message}` }; }
  if (!manifest.output_schema) return { tool_id, reason: 'no output_schema declared', manifest, derived };
  if (stable(manifest.output_schema) !== stable(derived)) {
    return { tool_id, reason: 'declared output_schema differs from the fixtures-derived one', manifest, derived };
  }
  return null;
}

function main() {
  const mode = process.argv.includes('--write') ? 'write'
    : process.argv.includes('--list') ? 'list'
      : 'check';
  const cg = readJson(CG_PATH);
  const { covered, noFixtures, noManifest } = population({ cg });

  assertDenominatorOrExit(covered.length, SCOPE_FLOOR, {
    label: 'gen-declared-outputs',
    unit: 'live node(s) with a manifest and fixtures',
    scope: `${MAN_DIR} × ${FIX_DIR}, keyed by live chaingraph.json tool_id`,
    remedy: 'manifests/ or chaingraph/kernels/fixtures/ moved, or chaingraph.json lost its live nodes — restore with: git checkout origin/main -- manifests chaingraph',
  });

  const drift = covered.map(driftOf).filter(Boolean);

  if (mode === 'list') {
    console.log(drift.length ? drift.map((d) => `${d.tool_id}\t${d.reason}`).join('\n') : '(none — every in-scope manifest matches its fixtures)');
    return;
  }

  if (mode === 'write') {
    let written = 0, blocked = 0;
    for (const d of drift) {
      if (!d.derived) { console.error(`✗ ${d.tool_id}: ${d.reason}`); blocked++; continue; }
      const target = covered.find((c) => c.tool_id === d.tool_id);
      writeFileSync(target.manPath, JSON.stringify(withOutputSchema(d.manifest, d.derived), null, 2) + '\n');
      written++;
    }
    console.log(`✓ output_schema refreshed in ${written} manifest(s) from their fixtures; ${covered.length - drift.length} already current; ${blocked} unwritable (see above).`);
    console.log(`  out of scope: ${noFixtures.length} live manifest(s) with no fixtures to derive from, ${noManifest.length} live node(s) with no manifest (MFSTGEN-1's axis).`);
    if (blocked) process.exit(1);
    return;
  }

  // ── gate path ──
  if (drift.length) {
    console.error(`✗ ${drift.length} manifest(s) declare outputs that do not match their fixtures' output_payload:`);
    drift.slice(0, 20).forEach((d) => console.error(`    ${d.tool_id}: ${d.reason}`));
    if (drift.length > 20) console.error(`    … +${drift.length - 20} more (full list: --list)`);
    console.error('\nThe fixtures are the SSOT for what a node emits. Refresh with: node scripts/gen-declared-outputs.mjs --write');
    process.exit(1);
  }
  console.log(`✓ declared outputs in sync — ${covered.length} live manifest(s) match their fixtures' output_payload; ${noFixtures.length} live manifest(s) have no fixtures (out of scope), ${noManifest.length} live node(s) have no manifest (MFSTGEN-1's axis).`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) main();
