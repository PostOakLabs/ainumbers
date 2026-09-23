#!/usr/bin/env node
/**
 * scripts/check-evidence-register.test.mjs — EVREG-1's paired mutation
 * self-test (GATE-SELFTEST-META-1: a new blocking gate must ship a paired
 * control proving it CAN go red, not just that it currently reads green).
 *
 * Pure in-memory fixtures via evaluateRegister() — never touches the real
 * evidence/claims.src.json, the real evidence/claims.json, source/*.txt or
 * the ratchet baseline, so this stays valid regardless of what the live
 * register carries. The ratchet-baseline loader's hard-fail states are
 * exercised through its PURE validateRatchetBaseline() (the same split
 * ratchet-baseline.test.mjs uses), never through the exiting CLI wrapper.
 *
 * Usage: node scripts/check-evidence-register.test.mjs
 */
import { evaluateRegister } from './check-evidence-register.mjs';
import {
  hashText, extractClaimLine, snapshotTextFor, snapshotRel, buildRegister,
  countKeyFromAnchor, maskCountSentinels, classifySentinelDrift,
} from './gen-evidence-register.mjs';
import { validateRatchetBaseline, RatchetBaselineError } from './ratchet-baseline.mjs';

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log(`✗ ${msg}`); }
  else console.log(`✓ ${msg}`);
}
const kindsOf = (r) => new Set(r.findings.map((f) => f.kind));

const TODAY = '2026-09-22';
const PAGE_LINE = '<div class="stat"><div class="stat-n" data-count="mcp.live"><!--COUNT:mcp.live-->719<!--/COUNT--></div><div class="stat-l">Live MCP Tools</div></div>';
const PAGE_TEXT = `<html>\n<body>\n${PAGE_LINE}\n</body>\n</html>`;

const CLAIM = {
  id: 'fixture-mcp-live',
  claim: 'Homepage Live MCP Tools stat.',
  count_key: 'mcp.live',
  source_path: 'index.html',
  anchor: 'COUNT:mcp.live',
  scope: 'Public homepage stat.',
  as_of: '2026-09-01',
  review_by: '2026-12-01',
  registered_by: 'EVREG-1 selftest',
  registered_at: '2026-09-01',
};

function greenWorld({ claim = CLAIM, page = PAGE_TEXT, baseline = { overdue: 0, overdue_ids: [] } } = {}) {
  // Isolate EVERY call from the shared fixture literal: a case that deletes or
  // mutates a field (case 2) must never leak into later cases.
  const c = { ...claim };
  const extracted = extractClaimLine(page, c.anchor, c.occurrence ?? 1);
  const snapText = snapshotTextFor(c, extracted.line);
  const register = {
    claims: [{
      ...c,
      occurrence: c.occurrence ?? 1,
      snapshot: { path: snapshotRel(c.id), sha256: hashText(snapText) },
    }],
  };
  return {
    srcDoc: { claims: [c] },
    register,
    pages: new Map([[c.source_path, page]]),
    snapshots: new Map([[c.id, snapText]]),
    today: TODAY,
    baseline,
  };
}

// ── 1. GREEN — a complete, consistent, in-review register reads clean ──────
const green = evaluateRegister(greenWorld());
assert(green.findings.length === 0, 'GREEN: complete register + matching snapshot + future review_by is clean');
if (green.findings.length) console.log('  unexpected: ' + JSON.stringify(green.findings));

// ── 2. SRC_FIELD_MISSING — a claim without scope is incomplete ─────────────
{
  const w = greenWorld();
  delete w.srcDoc.claims[0].scope;
  const r = evaluateRegister(w);
  assert(r.findings.some((f) => f.kind === 'SRC_FIELD_MISSING'), 'RED: missing required field (scope) is SRC_FIELD_MISSING');
}

// ── 3. SRC_AS_OF_FUTURE + SRC_REVIEW_ORDER_INVALID — date sanity ───────────
{
  const claim = { ...CLAIM, as_of: '2027-01-01', review_by: '2026-01-01' };
  const r = evaluateRegister(greenWorld({ claim }));
  const k = kindsOf(r);
  assert(k.has('SRC_AS_OF_FUTURE'), 'RED: as_of after today is SRC_AS_OF_FUTURE');
  assert(k.has('SRC_REVIEW_ORDER_INVALID'), 'RED: review_by before as_of is SRC_REVIEW_ORDER_INVALID');
}

