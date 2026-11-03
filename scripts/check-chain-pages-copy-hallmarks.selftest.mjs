#!/usr/bin/env node
/**
 * check-chain-pages-copy-hallmarks.selftest.mjs — paired control for the
 * check-copy-hallmarks gate, on the GENERATOR side (SO #34c pairing;
 * CHAIN-PAGES-COPY-HALLMARKS-FIX-1, sibling of CHAIN-PAGES-CANON-ORDER-FIX-1).
 *
 * The chain-page template still emitted reader-visible build code: stage tags
 * `ROOT · D0` / `D<n>` / `TERMINAL · D<n>`, the title `Chain Topology — …`
 * (em-dash in visible text), and an export description ending
 * `… — no new hash is minted.` Every NEWLY generated chain page was therefore
 * born failing check-copy-hallmarks.mjs at baseline 0 (a new page is absent
 * from scripts/copy-hallmarks-baseline.json, and files absent from the
 * baseline must be clean), which stopped DEPOSIT-INSURANCE-CHAIN-3 at its
 * step-4 gate (d).
 *
 * This control proves the generator's visible-text emission directly, with a
 * RED leg before the GREEN leg (absence of a RED is not a pass):
 *
 *   leg 0  template source precheck: none of the pre-fix literals remain;
 *   leg 1  a page generated from a live chain definition into a TEMP dir
 *          outside the repo is clean under the committed gate's own
 *          hallmarkFindings() battery on the buckets the template owns
 *          (em-dash 0, no `D0 badge code` hit — exactly the baseline-0
 *          predicate for a new file on the generator-owned buckets; residual
 *          chain-data tokens are out of the generator's fence);
 *   leg 2  the pre-fix emission (the four dirty literals restored in the
 *          generator source, byte-for-byte the strings measured at
 *          origin/main before this fix) is RED under the same committed
 *          battery — em-dashes present AND the `D0 badge code` jargon hit.
 *
 * Usage: node scripts/check-chain-pages-copy-hallmarks.selftest.mjs
 */

import { execFileSync } from 'node:child_process';
import {
  copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hallmarkFindings } from './check-copy-hallmarks.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));        // repo/scripts
const REPO = join(HERE, '..');

const GENERATOR = join(REPO, 'chaingraph', 'chains', 'build-chain-pages.mjs');
const CHAIN = 'treasury-clearing-collateral'; // CANON-ORDER-FIX-1 reference case, 3 steps

// The four pre-fix literals, byte-for-byte as measured at origin/main
// (CHAIN-PAGES-COPY-HALLMARKS-FIX-1 premise, SO #48).
const PREFIX_LITERALS = [
  // build-time stage tag (rendered into the static stage-card HTML, visible)
  [`const tag = n === 1 ? 'ROOT · TERMINAL' : (i === 0 ? 'ROOT' : (i === n - 1 ? 'TERMINAL' : 'STAGE ' + (i + 1)));`,
   `const tag = n === 1 ? 'ROOT · TERMINAL · D0' : (i === 0 ? 'ROOT · D0' : (i === n - 1 ? 'TERMINAL · D' + n : 'D' + (i + 1)));`],
  // dag title (visible)
  ['<div class="dag-title">Chain Topology: ',
   '<div class="dag-title">Chain Topology — '],
  // export description (visible)
  ['Both derive from the chain definition. Available after hash computation.',
   'Both derive from the chain definition — no new hash is minted. Available after hash computation.'],
  // runtime stage tag inside the page script (same convention, kept in step)
  [`var tagTxt = i === 0 ? 'ROOT' : (i === N - 1 ? 'TERMINAL' : 'STAGE ' + (i + 1));`,
   `var tagTxt = i === 0 ? 'ROOT · D0' : (i === N - 1 ? 'TERMINAL' : 'D' + (i + 1));`],
];

