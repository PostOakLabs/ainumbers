#!/usr/bin/env node
/**
 * check-git-env-scrub.mjs — GIT-ENV-LEAK-SWEEP-1's regression pin.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS GATE ASSERTS, and why "it recurred three times" is the whole argument for it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Git exports GIT_DIR / GIT_WORK_TREE / GIT_INDEX_FILE (and friends) into the environment of every
 * hook it runs, and those WIN OVER `cwd` in git's repository discovery. A gate that shells to git
 * to derive an "independent" answer therefore answers about the OUTER repository when it runs from
 * a hook — silently, with a well-formed verdict about the wrong tree. See scripts/_git-env-lib.mjs
 * for the three measured instances (DENOMINATOR-SENTINEL-1, SHARD-HARNESS-ENV-LEAK-1,
 * check-clause-digest.mjs) that each fixed this privately without anything making it general.
 *
 * FOUR CHECKS:
 *   A. COVERAGE  — every raw `git` spawn in a tracked JS/Python file either passes a scrubbed env,
 *                  or carries an in-file `GIT-ENV-EXEMPT:` marker with a written reason.
 *   B. SINGLE COPY — the scrub logic itself exists in exactly one JS module (_git-env-lib.mjs) and
 *                  one Python helper (verify_repo.py). A seventh private copy reds here.
 *   C. PROVENANCE — a file that spells `gitEnv(` / `isolatedChildEnv(` must IMPORT those from
 *                  _git-env-lib.mjs, so check A cannot be satisfied by a local look-alike.
 *   D. DENOMINATOR — the scan must actually find spawn sites (SO #34c: absence is not a pass). A
 *                  broken regex that matches nothing would otherwise print a green line forever.
 *
 * ⛔ THIS GATE CHECKS ENVIRONMENT PLUMBING ONLY. It says nothing about what any gate checks, how
 *    strict it is, or what verdict it returns — only which tree its git children are talking about.
 *
 * ── HOW A CALL SITE COUNTS AS COVERED ─────────────────────────────────────────────────────────
 * The argument text of the spawn call must mention a CLEAN ENV TOKEN. The clean set starts as
 * {gitEnv, isolatedChildEnv} and grows to a fixpoint: any identifier whose definition in the same
 * file mentions an already-clean token is itself clean. That is what lets a file keep an idiomatic
 * local shorthand — `const GIT_EXEC_OPTS = { env: gitEnv() }` then `execSync(cmd, {...GIT_EXEC_OPTS})`
 * — without this gate having to understand JavaScript.
 *
 * ── EXEMPTIONS ────────────────────────────────────────────────────────────────────────────────
 * `GIT-ENV-EXEMPT: <reason>` on the call line or within the 8 lines above it. The reason must be
 * at least 24 characters, so "why" is written down rather than gestured at. Exemptions are COUNTED
 * and PRINTED on every run — a silent exemption is not a thing this gate offers.
 *
 * Usage:  node scripts/check-git-env-scrub.mjs [--census]
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIB_REL = 'scripts/_git-env-lib.mjs';

/**
 * Files allowed to contain the scrub PATTERNS check B hunts for, because their job is to define or
 * to test them. Kept as an explicit three-name list, not a glob: a fourth name here is a decision
 * someone has to type.
 */
const PATTERN_DEFINERS = new Set([
  LIB_REL,
  'scripts/check-git-env-scrub.mjs',
  'scripts/check-git-env-scrub.test.mjs',
]);

/** The single sanctioned Python copy — Python cannot import an .mjs module (stated, not implied). */
const PYTHON_SCRUB_HOME = 'scripts/verify_repo.py';

/**
 * Files exempt from check A ONLY, because they carry deliberately-unscrubbed git spawns as STRING
 * LITERALS — RED fixtures written out to throwaway repos at run time. Linting a control's own
 * counterexamples is meaningless: the fixtures are unscrubbed on purpose, and that is the thing
 * being tested. The detectors read source text, not an AST, so they cannot tell a call from a
 * string that contains one.
 *
 * ⚠ NARROW BY DESIGN: this exempts only COVERAGE. Checks B (single copy), C (provenance) and D
 * (denominator) still apply to these files, and the RED fixtures they emit are written into
 * separate files inside the fixture repo, where the gate scans them normally — which is exactly
 * how R1..R6 prove the gate still sees an unscrubbed spawn. A second entry here would need the
 * same argument made in writing.
 */
