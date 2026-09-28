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
 * ── PER-ENTRY TIMEOUT (DERIVED-REGEN-LIVE-SELFTEST-TIMEOUT-1) ────────────────
 * Every regen/gate command this file executes is bounded. Before 2026-09-28 the
 * per-entry `execSync` carried no `timeout`, so one command that waited on the
 * network, on a lock in the scratch tree, or on a child reading stdin blocked
 * the WHOLE gate — and, because preflight.mjs runs inside the pre-push hook,
 * wedged the push with it: measured on the #2101 branch, ~4 % CPU for 20+
 * minutes, killed twice, with no line in the log naming which entry was stuck
 * (ORCH-332, 2026-09-27). Three things close that:
 *   - `timeout: ENTRY_TIMEOUT_MS` (default 180 s, env override
 *     `DERIVED_REGEN_LIVE_TIMEOUT_MS`) + `killSignal: 'SIGKILL'`, and
 *     `stdio[0] = 'ignore'` so no child can block on stdin in the first place.
 *   - a TIMEOUT is its own reported state, named by ENTRY, with the elapsed
 *     seconds and the last 20 output lines — and the scan CONTINUES to the next
 *     entry, so one hung generator can no longer hide every other entry's
 *     verdict (it still hard-fails the gate, exit 1).
 *   - a progress line per target as it starts and ends, so even a run that dies
 *     to an outer kill leaves its culprit named in the log.
 *
 * Usage:
 *   node scripts/check-derived-regen-live.mjs           # human-readable report
 *   node scripts/check-derived-regen-live.mjs --check    # exit 0/1, wired into preflight (scoped)
 *   node scripts/check-derived-regen-live.mjs --list     # print covered entries + regen commands, run nothing
 *   node scripts/check-derived-regen-live.mjs --only <entry>   # run ONE entry (diagnosis)
 *   node scripts/check-derived-regen-live.mjs --self-test      # fixture proof of the timeout path (no real generator)
 *   DERIVED_REGEN_LIVE_TIMEOUT_MS=30000 node scripts/check-derived-regen-live.mjs --only counts
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

// ── per-entry probe anchors ──────────────────────────────────────────────────
// Some declared writers own only a REGION of a structured target they
// re-serialize wholesale. An EOF probe byte on such a target measures the
// wrong thing twice over: it sits outside every region the writer reads, and
// — for a JSON target — makes the file UNPARSEABLE, which no honest writer
// can repair by design. The probe then reads as a false CLASS A against a
// writer that is actually fine (measured 2026-09-19: manifest-examples). For
// entries listed here the probe byte is inserted inside the anchor's quoted
// string VALUE (first occurrence) instead — corruption inside the region the
// writer owns, re-derives and rewrites on every pass, exactly the drift this
// gate exists to see repaired. A real no-write defect still fails: the writer
// never moves mtime, its own --check still reports the corrupted tree STALE,
// CLASS A fires as before. Anchor absent from the target file -> fall back to
// the EOF append, i.e. fail toward the STRICTER probe, never a softer one.
const PROBE_ANCHORS = new Map([
  // gen-manifest-examples.mjs derives author/license for EVERY manifest
  // (planManifest: `set = { author: AUTHOR, license: LICENSE }`, constants)
  // and re-serializes the whole file, so a byte inside the author value is
  // owned-region corruption satisfies() sees and any real writer repairs
  // (MANIFEST-EXAMPLES-ANNOTATIONS-1). The fixture-backed example keys exist
  // only on fixture-carrying manifests and would not match batch-1 files.
  ['manifest-examples', '"author": "'],
]);

