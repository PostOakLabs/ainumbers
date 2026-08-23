#!/usr/bin/env node
/**
 * scripts/check-regen-repairable.mjs — MERGEQUEUE-GATE-PARITY-1
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * `Scripts Verify` reported `merge_group / success` and `push / failure` on the
 * SAME head SHA, eight minutes apart — and did it on five SHAs in one morning
 * (2026-08-23: 531c56fb, e6278729, a84b94bd, 4daa8b6f, c2ccae23). Because
 * `scripts-verify / required` is a required status check, it cleared a commit at
 * the merge gate and then failed that identical commit on main. A green queue
 * verdict said nothing about main.
 *
 * MECHANISM, at file and line — NOT path relevance (the `relevant` job returned
 * hit=true and "Full preflight gate suite" RAN in both members of every pair):
 *
 *   scripts/derived-artifacts.mjs:672-675  isMainContext() returns FALSE for
 *                                          `merge_group`, so
 *   scripts/preflight.mjs:864              downgrades every COVERED freshness
 *                                          gate to ADVISORY inside the queue,
 *                                          while the identical commit's
 *                                          `push: main` run keeps them BLOCKING.
 *   Measured:  GITHUB_EVENT_NAME=push        -> main (gates BLOCK)
 *              GITHUB_EVENT_NAME=merge_group -> pr   (gates WARN)
 *
 * The downgrade is CORRECT in principle and stays: SO #35 makes these artifacts
 * single-writer, a branch is FORBIDDEN to regenerate them, and
 * derived-artifacts-regen.yml repairs them on main after merge. A gate a branch
 * cannot satisfy must not block that branch.
 *
 * What was wrong is that the downgrade rested on an UNVERIFIED PREMISE — "the
 * main-side regen will repair this after merge". PR #1477 falsified it. It
 * retired art-99 and left chaingraph/register/art-99-….register.json behind.
 * gen-euc-register.mjs --check DETECTS a stale entry (line 161, reported at 195);
 * its write path only writes entries for LIVE nodes and has no code path that
 * deletes one. Measured on the real fixture, restored from bec907ed^:
 *
 *     gate before regen   -> exit 1  "1 stale entries (node no longer live)"
 *     regen (write mode)  -> exit 0  "wrote 0 changed entry file(s)"
 *     gate after regen    -> exit 1  IDENTICAL
 *
 * So the bot could never fix it. The queue kept saying yes, five more PRs merged
 * straight through the same green gate, and main stayed red for 15 hours.
 *
 * ── WHAT THIS GATE DOES ──────────────────────────────────────────────────────
 * It does not decide whether an artifact is stale — each entry's own `--check`
 * gate already decided that, unchanged. It decides whether an advisory downgrade
 * was EARNED, by testing the premise the downgrade rests on. In a throwaway
 * worktree off HEAD (never the shared tree — SO #3, SO #50; the same
 * withScratchWorktree() check-derived-regen-live.mjs already uses):
 *
 *   1. re-run the entry's own gate            -> confirm the drift is really at HEAD
 *   2. run that entry's declared regen chain  -> its `after:` closure, declared order
 *   3. re-run the gate
 *        PASSES -> the bot WILL repair this after merge. The downgrade is
 *                  legitimate; behaviour is exactly what it was before.
 *        FAILS  -> escalate to the FULL declared regen — `derived-artifacts.mjs
 *                  --regen`, the literal command derived-artifacts-regen.yml
 *                  runs on main (line 139) — and re-run once more, so an
 *                  UNDECLARED cross-generator dependency cannot manufacture a
 *                  false UNREPAIRABLE verdict.
 *        STILL FAILS -> the bot CANNOT repair it. This drift survives the merge
 *                  and reds main. HARD FAIL, in every context.
 *
 * ⇒ "green in the queue, red on main" for a COVERED freshness gate is now
 * impossible by construction: the queue may only downgrade drift it has just
 * DEMONSTRATED the post-merge writer erases.
 *
 * ⛔ ZERO GATE SEMANTICS CHANGED. No gate's pass/fail predicate is touched. No
 * gate becomes stricter or looser about WHAT it checks. The only thing that
 * changed is whether an already-failing gate is permitted to be non-blocking —
 * previously assumed, now derived (SO #34: recompute, never inherit a claim).
 *
 * ⛔ FAILS CLOSED EVERYWHERE (SO #34c — a missing result is never a green one):
 *   - a regen command exits non-zero        -> UNREPAIRABLE (hard)
 *   - the scratch worktree cannot be made   -> throws, hard
 *   - the gate is GREEN at HEAD though the
 *     caller saw it red                     -> its own reported state, and HARD
 *     under GITHUB_ACTIONS: CI checks out exactly HEAD, so the two measurements
 *     cannot legitimately disagree there. Soft only on a local pre-push run,
 *     where uncommitted working-tree edits fully explain it and HEAD — the thing
 *     actually being pushed — is what CI will see.
 * ⛔ There is no skip path, no always(), no continue-on-error, no advisory
 * escape hatch, and no env var that turns this off.
 *
 * ── --diagnose: THE SAME PROBE, USED AS A CLASSIFIER ON MAIN ─────────────────
 * On `push: main` nothing is downgraded, so the probe has no verdict to make —
 * but it still answers the question an operator actually has when main goes red
 * at a freshness gate, and which cost ORCH a manual investigation on 2026-08-23:
 *
 *   REPAIRABLE   -> REGEN LAG. derived-artifacts-regen.yml is repairing this on
 *                   this very push; the expected human-push → red → bot-regen →
 *                   green cycle. Nothing to do. (2026-08-23: DEBT-LEDGER-1 at
 *                   05291cb2, healed by the bot in bae4d9a0.)
 *   UNREPAIRABLE -> PERMANENT. No workflow will ever clear this; it needs a
 *                   human PR. (2026-08-23: EUC-SITE-1 / art-99, cleared only by
 *                   #1486 after 15 hours.)
 *
 * Those two look IDENTICAL in the CI log today — one red gate, same wording —
 * and telling them apart by eye is exactly what did not happen for 15 hours.
 * `--diagnose` prints the classification and ALWAYS exits 0: on main the gate has
 * already failed on its own merits and this must never soften that verdict.
 *
 * Usage:
 *   node scripts/check-regen-repairable.mjs                  # every gated COVERED entry
 *   node scripts/check-regen-repairable.mjs --ids euc-register,counts
 *   node scripts/check-regen-repairable.mjs --gate 'node scripts/gen-euc-register.mjs --check'
 *   node scripts/check-regen-repairable.mjs --diagnose --ids debt-ledger   # classify only, always exit 0
 *
 * Exit 0 — every stale entry examined is repairable by the main-side regen (or --diagnose).
 * Exit 1 — at least one is NOT, or repairability could not be established.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COVERED } from './derived-artifacts.mjs';
import { withScratchWorktree, cleanGitEnv } from './check-derived-regen-live.mjs';

// The literal command derived-artifacts-regen.yml runs on main (line 139). Kept
// as one constant so the escalation below can never drift from what the bot does.
export const FULL_REGEN_CMD = 'node scripts/derived-artifacts.mjs --regen';

// Same git-env hygiene as check-derived-regen-live.mjs: two COVERED generators
// (gen-debt-ledger.mjs, gen-rule-registry.mjs) shell out to `git` themselves, and
// preflight.mjs runs from inside `git push` via .githooks/pre-push, which exports
// GIT_DIR/GIT_INDEX_FILE for the whole process tree. cwd alone does not win
// against those; cleanGitEnv() strips them so cwd is the only thing deciding
// which repository a nested git call touches.
const EXEC_OPTS = (dir) => ({
  cwd: dir,
  env: { ...cleanGitEnv(), PYTHONIOENCODING: 'utf-8' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

function execOutput(e) {
  return ((e.stdout?.toString() || '') + (e.stderr?.toString() || '')).trim();
}

/** Default command runner. Injectable so the paired test drives probeRepairable() with no git at all. */
export function defaultExec(cmd, dir) {
  try {
    return { ok: true, output: (execSync(cmd, EXEC_OPTS(dir)).toString() || '').trim() };
  } catch (e) {
    return { ok: false, output: execOutput(e) };
  }
}

