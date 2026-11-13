#!/usr/bin/env node
// check-zk-trust-page.mjs -- ZK-TRUST-STAGES-GATE-1. The trust-model page's stage
// counts are derived, never typed (count-drift gate), and the page carries no
// banned trust-model wording.
//
// Checks, against chaingraph/zk-trust-stages.html:
//   1. COUNT sentinels  -- every <!--COUNT:trust.*-->N<!--/COUNT--> sentinel on the
//      page must equal the estate inventory recomputed from data
//      (scripts/zk-trust-inventory.mjs), and the page must carry a sentinel for
//      every key the inventory publishes (a page that outgrows the engine
//      silently fails the other way, so unknown/extra trust.* sentinels fail too).
//   2. Banned wording in the page's VISIBLE text (script/style/comment blocks
//      stripped): "trustless", "tamper-proof", "immutable" (any form), and the
//      overclaim "one image ID covers all/every ..." -- the page STATES the group
//      facts instead (measured groups; a disclaimer naming the claim inside a
//      negated sentence, e.g. "this page never says one image ID covers every
//      node", is fine: the negator must appear in the same sentence, before the
//      claim).
//
// The count source (chaingraph.json) is a SO #35 single-writer main-regenerated
// artifact: the gate is ADVISORY on pull_request (COVERED entry 'zk-trust-page'
// in scripts/derived-artifacts.mjs, string-matched by preflight.mjs), BLOCKING on
// main, and -- via DERIVED_ROOT_GATES + derivedResolve() below -- BLOCKING on
// merge_group against the queue's ephemeral assembled tree. The same COVERED
// entry's regen command is --fix: it heals drifted sentinels main-side
// (derived-artifacts-regen.yml), so main never holds a standing count red.
//
// PR-2888-DERIVED-PAGE-READ-1 (2026-11-05): the CHECK form reads the page
// through derivedResolve() too, not only chaingraph.json. The trust.* sentinels
// are regen-written (this script's --fix is the COVERED writer), so on
// merge_group `derived-artifacts --out` puts the freshly healed page in
// DERIVED_ROOT. Reading the checkout's page there compared a stale page (main-
// only, the PR cannot refresh it) against a fresh inventory and redded the
// queue by construction (run 41909245697: S0 0 vs 2, S1 461 vs 459, sealed
// 702 vs 700). The --fix form still writes the in-tree page only.
//
// Usage:
//   node scripts/check-zk-trust-page.mjs                     # check (gate form)
//   node scripts/check-zk-trust-page.mjs --fix               # heal drifted sentinels (regen form)
//   node scripts/check-zk-trust-page.mjs --selftest          # RED/GREEN fixture controls
//   node scripts/check-zk-trust-page.mjs --fixture <json> --page <html>
//       # run the core against fixtures (selftest harness; never reads the estate)
//
// Exit codes: 0 green / healed; 1 drift or banned wording (check) or a failed
// control (selftest); 2 unreadable input. Read-only unless --fix, and --fix
// writes only inside the page's own COUNT spans. Node builtins plus sibling
// scripts only; never writes chaingraph.json. No wall clock anywhere (a second
// --fix pass over a healed page is byte-identical -- the idempotency the COVERED
// regen chain requires).

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { computeInventory, deriveFromGraph, trustCountKeys } from './zk-trust-inventory.mjs';
import { derivedResolve } from './_derived-resolve-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PAGE_REL = 'chaingraph/zk-trust-stages.html';

