#!/usr/bin/env node
/**
 * repoint-domain.mjs — repoint canonical URLs from the non-resolving openchain.graph
 * domain to the live ainumbers.co/chaingraph base (decision: Option B).
 *
 * openchain.graph does not serve content (verified empty). The files actually deploy to
 * ainumbers.co/chaingraph/ via DreamHost. This makes every @context / profile / namespace
 * URL dereferenceable.
 *
 * Path-aware, ORDERED rules (all gated on the https://ainumbers.co/chaingraph/ prefix, so the
 * media-type vendor tree `application/vnd.openchain.graph+json` is NEVER touched):
 *   1. https://ainumbers.co/chaingraph/context/      -> https://ainumbers.co/chaingraph/context/
 *        (contexts deploy under /chaingraph/context/vX/; also covers #vocab + buildType identifiers)
 *   2. https://ainumbers.co/chaingraph/profiles/  -> https://ainumbers.co/chaingraph/profiles/
 *   3. https://ainumbers.co/chaingraph/           -> https://ainumbers.co/chaingraph/   (root catch-all)
 *
 * NOTE: hash preimage unchanged — @context / namespace / buildType are all outside it.
 * buildType identifier string changes value (…/spec/v0.2# -> …/chaingraph/context/v0.2#);
 * it is an opaque algorithm identifier and never resolved, so this is safe. Verifiers that
 * matched the old string should treat buildType leniently (spec §1 default rule).
 *
 * Usage:
 *   node chaingraph/repoint-domain.mjs            # dry-run: per-file counts, write nothing
 *   node chaingraph/repoint-domain.mjs --apply    # rewrite in place
 *
 * Idempotent. Walks repo/chaingraph (html/json/jsonld/mjs/md, excl. okf/ which is regenerated)
 * and the sibling mcp-apps-poc/worker.mjs.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));        // repo/chaingraph
const REPO = dirname(HERE);                                  // repo
const APPLY = process.argv.includes('--apply');

// Ordered, longest-prefix-first. Each gated on https://ainumbers.co/chaingraph/.
// The two profile rules also append .jsonld so the canonical URI dereferences to the
// served PROF document on static hosting (same convention as context.jsonld).
const RULES = [
  ['https://ainumbers.co/chaingraph/profiles/iso20022/pacs.008-subset.jsonld',     'https://ainumbers.co/chaingraph/profiles/iso20022/pacs.008-subset.jsonld'],
  ['https://ainumbers.co/chaingraph/profiles/iso20022/party-identification.jsonld','https://ainumbers.co/chaingraph/profiles/iso20022/party-identification.jsonld'],
  ['https://ainumbers.co/chaingraph/context/',     'https://ainumbers.co/chaingraph/context/'],
  ['https://ainumbers.co/chaingraph/profiles/', 'https://ainumbers.co/chaingraph/profiles/'],
  ['https://ainumbers.co/chaingraph/',          'https://ainumbers.co/chaingraph/'],
];

const EXTS = new Set(['.html', '.json', '.jsonld', '.mjs', '.md']);
const SKIP_DIRS = new Set(['okf', 'node_modules', '.git']); // okf/ is regenerated, not edited

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

function repoint(text) {
  let out = text, n = 0;
  for (const [from, to] of RULES) {
    const parts = out.split(from);
    if (parts.length > 1) { n += parts.length - 1; out = parts.join(to); }
  }
  return { out, n };
}

const files = [
  ...walk(HERE),
  join(REPO, '..', 'mcp-apps-poc', 'worker.mjs'),
];

let total = 0, touched = 0;
for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const { out, n } = repoint(text);
  if (n > 0) {
    total += n; touched++;
    console.log(`  ${n.toString().padStart(4)}  ${f.replace(REPO, 'repo')}`);
    if (APPLY) writeFileSync(f, out, 'utf8');
  }
}
console.log(`\n${total} URL occurrence(s) across ${touched} file(s)${APPLY ? ' [REWRITTEN]' : ' [dry-run]'}.`);
console.log('Reminder: the media type application/vnd.openchain.graph+json is intentionally NOT changed.');
if (APPLY) console.log('Next: node chaingraph/generate-okf.mjs ; regen catalog + sitemap ; verify_repo.py ; commit.');
else if (total) console.log('Dry-run only. Re-run with --apply to write.');