/**
 * COVERED entries selected by id, or by their exact `gate` command string (which
 * is how preflight.mjs and run-gate.mjs identify an advisory-downgraded gate —
 * advisoryGates() is a Set of those very strings).
 */
export function selectEntries({ ids = [], gates = [] }, covered = COVERED) {
  const wantIds = new Set(ids);
  const wantGates = new Set(gates);
  if (!wantIds.size && !wantGates.size) return covered.filter((c) => c.gate);
  return covered.filter((c) => c.gate && (wantIds.has(c.id) || wantGates.has(c.gate)));
}

/**
 * Transitive `after:` closure of `entry` plus the entry itself, returned in
 * `covered` array order (which derived-artifacts.mjs declares IS dependency
 * order). Today only one edge exists — euc-register-page after euc-register —
 * but resolving the closure rather than hardcoding that keeps a future `after:`
 * chain correct without another edit here.
 */
export function regenChain(entry, covered = COVERED) {
  const byId = new Map(covered.map((c) => [c.id, c]));
  const need = new Set();
  (function walk(e) {
    if (!e || need.has(e.id)) return;
    need.add(e.id);
    if (e.after) walk(byId.get(e.after));
  })(entry);
  return covered.filter((c) => need.has(c.id) && c.regen);
}

/**
 * The probe. Pure with respect to the repository: everything it touches goes
 * through `exec(cmd, dir)`, so the paired self-test drives every branch against
 * a scripted command table with no git, no worktree and no generators.
 *
 * @returns {{notReproduced: object[], repaired: object[], unrepairable: object[], escalated: boolean}}
 */
