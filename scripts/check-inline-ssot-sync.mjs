#!/usr/bin/env node
/**
 * scripts/check-inline-ssot-sync.mjs — INLINESYNC-1
 *
 * The site has no build step (CONTRACT.md: zero build, zero dependency drift,
 * portable static deployment), so three small kernel helpers get hand-pasted
 * as inline <script> blocks into hundreds of otherwise self-contained HTML
 * pages: kernels/_proof.inline.min.js's secured(), kernels/_signverdict.inline.js
 * (whole file), and the __ocgCanon() canonicalizer. Before this gate NO
 * generator or check existed for keeping those hand-typed copies in sync with
 * their SSOT — PROOFSYNC-SECURED-1 shipped a fix for 11 pages whose secured()
 * copy was stale (missing an empty-audit_signature cleanup, silently breaking
 * sign-then-verify) precisely because nothing would have caught that drift.
 *
 * Shape: one manifest (scripts/inline-ssot-sync-manifest.json) driving ONE
 * general algorithm over all three pairs — same doctrine as
 * scripts/published-dirs.json driving regen-sitemap.mjs (generator/gate share
 * one manifest so they can't drift apart independently). Two extraction
 * `mode`s cover all three pairs without pair-specific code:
 *   - "line": the SSOT unit is a single minified inline function statement
 *     (secured(), __ocgCanon()) — extract the one SSOT line containing
 *     `trigger`, then every consumer line containing that same trigger must
 *     be byte-identical to it (or a pinned baseline variant — see below).
 *   - "wholeFileBlock": the SSOT unit is the ENTIRE kernel file, verbatim
 *     (kernels/_signverdict.inline.js's own header comment says as much) —
 *     a consuming page must contain the SSOT file's full trimmed text as a
 *     byte-identical substring.
 * A file can carry more than one occurrence of a "line" pair (e.g. a tool
 * page embedding a second widget with its own copy) — every occurrence is
 * checked independently, not just the first.
 *
 * SYNC DEFINITION: byte-identical to the current SSOT text, OR byte-identical
 * to a variant text explicitly pinned to that exact file in
 * scripts/inline-ssot-sync-baseline.json. The baseline exists for exactly one
 * known case (see that file): 33 chaingraph/chains + tools pages carry an
 * older, purely-stylistic ES5 transcription of __ocgCanon (function-expression
 * reduce callback instead of the current arrow-fn reduce) predating a
 * scripts/gen-chain-runners.mjs refactor, functionally identical for every
 * input but byte-different. Baseline entries are a ceiling, same ratchet
 * doctrine as scripts/copy-hallmarks-baseline.json: a file already listed may
 * keep its pinned variant, but a file NOT listed must match the live SSOT
 * exactly — no new hand-typed variant can join, and the list only shrinks as
 * pages get swept to canonical (a page edit, out of INLINESYNC-1's fence, not
 * done here). The baseline is NEVER used to shield a behavioral difference —
 * only confirmed-equivalent stylistic transcriptions may be added, by hand,
 * as a deliberate reviewed exception.
 *
 * NO REGENERATION MODE: unlike regen-sitemap.mjs, this script is gate-only
 * (same shape as check-copy-hallmarks.mjs). There is no safe generic way to
 * auto-rewrite an arbitrary hand-authored inline <script> block back to the
 * SSOT text across ~600-page-scale consumer sets without risking a bad
 * surgical edit landing unreviewed on live tool pages — chaingraph/kernels/
 * fix-hash-scheme.mjs already does exactly that, but only for ONE narrow,
 * well-understood pattern (the Scheme-A array-replacer bug), applies it with
 * --apply as a deliberate hand-run step, and stays out of this gate's fence
 * (kernels/ is read-only here). A human fixing a real drift by hand, then
 * this gate turning green again, is the intended loop.
 *
 * Usage:
 *   node scripts/check-inline-ssot-sync.mjs            # verbose per-pair report
 *   node scripts/check-inline-ssot-sync.mjs --check    # terse gate (preflight + CI), exit 1 on drift
 *   node scripts/check-inline-ssot-sync.mjs --pair <id> --file <path>
 *                                                       # ad hoc: check ONE file against ONE pair's
 *                                                       # SSOT, even outside the normal consumer scan
 *                                                       # (used to reproduce a reconstructed pre-fix
 *                                                       # page against the current SSOT — see
 *                                                       # board/done/PROOFSYNC-SECURED-1.md)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = resolve(REPO, 'scripts', 'inline-ssot-sync-manifest.json');
const BASELINE_PATH = resolve(REPO, 'scripts', 'inline-ssot-sync-baseline.json');
const CHECK = process.argv.includes('--check');

const pairArgIdx = process.argv.indexOf('--pair');
const fileArgIdx = process.argv.indexOf('--file');
const AD_HOC = pairArgIdx !== -1 && fileArgIdx !== -1;
const AD_HOC_PAIR = AD_HOC ? process.argv[pairArgIdx + 1] : null;
const AD_HOC_FILE = AD_HOC ? process.argv[fileArgIdx + 1] : null;

// Worktrees/tooling dirs that are not the live estate — same exclusion class
// as scripts/check-copy-hallmarks.mjs's SKIP_DIRS, plus worktree dirs (a
// worktree is a full checkout of the same tree and would otherwise double
// every count).
const SKIP_DIRS = new Set(['.git', '.claude', '.wt', '.wrangler', 'node_modules', '.github', '.githooks']);

function htmlFiles(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) htmlFiles(join(dir, e.name), out);
    } else if (e.name.endsWith('.html')) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

/**
 * Extract every occurrence of the exact `function name(...){...}` statement
 * starting at each place `trigger` appears in `text`, using balanced-brace
 * matching from the first `{` after the trigger to its matching close. This
 * is robust to a page having the ENTIRE surrounding IIFE minified onto one
 * physical line (10 of the 627 secured() consumers are shaped that way) —
 * a naive line-split would wrongly capture the whole line's unrelated code
 * as part of the "copy" and false-flag it as drifted. All three pairs' units
 * (secured(), __ocgCanon()) are self-contained helpers with no string
 * literals containing braces, so brace-depth counting alone is exact here.
 */
