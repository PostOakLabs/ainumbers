#!/usr/bin/env node
// gen-clause-edge-report.mjs — CLAUSE-EDGE-TYPES-1 (SPEC.md §28 / §28.1 / §28.2).
//
// A regulation-to-regulation relationship graph over §28.1 pinned citation objects, distinct
// from §28's own purpose. §28 pins a citation to a COMPUTATION (citation -> calc, via
// clause_bindings[] pointers into policy_parameters/output_payload). This report is
// citation -> citation: does one cited instrument amend, reference, repeal, or merely mention
// another? That vocabulary does not exist in the corpus today as a structured field, EXCEPT
// §28.1's own `superseded_by` (a {scheme,id} reference), which is repeal/supersession-shaped —
// reused here as the `repeals` edge type rather than duplicated as a parallel concept.
//
// READ-ONLY. Sweeps chaingraph/graph/nodes/*.json (the assembled per-node shard files, the
// only place real minted §28.1 citation objects live today — chaingraph.json's node index
// carries no citation data, and kernel .kernel.mjs source is pre-mint declaration, not the
// built graph). Never writes to any of those files.
//
// SHIPS AS A DEFECT-FINDER, NEVER A COVERAGE PERCENTAGE (memory project-ainumbers-clause-math-mapping,
// applied verbatim). Output is a bounded, honest, re-runnable list: typed edges found (today: those
// declared via `superseded_by`) and orphaned/unclassified citations (every pinned citation with no
// declared relationship), each attributed to its `mapped_by` owner. The list grows or shrinks as the
// corpus changes; it never becomes a "we track N% of amendments" claim.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const NODES_DIR = join(ROOT, 'chaingraph', 'graph', 'nodes');
const OUT_DIR = join(ROOT, 'chaingraph', 'clause-edges');
const OUT_FILE = join(OUT_DIR, 'index.json');
const CHECK = process.argv.includes('--check');

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCitation = (v) => isObj(v) && typeof v.scheme === 'string' && typeof v.id === 'string' && typeof v.mapped_by === 'string';
const citationKey = (c) => `${c.scheme}::${c.id}`;

// RFC 6901-shaped pointer, built the same way §28.2's clause_bindings pointers are.
function escapeToken(t) { return String(t).replace(/~/g, '~0').replace(/\//g, '~1'); }

/** Recursively find every §28.1-shaped citation object reachable from `node`, with its pointer. */
function findCitations(value, pointer, out) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => findCitations(v, `${pointer}/${i}`, out));
    return;
  }
  if (!isObj(value)) return;
  if (isCitation(value)) {
    out.push({ pointer, citation: value });
    return; // a citation object's own members (uri, path, superseded_by) are not themselves citations
  }
  for (const k of Object.keys(value)) findCitations(value[k], `${pointer}/${escapeToken(k)}`, out);
}

function sweep() {
  const files = readdirSync(NODES_DIR).filter((f) => f.endsWith('.json')).sort();
  const sites = []; // one entry per pointer where a citation object is declared
  for (const file of files) {
    const toolId = file.replace(/\.json$/, '');
    let doc;
    try {
      doc = JSON.parse(readFileSync(join(NODES_DIR, file), 'utf8'));
    } catch (e) {
      continue; // a malformed shard is a different gate's finding, not this report's
    }
    const found = [];
    findCitations(doc, '', found);
    for (const { pointer, citation } of found) sites.push({ tool_id: toolId, pointer, citation });
  }
  return sites;
}

/** Collapse per-pointer sites into one record per unique (scheme,id) clause, keeping every site
 *  that cites it — the same clause pinned at two pointers (e.g. a citations map entry and the
 *  duty_results entry that echoes it) is one clause, cited from two places, not two clauses. */
function collapseClauses(sites) {
  const byKey = new Map();
  for (const s of sites) {
    const key = citationKey(s.citation);
    if (!byKey.has(key)) {
      byKey.set(key, {
        scheme: s.citation.scheme,
        id: s.citation.id,
        mapped_by: s.citation.mapped_by,
        mapped_at: s.citation.mapped_at ?? null,
        superseded_by: s.citation.superseded_by ?? null,
        cited_from: [],
      });
    }
    byKey.get(key).cited_from.push({ tool_id: s.tool_id, pointer: s.pointer });
  }
  return [...byKey.values()];
}

/** §28's own `superseded_by` field is the one typed relationship the corpus can already declare —
 *  reused verbatim as a `repeals` edge (a citation superseded by another is the repeal/supersession
 *  case) rather than inventing a parallel concept. `amends`/`references`/`mentions` have no
 *  structured field yet anywhere in the standard, so they can only ever be found here, never assumed. */