export function probeRepairable({ dir, entries, covered = COVERED, exec = defaultExec }) {
  const notReproduced = [];
  const repaired = [];
  const unrepairable = [];
  const red = [];

  // 1. Independent re-derivation (SO #34): do NOT trust the caller's verdict that
  //    these are stale — re-run each gate here, against HEAD, and see for itself.
  for (const entry of entries) {
    if (!entry.gate) continue; // an entry with no --check gate can never be advisory-downgraded
    const r = exec(entry.gate, dir);
    if (r.ok) notReproduced.push({ id: entry.id, gate: entry.gate, output: r.output });
    else red.push(entry);
  }
  if (!red.length) return { notReproduced, repaired, unrepairable, escalated: false };

  // 2. Scoped regen first — only the failing entries' own declared chains. Cheap,
  //    and it avoids executing unrelated generators (the Python catalog one, the
  //    chaingraph assembler) whose failure would say nothing about this drift.
  const alreadyRan = new Set();
  const brokeOnRegen = new Set();
  for (const entry of red) {
    for (const step of regenChain(entry, covered)) {
      if (alreadyRan.has(step.id)) continue;
      alreadyRan.add(step.id);
      const r = exec(step.regen, dir);
      if (!r.ok) {
        brokeOnRegen.add(entry.id);
        unrepairable.push({
          id: entry.id,
          gate: entry.gate,
          stage: 'regen',
          cmd: step.regen,
          reason: `the declared regen command for "${step.id}" exited non-zero, so repairability could not be established`,
          output: r.output,
        });
      }
    }
  }

  const stillRed = [];
  for (const entry of red) {
    if (brokeOnRegen.has(entry.id)) continue;
    const r = exec(entry.gate, dir);
    if (r.ok) repaired.push({ id: entry.id, gate: entry.gate, via: 'declared regen chain' });
    else stillRed.push({ entry, output: r.output });
  }

  // 3. Escalate to the FULL regen the main-side bot actually runs, before calling
  //    anything unrepairable. An undeclared cross-generator dependency must never
  //    be able to produce a false hard fail — the verdict has to be about the
  //    artifact, not about how tightly this probe scoped itself.
  let escalated = false;
  if (stillRed.length) {
    escalated = true;
    const full = exec(FULL_REGEN_CMD, dir);
    for (const { entry, output } of stillRed) {
      if (!full.ok) {
        unrepairable.push({
          id: entry.id,
          gate: entry.gate,
          stage: 'full-regen',
          cmd: FULL_REGEN_CMD,
          reason: 'the full declared regen (the command the main-side regen workflow runs) exited non-zero, so repairability could not be established',
          output: full.output,
        });
        continue;
      }
      const r = exec(entry.gate, dir);
      if (r.ok) {
        repaired.push({ id: entry.id, gate: entry.gate, via: 'full declared regen' });
      } else {
        unrepairable.push({
          id: entry.id,
          gate: entry.gate,
          stage: 'gate',
          cmd: entry.gate,
          reason: 'still stale after the FULL declared regen — the main-side writer cannot repair this, so it survives the merge and reds main',
          output: r.output || output,
        });
      }
    }
  }

  return { notReproduced, repaired, unrepairable, escalated };
}

/**
 * Turn a probe result into printable lines + a hard-fail verdict.
 * `ci` decides only the NOT-REPRODUCED case (see the header's fails-closed list).
 */