function extractSnippets(text, trigger) {
  const out = [];
  let searchFrom = 0;
  while (true) {
    const start = text.indexOf(trigger, searchFrom);
    if (start === -1) break;
    const braceStart = text.indexOf('{', start);
    if (braceStart === -1) { searchFrom = start + trigger.length; continue; }
    let depth = 0, i = braceStart, end = -1;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end === -1) { searchFrom = start + trigger.length; continue; } // unbalanced — skip, don't crash
    out.push(text.slice(start, end));
    searchFrom = end;
  }
  return out;
}

function loadCanonical(pair) {
  const ssotText = readFileSync(resolve(REPO, pair.ssotFile), 'utf8');
  if (pair.mode === 'line') {
    const snippets = extractSnippets(ssotText, pair.trigger);
    if (snippets.length !== 1) {
      throw new Error(`[${pair.id}] SSOT ${pair.ssotFile}: expected exactly 1 occurrence of "${pair.trigger}", found ${snippets.length} — manifest/extraction is stale, fix scripts/inline-ssot-sync-manifest.json before trusting this gate.`);
    }
    return snippets[0];
  }
  if (pair.mode === 'wholeFileBlock') return ssotText.trim();
  throw new Error(`[${pair.id}] unknown mode "${pair.mode}" in scripts/inline-ssot-sync-manifest.json`);
}

/** Returns an array of failure strings (empty = fully in sync) for one file against one pair. */
function checkFile(pair, canonical, pinnedVariants, relPath, src) {
  const out = [];
  if (pair.mode === 'line') {
    const occurrences = extractSnippets(src, pair.trigger);
    for (const occ of occurrences) {
      if (occ === canonical) continue;
      const pinned = pinnedVariants.find((v) => v.text === occ && v.files.includes(relPath));
      if (pinned) continue;
      out.push(`[${pair.id}] ${relPath}: inline copy does not byte-match SSOT (${pair.ssotFile}) and is not a pinned baseline variant for this file.\n        found:  ${occ}\n        wanted: ${canonical}`);
    }
  } else { // wholeFileBlock
    if (!src.includes(pair.trigger)) return out; // page doesn't carry this snippet at all
    if (src.includes(canonical)) return out;
    const pinned = pinnedVariants.find((v) => src.includes(v.text) && v.files.includes(relPath));
    if (pinned) return out;
    out.push(`[${pair.id}] ${relPath}: inline copy does not byte-match SSOT whole-file block (${pair.ssotFile}) and is not a pinned baseline variant for this file.`);
  }
  return out;
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};

