#!/usr/bin/env node
/**
 * check-chain-pages-canon-order.selftest.mjs — paired control for the
 * check-canon-order gate, on the GENERATOR side (SO #34c pairing;
 * CHAIN-PAGES-CANON-ORDER-FIX-1).
 *
 * CANON-ORDER-1 fixed the pages and the add_proof_binding* injectors, but
 * chaingraph/chains/build-chain-pages.mjs still emitted the `OCG-CANON v1`
 * <script> AFTER the main chain script, so every page it generated was born
 * violating the ordering predicate check-canon-order.mjs enforces (the
 * load-time `init` IIFE reaches __ocgCanonStr before its classic-script
 * declaration block has parsed — a ReferenceError kills the §4 hash surface).
 *
 * This control proves the generator's emission directly, with a RED leg before
 * the GREEN leg (absence of a RED is not a pass):
 *
 *   leg 0  the template emits the canon block before its first use
 *          (source-level precheck: def-index < use-index);
 *   leg 1  a page generated from a live chain definition into a TEMP dir
 *          outside the repo is GREEN under the committed gate script;
 *   leg 2  the pre-fix emission (canon block relocated after the main chain
 *          script — the byte layout the old template produced) is RED under
 *          the same committed gate script, run as a subprocess so the gate,
 *          not a reimplementation of it, decides;
 *   leg 3  fixed vs pre-fix pages are a pure block move: identical line
 *          multiset, exactly one canon block in each, byte-identical canon
 *          body (the DO NOT hand-edit invariant from CANON-ORDER-1).
 *
 * Usage: node scripts/check-chain-pages-canon-order.selftest.mjs
 */

import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));        // repo/scripts
const REPO = join(HERE, '..');

const GENERATOR = join(REPO, 'chaingraph', 'chains', 'build-chain-pages.mjs');
const GATE = join(HERE, 'check-canon-order.mjs');
const CANON_MARK = '/* OCG-CANON v1';
const CHAIN = 'treasury-clearing-collateral'; // CANON-ORDER-1 reference case

const fails = [];
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${detail && !cond ? ` — ${detail}` : ''}`);
  if (!cond) fails.push(label);
};

// ── leg 0: template source order ─────────────────────────────────────────────
{
  const src = readFileSync(GENERATOR, 'utf8');
  const use = src.indexOf('__ocgCanonStr(obj)');
  const def = src.indexOf(CANON_MARK);
  ok(use >= 0 && def >= 0, 'leg0: template declares a canon block and uses __ocgCanonStr(obj)',
    `use@${use} def@${def}`);
  ok(def < use, 'leg0: canon block is emitted before the main script first uses it (precheck inverted)',
    `def@${def} > use@${use}`);
  ok(src.split(CANON_MARK).length - 1 === 1, 'leg0: exactly one canon block in the template');
}

// ── generate a page from a live chain definition, outside the repo ──────────
let tmp;
try {
  tmp = mkdtempSync(join(tmpdir(), 'cpc-order-'));
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
    ?? (cg.chains ?? []).find((c) => c.steps?.length);
  if (!chain) throw new Error('no chain with steps in chaingraph.json');
  const chainsDir = join(tree, 'chaingraph', 'chains');
  execFileSync(process.execPath, ['build-chain-pages.mjs', '--write', chain.name], {
    cwd: chainsDir, stdio: 'pipe',
  });
  const fixedHtml = readFileSync(join(chainsDir, `${chain.name}.html`), 'utf8');

  // ── leg 1: fixed emission is GREEN under the committed gate script ────────
  const canonStart = fixedHtml.indexOf(`<script>\n${CANON_MARK}`);
  const canonEnd = fixedHtml.indexOf('</script>', canonStart);
  const canonBlock = fixedHtml.slice(canonStart, canonEnd + '</script>'.length);
  ok(canonStart !== -1 && canonEnd !== -1, 'leg1: generated page carries an OCG-CANON script block');

  function runGate(html, rootName) {
    // Temp checkout root so REPO_ROOT-relative scanning (chaingraph/, tools/,
    // guides/) finds exactly the page under test and nothing else.
    const root = join(tmp, rootName);
    mkdirSync(join(root, 'chaingraph'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    writeFileSync(join(root, 'chaingraph', `${chain.name}.html`), html);
    copyFileSync(GATE, join(root, 'scripts', 'check-canon-order.mjs'));
    return spawnSync(process.execPath, ['scripts/check-canon-order.mjs'], {
      cwd: root, encoding: 'utf8',
    });
  }

  const fixedRun = runGate(fixedHtml, 'gate-fixed');
  ok(fixedRun.status === 0, 'leg1: fixed-template page is GREEN under check-canon-order.mjs',
    `exit=${fixedRun.status} ${(fixedRun.stderr || fixedRun.stdout || '').trim().split('\n')[0]}`);
  console.log(`     ${chain.name}.html (fixed):  ${(fixedRun.stdout || '').trim().split('\n').pop()}`);

  // ── leg 2: pre-fix emission (canon AFTER main script) is RED ──────────────
  // Relocate the canon block to the tail position the old template emitted it
  // in: after the main chain script, immediately before </body></html>.
  // Fixed layout:   prefix + CANON + "\n" + MAIN + "\n</body></html>"
  // Pre-fix layout: prefix + MAIN  + "\n" + CANON + "\n</body></html>"
  const bodyClose = fixedHtml.lastIndexOf('</body></html>');
  const tail = fixedHtml.slice(bodyClose + '</body></html>'.length); // trailing "\n"
  const prefix = fixedHtml.slice(0, canonStart);                    // ends "</footer>\n\n"
  const main = fixedHtml.slice(canonEnd + '</script>'.length, bodyClose); // "\n<script>'use strict'…</script>\n"
  const origHtml = prefix + main.slice(1) + canonBlock + '\n</body></html>' + tail;

  const origRun = runGate(origHtml, 'gate-orig');
  const redLine = (origRun.stderr || '').split('\n').find((l) => l.startsWith('FAIL'));
  ok(origRun.status === 1 && !!redLine,
    'leg2: pre-fix emission (canon after main script) is RED under check-canon-order.mjs',
    `exit=${origRun.status}`);
  console.log(`     ${chain.name}.html (pre-fix): ${redLine || '(no FAIL line)'}`);

  // ── leg 3: fixed vs pre-fix is a pure block move ──────────────────────────
  const multiset = (s) => s.split('\n').sort().join('\n');
  ok(multiset(fixedHtml) === multiset(origHtml),
    'leg3: fixed vs pre-fix pages have an identical line multiset (pure block move)');
  const canonBody = canonBlock.slice(canonBlock.indexOf(CANON_MARK));
  ok(origHtml.includes(canonBody), 'leg3: canon body bytes identical in both (DO NOT hand-edit holds)');
  for (const [name, html] of [['fixed', fixedHtml], ['pre-fix', origHtml]]) {
    ok(html.split(CANON_MARK).length - 1 === 1, `leg3: exactly one canon block in ${name} page`);
  }
} catch (e) {
  fails.push(`exception: ${e.message}`);
  console.error(e.stack);
} finally {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}

console.log(fails.length
  ? `\ncheck-chain-pages-canon-order.selftest: ${fails.length} control(s) FAILED:\n  - ${fails.join('\n  - ')}`
  : '\ncheck-chain-pages-canon-order.selftest: OK — generator emission controls green (RED leg quoted above).');
process.exit(fails.length ? 1 : 0);
