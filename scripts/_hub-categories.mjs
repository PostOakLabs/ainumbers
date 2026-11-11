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
