#!/usr/bin/env node
/**
 * scripts/check-derived-regen-live.mjs — DERIVED-SET-SELFTEST-1
 *
 * ── WHY THIS GATE EXISTS ─────────────────────────────────────────────────────
 * scripts/check-derived-declare-parity.mjs proves the declared set is INTERNALLY
 * consistent by STATICALLY parsing generator source — it never runs anything.
 * That leaves exactly the defect class a static parser cannot see: a regen
 * command whose LITERAL text passes every check but, when actually EXECUTED,
 * (a) does not write at all (the missing-`--write`-flag shape that regressed
 * kernel-index to a silent no-op regen), or (b) writes somewhere the declared
 * `artifacts[]` doesn't cover (the shape that took down a whole regen run when
 * `chaingraph.meta.json` / `docs/catalog.json` escaped the anti-escape guard —
 * SO #47). Both incidents are provable only by RUNNING the command and watching
 * the filesystem and `git status`, which is what this gate does — SO #40(c)'s
 * idempotence proof, applied to the declared LIST itself rather than to one
 * generator's output.
 *
 * ── METHOD ───────────────────────────────────────────────────────────────────
 * Runs in a THROWAWAY git worktree (`git worktree add --detach`, off HEAD),
 * never the shared tree (SO #3 + P13). For every COVERED entry with a `regen`
 * command, in array order (the declared dependency order — `after:` chains
 * like euc-register -> euc-register-page depend on it):
 *
 *   1. PROBE: append one `~` byte to every declared FILE artifact (and, for a
 *      declared DIRECTORY artifact, to one representative file inside it, if
 *      any exists). This guarantees real, unambiguous drift exists before the
 *      command runs — on an already-fresh `main` most generators are
 *      legitimately no-ops (SO #35's whole point), so "did it write anything"
 *      is meaningless without first creating something for it to fix.
 *      `~` specifically, not a space — see runLiveScan()'s inline comment for
 *      the two false-positive classes measured with a space and why `~` (a
 *      non-whitespace byte) closes both.
 *   2. Run the entry's `regen` command for real.
 *   3. CLASS A (no-write): compare the file's mtime before vs after this
 *      entry's regen call. Unchanged means the command never opened it for
 *      writing at all — RED. (Byte content is NOT the signal — most generators
 *      here read-and-splice their own TARGET, so bytes outside a marker region
 *      pass through unchanged even on a real write; mtime is what a real
 *      `writeFileSync` call always moves, measured directly — see the inline
 *      comment at the probe site.)
 *   4. CLASS B (escape): `git status --porcelain -z`, diffed against the
 *      snapshot taken before this entry ran, must name only paths inside this
 *      entry's declared `artifacts[]` (file exact match, or nested under a
 *      declared directory). Anything else is an undeclared write — RED.
 *   5. Restore every probed path via `git checkout -- <path>` before the next
 *      entry runs, so a genuine CLASS A defect in entry N cannot cascade into
 *      a false reading for entry N+1 (e.g. euc-register-page reading a still-
 *      broken register entry that euc-register left unwritten).
 *
 * CLASS C (duplicate) needs no execution: two entries legitimately sharing one
 * output file (marker-region cooperators — `chain-index`/`chaingraph-hub` on
 * `chaingraph-hub.html`, `counts`/`debt-ledger` on `fv-explainer.html`, both
 * documented in derived-artifacts.mjs) is by design and already surfaced as an
 * advisory by check-derived-declare-parity.mjs's own dedupe WARN. What is NEVER
 * legitimate is the SAME entry listing the SAME path twice in its own
 * `artifacts[]` — a pure authoring duplicate (the mined `fv-explainer.html`
 * incident) — so that shape alone is HARD here.
 *
 * ⛔ SO #35 untouched: this reads and executes generators to validate the
 * MANIFEST, it never becomes a second writer of any shared artifact — nothing
 * from the scratch worktree is ever committed, and the worktree is destroyed
 * (`git worktree remove --force`) before this process exits.
 *
 * Usage:
 *   node scripts/check-derived-regen-live.mjs           # human-readable report
 *   node scripts/check-derived-regen-live.mjs --check    # exit 0/1, wired into preflight (scoped)
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COVERED, REPO } from './derived-artifacts.mjs';
import { gitEnv } from './_git-env-lib.mjs';

// GIT-ENV HYGIENE (measured, not theoretical): the pre-push hook invokes
// preflight.mjs from INSIDE a `git push`, and git sets GIT_DIR/GIT_INDEX_FILE
// (pointing at THIS worktree's git-dir) for that whole process tree. Node's
// execSync inherits process.env by default, so every nested `git` call this
// file spawns against a DIFFERENT directory (the scratch worktree, or —in the
// paired test file— a synthetic fixture repo) was silently redirected at the
// wrong repository and failed with "fatal: this operation must be run in a
// work tree" (reproduced locally by exporting GIT_DIR before running the
// fixture self-test). `cwd`/`-C` alone is not enough to override these — the
// env vars win. Strip them from every git invocation's env so `cwd` is the
// only thing that decides which repository a call operates on.
//
// GIT-ENV-LEAK-SWEEP-1 (2026-08-23): this file's private cleanGitEnv() deleted eight NAMED keys.
// It is now an alias for the estate-wide gitEnv() in scripts/_git-env-lib.mjs, which drops every
// key matching /^GIT_/i. That is a strict SUPERSET of the old eight — nothing this file used to
// scrub is inherited now, the widening only removes MORE ambient git state, and the next variable
// git invents is excluded without anyone remembering to extend a list here. The alias name stays
// because check-regen-repairable.mjs and check-derived-regen-live.test.mjs both import it.
const cleanGitEnv = gitEnv;
const GIT_EXEC_OPTS = { stdio: ['ignore', 'pipe', 'pipe'], env: gitEnv() };

// ── path helpers ─────────────────────────────────────────────────────────────

/** Is `path` (git-status, forward-slash, repo-relative) covered by an entry's declared artifacts? */
function isWithinDeclared(path, artifacts) {
  return artifacts.some((a) => path === a || path.startsWith(a.replace(/\/$/, '') + '/'));
}

