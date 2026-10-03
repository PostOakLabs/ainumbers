#!/usr/bin/env node
/**
 * scripts/gen-chain-ask-agent.mjs — CHAIN-PROMPT-INFRA-1
 *
 * WHY: the chain example prompt is authored once, in
 * chaingraph/chain-prompts/<chain>.json, and read by agents on the chain page.
 * Rendering it is therefore a derived artifact with ONE main-side writer (SO
 * #35), the D1(b) shape FOOTER-INFRA-COLUMN-1 established: a row commits the
 * JSON, main's regen writes the page region after merge. This script is that
 * writer. It touches nothing outside its marker pair, so the WebMCP chain
 * block, the plan-hash reads and the hand-built runner regions on the same
 * pages stay byte-identical.
 *
 * SCOPE, and the two deliberate skips:
 *   - agentic-policy is the protected hand-built runner page (the same page
 *     build-chain-pages.mjs refuses), so it is never written here.
 *   - A chain whose page is not chaingraph/chains/<chain>.json's sibling
 *     chaingraph/chains/<chain>.html renders nothing: its prompt still ships in
 *     the SSOT and the gate still validates it (decision F4). Measured
 *     2026-09-27: 11 of 370 chains have no such page — 3 whose composer_url is
 *     a NODE page (government-payment-lifecycle among them) and 8 whose page
 *     carries a `-composer` suffix. `--skips` prints the live list, so a
 *     backfill row sees the reason instead of silence.
 *
 * The page list is computed from the prompt directory and the chains directory
 * ONLY. It never reads chaingraph.json, because scripts/derived-artifacts.mjs
 * imports this file to declare `writes`/`artifacts` and the assembler imports
 * derived-artifacts: a graph read at import time would let a malformed
 * chaingraph.json crash the very assembler that exists to rebuild it (the
 * gen-node-footers lesson). chaingraph/_page-chrome.mjs parses the graph at
 * import, so it is loaded LAZILY, inside the render path, never at top level.
 *
 * Exit codes: the write run exits 0 even when a page is skipped (it prints the
 * skip), so one odd page never stops main's whole regen pass; --check is the
 * alarm and exits 1 on drift or on a page it could not write.
 *
 * Usage:
 *   node scripts/gen-chain-ask-agent.mjs            # write every stale region (main-side regen)
 *   node scripts/gen-chain-ask-agent.mjs --check    # exit 1 on drift or an unwritable page
 *   node scripts/gen-chain-ask-agent.mjs --paths    # the page list this writer owns
 *   node scripts/gen-chain-ask-agent.mjs --skips    # chains with a prompt but no page of their own
 *   node scripts/gen-chain-ask-agent.mjs --selftest # RED + GREEN controls on a scratch copy
 *
 * Zero-dependency: node builtins only (STANDING ORDER #10). Deterministic: the
 * output is a pure function of the prompt file and the page bytes.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROMPT_DIR = resolve(REPO, 'chaingraph', 'chain-prompts');
const CHAINS_DIR = resolve(REPO, 'chaingraph', 'chains');

/** The hand-built gold-standard runner page, protected in build-chain-pages.mjs. */
export const PROTECTED = new Set(['agentic-policy']);

