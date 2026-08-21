#!/usr/bin/env node
/**
 * check-pageless-consistency.mjs — SSOT gate for OCG Standard §NODEPAGE-1.
 *
 * `pageless` is a WAIVER: a node declaring it asserts "I have no composer page of my
 * own". §NODEPAGE-1 makes that assertion machine-checked instead of taken on trust.
 *
 * THE RULE (§NODEPAGE-1.3): a node that declares `pageless` while a page it OWNS
 * exists is a FALSE DECLARATION and a HARD FAIL. art-662 declared `pageless` while
 * `tools/662-odnsf-fee-recompute.html` existed and its own `url` pointed straight at
 * it; every shard-level check was blind to it, the assembled catalog was invalid, and
 * `main` carried an unregistered node that redded every site PR. A machine could have
 * caught that instantly from the filesystem, so it must.
 *
 * SO #34 (INDEPENDENT DERIVATION): this gate never reads the node's own claim about
 * whether it has a page. It RECOMPUTES page existence from the primary source — the
 * filesystem (the PR tree), falling back to `git cat-file -e origin/main:<path>` for a
 * page that has already landed. The only thing read from the artifact under test is the
 * declaration being validated (`pageless`) and the address to re-resolve (`url`).
 *
 * SO #34c (ABSENCE IS NOT A PASS): a `pageless` key present with a non-string or empty
 * value is its own distinct FAIL state, never silently ignored.
 *
 * SINGLE DEFINITION: `resolveOwnPage()` below is the ONE definition of "does this node
 * own a page". `scripts/check-node-complete.mjs` axis (d) imports it rather than
 * carrying a second copy, so the axis that ACCEPTS the waiver and the gate that POLICES
 * it can never drift apart.
 *
 * Usage:
 *   node chaingraph/standard/check-pageless-consistency.mjs              sweep every node shard + the assembled catalog
 *   node chaingraph/standard/check-pageless-consistency.mjs <art-id>     one node shard
 *   node chaingraph/standard/check-pageless-consistency.mjs --quiet      only report violations and the summary line
 *
 * Zero-dependency. Non-zero exit blocks. Wired into scripts/preflight.mjs and named in
 * the SPEC.md §15 conformance-gate matrix (so spec-gate-coverage.mjs enforces it exists).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Repo root inferred from this file's landed location: chaingraph/standard/ -> repo root. */
export const REPO_ROOT = resolve(HERE, '..', '..');

const NODES_SUBDIR = ['chaingraph', 'graph', 'nodes'];
const CATALOG_SUBPATH = ['chaingraph', 'chaingraph.json'];

/**
 * Strip an absolute https:// origin off a node `url`, yielding a repo-relative path.
 * Mirrors the catalog convention every other gate uses (catalog-parity.mjs, check-node-complete.mjs).
 * @param {unknown} url
 * @returns {string|null}
 */
export function urlToRelPath(url) {
  if (typeof url !== 'string' || !url) return null;
  const m = url.match(/^https?:\/\/[^/]+\/(.+)$/);
  return m ? m[1] : url.replace(/^\/+/, '');
}

