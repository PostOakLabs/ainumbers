#!/usr/bin/env node
/**
 * check-citation-drift.mjs — CITATION-DRIFT-GATE-1 (kernel audit A.15 + drift prevention).
 *
 * SCOPE: numbers, NOT formulas. Formula-checking (does compute() correctly IMPLEMENT a
 * clause) is out of scope and unsound to automate here -- that is SIDEBYSIDE's job (SO #39).
 * This gate catches a narrower, purely mechanical subset: a pinned numeric constant that a
 * node attributes to a specific clause citation, where that citation's own excerpt text does
 * not actually contain the number.
 *
 * TWO INDEPENDENT CHECKS:
 *   1. Digest resolution (CI-checkable, no snapshot needed): every cited_clause_digest[]
 *      entry across chaingraph/graph/nodes/*.json must resolve in
 *      chaingraph/standard/clause-snapshot-registry.json and carry a retrieved_at date.
 *   2. Value match (LOCAL ONLY): a small hand-curated table of citation-derived numeric
 *      constants (scripts/citation-drift-declared-values.json -- the "declared cited_values
 *      map" the row describes, kept here rather than in the node/kernel files since this
 *      gate only READS those) is checked against the specific clause excerpt each entry
 *      names. The excerpt bodies live at workspace-root research/clause-snapshots/ (NOT in
 *      this repo -- copyright; see chaingraph/standard/pin-clause-snapshot.mjs), so this
 *      check requires a workspace checkout, not a bare repo clone.
 *
 * CI vs LOCAL split (SO #34c -- absence is not a pass): CI clones only this repo, so
 * workspace-root research/clause-snapshots/ does not exist there. In that shape, check 2 is
 * reported as SKIPPED-NO-SNAPSHOT for every declared entry -- never counted as a pass. Check
 * 1 runs identically in both shapes; it needs nothing outside this repo.
 *
 * BASELINE (scripts/citation-drift-baseline.json): a ratchet, same shape as
 * copy-hallmarks-baseline.json. Findings already in the baseline are shielded (printed, not
 * failing) -- ADVISORY for the pre-existing debt the A.15 audit found. Any finding NOT in the
 * baseline is a NEW regression and fails the gate -- BLOCKING for everything else. Burn the
 * baseline down with --update as findings get fixed; a baselined key that stops reproducing
 * is reported so it can be dropped, never silently re-pinned.
 *
 * Usage:
 *   node scripts/check-citation-drift.mjs            # gate (preflight + CI)
 *   node scripts/check-citation-drift.mjs --update    # regenerate the baseline from current findings
 */
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