const FIXTURE_BEARING = new Set([
  'scripts/check-git-env-scrub.test.mjs',
]);

// ── source enumeration ───────────────────────────────────────────────────────────────────────
// ⛔ `git ls-files`, never a directory walk: this workspace holds dozens of live worktrees under
// .wt/ and .worktrees/, and a recursive walk multiplies the file set by that number, sweeping in
// other sessions' in-flight branches (SO #52 — measured 19x on a 495-file sweep).
// And this call scrubs its own env, for exactly the reason the gate exists.
function trackedSources() {
  const out = execFileSync('git', ['ls-files', '--', '*.mjs', '*.js', '*.cjs', '*.py'], {
    cwd: REPO, encoding: 'utf8', env: gitEnv(), stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

// ── spawn-site detection ─────────────────────────────────────────────────────────────────────
// Two JS call shapes plus Python's subprocess. `git` must be the literal program, so a variable
// holding a path to some other binary is not swept in.
const JS_ARGV0 = /\b(?:execFileSync|execFile|spawnSync|spawn)\s*\(\s*(['"`])git\1/g;
const JS_SHELL = /\b(?:execSync|exec)\s*\(\s*(['"`])git[\s'"`]/g;
const PY_SPAWN = /\b(?:subprocess\.(?:run|check_output|call|check_call|Popen))\s*\(\s*\[\s*(['"])git\1/g;

/** Scan forward from `open` (index of the call's `(`) to its matching `)`, string-aware. */
function callArgumentText(src, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open); // unbalanced: hand back the rest, better over-inclusive than silent
}

/**
 * Replace every comment with spaces, preserving length and newlines so byte offsets and line
 * numbers stay exact. Without this the detectors below match their own prose: this file and
 * _git-env-lib.mjs both DOCUMENT the call shapes they hunt for, and a header that merely mentions
 * 'GIT_DIR' would be indicted as a private re-implementation. String and template literals are
 * respected so a `//` inside a URL is not mistaken for a comment.
 */
function blankComments(src) {
  const out = src.split('');
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') { out[i] = ' '; i++; }
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') out[i] = ' ';
        i++;
      }
      out[i] = ' '; out[i + 1] = ' ';
      i += 2;
      continue;
    }
    if (c === '#' && src[i + 1] !== '!') { // Python comments; '#!' shebang is harmless either way
      while (i < src.length && src[i] !== '\n') { out[i] = ' '; i++; }
      continue;
    }
    i++;
  }
  return out.join('');
}

/** Text of `name`'s definition in `src`, or '' — used to grow the clean-token set to a fixpoint. */
function definitionText(src, name) {
  const decl = new RegExp(
    `(?:(?:const|let|var)\\s+${name}\\s*=|function\\s+${name}\\s*\\(|${name}\\s*:\\s*(?:function)?\\s*\\()`, 'g');
  let text = '';
  let m;
  while ((m = decl.exec(src)) !== null) {
    const from = m.index;
    // The flat slice catches a one-line alias (`const env = gitEnv()`, `const childEnv = isolated…`)
    // whose whole RHS sits outside any bracket; the balanced construct catches a multi-line object
    // or function body that runs past it. Both, because either alone has a real blind spot.
    const opener = src.slice(from, from + 200).search(/[({[]/);
    text += src.slice(from, from + 400);
    if (opener !== -1) text += callArgumentText(src, from + opener);
  }
  return text;
}

/**
 * Identifiers in this file whose env is provably scrubbed, to a fixpoint.
 *
 * Seeded from the identifiers that actually appear in git spawn arguments — NOT from every
 * identifier in the file. preflight.mjs alone has ~1,500 identifiers and building a regex per
 * identifier over a 1,600-line file made this gate take minutes; the seeded set is a couple of
 * dozen and it runs in well under a second. Same verdicts, since an identifier that never appears
 * in a spawn call cannot make one clean.
 */
function cleanTokens(src, argTexts) {
  const clean = new Set(['gitEnv', 'isolatedChildEnv']);
  const candidates = new Set();
  for (const t of argTexts) for (const id of t.match(/\b[A-Za-z_$][\w$]*\b/g) || []) candidates.add(id);
  for (let pass = 0; pass < 5; pass++) {
    let grew = false;
    for (const id of [...candidates]) {
      if (clean.has(id)) continue;
      const def = definitionText(src, id);
      if (!def) continue;
      if ([...clean].some((t) => def.includes(t))) { clean.add(id); grew = true; continue; }
      // Not clean yet, but its definition may name a helper that IS — pull those in and retry.
      for (const nested of def.match(/\b[A-Za-z_$][\w$]*\b/g) || []) candidates.add(nested);
    }
    if (!grew) break;
  }
  return clean;
}

const EXEMPT = /GIT-ENV-EXEMPT:\s*(.+)/;

/** An exemption marker on this line or within the 8 lines above it, with a substantive reason. */
function exemptionFor(src, index) {
  const upto = src.slice(0, index).split('\n');
  const lineNo = upto.length;
  const lines = src.split('\n');
  const window = lines.slice(Math.max(0, lineNo - 9), lineNo + 1).join('\n');
  const m = window.match(EXEMPT);
  if (!m) return null;
  const reason = m[1].replace(/\*\/\s*$/, '').trim();
  return reason.length >= 24 ? reason : { tooShort: reason };
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

// ── the scan ─────────────────────────────────────────────────────────────────────────────────
function scan() {
  const sites = [];
  const violations = [];
  const exemptions = [];
  const copies = [];
  const provenance = [];

  for (const rel of trackedSources()) {
    let raw;
    try { raw = readFileSync(resolve(REPO, rel), 'utf8'); } catch { continue; }
    const isPy = rel.endsWith('.py');
    // Every detector below reads the COMMENT-MASKED source; only the exemption lookup reads `raw`,
    // because an exemption is by definition written in a comment.
    const src = blankComments(raw);

    // ── B. SINGLE COPY ──────────────────────────────────────────────────────────────────────
    // Three independent tells of a private re-implementation. Assembled from fragments so this
    // file's own detectors cannot match themselves in a naive substring scan.
    if (!PATTERN_DEFINERS.has(rel) && rel !== PYTHON_SCRUB_HOME) {
      const regexScrub = new RegExp('/' + '\\^GIT_' + '/i?').test(src);
      const namedAllowlist = /const\s+CHILD_ENV_ALLOWLIST\s*=\s*\[/.test(src);
      const keyArray = /['"]GIT_DIR['"]/.test(src) && /['"]GIT_WORK_TREE['"]/.test(src)
        && /\[[^\]]*['"]GIT_DIR['"][^\]]*\]/s.test(src);
      const tell = regexScrub ? 'a /^GIT_/ scrub regex'
        : namedAllowlist ? 'its own CHILD_ENV_ALLOWLIST'
          : keyArray ? 'its own GIT_DIR/GIT_WORK_TREE key array' : null;
      if (tell) copies.push({ rel, tell });
    }

    // ── C. PROVENANCE ───────────────────────────────────────────────────────────────────────
    if (!isPy && rel !== LIB_REL && /\b(?:gitEnv|isolatedChildEnv)\s*\(/.test(src)) {
      const imports = /import\s*\{[^}]*\b(?:gitEnv|isolatedChildEnv)\b[^}]*\}\s*from\s*['"][^'"]*_git-env-lib\.mjs['"]/s.test(src);
      if (!imports) provenance.push(rel);
    }

    // ── A. COVERAGE ─────────────────────────────────────────────────────────────────────────
    // Pass 1: locate the spawn sites and their argument text. Pass 2: decide coverage, using a
    // clean-token set seeded from exactly those arguments.
    const found = [];
    for (const re of (FIXTURE_BEARING.has(rel) ? [] : (isPy ? [PY_SPAWN] : [JS_ARGV0, JS_SHELL]))) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src)) !== null) {
        const open = src.indexOf('(', m.index);
        found.push({ index: m.index, args: callArgumentText(src, open), line: lineOf(src, m.index) });
      }
    }
    const clean = isPy ? new Set(['_git_env', 'GIT_ENV']) : cleanTokens(src, found.map((f) => f.args));
    for (const f of found) {
      sites.push({ rel, line: f.line });
      if ([...clean].some((t) => f.args.includes(t))) continue;
      const ex = exemptionFor(raw, f.index);
      if (ex && typeof ex === 'string') exemptions.push({ rel, line: f.line, reason: ex });
      else violations.push({ rel, line: f.line, snippet: f.args.slice(0, 90).replace(/\s+/g, ' '), shortReason: ex?.tooShort });
    }
  }
  return { sites, violations, exemptions, copies, provenance };
}

// ── report ───────────────────────────────────────────────────────────────────────────────────
const CENSUS_ONLY = process.argv.includes('--census');
const r = scan();
const files = new Set(r.sites.map((s) => s.rel));
const covered = r.sites.length - r.violations.length - r.exemptions.length;

console.log('git-env scrub census (enumerated with `git ls-files`, never a directory walk — SO #52):');
console.log(`  git spawn sites : ${r.sites.length} across ${files.size} tracked file(s)`);
console.log(`  scrubbed        : ${covered}`);
console.log(`  exempted        : ${r.exemptions.length}`);
console.log(`  unprotected     : ${r.violations.length}`);
for (const e of r.exemptions) console.log(`    ~ ${e.rel}:${e.line} — EXEMPT: ${e.reason}`);

if (CENSUS_ONLY) {
  for (const s of r.sites) console.log(`    · ${s.rel}:${s.line}`);
  process.exit(0);
}

let bad = 0;

// D. DENOMINATOR — a scan that found nothing is UNDETERMINABLE, never a pass (SO #34c).
// The floor is deliberately blunt: this estate had 60+ sites at adoption, so anything under 20
// means the detector broke, not that the estate got clean.
if (r.sites.length < 20) {
  bad++;
  console.error(`\n✗ UNDETERMINABLE — only ${r.sites.length} git spawn site(s) found; this estate has dozens.`);
  console.error('  A scan that matches nothing prints a green line forever. Absence is a distinct state,');
  console.error('  not a pass (SO #34c). Fix the detector in check-git-env-scrub.mjs before trusting this.');
}

if (r.violations.length) {
  bad++;
  console.error(`\n✗ ${r.violations.length} git spawn site(s) inherit the ambient GIT_* environment:`);
  for (const v of r.violations) {
    console.error(`    ${v.rel}:${v.line}  ${v.snippet}`);
    if (v.shortReason) console.error(`      (an exemption marker is present but its reason is under 24 chars: "${v.shortReason}")`);
  }
  console.error(`\n  Under .githooks/pre-push these answer about whatever repository the OUTER git command`);
  console.error(`  was operating on, ignoring cwd entirely — a well-formed verdict about the wrong tree.`);
  console.error(`  Fix:  import { gitEnv } from './_git-env-lib.mjs';  then pass  env: gitEnv()`);
  console.error(`  Or exempt it in-file:  // GIT-ENV-EXEMPT: <at least 24 characters of reason>`);
}

if (r.copies.length) {
  bad++;
  console.error(`\n✗ ${r.copies.length} private re-implementation(s) of the scrub — it must exist once:`);
  for (const c of r.copies) console.error(`    ${c.rel} carries ${c.tell}`);
  console.error(`  Six copies is how this class survived three fixes. Import from ${LIB_REL}.`);
}

if (r.provenance.length) {
  bad++;
  console.error(`\n✗ ${r.provenance.length} file(s) spell gitEnv()/isolatedChildEnv() without importing them:`);
  for (const p of r.provenance) console.error(`    ${p}`);
  console.error(`  A local look-alike would satisfy the coverage check while scrubbing nothing.`);
}

if (bad) process.exit(1);
console.log(`✓ git-env scrub: all ${covered} git spawn site(s) scrub GIT_* (${r.exemptions.length} declared exemption(s)); scrub logic defined once.`);
