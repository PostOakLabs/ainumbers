#!/usr/bin/env node
/**
 * scripts/gen-proof-links.mjs — PROOFLINKS-GEN-1 / Anchor Wave C (2026-11-13).
 *
 * WHY: the ~640 node pages publish a kernel-digest meta in <head> and a link to
 * fv-explainer.html and verify.html in the footer, but no reader-facing,
 * restartable inventory of the verification artifacts that actually exist for
 * that node. A reader cannot tell a proven node from a deferred one without
 * reading the graph index, and the estate has no single generated surface that
 * carries the anchor deep link. Before this script there was no writer for that
 * block, so any hand-authored copy would drift the moment a kernel moved.
 *
 * HOW: one pure function of the committed tree (the node's shard, filesystem
 * existence checks, and the kernel digest recomputed from kernel bytes via
 * _buildid.mjs sourceDigest(), never read from the page, SO #34) writes a
 * <details> block between <!--PROOF-LINKS--> sentinels in the page body,
 * immediately above the footer and outside the footer regex. BLOCKS ARE NOT
 * COMMITTED BY A PR: the single writer is derived-artifacts-regen.yml on main
 * (SO #35), which is why scripts/derived-artifacts.mjs declares this entry as
 * advisory on a PR and blocking on main / merge_group, like node-page-footers.
 *
 * Exit codes: the write run exits 0 even on a page it cannot fill (it prints
 * the reason), so one odd page never stops main's regen pass. --check is the
 * alarm: exit 1 on any drifted block or any relative href that does not resolve.
 *
 * Usage:
 *   node scripts/gen-proof-links.mjs             # write every drifted block (main-side regen)
 *   node scripts/gen-proof-links.mjs --check     # exit 1 on drift or a dead relative href
 *   node scripts/gen-proof-links.mjs --paths     # print the page list this writer owns
 *   node scripts/gen-proof-links.mjs --selftest  # RED on a mutated scratch page, GREEN after a write
 *
 * Zero-dependency: node builtins only (STANDING ORDER #10). Deterministic: the
 * output is a pure function of the committed tree, no wall clock and no network.
 */
import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CG = resolve(REPO, 'chaingraph');
const KDIR = resolve(CG, 'kernels');
const FIXDIR = resolve(KDIR, 'fixtures');
const PTDIR = resolve(KDIR, '__proptests__');
const RECDIR = resolve(FIXDIR, 'compute-proof');
const SHARD_REL = 'graph/nodes';
const SHARDDIR = resolve(CG, SHARD_REL);
const GRAPH = resolve(CG, 'chaingraph.json');
const MANIFESTS = resolve(REPO, 'manifests');
const FVPILOT = resolve(CG, 'fv-pilot');
const FVSTATUS = resolve(REPO, 'fv-status');
const REGISTRY = resolve(REPO, 'registry', 'kernel');

const START = '<!--PROOF-LINKS-->';
const END = '<!--/PROOF-LINKS-->';
const ANCHOR_BASE = 'https://anchor.ainumbers.co/?hash=';

/** Repo-relative paths this writer may write; derived-artifacts.mjs declares
 *  exactly this list as the entry's `writes` and `artifacts`. The set is the
 *  node shards intersected with the top-level node pages (642 art pages plus
 *  the non-art node pages), computed from the directory so a node page added
 *  later joins the set, and kept free of any chaingraph.json import at load
 *  time so the assembler can import derived-artifacts.mjs. */
