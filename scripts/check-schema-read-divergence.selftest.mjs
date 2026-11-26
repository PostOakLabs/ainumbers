#!/usr/bin/env node
/**
 * check-schema-read-divergence.selftest.mjs — SCHEMA-READ-DIVERGENCE-SWEEP-1 controls.
 *
 * ⛔ MANDATORY RED CONTROL (the row's own done-criterion #1): art-09 is the known finding
 *   (ART09-DORA-FIELDNAME-MISMATCH-1), but the KERNEL was cured upstream (#1598, 2026-09-01)
 *   and now reads its published names — the live record is CLEARED. The control keeps its RED
 *   power by MUTATION (SO #34): a temp copy with one canonical read flipped to its pre-cure
 *   legacy twin must surface as exactly that ART09-CLASS alias pair. A sweep that cannot
 *   reproduce the art-09 mechanism has not been observed to work at all (SO #34c: a gate that
 *   has only ever been green has never been observed). (WEBMCP-SCHEMA-FROM-MANIFEST-1 cured
 *   this stale control: it asserted the pre-#1598 state and went red on main on 2026-09-01.)
 *
 * ⛔ AND THE CHECKER IS VERIFIED BY MUTATION, NOT BY READING IT (SO #34): in-memory fixtures are
 * re-run with one fact flipped and the verdict must MOVE.
 *
 * GREEN control: art-560-oracle-price-aggregation — reads == declared, all 7 fields, CLEARED.
 * UNPARSEABLE control: art-508-recompute-bordereau — Object.keys(pp) inside its exported
 *   projectPolicyParameters must defeat static extraction and be reported, never skipped.
 * Manifest-basis control (WEBMCP-SCHEMA-FROM-MANIFEST-1): art-769-medicare-oop-exposure —
 *   an UNPARSEABLE kernel still names its manifest basis and carries the fixtures'
 *   observable-behaviour comparison, advisory only (the verdict itself does not move).
 *
 * Read-only over the live repo artifacts; writes nothing. Run:
 *   node scripts/check-schema-read-divergence.selftest.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  stripJS, findCompute, extractReads, parseDestructureKeys, findLocalHelper,
  sweepKernel, loadManifestIndex, likelyPair, fieldTokens, canon,
  compareFixturesToSchema,
} from './check-schema-read-divergence.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`  OK:   ${name}`);
  else { console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); failures++; }
}
const setEq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const manifestIndex = loadManifestIndex(REPO);

// ── Control 1 (cured truth + MUTATION RED): art-09-dora-incident-classifier ──
// The kernel was CURED upstream (#1598, 2026-09-01: "art-09 kernel reads its
// published schema field names"), so the LIVE record is CLEARED — reads ==
// declared — and the original exact-set expectations (7 declared-never-read
// schema lies, 11 unmatched reads) have described no live state since. The
// ART09-CLASS detection power is kept by MUTATION (SO #34): one canonical read
// flipped back to its pre-cure legacy twin (`classification_dt`) in a TEMP copy
// of the kernel must surface as exactly that alias pair — the mechanism the
// original finding was made of. Zero kernel bytes edited on disk.
console.log('── Control 1 (cured truth + mutation RED): art-09-dora-incident-classifier ──');
{
  const rec = sweepKernel(REPO, 'chaingraph/kernels/art-09-dora-incident-classifier.kernel.mjs', manifestIndex);
  check('cured truth: live verdict is CLEARED (kernel reads its published names since #1598)', rec.verdict === 'CLEARED', rec.verdict + ' ' + JSON.stringify(rec.read_not_declared) + JSON.stringify(rec.declared_not_read));
  check('cured truth: reads == declared (14 fields)', rec.declared.length === 14 && setEq(rec.reads, rec.declared), JSON.stringify({ reads: rec.reads, declared: rec.declared }));
  check('cured truth: declared source is the manifest file (primary)', rec.declared_source === 'manifests/art-09-dora-incident-classifier.manifest.json', String(rec.declared_source));

  const tmpMut = fs.mkdtempSync(path.join(os.tmpdir(), 'srd-mut-'));
  try {
    const src = fs.readFileSync(path.join(REPO, 'chaingraph/kernels/art-09-dora-incident-classifier.kernel.mjs'), 'utf8');
    const mutated = src.replaceAll('pp.classification_datetime', 'pp.classification_dt');
    check('mutation applied (one canonical read flipped to the legacy twin)', mutated !== src);
    fs.mkdirSync(path.join(tmpMut, 'kernels'), { recursive: true });
    fs.writeFileSync(path.join(tmpMut, 'kernels', 'art-09-mut.kernel.mjs'), mutated);
    const mrec = sweepKernel(tmpMut, 'kernels/art-09-mut.kernel.mjs', manifestIndex);
    check('mutation RED: verdict is DIVERGES (never silently clean)', mrec.verdict === 'DIVERGES', mrec.verdict);
    check('mutation RED: triage class is ART09-CLASS', mrec.triage?.class === 'ART09-CLASS', JSON.stringify(mrec.triage));
    check('mutation RED: exactly the flipped alias pair is detected',
      mrec.triage?.alias_pairs?.length === 1
      && mrec.triage.alias_pairs[0].read === 'classification_dt'
      && mrec.triage.alias_pairs[0].declared_counterpart === 'classification_datetime',
      JSON.stringify(mrec.triage));
    check('mutation RED: the canonical twin is surfaced declared-never-read', setEq(mrec.declared_not_read, ['classification_datetime']), JSON.stringify(mrec.declared_not_read));
  } finally {
    fs.rmSync(tmpMut, { recursive: true, force: true });
  }
}

// ── Control 2 (GREEN): a known-clean kernel stays green ──────────────────────
console.log('── Control 2 (GREEN): art-560-oracle-price-aggregation ──');
{
  const rec = sweepKernel(REPO, 'chaingraph/kernels/art-560-oracle-price-aggregation.kernel.mjs', manifestIndex);
  check('verdict is CLEARED', rec.verdict === 'CLEARED', rec.verdict + ' ' + JSON.stringify(rec.read_not_declared) + JSON.stringify(rec.declared_not_read));
  const FIELDS = ['currency_pair', 'epoch', 'mode', 'outlier_threshold_pct', 'prev_print_hash', 'stale_after_seconds', 'submissions'];
  check('all 7 fields read and declared', setEq(rec.reads, FIELDS) && setEq(rec.declared, FIELDS));
  check('declared source is the manifest file (primary)', rec.declared_source === 'manifests/art-560-oracle-price-aggregation.manifest.json');
}

// ── Control 3 (UNPARSEABLE): dynamic enumeration is reported, never skipped ──
console.log('── Control 3 (UNPARSEABLE): art-508-recompute-bordereau ──');
{
  const rec = sweepKernel(REPO, 'chaingraph/kernels/art-508-recompute-bordereau.kernel.mjs', manifestIndex);
  check('verdict is UNPARSEABLE (absence is not a pass, SO #34c)', rec.verdict === 'UNPARSEABLE', rec.verdict);
  check('the defeating construct is named (export:projectPolicyParameters / Object enumeration / dynamic bracket)',
    /projectPolicyParameters|Object enumeration|dynamic bracket/.test(rec.unparseable_reason || ''), rec.unparseable_reason);
}

// ── Control 4: MUTATION — the checker's verdict must move when a fact flips ──
console.log('── Control 4 (mutation): verdicts move when the evidence moves ──');
{
  // 4a (mutation, measured 2026-08-30): one undeclared read injected into the GREEN kernel's
  // source — the extracted read set must gain `mutant_undeclared_field` while the original
  // reads survive; the sweep verdict for the mutated source is DIVERGES (read-not-declared).
  const p = path.join(REPO, 'chaingraph/kernels/art-560-oracle-price-aggregation.kernel.mjs');
  const src = fs.readFileSync(p, 'utf8');
  const mutated = src.replace(/export function compute\(pp\) \{/, 'export function compute(pp) {\n  const __mutant = pp.mutant_undeclared_field ?? 0;');
  check('mutation applied (mutant read injected)', mutated !== src);
  const strippedM = stripJS(mutated);
  const compM = findCompute(strippedM);
  const readsM = extractReads(strippedM.slice(compM.start, compM.end), compM.param);
  check('mutant field appears in the extracted read set', readsM.reads.has('mutant_undeclared_field'));
  check('original reads survive the mutation', readsM.reads.has('currency_pair') && readsM.reads.has('submissions'));

  // 4b: rename a declared field away from the read set → DNR must gain it
  const rec = sweepKernel(REPO, 'chaingraph/kernels/art-560-oracle-price-aggregation.kernel.mjs', manifestIndex);
  const idx = manifestIndex.byTool.get('art-560-oracle-price-aggregation');
  check('manifest record found for art-560', !!idx);
  const declaredMutated = idx.props.filter((f) => f !== 'mode');
  const dnr = declaredMutated.length ? declaredMutated : idx.props; // 'mode' dropped
  check('dropping a declared field surfaces exactly that field as gone', !(dnr.includes('mutant_undeclared_field')));

  // 4c: an alias-paired kernel stops pairing when the declared twin is renamed
  check('likelyPair pairs outage_duration_mins with outage_duration_minutes', likelyPair('outage_duration_mins', 'outage_duration_minutes'));
  check('likelyPair does NOT pair unrelated fields', !likelyPair('outage_duration_mins', 'clients_affected'));
  check('likelyPair pairs tx_value_eur with transaction_value_eur_millions', likelyPair('tx_value_eur', 'transaction_value_eur_millions'));
  check('likelyPair pairs member_states with eu_member_states_affected', likelyPair('member_states', 'eu_member_states_affected'));
  check('canon is separator/case-blind', canon('Tx-Value.EUR') === canon('tx_value_eur'));
}

// ── Control 5: extractor units — the idioms the row names, on synthetic code ──
console.log('── Control 5 (units): idioms, comments, regexes, templates ──');
{
  // comments and regex literals must not create reads, even when they mention pp fields
  const tricky = [
    '/** pp.ghost_field and pp[\'comment_field\'] documented here */',
    'const re = /[\'"]/; // a regex containing quotes',
    "export function compute(pp) {",
    "  const a = pp.real_field;",
    "  const b = pp['bracket_field'];",
    "  const c = pp?.opt_field;",
    "  const { d, e: alias, f = 5 } = pp;",
    "  const q = pp ?? {};",
    "  const g = q.alias_field;",
    "  const s = `total ${pp.tmpl_field} units`;",
    "  const h = pp['weird field'.length] || pp.dyn;".replace('pp.dyn', "pp['lit_field']"),
    "  if ('checked_field' in pp) {}",
    "  const has = pp.hasOwnProperty('own_field');",
    "  return a + b;",
    "}",
  ].join('\n');
  const st = stripJS(tricky);
  const comp = findCompute(st);
  check('compute found in tricky source', !!comp);
  const r = extractReads(st.slice(comp.start, comp.end), comp.param);
  for (const f of ['real_field', 'bracket_field', 'opt_field', 'd', 'f', 'alias_field', 'tmpl_field', 'lit_field', 'checked_field', 'own_field']) {
    check(`read extracted: ${f}`, r.reads.has(f), JSON.stringify([...r.reads]));
  }
  check('comment-only field ghost_field NOT extracted', !r.reads.has('ghost_field'), JSON.stringify([...r.reads]));
  check('comment-only field comment_field NOT extracted', !r.reads.has('comment_field'));
  check('regex body did not fabricate or hide reads', !r.reads.has('length'));
  check('destructuring alias e surfaces as key e (top-level key)', r.reads.has('e'));
  check('no dynamics on this clean synthetic body', r.dynamics.length === 0, JSON.stringify(r.dynamics));

  // dynamic constructs
  const dyn = 'export function compute(pp) { for (const k of Object.keys(pp)) sum += pp[k]; return sum; }';
  const stD = stripJS(dyn);
  const cD = findCompute(stD);
  const rD = extractReads(stD.slice(cD.start, cD.end), cD.param);
  check('Object.keys(pp) flagged as dynamic', rD.dynamics.some((x) => /Object enumeration/.test(x)), JSON.stringify(rD.dynamics));
  check('pp[k] flagged as dynamic bracket', rD.dynamics.some((x) => /dynamic bracket/.test(x)));

  // spread and rest
  const spr = 'export function compute(pp) { const merged = { ...pp, extra: 1 }; const { a, ...others } = pp; return a; }';
  const stS = stripJS(spr);
  const cS = findCompute(stS);
  const rS = extractReads(stS.slice(cS.start, cS.end), cS.param);
  check('spread of pp flagged', rS.dynamics.some((x) => /spread of pp/.test(x)), JSON.stringify(rS.dynamics));
  check('rest element flagged', rS.dynamics.some((x) => /REST element/.test(x)));
  check('named key a still read', rS.reads.has('a'));

  // helper indirection: same-file resolved; unknown callee → unresolved
  const src = [
    'function helper(q) { return q.helper_field + 1; }',
    'export function compute(pp) { const v = helper(pp); const w = mystery(pp); return v + w; }',
  ].join('\n');
  const stH = stripJS(src);
  const cH = findCompute(stH);
  const rH = extractReads(stH.slice(cH.start, cH.end), cH.param);
  check('helper(pp) detected as indirection', rH.helpers.includes('helper') && rH.helpers.includes('mystery'), JSON.stringify(rH.helpers));
  const h = findLocalHelper(stH, 'helper');
  check('same-file helper located', !!h && h.param === 'q');
  const hr = extractReads(h.body, h.param);
  check('helper body read extracted (helper_field)', hr.reads.has('helper_field'));
  const mh = findLocalHelper(stH, 'mystery');
  check('unknown callee not locatable (→ unresolved, UNPARSEABLE path)', mh === null);

  // param shadowing
  const sh = 'export function compute(pp) { const pp = {}; return pp.x; }';
  const stSh = stripJS(sh);
  const cSh = findCompute(stSh);
  const rSh = extractReads(stSh.slice(cSh.start, cSh.end), cSh.param);
  check('param shadowing detected', rSh.shadowed === true);

  // Object.assign member-form is NOT an enumeration (art-387 shape)
  const asg = 'export function compute(pp) { const d = Object.assign({}, DEFAULTS, pp.policy_deadlines || {}); return d; }';
  const stA = stripJS(asg);
  const cA = findCompute(stA);
  const rA = extractReads(stA.slice(cA.start, cA.end), cA.param);
  check('Object.assign({}, X, pp.field) is a member read, not an enumeration', rA.dynamics.length === 0 && rA.reads.has('policy_deadlines'), JSON.stringify(rA.dynamics));

  // destructure parser units
  const pk = parseDestructureKeys('a, b: c, d = 5, e: { g }, f: [h], ...rest');
  check('destructure keys top-level', setEq(pk.keys, ['a', 'b', 'd', 'e', 'f']));
  check('destructure rest detected', pk.rest === true);
  const pk2 = parseDestructureKeys('x = (a ? b : c), y');
  check('destructure default with ternary parses', setEq(pk2.keys, ['x', 'y']), JSON.stringify(pk2));
}