/** Find one regular file inside a directory (recursive, first found, deterministic order). */
function firstFileIn(absDir) {
  const stack = [absDir];
  while (stack.length) {
    const dir = stack.shift();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); }
    catch { continue; }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) stack.push(abs);
      else if (e.isFile()) return abs;
    }
  }
  return null;
}

// ── git status parsing (porcelain v1 -z: NUL-separated, no quoting ambiguity) ─

function gitStatusPaths(cwd) {
  const out = execSync('git status --porcelain=v1 -z', { cwd, ...GIT_EXEC_OPTS }).toString('utf8');
  const tokens = out.split('\0').filter((t) => t.length > 0);
  const paths = new Set();
  let i = 0;
  while (i < tokens.length) {
    const rec = tokens[i];
    const status = rec.slice(0, 2);
    const path = rec.slice(3);
    paths.add(path.replace(/\\/g, '/'));
    i++;
    if (status[0] === 'R' || status[0] === 'C') i++; // consume the ORIG_PATH token git emits for renames/copies
  }
  return paths;
}

// ── class C: static duplicate check (no execution) ────────────────────────────

/** Path listed more than once WITHIN one entry's own artifacts[] — always a bug. */
function withinEntryDuplicates(covered) {
  const findings = [];
  for (const entry of covered) {
    const seen = new Map();
    for (const p of entry.artifacts) seen.set(p, (seen.get(p) || 0) + 1);
    for (const [p, n] of seen) if (n > 1) findings.push({ id: entry.id, path: p, count: n });
  }
  return findings;
}

/** Path shared across two+ entries — legitimate by design (marker-region cooperators), informational only. */
function crossEntryShares(covered) {
  const owners = new Map();
  for (const entry of covered) {
    for (const p of new Set(entry.artifacts)) {
      if (!owners.has(p)) owners.set(p, []);
      owners.get(p).push(entry.id);
    }
  }
  return [...owners.entries()].filter(([, ids]) => ids.length > 1).map(([path, ids]) => ({ path, ids }));
}