/** Probe bytes for one target: anchored inside the entry's owned region when possible, else EOF append. Returns {buf, anchored}. */
function probeBytesFor(entry, original) {
  const anchor = PROBE_ANCHORS.get(entry.id);
  if (anchor) {
    const anchorBuf = Buffer.from(anchor);
    const at = original.indexOf(anchorBuf);
    if (at !== -1) {
      const atEnd = at + anchorBuf.length;
      return {
        buf: Buffer.concat([original.subarray(0, atEnd), Buffer.from('~'), original.subarray(atEnd)]),
        anchored: true,
      };
    }
  }
  return { buf: Buffer.concat([original, Buffer.from('~')]), anchored: false };
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
//
// TIMEOUT (DERIVED-REGEN-LIVE-SELFTEST-TIMEOUT-1, see the file header): bounded
// per command, SIGKILL on expiry, stdin already closed (`'ignore'`) so nothing
// can wait on a terminal that isn't there. 180 s is generous against the
// slowest real entry measured (chaingraph-assemble, tens of seconds) and still
// ~3× faster to fail than the two 20-minute stalls that motivated the bound.
const DEFAULT_ENTRY_TIMEOUT_MS = 180_000;
function envTimeoutMs() {
  const raw = process.env.DERIVED_REGEN_LIVE_TIMEOUT_MS;
  if (raw === undefined || raw === '') return DEFAULT_ENTRY_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`derived-regen-live: ignoring DERIVED_REGEN_LIVE_TIMEOUT_MS="${raw}" (not a positive number), using ${DEFAULT_ENTRY_TIMEOUT_MS} ms`);
    return DEFAULT_ENTRY_TIMEOUT_MS;
  }
  return n;
}
const EXEC_OPTS = (dir, timeoutMs = DEFAULT_ENTRY_TIMEOUT_MS) => ({
  cwd: dir,
  env: { ...cleanGitEnv(), PYTHONIOENCODING: 'utf-8' },
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: timeoutMs,
  killSignal: 'SIGKILL',
});
function execOutput(e) { return ((e.stdout?.toString() || '') + (e.stderr?.toString() || '')).trim(); }
/** Last `n` lines of a command's combined output — a timeout report needs the tail, never the whole log. */
function tailLines(text, n = 20) {
  const lines = (text || '').split('\n');
  return lines.slice(-n).join('\n');
}
/**
 * Did this execSync rejection come from the timeout rather than a non-zero exit?
 * Node reports it three different ways depending on platform and how the child
 * died, so all three are accepted: `killed` + the kill signal, or the
 * ETIMEDOUT code. `elapsedMs` is the caller's own measurement, used as the
 * corroborating signal rather than the sole one (a genuinely slow command that
 * exits 1 at 181 s must still read as a failure, not a timeout).
 */