// ── banned trust-model wording (ZK-TRUST-STAGES-PAGE-1 wording rule) ──────────
// Plain banned terms, any case, word-bounded. "tamper-proof" with the hyphen
// variants check-copy-hallmarks' ABSOLUTES battery already counts on every page;
// repeated here because this page is the trust-model claim surface and the row
// bans the words outright, not above a count baseline.
const BANNED_TERMS = [
  { re: /\btrustless(?:ly)?\b/gi, label: 'trustless' },
  { re: /\btamper[\s-]?proof\w*\b/gi, label: 'tamper-proof' },
  { re: /\bimmutab(?:le|ility|ly)\b/gi, label: 'immutable' },
];
// The overclaim: ONE image id covering ALL nodes. The measured fact on the page
// is the opposite shape (one shared interpreter guest for MOST sealed nodes,
// several distinct image ids), and the page carries a disclaimer sentence. The
// claim is banned unless a negator sits in the same sentence BEFORE it.
const IMAGE_ID_CLAIM_RE = /(?:one|a\s+single|just\s+one)\s+image\s*ids?\s+(?:that\s+)?(?:cover|covers|covering|covered|serve|serves|serving|served)\s+(?:all|every|each|the\s+whole|the\s+entire)/gi;
const NEGATOR_RE = /\b(?:never|not|no|cannot|can't|won't|doesn't|does\s+not|isn't|is\s+not|aren't|are\s+not|denies|denying)\b/i;

/** Visible text: strip script/style blocks, comments and tags; decode the five
 *  entities an inline page realistically carries; collapse whitespace. */
export function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Banned-wording findings over visible text. Each hit keeps a +-60 char window
 *  so the failure line names the sentence without reprinting the page. */
export function bannedWording(html) {
  const text = visibleText(html);
  const hits = [];
  for (const { re, label } of BANNED_TERMS) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      hits.push({ label, context: text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60) });
    }
  }
  IMAGE_ID_CLAIM_RE.lastIndex = 0;
  for (let m = IMAGE_ID_CLAIM_RE.exec(text); m; m = IMAGE_ID_CLAIM_RE.exec(text)) {
    // Sentence holding the match: walk back to the previous [.;:!?] boundary.
    // A negator anywhere in that sentence BEFORE the match is the disclaimer
    // carve-out ("this page never says one image ID covers every node").
    const start = text.lastIndexOf('.', m.index) + 1;
    const before = text.slice(start, m.index);
    if (!NEGATOR_RE.test(before)) {
      hits.push({ label: 'one-image-id-covers-all', context: text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60) });
    }
  }
  return hits;
}

/** Page-side sentinel map: { key: { value, index } } from the RAW html (the
 *  sentinels ARE comments; extraction is exact-span, no prose contact). */
export function pageSentinels(html) {
  const out = {};
  const re = /<!--\s*COUNT:(trust\.[A-Za-z0-9_.]+)\s*-->(\d+)<!--\s*\/COUNT\s*-->/g;
  // PR-2888-DERIVED-PAGE-READ-1: a key may appear more than once (the page
  // states trust.sealed twice). `value`/`index` stay the FIRST occurrence;
  // `values` carries every occurrence so the check judges all of them.
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const v = Number(m[2]);
    if (out[m[1]]) out[m[1]].values.push(v);
    else out[m[1]] = { value: v, index: m.index, values: [v] };
  }
  return out;
}

/** Compare the page against the inventory. Returns { drifts, banned } where a
 *  drift is { key, expected, got } (got null = sentinel missing) or
 *  { key, expected: null, got } (page publishes a key the engine does not). */
export function checkCounts(inv, html) {
  const counts = trustCountKeys(inv);
  const sentinels = pageSentinels(html);
  const drifts = [];
  for (const [key, expected] of Object.entries(counts)) {
    const s = sentinels[key];
    if (!s) { drifts.push({ key, expected, got: null }); continue; }
    // every occurrence must match, not only the last one the map kept
    for (const v of s.values || [s.value]) {
      if (v !== expected) drifts.push({ key, expected, got: v });
    }
  }
  for (const key of Object.keys(sentinels)) {
    if (!(key in counts)) drifts.push({ key, expected: null, got: sentinels[key].value });
  }
  return { drifts, banned: bannedWording(html) };
}

/** Heal drifted sentinel VALUES in place (span-precise). Unknown/extra keys and
 *  banned wording are content the bot cannot heal -- left untouched, reported
 *  by the check gate. Returns { html, changed: [key old->new] }. */