// ── classes A + B: the live run ────────────────────────────────────────────────

/** Enumerate this entry's probe targets: one per declared FILE, one representative file per declared DIRECTORY. */
function collectProbeTargets(dir, entry, skippedEmptyDirs) {
  const targets = [];
  for (const rel of entry.artifacts) {
    const abs = resolve(dir, rel);
    if (!existsSync(abs)) continue; // absence is check-paths's job, not this gate's
    const st = statSync(abs);
    if (st.isFile()) {
      targets.push({ declaredPath: rel, targetAbs: abs, targetRel: rel });
    } else if (st.isDirectory()) {
      const proxyAbs = firstFileIn(abs);
      if (!proxyAbs) { skippedEmptyDirs.push({ id: entry.id, dir: rel }); continue; }
      targets.push({ declaredPath: rel, targetAbs: proxyAbs, targetRel: relative(dir, proxyAbs).replace(/\\/g, '/') });
    }
  }
  return targets;
}

// Two real generators (gen-debt-ledger.mjs, gen-rule-registry.mjs) shell out to
// `git` themselves against their OWN computed REPO const — same GIT_DIR-
// inheritance hazard as this file's own git calls (see the header comment
// above `cleanGitEnv`), so the entry.regen/entry.gate execution environment
// gets the same treatment, not just this file's direct git calls.
const EXEC_OPTS = (dir) => ({ cwd: dir, env: { ...cleanGitEnv(), PYTHONIOENCODING: 'utf-8' }, stdio: ['ignore', 'pipe', 'pipe'] });
function execOutput(e) { return ((e.stdout?.toString() || '') + (e.stderr?.toString() || '')).trim(); }

/**
 * Run every COVERED-shaped entry's regen command for real, inside `dir` (must
 * be a git working tree). Returns { classA, classB, executionFailures,
 * probeUnsafe, probeBlind, unverifiable, skippedEmptyDirs, initialDirty }.
 * Pure with respect to REPO —
 * it never creates a worktree itself, which is what makes it directly
 * unit-testable against a synthetic fixture repo (see
 * check-derived-regen-live.test.mjs) without any git-worktree machinery in
 * the test.
 *
 * PROBES ONE DECLARED TARGET AT A TIME, running `entry.regen` once per probe
 * (not once per entry). Measured necessity, not caution for its own sake: the
 * first version corrupted every declared artifact of an entry in one pass —
 * for `counts` (19 declared paths) that made ONE unrelated JSON parse failure
 * inside the run silently swallow the whole invocation, reading as 19 unrelated
 * no-write findings instead of the one real cause. Isolating each probe keeps
 * every finding attributable to the single byte that produced it.
 */