const fails = [];
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${detail && !cond ? ` — ${detail}` : ''}`);
  if (!cond) fails.push(label);
};

// ── leg 0: template source precheck ──────────────────────────────────────────
{
  const src = readFileSync(GENERATOR, 'utf8');
  ok(!src.includes('ROOT · D0'), 'leg0: template emits no ROOT · D0 stage tag');
  ok(!src.includes('Chain Topology —'), 'leg0: template emits no em-dash Chain Topology title');
  ok(!src.includes('no new hash is minted'), 'leg0: export description drops the em-dash clause');
  ok(src.includes("'STAGE ' + (i + 1)"), 'leg0: template emits STAGE <k> stage tags');
}

// ── generate pages from the live chain definition, outside the repo ─────────
let tmp;
try {
  tmp = mkdtempSync(join(tmpdir(), 'cpc-hallmarks-'));
  const tree = join(tmp, 'repo');
  // The generator's dependency closure (it resolves everything from its own path):
  // chaingraph/chaingraph.json, chaingraph/_page-chrome.mjs (reads chaingraph.json
  // beside itself and agent-kit/kit.json above itself), scripts/gen-chain-ask-agent.mjs.
  for (const d of ['chaingraph/chains', 'scripts', 'agent-kit']) {
    mkdirSync(join(tree, d), { recursive: true });
  }
  copyFileSync(join(REPO, 'chaingraph', 'chaingraph.json'), join(tree, 'chaingraph', 'chaingraph.json'));
  copyFileSync(join(REPO, 'chaingraph', '_page-chrome.mjs'), join(tree, 'chaingraph', '_page-chrome.mjs'));
  copyFileSync(GENERATOR, join(tree, 'chaingraph', 'chains', 'build-chain-pages.mjs'));
  copyFileSync(join(HERE, 'gen-chain-ask-agent.mjs'), join(tree, 'scripts', 'gen-chain-ask-agent.mjs'));
  copyFileSync(join(REPO, 'agent-kit', 'kit.json'), join(tree, 'agent-kit', 'kit.json'));

  const cg = JSON.parse(readFileSync(join(tree, 'chaingraph', 'chaingraph.json'), 'utf8'));
  const chain = (cg.chains ?? []).find((c) => c.name === CHAIN && c.steps?.length)
    ?? (cg.chains ?? []).find((c) => (c.steps?.length ?? 0) >= 3);
  if (!chain) throw new Error('no chain with >= 3 steps in chaingraph.json');

  const chainsDir = join(tree, 'chaingraph', 'chains');
  const generator = join(chainsDir, 'build-chain-pages.mjs');
  const generate = () => {
    rmSync(join(chainsDir, `${chain.name}.html`), { force: true });
    execFileSync(process.execPath, ['build-chain-pages.mjs', '--write', chain.name], {
      cwd: chainsDir, stdio: 'pipe',
    });
    return readFileSync(join(chainsDir, `${chain.name}.html`), 'utf8');
  };

  // ── leg 1: fixed emission is clean under the committed gate battery ───────
  const fixedHtml = generate();
  const fixed = hallmarkFindings(fixedHtml);
  ok(fixed.emdash === 0, 'leg1: fixed-template page has 0 em-dashes in visible text',
    `emdash=${fixed.emdash}`);
  ok(!(fixed.jargon ?? []).some((j) => j.includes('D0 badge code')),
    'leg1: fixed-template page trips no D0 badge code jargon',
    (fixed.jargon ?? []).join('; '));
  // Residual data-side hits (e.g. a `W-D` token inside a chain's own copy) are
  // chain-content debt, not generator emission — the generator cannot own them,
  // and this control only proves the template's visible-text emission.
  ok(fixedHtml.includes('>ROOT<') && fixedHtml.includes('>STAGE 2<') && fixedHtml.includes('>TERMINAL<'),
    'leg1: fixed-template page renders ROOT / STAGE 2 / TERMINAL stage tags');
  ok(fixedHtml.includes('Chain Topology: '), 'leg1: fixed-template page title uses the colon form');

  // ── leg 2: pre-fix emission (the origin/main literals) is RED ─────────────
  let preSrc = readFileSync(generator, 'utf8');
  for (const [fixedLit, prefixLit] of PREFIX_LITERALS) {
    if (!preSrc.includes(fixedLit)) throw new Error(`pre-fix patch: fixed literal not found: ${fixedLit.slice(0, 60)}`);
    preSrc = preSrc.split(fixedLit).join(prefixLit);
  }
  writeFileSync(generator, preSrc);
  const origHtml = generate();
  const orig = hallmarkFindings(origHtml);
  ok(orig.emdash > 0, 'leg2: pre-fix page has em-dashes in visible text (RED leg present)',
    `emdash=${orig.emdash}`);
  ok((orig.jargon ?? []).some((j) => j.includes('D0 badge code')),
    'leg2: pre-fix page trips the D0 badge code jargon rule (RED leg present)',
    (orig.jargon ?? []).join('; '));
  console.log(`     pre-fix battery: emdash=${orig.emdash} jargon=[${(orig.jargon ?? []).join('; ')}]`);
} catch (e) {
  fails.push(`exception: ${e.message}`);
  console.error(e.stack);
} finally {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}

console.log(fails.length
  ? `\ncheck-chain-pages-copy-hallmarks.selftest: ${fails.length} control(s) FAILED:\n  - ${fails.join('\n  - ')}`
  : '\ncheck-chain-pages-copy-hallmarks.selftest: OK — generator copy-hallmark controls green (RED leg quoted above).');
process.exit(fails.length ? 1 : 0);
