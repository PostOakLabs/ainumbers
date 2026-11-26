// scripts/check-obligation-page.mjs — obligation map gate O6 (page agreement).
//
// Row OBLIGATION-PAGE-1 (2026-11-17). Spec: the obligation-map build spec,
// sections 4 to 6 (workspace research; never cited in public text).
//
// What this gate family claims and does not claim:
//   It claims the page's Not covered statement equals the coverage sidecar's
//   out_of_scope list. It never claims the kernel implements an obligation
//   correctly; correctness stays with the audits, the proof and the
//   clause-binding lane (spec section 6).
//
// The "page" surface here is the generated markdown twin (<page>.md).
// OBLIGATION-PREMISE-1 (P6, PARTIAL) measured that the HTML page's only byte
// pin (check-page-kernel-digest.mjs) covers the inline kernel, not page prose,
// but a hand-authored HTML region has no main-side single writer yet, so the
// block renders into the md twin first (the spec's own fallback) and a separate
// row proves the HTML block.
//
// Artifacts it reads (all sidecars; no kernel, fixture or golden byte moves):
//   chaingraph/chaingraph.json                    live nodes (page resolution)
//   chaingraph/obligations/coverage/<node>.json   coverage file (out_of_scope)
//   <page>.md                                     the generated twin (the block)
//
// Findings, two classes (the class prefix is part of the message contract):
//   HARD:  the PR owns the defect everywhere — an unparseable coverage file, a
//          node_id that is not a live twin-scope node, a duplicate out_of_scope
//          id, a duplicated block id.
//   STALE: the twin disagrees with the sidecar (absent twin, absent block,
//          missing/extra/reordered item, reason drift). The twin is SO #35
//          single-writer output a PR must not commit, so on a PR these are
//          advisory by construction (MAINONLY-REMOVAL-ADVISORY-ON-PR-1 / the
//          MCPCARD-COUNT-ADVISORY-ON-PR-1 in-gate isMainContext() split);
//          HARD on main and on merge_group, where the twin is overlay-read
//          from the assembled tree (DERIVED_ROOT_GATES member in
//          scripts/derived-artifacts.mjs) and derived-artifacts-regen.yml has
//          already rewritten it.
//
// Comparison semantics: ordered (id, reason) equality, whitespace-normalized
// on both sides. A reason the renderer's humanize() would rewrite (an em-dash,
// a double-hyphen) fails the equality on main BY DESIGN: the coverage file's
// reason must be page-safe prose, and the PR that adds it owns the fix.
//
// Exit 0 green (advisory warnings allowed on a PR), 1 any hard red.
// Selftest: scripts/check-obligation-page.selftest.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, '..');

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

/**
 * Parse the Not covered section out of a twin's markdown.
 * Returns null when the twin has no `## Not covered` heading; otherwise
 * { items: [{id, reason}], dups: [id, ...] }. List lines are exactly what
 * renderObligationBlock emits: `- O<n>: <reason>`. Prose under the heading
 * (the section's intro line) is not a list line and is ignored; the next
 * `## ` heading ends the section.
 */
export function parseNotCovered(md) {
  if (md === null || md === undefined) return null;
  const lines = String(md).split('\n');
  const start = lines.findIndex((l) => l.trim() === '## Not covered');
  if (start === -1) return null;
  const items = [];
  const seen = new Set();
  const dups = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^## /.test(l)) break;
    const m = /^- (O[0-9]+): (.+)$/.exec(l.trim());
    if (!m) continue;
    if (seen.has(m[1])) dups.push(m[1]);
    seen.add(m[1]);
    items.push({ id: m[1], reason: norm(m[2]) });
  }
  return { items, dups };
}

/** Expected items from a coverage file: ordered out_of_scope as {id, reason}. */
export function expectedNotCovered(cov) {
  return (Array.isArray(cov && cov.out_of_scope) ? cov.out_of_scope : [])
    .filter((o) => o && o.id)
    .map((o) => ({ id: o.id, reason: norm(o.reason) }));
}

/**
 * O6 for one node: the twin's Not covered list equals the coverage file's
 * out_of_scope list. Returns problems with class prefixes (HARD:/STALE:).
 * twinMd is the twin's text, or null when the twin file is absent.
 */
