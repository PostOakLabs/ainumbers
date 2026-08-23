#!/usr/bin/env node
/**
 * scripts/_node-status.mjs — GENERATOR-STATUS-FILTER-1.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ONE definition of "has this node left service?", shared by every generator
 * that used to discover content by FILE PRESENCE.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT THIS CLOSES (0xAlpha 2026-08-23 deprecation-residue audit §4).
 * Four generators advertise a node by finding its FILE:
 *
 *   gen-chaingraph-hub.mjs   filtered on URL SHAPE  (`url.includes('/chaingraph/art-')`)
 *   gen-start-index.mjs      directory glob of tools/ + URL shape for nodes
 *   regen-sitemap.mjs        filesystem walk of every published dir
 *   gen-euc-register.mjs     emitted live-only but NEVER DELETED, so a departed
 *                            node's entry file outlived its own liveness
 *
 * A node that leaves service KEEPS ITS FILE, so all four kept publishing it.
 * The sitemap case proves file-presence can never be the right liveness test:
 * ART99-GHOST-CLEANUP-1 deliberately RETAINS art-99's page as a retirement stub
 * so a rebuilt successor can inherit the URL. The file legitimately remains
 * while the node is not live. Only the SHARD's `status` field can answer.
 *
 * ── WHY ONE MODULE AND NOT FOUR PRIVATE COPIES ──────────────────────────────
 * SO #57's lesson one level up: six private copies of the git-env scrub existed
 * before the sweep, each correct, none general — so the seventh reintroduced the
 * bug. Four private status filters would drift the same way (one would default a
 * missing status differently, one would forget the tools/ half). This module is
 * the single writer of the predicate; the generators consume it.
 *
 * ── THE DEFAULT IS DELIBERATE AND ASYMMETRIC ────────────────────────────────
 * `isNonLive()` returns true ONLY for an EXPLICIT, non-`live` status string. A
 * node with NO status field is treated as live, i.e. NOT dropped.
 *
 *   ⛔ This is not SO #34c's "absence is not a pass" inverted. That order governs
 *      gates asserting a VERDICT. This predicate authorises a REMOVAL, and the
 *      two failure modes are not symmetric: keeping a departed URL one extra
 *      push is the cosmetic bug this row fixes, whereas silently deleting a LIVE
 *      node's sitemap URL, hub card and search entry on a missing field is a
 *      real, silent outage of the estate's own discovery surfaces.
 *   ⛔ Absence is also already impossible: `status` is required by
 *      chaingraph/standard/openchain-graph-v0.4.schema.json and enforced by
 *      schema-validate.mjs, so this default can only ever fire on a tree whose
 *      schema gate is ALREADY red. It is a floor, not a policy.
 *
 * ── SCOPE: CURRENT-STATE PROJECTIONS ONLY (PR #1494) ────────────────────────
 * ⛔ `registry/lineage` and `registry/errata` are APPEND-ONLY and MUST NEVER be
 *    filtered or pruned by anything in this module's blast radius. Status
 *    filtering applies to current-state projections — the sitemap, the hub, the
 *    start-page search index, the EUC register — never to a historical ledger.
 *    Nothing here reads either directory; this note exists so the next widening
 *    of this module has to type a refusal rather than forget a rule.
 *
 * Zero-dep, pure, no filesystem beyond the one chaingraph.json read in
 * loadStatusLens(). No git children (so scripts/_git-env-lib.mjs is not needed).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Canonical public origin every node `url` is written against, with trailing slash. */
export const SITE_BASE = 'https://ainumbers.co/';

/** The one status string that means "in service". */
export const LIVE = 'live';

/**
 * TRUE only for an explicit, non-`live` status. A missing/blank status is NOT
 * non-live — see the header's asymmetry note before changing this.
 * @param {{status?: string}} node
 */
export function isNonLive(node) {
  const s = node?.status;
  return typeof s === 'string' && s.length > 0 && s !== LIVE;
}

/** The complement of isNonLive(): everything this estate still advertises. */
export function isLive(node) {
  return !isNonLive(node);
}

/**
 * Repo-relative page path for a node, derived from its `url`, or null when the
 * node declares no on-site page (pageless nodes, external urls).
 * `https://ainumbers.co/chaingraph/art-99-x.html` -> `chaingraph/art-99-x.html`
 * @param {{url?: string}} node
 */
export function nodePagePath(node) {
  const url = node?.url;
  if (typeof url !== 'string' || !url.startsWith(SITE_BASE)) return null;
  const rel = url.slice(SITE_BASE.length).split('#')[0].split('?')[0];
  return rel.length ? rel : null;
}

/**
 * Build the lens from an already-parsed chaingraph object.
 *
 * @param {{nodes?: any[]}} cg
 * @returns {{
 *   nonLivePaths: Set<string>,
 *   statusByPath: Map<string,string>,
 *   nonLiveNodes: any[],
 *   isNonLivePath: (rel: string) => boolean,
 *   isNonLiveNode: (node: any) => boolean,
 *   liveNodes: any[],
 * }}
 */
export function buildStatusLens(cg) {
  const nodes = Array.isArray(cg?.nodes) ? cg.nodes : [];
  const nonLiveNodes = nodes.filter(isNonLive);
  const liveNodes = nodes.filter(isLive);
  const nonLivePaths = new Set();
  const statusByPath = new Map();
  for (const n of nodes) {
    const rel = nodePagePath(n);
    if (!rel) continue;
    statusByPath.set(rel, n.status ?? LIVE);
    if (isNonLive(n)) nonLivePaths.add(rel);
  }
  return {
    nonLivePaths,
    statusByPath,
    nonLiveNodes,
    liveNodes,
    // Normalised so a caller may hand us `tools/x.html` or `./tools/x.html` or a
    // Windows-separator path without each generator inventing its own cleanup.
    isNonLivePath: (rel) => nonLivePaths.has(normalizeRel(rel)),
    isNonLiveNode: (node) => isNonLive(node),
  };
}

/** `.\tools\x.html` / `/tools/x.html` -> `tools/x.html`. Pure. */
export function normalizeRel(rel) {
  return String(rel ?? '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * Read chaingraph.json from a repo root and build the lens.
 * @param {string} repoRoot absolute path to the site repo root
 */
export function loadStatusLens(repoRoot) {
  const cg = JSON.parse(readFileSync(resolve(repoRoot, 'chaingraph', 'chaingraph.json'), 'utf8'));
  return buildStatusLens(cg);
}
