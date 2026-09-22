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
import { hashText, extractClaimLine, snapshotTextFor, snapshotRel } from './gen-evidence-register.mjs';
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

if (failures) {
  console.log(`\n✗ check-evidence-register.test.mjs: ${failures} control(s) failed`);
  process.exit(1);
}
console.log('\ncheck-evidence-register.test.mjs: all controls green (RED-before-GREEN proven for every verdict class).');
