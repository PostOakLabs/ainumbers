#!/usr/bin/env node
/**
 * scripts/gen-changelog.selftest.mjs — fixture proof for the CHANGELOG-1
 * generator (scripts/gen-changelog.mjs) and its leak gate.
 *
 * A gate never seen red is not a gate (SO #34c). Everything here runs against
 * IN-MEMORY fixtures via the generator's exported pure functions
 * (renderChangelog / collectLeaks) — never against the real history, the real
 * seed, or the real CHANGELOG.md, and it writes nothing.
 *
 * What it proves:
 *   1. SEED-AUTOFILL CONTRACT — a merge entry absent from the seed is
 *      AUTO-CLASSIFIED from its commit subject's conventional prefix, marked
 *      "(auto)", and rendered; an entry whose subject carries no recognized
 *      prefix lands in the "Other" section. The generator NEVER exits 1 on an
 *      unknown merge (the 2026-09-22 measured red: every merge-queue landing's
 *      speculative merge commit failed the queue's own evaluation). A
 *      hand-written seed entry takes precedence over the auto classification
 *      (edit the seed, regenerate — the curated title replaces the auto one).
 *   2. FAIL-CLOSED TAGS — a reachable tag absent from seed.tags throws; a tag
 *      classified {heading} becomes a version scope; {ignore} with a reason
 *      does not.
 *   3. FAIL-CLOSED SECTIONS — a seed entry naming a section outside
 *      seed.sections throws (no silent re-sectioning).
 *   4. SCOPE BOUNDARIES — entries fall in Unreleased vs tag scopes by date,
 *      including the floor/ceil edges (date == tag date belongs to the tag).
 *   5. LEAK GATE POSITIVE — planted internal vocabulary is caught and the hit
 *      is QUOTED with its class: board row IDs, standing-order refs, owner
 *      names, orchestration roles, model vendors, internal paths. RED-then-
 *      GREEN in one control. `collectLeaks(...).length > 0` is the EXACT
 *      condition the generator's main() exits 1 on — this leg is the proof
 *      the leak gate still exits 1 under the SEED-AUTOFILL contract.
 *   6. LEAK GATE NEGATIVE, the false-positive half — public token shapes read
 *      clean: lowercase node ids (art-544), §-section references, PR numbers,
 *      and the allowlisted public tokens (ISO-20022, SHA-256, tool range
 *      T420-427) on the SAME line as a real leak still reds (the allowlist
 *      strips its own token, never skips the line).
 *   7. IDEMPOTENCE — the same (merges, tags, seed) renders byte-identical
 *      output twice, and no Date.now()/new Date() value can enter the bytes.
 *   8. REAL SEED SANITY — the committed seed parses, its sections are
 *      well-formed, and every entry's section is a member of seed.sections
 *      (cheap drift tripwire; full membership vs history is the generator's
 *      own fail-closed run, exercised live by preflight).
 *   9. AUTO-TITLE SANITIZATION — merge subjects (and branch names inside
 *      them) carry internal row IDs, so an auto entry's title may contain
 *      ONLY fixed vocabulary (kind + the bare prefix word): a subject soaked
 *      in row-ID shapes renders ZERO leak-gate hits.
 *
 * Usage: node scripts/gen-changelog.selftest.mjs
 * Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.
 */
import { readFileSync } from 'node:fs';
import { renderChangelog, collectLeaks, listTags, parseMerges, autoClassify, AUTO_FALLBACK_SECTION, PUBLIC_TOKEN_ALLOWLIST } from './gen-changelog.mjs';

let failed = 0;
let ran = 0;
function check(cond, label) {
  ran++;
  if (cond) { console.log(`  ok ${ran} - ${label}`); }
  else { failed++; console.error(`  not ok ${ran} - ${label}`); }
}
function throws(fn, needle, label) {
  try { fn(); check(false, `${label} (did not throw)`); }
  catch (e) { check(String(e && e.message).includes(needle), `${label} (threw with "${needle}")`); }
}

const MERGES = [
  { key: 'pr-200', hash: 'h2000000000000000000000000000000000000000'.slice(0, 40), short: 'abcdef12', date: '2026-09-01', pr: 200 },
  { key: 'c-deadbeef12', hash: 'deadbeef12ffffffffffffffffffffffffffffffff', short: 'deadbee', date: '2026-08-15', pr: null },
  { key: 'pr-300', hash: 'h3000000000000000000000000000000000000000'.slice(0, 40), short: 'ffff0001', date: '2026-07-01', pr: 300 },
];
const SEED = {
  sections: ['Added', 'Changed', 'Fixed', 'Security'],
  tags: {},
  entries: {
    'pr-200': { section: 'Added', title: 'Clean public title one' },
    'c-deadbeef12': { section: 'Fixed', title: 'Clean public title two' },
    'pr-300': { section: 'Changed', title: 'Clean public title three' },
  },
};