// ── Ad hoc single-file mode (acceptance-test / spot-check tool) ────────────
if (AD_HOC) {
  const pair = manifest.pairs.find((p) => p.id === AD_HOC_PAIR);
  if (!pair) { console.error(`Unknown --pair "${AD_HOC_PAIR}". Known pairs: ${manifest.pairs.map((p) => p.id).join(', ')}`); process.exit(2); }
  const canonical = loadCanonical(pair);
  const src = readFileSync(AD_HOC_FILE, 'utf8');
  const pinnedVariants = (baseline[pair.id] && baseline[pair.id].variants) || [];
  const failures = checkFile(pair, canonical, pinnedVariants, AD_HOC_FILE, src);
  if (failures.length) {
    console.error(`check-inline-ssot-sync --pair ${pair.id} --file ${AD_HOC_FILE}: DRIFT DETECTED\n  ` + failures.join('\n  '));
    process.exit(1);
  }
  console.log(`check-inline-ssot-sync --pair ${pair.id} --file ${AD_HOC_FILE}: in sync.`);
  process.exit(0);
}

// ── Full estate scan ─────────────────────────────────────────────────────
const allFiles = htmlFiles(REPO).map((f) => relative(REPO, f).replace(/\\/g, '/'));
const failures = [];
const summaries = [];
let totalOccurrences = 0;

for (const pair of manifest.pairs) {
  let canonical;
  try { canonical = loadCanonical(pair); }
  catch (e) { failures.push(e.message); continue; }

  const pinnedVariants = (baseline[pair.id] && baseline[pair.id].variants) || [];
  let occurrences = 0;
  let drifted = 0;
  const pairFailures = [];

  for (const rel of allFiles) {
    if (rel === pair.ssotFile) continue; // never compare the SSOT to itself
    const src = readFileSync(resolve(REPO, rel), 'utf8');
    if (pair.mode === 'line') {
      const n = extractSnippets(src, pair.trigger).length;
      if (!n) continue;
      occurrences += n;
    } else {
      if (!src.includes(pair.trigger)) continue;
      occurrences += 1;
    }
    const fileFailures = checkFile(pair, canonical, pinnedVariants, rel, src);
    if (fileFailures.length) { drifted += fileFailures.length; pairFailures.push(...fileFailures); }
  }

  totalOccurrences += occurrences;
  summaries.push(`  [${pair.id}] ${occurrences} occurrence(s) across consuming pages, ${occurrences - drifted} in sync${drifted ? `, ${drifted} DRIFTED` : ''} (SSOT: ${pair.ssotFile})`);
  failures.push(...pairFailures);
}

if (!CHECK) {
  console.log(`check-inline-ssot-sync: ${manifest.pairs.length} SSOT/inline pair(s), ${totalOccurrences} total occurrence(s) scanned.`);
  console.log(summaries.join('\n'));
}

if (failures.length) {
  console.error(`\ncheck-inline-ssot-sync: ${failures.length} FAILURE(s) — inline copy drifted from its SSOT:\n  ` + failures.join('\n  '));
  console.error('\nFix: hand-copy the exact SSOT text into the drifted page. If the drift is a deliberate, reviewed stylistic exception (never a behavioral one), pin it in scripts/inline-ssot-sync-baseline.json — same ratchet doctrine as scripts/copy-hallmarks-baseline.json.');
  process.exit(1);
}
console.log(`check-inline-ssot-sync: OK — all ${totalOccurrences} inline occurrence(s) across ${manifest.pairs.length} pair(s) are byte-identical to their SSOT (or a pinned baseline exception).`);