// ── 4. OVERDUE_UNPINNED vs PINNED — the reviews-only-forward ratchet ───────
{
  const claim = { ...CLAIM, review_by: '2026-09-01' }; // past
  const unpinned = evaluateRegister(greenWorld({ claim }));
  assert(unpinned.findings.some((f) => f.kind === 'OVERDUE_UNPINNED'), 'RED: past review_by without a baseline pin is OVERDUE_UNPINNED');
  const pinned = evaluateRegister(greenWorld({ claim, baseline: { overdue: 1, overdue_ids: ['fixture-mcp-live'] } }));
  assert(!pinned.findings.some((f) => f.kind === 'OVERDUE_UNPINNED'), 'GREEN: past review_by WITH a baseline pin is the deliberate-pinned state, not a red');
}

// ── 5. BASELINE_COUNT_MISMATCH — a baseline disagreeing with itself ────────
{
  const r = evaluateRegister(greenWorld({ baseline: { overdue: 3, overdue_ids: ['fixture-mcp-live'] } }));
  assert(r.findings.some((f) => f.kind === 'BASELINE_COUNT_MISMATCH'), 'RED: baseline overdue count disagreeing with its own list is BASELINE_COUNT_MISMATCH');
}

// ── 6. SNAPSHOT_TAMPERED — edited evidence no longer hashes to the register ─
{
  const w = greenWorld();
  const lines = w.snapshots.get('fixture-mcp-live').split('\n');
  lines[lines.length - 2] = lines[lines.length - 2].replace('719', '999');
  w.snapshots.set('fixture-mcp-live', lines.join('\n'));
  const r = evaluateRegister(w);
  assert(r.findings.some((f) => f.kind === 'SNAPSHOT_TAMPERED'), 'RED: snapshot bytes edited under a registered hash are SNAPSHOT_TAMPERED');
}

// ── 7. CLAIM_DRIFT — the page moved, the snapshot did not ──────────────────
{
  const driftedPage = PAGE_TEXT.replace('719<!--/COUNT-->', '720<!--/COUNT-->'); // verify-counts --fix moved the value
  const w = greenWorld();
  w.pages.set('index.html', driftedPage);
  const r = evaluateRegister(w);
  assert(r.findings.some((f) => f.kind === 'CLAIM_DRIFT'), 'RED: page sentinel value moved without re-review is CLAIM_DRIFT');
  assert(!r.findings.some((f) => f.kind === 'SNAPSHOT_TAMPERED'), 'MUTATION CONTROL: a page-side drift is NOT misreported as tampered evidence (the snapshot bytes are intact)');
  // and the same page WITH the snapshot re-validated reads clean again:
  const healed = evaluateRegister(greenWorld({ page: driftedPage }));
  assert(healed.findings.length === 0, 'GREEN: after revalidation (--revalidate path) the moved page reads clean');
}

// ── 8. CLAIM_DRIFT (anchor removed) — the claim text vanished from the page ─
{
  const w = greenWorld();
  w.pages.set('index.html', '<html>\n<body>\n<div>the stat was removed</div>\n</body>\n</html>');
  const r = evaluateRegister(w);
  assert(r.findings.some((f) => f.kind === 'CLAIM_DRIFT'), 'RED: anchor removed from the source surface is CLAIM_DRIFT (never a silent pass)');
}

// ── 9. REGISTER_STALE — src and register disagree ──────────────────────────
{
  const w = greenWorld();
  w.register.claims[0].scope = 'a stale scope string';
  const r = evaluateRegister(w);
  assert(r.findings.some((f) => f.kind === 'REGISTER_STALE'), 'RED: register field disagreeing with the hand-authored src is REGISTER_STALE');
}

// ── 10. REGISTER_MISSING / SNAPSHOT_MISSING — absent halves are RED (SO #34c)
{
  const w = greenWorld();
  w.register = null;
  assert(evaluateRegister(w).findings.some((f) => f.kind === 'REGISTER_MISSING'), 'RED: missing register with a non-empty src is REGISTER_MISSING');
  const w2 = greenWorld();
  w2.snapshots.set('fixture-mcp-live', null);
  assert(evaluateRegister(w2).findings.some((f) => f.kind === 'SNAPSHOT_MISSING'), 'RED: missing snapshot is SNAPSHOT_MISSING');
}

