#!/usr/bin/env node
/**
 * scripts/check-deploy-superseded.mjs — DEPLOY-REGEN-RACE-1
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * `Deploy to DreamHost` and `Derived Artifacts Regen` BOTH trigger on
 * `push: main`, so they start together and Deploy races the regen. Measured
 * 2026-08-23:
 *
 *   Deploy to DreamHost: failure  e7e6ef34  (the merge commit, run 32659409887)
 *     🧊 Generated-surface freshness gates
 *        gen-llms-full --check: llms-full.txt is stale.
 *        ##[error]Process completed with exit code 1.
 *   Deploy to DreamHost: success  57f6b05e  (the regen bot's commit, 34s later)
 *
 * `llms-full.txt` is a SHARED DERIVED ARTIFACT: SO #35 makes main's
 * derived-artifacts-regen.yml its single writer and FORBIDS the merging PR from
 * regenerating it. So the merge commit is stale BY CONSTRUCTION, the bot repairs
 * it seconds later, and Deploy reports a failure for a condition that was
 * already being fixed while the alert was being written. 3 of the last 20 Deploy
 * runs on main are this same false alarm (b1b22a4f, 5dc419cf, e7e6ef34).
 *
 * ⚠ WHY THAT OUTRANKS ITS SIZE: it reds a run on ANY merge that dirties a
 * single-writer artifact, by construction, forever. A red-main alert that is
 * routinely a false alarm is one people learn to ignore — and this estate has
 * already paid for that, with a GENUINE red main unnoticed for 15 hours on
 * 2026-08-22/23. The alert channel's value is its precision, not its sensitivity.
 *
 * ── WHAT THIS SCRIPT DOES, AND THE LINE IT MUST NOT CROSS ────────────────────
 * ⛔ It does NOT make Deploy tolerate stale derived artifacts. That would let a
 * genuinely stale artifact ship. The distinction it preserves is
 *
 *      REPAIRABLE-AND-ABOUT-TO-BE-REPAIRED   vs   ACTUALLY STALE
 *
 * and collapsing those two is the failure this exists to avoid. So it answers
 * exactly one question — "is this Deploy run SUPERSEDED by the commit the regen
 * bot is about to push?" — and it answers it by DEMONSTRATION, never by
 * assumption, reusing the probe MERGEQUEUE-GATE-PARITY-1 (PR #1488) already
 * built for the adjacent problem:
 *
 *   1. Derive, from the deploy workflow's own text, which COVERED freshness
 *      gates its preflight job actually runs raw (11 today). ⛔ Not hardcoded —
 *      a gate step added or removed later is picked up with no edit here.
 *   2. Run those gates against the checked-out tree.
 *        all green -> NOT superseded. There is no false alarm to prevent and
 *                     Deploy proceeds exactly as it does today.
 *   3. For the red ones, run check-regen-repairable.mjs's probeRepairable() in a
 *      throwaway worktree off HEAD: run the declared regen chain (escalating to
 *      the full `derived-artifacts.mjs --regen` the bot literally runs) and
 *      re-run the gate.
 *        every red gate REPAIRED  -> SUPERSEDED. The bot's commit will carry the
 *                                    repair, and that commit fires a fresh,
 *                                    FULLY GATED Deploy run seconds later.
 *        any UNREPAIRABLE / not
 *        reproduced / probe error -> NOT superseded. The preflight job then runs
 *                                    the identical raw gate and goes red exactly
 *                                    as it does today. ⭐ THE RED IS PRESERVED.
 *
 * ── WHY "SUPERSEDED" MEANS *DO NOT DEPLOY*, NOT "DEPLOY ANYWAY" ──────────────
 * A superseded run SKIPS the deploy job. That is the whole point: the tree at
 * this commit is stale, so shipping it would publish the stale artifact — the
 * trap. Nothing is deployed until a fully-green preflight says so, and the tree
 * that eventually ships is the REPAIRED one (the bot's commit). Compared with
 * today, a superseded run deploys exactly what today's failed run deployed —
 * nothing — so no window is opened; only the red is removed.
 *
 * ── FAIL DIRECTION (deliberately the inverse of a normal gate) ───────────────
 * ⛔ Standing down is the PRIVILEGE here, so standing down is what must be
 * affirmatively earned (SO #34c's shape, pointed at the right outcome). Every
 * unknown — an unparseable workflow, a gate command that maps to no COVERED
 * entry, a scratch worktree that cannot be created, an exception anywhere —
 * resolves to `superseded=false`, i.e. TODAY'S BEHAVIOUR: the preflight job runs
 * every gate raw and reds the run if the tree is genuinely stale. This script
 * therefore cannot introduce a red that did not already exist, and it cannot
 * suppress one it has not just demonstrated the bot erases.
 * ⇒ It always exits 0. Its only output is the `superseded` flag.
 *
 * Usage:
 *   node scripts/check-deploy-superseded.mjs          # classify; writes GITHUB_OUTPUT
 *   node scripts/check-deploy-superseded.mjs --gates  # just list the derived gate set
 */