function isTimeoutError(e, timeoutMs, elapsedMs) {
  if (e?.code === 'ETIMEDOUT') return true;
  if (e?.killed === true && elapsedMs >= timeoutMs * 0.9) return true;
  if ((e?.signal === 'SIGKILL' || e?.signal === 'SIGTERM') && elapsedMs >= timeoutMs * 0.9) return true;
  return false;
}

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
function runLiveScan({ dir, covered, timeoutMs = DEFAULT_ENTRY_TIMEOUT_MS, progress = () => {} }) {
  const classA = [];
  const classB = [];
  const timeouts = [];
  const executionFailures = [];
  const probeUnsafe = [];
  const probeBlind = [];
  const unverifiable = [];
  const skippedEmptyDirs = [];
  const anchoredProbes = [];

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
      const probe = probeBytesFor(entry, bytesBefore);
      if (probe.anchored) anchoredProbes.push({ id: entry.id, path: target.declaredPath });
      writeFileSync(target.targetAbs, probe.buf);
      // Baseline MUST be read AFTER the probe write, not before it — the probe
      // write itself advances mtime, so a "before the probe" baseline would
      // make every entry look written even when regen touched nothing at all.
      const mtimeBefore = statSync(target.targetAbs).mtimeMs;
      const preStatus = gitStatusPaths(dir);

      progress(`entry ${entry.id} (${target.declaredPath}) … start`);
      let execError = null;
      let timedOut = false;
      let elapsedMs = 0;
      {
        const startedAt = Date.now();
        try {
          execSync(entry.regen, EXEC_OPTS(dir, timeoutMs));
          elapsedMs = Date.now() - startedAt;
        } catch (e) {
          elapsedMs = Date.now() - startedAt;
          execError = execOutput(e);
          timedOut = isTimeoutError(e, timeoutMs, elapsedMs);
        }
      }

      if (timedOut) {
        // A timed-out command is NOT re-run (the probe-unsafe disambiguation
        // below would simply hang for another full timeout), and the scan does
        // not stop: one hung generator must not hide every other entry's
        // verdict. Restore the probe, record the entry BY NAME, move on. Still
        // a hard failure overall — see printReport.
        progress(`entry ${entry.id} (${target.declaredPath}) … TIMEOUT ${(elapsedMs / 1000).toFixed(1)} s`);
        try { execSync(`git checkout -- "${target.targetRel}"`, { cwd: dir, ...GIT_EXEC_OPTS }); } catch { /* best effort */ }
        timeouts.push({
          id: entry.id,
          path: target.declaredPath,
          regen: entry.regen,
          timeoutMs,
          elapsedMs,
          output: tailLines(execError),
        });
        prevStatus = gitStatusPaths(dir);
        continue;
      }

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
        let cleanTimedOut = false;
        let cleanElapsedMs = 0;
        {
          const startedAt = Date.now();
          try {
            execSync(entry.regen, EXEC_OPTS(dir, timeoutMs));
            cleanElapsedMs = Date.now() - startedAt;
          } catch (e2) {
            cleanElapsedMs = Date.now() - startedAt;
            cleanError = execOutput(e2);
            cleanTimedOut = isTimeoutError(e2, timeoutMs, cleanElapsedMs);
          }
        }
        if (cleanTimedOut) {
          // The probe crashed it and the CLEAN re-run hung — the hang is the
          // finding worth reporting, named by entry, not an execution failure.
          progress(`entry ${entry.id} (${target.declaredPath}) … TIMEOUT ${(cleanElapsedMs / 1000).toFixed(1)} s (clean re-run)`);
          timeouts.push({
            id: entry.id,
            path: target.declaredPath,
            regen: entry.regen,
            timeoutMs,
            elapsedMs: cleanElapsedMs,
            output: tailLines(cleanError),
          });
        } else if (cleanError !== null) {
          progress(`entry ${entry.id} (${target.declaredPath}) … FAIL ${(cleanElapsedMs / 1000).toFixed(1)} s`);
          executionFailures.push({ id: entry.id, regen: entry.regen, output: cleanError });
        } else {
          // Every `… start` line gets a terminal line, including the branches
          // that `continue` — a start with no end is exactly the ambiguity the
          // progress output exists to remove.
          progress(`entry ${entry.id} (${target.declaredPath}) … probe-unsafe ${(cleanElapsedMs / 1000).toFixed(1)} s (clean re-run OK)`);
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
          // Bounded like regen is: a hung --check gate stalls the run exactly
          // as a hung generator does. A timeout here reads as "not clean",
          // which routes to CLASS A — the gate could not vouch for the tree.
          try { execSync(entry.gate, EXEC_OPTS(dir, timeoutMs)); gateReportsClean = true; } catch { gateReportsClean = false; }
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
      progress(`entry ${entry.id} (${target.declaredPath}) … ok ${(elapsedMs / 1000).toFixed(1)} s`);
    }
  }

  return { classA, classB, timeouts, executionFailures, probeUnsafe, probeBlind, unverifiable, skippedEmptyDirs, initialDirty, anchoredProbes };
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