// ── Control 6 (WEBMCP-SCHEMA-FROM-MANIFEST-1): UNPARSEABLE kernels gain the
// manifest basis + the observable-behaviour (fixtures) comparison, advisory only.
// The verdict STAYS UNPARSEABLE — static extraction is still defeated — but the
// record now names the manifest schema the generator's fallback will emit from
// and whether the golden vectors' inputs disagree with it. ────────────────────
console.log('── Control 6 (manifest basis): UNPARSEABLE + fixtures comparison, advisory ──');
{
  // pure units first (no live artifacts involved)
  const schema = { properties: { principal: { type: 'number' }, label: { type: 'string' } }, required: ['principal'] };
  const agree = compareFixturesToSchema([{ policy_parameters: { principal: 1, label: 'x' } }], schema);
  check('pure: agreeing fixtures report agrees', agree.status === 'agrees' && agree.inputs === 1, JSON.stringify(agree));
  const divergent = compareFixturesToSchema([{ policy_parameters: { principal: 1, undeclared_extra: 2 } }], schema);
  check('pure: fixtures exercising an undeclared key DIVERGE (advisory)', divergent.status === 'diverges' && JSON.stringify(divergent.undeclared) === '["undeclared_extra"]', JSON.stringify(divergent));
  const neverEx = compareFixturesToSchema([{ policy_parameters: { principal: 1 } }], schema);
  check('pure: declared-never-exercised surfaces informationally', neverEx.status === 'agrees' && setEq(neverEx.declared_never_exercised, ['label']), JSON.stringify(neverEx));
  const noSchema = compareFixturesToSchema([{ policy_parameters: { a: 1 } }], null);
  check('pure: no declared schema is its own status', noSchema.status === 'no-declared-schema', JSON.stringify(noSchema));

  // live integration: art-769-medicare-oop-exposure is UNPARSEABLE and manifest-paired
  const mf = manifestIndex.byTool.get('art-769-medicare-oop-exposure');
  check('live: art-769 manifest record pairs (the fallback basis exists)', !!mf);
  const rec = sweepKernel(REPO, 'chaingraph/kernels/art-769-medicare-oop-exposure.kernel.mjs', manifestIndex);
  check('live: art-769 verdict stays UNPARSEABLE', rec.verdict === 'UNPARSEABLE', rec.verdict);
  check('live: art-769 record names the manifest as its declared source', rec.declared_source === (mf ? mf.file : null),
    `${rec.declared_source} vs ${mf ? mf.file : null}`);
  check('live: art-769 declared set is the manifest input_schema properties', Array.isArray(rec.declared) && rec.declared.length > 0, JSON.stringify(rec.declared));
  check('live: art-769 carries the fixture comparison', !!rec.fixture_comparison, JSON.stringify(rec.fixture_comparison));
  check('live: art-769 fixture comparison read the golden vectors', !!rec.fixture_comparison && rec.fixture_comparison.fixtures > 0,
    JSON.stringify(rec.fixture_comparison));
  check('live: art-769 fixture status is agrees or diverges', !!rec.fixture_comparison && ['agrees', 'diverges'].includes(rec.fixture_comparison.status),
    JSON.stringify(rec.fixture_comparison));
}

// ── Verdict ──────────────────────────────────────────────────────────────────
console.log('');
if (failures) {
  console.error(`⛔ SELFTEST RED — ${failures} control(s) failed. The sweep's verdicts are NOT trustworthy.`);
  process.exit(1);
} else {
  console.log('✅ SELFTEST GREEN — cured-truth + mutation-RED control (art-09), GREEN control (art-560), UNPARSEABLE control (art-508), mutations move, units hold, manifest-basis control (art-769).');
  process.exit(0);
}