export function fixCounts(inv, html) {
  const counts = trustCountKeys(inv);
  let out = html;
  const changed = [];
  for (const [key, expected] of Object.entries(counts)) {
    // PR-2888-DERIVED-PAGE-READ-1: heal EVERY occurrence (global), and escape
    // the key's dots. The non-global form healed only the first trust.sealed
    // while the check read the second, so --fix was not a fixpoint.
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(<!--\\s*COUNT:${esc}\\s*-->)(\\d+)(<!--\\s*\\/COUNT\\s*-->)`, 'g');
    const stale = [...out.matchAll(re)].map((m) => m[2]).filter((v) => Number(v) !== expected);
    if (stale.length) {
      out = out.replace(re, `$1${expected}$3`);
      changed.push(`${key} ${[...new Set(stale)].join('/')}->${expected}${stale.length > 1 ? ` (x${stale.length})` : ''}`);
    }
  }
  return { html: out, changed };
}

async function inventoryForRoot() {
  // DERIVED_ROOT overlay: on merge_group the queue's ephemeral ASSEMBLED
  // monolith is the count source; everywhere else the committed tree (which
  // resolves to the same path when no overlay is mounted).
  const cgPath = derivedResolve('chaingraph', 'chaingraph.json');
  const chaingraph = JSON.parse(readFileSync(cgPath, 'utf8'));
  // Same recompute the inventory row's own main() runs -- one ladder, one
  // classifier (check-compute-proof-coverage), one L1 report source.
  const { buildReport } = await import('./check-chain-edge-contracts.mjs');
  return deriveFromGraph(chaingraph, buildReport(REPO), REPO);
}

function printFindings(drifts, banned) {
  for (const d of drifts) {
    if (d.got === null && d.expected !== null) console.log(`  MISSING sentinel ${d.key} — page must carry one (expected ${d.expected})`);
    else if (d.expected === null) console.log(`  UNKNOWN sentinel ${d.key}=${d.got} — the inventory does not publish this key`);
    else console.log(`  DRIFT ${d.key} expected=${d.expected} got=${d.got}`);
  }
  for (const b of banned) console.log(`  BANNED ${b.label}: …${b.context}…`);
}

async function main() {
  const argv = process.argv.slice(2);
  const selftest = argv.includes('--selftest');
  const fix = argv.includes('--fix');
  const fi = argv.indexOf('--fixture');
  const pi = argv.indexOf('--page');

  // ── fixture mode: never reads the estate (selftest harness) ────────────────
  if (fi >= 0) {
    const pagePath = pi >= 0 ? argv[pi + 1] : null;
    if (!pagePath) { console.error('check-zk-trust-page: --fixture needs --page <html>'); process.exit(2); }
    const inv = computeInventory(JSON.parse(readFileSync(argv[fi + 1], 'utf8')));
    const html = readFileSync(pagePath, 'utf8');
    if (fix) {
      const { html: healed, changed } = fixCounts(inv, html);
      if (changed.length) writeFileSync(pagePath, healed);
      console.log(`zk-trust-page --fix: ${changed.length ? `healed ${changed.join(', ')}` : 'already fresh — no write'}`);
      process.exit(0);
    }
    const { drifts, banned } = checkCounts(inv, html);
    if (drifts.length || banned.length) { printFindings(drifts, banned); process.exit(1); }
    console.log(`zk-trust-page: green — ${Object.keys(trustCountKeys(inv)).length} sentinels match the inventory, no banned wording`);
    process.exit(0);
  }

  if (selftest) process.exit(await selftest$());

  // ── real mode ──────────────────────────────────────────────────────────────
  // --fix writes the in-tree page (the writer's target); the check reads the
  // DERIVED_ROOT copy when one is mounted, else the checkout (derivedResolve).
  const pagePath = fix ? resolve(REPO, PAGE_REL) : derivedResolve(...PAGE_REL.split('/'));
  if (!existsSync(pagePath)) { console.error(`check-zk-trust-page: page not found: ${PAGE_REL}`); process.exit(2); }
  let inv;
  try {
    inv = await inventoryForRoot();
  } catch (e) {
    console.error(`check-zk-trust-page: inventory recompute failed: ${e.message}`);
    process.exit(2);
  }
  const html = readFileSync(pagePath, 'utf8');
  if (fix) {
    // Regen-writer semantics (PROVE-BASELINE-SINGLE-WRITER-1 shape): heal what is
    // healable, hold (exit 0) on what is not, so the main-side regen pass is
    // never stopped by content only a human can rewrite. The strict gate below
    // is what reds main on that content.
    const { html: healed, changed } = fixCounts(inv, html);
    if (changed.length) writeFileSync(pagePath, healed);
    console.log(`zk-trust-page --fix: ${changed.length ? `healed ${changed.join(', ')}` : 'already fresh — no write'}`);
    const { banned } = checkCounts(inv, healed);
    if (banned.length) { console.log('zk-trust-page --fix: banned wording is NOT healable by the writer — the check gate owns it:'); printFindings([], banned); }
    process.exit(0);
  }
  const { drifts, banned } = checkCounts(inv, html);
  if (drifts.length || banned.length) {
    console.log(`zk-trust-page: RED — page ${pagePath} vs recomputed inventory (source: ${derivedResolve('chaingraph', 'chaingraph.json')}):`);
    printFindings(drifts, banned);
    process.exit(1);
  }
  console.log(`zk-trust-page: green — ${Object.keys(trustCountKeys(inv)).length} sentinels match the inventory, no banned wording`);
  process.exit(0);
}

// ── selftest: RED/GREEN fixture controls (SO #34c pairing) ───────────────────
// Deterministic tiny fixtures: two sealed live nodes, one on an L1-pass chain
// step (S3), one with an FV evidence vector (S2); computed counts are therefore
// live=2 sealed=2 S0=0 S1=0 S2=1 S3=1 fvEvidence=1 chainContract=1
// imageIdGroups=2 callerAttested=1. The PASSING page carries
// exactly those sentinels plus the negated disclaimer sentence (proves the
// carve-out); each RED page mutates exactly one thing. Every control runs the
// gate as its own process (the same command the GATES entry runs), so exit
// codes — not internal state — are what is proven.
function fixtureNode(toolId, imageId, receiptFormat) {
  return {
    tool_id: toolId,
    status: 'live',
    audit_signature: {
      compute_proof: {
        type: 'ZkVmReceipt',
        receiptFormat,
        imageId,
        seal: '0x' + 'ab'.repeat(32),
        journal: { output: { ok: true } },
      },
    },
  };
}
const FIXTURE_INV = {
  nodes: [fixtureNode('t-a', 'sha256:' + 'a'.repeat(64), 'groth16-bn254'), fixtureNode('t-b', 'sha256:' + 'b'.repeat(64), 'stark')],
  chainVerdicts: [{ verdict: 'L1-pass', steps: ['t-a'] }],
  fvRecords: { 't-b': { evidence_vector: ['e1'], kernel_digest_at_authoring: null } },
  currentDigests: {},
  attestedIds: ['t-a'],
};
const HEAD = '<!doctype html><html><head><title>t</title></head><body>';
const TAIL = '</body></html>';
const PASS_PAGE =
  HEAD +
  '<p>Aggregate counts only.</p>' +
  '<p>Across <!--COUNT:trust.sealed-->2<!--/COUNT--> sealed live nodes the inventory finds <!--COUNT:trust.imageIdGroups-->2<!--/COUNT--> distinct image IDs. This page never says one image ID covers every node: smaller groups each carry their own.</p>' +
  '<p>Today <!--COUNT:trust.callerAttested-->1<!--/COUNT--> live nodes are caller-attested.</p>' +
  '<table><tr><td>S0</td><td><!--COUNT:trust.S0-->0<!--/COUNT--></td></tr>' +
  '<tr><td>S1</td><td><!--COUNT:trust.S1-->0<!--/COUNT--></td></tr>' +
  '<tr><td>S2</td><td><!--COUNT:trust.S2-->1<!--/COUNT--></td></tr>' +
  '<tr><td>S3</td><td><!--COUNT:trust.S3-->1<!--/COUNT--></td></tr></table>' +
  '<p>Of <!--COUNT:trust.live-->2<!--/COUNT--> live nodes, <!--COUNT:trust.sealed-->2<!--/COUNT--> carry a seal. <!--COUNT:trust.fvEvidence-->1<!--/COUNT--> have a formal-verification evidence vector and <!--COUNT:trust.chainContract-->1<!--/COUNT--> sit in a chain with a contract.</p>' +
  TAIL;

async function selftest$() {
  const tmp = mkdtempSync(join(tmpdir(), 'zk-trust-page-selftest-'));
  const script = fileURLToPath(import.meta.url);
  const fixtures = [];
  const write = (name, text) => { const p = join(tmp, name); writeFileSync(p, text); return p; };
  const invPath = write('inv.json', JSON.stringify(FIXTURE_INV));
  try {
    const run = (...args) => {
      const r = spawnSync(process.execPath, [script, '--fixture', invPath, '--page', ...args], { encoding: 'utf8' });
      return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
    };
    const check = (name, cond, detail) => {
      if (!cond) fixtures.push(`${name}: ${detail}`);
      console.log(`${cond ? '✓' : '✗'} ${name}`);
    };

    const passPage = write('pass.html', PASS_PAGE);
    const g = run(passPage);
    check('GREEN fixture exits 0', g.code === 0 && g.out.includes('green'), `exit=${g.code} out=${g.out.slice(0, 120)}`);
    check('GREEN fixture proves the negation carve-out', g.code === 0, 'the disclaimer sentence must not count as a claim hit');

    const driftPage = write('drift.html', PASS_PAGE.replace('<!--COUNT:trust.S2-->1<!--/COUNT-->', '<!--COUNT:trust.S2-->9<!--/COUNT-->'));
    const d = run(driftPage);
    check('RED drift fixture exits 1 naming the key', d.code === 1 && d.out.includes('DRIFT trust.S2 expected=1 got=9'), `exit=${d.code} out=${d.out.slice(0, 160)}`);

    const missingPage = write('missing.html', PASS_PAGE.replace('<tr><td>S3</td><td><!--COUNT:trust.S3-->1<!--/COUNT--></td></tr>', ''));
    const m = run(missingPage);
    check('RED missing-sentinel fixture exits 1 naming the key', m.code === 1 && m.out.includes('MISSING sentinel trust.S3'), `exit=${m.code} out=${m.out.slice(0, 160)}`);

    const bannedPage = write('banned.html', PASS_PAGE.replace('<p>Aggregate counts only.</p>', '<p>The receipt is immutable and the design is trustless.</p>'));
    const b = run(bannedPage);
    check('RED banned-word fixture exits 1 naming both terms', b.code === 1 && b.out.includes('BANNED immutable') && b.out.includes('BANNED trustless'), `exit=${b.code} out=${b.out.slice(0, 200)}`);

    const claimPage = write('claim.html', PASS_PAGE.replace('This page never says one image ID covers every node: smaller groups each carry their own.', 'One image ID covers every node in the estate.'));
    const c = run(claimPage);
    check('RED un-negated claim fixture exits 1', c.code === 1 && c.out.includes('BANNED one-image-id-covers-all'), `exit=${c.code} out=${c.out.slice(0, 200)}`);

    const fixTarget = write('fix.html', PASS_PAGE.replace('<!--COUNT:trust.S2-->1<!--/COUNT-->', '<!--COUNT:trust.S2-->9<!--/COUNT-->'));
    const f1 = spawnSync(process.execPath, [script, '--fixture', invPath, '--page', fixTarget, '--fix'], { encoding: 'utf8' });
    check('--fix heals the drifted sentinel', f1.status === 0 && (f1.stdout || '').includes('healed trust.S2 9->1'), `exit=${f1.status} out=${(f1.stdout || '').slice(0, 120)}`);
    const f2 = run(fixTarget);
    check('post-fix re-check is green', f2.code === 0, `exit=${f2.code}`);
    const f3 = spawnSync(process.execPath, [script, '--fixture', invPath, '--page', fixTarget, '--fix'], { encoding: 'utf8' });
    check('--fix second pass is a no-op (idempotent)', f3.status === 0 && (f3.stdout || '').includes('already fresh'), `exit=${f3.status} out=${(f3.stdout || '').slice(0, 120)}`);

    // PR-2888-DERIVED-PAGE-READ-1: the page states trust.sealed twice. Drift only
    // the SECOND occurrence: the check must see it, and --fix must heal it (the
    // non-global heal fixed only the first, so --fix was not a fixpoint).
    const SECOND = 'carry a seal';
    const dupPage = PASS_PAGE.replace(`<!--COUNT:trust.sealed-->2<!--/COUNT--> ${SECOND}`, `<!--COUNT:trust.sealed-->7<!--/COUNT--> ${SECOND}`);
    const dupTarget = write('dup.html', dupPage);
    const dd = run(dupTarget);
    check('RED drift on a repeated key\'s second occurrence exits 1', dd.code === 1 && dd.out.includes('DRIFT trust.sealed expected=2 got=7'), `exit=${dd.code} out=${dd.out.slice(0, 160)}`);
    const df = spawnSync(process.execPath, [script, '--fixture', invPath, '--page', dupTarget, '--fix'], { encoding: 'utf8' });
    check('--fix heals every occurrence of a repeated key', df.status === 0 && (df.stdout || '').includes('healed trust.sealed 7->2'), `exit=${df.status} out=${(df.stdout || '').slice(0, 120)}`);
    const dg = run(dupTarget);
    check('post-fix re-check of the repeated key is green', dg.code === 0, `exit=${dg.code} out=${dg.out.slice(0, 160)}`);

    if (fixtures.length) {
      console.error(`\ncheck-zk-trust-page --selftest: ${fixtures.length} control(s) FAILED:`);
      for (const f of fixtures) console.error(`  ✗ ${f}`);
      return 1;
    }
    console.log('check-zk-trust-page --selftest: all controls green');
    return 0;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`check-zk-trust-page: ${e.message}`); process.exit(2); });
}