export function proofLinkPages() {
  if (!existsSync(SHARDDIR) || !existsSync(CG)) return [];
  const pages = new Set(readdirSync(CG).filter((f) => f.endsWith('.html')));
  return readdirSync(SHARDDIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .filter((id) => pages.has(`${id}.html`))
    .sort()
    .map((id) => `chaingraph/${id}.html`);
}

function toolIdOf(pageRel) {
  const f = pageRel.slice(pageRel.lastIndexOf('/') + 1);
  return f.endsWith('.html') ? f.slice(0, -'.html'.length) : f;
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The assembled graph is read LAZILY (never at import time) for the one field
 *  the shard itself does not carry: compute_proof_ready. Shards hold the inline
 *  compute_proof; the assembler adds the §18 readiness verdict, so this entry
 *  is declared after node-page-footers (itself after chaingraph-assemble). */
let graphNodes = null;
function graphNode(toolId) {
  if (graphNodes === null) {
    graphNodes = new Map();
    const g = readJson(GRAPH);
    if (g && Array.isArray(g.nodes)) {
      for (const n of g.nodes) {
        if (n && typeof n.tool_id === 'string') graphNodes.set(n.tool_id, n);
      }
    }
  }
  return graphNodes.get(toolId) || null;
}

/** A row is either a static relative link or plain "not published" text. Only
 *  relative hrefs are emitted for files, so --check can resolve every one. */
function fileRow(label, relFromChaingraph, text) {
  if (relFromChaingraph && existsSync(resolve(CG, relFromChaingraph))) {
    return `  <li>${label}: <a href="${escapeHtml(relFromChaingraph)}">${escapeHtml(text || relFromChaingraph)}</a></li>`;
  }
  return `  <li>${label}: not published</li>`;
}

function textRow(label, text) {
  return `  <li>${label}: ${escapeHtml(text)}</li>`;
}

/** The fv-status surface is keyed by spec digest and carries a kernel_ids list.
 *  Link the records that enrol this node; never a dead link when none do. */
function fvStatusRows(toolId) {
  if (!existsSync(FVSTATUS)) return [fileRow('Formal verification status', null)];
  const hits = readdirSync(FVSTATUS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, rec: readJson(join(FVSTATUS, f)) }))
    .filter((x) => x.rec && Array.isArray(x.rec.kernel_ids) && x.rec.kernel_ids.includes(toolId))
    .sort((a, b) => a.f.localeCompare(b.f));
  if (!hits.length) return [fileRow('Formal verification status', null)];
  return hits.map((x) => fileRow('Formal verification status', `../fv-status/${x.f}`, x.rec.spec_version || x.f));
}

/** The block is a pure function of the tree. sourceDigest() and
 *  classifyPilotStatus() are imported lazily so importing this module (which
 *  derived-artifacts.mjs does) never touches WebCrypto at load time. */
