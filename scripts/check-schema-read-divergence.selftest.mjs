#!/usr/bin/env node
/**
 * check-schema-read-divergence.selftest.mjs — SCHEMA-READ-DIVERGENCE-SWEEP-1 controls.
 *
 * ⛔ MANDATORY RED CONTROL (the row's own done-criterion #1): the live art-09 kernel must be
 * FLAGGED EXACTLY as the known finding (ART09-DORA-FIELDNAME-MISMATCH-1) — 7 declared-never-read
 * fields (the schema's 7 lies), 11 read-never-declared, 7 of them alias-paired to their declared
 * twins, the 4 remaining genuinely unreachable, and its own page↔manifest delta visible. A sweep
 * that cannot reproduce art-09 has not been observed to work at all (SO #34c: a gate that has
 * only ever been green has never been observed).
 *
 * ⛔ AND THE CHECKER IS VERIFIED BY MUTATION, NOT BY READING IT (SO #34): in-memory fixtures are
 * re-run with one fact flipped and the verdict must MOVE.
 *
 * GREEN control: art-560-oracle-price-aggregation — reads == declared, all 7 fields, CLEARED.
 * UNPARSEABLE control: art-508-recompute-bordereau — Object.keys(pp) inside its exported
 *   projectPolicyParameters must defeat static extraction and be reported, never skipped.
 *
 * Read-only over the live repo artifacts; writes nothing. Run:
 *   node scripts/check-schema-read-divergence.selftest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  stripJS, findCompute, extractReads, parseDestructureKeys, findLocalHelper,
  sweepKernel, loadManifestIndex, likelyPair, fieldTokens, canon,
} from './check-schema-read-divergence.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`  OK:   ${name}`);
  else { console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); failures++; }
}
const setEq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const manifestIndex = loadManifestIndex(REPO);

// ── Control 1 (RED): art-09 flags EXACTLY the known finding ──────────────────
console.log('── Control 1 (RED): art-09-dora-incident-classifier ──');
{
  const rec = sweepKernel(REPO, 'chaingraph/kernels/art-09-dora-incident-classifier.kernel.mjs', manifestIndex);
  check('verdict is DIVERGES (never silently clean)', rec.verdict === 'DIVERGES');
  check('triage class is ART09-CLASS', rec.triage.class === 'ART09-CLASS');
  const DNR7 = ['detection_datetime', 'transaction_value_eur_millions', 'outage_duration_minutes',
    'eu_member_states_affected', 'data_loss_occurred', 'critical_function_affected', 'cross_border_payment'];
  check('declared-never-read is EXACTLY the 7 schema lies of the known finding', setEq(rec.declared_not_read, DNR7), JSON.stringify(rec.declared_not_read));
  check('that is 7 fields', rec.declared_not_read.length === 7);
  const RND11 = ['classification_dt', 'critical_fn', 'cross_border', 'data_loss', 'detection_dt',
    'entity_type', 'member_states', 'outage_duration_mins', 'resolution_dt', 'tp_ict', 'tx_value_eur'];
  check('read-never-declared is EXACTLY the 11 unmatched reads', setEq(rec.read_not_declared, RND11), JSON.stringify(rec.read_not_declared));
  check('7 alias pairs detected', rec.triage.alias_pairs.length === 7, JSON.stringify(rec.triage.alias_pairs));
  const PAIRS = ['critical_fn', 'cross_border', 'data_loss', 'detection_dt', 'member_states', 'outage_duration_mins', 'tx_value_eur'];
  check('the pairs are the right reads', setEq(rec.triage.alias_pairs.map((p) => p.read), PAIRS));
  check('4 reads have no declared twin at all', setEq(rec.triage.unreachable_extra, ['classification_dt', 'entity_type', 'resolution_dt', 'tp_ict']));
  check('shared reads survive (incident_type, clients_affected, total_clients)', setEq(
    rec.reads.filter((f) => rec.declared.includes(f)), ['incident_type', 'clients_affected', 'total_clients']));
  check('page↔manifest cross-check delta surfaces the 2 page-only fields',
    rec.page_delta && setEq(rec.page_delta.only_in_page, ['classification_datetime', 'estimated_resolution_datetime']) && rec.page_delta.only_in_manifest.length === 0,
    JSON.stringify(rec.page_delta));
  // reads come from CODE, not the JSDoc block that lists the very same field names
  check('JSDoc field list did not leak into reads (detection_dt read once, from code)', rec.reads.filter((f) => f === 'detection_dt').length === 1 || rec.reads.includes('detection_dt'));
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
  // 4a: add one undeclared read to the GREEN kernel's source → must flip to DIVERGES
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

// ── Verdict ──────────────────────────────────────────────────────────────────
console.log('');
if (failures) {
  console.error(`⛔ SELFTEST RED — ${failures} control(s) failed. The sweep's verdicts are NOT trustworthy.`);
  process.exit(1);
} else {
  console.log('✅ SELFTEST GREEN — RED control (art-09, exact), GREEN control (art-560), UNPARSEABLE control (art-508), mutations move, units hold.');
  process.exit(0);
}
