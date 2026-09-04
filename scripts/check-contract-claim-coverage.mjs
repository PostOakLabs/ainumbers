#!/usr/bin/env node
// check-contract-claim-coverage.mjs — META-GATE for CONTRACT.md §15.
//
// The mirror of RULINGS 2026-08-22's "no gate without a normative source": there
// is NO NORMATIVE SOURCE WITHOUT AN ENFORCEMENT DISPOSITION. CONTRACT.md makes
// claims about how this estate is built and, before §15, said of none of them
// what enforces it. A reader auditing enforcement by CTRL-F could not tell a
// gated rule from an ungated one, which is how the 2026-08-23 doctrine-execution
// audit found 19 of 44 claims (43%) resting on authorship alone — and two claims
// VIOLATED on main with nothing anywhere able to notice.
//
// ⭐ DISCIPLINE AND UNTESTABLE ARE HONEST VALUES, AND THIS GATE PASSES THEM.
// The defect is a claim with NO disposition, never a claim that is unenforced.
// A rule that no script can check ("zero PII collected", "prose reads for the
// stated audience") is not a bug in the contract; pretending it is checked is.
// ⛔ This gate is therefore NOT a coverage mandate: it will never demand that a
// DISCIPLINE row become a gated one, and a change that converts disposition
// values wholesale to make some number go up has misread it entirely.
//
// WHAT IT ASSERTS
//   1. §15 exists and parses, with at least one claim row (fail closed on zero).
//   2. Every claim row has a NON-EMPTY Gate cell.
//   3. Every Gate cell resolves: either it names ≥1 gate script that exists on
//      disk (or is a known worker-repo gate), or it is exactly DISCIPLINE or
//      UNTESTABLE. A cell naming a script that does not exist is the F2 finding
//      — "gate-name theater" — and is the single most dangerous state here,
//      because it reads as enforcement to a CTRL-F reader while enforcing
//      nothing. Worse than silence.
//   4. Claim ids are contiguous 1..N with no gaps or duplicates, so a row cannot
//      be dropped from the register without the count moving.
//
// ── THE TWO PARSER FIXES (audit F5) ──────────────────────────────────────────
// spec-gate-coverage.mjs, which this mirrors, parses its matrix like this:
//
//     const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
//     if (cells.length < 2) continue;
//
// Both halves of that line are wrong, and inheriting them would have made this
// gate a worse instrument than no gate at all:
//
//   FIX 1 — EMPTY-CELL SKIP. `.filter(Boolean)` DELETES empty cells rather than
//   preserving their position. A row whose Gate cell is blank does not fail —
//   the columns shift left and the NEXT cell is read as the gate. So the exact
//   defect this gate exists to catch (a claim with no disposition) is the one
//   input that silently produces a wrong pass. And `cells.length < 2` then
//   `continue`s past a mostly-empty row with no error at all: a skipped row is
//   indistinguishable from a clean one (SO #34c).
//
//   FIX 2 — ESCAPED PIPES. `row.split('|')` splits inside a cell containing an
//   escaped `\|`, shifting every column after it. SPEC's own §30 row is
//   mis-parsed today for exactly this reason. A claim cell that needs a literal
//   pipe (a regex, an alternation, a table-in-prose) must not silently corrupt
//   its neighbours' meaning.
//
// Both fixes are proven, on every run, against the LEGACY parser kept below for
// the comparison — see runSelfTest(). The pre-fix behaviour is printed, not
// asserted away, because "we fixed a parser bug" is a claim like any other.
//
// USAGE
//   node scripts/check-contract-claim-coverage.mjs            — self-test, then check
//   node scripts/check-contract-claim-coverage.mjs --self-test — controls only
//   node scripts/check-contract-claim-coverage.mjs --census    — print the disposition split
//   CONTRACT=… node scripts/check-contract-claim-coverage.mjs
//
// Zero-dependency. Non-zero exit blocks.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTRACT = process.env.CONTRACT || join(ROOT, 'CONTRACT.md');

// Where gate scripts may live. Same search-root shape as spec-gate-coverage.mjs.
const GATE_DIRS = (process.env.GATE_DIRS || [
  join(ROOT, 'scripts'),
  join(ROOT, 'chaingraph', 'standard'),
  join(ROOT, 'chaingraph', 'kernels'),
  join(ROOT, 'chaingraph', 'exporters'),
  join(ROOT, '.githooks'),
].join(';')).split(';').filter((d) => existsSync(d));