import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO, advisoryGates } from './derived-artifacts.mjs';
import { probeRepairable, selectEntries } from './check-regen-repairable.mjs';
import { withScratchWorktree } from './check-derived-regen-live.mjs';
import { normalizeCmd, workflowCommands } from './check-workflow-gate-parity.mjs';
import { gitEnv } from './_git-env-lib.mjs';

export const DEPLOY_WORKFLOW = '.github/workflows/deploy-to-dreamhost.yml';

// Same git-env hygiene as check-regen-repairable.mjs: several COVERED gates shell
// out to `git` themselves, and an inherited GIT_DIR beats cwd (SO #57). One
// scrub helper, never a private copy — check-git-env-scrub.mjs reds a seventh.
const EXEC_OPTS = (dir) => ({
  cwd: dir,
  env: gitEnv({ PYTHONIOENCODING: 'utf-8' }),
  stdio: ['ignore', 'pipe', 'pipe'],
});

/** Default gate runner (injectable so the paired test drives the classifier with no processes at all). */
export function defaultExec(cmd, dir = REPO) {
  try {
    return { ok: true, output: (execSync(cmd, EXEC_OPTS(dir)).toString() || '').trim() };
  } catch (e) {
    return { ok: false, output: ((e.stdout?.toString() || '') + (e.stderr?.toString() || '')).trim() };
  }
}

/**
 * The COVERED freshness gates the deploy workflow invokes RAW, derived from the
 * workflow text itself (SO #34: recompute, never inherit a list). Order and
 * duplicates are collapsed; only commands that are members of advisoryGates()
 * qualify, because only those are single-writer artifacts a merge commit is
 * forbidden to repair.
 *
 * ⚠ run-gate.mjs wrappers are deliberately NOT unwrapped: a wrapped gate already
 * carries the PR-advisory split, and on a main-only workflow that split blocks
 * anyway. There are none in this workflow today; if one appears, it lands in the
 * same set only if written raw, which is the shape this script measures.
 */
export function deployGateCommands(workflowText, advisory = new Set([...advisoryGates()].map(normalizeCmd))) {
  const seen = new Set();
  const out = [];
  for (const { command } of workflowCommands(workflowText)) {
    const cmd = normalizeCmd(command);
    if (!advisory.has(cmd) || seen.has(cmd)) continue;
    seen.add(cmd);
    out.push(cmd);
  }
  return out;
}

/**
 * The decision. Pure with respect to the repository — every effect goes through
 * `exec` (gate runs against the real tree) and `probe` (the throwaway-worktree
 * repairability demonstration), so the paired test drives every branch with no
 * git, no worktree and no generators.
 *
 * @returns {{superseded: boolean, reason: string, red: string[], lines: string[]}}
 */