// ── 11. SRC_PAGE_MISSING — a claim pointing at a deleted surface ───────────
{
  const w = greenWorld();
  w.pages.set('index.html', null);
  const r = evaluateRegister(w);
  assert(r.findings.some((f) => f.kind === 'SRC_PAGE_MISSING'), 'RED: source surface absent from the repo is SRC_PAGE_MISSING');
}

// ── 12. RATCHET BASELINE LOADER — deleted/corrupt baseline is a hard red ───
{
  const opts = { label: 'evidence-register review ratchet (selftest)', path: 'scripts/evidence-register-baseline.json', repinCommand: 'selftest' };
  const states = [];
  try { validateRatchetBaseline(null, ['overdue', { key: 'overdue_ids', type: 'name-list' }], opts); }
  catch (e) { if (e instanceof RatchetBaselineError) states.push(e.state); }
  try { validateRatchetBaseline('not json', ['overdue', { key: 'overdue_ids', type: 'name-list' }], opts); }
  catch (e) { if (e instanceof RatchetBaselineError) states.push(e.state); }
  try { validateRatchetBaseline('{"overdue_ids":[]}', ['overdue', { key: 'overdue_ids', type: 'name-list' }], opts); }
  catch (e) { if (e instanceof RatchetBaselineError) states.push(e.state); }
  try { validateRatchetBaseline('{"overdue":1e999,"overdue_ids":[]}', ['overdue', { key: 'overdue_ids', type: 'name-list' }], opts); }
  catch (e) { if (e instanceof RatchetBaselineError) states.push(e.state); }
  assert(states.join(',') === 'MISSING-FILE,INVALID-JSON,MISSING-KEY,NAN-KEY',
    `RED: deleted/corrupt/Infinity baselines hard-fail through the shared loader (got: ${states.join(', ')})`);
  const ok = validateRatchetBaseline('{"overdue":0,"overdue_ids":[]}', ['overdue', { key: 'overdue_ids', type: 'name-list' }], opts);
  assert(ok.overdue === 0, 'GREEN: a valid zero-pin baseline loads');
}

// Drive buildRegister's drift branches fully in memory: the existing snapshot
// bytes come from the green world's snapshot map, never the repo's source/.
const readerFor = (world, id) => (rel) => (rel === snapshotRel(id) ? world.snapshots.get(id) : null);

// ── 13. SENTINEL-ONLY AUTO-REVAL — unit shape of the classifier (AUTOREVAL-1)
{
  const line = '<div><!--COUNT:zk.provenNodes-->661<!--/COUNT--> of <!--COUNT:zk.provenTotal-->662<!--/COUNT--></div>';
  assert(countKeyFromAnchor('COUNT:zk.provenNodes') === 'zk.provenNodes', 'AUTOREVAL: a COUNT:<key> anchor yields its count key');
  assert(countKeyFromAnchor('data-count="mcp.live"') === null && countKeyFromAnchor(undefined) === null, 'AUTOREVAL: a non-sentinel anchor yields no count key');
  const { masked, values } = maskCountSentinels(line);
  assert(!/\d/.test(masked) && values.length === 2 && values[0].key === 'zk.provenNodes' && values[1].value === 662,
    'AUTOREVAL: masking removes every sentinel numeric span and reports the values in order');
  const moved = classifySentinelDrift(
    line,
    line.replace('<!--COUNT:zk.provenTotal-->662<!--/COUNT-->', '<!--COUNT:zk.provenTotal-->663<!--/COUNT-->'),
    new Map([['zk.provenNodes', 661], ['zk.provenTotal', 663]]),
  );
  assert(moved.sentinelOnly === true && moved.oldValue === '661/662' && moved.newValue === '661/663',
    'AUTOREVAL: a sibling-span number move with engine agreement classifies sentinel-only');
  const reworded = classifySentinelDrift(line, line.replace(' of ', ' out of '), new Map());
  assert(reworded.sentinelOnly === false && reworded.engineMismatch === null,
    'AUTOREVAL: wording outside the spans classifies NOT sentinel-only');
  const rogue = classifySentinelDrift(line, line.replace('<!--COUNT:zk.provenTotal-->662<!--/COUNT-->', '<!--COUNT:zk.provenTotal-->999<!--/COUNT-->'),
    new Map([['zk.provenNodes', 661], ['zk.provenTotal', 662]]));
  assert(rogue.sentinelOnly === false && rogue.engineMismatch && rogue.engineMismatch.key === 'zk.provenTotal' && rogue.engineMismatch.page === 999,
    'AUTOREVAL: a span number the engine did not derive classifies as an engine mismatch');
}