// Gates that live in the WORKER repo (mcp-apps-poc) and are verified by that
// repo's own CI. Named-but-not-on-disk is legitimate ONLY for these; every other
// unresolvable name is gate-name theater. Kept identical in spirit to
// spec-gate-coverage.mjs's EXTERNAL_GATES so the two meta-gates cannot disagree
// about what "external" means.
const EXTERNAL_GATES = new Set((process.env.GATE_EXTERNAL ||
  'hash-sweep.mjs,verify-mcp-registered.mjs,smoke-mcp.mjs,smoke-compute.mjs,check-tool-names.mjs,' +
  'kernel-coverage.mjs,validate-chains.mjs,linear-hash-freeze.mjs'
).split(',').map((s) => s.trim()).filter(Boolean));

/** The two honest non-gate dispositions. Neither is a defect; both PASS. */
export const DISPOSITIONS = new Set(['DISCIPLINE', 'UNTESTABLE']);

// ── PARSING ───────────────────────────────────────────────────────────────────

/**
 * THE LEGACY PARSER — spec-gate-coverage.mjs's line, verbatim, kept ONLY as the
 * control that the fixes below actually change behaviour. ⛔ Never call this to
 * parse anything for real.
 */
export function legacyParseRow(row) {
  return row.split('|').map((c) => c.trim()).filter(Boolean);
}

/**
 * FIXED PARSER. Splits a markdown table row into cells, preserving empties and
 * honouring escaped pipes.
 *
 * @param {string} row a single `| a | b | c |` line
 * @returns {string[]} cells, positionally faithful — an empty cell stays as ''
 */