function buildEdges(clauses) {
  const edges = [];
  for (const c of clauses) {
    if (c.superseded_by && c.superseded_by.scheme && c.superseded_by.id) {
      edges.push({
        type: 'repeals',
        from: { scheme: c.scheme, id: c.id },
        to: { scheme: c.superseded_by.scheme, id: c.superseded_by.id },
        mapped_by: c.mapped_by,
        mapped_at: c.mapped_at,
      });
    }
  }
  return edges;
}

function buildOrphans(clauses, edges) {
  const inEdge = new Set();
  for (const e of edges) {
    inEdge.add(`${e.from.scheme}::${e.from.id}`);
    inEdge.add(`${e.to.scheme}::${e.to.id}`);
  }
  return clauses
    .filter((c) => !inEdge.has(citationKey(c)))
    .map((c) => ({
      scheme: c.scheme,
      id: c.id,
      mapped_by: c.mapped_by,
      mapped_at: c.mapped_at,
      cited_from: c.cited_from,
    }));
}

function main() {
  const generatedAt = process.env.CLAUSE_EDGE_REPORT_TIMESTAMP ?? new Date().toISOString();
  const sites = sweep();
  const clauses = collapseClauses(sites);
  const edges = buildEdges(clauses);
  const orphans = buildOrphans(clauses, edges);

  const report = {
    generated_at: generatedAt,
    vocabulary: ['amends', 'references', 'repeals', 'mentions'],
    note: 'Defect-finder over pinned SPEC.md §28.1 citation objects in chaingraph/graph/nodes/*.json. '
      + 'edges[] lists every citation-to-citation relationship the corpus currently declares (today: '
      + '`repeals`, reused from §28.1 superseded_by). orphans[] lists every pinned citation with no '
      + 'declared relationship, attributed to its mapped_by owner. Neither array is a coverage figure: '
      + 'both grow or shrink as kernels adopt the vocabulary, and an empty edges[] is not a defect in '
      + 'this tool; it means no kernel has declared a typed relationship yet.',
    clauses_swept: clauses.length,
    edges,
    orphans,
  };

  if (CHECK) {
    let onDisk;
    try {
      onDisk = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
    } catch {
      console.error('gen-clause-edge-report --check: chaingraph/clause-edges/index.json missing or unreadable, run `node scripts/gen-clause-edge-report.mjs`');
      process.exit(1);
    }
    const { generated_at: _a, ...onDiskRest } = onDisk;
    const { generated_at: _b, ...reportRest } = report;
    if (JSON.stringify(onDiskRest) !== JSON.stringify(reportRest)) {
      console.error('gen-clause-edge-report --check: chaingraph/clause-edges/index.json is stale, run `node scripts/gen-clause-edge-report.mjs`');
      process.exit(1);
    }
    console.log(`gen-clause-edge-report --check: OK, ${clauses.length} clauses swept, ${edges.length} edge(s), ${orphans.length} orphan(s).`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  // GENERATOR-NOOP-STABILITY-1: write ONLY on a genuine content change, preserving the
  // prior generated_at when nothing substantive moved. Identical predicate to the
  // --check branch above, which already excludes generated_at — before this, --check
  // reported "OK" while a re-run still rewrote the file with a fresh wall-clock stamp,
  // so gate and writer disagreed about what "current" meant, and every SO #28 regen put
  // chaingraph/clause-edges/index.json (and, downstream, chaingraph/clause-edge-report.html,
  // which renders this very stamp) into conflict with every sibling PR.
  let priorReport = null;
  try { priorReport = JSON.parse(readFileSync(OUT_FILE, 'utf8')); } catch { /* missing/unparseable -> write fresh */ }
  const substantive = (r) => { const { generated_at: _s, ...rest } = r; return JSON.stringify(rest); };
  if (priorReport && substantive(priorReport) === substantive(report)) {
    console.log(`gen-clause-edge-report: swept ${clauses.length} clause(s) from ${NODES_DIR}, found ${edges.length} typed edge(s), ${orphans.length} orphan(s). Unchanged — chaingraph/clause-edges/index.json left untouched.`);
    return;
  }
  writeFileSync(OUT_FILE, JSON.stringify(report, null, 2) + '\n');
  console.log(`gen-clause-edge-report: swept ${clauses.length} clause(s) from ${NODES_DIR}, found ${edges.length} typed edge(s), ${orphans.length} orphan(s). Wrote chaingraph/clause-edges/index.json`);
}

main();