async function buildBlock(toolId) {
  const { sourceDigest } = await import(pathToFileURL(resolve(KDIR, '_buildid.mjs')).href);
  const { classifyPilotStatus } = await import(pathToFileURL(resolve(REPO, 'scripts', 'check-fv-pilot-badge.mjs')).href);

  const kernelRel = `kernels/${toolId}.kernel.mjs`;
  const kernelAbs = resolve(CG, kernelRel);
  const digest = existsSync(kernelAbs) ? await sourceDigest(readFileSync(kernelAbs, 'utf8')) : null;
  const digestHex = digest ? digest.replace(/^sha256:/, '') : null;

  const node = graphNode(toolId);
  const nodeProof = node && node.compute_proof;
  const ready = !!(node && node.compute_proof_ready === 'ready');

  const rows = [];
  rows.push(fileRow('Kernel source', existsSync(kernelAbs) ? kernelRel : null, `${toolId}.kernel.mjs`));
  rows.push(textRow('Kernel digest', digest || 'not published'));
  rows.push(fileRow('Golden fixtures', `kernels/fixtures/${toolId}.fixtures.json`, 'fixtures'));
  rows.push(fileRow('Property tests', `kernels/__proptests__/${toolId}.proptest.mjs`, 'proptest'));

  const standalone = `kernels/fixtures/compute-proof/${toolId}.receipt.json`;
  const shardRel = `${SHARD_REL}/${toolId}.json`;
  const shard = readJson(resolve(CG, shardRel));
  const hasProof = !!(shard && shard.compute_proof && typeof shard.compute_proof === 'object');
  if (existsSync(resolve(CG, standalone))) {
    const rec = readJson(resolve(CG, standalone)) || {};
    const imageId = rec.imageId || (rec.journal && rec.journal.imageId) || (nodeProof && nodeProof.imageId);
    rows.push(fileRow('zk receipt', standalone, imageId || 'receipt'));
    if (imageId) rows.push(textRow('Receipt image id', imageId));
    rows.push(textRow('Proof status', ready ? 'verified' : 'deferred'));
  } else if (hasProof) {
    const imageId = shard.compute_proof.imageId || (nodeProof && nodeProof.imageId) || '';
    rows.push(fileRow('zk receipt', shardRel, `${toolId}.json`));
    if (imageId) rows.push(textRow('Receipt image id', imageId));
    rows.push(textRow('Proof status', ready ? 'verified' : 'deferred'));
  } else {
    rows.push(textRow('zk receipt', 'proof deferred'));
    rows.push(textRow('Proof status', 'deferred'));
  }

  const pilotRel = `fv-pilot/${toolId}.json`;
  const pilotAbs = resolve(CG, pilotRel);
  let pilotRow;
  if (existsSync(pilotAbs)) {
    const rec = readJson(pilotAbs);
    const kernelSource = existsSync(kernelAbs) ? readFileSync(kernelAbs, 'utf8') : null;
    const status = rec ? await classifyPilotStatus(rec, kernelSource, sourceDigest) : null;
    pilotRow = status && status.badge
      ? fileRow('Formal verification tier', pilotRel, `class ${status.class}: ${status.label}`)
      : fileRow('Formal verification tier', null);
  } else {
    pilotRow = fileRow('Formal verification tier', null);
  }
  rows.push(pilotRow);
  rows.push(...fvStatusRows(toolId));
  rows.push(fileRow('Formal verification explainer', '../fv-explainer.html', 'fv-explainer.html'));
  rows.push(textRow('Formal verification source', 'formal proof not published'));

  if (digestHex) rows.push(fileRow('On-chain registry record', `../registry/kernel/${digestHex}.json`, digestHex));

  const manifest = readJson(resolve(MANIFESTS, `${toolId}.manifest.json`));
  const fixtures = readJson(resolve(FIXDIR, `${toolId}.fixtures.json`));
  const firstVector = fixtures && Array.isArray(fixtures.vectors) ? fixtures.vectors[0] : null;
  const exampleHash = (manifest && typeof manifest.example_execution_hash === 'string' && manifest.example_execution_hash)
    || (firstVector && typeof firstVector.golden_hash === 'string' ? firstVector.golden_hash : null);
  if (exampleHash) {
    rows.push(`  <li>Anchor timestamp: <a href="${ANCHOR_BASE}${encodeURIComponent(exampleHash)}">record this example execution hash</a></li>`);
  } else {
    rows.push(textRow('Anchor timestamp', 'no example execution hash published'));
  }
  rows.push(fileRow('Anchor explainer', 'anchors-explainer.html', 'anchors-explainer.html'));

  return [
    START,
    '<details class="proof-links">',
    '  <summary>Verification artifacts</summary>',
    '  <ul>',
    ...rows,
    '  </ul>',
    '</details>',
    END,
  ].join('\n');
}

function blockSpan(html) {
  const a = html.indexOf(START);
  if (a === -1) return null;
  const b = html.indexOf(END, a);
  if (b === -1) return null;
  return [a, b + END.length];
}

function footerOffset(html) {
  return html.search(/<footer\b[^>]*>/i);
}

/** Insert or replace the block immediately above the <footer>, never in <head>. */
function withBlock(html, block) {
  const span = blockSpan(html);
  if (span) return html.slice(0, span[0]) + block + html.slice(span[1]);
  const f = footerOffset(html);
  if (f === -1) throw new Error('no <footer> found: refusing to place the block in <head>');
  const before = html.slice(0, f);
  const sep = before.endsWith('\n') ? '' : '\n';
  return before + sep + block + '\n' + html.slice(f);
}

/** Relative hrefs emitted by buildBlock must resolve; the external anchor link
 *  is a plain URL and is deliberately exempt. */