function fileExistsOnOriginMain(repoRoot, relPath) {
  try {
    execFileSync('git', ['cat-file', '-e', `origin/main:${relPath}`], {
      cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * THE single definition of "this node owns a page", recomputed from the filesystem.
 *
 * A node owns a page when either candidate resolves to a real file, in the PR tree or
 * on origin/main:
 *   (A) the canonical node-page path `chaingraph/<tool_id>.html`; or
 *   (B) its own `url`, when that url addresses an `.html` file under `chaingraph/` or
 *       `tools/` (NODE-COMPLETENESS-PAGEAXIS-1: a tools/-hosted page is a node page too).
 *
 * @param {string} repoRoot absolute path to the repo root
 * @param {string} id node id (shard filename stem / tool_id)
 * @param {Record<string, unknown>|null|undefined} node shard or catalog nodes[] entry
 * @returns {{rel: string, via: string, where: string}|null} the resolved page, or null
 */
export function resolveOwnPage(repoRoot, id, node) {
  const candidates = [];
  if (id) candidates.push({ rel: `chaingraph/${id}.html`, via: 'canonical node-page path' });
  const rel = urlToRelPath(node?.url);
  if (rel && /\.html$/.test(rel) && (rel.startsWith('chaingraph/') || rel.startsWith('tools/'))) {
    candidates.push({ rel, via: `own url ${node.url}` });
  }
  for (const c of candidates) {
    if (existsSync(resolve(repoRoot, c.rel))) return { ...c, where: 'PR tree' };
    if (fileExistsOnOriginMain(repoRoot, c.rel)) return { ...c, where: 'origin/main' };
  }
  return null;
}

/**
 * §NODEPAGE-1.3 consistency verdict for one node.
 *
 * @param {string} repoRoot
 * @param {string} id
 * @param {Record<string, unknown>|null|undefined} node
 * @returns {{status: 'PASS'|'FAIL'|'N-A', reason: string, detail: string}}
 */
export function checkPageless(repoRoot, id, node) {
  const declared = !!node && Object.prototype.hasOwnProperty.call(node, 'pageless');
  if (!declared) {
    return { status: 'N-A', reason: 'not-declared', detail: 'no pageless declaration (the default)' };
  }
  const value = node.pageless;
  if (typeof value !== 'string' || !value.trim()) {
    // SO #34c: a malformed declaration is a DISTINCT fail state, never a silent skip.
    return {
      status: 'FAIL',
      reason: 'malformed-declaration',
      detail: `pageless is ${JSON.stringify(value)} — §NODEPAGE-1.2 requires a non-empty prose reason string.`,
    };
  }
  const page = resolveOwnPage(repoRoot, id, node);
  if (page) {
    return {
      status: 'FAIL',
      reason: 'false-declaration',
      detail: `declares pageless but owns a page: ${page.rel} (${page.via}) exists in the ${page.where}. `
        + '§NODEPAGE-1.3 — drop the pageless key, or delete the page; a node may not claim both.',
    };
  }
  return {
    status: 'PASS',
    reason: 'consistent',
    detail: `no page owned (neither chaingraph/${id}.html nor a chaingraph//tools/ url target exists) — waiver: "${value}"`,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────
function readJson(path) {
  try { return { ok: true, value: JSON.parse(readFileSync(path, 'utf8')) }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function main(argv) {
  const quiet = argv.includes('--quiet');
  const singleId = argv.find((a) => !a.startsWith('--'));
  const nodesDir = resolve(REPO_ROOT, ...NODES_SUBDIR);
  const catalogPath = resolve(REPO_ROOT, ...CATALOG_SUBPATH);

  /** @type {Array<{id: string, node: any, origin: string}>} */
  const subjects = [];
  const errors = [];

  if (existsSync(nodesDir)) {
    const files = readdirSync(nodesDir).filter((f) => f.endsWith('.json')).sort();
    for (const f of files) {
      const id = f.slice(0, -5);
      if (singleId && id !== singleId) continue;
      const r = readJson(resolve(nodesDir, f));
      if (!r.ok) {
        // SO #34c: unevaluable is its own state, never a pass.
        errors.push(`✗ ${id}: shard does not parse as JSON (${r.error}) — cannot evaluate §NODEPAGE-1.`);
        continue;
      }
      subjects.push({ id, node: r.value, origin: `chaingraph/graph/nodes/${f}` });
    }
  }

  if (!singleId && existsSync(catalogPath)) {
    const r = readJson(catalogPath);
    if (!r.ok) errors.push(`✗ chaingraph.json does not parse as JSON (${r.error}) — cannot evaluate §NODEPAGE-1.`);
    else for (const n of r.value?.nodes ?? []) {
      if (n && typeof n.tool_id === 'string') subjects.push({ id: n.tool_id, node: n, origin: 'chaingraph/chaingraph.json' });
    }
  }

  if (singleId && subjects.length === 0) {
    console.error(`check-pageless-consistency: no shard chaingraph/graph/nodes/${singleId}.json.`);
    return 2;
  }

  let declaredCount = 0;
  for (const s of subjects) {
    const v = checkPageless(REPO_ROOT, s.id, s.node);
    if (v.status === 'N-A') continue;
    declaredCount++;
    if (v.status === 'FAIL') errors.push(`✗ ${s.id} (${s.origin}) [${v.reason}]: ${v.detail}`);
    else if (!quiet) console.log(`✓ ${s.id} (${s.origin}): ${v.detail}`);
  }

  console.log(
    `\ncheck-pageless-consistency · ${subjects.length} node record(s) inspected · `
    + `${declaredCount} carry a pageless declaration · ${errors.length} violation(s).`,
  );
  if (errors.length) {
    for (const e of errors) console.error(e);
    console.error('\n§NODEPAGE-1.3: pageless declares the ABSENCE of a page this node owns. '
      + 'A declaration made while the page exists is false, and this gate recomputes page '
      + 'existence from the filesystem rather than trusting the declaration.');
    return 1;
  }
  console.log('✓ every pageless declaration is consistent with the filesystem (§NODEPAGE-1.3).');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