/** Chain names with a prompt file on disk, sorted. */
function promptChains() {
  if (!existsSync(PROMPT_DIR)) return [];
  return readdirSync(PROMPT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((c) => !PROTECTED.has(c))
    .sort();
}

/** Repo-relative page paths this writer may write; derived-artifacts.mjs
 *  declares exactly this list as the entry's `writes` and `artifacts`. */
export function chainAskAgentPages() {
  return promptChains()
    .filter((c) => existsSync(resolve(CHAINS_DIR, `${c}.html`)))
    .map((c) => `chaingraph/chains/${c}.html`);
}

/** Chains with a prompt file and no page of their own, with the reason. */
export function chainAskAgentSkips() {
  return promptChains()
    .filter((c) => !existsSync(resolve(CHAINS_DIR, `${c}.html`)))
    .map((c) => ({ chain: c, reason: 'no chaingraph/chains/<chain>.html page of its own (SSOT only, decision F4)' }));
}

// chaingraph/_page-chrome.mjs reads chaingraph.json at import, so it loads only
// when a run needs to render — never when derived-artifacts.mjs imports this file.
async function chrome() {
  return import(pathToFileURL(resolve(REPO, 'chaingraph', '_page-chrome.mjs')).href);
}

/**
 * Splice one region into one page. PURE. Returns the next bytes, or null when
 * the page carries no insertion point.
 *   - markers present  -> replace exactly what sits between them
 *   - markers absent   -> insert the region and one newline before the <footer>
 *     that opens a line (the anchor every chain page has: measured 359 of 359
 *     with a page on 2026-09-27, while only 298 carry the older
 *     `</div><!-- /container -->` line)
 */
export function spliceRegion(html, region, { begin, end }) {
  const a = html.indexOf(begin);
  if (a !== -1) {
    const b = html.indexOf(end, a);
    if (b === -1) return null;
    return html.slice(0, a) + region + html.slice(b + end.length);
  }
  const m = /^<footer/m.exec(html);
  if (!m) return null;
  return html.slice(0, m.index) + region + '\n' + html.slice(m.index);
}

/**
 * Carry an existing region from the OLD bytes of a page into freshly rendered
 * bytes, at the same anchor. Byte-verbatim, so the caller is not a second
 * writer of the region: if the prompt moved, this writer refreshes it on the
 * next pass. Lives here so the marker pair and the anchor rule have ONE owner;
 * chaingraph/chains/build-chain-pages.mjs imports it for its rebuild path.
 */
export function carryRegion(oldHtml, newHtml, { begin, end }) {
  if (!oldHtml) return newHtml;
  const a = oldHtml.indexOf(begin);
  if (a === -1) return newHtml;
  const b = oldHtml.indexOf(end, a);
  if (b === -1) return newHtml;
  return spliceRegion(newHtml, oldHtml.slice(a, b + end.length), { begin, end });
}

/** Marker pair for one chain, from the shared template. */
function markers(mod, chain) {
  return { begin: mod.chainAskAgentBeginLine(chain), end: mod.CHAIN_ASK_AGENT_END };
}

async function run({ apply, dir = CHAINS_DIR, promptDir = PROMPT_DIR, only = null }) {
  const mod = await chrome();
  const chains = (only ?? promptChains()).filter((c) => existsSync(resolve(dir, `${c}.html`)));
  const result = { targets: [], changed: [], skipped: [] };
  for (const chain of chains) {
    const file = resolve(dir, `${chain}.html`);
    const rel = `chaingraph/chains/${chain}.html`;
    result.targets.push(rel);
    const prompt = JSON.parse(readFileSync(resolve(promptDir, `${chain}.json`), 'utf8'));
    const region = mod.buildChainAskAgentBlock(prompt);
    const current = readFileSync(file, 'utf8');
    const next = spliceRegion(current, region, markers(mod, chain));
    if (next === null) {
      result.skipped.push({ file: rel, reason: 'no CHAIN-ASK-AGENT marker pair and no <footer> line to anchor to' });
      continue;
    }
    if (next === current) continue;
    result.changed.push(rel);
    if (apply) writeFileSync(file, next, 'utf8');
  }
  return result;
}

async function selftest() {
  const fails = [];
  const pages = chainAskAgentPages();
  if (!pages.length) { console.error('selftest: no chain page carries a prompt file'); process.exit(2); }
  const sample = pages[0].replace('chaingraph/chains/', '').replace(/\.html$/, '');
  const mod = await chrome();
  const tmp = mkdtempSync(join(tmpdir(), 'gen-chain-ask-agent-'));
  try {
    copyFileSync(resolve(CHAINS_DIR, `${sample}.html`), join(tmp, `${sample}.html`));
    const before = readFileSync(join(tmp, `${sample}.html`), 'utf8');

    // 1. The first write inserts the region and changes nothing else.
    await run({ apply: true, dir: tmp, only: [sample] });
    const written = readFileSync(join(tmp, `${sample}.html`), 'utf8');
    const { begin, end } = markers(mod, sample);
    // Compare the two pages with the region (and the newline the insert adds)
    // removed from each, so the assertion holds whether the sample page already
    // carried a region on disk or not.
    const withoutRegion = (html) => {
      const a = html.indexOf(begin);
      if (a === -1) return html;
      const b = html.indexOf(end, a);
      if (b === -1) return html;
      const after = html[b + end.length] === '\n' ? b + end.length + 1 : b + end.length;
      return html.slice(0, a) + html.slice(after);
    };
    if (written.indexOf(begin) === -1 || written.indexOf(end) === -1) fails.push('region markers absent after the write');
    else {
      if (withoutRegion(written) !== withoutRegion(before)) fails.push('the write changed bytes outside the region');
      if (!written.includes('Ask your agent')) fails.push('the written region carries no heading');
    }

    // 2. GREEN: a freshly written page reads as fresh.
    const green = await run({ apply: false, dir: tmp, only: [sample] });
    if (green.changed.length !== 0 || green.skipped.length !== 0) {
      fails.push(`GREEN control: expected 0 drift, got ${green.changed.length} drift / ${green.skipped.length} skip`);
    }

    // 3. RED: one hand-edited word inside the region reads as drift.
    const mutated = written.replace('Ask your agent', 'Ask your agentt');
    if (mutated === written) fails.push('RED control: mutation target not found in the region');
    writeFileSync(join(tmp, `${sample}.html`), mutated);
    const red = await run({ apply: false, dir: tmp, only: [sample] });
    if (red.changed.length !== 1) fails.push(`RED control: expected 1 drift, got ${red.changed.length}`);

    // 4. RED: a page with no marker pair and no <footer> anchor is a SKIP, not
    //    a silent pass (the --check leg exits 1 on it).
    writeFileSync(join(tmp, `${sample}.html`), '<html><body><p>no anchor here</p></body></html>');
    const anchorless = await run({ apply: false, dir: tmp, only: [sample] });
    if (anchorless.skipped.length !== 1) fails.push(`RED control: an anchorless page should skip, got ${anchorless.skipped.length} skip(s)`);

    // 5. Carry-through: a page REBUILT from the chain template (the shape
    //    build-chain-pages.mjs --write produces, simulated here by dropping the
    //    region) keeps the region when carryRegion() runs over the old bytes.
    const rebuilt = withoutRegion(written);
    const carried = carryRegion(written, rebuilt, { begin, end });
    if (carried !== written) fails.push('carryRegion did not restore the region byte-identically into a rebuilt page');
    if (carryRegion('', rebuilt, { begin, end }) !== rebuilt) fails.push('carryRegion changed a rebuilt page when there was nothing to carry');

    // 6. Idempotent: a second write of a fresh copy is byte-identical.
    copyFileSync(resolve(CHAINS_DIR, `${sample}.html`), join(tmp, `${sample}.html`));
    await run({ apply: true, dir: tmp, only: [sample] });
    const once = readFileSync(join(tmp, `${sample}.html`), 'utf8');
    await run({ apply: true, dir: tmp, only: [sample] });
    if (readFileSync(join(tmp, `${sample}.html`), 'utf8') !== once) fails.push('second write was not byte-identical');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (fails.length) {
    console.error(`✗ gen-chain-ask-agent selftest FAILED on ${sample}:`);
    fails.forEach((f) => console.error('    ' + f));
    process.exit(1);
  }
  console.log(`✓ gen-chain-ask-agent selftest: write is region-only, fresh page GREEN, hand-edited region RED, anchorless page skips, second write byte-identical (sample ${sample}).`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--paths')) { chainAskAgentPages().forEach((p) => console.log(p)); return; }
  if (args.includes('--skips')) {
    const skips = chainAskAgentSkips();
    skips.forEach((s) => console.log(`${s.chain}: ${s.reason}`));
    console.log(`${skips.length} chain(s) with a prompt render nowhere.`);
    return;
  }
  if (args.includes('--selftest')) { await selftest(); return; }

  const check = args.includes('--check');
  const result = await run({ apply: !check });
  const skips = chainAskAgentSkips();

  if (check) {
    const problems = [];
    if (result.changed.length) problems.push(`${result.changed.length} chain page region(s) differ from chaingraph/chain-prompts/: ${result.changed.slice(0, 12).join(', ')}${result.changed.length > 12 ? ', …' : ''}`);
    if (result.skipped.length) problems.push(`${result.skipped.length} page(s) had no insertion point: ${result.skipped.map((s) => `${s.file} (${s.reason})`).join('; ')}`);
    if (problems.length) {
      console.error('✗ chain ask-agent regions are stale (CHAIN-PROMPT-INFRA-1). Main-side single writer: node scripts/gen-chain-ask-agent.mjs');
      problems.forEach((p) => console.error('    ' + p));
      process.exit(1);
    }
    console.log(`✓ chain ask-agent regions fresh: ${result.targets.length} page(s) match their prompt file (${skips.length} chain(s) SSOT only).`);
    return;
  }

  console.log(`gen-chain-ask-agent: wrote ${result.changed.length} of ${result.targets.length} page(s)${result.changed.length ? ': ' + result.changed.slice(0, 12).join(', ') + (result.changed.length > 12 ? ', …' : '') : ''}${skips.length ? `; ${skips.length} chain(s) SSOT only (--skips)` : ''}.`);
  if (result.skipped.length) console.log(`gen-chain-ask-agent: skipped ${result.skipped.length} (the --check gate reports these): ${result.skipped.map((s) => s.file).join(', ')}`);
}

const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (IS_CLI) main().catch((e) => { console.error(`gen-chain-ask-agent: ${e.stack || e.message}`); process.exit(1); });