function runLiveScan({ dir, covered }) {
  const classA = [];
  const classB = [];
  const executionFailures = [];
  const probeUnsafe = [];
  const probeBlind = [];
  const unverifiable = [];
  const skippedEmptyDirs = [];

  let prevStatus = gitStatusPaths(dir);
  const initialDirty = [...prevStatus];

  for (const entry of covered) {
    if (!entry.regen) continue;

    const targets = collectProbeTargets(dir, entry, skippedEmptyDirs);

    for (const target of targets) {
      // PROBE BYTE, chosen deliberately: a single NON-whitespace character
      // (`~`), never a space. Two failure modes were measured and ruled out
      // before landing on this:
      //   - A trailing SPACE is what the first version of this gate used, and
      //     it produced 40 false positives. Most generators here read their
      //     own TARGET and splice fresh content into named marker regions
      //     (gen-sitemap-html.mjs:313 `let src = readFileSync(TARGET,'utf8')`),
      //     passing everything OUTSIDE a marker through byte-for-byte — a
      //     trailing space sits outside every marker and survives untouched.
      //   - `~` still isn't inside any marker, so byte-content comparison
      //     remains unusable for that class — CLASS A below reads mtime
      //     instead, which these generators DO always advance: their final
      //     `writeFileSync(TARGET, src, 'utf8')` (e.g. gen-sitemap-html.mjs:364)
      //     is unconditional, not gated behind whether a marker's content
      //     actually changed (measured: mtime moved even when bytes matched).
      //   - The SEPARATE reason `~` matters at all: a handful of entries
      //     (euc-register, fv-status, …) use a `writeIfChanged()` guard that
      //     `JSON.parse`s the on-disk file and skips the write if the parsed
      //     value already matches (gen-euc-register.mjs:136-141). JSON.parse
      //     tolerates trailing WHITESPACE, so a trailing space round-trips to
      //     an unchanged value and the guard correctly (and mistakenly, for
      //     this probe) skips writing — no mtime move, a false CLASS A. `~`
      //     is not whitespace, so JSON.parse throws, `onDisk` is treated as
      //     unparseable, and the guard takes its "write fresh" branch —
      //     measured: gen-euc-register then reports "wrote 1 changed entry
      //     file(s)" for exactly the probed file.
      const bytesBefore = readFileSync(target.targetAbs);
      writeFileSync(target.targetAbs, Buffer.concat([bytesBefore, Buffer.from('~')]));
      // Baseline MUST be read AFTER the probe write, not before it — the probe
      // write itself advances mtime, so a "before the probe" baseline would
      // make every entry look written even when regen touched nothing at all.
      const mtimeBefore = statSync(target.targetAbs).mtimeMs;
      const preStatus = gitStatusPaths(dir);

      let execError = null;
      try { execSync(entry.regen, EXEC_OPTS(dir)); } catch (e) { execError = execOutput(e); }

      if (execError !== null) {
        // Was the crash CAUSED by corrupting this specific declared artifact,
        // or is the regen command just broken regardless? Restore this one
        // probe and re-run clean to tell the two apart — a handful of entries
        // (nav-island, catalog, chaingraph-assemble) READ their own declared
        // artifact as REQUIRED STRUCTURED INPUT (not merely a skip-if-
        // unchanged comparison), so corrupting it crashes the parse before the
        // command ever reaches a write. That is a limit of this probe method,
        // not a no-write defect — SO #34c: report it as its own state, never
        // silently folded into either PASS or a hard FAIL.
        try { execSync(`git checkout -- "${target.targetRel}"`, { cwd: dir, ...GIT_EXEC_OPTS }); } catch { /* best effort */ }
        let cleanError = null;
        try { execSync(entry.regen, EXEC_OPTS(dir)); } catch (e2) { cleanError = execOutput(e2); }
        if (cleanError !== null) {
          executionFailures.push({ id: entry.id, regen: entry.regen, output: cleanError });
        } else {
          probeUnsafe.push({
            id: entry.id,
            path: target.declaredPath,
            reason: 'regen reads this declared artifact as required structured input — corrupting it crashes the command; a clean re-run of the same command succeeds, so this is a probe-method limit, not a no-write finding',
          });
        }
        prevStatus = gitStatusPaths(dir);
        continue; // classA/classB are inconclusive for a probe that never ran to completion
      }

      let mtimeAfter;
      try { mtimeAfter = statSync(target.targetAbs).mtimeMs; } catch { mtimeAfter = mtimeBefore; } // vanished == not (re)written
      if (mtimeAfter <= mtimeBefore) {
        // DISAMBIGUATE before calling this a defect. A handful of entries
        // (start-index, stats, openapi, counts, …) gate their write behind an
        // explicit skip-if-unchanged comparison scoped to the SPECIFIC region
        // or field they own (gen-start-index.mjs's embedded item array,
        // sync-stats.mjs's sentinel count) — measured directly: gen-start-index
        // printed "already fresh" against a `~`-corrupted start.html, because
        // the probe byte sits outside the substring it actually compares. That
        // is not a no-write defect, it is this probe missing the managed
        // region — indistinguishable from a real defect by mtime alone, so ask
        // the entry's OWN freshness gate (the same comparison regen's write
        // path uses, per SO #35's design) whether it still sees the corrupted
        // tree as clean. Gate says clean -> probe-blind, not a defect. Gate
        // says stale (drift the SAME generator can detect) yet write mode just
        // ran and did not fix it -> the real kernel-index-shaped defect.
        if (entry.gate) {
          let gateReportsClean = false;
          try { execSync(entry.gate, EXEC_OPTS(dir)); gateReportsClean = true; } catch { gateReportsClean = false; }
          if (gateReportsClean) {
            probeBlind.push({
              id: entry.id,
              path: target.declaredPath,
              reason: "the probe byte sits outside whatever region/field this entry's own --check gate reads, so no drift was visible to test here",
            });
          } else {
            classA.push({
              id: entry.id,
              path: target.declaredPath,
              issue: "this entry's own --check gate reports the corrupted artifact STALE, yet the regen command that just ran did not fix it — genuine no-write defect",
            });
          }
        } else {
          // No --check gate exists for this entry (e.g. `catalog`, a Python
          // generator with no freshness command — derived-artifacts.mjs says
          // so explicitly: "no --check mode"), so there is no independent
          // oracle to ask. SO #34c: a missing result is its own state, never
          // silently folded into a defect OR a pass — report UNVERIFIABLE and
          // move on; guessing either way would be worse than naming the gap.
          unverifiable.push({
            id: entry.id,
            path: target.declaredPath,
            reason: 'declared artifact mtime did not advance after regen ran, and this entry has no --check gate to independently confirm whether that is a real no-write defect or a probe-blind spot',
          });
        }
      }

      const postStatus = gitStatusPaths(dir);
      const newlyChanged = [...postStatus].filter((p) => !preStatus.has(p));
      for (const p of newlyChanged) {
        if (!isWithinDeclared(p, entry.artifacts)) {
          classB.push({ id: entry.id, path: p, regen: entry.regen, issue: 'regen touched a path outside its declared artifacts[]' });
        }
      }

      // Restore this probe before the next one — the dependency-chain safety
      // net described in the file header, point 5 (also prevents this probe's
      // leftover byte from being misattributed to the next target or entry).
      try { execSync(`git checkout -- "${target.targetRel}"`, { cwd: dir, ...GIT_EXEC_OPTS }); } catch { /* best effort */ }
      prevStatus = gitStatusPaths(dir);
    }
  }

  return { classA, classB, executionFailures, probeUnsafe, probeBlind, unverifiable, skippedEmptyDirs, initialDirty };
}