// ── 14. AUTOREVAL (a) — a number-only change, engine agreeing: the DEFAULT
//     write path re-snapshots it (SENTINEL_REVALIDATED) and the gate reads
//     the drifted page green with no human step.
{
  const driftedPage = PAGE_TEXT.replace('719<!--/COUNT-->', '720<!--/COUNT-->'); // the count engine moved the value
  const engineCounts = new Map([['mcp.live', 720]]);
  const old = greenWorld();
  const built = buildRegister(old.srcDoc, (rel) => (rel === 'index.html' ? driftedPage : null), { engineCounts, readSnapshot: readerFor(old, 'fixture-mcp-live') });
  const reval = built.notices.find((n) => n.id === 'fixture-mcp-live' && n.kind === 'SENTINEL_REVALIDATED');
  assert(reval !== undefined, 'AUTOREVAL (a): a number-only sentinel drift is revalidated on the default write path');
  assert(reval && reval.oldValue === '719' && reval.newValue === '720',
    `AUTOREVAL (a): logged as SENTINEL_REVALIDATED fixture-mcp-live 719 -> 720 (got ${reval && reval.oldValue} -> ${reval && reval.newValue})`);
  const write = built.snapshotWrites.find((w) => w.rel === snapshotRel('fixture-mcp-live'));
  assert(write !== undefined, 'AUTOREVAL (a): the fresh snapshot is on the default write path\'s write list');
  const healed = evaluateRegister({
    ...old,
    pages: new Map([['index.html', driftedPage]]),
    snapshots: new Map([['fixture-mcp-live', write.text]]),
    register: { claims: [{ ...old.register.claims[0], snapshot: { path: write.rel, sha256: hashText(write.text) } }] },
  });
  assert(healed.findings.length === 0, 'AUTOREVAL (a): after the writer re-snapshots, the gate reads the drifted page GREEN with no human step');
}

// ── 15. AUTOREVAL (b) — a wording change is NEVER auto-revalidated ─────────
{
  const rewordedPage = PAGE_TEXT.replace('Live MCP Tools', 'Live MCP endpoints'); // bytes outside the span moved
  const engineCounts = new Map([['mcp.live', 719]]); // the engine still agrees with the unchanged number
  const old = greenWorld();
  const built = buildRegister(old.srcDoc, (rel) => (rel === 'index.html' ? rewordedPage : null), { engineCounts, readSnapshot: readerFor(old, 'fixture-mcp-live') });
  assert(!built.notices.some((n) => n.kind === 'SENTINEL_REVALIDATED'), 'AUTOREVAL (b): a wording change is never SENTINEL_REVALIDATED');
  assert(built.notices.some((n) => n.id === 'fixture-mcp-live' && n.kind === 'SNAPSHOT_DRIFT_PRESERVED'),
    'AUTOREVAL (b): a wording change keeps today\'s preserved-snapshot behaviour');
  assert(!built.snapshotWrites.some((w) => w.rel === snapshotRel('fixture-mcp-live')), 'AUTOREVAL (b): no snapshot write for a wording change');
  const r = evaluateRegister({ ...old, pages: new Map([['index.html', rewordedPage]]) });
  assert(r.findings.some((f) => f.kind === 'CLAIM_DRIFT'), 'AUTOREVAL (b): a wording change without re-review stays RED (CLAIM_DRIFT)');
}

// ── 16. AUTOREVAL (c) — a number the engine did not derive is never
//     certified: refusal notice, snapshot preserved, gate stays red.
{
  const roguePage = PAGE_TEXT.replace('719<!--/COUNT-->', '999<!--/COUNT-->'); // hand-edited, NOT the engine's value
  const engineCounts = new Map([['mcp.live', 719]]);
  const old = greenWorld();
  const built = buildRegister(old.srcDoc, (rel) => (rel === 'index.html' ? roguePage : null), { engineCounts, readSnapshot: readerFor(old, 'fixture-mcp-live') });
  assert(!built.notices.some((n) => n.kind === 'SENTINEL_REVALIDATED'), 'AUTOREVAL (c): an engine-mismatch number is never SENTINEL_REVALIDATED');
  assert(built.notices.some((n) => n.id === 'fixture-mcp-live' && n.kind === 'SENTINEL_REVAL_REFUSED'),
    'AUTOREVAL (c): the refusal is logged against the claim');
  const r = evaluateRegister({ ...old, pages: new Map([['index.html', roguePage]]) });
  assert(r.findings.some((f) => f.kind === 'CLAIM_DRIFT'), 'AUTOREVAL (c): an engine-mismatch drift stays RED (CLAIM_DRIFT), snapshot preserved');
}