export function classifySuperseded({ gates, exec = defaultExec, probe, covered }) {
  const lines = [];
  const say = (s) => lines.push(s);

  if (!gates.length) {
    return {
      superseded: false,
      reason: 'NO-GATES-DERIVED',
      red: [],
      lines: [
        '⚠ derived ZERO shared-derived-artifact gates from ' + DEPLOY_WORKFLOW + '.',
        '  Refusing to stand down on a derivation that measured nothing — Deploy proceeds exactly as it does today.',
        '  (scripts/check-deploy-superseded.test.mjs asserts the real workflow yields a non-empty set, so this',
        '   state means the workflow genuinely stopped running these gates, or the parse broke.)',
      ],
    };
  }

  say(`deploy-superseded: ${gates.length} shared-derived-artifact gate(s) run raw by ${DEPLOY_WORKFLOW}`);
  const red = [];
  for (const cmd of gates) {
    const r = exec(cmd);
    if (r.ok) continue;
    red.push(cmd);
    say(`  ✗ STALE AT THIS COMMIT: ${cmd}`);
    if (r.output) say('      ' + r.output.split('\n').join('\n      '));
  }

  if (!red.length) {
    say('✓ every shared derived artifact is fresh at this commit — nothing for the regen bot to repair here.');
    return { superseded: false, reason: 'NO-DRIFT', red, lines };
  }

  const entries = selectEntries({ gates: red }, covered);
  if (entries.length !== red.length) {
    say(`⚠ ${red.length} stale gate(s) but only ${entries.length} map to a COVERED entry — advisoryGates() and COVERED have drifted.`);
    say('  Repairability cannot be established, so this run is NOT treated as superseded (preflight reds it as usual).');
    return { superseded: false, reason: 'ENTRY-MAPPING-DRIFT', red, lines };
  }

  let res;
  try {
    res = probe(entries);
  } catch (e) {
    say(`⚠ the repairability probe could not run: ${e?.message || e}`);
    say('  A probe that produced no result is not a verdict (SO #34c) — NOT superseded; preflight reds it as usual.');
    return { superseded: false, reason: 'PROBE-UNAVAILABLE', red, lines };
  }

  for (const r of res.repaired) {
    say(`  ⏳ REGEN LAG: ${r.id} — the declared regen erases this drift (demonstrated: repaired by the ${r.via}).`);
  }
  for (const u of res.unrepairable) {
    say(`  ⛔ PERMANENT: ${u.id} [${u.stage}] ${u.reason}`);
    if (u.output) say('      ' + u.output.split('\n').join('\n      '));
  }
  for (const n of res.notReproduced) {
    say(`  ⚠ ${n.id} was stale in the checked-out tree but GREEN at HEAD in the scratch worktree — the two cannot legitimately disagree in CI.`);
  }

  if (res.unrepairable.length || res.notReproduced.length || res.repaired.length !== red.length) {
    say('');
    say('⛔ NOT SUPERSEDED — at least one stale artifact is NOT repairable by the main-side regen (or repairability');
    say('   could not be demonstrated for all of them). This drift survives the merge, so it must red Deploy exactly');
    say('   as it does today: the preflight job below runs the identical gate raw and fails on it.');
    return { superseded: false, reason: 'UNREPAIRABLE', red, lines };
  }

  say('');
  say('✅ SUPERSEDED — every stale artifact here is one derived-artifacts-regen.yml is repairing on this same push');
  say('   (SO #35 makes main its single writer and forbids the merging PR from regenerating it). The bot\'s commit');
  say('   fires a fresh Deploy run within seconds, and THAT run gates and ships the repaired tree.');
  say('   ⛔ This run therefore deploys NOTHING — standing down is not tolerating the staleness, it is declining to');
  say('      publish it. No window is opened: deploy still happens only behind a fully green preflight.');
  return { superseded: true, reason: 'REGEN-LAG', red, lines };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  let workflowText = '';
  try {
    workflowText = readFileSync(resolve(REPO, DEPLOY_WORKFLOW), 'utf8');
  } catch (e) {
    console.log(`⚠ could not read ${DEPLOY_WORKFLOW}: ${e.message} — NOT superseded.`);
  }
  const gates = workflowText ? deployGateCommands(workflowText) : [];

  if (process.argv.includes('--gates')) {
    for (const g of gates) console.log(g);
    process.exit(0);
  }

  const result = classifySuperseded({
    gates,
    probe: (entries) => withScratchWorktree((dir) => probeRepairable({ dir, entries })),
  });

  for (const l of result.lines) console.log(l);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `superseded=${result.superseded}\nreason=${result.reason}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const head = result.superseded
      ? '### ⏳ Deploy stood down — superseded by the derived-artifacts regen\n\n'
        + 'Every shared derived artifact that is stale at this commit was DEMONSTRATED repairable by '
        + '`derived-artifacts-regen.yml`, which is committing that repair on this same push. The bot\'s commit '
        + 'fires a fresh, fully gated Deploy run — that one ships the repaired tree. Nothing was deployed here.\n\n'
      : `### Deploy proceeding normally (not superseded — ${result.reason})\n\n`;
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, head + '```\n' + result.lines.join('\n') + '\n```\n');
  }

  // ⛔ ALWAYS 0. See the header's fail-direction note: this script's only power is
  // to make Deploy stand down, so every failure mode must resolve to "do not
  // stand down", which is today's behaviour — never to a new red.
  process.exit(0);
}