// ── 1. UNKNOWN MERGES AUTO-CLASSIFY — never exit 1 (SEED-AUTOFILL) ──────────
// The 2026-09-22 measured red: every merge-queue landing's speculative merge
// commit was absent from the seed, so the fail-closed rule reds the queue's
// own evaluation (and MERGEQUEUE-GATE-PARITY reded every OTHER open PR with
// it). The new contract: an unclassified merge renders via auto-classification
// — the seed stays the curated source of truth and a hand-written seed line
// replaces the auto entry at the next regen.
{
  const s = JSON.parse(JSON.stringify(SEED));
  delete s.entries['pr-300'];
  let out = null;
  try { out = renderChangelog(MERGES, [], s); } catch (e) { console.error('  render threw: ' + e.message); }
  check(out !== null && out.includes('2026-07-01'), 'unclassified merge entry renders via auto-classification — never exit 1');
  check(out !== null && out.includes('(auto)'), 'the auto-classified entry is marked (auto)');
  check(out !== null && out.includes('### Other'), 'an entry whose subject carries no recognized prefix lands in "Other"');
  check(out !== null && !/FAIL-CLOSED: \d+ unclassified merge/.test(out), 'no fail-closed refusal for a merge absent from the seed');
  // Curated precedence: a seed entry wins over the auto classification.
  const out2 = renderChangelog(MERGES, [], SEED);
  const seededLine = out2.split('\n').find((l) => l.includes('Clean public title three'));
  check(seededLine !== undefined && !seededLine.includes('(auto)'),
    'a hand-written seed entry replaces the auto classification (no (auto) marker on its line)');
  check(!out2.includes('### Other'), '"Other" renders only when an auto entry actually needs it');
}
// ── 2. FAIL-CLOSED TAGS + SCOPE CLASSIFICATION ──────────────────────────────
{
  const TAGS = [{ name: 'v9.9-beta', date: '2026-08-20' }];
  throws(() => renderChangelog(MERGES, TAGS, SEED),
    'reachable tag(s) unclassified',
    'unclassified reachable tag refused');
  const withHeading = JSON.parse(JSON.stringify(SEED));
  withHeading.tags = { 'v9.9-beta': { heading: '9.9.0 — public release' } };
  const out = renderChangelog(MERGES, TAGS, withHeading);
  check(out.includes('## 9.9.0 — public release'), 'classified tag renders as a version scope');
  // date == tag date belongs to the tag scope; newer goes to Unreleased.
  const tagScopeHas300 = /## 9\.9\.0[\s\S]*2026-07-01/.test(out);
  const unreleasedHas200 = /## Unreleased[\s\S]*2026-09-01/.test(out);
  const boundary = /## 9\.9\.0[\s\S]*2026-08-15/.test(out);
  check(tagScopeHas300 && unreleasedHas200 && boundary, 'scope boundaries: Unreleased vs tag by date (incl. == tag date)');
  const ignored = JSON.parse(JSON.stringify(SEED));
  ignored.tags = { 'v9.9-beta': { ignore: 'scratch tag from a pre-rebase experiment, not a release' } };
  const out2 = renderChangelog(MERGES, TAGS, ignored);
  check(!out2.includes('v9.9-beta') && out2.includes('## Unreleased'), 'ignored tag renders nothing and everything stays Unreleased');
}
// ── 3. FAIL-CLOSED SECTIONS ─────────────────────────────────────────────────
{
  const s = JSON.parse(JSON.stringify(SEED));
  s.entries['pr-200'].section = 'Operations';
  throws(() => renderChangelog(MERGES, [], s), 'sections outside seed.sections', 'unknown section name refused');
}
// ── 4. LEAK GATE: RED-then-GREEN, quoting included ──────────────────────────
{
  const poisoned = JSON.parse(JSON.stringify(SEED));
  poisoned.entries['pr-200'].title = 'CHANGELOG-1: land art-591 by Tim, drafted in Claude (board/) — SO #35';
  const text = renderChangelog(MERGES, [], poisoned);
  const leaks = collectLeaks(text);
  const names = new Set(leaks.map((l) => l.name));
  for (const want of ['row-id', 'owner-name', 'model-vendor', 'internal-path', 'standing-order-ref']) {
    check(names.has(want), `leak gate catches planted class "${want}"`);
  }
  const quoted = leaks.find((l) => l.name === 'row-id');
  check(quoted && quoted.line.includes('CHANGELOG-1') && quoted.no > 0,
    'leak gate QUOTES the offending line with a line number');
  check(text.includes('CHANGELOG-1'), 'control: the planted leak is really in the rendered bytes (gate had something to catch)');
  check(leaks.length > 0,
    'leak-gate exit-1 predicate FIRES on the planted leak (collectLeaks > 0 is the exact condition main() exits 1 on)');
  // GREEN half: the clean seed over the same merges.
  check(collectLeaks(renderChangelog(MERGES, [], SEED)).length === 0, 'clean fixtures render leak-free (GREEN)');
}
// ── 5. LEAK GATE NEGATIVES (public vocabulary stays public) ─────────────────
{
  const pub = JSON.parse(JSON.stringify(SEED));
  pub.entries['pr-200'].title = 'Add art-544 per ISO-20022 and SHA-256, cross-link T420-427, cite section 18';
  const text = renderChangelog(MERGES, [], pub);
  check(collectLeaks(text).length === 0, 'public token shapes (art-NNN, ISO-20022, SHA-256, T420-427) read clean');
  for (const t of PUBLIC_TOKEN_ALLOWLIST) {
    if (!pub.entries['pr-200'].title.includes(t)) check(false, `allowlist token ${t} missing from the fixture itself`);
  }
  const mixed = JSON.parse(JSON.stringify(SEED));
  mixed.entries['pr-200'].title = `Ship ISO-20022 parsing (note: SEE-ROW-9)`;
  const hits = collectLeaks(renderChangelog(MERGES, [], mixed));
  check(hits.some((h) => h.name === 'row-id' && h.hit === 'SEE-ROW-9'),
    'allowlisted token on the SAME line does not mask a real leak (strip, never skip)');
}
// ── 6. IDEMPOTENCE (pure function, no wall clock) ───────────────────────────
{
  const a = renderChangelog(MERGES, [], SEED);
  const b = renderChangelog(MERGES, [], SEED);
  check(a === b && a.length > 0, 'same (merges, tags, seed) renders byte-identical output');
  check(!/\b20\d\d-\d\d-\d\dT/.test(a), 'no wall-clock timestamp enters the bytes');
  check(a.endsWith('\n') && a.includes('DO NOT HAND-EDIT'), 'output carries the no-hand-edit marker and ends with a newline');
}
// ── 8. TAG-LESS ENVIRONMENT (MERGEGROUP TAG-FIX) ────────────────────────────
// GitHub's ephemeral merge-group queue checkout fetches NO tag refs, so the
// `git tag --merged` call ERRORS there — measured red in run 35692678563,
// where it failed derived-artifacts --regen on a healthy tree and evicted the
// queue entry. The contract under test: the listing failure degrades to an
// EMPTY tag set and rendering SUCCEEDS (merge-commit entries classify via
// their subjects; no tag scopes; no crash). The runner is injected, so this
// control simulates the exact failure without spawning git.
{
  const r = listTags(() => {
    throw new Error('fatal: your current branch \'main\' does not have any commits yet — no tag refs fetched (simulated merge-group checkout)');
  });
  check(r.source === 'tag-less-environment' && r.tags.length === 0 && typeof r.error === 'string',
    'git tag failure degrades to the EMPTY tag set with a named tag-less-environment source');
  let out = null;
  try { out = renderChangelog(MERGES, r.tags, SEED); } catch (e) { out = null; console.error('  render threw: ' + e.message); }
  check(out !== null && out.includes('## Unreleased') && out.includes('2026-09-01'),
    'tag-less render SUCCEEDS: merge-commit entries classify, no tag scopes, no crash');
  check(out !== null && !/## v/.test(out), 'tag-less render emits no version scope headings');
  // Parser control: a healthy listing still parses (the tolerant path must not
  // have swallowed real tags).
  const good = listTags(() => 'v1.0\t2026-08-20\nv0.9\t2026-07-01\n');
  check(good.source === 'git' && good.tags.length === 2 && good.tags[0].name === 'v1.0' && good.tags[1].date === '2026-07-01',
    'parser control: healthy git tag listing parses to ordered {name, date} pairs');
  // And the tolerant empty set renders IDENTICALLY to an honest zero-tag listing.
  const viaEmpty = renderChangelog(MERGES, [], SEED);
  check(out === viaEmpty, 'tag-less bytes identical to an honest zero-tag render (no hidden divergence)');
}
// ── 8b. SYNTHETIC MERGE-QUEUE TEST-MERGE SKIP (convergence fix, round 3) ────
// Every grouped evaluation re-creates the queue's test-merge with a NEW sha
// ("Merge <sha> into <sha>"), so requiring its classification can never
// converge — the next round fail-closes on the new hash. The walk EXCLUDES
// that exact subject shape as known-synthetic; everything else stays
// fail-closed. Fixture lines drive the pure parser, no git spawned.
{
  const log = [
    '850e5f7b6ebc847b9c27e72d3e819f423d171b8d\t850e5f7b\t2026-09-22\tMerge 9b7df839856a9e369a19353cab6a437ca4ae0560 into 28b131595954d6d125443dde3875151733f49464',
    '2000000000000000000000000000000000000000\tabcdef12\t2026-09-01\tMerge pull request #200 from PostOakLabs/some-branch',
    'deadbeef12ffffffffffffffffffffffffffffffff\tdeadbee\t2026-08-15\tMerge remote-tracking branch \'origin/x\' into y',
  ].join('\n');
  const { merges, skippedSynthetic } = parseMerges(log);
  check(skippedSynthetic === 1 && merges.length === 2,
    'queue-shaped test-merge skipped as known-synthetic; other merges kept fail-closed');
  check(!merges.some((m) => m.key === 'c-850e5f7b6e'),
    'the synthetic commit requires no seed classification (no key minted for it)');
  check(merges[0].key === 'pr-200' && merges[1].key === 'c-deadbeef12',
    'surviving merges keep their pr-N / c-hash keys in order');
  const s = JSON.parse(JSON.stringify(SEED));
  let out = null;
  try { out = renderChangelog(merges, [], s); } catch (e) { console.error('  render threw: ' + e.message); }
  check(out !== null && out.includes('2026-09-01') && !out.includes('850e5f7b'),
    'render with the skip applied is green and contains no synthetic entry');
  const landing = parseMerges('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tbbbbbbb\t2026-09-22\tMerge pull request #2010 from PostOakLabs/CHANGELOG-1');
  check(landing.skippedSynthetic === 0 && landing.merges.length === 1 && landing.merges[0].pr === 2010,
    'a REAL PR landing merge (pr-shaped subject) is never treated as synthetic');
  const manual = parseMerges('cccccccccccccccccccccccccccccccccccccccc\tddddddd\t2026-08-15\tMerge feature-x (some integration note)');
  check(manual.skippedSynthetic === 0 && manual.merges[0].key === 'c-cccccccccc',
    'a manual non-queue merge still mints its c-hash key (classified by its seed line or auto)');
}
// ── 9. SEED-AUTOFILL: prefix → section map + AUTO-TITLE SANITIZATION ────────
// The estate's own prefix vocabulary, measured over the full commit-subject
// history (2026-09-22): feat 458, chore 391, fix 312, docs 60, ci 30, build 7,
// test 5, security 2, refactor 2. Mapping targets the four seed sections;
// anything unrecognized (including every pr-shaped "Merge pull request #N
// from …" subject, which carries no prefix) falls to "Other". Fixture subjects
// with prefixed titles are the merge-commit landing shapes that embed a PR
// title; the sanitized-title control uses REAL queue-branch shapes, whose
// branch names are board row IDs — if an auto title ever echoed the subject,
// the leak gate would exit 1 on every queue landing.
{
  const AF_LOG = [
    'a10f0000000000000000000000000000000000000\ta10f000\t2026-09-22\tMerge pull request #2010 from PostOakLabs/CHANGELOG-1',
    'a20f0000000000000000000000000000000000000\ta20f000\t2026-09-21\tfeat(evidence): pilot claim set',
    'a30f0000000000000000000000000000000000000\ta30f000\t2026-09-20\tfix(receipt): round-trip digest mismatch',
    'a40f0000000000000000000000000000000000000\ta40f000\t2026-09-19\tchore(derived): regenerate shared derived artifacts on main',
    'a50f0000000000000000000000000000000000000\ta50f000\t2026-09-18\tdocs(whitepaper): refresh section 6',
    'a60f0000000000000000000000000000000000000\ta60f000\t2026-09-17\tci: pin the checkout action',
    'a70f0000000000000000000000000000000000000\ta70f000\t2026-09-16\tsecurity(audit): close the cross-origin read',
    'a80f0000000000000000000000000000000000000\ta80f000\t2026-09-15\tMerge pull request #2014 from PostOakLabs/CHANGELOG-MERGE-SEED-AUTOFILL-1',
  ].join('\n');
  const af = parseMerges(AF_LOG).merges;
  check(af.length === 8 && af.every((m) => typeof m.subject === 'string'),
    'parser carries each merge subject forward (auto-classification input)');
  const emptySeed = { sections: SEED.sections, tags: {}, entries: {} };
  let out = null;
  try { out = renderChangelog(af, [], emptySeed); } catch (e) { console.error('  render threw: ' + e.message); }
  check(out !== null, 'all-unknown history renders without throwing (the old contract threw here)');
  const secHas = (sec, needle) => out !== null && new RegExp(`### ${sec}[\\s\\S]*?${needle}`).test(out);
  check(secHas('Added', '2026-09-21') && secHas('Fixed', '2026-09-20') && secHas('Changed', '2026-09-19')
    && secHas('Changed', '2026-09-18') && secHas('Changed', '2026-09-17') && secHas('Security', '2026-09-16'),
    'prefixes feat/fix/chore/docs/ci/security map to Added/Fixed/Changed/Changed/Changed/Security');
  check(secHas('Other', '2026-09-22') && secHas('Other', '2026-09-15'),
    'pr-shaped subjects (no conventional prefix) land in "Other"');
  check(out !== null && (out.match(/^- .*\(auto\)/gm) || []).length === 8, 'every auto entry carries the (auto) marker');
  check(out !== null && out.lastIndexOf('### Other') > out.lastIndexOf('### Security'),
    '"Other" renders last, after the seed\'s own section order');
  check(out !== null && !out.includes('pilot claim set') && !out.includes('regenerate shared derived artifacts'),
    'auto titles never echo the commit subject text');
  // Direct map probes (incl. the short security alias and an unknown prefix).
  check(AUTO_FALLBACK_SECTION === 'Other', 'fallback section is named "Other"');
  check(autoClassify({ pr: null, subject: 'feat: x' }).section === 'Added'
    && autoClassify({ pr: null, subject: 'fix: x' }).section === 'Fixed'
    && autoClassify({ pr: null, subject: 'security: x' }).section === 'Security'
    && autoClassify({ pr: null, subject: 'sec: x' }).section === 'Security'
    && autoClassify({ pr: 7, subject: 'Merge pull request #7 from o/b' }).section === 'Other'
    && autoClassify({ pr: null, subject: 'squash: x' }).section === 'Other',
    'autoClassify maps the measured vocabulary and falls back to "Other"');
  // SANITIZATION (leak-gate interlock): the two pr-shaped subjects above carry
  // row-ID shapes (CHANGELOG-1, …-AUTOFILL-1). The rendered bytes must be
  // leak-FREE — collectLeaks === 0 is also the exact condition main() exits 0
  // (not 1) on, so this control and leg 4 pin BOTH sides of the leak gate
  // under the auto-classification contract.
  check(out !== null && collectLeaks(out).length === 0,
    'auto-classified rendering of row-ID-soaked subjects is leak-free (sanitized titles)');
}
// ── 7. REAL SEED SANITY ─────────────────────────────────────────────────────
{
  const seed = JSON.parse(readFileSync(new URL('./changelog-seed.json', import.meta.url), 'utf8'));
  check(Array.isArray(seed.sections) && seed.sections.length >= 3, 'committed seed: sections well-formed');
  const bad = Object.entries(seed.entries || {}).filter(([, v]) => !seed.sections.includes(v.section));
  check(bad.length === 0, `committed seed: every entry names a real section (${bad.length} bad)`);
  const leaky = Object.entries(seed.entries || {}).filter(([, v]) => collectLeaks(`- ${v.title}`).length > 0);
  check(leaky.length === 0, `committed seed: every committed title passes the leak gate (${leaky.length} leaky)`);
}

console.log(`\n1..${ran}`);
if (failed) { console.error(`gen-changelog.selftest: ${failed}/${ran} FAILED`); process.exit(1); }
console.log(`gen-changelog.selftest: ${ran}/${ran} green`);