// ── 17. AUTOREVAL fail-safes — no engine, no revalidation; a claim not
//     anchored on a COUNT sentinel is never auto-revalidated.
{
  const driftedPage = PAGE_TEXT.replace('719<!--/COUNT-->', '720<!--/COUNT-->');
  const old = greenWorld();
  const built = buildRegister(old.srcDoc, (rel) => (rel === 'index.html' ? driftedPage : null), { engineCounts: new Map(), readSnapshot: readerFor(old, 'fixture-mcp-live') });
  assert(built.notices.some((n) => n.kind === 'SENTINEL_REVAL_REFUSED'),
    'AUTOREVAL fail-safe: an absent/unavailable engine agrees with nothing — drift refused, snapshot preserved');
  const plain = { ...CLAIM, id: 'fixture-plain-anchor', anchor: 'Live MCP Tools' };
  const oldPlain = greenWorld({ claim: plain });
  const builtPlain = buildRegister(oldPlain.srcDoc, (rel) => (rel === 'index.html' ? driftedPage : null), { engineCounts: new Map([['mcp.live', 720]]), readSnapshot: readerFor(oldPlain, 'fixture-plain-anchor') });
  assert(!builtPlain.notices.some((n) => n.kind === 'SENTINEL_REVALIDATED'),
    'AUTOREVAL control: a claim not anchored on a COUNT sentinel is never auto-revalidated (today\'s behaviour)');
}

// ── 18. AUTOREVAL multi-span — the measured 661-of-661 -> 661-of-662 shape:
//     the claim's OWN number did not move; a sibling sentinel's did. The line
//     is still sentinel-only, and BOTH span values must match the engine.
{
  const claim2 = { ...CLAIM, id: 'fixture-zk-of-total', count_key: 'zk.provenNodes', anchor: 'COUNT:zk.provenNodes' };
  const oldPage = '<html>\n<body>\n<div><!--COUNT:zk.provenNodes-->661<!--/COUNT--> of <!--COUNT:zk.provenTotal-->661<!--/COUNT--> deterministic nodes carry a proof.</div>\n</body>\n</html>';
  const newPage = oldPage.replace('<!--COUNT:zk.provenTotal-->661<!--/COUNT-->', '<!--COUNT:zk.provenTotal-->662<!--/COUNT-->');
  const engineCounts = new Map([['zk.provenNodes', 661], ['zk.provenTotal', 662]]);
  const old = greenWorld({ claim: claim2, page: oldPage });
  const built = buildRegister(old.srcDoc, (rel) => (rel === 'index.html' ? newPage : null), { engineCounts, readSnapshot: readerFor(old, 'fixture-zk-of-total') });
  const reval = built.notices.find((n) => n.id === 'fixture-zk-of-total' && n.kind === 'SENTINEL_REVALIDATED');
  assert(reval !== undefined && reval.oldValue === '661/661' && reval.newValue === '661/662',
    'AUTOREVAL: a sibling-sentinel move on the claimed line is sentinel-only (661/661 -> 661/662), both spans engine-checked');
  const halfConfirmed = buildRegister(old.srcDoc, (rel) => (rel === 'index.html' ? newPage : null),
    { engineCounts: new Map([['zk.provenNodes', 661], ['zk.provenTotal', 999]]), readSnapshot: readerFor(old, 'fixture-zk-of-total') });
  assert(!halfConfirmed.notices.some((n) => n.kind === 'SENTINEL_REVALIDATED'),
    'AUTOREVAL: EVERY span on the line must match the engine — one unconfirmed sibling refuses the whole revalidation');
}

if (failures) {
  console.log(`\n✗ check-evidence-register.test.mjs: ${failures} control(s) failed`);
  process.exit(1);
}
console.log('\ncheck-evidence-register.test.mjs: all controls green (RED-before-GREEN proven for every verdict class).');