function printReport({ classA, classB, timeouts = [], executionFailures, probeUnsafe, probeBlind, unverifiable, skippedEmptyDirs, initialDirty, dupFindings, shareFindings, anchoredProbes, executedCount = COVERED.filter((c) => c.regen).length }) {
  console.log(`derived-regen-live: ${executedCount} regen commands executed in a scratch worktree\n`);

  if (timeouts.length) {
    console.log(`✗ TIMEOUT — ${timeouts.length} regen command(s) exceeded their per-entry bound and were SIGKILLed:`);
    for (const f of timeouts) {
      console.log(`  - "${f.id}" (${f.path}) ran ${(f.elapsedMs / 1000).toFixed(1)} s against a ${(f.timeoutMs / 1000).toFixed(0)} s bound (\`${f.regen}\`)`);
      if (f.output) console.log(`      last output lines:\n      ${f.output.split('\n').join('\n      ')}`);
    }
  } else {
    console.log('✓ no regen command exceeded its per-entry timeout');
  }

  if (initialDirty.length) {
    console.log(`⚠ scratch worktree was not clean immediately after creation (${initialDirty.length} path(s)) — findings below are relative to that baseline\n`);
  }

  if (executionFailures.length) {
    console.log(`✗ EXECUTION FAILURE — ${executionFailures.length} regen command(s) exited non-zero:`);
    for (const f of executionFailures) console.log(`  - "${f.id}" (\`${f.regen}\`):\n      ${f.output.split('\n').join('\n      ')}`);
  } else {
    console.log('✓ every regen command that returned exited 0');
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

  if (anchoredProbes.length) {
    console.log(`\nℹ ${anchoredProbes.length} target(s) probed with an ENTRY-ANCHORED byte (corruption inside the region the writer owns and re-serializes; an EOF append would sit outside every owned region and, for a JSON target, be unrepairable by design):`);
    for (const f of anchoredProbes) console.log(`  - "${f.id}" (${f.path})`);
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

  return executionFailures.length > 0 || classA.length > 0 || classB.length > 0 || dupFindings.length > 0 || timeouts.length > 0;
}

// ── self-test: fixture proof of the timeout path (no real generator) ───────────
// SO #40b shape, in-script so the bound is provable without the paired test
// file: one FAST entry that writes (must pass) plus one entry whose regen
// deliberately outlives the configured bound (must TIMEOUT, by name, within
// that bound). The hanging fixture reaps ITSELF after 30 s rather than sleeping
// forever: Node's execSync timeout kills the shell it spawned, and on Windows a
// grandchild `node -e` can outlive that kill, so an unbounded sleep here would
// leave an orphan process behind every run.
function runSelfTest() {
  const TIMEOUT_MS = 2_000;
  const dir = mkdtempSync(join(tmpdir(), 'derived-regen-live-selftest-'));
  let failures = 0;
  const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };
  try {
    execSync('git init -q', { cwd: dir, ...GIT_EXEC_OPTS });
    execSync('git config user.email test@test.local', { cwd: dir, ...GIT_EXEC_OPTS });
    execSync('git config user.name selftest', { cwd: dir, ...GIT_EXEC_OPTS });
    writeFileSync(join(dir, 'gen-fast.mjs'), "import { writeFileSync } from 'node:fs';\nwriteFileSync('fast.json', '{\"regenerated\":true}\\n');\n");
    writeFileSync(join(dir, 'gen-hang.mjs'), 'setTimeout(() => process.exit(0), 30_000); // outlives the bound, then reaps itself\n');
    writeFileSync(join(dir, 'fast.json'), '{}\n');
    writeFileSync(join(dir, 'slow.json'), '{}\n');
    execSync('git add -A', { cwd: dir, ...GIT_EXEC_OPTS });
    execSync('git commit -q -m fixture', { cwd: dir, ...GIT_EXEC_OPTS });

    const covered = [
      { id: 'fixture-fast', regen: 'node gen-fast.mjs', artifacts: ['fast.json'] },
      { id: 'fixture-hang', regen: 'node gen-hang.mjs', artifacts: ['slow.json'] },
    ];
    console.log(`check-derived-regen-live --self-test (bound ${TIMEOUT_MS} ms)`);
    const startedAt = Date.now();
    const res = runLiveScan({ dir, covered, timeoutMs: TIMEOUT_MS, progress: (line) => console.log(`  · ${line}`) });
    const wallMs = Date.now() - startedAt;

    ok(res.timeouts.length === 1, `exactly one TIMEOUT finding, got ${res.timeouts.length}`);
    ok(res.timeouts[0]?.id === 'fixture-hang', `the TIMEOUT names the hanging entry, got "${res.timeouts[0]?.id}"`);
    ok(res.timeouts[0]?.elapsedMs >= TIMEOUT_MS * 0.9, `the TIMEOUT reports its elapsed time (${res.timeouts[0]?.elapsedMs} ms)`);
    ok(wallMs < TIMEOUT_MS * 6, `the whole scan finished in ${wallMs} ms, i.e. the bound actually cut the hang short`);
    ok(res.executionFailures.length === 0, `a timeout is NOT reported as an execution failure, got ${JSON.stringify(res.executionFailures)}`);
    ok(!res.timeouts.some((t) => t.id === 'fixture-fast'), 'the fast entry is not flagged as a timeout');
    ok(res.classA.length === 0 && res.classB.length === 0, `the fast entry produced no CLASS A/B finding, got ${JSON.stringify([res.classA, res.classB])}`);
    ok(printReport({ ...res, dupFindings: [], shareFindings: [], executedCount: covered.length }) === true,
      'printReport hard-fails on a TIMEOUT finding');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\ncheck-derived-regen-live --self-test: ${failures === 0 ? 'PASS' : `${failures} assertion(s) FAILED`}`);
  return failures === 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) {
    process.exit(runSelfTest() ? 0 : 1);
  } else if (argv.includes('--list')) {
    // Diagnosis aid: what WOULD run, and under what bound. Executes nothing.
    console.log(`derived-regen-live: ${COVERED.filter((c) => c.regen).length} covered entries carry a regen command (bound ${envTimeoutMs()} ms each)\n`);
    for (const c of COVERED) {
      if (!c.regen) continue;
      console.log(`  ${c.id}\n    regen: ${c.regen}\n    gate:  ${c.gate || '(none)'}`);
    }
    process.exit(0);
  } else {
    const onlyIdx = argv.indexOf('--only');
    let covered = COVERED;
    if (onlyIdx !== -1) {
      const wanted = argv[onlyIdx + 1];
      if (!wanted || wanted.startsWith('--')) {
        console.error('derived-regen-live: --only needs an entry id (see --list)');
        process.exit(2);
      }
      covered = COVERED.filter((c) => c.id === wanted);
      if (covered.length === 0) {
        console.error(`derived-regen-live: no covered entry with id "${wanted}" (see --list)`);
        process.exit(2);
      }
      console.log(`derived-regen-live: --only "${wanted}" — running one entry, not the whole set\n`);
    }
    const timeoutMs = envTimeoutMs();
    // CLASS C is static and scoped to whatever set is being run, so --only
    // reports duplicates for that entry alone rather than the whole estate's.
    const dupFindings = withinEntryDuplicates(covered);
    const shareFindings = crossEntryShares(covered);
    const result = withScratchWorktree((dir) => runLiveScan({
      dir,
      covered,
      timeoutMs,
      // stderr, not stdout: preflight captures a gate's stdout and prints it
      // only on failure, so a run killed from OUTSIDE (the 20-minute stalls
      // that motivated this) would lose exactly the lines that name the
      // culprit. stderr streams through.
      progress: (line) => process.stderr.write(`derived-regen-live: ${line}\n`),
    }));
    const hardFail = printReport({ ...result, dupFindings, shareFindings, executedCount: covered.filter((c) => c.regen).length });
    process.exit(hardFail ? 1 : 0);
  }
}

// withScratchWorktree is exported (MERGEQUEUE-GATE-PARITY-1) so
// check-regen-repairable.mjs reuses this exact throwaway-worktree discipline —
// mkdtemp + `git worktree add --detach HEAD` + guaranteed `git worktree remove
// --force` in a finally — rather than growing a second, subtly different
// implementation of it. One scratch-worktree mechanism, one cleanup path.
export { runLiveScan, withinEntryDuplicates, crossEntryShares, isWithinDeclared, gitStatusPaths, cleanGitEnv, withScratchWorktree };
