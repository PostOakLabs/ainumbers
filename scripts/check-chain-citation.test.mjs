#!/usr/bin/env node
/**
 * check-chain-citation.test.mjs — paired self-test for check-chain-citation.mjs's
 * process-order extension (CHAIN-CITATION-PROCESS-ORDER-1, SO #40b: a checker
 * that cannot be shown red proves nothing).
 *
 * Drives the exported PURE functions (chainNamesStatutoryProcess /
 * validateProcessDeclaration / evaluateProcessOrder / pruneBaselineEntries)
 * over the row's five required controls, then validates the SHIPPED artifacts
 * (registry declarations + baseline) against the same validators:
 *
 *   RED      — a chain naming a statutory process with neither declaration
 *              fails, NAMING the chain.
 *   GREEN(1) — a pinned process_order passes (ordered cited locators, quoted).
 *   GREEN(2) — an explicit sequence_not_statutory:true also passes.
 *   BASELINE — an enumerated legacy chain passes shielded; a NEW undeclared
 *              chain FAILS; counts only go down (--prune drops decliners;
 *              there is no --update).
 *   UNCHANGED— chains naming no statutory process are untouched.
 *
 * Run: node scripts/check-chain-citation.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STATUTORY_PROCESS_MARKERS,
  chainNamesStatutoryProcess,
  evaluateProcessOrder,
  validateProcessDeclaration,
  pruneBaselineEntries,
} from './check-chain-citation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

let pass = 0;
const fails = [];
function check(desc, cond) {
  if (cond) {
    pass++;
    console.log(`  ok: ${desc}`);
  } else {
    fails.push(desc);
    console.error(`  FAIL: ${desc}`);
  }
}
function section(n, title) {
  console.log(`\n[${n}] ${title}`);
}

// ── fixtures ────────────────────────────────────────────────────────────────
const PINNED_ORDER = {
  process_order: {
    declared_by: 'TEST',
    declared_at: '2026-08-29',
    legs: [
      {
        process: 'screening before financing',
        status: 'pinned',
        order: [
          { step: 'screening', locator: 'Loc A', quoted: 'quote A' },
          { step: 'financing', locator: 'Loc B', quoted: 'quote B' },
        ],
      },
    ],
  },
};
const NOT_STATUTORY = { sequence_not_statutory: true, basis: 'framework prescribes content, not sequence (J9 §2)' };
const PARTIAL = {
  process_order: {
    declared_by: 'TEST',
    declared_at: '2026-08-29',
    legs: [
      { process: 'pinned leg', status: 'pinned', order: [{ step: 'a', locator: 'L1', quoted: 'Q1' }] },
      { process: 'unretrieved leg', status: 'unretrieved', note: 'paywalled; never filled from memory' },
    ],
  },
};
const PROCESS_CHAIN = {
  name: 'fixture-process-chain',
  title: 'Trade Finance Letter of Credit Lifecycle',
  description: 'LC analysis > sanctions screening: composite mandate.',
};
const PLAIN_CHAIN = {
  name: 'fixture-plain-chain',
  title: 'Invoice Matching Workbench',
  description: 'Matches line items > computes variance: composite matching receipt.',
};

// ── 1. UNCHANGED: chains naming no statutory process are untouched ─────────
section(1, 'UNCHANGED — no statutory process named, gate untouched (quote the count)');
check('plain chain triggers nothing', chainNamesStatutoryProcess(PLAIN_CHAIN).length === 0);
check('plain chain evaluates untriggered', evaluateProcessOrder(PLAIN_CHAIN).state === 'untriggered');
check('plain chain stays untriggered even with empty baseline+registry', evaluateProcessOrder(PLAIN_CHAIN, { registry: {}, baseline: new Set() }).state === 'untriggered');
check('every marker carries a human-readable label', STATUTORY_PROCESS_MARKERS.every((m) => typeof m.label === 'string' && m.label.length > 0 && m.re instanceof RegExp));

// ── 2. RED: trigger + neither declaration + unbaselined ────────────────────
section(2, 'RED — a chain naming a statutory process with neither declaration FAILS, naming the chain');
const red = evaluateProcessOrder(PROCESS_CHAIN, { registry: {}, baseline: new Set() });
check('verdict is fail', red.state === 'fail');
check('failure names the chain', JSON.stringify(red).includes('fixture-process-chain'));
check('failure names the matched process', /letter of credit|sanctions/i.test(red.reasons.join(' ')));
check('an undeclared NEW chain fails even when OTHER chains are baselined', evaluateProcessOrder(PROCESS_CHAIN, { registry: {}, baseline: new Set(['some-other-chain']) }).state === 'fail');

// ── 3. GREEN both shapes ────────────────────────────────────────────────────
section(3, 'GREEN — a pinned process_order passes; sequence_not_statutory:true also passes');
check('pinned process_order (registry) passes', evaluateProcessOrder(PROCESS_CHAIN, { registry: { 'fixture-process-chain': PINNED_ORDER }, baseline: new Set() }).state === 'declared');
check('pinned process_order (in-shard) passes', evaluateProcessOrder({ ...PROCESS_CHAIN, ...PINNED_ORDER }, {}).state === 'declared');
check('sequence_not_statutory:true passes', evaluateProcessOrder(PROCESS_CHAIN, { registry: { 'fixture-process-chain': NOT_STATUTORY }, baseline: new Set() }).state === 'declared');
check('sequence_not_statutory:true passes in-shard', evaluateProcessOrder({ ...PROCESS_CHAIN, sequence_not_statutory: true }, {}).state === 'declared');
check('partial shape (pinned leg + visibly marked unretrieved leg, J9 §0) passes', validateProcessDeclaration(PARTIAL).ok);
check('a gate that only accepted one shape would fail here — both shapes are first-class', validateProcessDeclaration(NOT_STATUTORY).ok && validateProcessDeclaration(PINNED_ORDER).ok);

// ── 4. Malformed declarations are RED, not passes (mutation-proof the verdict) ──
section(4, 'MUTATION — tampering with a declaration turns the verdict RED');
const mutations = [
  ['empty legs', { process_order: { declared_by: 'T', declared_at: '2026-08-29', legs: [] } }],
  ['missing declared_by', { process_order: { declared_at: '2026-08-29', legs: PINNED_ORDER.process_order.legs } }],
  ['missing declared_at', { process_order: { declared_by: 'T', legs: PINNED_ORDER.process_order.legs } }],
  ['prose instead of locators', { process_order: { declared_by: 'T', declared_at: '2026-08-29', legs: [{ process: 'p', status: 'pinned', order: ['screen first, then finance'] }] } }],
  ['locator without quoted phrase', { process_order: { declared_by: 'T', declared_at: '2026-08-29', legs: [{ process: 'p', status: 'pinned', order: [{ step: 'a', locator: 'L1' }] }] } }],
  ['unknown leg status', { process_order: { declared_by: 'T', declared_at: '2026-08-29', legs: [{ process: 'p', status: 'pending', order: [] }] } }],
  ['unretrieved leg without note', { process_order: { declared_by: 'T', declared_at: '2026-08-29', legs: [{ process: 'p', status: 'unretrieved' }] } }],
  ['all legs unretrieved', { process_order: { declared_by: 'T', declared_at: '2026-08-29', legs: [{ process: 'p', status: 'unretrieved', note: 'paywalled' }] } }],
  ['both shapes at once', { process_order: PINNED_ORDER.process_order, sequence_not_statutory: true }],
  ['sequence_not_statutory as a string', { sequence_not_statutory: 'true' }],
  ['empty declaration object', {}],
];
for (const [label, decl] of mutations) {
  check(`mutation rejects: ${label}`, validateProcessDeclaration(decl).ok === false);
}
check('mutation through evaluateProcessOrder goes RED', evaluateProcessOrder(PROCESS_CHAIN, { registry: { 'fixture-process-chain': mutations[4][1] }, baseline: new Set() }).state === 'fail');

// ── 5. BASELINE: legacy shielded, NEW fails, counts only go down ────────────
section(5, 'BASELINE — enumerated legacy passes shielded; a NEW undeclared chain FAILS');
const baseline = new Set(['fixture-process-chain']);
check('enumerated legacy chain passes shielded', evaluateProcessOrder(PROCESS_CHAIN, { registry: {}, baseline }).state === 'baselined');
check('a NEW undeclared chain (absent from baseline) FAILS', evaluateProcessOrder({ ...PROCESS_CHAIN, name: 'brand-new-chain' }, { registry: {}, baseline }).state === 'fail');
check('baseline shielding does NOT rescue a malformed declaration', evaluateProcessOrder(PROCESS_CHAIN, { registry: { 'fixture-process-chain': mutations[4][1] }, baseline }).state === 'fail');
const baselineMap = { 'fixture-process-chain': 'Trade Finance Letter of Credit Lifecycle', 'gone-chain': 'Removed Chain' };
const chains = [PROCESS_CHAIN, PLAIN_CHAIN];
const pruned = pruneBaselineEntries(baselineMap, chains);
check('--prune drops the entry whose chain now declares (or vanished)', JSON.stringify(pruned) === JSON.stringify(['gone-chain']));
check('--prune KEEPS the entry whose chain is still undeclared-but-triggering', !pruned.includes('fixture-process-chain'));

// ── 6. SHIPPED ARTIFACTS: registry + baseline validate against the same rules ──
section(6, 'SHIPPED — the two row declarations and the baseline validate');
const registryPath = resolve(HERE, 'chain-process-order-declarations.json');
const baselinePath = resolve(HERE, 'chain-process-order-baseline.json');
check('registry exists', existsSync(registryPath));
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
check('registry has a declarations map', registry.declarations && typeof registry.declarations === 'object');
for (const required of ['trade-finance-lc-lifecycle', 'wealth-advisory-regbi']) {
  const decl = registry.declarations[required];
  check(`registry declares ${required}`, decl !== undefined);
  if (decl) {
    const v = validateProcessDeclaration(decl);
    check(`${required} declaration is a valid ${decl.process_order ? 'process_order' : 'sequence_not_statutory'}`, v.ok);
    if (!v.ok) console.error('    validator errors: ' + v.errors.join(' | '));
  }
}
const entry1 = registry.declarations['trade-finance-lc-lifecycle'];
check('entry 1 (F1) carries the UCP 600 leg UNRETRIEVED, visibly, never filled from memory', entry1.process_order.legs.some((l) => l.status === 'unretrieved' && /UCP 600/.test(l.process) && typeof l.note === 'string' && l.note.length > 20));
check('entry 1 (F1) carries the OFAC leg pinned with locator + quoted', entry1.process_order.legs.some((l) => l.status === 'pinned' && /OFAC/.test(l.process) && l.order.every((s) => s.locator && s.quoted)));
check('entry 2 (F2) carries Reg BI / Form CRS locators pinned', (() => {
  const e2 = registry.declarations['wealth-advisory-regbi'];
  const locators = JSON.stringify(e2);
  return /240\.15l-1/.test(locators) && /17a-14/.test(locators) && e2.process_order.legs.every((l) => l.status === 'pinned');
})());
check('baseline exists (missing baseline is RED in the gate, SO #34c)', existsSync(baselinePath));
const baselineJson = JSON.parse(readFileSync(baselinePath, 'utf8'));
check('baseline enumerates chains by name', baselineJson.chains && typeof baselineJson.chains === 'object');
check('baseline does NOT shield the two declared entries', !baselineJson.chains['trade-finance-lc-lifecycle'] && !baselineJson.chains['wealth-advisory-regbi']);
check('baseline is well-formed against the loader rules (chains map of name->title)', Object.entries(baselineJson.chains).every(([k, v]) => typeof k === 'string' && k.length > 0 && typeof v === 'string'));

// ── 7. TRIGGER SANITY on the two real row entries ───────────────────────────
section(7, 'TRIGGER — the two named row chains really do trigger the marker list');
check('trade-finance-lc-lifecycle title triggers', chainNamesStatutoryProcess({ title: 'Trade Finance Letter of Credit Lifecycle', description: '' }).length > 0);
check('wealth-advisory-regbi title triggers', chainNamesStatutoryProcess({ title: 'US Wealth & Advisory — Reg BI Suitability', description: '' }).length > 0);

console.log(`\n${fails.length === 0 ? 'PASS' : 'FAIL'}: check-chain-citation process-order controls — ${pass} passed, ${fails.length} failed.`);
if (fails.length) {
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