// Workspace root is ONE level up from a primary checkout (AINumbers/repo) but TWO (or more)
// levels up from a worktree (AINumbers/.wt/<row>/, AINumbers/.worktrees/<row>/,
// AINumbers/.claude/worktrees/<row>/ per board/STANDING-ORDERS.md #3) -- a fixed single
// `resolve(REPO, '..')` silently mis-locates research/clause-snapshots/ from any worktree
// session and downgrades LOCAL mode to CI/degraded with no signal (measured while building
// this gate: it happened on the first run). Walk ancestors instead of assuming a depth.
const MAX_ANCESTOR_WALK = 6;
export function findSnapshotDir(startDir) {
  let dir = startDir;
  for (let i = 0; i < MAX_ANCESTOR_WALK; i++) {
    const candidate = resolve(dir, 'research', 'clause-snapshots');
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
const SNAPSHOT_DIR = findSnapshotDir(REPO);
const REGISTRY_PATH = resolve(REPO, 'chaingraph', 'standard', 'clause-snapshot-registry.json');
const NODES_DIR = resolve(REPO, 'chaingraph', 'graph', 'nodes');
const DECLARED_VALUES_PATH = resolve(HERE, 'citation-drift-declared-values.json');
export const BASELINE_PATH = resolve(HERE, 'citation-drift-baseline.json');

const UPDATE = process.argv.includes('--update');

export function isLocalMode() {
  return SNAPSHOT_DIR !== null;
}

export function sha256Hex(buf) {
  return 'sha256:' + createHash('sha256').update(buf).digest('hex');
}

export function loadRegistry() {
  const map = new Map();
  if (!existsSync(REGISTRY_PATH)) return map;
  const arr = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  for (const e of arr) map.set(e.digest, e);
  return map;
}

export function loadCitedNodes() {
  const out = [];
  if (!existsSync(NODES_DIR)) return out;
  for (const f of readdirSync(NODES_DIR)) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(readFileSync(join(NODES_DIR, f), 'utf8'));
    if (Array.isArray(j.cited_clause_digest) && j.cited_clause_digest.length > 0) out.push(j);
  }
  return out;
}

/** digest -> excerpt text, built by hashing every file under workspace-root
 *  research/clause-snapshots/ the same way pin-clause-snapshot.mjs does. Empty map in CI shape. */
export function buildSnapshotTextMap() {
  const map = new Map();
  if (!isLocalMode()) return map;
  for (const name of readdirSync(SNAPSHOT_DIR)) {
    const p = join(SNAPSHOT_DIR, name);
    if (!statSync(p).isFile()) continue;
    const buf = readFileSync(p);
    map.set(sha256Hex(buf), buf.toString('utf8'));
  }
  return map;
}

const UNIT_LABEL = { pct: '%', pp: 'pp', usd: '$' };

export function valueSearchVariants(value, unit) {
  if (unit === 'pct') return [`${value}%`, `${value} percent`];
  if (unit === 'pp') return [`${value}pp`, `${value} pp`, `${value} percentage point`];
  if (unit === 'usd') {
    const n = Number(value);
    return [String(value), n.toLocaleString('en-US'), '$' + n.toLocaleString('en-US')];
  }
  return [String(value)];
}

/** Pure: given the loaded registry/nodes/declared list and (maybe empty) snapshot text map,
 *  return the full findings list. Exported so the self-test can drive it without touching disk. */
export function computeFindings({ registry, nodes, declared, snapshotText, localMode }) {
  const findings = [];

  // Check 1: digest resolution + retrieved_at -- CI-checkable, needs no snapshot text.
  for (const node of nodes) {
    for (const c of node.cited_clause_digest) {
      const base = `${node.tool_id}::digest::${c.digest}`;
      if (!registry.has(c.digest)) {
        findings.push({
          key: base,
          kind: 'UNRESOLVED_DIGEST',
          message: `${node.tool_id}: cited_clause_digest ${c.digest} (clause_path "${c.clause_path}") does not resolve in the clause-snapshot registry`,
        });
        continue;
      }
      if (!c.retrieved_at) {
        findings.push({
          key: `${base}::retrieved_at`,
          kind: 'MISSING_RETRIEVED_AT',
          message: `${node.tool_id}: cited_clause_digest ${c.digest} (clause_path "${c.clause_path}") has no retrieved_at date`,
        });
      }
    }
  }

  // Check 2: declared-value match -- LOCAL only. SKIPPED-NO-SNAPSHOT in CI, never a pass.
  for (const d of declared) {
    const key = `${d.tool_id}::value::${d.field}`;
    if (!localMode) {
      findings.push({ key, kind: 'SKIPPED_NO_SNAPSHOT', message: `${d.tool_id}: ${d.field} value-match skipped (no workspace-root research/clause-snapshots/ in this checkout)` });
      continue;
    }
    const node = nodes.find((n) => n.tool_id === d.tool_id);
    if (!node) {
      findings.push({ key, kind: 'DECLARED_NODE_MISSING', message: `declared value references unknown tool_id ${d.tool_id}` });
      continue;
    }
    if (!registry.has(d.digest)) {
      findings.push({ key, kind: 'DECLARED_DIGEST_UNRESOLVED', message: `${d.tool_id}: declared value's digest ${d.digest} does not resolve in the registry` });
      continue;
    }
    const text = snapshotText.get(d.digest);
    if (text === undefined) {
      findings.push({ key, kind: 'SNAPSHOT_MISSING_LOCALLY', message: `${d.tool_id}: digest ${d.digest} is registered but no local file under research/clause-snapshots/ hashes to it` });
      continue;
    }
    const variants = valueSearchVariants(d.value, d.unit);
    const found = variants.some((v) => text.includes(v));
    if (!found) {
      findings.push({
        key,
        kind: 'VALUE_NOT_IN_CITED_TEXT',
        message: `${d.tool_id}: ${d.field}=${d.value}${UNIT_LABEL[d.unit] ?? ''} is attributed to clause_path "${d.clause_path}" (digest ${d.digest}) but none of [${variants.join(', ')}] appears in that excerpt`,
      });
    }
  }

  return findings;
}

// Gate body runs only when executed directly, never on import (so computeFindings() etc. are
// safely unit-testable without a full repo scan / process.exit side effect).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const localMode = isLocalMode();
  const registry = loadRegistry();
  const nodes = loadCitedNodes();
  const declared = existsSync(DECLARED_VALUES_PATH) ? JSON.parse(readFileSync(DECLARED_VALUES_PATH, 'utf8')) : [];
  const snapshotText = buildSnapshotTextMap();

  const findings = computeFindings({ registry, nodes, declared, snapshotText, localMode });
  const skipped = findings.filter((f) => f.kind === 'SKIPPED_NO_SNAPSHOT');
  const real = findings.filter((f) => f.kind !== 'SKIPPED_NO_SNAPSHOT');

  if (UPDATE) {
    const baseline = { known_findings: real.map((f) => f.key) };
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`check-citation-drift: baseline updated, ${real.length} known finding(s) shielded.`);
    process.exit(0);
  }

  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : { known_findings: [] };
  const shielded = new Set(baseline.known_findings || []);

  const newFailures = real.filter((f) => !shielded.has(f.key));
  const stillKnown = real.filter((f) => shielded.has(f.key));
  const fixed = [...shielded].filter((k) => !real.some((f) => f.key === k));

  console.log(`check-citation-drift: mode=${localMode ? 'LOCAL (full value-match)' : 'CI (degraded, metadata-only)'}.`);
  console.log(`check-citation-drift: ${nodes.length} cited node(s), ${declared.length} declared value(s)` + (skipped.length ? `, ${skipped.length} SKIPPED-NO-SNAPSHOT (not a pass, SO #34c).` : '.'));

  if (stillKnown.length) {
    console.log(`check-citation-drift: ${stillKnown.length} known/baselined finding(s) (advisory -- pre-existing A.15 audit debt):\n  ` + stillKnown.map((f) => `[${f.kind}] ${f.message}`).join('\n  '));
  }
  if (fixed.length) {
    console.log(`check-citation-drift: ${fixed.length} baselined finding(s) no longer reproduce -- burn down with --update:\n  ` + fixed.join('\n  '));
  }
  if (newFailures.length) {
    console.error(`\ncheck-citation-drift: ${newFailures.length} NEW FAILURE(s) -- citation drift not yet baselined:\n  ` + newFailures.map((f) => `[${f.kind}] ${f.message}`).join('\n  '));
    console.error(`\nEach names a pinned numeral that does not appear in the clause text it is attributed to. Fix the citation or the number (never the kernel's compute() -- this gate only reads it), or if this is pre-existing known debt, re-run with --update to baseline it.`);
    process.exit(1);
  }
  console.log(`check-citation-drift: OK (${shielded.size} baselined finding(s) within budget, 0 new).`);
}