// ── CLI: scratch worktree wrapper ──────────────────────────────────────────────

function withScratchWorktree(fn) {
  const scratch = mkdtempSync(join(tmpdir(), 'derived-regen-live-'));
  execSync(`git worktree add --detach "${scratch}" HEAD`, { cwd: REPO, ...GIT_EXEC_OPTS });
  try {
    return fn(scratch);
  } finally {
    try {
      execSync(`git worktree remove --force "${scratch}"`, { cwd: REPO, ...GIT_EXEC_OPTS });
    } catch {
      try { rmSync(scratch, { recursive: true, force: true }); execSync('git worktree prune', { cwd: REPO, stdio: 'ignore', env: cleanGitEnv() }); }
      catch { /* best effort cleanup — a stray scratch worktree is annoying, never load-bearing */ }
    }
  }
}

function printReport({ classA, classB, executionFailures, probeUnsafe, probeBlind, unverifiable, skippedEmptyDirs, initialDirty, dupFindings, shareFindings }) {
  console.log(`derived-regen-live: ${COVERED.filter((c) => c.regen).length} regen commands executed in a scratch worktree\n`);

  if (initialDirty.length) {
    console.log(`⚠ scratch worktree was not clean immediately after creation (${initialDirty.length} path(s)) — findings below are relative to that baseline\n`);
  }

  if (executionFailures.length) {
    console.log(`✗ EXECUTION FAILURE — ${executionFailures.length} regen command(s) exited non-zero:`);
    for (const f of executionFailures) console.log(`  - "${f.id}" (\`${f.regen}\`):\n      ${f.output.split('\n').join('\n      ')}`);
  } else {
    console.log('✓ every regen command ran to completion');
  }

  if (classA.length) {
    console.log(`✗ CLASS A — NO-WRITE — ${classA.length} finding(s):`);
    for (const f of classA) console.log(`  - "${f.id}": ${f.issue} (${f.path})`);
  } else {
    console.log('✓ CLASS A — every entry with a regen command actually wrote its declared artifact(s)');
  }

  if (classB.length) {
    console.log(`✗ CLASS B — ESCAPE — ${classB.length} finding(s):`);
    for (const f of classB) console.log(`  - "${f.id}" (\`${f.regen}\`) touched "${f.path}", not in its declared artifacts[]`);
  } else {
    console.log('✓ CLASS B — every regen run touched only its own declared artifacts[]');
  }

  if (dupFindings.length) {
    console.log(`✗ CLASS C — WITHIN-ENTRY DUPLICATE — ${dupFindings.length} finding(s):`);
    for (const f of dupFindings) console.log(`  - "${f.id}" lists "${f.path}" ${f.count}x in its own artifacts[]`);
  } else {
    console.log('✓ CLASS C — no entry lists the same path twice in its own artifacts[]');
  }

  if (shareFindings.length) {
    console.log(`\nℹ ${shareFindings.length} path(s) legitimately shared across entries (marker-region cooperators, informational only):`);
    for (const f of shareFindings) console.log(`  - "${f.path}": ${f.ids.join(', ')}`);
  }

  if (skippedEmptyDirs.length) {
    console.log(`\nℹ ${skippedEmptyDirs.length} declared directory artifact(s) had no file to probe on this tree (CLASS A skipped for them):`);
    for (const f of skippedEmptyDirs) console.log(`  - "${f.id}": ${f.dir}`);
  }

  if (probeUnsafe.length) {
    console.log(`\nℹ ${probeUnsafe.length} target(s) PROBE-UNSAFE — corrupting them crashes their own regen command, but a clean re-run succeeds (not a defect, a limit of this probe method — SO #34c, reported as its own state):`);
    for (const f of probeUnsafe) console.log(`  - "${f.id}" (${f.path}): ${f.reason}`);
  }

  if (probeBlind.length) {
    console.log(`\nℹ ${probeBlind.length} target(s) PROBE-BLIND — the entry's own --check gate reports the corrupted tree clean, so no drift was visible to test at this target (not a defect):`);
    for (const f of probeBlind) console.log(`  - "${f.id}" (${f.path}): ${f.reason}`);
  }

  if (unverifiable.length) {
    console.log(`\nℹ ${unverifiable.length} target(s) UNVERIFIABLE — no --check gate exists on this entry to independently confirm no-write vs probe-blind (SO #34c: a missing result is its own state, never silently a pass OR a fail):`);
    for (const f of unverifiable) console.log(`  - "${f.id}" (${f.path}): ${f.reason}`);
  }

  return executionFailures.length > 0 || classA.length > 0 || classB.length > 0 || dupFindings.length > 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const dupFindings = withinEntryDuplicates(COVERED);
  const shareFindings = crossEntryShares(COVERED);
  const result = withScratchWorktree((dir) => runLiveScan({ dir, covered: COVERED }));
  const hardFail = printReport({ ...result, dupFindings, shareFindings });
  process.exit(hardFail ? 1 : 0);
}

// withScratchWorktree is exported (MERGEQUEUE-GATE-PARITY-1) so
// check-regen-repairable.mjs reuses this exact throwaway-worktree discipline —
// mkdtemp + `git worktree add --detach HEAD` + guaranteed `git worktree remove
// --force` in a finally — rather than growing a second, subtly different
// implementation of it. One scratch-worktree mechanism, one cleanup path.
export { runLiveScan, withinEntryDuplicates, crossEntryShares, isWithinDeclared, gitStatusPaths, cleanGitEnv, withScratchWorktree };