export function parseRow(row) {
  let s = String(row).trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  // Split on a pipe NOT preceded by a backslash (FIX 2), then unescape.
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

/** Extract the §15 table rows from CONTRACT.md. */
export function extractSection15(text) {
  const after = String(text).split(/^##\s+.*§15\b/m)[1];
  if (after === undefined) return null;
  const body = after.split(/^##\s/m)[0];
  const rows = body.split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .filter((l) => !/^\|\s*:?-+/.test(l))          // separator row
    .filter((l) => !/^\|\s*#\s*\|/.test(l));       // header row
  return { body, rows };
}

/**
 * Classify one Gate cell.
 * @returns {{kind:'gate'|'disposition'|'empty'|'unresolved', gates:string[], value?:string, missing?:string[]}}
 */
export function classifyGateCell(cell, onDisk) {
  const raw = String(cell ?? '').trim();
  if (!raw) return { kind: 'empty', gates: [] };

  const gates = [...raw.matchAll(/([\w.\/-]+\.(?:mjs|js|py))\b/g)].map((m) => basename(m[1]));
  if (gates.length) {
    const missing = gates.filter((g) => !onDisk.has(g) && !EXTERNAL_GATES.has(g));
    return missing.length ? { kind: 'unresolved', gates, missing } : { kind: 'gate', gates };
  }

  // No script named ⇒ it must be exactly one of the honest dispositions. A cell
  // of free prose ("partially", "see below", "TODO") is NOT a disposition: it is
  // the "documented but not enforced" state wearing a disposition's clothes.
  const token = raw.replace(/[`*_]/g, '').trim().toUpperCase();
  if (DISPOSITIONS.has(token)) return { kind: 'disposition', gates: [], value: token };
  return { kind: 'unresolved', gates: [], missing: [], value: raw };
}

/**
 * Check a parsed §15 table.
 *
 * @param {string[]} rows raw table lines
 * @param {Set<string>} onDisk gate script basenames present on disk
 * @param {object} [opts]
 * @param {boolean} [opts.contiguity=true] assert ids are 1..N. Off for the
 *   single-row fixtures below, which test ROW semantics and would otherwise all
 *   trip the register-level rule for not starting at 1 — a fixture failing for a
 *   reason unrelated to what it tests is a broken control, not a finding.
 */
export function checkRows(rows, onDisk, opts = {}) {
  const wantContiguity = opts.contiguity !== false;
  const problems = [];
  const census = { gate: [], DISCIPLINE: [], UNTESTABLE: [] };
  const ids = [];

  for (const row of rows) {
    const cells = parseRow(row);
    // Columns: # | Claim | Gate | Verdict. Fewer than 3 is a MALFORMED row, and
    // it is REPORTED — never `continue`d past, which is the legacy skip (FIX 1).
    if (cells.length < 3) {
      problems.push(`malformed §15 row (${cells.length} cell(s), need ≥3): ${row.slice(0, 90)}`);
      continue;
    }
    const [id, claim, gateCell] = cells;
    ids.push(id);

    const c = classifyGateCell(gateCell, onDisk);
    if (c.kind === 'empty') {
      problems.push(`row ${id} has an EMPTY Gate cell — every normative claim carries a disposition. ` +
        `Name a gate script, or write DISCIPLINE / UNTESTABLE. Both are honest; blank is not. ` +
        `(claim: "${claim.slice(0, 60)}")`);
      continue;
    }
    if (c.kind === 'unresolved') {
      if (c.missing?.length) {
        problems.push(`row ${id} names gate(s) that do not exist on disk: ${c.missing.join(', ')} — ` +
          `this is gate-name theater (audit F2): it reads as enforcement to a CTRL-F reader and ` +
          `enforces nothing. Fix the name, or change the disposition to what is true.`);
      } else {
        problems.push(`row ${id}'s Gate cell is neither a gate script nor a disposition token: ` +
          `"${String(c.value).slice(0, 60)}". Legal values: a gate script filename, DISCIPLINE, or UNTESTABLE.`);
      }
      continue;
    }
    if (c.kind === 'disposition') census[c.value].push(id);
    else census.gate.push(id);
  }

  // Contiguity: a row cannot leave the register without the count moving.
  if (wantContiguity) {
    const nums = ids.map((i) => Number(String(i).replace(/[^\d]/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
    const seen = new Set();
    for (const n of nums) {
      if (seen.has(n)) problems.push(`duplicate claim id ${n} in §15.`);
      seen.add(n);
    }
    for (let n = 1; n <= nums.length; n++) {
      if (!seen.has(n)) problems.push(`claim id ${n} is missing from §15 — ids must be contiguous 1..N so a ` +
        `dropped row cannot hide behind a renumbering.`);
    }
  }

  return { problems, census, total: ids.length };
}

// ── SELF-TEST (SO #40b: a checker that cannot be shown red proves nothing) ────

function runSelfTest() {
  let pass = 0, fail = 0;
  const fails = [];
  const t = (name, fn) => {
    try { fn(); pass++; console.log(`  ✓ ${name}`); }
    catch (e) { fail++; fails.push(`${name}: ${e.message}`); console.log(`  ✗ ${name}\n      ${e.message}`); }
  };
  const ok = (c, m) => { if (!c) throw new Error(m); };
  const onDisk = new Set(['real-gate.mjs']);
  // Row-semantics fixtures: contiguity is a REGISTER-level rule and these are
  // single rows, so it is switched off here and gets its own dedicated control.
  const rowCheck = (rows) => checkRows(rows, onDisk, { contiguity: false });

  console.log('check-contract-claim-coverage — controls\n');

  // ── FIX 1: the empty-cell skip, pre-fix behaviour shown beside post-fix ─────
  const EMPTY_ROW = '| 7 | Some normative claim |  | HOLDS |';
  console.log('  PARSER FIX 1 — empty Gate cell');
  console.log(`    input : ${EMPTY_ROW}`);
  console.log(`    LEGACY (spec-gate-coverage.mjs): ${JSON.stringify(legacyParseRow(EMPTY_ROW))}`);
  console.log(`    FIXED  (parseRow):               ${JSON.stringify(parseRow(EMPTY_ROW))}`);

  t('FIX 1 pre-fix: the legacy parser DROPS the empty cell and reads the verdict as the gate', () => {
    const legacy = legacyParseRow(EMPTY_ROW);
    ok(legacy.length === 3, `expected 3 surviving cells, got ${legacy.length}`);
    ok(legacy[2] === 'HOLDS', `legacy would read the Gate cell as "${legacy[2]}" — the column shifted left`);
  });
  t('FIX 1 post-fix: parseRow preserves the empty cell POSITIONALLY', () => {
    const fixed = parseRow(EMPTY_ROW);
    ok(fixed.length === 4, `expected 4 cells, got ${fixed.length}`);
    ok(fixed[2] === '', `expected an empty Gate cell at index 2, got "${fixed[2]}"`);
    ok(fixed[3] === 'HOLDS', 'the verdict must stay in the verdict column');
  });
  t('FIX 1 RED: a blanked Gate cell FAILS the check', () => {
    const r = rowCheck([EMPTY_ROW]);
    ok(r.problems.length === 1, `expected 1 problem, got ${r.problems.length}: ${JSON.stringify(r.problems)}`);
    ok(/EMPTY Gate cell/.test(r.problems[0]), `wrong problem: ${r.problems[0]}`);
  });
  t('FIX 1 RED (ABSENCE): a short row is REPORTED, never silently skipped', () => {
    // The legacy `if (cells.length < 2) continue;` — a skipped row and a clean
    // row print the same green, and only one of them is true.
    const r = rowCheck(['| 3 | orphan |']);
    ok(r.problems.some((p) => /malformed/.test(p)), `a malformed row must be reported, got ${JSON.stringify(r.problems)}`);
  });

  // ── FIX 2: escaped pipes ───────────────────────────────────────────────────
  const PIPE_ROW = '| 9 | Copy bans `a \\| b` alternation | `real-gate.mjs` | HOLDS |';
  console.log('\n  PARSER FIX 2 — escaped pipe inside a claim cell');
  console.log(`    input : ${PIPE_ROW}`);
  console.log(`    LEGACY (spec-gate-coverage.mjs): ${JSON.stringify(legacyParseRow(PIPE_ROW))}`);
  console.log(`    FIXED  (parseRow):               ${JSON.stringify(parseRow(PIPE_ROW))}`);

  t('FIX 2 pre-fix: the legacy parser SPLITS on the escaped pipe and shifts every later column', () => {
    const legacy = legacyParseRow(PIPE_ROW);
    ok(legacy.length === 5, `expected 5 mis-split cells, got ${legacy.length}: ${JSON.stringify(legacy)}`);
    ok(legacy[2] !== '`real-gate.mjs`', 'legacy must NOT land the gate in the gate column (that is the bug)');
  });
  t('FIX 2 post-fix: parseRow keeps the cell whole and unescapes the pipe', () => {
    const fixed = parseRow(PIPE_ROW);
    ok(fixed.length === 4, `expected 4 cells, got ${fixed.length}: ${JSON.stringify(fixed)}`);
    ok(fixed[1] === 'Copy bans `a | b` alternation', `claim cell wrong: "${fixed[1]}"`);
    ok(fixed[2] === '`real-gate.mjs`', `gate cell wrong: "${fixed[2]}"`);
  });
  t('FIX 2 GREEN: the escaped-pipe row passes the check', () => {
    const r = rowCheck([PIPE_ROW]);
    ok(r.problems.length === 0, `expected clean, got ${JSON.stringify(r.problems)}`);
  });

  // ── the honest dispositions PASS — this is not a coverage mandate ──────────
  console.log('');
  t('GREEN: DISCIPLINE is an honest disposition and PASSES', () => {
    const r = rowCheck(['| 1 | Zero PII collected | DISCIPLINE | HOLDS |']);
    ok(r.problems.length === 0, `DISCIPLINE must pass, got ${JSON.stringify(r.problems)}`);
    ok(r.census.DISCIPLINE.length === 1, 'and be counted as DISCIPLINE');
  });
  t('GREEN: UNTESTABLE is an honest disposition and PASSES', () => {
    const r = rowCheck(['| 2 | Runtime-only behaviour contract | UNTESTABLE | UNTESTABLE |']);
    ok(r.problems.length === 0, `UNTESTABLE must pass, got ${JSON.stringify(r.problems)}`);
    ok(r.census.UNTESTABLE.length === 1, 'and be counted as UNTESTABLE');
  });
  t('GREEN: a real on-disk gate PASSES and is counted as a gate', () => {
    const r = rowCheck(['| 1 | Claim | `real-gate.mjs` | HOLDS |']);
    ok(r.problems.length === 0, `expected clean, got ${JSON.stringify(r.problems)}`);
    ok(r.census.gate.length === 1, 'must be counted as a gate');
  });

  // ── the F2 case: a named gate that does not exist ──────────────────────────
  t('RED: a Gate cell naming a NON-EXISTENT script is gate-name theater, not a pass', () => {
    const r = rowCheck(['| 1 | Claim | `imaginary-gate.mjs` | HOLDS |']);
    ok(r.problems.some((p) => /gate-name theater/.test(p)), `expected the F2 finding, got ${JSON.stringify(r.problems)}`);
  });
  t('RED: free prose in the Gate cell is NOT a disposition', () => {
    const r = rowCheck(['| 1 | Claim | partially, see below | HOLDS |']);
    ok(r.problems.some((p) => /neither a gate script nor a disposition/.test(p)), `got ${JSON.stringify(r.problems)}`);
  });
  t('RED (ABSENCE): a dropped claim id fails contiguity', () => {
    const r = checkRows([
      '| 1 | A | DISCIPLINE | HOLDS |',
      '| 3 | C | DISCIPLINE | HOLDS |',
    ], onDisk);
    ok(r.problems.some((p) => /claim id 2 is missing/.test(p)), `got ${JSON.stringify(r.problems)}`);
  });
  t('RED (ABSENCE): a missing §15 section is a distinct state, never green', () => {
    ok(extractSection15('# CONTRACT\n\nno such section\n') === null, 'a CONTRACT with no §15 must not parse as clean');
  });
  t('PARSE: extractSection15 reads the §15 table and skips header/separator rows', () => {
    const s = extractSection15([
      '## §15 Claim coverage', '',
      '| # | Claim | Gate | Verdict |',
      '|---|---|---|---|',
      '| 1 | A | DISCIPLINE | HOLDS |', '',
      '## §16 Something else', '',
      '| 9 | not mine | DISCIPLINE | HOLDS |',
    ].join('\n'));
    ok(s && s.rows.length === 1, `expected exactly the one claim row, got ${JSON.stringify(s && s.rows)}`);
  });

  console.log(`\ncheck-contract-claim-coverage controls: ${pass} passed, ${fail} failed`);
  if (fail) { console.log('\nFAILURES:'); for (const f of fails) console.log(`  - ${f}`); }
  return fail ? 1 : 0;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  const selfTestOnly = argv.includes('--self-test');
  const showCensus = argv.includes('--census');

  // The controls run on EVERY invocation, not behind a flag. A parser fix that
  // is only demonstrated once, by hand, in a PR body is a claim about the past.
  if (runSelfTest() !== 0) {
    console.error('\n✗ check-contract-claim-coverage: own controls FAILED — refusing to report on CONTRACT.md ' +
      'with a parser that cannot pass its own fixtures.');
    process.exit(1);
  }
  if (selfTestOnly) return 0;

  if (!existsSync(CONTRACT)) { console.error(`\nCONTRACT.md not found at ${CONTRACT}`); process.exit(2); }
  const text = readFileSync(CONTRACT, 'utf8');

  const onDisk = new Set();
  for (const d of GATE_DIRS) for (const f of readdirSync(d)) if (/\.(mjs|js|py)$/.test(f)) onDisk.add(f);

  const section = extractSection15(text);
  if (!section) {
    console.error('\n✗ CONTRACT.md has no §15 claim-coverage matrix. Every normative claim carries an ' +
      'enforcement disposition (RULINGS 2026-08-22, mirrored); with no §15 there is nothing to read one from.');
    process.exit(1);
  }
  if (!section.rows.length) {
    console.error('\n✗ CONTRACT.md §15 exists but has ZERO claim rows. Failing closed: an empty matrix and a ' +
      'fully-disposed one print the same green, and only one of them is true (SO #34c).');
    process.exit(1);
  }

  const { problems, census, total } = checkRows(section.rows, onDisk);

  console.log(`\ncheck-contract-claim-coverage · ${total} claim rows · ${GATE_DIRS.length} gate dirs`);
  console.log(`  disposition split: ${census.gate.length} gate-enforced · ` +
    `${census.DISCIPLINE.length} DISCIPLINE · ${census.UNTESTABLE.length} UNTESTABLE`);
  if (showCensus) {
    console.log(`    gate       : ${census.gate.join(', ')}`);
    console.log(`    DISCIPLINE : ${census.DISCIPLINE.join(', ')}`);
    console.log(`    UNTESTABLE : ${census.UNTESTABLE.join(', ')}`);
  }

  if (problems.length) {
    console.error(`\n✗ ${problems.length} claim-coverage problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('\n  Every normative claim in CONTRACT.md carries an enforcement disposition. DISCIPLINE and');
    console.error('  UNTESTABLE are honest values and always pass — the defect is a claim with NO disposition,');
    console.error('  or one naming a gate that does not exist.');
    process.exit(1);
  }
  console.log('✓ every CONTRACT.md §15 claim carries a resolvable enforcement disposition');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
