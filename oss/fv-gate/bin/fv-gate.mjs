#!/usr/bin/env node
// fv-gate — single-verb CLI wrapping the property-test-floor runner + coverage/freshness ratchet
// extracted from ainumbers' repo/scripts/run-proptests.mjs + repo/scripts/check-fv-floor-coverage.mjs.
// EXTRACTION, not construction: the pure logic (proptests.mjs, coverage.mjs, digest.mjs) is preserved
// verbatim from the CI-live originals. This file is the new part — one command, flags instead of two
// separate scripts + hand-diffed manifests, emitting a schema'd receipt (schema/receipt.schema.json)
// and a SARIF log alongside the same pass/fail semantics.
//
// USAGE (one verb — invoking the binary IS the action, no subcommand tree):
//   fv-gate [--kernels-dir DIR] [--proptests-dir DIR] [--meta-path FILE] [--nodes-dir DIR]
//           [--kernel-ext .kernel.mjs] [--proptest-ext .proptest.mjs]
//           [--baseline FILE] [--update-baseline]
//           [--out-json FILE] [--out-sarif FILE] [--summary] [--list-unfloored]
//
// Defaults match ainumbers' own layout (chaingraph/kernels, chaingraph/kernels/__proptests__,
// chaingraph/chaingraph.meta.json, chaingraph/graph/nodes) so this package parity-checks directly
// against the scripts it was extracted from. Any repo with a different layout overrides the flags.
// If --meta-path/--nodes-dir resolve to nothing, coverage/ratchet is skipped (proptests-only mode) —
// the floor runner alone has no dependency on a node-graph layout, so a bare proptests directory is
// enough to use this package standalone.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findPropertyFiles, runAll } from '../lib/proptests.mjs';
import { evaluateCoverage, findProvenanceViolations } from '../lib/coverage.mjs';
import { sourceDigest } from '../lib/digest.mjs';
import { buildSarif } from '../lib/sarif.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(readFileSync(resolve(HERE, '..', 'package.json'), 'utf8'));
const CWD = process.cwd();

