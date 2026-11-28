// _hub-categories.mjs — one loader for the hub category grouping (HUB-CATEGORIES-DERIVE-1).
//
// chaingraph/hub-categories.json holds only the rarely-edited cluster metadata:
//   { clusterTitle: { order, blurb } }
// Membership lives one file per node at chaingraph/hub-categories/<tool_id>.json
//   { "category": "<clusterTitle>" }
// so a new-node PR adds its own file and never edits a file another PR also edits.
// (A category field on the node shard was ruled out: shard bytes flow verbatim into
// chaingraph.json, so a new field would move the single-writer assembled file.)
//
// loadHubCategories() returns the legacy shape { clusterTitle: { order, blurb, art_ids } }
// with art_ids derived (sorted) from the per-node files, so readers stay one-line changes.
//
// HUB-AUTOSWEEP-SSOT-1 adds the topic SSOT's second axis, decided in
// research/HUB-AUTOSWEEP-SCOPING-2026-11-27.md §1 (two-level, same file pair, no new
// file family):
//   per-node   chaingraph/hub-categories/<tool_id>.json  "hubs": ["<slug>", ...]
//              (or "hubs": [] + "hub_exempt": "<reason>" — the explicit opt-out)
//   cluster    chaingraph/hub-categories.json            "hub": "<slug>" (optional default;
//              owned by HUB-AUTOSWEEP-CLUSTER-MAP-1, so absent until that row lands)
// resolveNodeHubs() is the one reader of those keys; loadHubCategories() above keeps
// destructuring only `category`, so its output is unchanged by any of this.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function hubCategoriesPaths(repo = DEFAULT_REPO) {
  return {
    meta: resolve(repo, 'chaingraph', 'hub-categories.json'),
    dir: resolve(repo, 'chaingraph', 'hub-categories'),
  };
}

export function loadHubCategories(repo = DEFAULT_REPO) {
  const { meta, dir } = hubCategoriesPaths(repo);
  const clusters = JSON.parse(readFileSync(meta, 'utf8'));
  const out = {};
  for (const [title, c] of Object.entries(clusters)) out[title] = { ...c, art_ids: [] };
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const id = f.slice(0, -'.json'.length);
      const { category } = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
      if (!out[category]) {
        throw new Error(`chaingraph/hub-categories/${f}: category "${category}" is not a key in chaingraph/hub-categories.json`);
      }
      out[category].art_ids.push(id);
    }
  }
  return out;
}

// ── hub-slug resolution (HUB-AUTOSWEEP-SSOT-1) ──────────────────────────────
// A hub slug is the <slug> of repo/guides/<slug>-hub.html (the site contract hub
// path rule), so it is lowercase/digits with single inner hyphens — reject
// anything else at the resolver boundary, not at some downstream gate.
export const HUB_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Resolve every per-node membership file to its guides-hub topic slugs.
 *
 * Returns Map(tool_id -> { hubs: string[], source, exempt_reason? }) over the
 * per-node files in chaingraph/hub-categories/ (a node with no per-node file is
 * absent from the map — CG-HUB-BARE-NUMBER-NODES-1 creates those files). source is:
 *   'node'    the per-node "hubs" key is present and non-empty — it wins over the
 *             cluster default (cross-listed nodes, Islamic-finance-style topics)
 *   'cluster' no per-node "hubs" key, but the cluster in chaingraph/hub-categories.json
 *             carries "hub" — the default sweeps the whole cluster onto one topic
 *   'exempt'  "hubs": [] with a non-empty "hub_exempt" reason — the explicit opt-out
 *             (internal demonstrators, mcp.html-url nodes)
 *   'none'    nothing set anywhere — unresolved
 *
 * Throws (fail closed — bad data must not silently resolve):
 *   - "hubs" present but not an array
 *   - any slug (per-node or cluster) that fails HUB_SLUG_RE
 *   - "hubs": [] without a non-empty "hub_exempt" string
 *   - unknown category (same rule loadHubCategories() enforces)
 * A stray "hub_exempt" alongside non-empty "hubs" is ignored: the non-empty list is
 * the stronger statement, and inventing a throw for it would red trees this row never
 * saw. Callers needing liveness combine this with scripts/_node-status.mjs — this
 * stays a file-pair reader and never touches the assembled chaingraph.json.
 */
export function resolveNodeHubs(repo = DEFAULT_REPO) {
  const { meta, dir } = hubCategoriesPaths(repo);
  const clusters = JSON.parse(readFileSync(meta, 'utf8'));
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const id = f.slice(0, -'.json'.length);
    const doc = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
    if (!clusters[doc.category]) {
      throw new Error(`chaingraph/hub-categories/${f}: category "${doc.category}" is not a key in chaingraph/hub-categories.json`);
    }
    out.set(id, resolveHubEntry(f, doc, clusters[doc.category]));
  }
  return out;
}

function resolveHubEntry(file, doc, cluster) {
  if (Object.prototype.hasOwnProperty.call(doc, 'hubs')) {
    if (!Array.isArray(doc.hubs)) {
      throw new Error(`chaingraph/hub-categories/${file}: "hubs" must be an array of hub slugs (got ${typeof doc.hubs})`);
    }
    // Dedupe while preserving order — a doubled slug carries no extra topic.
    const hubs = [...new Set(doc.hubs)];
    for (const slug of hubs) {
      if (typeof slug !== 'string' || !HUB_SLUG_RE.test(slug)) {
        throw new Error(`chaingraph/hub-categories/${file}: "${slug}" is not a valid hub slug — it must match ${HUB_SLUG_RE} because it names guides/<slug>-hub.html`);
      }
    }
    if (hubs.length) return { hubs, source: 'node' };
    const reason = doc.hub_exempt;
    if (typeof reason !== 'string' || reason.trim() === '') {
      throw new Error(`chaingraph/hub-categories/${file}: "hubs": [] requires a non-empty "hub_exempt" string stating why the node belongs to no guides hub`);
    }
    return { hubs: [], source: 'exempt', exempt_reason: reason };
  }
  const hub = cluster && cluster.hub;
  if (typeof hub === 'string' && hub.length > 0) {
    if (!HUB_SLUG_RE.test(hub)) {
      throw new Error(`chaingraph/hub-categories.json: cluster "${doc.category}" carries hub "${hub}", which is not a valid slug — it must match ${HUB_SLUG_RE} because it names guides/<slug>-hub.html`);
    }
    return { hubs: [hub], source: 'cluster' };
  }
  return { hubs: [], source: 'none' };
}