function checkHrefs(block, toolId) {
  const bad = [];
  for (const m of block.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (/^https?:\/\//.test(href)) continue;
    if (!existsSync(resolve(CG, href))) bad.push(`${toolId}: dead href ${href}`);
  }
  return bad;
}

async function run({ apply, dir = CG, targets }) {
  const changed = [];
  const skipped = [];
  const dead = [];
  for (const page of targets) {
    const toolId = toolIdOf(page);
    const abs = resolve(dir, toolIdOf(page) + '.html');
    if (!existsSync(abs)) { skipped.push(`${page}: page missing in target dir`); continue; }
    let block;
    try { block = await buildBlock(toolId); }
    catch (e) { skipped.push(`${page}: ${e.message}`); continue; }
    dead.push(...checkHrefs(block, toolId));
    const before = readFileSync(abs, 'utf8');
    const after = withBlock(before, block);
    if (after !== before) {
      changed.push(page);
      if (apply) writeFileSync(abs, after);
    }
  }
  return { changed, skipped, dead, targets: targets.length };
}

async function selftest() {
  const fails = [];
  const sample = proofLinkPages().find((p) => /^chaingraph\/art-\d+/.test(p));
  if (!sample) { console.error('selftest: no art page to sample'); process.exit(2); }
  const tmp = mkdtempSync(join(tmpdir(), 'gen-proof-links-'));
  try {
    const fname = toolIdOf(sample) + '.html';
    const src = resolve(CG, fname);
    const dst = join(tmp, fname);
    copyFileSync(src, dst);

    const first = await run({ apply: true, dir: tmp, targets: [sample] });
    if (first.changed.length !== 1) fails.push(`write control: expected 1 change, got ${first.changed.length}`);
    if (first.dead.length) fails.push(`GREEN control: dead hrefs: ${first.dead.join('; ')}`);

    const written = readFileSync(dst, 'utf8');
    const span = blockSpan(written);
    if (!span) fails.push('write control: sentinels not present after write');
    const f = footerOffset(written);
    if (!span || f === -1 || !(span[1] <= f)) fails.push('block is not above the footer');

    const green = await run({ apply: false, dir: tmp, targets: [sample] });
    if (green.changed.length !== 0) fails.push(`GREEN control: expected 0 drift, got ${green.changed.length}`);

    const mutated = written.replace('Verification artifacts', 'Verification artifactss');
    if (mutated === written) fails.push('RED control: mutation target not found');
    writeFileSync(dst, mutated);
    const red = await run({ apply: false, dir: tmp, targets: [sample] });
    if (red.changed.length !== 1) fails.push(`RED control: expected 1 drift, got ${red.changed.length}`);

    writeFileSync(dst, written);
    await run({ apply: true, dir: tmp, targets: [sample] });
    const once = readFileSync(dst, 'utf8');
    await run({ apply: true, dir: tmp, targets: [sample] });
    if (readFileSync(dst, 'utf8') !== once) fails.push('second write was not byte-identical');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (fails.length) {
    console.error(`✗ gen-proof-links selftest FAILED on ${sample}:`);
    fails.forEach((x) => console.error('    ' + x));
    process.exit(1);
  }
  console.log(`✓ gen-proof-links selftest: block written above the footer, GREEN control 0 drift, mutated block RED, relative hrefs resolve, second write byte-identical (sample ${sample}).`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--paths')) { proofLinkPages().forEach((p) => console.log(p)); return; }
  if (args.includes('--selftest')) { await selftest(); return; }

  const check = args.includes('--check');
  const result = await run({ apply: !check, targets: proofLinkPages() });
  if (check) {
    const problems = [];
    if (result.changed.length) problems.push(`${result.changed.length} node page(s) differ from the generator: ${result.changed.slice(0, 12).join(', ')}${result.changed.length > 12 ? ', …' : ''}`);
    if (result.dead.length) problems.push(`${result.dead.length} dead relative href(s): ${result.dead.slice(0, 12).join('; ')}`);
    if (result.skipped.length) problems.push(`${result.skipped.length} page(s) skipped: ${result.skipped.slice(0, 12).join('; ')}`);
    if (problems.length) {
      console.error('✗ node-page proof-links are stale (PROOFLINKS-GEN-1). Main-side single writer: node scripts/gen-proof-links.mjs');
      problems.forEach((p) => console.error('    ' + p));
      process.exit(1);
    }
    console.log(`✓ proof links fresh: ${result.targets} node page(s) match the generator.`);
    return;
  }
  console.log(`gen-proof-links: wrote ${result.changed.length} of ${result.targets} node page(s)${result.changed.length ? ': ' + result.changed.slice(0, 12).join(', ') + (result.changed.length > 12 ? ', …' : '') : ''}.`);
  if (result.dead.length) console.log(`gen-proof-links: ${result.dead.length} dead relative href(s) in generated blocks: ${result.dead.slice(0, 12).join('; ')}`);
  if (result.skipped.length) console.log(`gen-proof-links: skipped ${result.skipped.length}: ${result.skipped.slice(0, 12).join('; ')}`);
}

const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (IS_CLI) main().catch((e) => { console.error(`gen-proof-links: ${e.stack || e.message}`); process.exit(1); });