function flag(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
function has(name) {
  return process.argv.includes(`--${name}`);
}

const KERNELS_DIR = resolve(CWD, flag('kernels-dir', 'chaingraph/kernels'));
const PROPTESTS_DIR = resolve(CWD, flag('proptests-dir', `${flag('kernels-dir', 'chaingraph/kernels')}/__proptests__`));
const META_PATH = resolve(CWD, flag('meta-path', 'chaingraph/chaingraph.meta.json'));
const NODES_DIR = resolve(CWD, flag('nodes-dir', 'chaingraph/graph/nodes'));
const KERNEL_EXT = flag('kernel-ext', '.kernel.mjs');
const PROPTEST_EXT = flag('proptest-ext', '.proptest.mjs');
const BASELINE_PATH = resolve(CWD, flag('baseline', 'fv-gate-baseline.json'));
const UPDATE_BASELINE = has('update-baseline');
const OUT_JSON = flag('out-json', null);
const OUT_SARIF = flag('out-sarif', null);
const SUMMARY = has('summary');
const LIST_UNFLOORED = has('list-unfloored');

function deriveLiveKernels() {
  if (!existsSync(META_PATH) || !existsSync(NODES_DIR)) {
    return { liveKernels: null, note: `no node-graph layout found (meta: ${META_PATH}, nodes: ${NODES_DIR}) — proptests-only mode` };
  }
  const meta = JSON.parse(readFileSync(META_PATH, 'utf8'));
  const orderIds = meta.order?.nodes ?? [];
  const live = [];
  for (const id of orderIds) {
    const shardPath = resolve(NODES_DIR, `${id}.json`);
    if (!existsSync(shardPath)) continue;
    let node;
    try { node = JSON.parse(readFileSync(shardPath, 'utf8')); } catch { continue; }
    if (node.status !== 'live') continue;
    const tool_id = node.tool_id || id;
    if (!existsSync(resolve(KERNELS_DIR, `${tool_id}${KERNEL_EXT}`))) continue;
    live.push({ tool_id, name: node.mcp_name || tool_id });
  }
  return { liveKernels: live, note: null };
}

async function main() {
  // ── stage 1: proptest floor runner ──────────────────────────────────────────────
  const files = findPropertyFiles(PROPTESTS_DIR, PROPTEST_EXT);
  if (files.length === 0) {
    console.log(`fv-gate: 0 property files found in ${PROPTESTS_DIR} — no-op PASS.`);
  } else {
    console.log(`fv-gate: running ${files.length} property file(s)...`);
  }
  const proptestResults = runAll(files, CWD);
  for (const r of proptestResults) {
    console.log(`  [${r.ok ? 'PASS' : 'FAIL'}] ${r.file}`);
    if (!r.ok) {
      if (r.spawnError) console.log(`    spawn error: ${r.spawnError}`);
      if (r.stderr?.trim()) console.log(`    stderr:\n${indent(r.stderr)}`);
    }
  }
  const proptestsFailed = proptestResults.filter((r) => !r.ok);

  // ── stage 2: coverage + freshness ratchet (skipped in proptests-only mode) ─────
  const { liveKernels, note } = deriveLiveKernels();
  let coverage = null;
  let coverageFailed = false;
  let ratchet = { baseline_ceiling: null, regressions: [], new_unfloored: [] };

  if (liveKernels !== null) {
    function readKernelSource(tool_id) {
      const p = resolve(KERNELS_DIR, `${tool_id}${KERNEL_EXT}`);
      return existsSync(p) ? readFileSync(p, 'utf8') : null;
    }
    function readFloorSource(tool_id) {
      const p = resolve(PROPTESTS_DIR, `${tool_id}${PROPTEST_EXT}`);
      return existsSync(p) ? readFileSync(p, 'utf8') : null;
    }
    coverage = await evaluateCoverage(liveKernels, readKernelSource, readFloorSource, sourceDigest);

    if (UPDATE_BASELINE) {
      const oldBaseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : null;
      const { regressions, newUnfloored } = oldBaseline ? findProvenanceViolations(coverage.unfloored, oldBaseline) : { regressions: [], newUnfloored: [] };
      if (regressions.length || newUnfloored.length) {
        console.error('fv-gate: --update-baseline REFUSED — provenance violation(s) present, a baseline rewrite must never absorb these silently:');
        for (const r of regressions) console.error(`  REGRESSION: ${r.name} — ${r.reason}`);
        for (const r of newUnfloored) console.error(`  NEW-UNFLOORED: ${r.name} — ${r.reason}`);
        process.exitCode = 1;
        return;
      }
      const baseline = {
        _comment: 'Ratchet ceiling for fv-gate. Counts only go DOWN. known_live_nodes is the provenance snapshot the regression/new-unfloored discriminators read.',
        unfloored: coverage.unfloored.length,
        unfloored_nodes: coverage.unfloored.map((r) => r.name).sort(),
        known_live_nodes: liveKernels.map((k) => k.name).sort(),
      };
      writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
      console.log(`fv-gate: baseline written to ${BASELINE_PATH}`);
      process.exitCode = 0;
      return;
    }

    if (SUMMARY || LIST_UNFLOORED) {
      console.log(`fv-gate coverage — live: ${coverage.total} | floored: ${coverage.floored.length} | unfloored: ${coverage.unfloored.length}`);
      if (LIST_UNFLOORED) for (const r of coverage.unfloored) console.log(`  ${r.state.toUpperCase()}: ${r.name} — ${r.reason}`);
    }

    if (existsSync(BASELINE_PATH)) {
      const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
      const ceiling = baseline.unfloored ?? Infinity;
      ratchet.baseline_ceiling = baseline.unfloored ?? null;
      const { regressions, newUnfloored } = findProvenanceViolations(coverage.unfloored, baseline);
      ratchet.regressions = regressions.map((r) => r.name);
      ratchet.new_unfloored = newUnfloored.map((r) => r.name);
      if (regressions.length) {
        coverageFailed = true;
        console.error(`fv-gate: FLOOR REGRESSION — ${regressions.map((r) => r.name).join(', ')}`);
      }
      if (newUnfloored.length) {
        coverageFailed = true;
        console.error(`fv-gate: NEW-UNFLOORED — ${newUnfloored.map((r) => r.name).join(', ')}`);
      }
      if (coverage.unfloored.length > ceiling) {
        coverageFailed = true;
        console.error(`fv-gate: ratchet FAILED — unfloored ${coverage.unfloored.length} > baseline ceiling ${ceiling}`);
      }
    } else {
      console.error(`fv-gate: no baseline at ${BASELINE_PATH} — run --update-baseline to pin the ratchet (not blocking).`);
    }
  } else if (SUMMARY) {
    console.log(`fv-gate: ${note}`);
  }

  const pass = proptestsFailed.length === 0 && !coverageFailed;

  // ── receipt + SARIF ─────────────────────────────────────────────────────────────
  const receipt = {
    schema_version: 'fv-gate-receipt-v1',
    tool: { name: 'fv-gate', version: PKG.version },
    generated_at: new Date().toISOString(),
    proptests: {
      total: proptestResults.length,
      passed: proptestResults.length - proptestsFailed.length,
      failed: proptestsFailed.length,
      files: proptestResults.map((r) => ({ file: relish(r.file), ok: r.ok, status: r.status })),
    },
    coverage: coverage
      ? {
          total: coverage.total,
          floored: coverage.floored.length,
          unfloored: coverage.unfloored.length,
          unfloored_nodes: coverage.unfloored.map((r) => ({ name: r.name, state: r.state, reason: r.reason })),
          ratchet,
        }
      : null,
    pass,
    sarif_path: OUT_SARIF ? relish(OUT_SARIF) : null,
  };

  if (OUT_JSON) {
    writeFileSync(resolve(CWD, OUT_JSON), JSON.stringify(receipt, null, 2) + '\n');
    console.log(`fv-gate: wrote receipt to ${OUT_JSON}`);
  }
  if (OUT_SARIF) {
    const sarif = buildSarif({ proptestResults, coverageUnfloored: coverage?.unfloored ?? [] });
    writeFileSync(resolve(CWD, OUT_SARIF), JSON.stringify(sarif, null, 2) + '\n');
    console.log(`fv-gate: wrote SARIF to ${OUT_SARIF}`);
  }

  console.log(pass ? '\nfv-gate: PASS' : '\nfv-gate: FAIL');
  process.exitCode = pass ? 0 : 1;
}

function indent(s) {
  return s.trimEnd().split('\n').map((l) => `      ${l}`).join('\n');
}
function relish(p) {
  return String(p).startsWith(CWD) ? p.slice(CWD.length + 1).replace(/\\/g, '/') : String(p).replace(/\\/g, '/');
}

main();