export function reportProbe(res, { ci = process.env.GITHUB_ACTIONS === 'true' } = {}) {
  const lines = [];
  let hardFail = false;

  lines.push(
    `regen-repairable: probed ${res.notReproduced.length + res.repaired.length + res.unrepairable.length} advisory-downgraded gate(s) in a scratch worktree off HEAD` +
      (res.escalated ? ' (escalated to the full declared regen)' : '')
  );

  if (res.repaired.length) {
    lines.push(`✓ ${res.repaired.length} REPAIRABLE — the main-side regen erases this drift after merge, so the advisory downgrade is earned:`);
    for (const r of res.repaired) lines.push(`    ✓ ${r.id}  (repaired by the ${r.via})`);
  }

  if (res.notReproduced.length) {
    lines.push(
      `${ci ? '✗' : 'ℹ'} ${res.notReproduced.length} NOT REPRODUCED AT HEAD — the gate is GREEN on the committed tree though the caller saw it red:`
    );
    for (const r of res.notReproduced) lines.push(`    ${ci ? '✗' : 'ℹ'} ${r.id}  (\`${r.gate}\`)`);
    if (ci) {
      lines.push('    Under GITHUB_ACTIONS this is HARD: CI checks out exactly HEAD, so the two measurements cannot legitimately disagree.');
      hardFail = true;
    } else {
      lines.push('    Local run: uncommitted working-tree edits explain this. HEAD — what CI will actually see — is clean for these.');
    }
  }

  if (res.unrepairable.length) {
    lines.push(`✗ ${res.unrepairable.length} NOT REPAIRABLE BY THE MAIN-SIDE REGEN — this drift survives the merge and reds main:`);
    for (const u of res.unrepairable) {
      lines.push(`    ✗ ${u.id} [${u.stage}] ${u.reason}`);
      lines.push(`      cmd: ${u.cmd}`);
      if (u.output) lines.push('      ' + u.output.split('\n').join('\n      '));
    }
    lines.push('');
    lines.push('    ⛔ These gates may NOT be downgraded to advisory. SO #35 hands shared derived');
    lines.push('       artifacts to main\'s regen workflow, and that hand-off is only valid for drift');
    lines.push('       the regen can actually erase. Fix the drift in this PR (for a stale/orphaned');
    lines.push('       artifact that is usually a `git rm`), or fix the generator so its write path');
    lines.push('       repairs what its own --check reports.');
    hardFail = true;
  }

  if (!res.repaired.length && !res.notReproduced.length && !res.unrepairable.length) {
    lines.push('✓ nothing stale — no advisory downgrade was needed.');
  }

  return { hardFail, lines };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const argv = process.argv.slice(2);
  const ids = [];
  const gates = [];
  let diagnose = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ids') ids.push(...(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean));
    else if (argv[i] === '--gate') gates.push(argv[++i] || '');
    else if (argv[i] === '--diagnose') diagnose = true;
  }

  const entries = selectEntries({ ids, gates });
  if (!entries.length) {
    // SO #34c: "I was asked about nothing" is a distinct state, and asking about
    // an id that does not exist is a wiring bug, not a pass.
    console.error(`✗ check-regen-repairable: no gated COVERED entry matched ${ids.length ? `--ids ${ids.join(',')}` : ''}${gates.length ? ` --gate ${gates.join(' --gate ')}` : ''}`);
    process.exit(1);
  }

  const res = withScratchWorktree((dir) => probeRepairable({ dir, entries }));

  if (diagnose) {
    // Classifier mode (main). The gate has already failed on its own merits; this
    // only says WHICH KIND of red it is, and must never soften that verdict — so
    // it always exits 0 and never touches the caller's exit code.
    console.log('regen-repairability diagnosis (classification only — this does NOT change any verdict):');
    for (const r of res.repaired) {
      console.log(`  ⏳ ${r.id}: REGEN LAG — the declared regen erases this drift (verified: repaired by the ${r.via}).`);
      console.log('     derived-artifacts-regen.yml is the single writer (SO #35) and repairs it on this same push.');
      console.log('     Expected human-push → red → bot-regen → green cycle. No human action needed.');
    }
    for (const u of res.unrepairable) {
      console.log(`  ⛔ ${u.id}: PERMANENT — NOT repairable by the main-side regen [${u.stage}]. ${u.reason}`);
      console.log('     ⛔ No workflow will ever clear this. It needs a human PR (for a stale/orphaned');
      console.log('        artifact that is usually a `git rm`), or a generator whose write path repairs');
      console.log('        what its own --check reports. This is the shape that held main red for 15 hours.');
    }
    for (const r of res.notReproduced) {
      console.log(`  ℹ ${r.id}: not reproduced at HEAD — green on the committed tree.`);
    }
    if (!res.repaired.length && !res.unrepairable.length && !res.notReproduced.length) {
      console.log('  ℹ nothing to classify.');
    }
    process.exit(0);
  }

  const { hardFail, lines } = reportProbe(res);
  for (const l of lines) console.log(l);
  process.exit(hardFail ? 1 : 0);
}