export function checkO6(cov, twinMd) {
  const problems = [];
  const expected = expectedNotCovered(cov);
  const expIds = expected.map((o) => o.id);
  for (const d of expIds.filter((x, i) => expIds.indexOf(x) !== i)) {
    problems.push(`HARD: coverage out_of_scope lists ${d} more than once`);
  }
  const parsed = parseNotCovered(twinMd);
  if (expected.length === 0 && !parsed) return problems; // nothing owed on either side
  if (twinMd === null || twinMd === undefined) {
    problems.push(`STALE: twin missing on disk but coverage lists ${expected.length} out-of-scope obligation(s) (${expIds.join(', ')})`);
    return problems;
  }
  if (parsed && parsed.dups.length) {
    problems.push(`HARD: twin Not covered block lists ${parsed.dups.join(', ')} more than once`);
  }
  const blockItems = parsed ? parsed.items : [];
  if (JSON.stringify(blockItems) !== JSON.stringify(expected)) {
    if (!parsed) {
      problems.push(`STALE: twin has no Not covered block but coverage lists ${expected.length} obligation(s) (${expIds.join(', ')})`);
    } else {
      const missing = expected.filter((e) => !blockItems.some((b) => b.id === e.id));
      const extra = blockItems.filter((b) => !expected.some((e) => e.id === b.id));
      const drift = expected.filter((e) => blockItems.some((b) => b.id === e.id && b.reason !== e.reason));
      const parts = [];
      if (missing.length) parts.push(`twin is missing ${missing.map((x) => x.id).join(', ')}`);
      if (extra.length) parts.push(`twin has extra ${extra.map((x) => x.id).join(', ')}`);
      if (drift.length) parts.push(`reason drift on ${drift.map((x) => x.id).join(', ')}`);
      if (!parts.length) parts.push('same items in a different order');
      problems.push(`STALE: twin Not covered block != coverage out_of_scope (${parts.join('; ')})`);
    }
  }
  return problems;
}

/**
 * Context split (pure; the selftest pins both sides). main = everything
 * blocks; PR = STALE twin findings downgrade to advisory, HARD stays hard.
 */
export function disposition(problems, mainContext) {
  if (mainContext) return [problems, []];
  const blocking = problems.filter((p) => !p.startsWith('STALE:'));
  const advisory = problems.filter((p) => p.startsWith('STALE:'));
  return [blocking, advisory];
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const root = argv.includes('--root') ? resolve(argv[argv.indexOf('--root') + 1]) : DEFAULT_ROOT;
  // derivedResolve only on real runs: a --root fixture tree is resolved against
  // itself, never the real repo's DERIVED_ROOT overlay.
  let resolveArtifact = (rel) => join(root, rel);
  let mainContext = true; // fail closed before the real context probe below
  if (!argv.includes('--root')) {
    const { isMainContext, derivedResolve } = await import('./derived-artifacts.mjs');
    mainContext = isMainContext();
    resolveArtifact = (rel) => derivedResolve(rel);
  }

  const coverageDir = join(root, 'chaingraph', 'obligations', 'coverage');
  const problems = [];
  let files = [];
  try {
    files = readdirSync(coverageDir).filter((f) => f.endsWith('.json')).sort();
  } catch { /* no coverage dir yet */ }

  if (files.length) {
    let registry = null;
    try {
      registry = JSON.parse(readFileSync(resolveArtifact('chaingraph/chaingraph.json'), 'utf8'));
    } catch (e) {
      console.error(`O6 HARD: chaingraph.json does not read: ${e.message}`);
      process.exit(1);
    }
    const pageByTool = new Map();
    for (const n of registry.nodes ?? []) {
      if (n.status !== 'live' || !n.tool_id || !n.url) continue;
      try {
        const pageRel = decodeURIComponent(new URL(n.url).pathname).replace(/^\//, '');
        if (pageRel.startsWith('tools/') || pageRel.startsWith('chaingraph/')) pageByTool.set(n.tool_id, pageRel);
      } catch { /* bad url — the registry gates own that shape */ }
    }

    for (const f of files) {
      let cov;
      try {
        cov = JSON.parse(readFileSync(join(coverageDir, f), 'utf8'));
      } catch (e) {
        problems.push(`HARD: coverage file ${f} does not parse: ${e.message}`);
        continue;
      }
      const nid = cov && cov.node_id;
      if (typeof nid !== 'string' || !nid.trim()) {
        problems.push(`HARD: coverage file ${f} has no node_id`);
        continue;
      }
      const pageRel = pageByTool.get(nid);
      if (!pageRel) {
        problems.push(`HARD: coverage file ${f} names node ${nid}, which is not a live twin-scope node in chaingraph.json`);
        continue;
      }
      const twinRel = pageRel.replace(/\.html$/, '.md');
      const twinPath = resolveArtifact(twinRel);
      let twinMd = null;
      if (existsSync(twinPath)) {
        try {
          twinMd = readFileSync(twinPath, 'utf8');
        } catch (e) {
          problems.push(`HARD: twin ${twinRel} does not read: ${e.message}`);
          continue;
        }
      }
      for (const p of checkO6(cov, twinMd)) problems.push(`${p} [${f} -> ${twinRel}]`);
    }
  }

  const [blocking, advisory] = disposition(problems, mainContext);
  for (const p of advisory) {
    console.log(`::warning::O6 ${p} (advisory on a PR: the twin is main-side single-writer output; derived-artifacts-regen.yml rewrites it after merge)`);
  }
  if (blocking.length) {
    console.error(`check-obligation-page (O6): ${blocking.length} blocking problem(s):`);
    for (const p of blocking) console.error(`  ${p}`);
    process.exit(1);
  }
  const staleness = problems.length - blocking.length;
  console.log(`O6 OK: ${files.length} coverage file(s) checked, Not covered block(s) equal out_of_scope list(s)${staleness ? ` (${staleness} twin-staleness finding(s) advisory on this PR)` : ''}.`);
  process.exit(0);
}

if (process.argv[1] && basename(process.argv[1]) === 'check-obligation-page.mjs' && !process.argv.includes('--selftest-only')) {
  await main();
}
